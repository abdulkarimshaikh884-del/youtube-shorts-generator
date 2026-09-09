/* ============================================================
   animate.js — turn a user prompt into a real animation.

   How it works: the model does NOT write code. It returns a small scene
   definition containing approved layout, theme, motion and editable content
   choices. compileDefinition() turns that definition into house-owned markup
   and CSS, then SC_TPL2.buildCustom assembles the final document. AI scenes
   therefore use the same canvas, safe box, watermark and frame-stepped export
   path as shipped templates without executing model-authored code.

   SECURITY: model output is untrusted input, exactly like user-submitted HTML.
   `sanitise()` is a closed allowlist of tags, attributes and CSS constructs and
   it runs on BOTH the generate path and the export path, because a client can
   post any `spec` it likes.
   ============================================================ */

const MAX_CSS = 24000;
const MAX_BODY = 8000;
const MAX_IMG_BYTES = 1_200_000;      // ~1.2 MB data URL

/* Tags a scene may use. No <img> — pictures arrive as --img on a background,
   which keeps every external reference out of the document. */
const TAGS = new Set([
  "div", "span", "p", "b", "i", "em", "strong", "small", "br", "section", "figure",
  "h1", "h2", "h3", "ul", "ol", "li", "table", "tr", "td",
  "svg", "g", "path", "circle", "ellipse", "rect", "line", "polyline", "polygon",
  "defs", "clippath", "mask", "lineargradient", "radialgradient", "stop", "use", "text", "tspan"
]);

const ATTRS = new Set([
  "class", "id", "aria-hidden", "role",
  "viewbox", "d", "cx", "cy", "r", "rx", "ry", "x", "y", "x1", "x2", "y1", "y2",
  "width", "height", "fill", "fill-rule", "fill-opacity", "stroke", "stroke-width",
  "stroke-linecap", "stroke-linejoin", "stroke-dasharray", "stroke-dashoffset",
  "points", "transform", "opacity", "offset", "stop-color", "stop-opacity",
  "gradientunits", "clip-path", "mask", "text-anchor", "font-size", "font-weight",
  "dominant-baseline", "preserveaspectratio", "style"
]);

/* things that must never appear anywhere in css or body */
const POISON = [
  [/<\s*script/i, "a <script> tag"],
  [/<\s*(iframe|object|embed|link|meta|base|form|input|button|textarea|style)\b/i, "a forbidden tag"],
  [/\son[a-z]+\s*=/i, "an inline event handler"],
  [/javascript\s*:/i, "a javascript: url"],
  [/data\s*:\s*text\/html/i, "a data:text/html url"],
  [/@import/i, "@import"],
  [/expression\s*\(/i, "CSS expression()"],
  [/behavior\s*:/i, "CSS behavior"],
  [/-moz-binding/i, "-moz-binding"],
  [/<!--/, "an HTML comment"],
  [/&#/, "an HTML entity escape"]
];

class BadScene extends Error {}

function checkPoison(text, where) {
  for (const [re, what] of POISON) {
    if (re.test(text)) throw new BadScene(`${where} contains ${what}`);
  }
}

/* ── CSS ──────────────────────────────────────────────────
   url() is only allowed as url(var(--img)); everything else would let a scene
   phone home or pull a font/tracker. */
function cleanCss(css) {
  if (typeof css !== "string") throw new BadScene("css missing");
  css = css.replace(/\/\*[\s\S]*?\*\//g, " ").trim();
  if (!css) throw new BadScene("css empty");
  if (css.length > MAX_CSS) throw new BadScene(`css too large (${css.length} > ${MAX_CSS})`);

  // Refuse angle brackets outright instead of stripping them. Stylesheets never
  // need them, and a "</style><script>" breakout must be rejected, not quietly
  // cleaned — stripping invites bypasses through nesting like "<<script>".
  // This check runs BEFORE any tag removal, or checkPoison would never see it.
  if (/[<>]/.test(css)) throw new BadScene("css contains an angle bracket");
  checkPoison(css, "css");

  // Only url(var(--img)) is permitted. Match the whole call including the
  // nested var(...) parens — a plain [^)]* stops at var's own ")" and would
  // reject the one form we actually allow.
  const urls = css.match(/url\s*\([^()]*(?:\([^()]*\)[^()]*)*\)/gi) || [];
  for (const u of urls) {
    if (!/^url\s*\(\s*var\(\s*--img\s*\)\s*\)$/i.test(u.trim())) {
      throw new BadScene(`css uses ${u.slice(0, 40)} — only url(var(--img)) is allowed`);
    }
  }
  // no scene may reach outside its own frame
  if (/position\s*:\s*fixed/i.test(css)) css = css.replace(/position\s*:\s*fixed/gi, "position:absolute");
  return css;
}

/* ── HTML body ────────────────────────────────────────────
   A scan rather than a parse: every tag must be in TAGS, every attribute in
   ATTRS, style attributes get the same url() rule as the stylesheet. */
function cleanBody(body) {
  if (typeof body !== "string") throw new BadScene("body missing");
  body = body.trim();
  if (!body) throw new BadScene("body empty");
  if (body.length > MAX_BODY) throw new BadScene(`body too large (${body.length} > ${MAX_BODY})`);
  checkPoison(body, "body");

  // If a path has raw coordinates without M/L commands, format as valid M/L SVG path
  body = body.replace(/<path\s+([^>]*?)d=['"]([0-9\s,.-]+)['"]([^>]*)>/gi, function (match, p1, pts, p2) {
    if (!/[a-df-z]/i.test(pts)) {
      var nums = pts.trim().split(/[\s,]+/);
      if (nums.length >= 2) {
        var dPath = "M" + nums[0] + " " + nums[1];
        for (var i = 2; i < nums.length; i += 2) {
          if (nums[i + 1] !== undefined) dPath += " L" + nums[i] + " " + nums[i + 1];
        }
        return "<path " + p1 + 'd="' + dPath + '"' + p2 + ">";
      }
    }
    return match;
  });

  const tagRe = /<\s*\/?\s*([a-zA-Z][a-zA-Z0-9-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  let m;
  while ((m = tagRe.exec(body))) {
    const tag = m[1].toLowerCase();
    if (!TAGS.has(tag)) throw new BadScene(`body uses <${tag}>, which is not allowed`);

    const attrRe = /([a-zA-Z][a-zA-Z0-9_:-]*)\s*(?:=\s*("[^"]*"|'[^']*'|[^\s>]+))?/g;
    let a;
    while ((a = attrRe.exec(m[2] || ""))) {
      const name = a[1].toLowerCase();
      if (!ATTRS.has(name)) {
        // Refuse, do not skip. "Skip" left the attribute sitting in the body
        // string that gets rendered — the allowlist was being consulted and
        // then ignored, so things like srcdoc sailed through. The scene is
        // model output we can regenerate, so rejecting costs nothing.
        throw new BadScene(`body uses the ${name} attribute, which is not allowed`);
      }
      const val = (a[2] || "").replace(/^['"]|['"]$/g, "");
      if (name === "style") {
        if (/[<>]/.test(val)) throw new BadScene("style attribute contains angle brackets");
        const urls = val.match(/url\s*\(([^)]*)\)/gi) || [];
        for (const u of urls) {
          if (!/url\s*\(\s*var\(\s*--img\s*\)\s*\)/i.test(u)) {
            throw new BadScene("style attribute uses a forbidden url()");
          }
        }
      }
    }
  }
  // unbalanced markup would leak into the watermark div
  const open = (body.match(/<\s*[a-zA-Z]/g) || []).length;
  const close = (body.match(/<\s*\//g) || []).length;
  const selfish = (body.match(/\/\s*>/g) || []).length;
  if (open - selfish - close > 4) throw new BadScene("body has unclosed tags");
  return body;
}

function cleanImage(img) {
  if (!img) return null;
  const s = String(img);
  if (!/^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(s)) {
    throw new BadScene("the attached image must be a base64 png, jpeg, webp or gif");
  }
  if (s.length > MAX_IMG_BYTES) {
    throw new BadScene(`the attached image is too large (${Math.round(s.length / 1024)} KB, limit ${Math.round(MAX_IMG_BYTES / 1024)} KB)`);
  }
  return s;
}

/* ── Constrained scene definition ─────────────────────────
   The model chooses from this vocabulary. It never gets to invent selectors,
   markup, URLs or animation code; compileDefinition() owns all of that. */
const DEFINITION_VERSION = 1;
const LAYOUTS = new Set(["centered-hero", "metric-card", "comparison", "ranked-list", "chat", "product-showcase"]);
const THEMES = {
  "dark-futuristic": { dark: true, bg: "#070812", accent: "#7c5cff" },
  midnight: { dark: true, bg: "#080b14", accent: "#5b8cff" },
  emerald: { dark: true, bg: "#07100f", accent: "#35d39a" },
  "warm-editorial": { dark: true, bg: "#120d0a", accent: "#ffb44c" },
  light: { dark: false, bg: "#f5f3ed", accent: "#3157e5" }
};
const ENTRANCES = new Set(["fade-up", "blur-reveal", "scale-in", "spring-pop"]);
const INTENSITIES = new Set(["subtle", "balanced", "bold"]);
const CONTENT_KEYS = ["kicker", "title", "subtitle", "primary", "secondary", "footer"];
const CONTENT_LIMITS = { kicker: 30, title: 72, subtitle: 140, primary: 52, secondary: 52, footer: 64 };

/* Story definitions are the launch-quality format. A model plans 2-4 beats;
   the compiler still owns every tag, selector and keyframe. Version 1 remains
   supported so saved drafts created before this upgrade continue to render. */
const STORY_VERSION = 2;
const STORY_LAYOUTS = new Set([
  "kinetic-hero", "stat-reveal", "split-compare", "ranked-stack", "chat-story",
  "product-focus", "quote-poster", "steps-flow", "feature-grid", "countdown"
]);
const STORY_BACKGROUNDS = new Set(["mesh-grid", "spotlight", "aurora", "paper", "gradient", "minimal"]);
const STORY_TRANSITIONS = new Set(["crossfade", "zoom-through", "slide-flow", "wipe-up"]);
const STORY_ENTRANCES = new Set(["blur-rise", "spring", "slide-left", "wipe-up", "zoom", "type", "flip"]);
const STORY_LIMITS = { eyebrow: 28, title: 64, body: 120, primary: 42, secondary: 42, item: 44 };

function cleanPlainText(value, max) {
  return String(value == null ? "" : value)
    .replace(/[<>{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}

function cleanStoryText(value, max) {
  const full = cleanPlainText(value, Math.max(max * 3, max));
  if (full.length <= max) return full;
  const room = Math.max(1, max - 1);
  const cut = full.slice(0, room);
  const lastWord = cut.lastIndexOf(" ");
  return `${(lastWord > Math.floor(room * .62) ? cut.slice(0, lastWord) : cut).trim()}…`;
}

function normaliseDefinition(raw, options = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadScene("scene definition missing");
  const themeName = Object.prototype.hasOwnProperty.call(THEMES, raw.theme) ? raw.theme : "dark-futuristic";
  const theme = THEMES[themeName];
  const layout = LAYOUTS.has(raw.layout) ? raw.layout : "centered-hero";
  const motionRaw = raw.motion && typeof raw.motion === "object" ? raw.motion : {};
  const contentRaw = raw.content && typeof raw.content === "object" && !Array.isArray(raw.content) ? raw.content : {};
  const content = {};
  CONTENT_KEYS.forEach((key) => {
    content[key] = cleanPlainText(contentRaw[key], CONTENT_LIMITS[key]);
  });
  if (!content.title) content.title = cleanPlainText(options.prompt || "A premium motion story", CONTENT_LIMITS.title);
  if (!content.kicker) content.kicker = "ShortsCraft AI";
  if (!content.subtitle) content.subtitle = "Built from approved premium motion primitives.";
  if (!content.primary) content.primary = layout === "metric-card" ? "+248%" : "Option A";
  if (!content.secondary) content.secondary = layout === "metric-card" ? "Growth this month" : "Option B";
  if (!content.footer) content.footer = "Ready to customize";

  return {
    version: DEFINITION_VERSION,
    name: cleanPlainText(raw.name || "AI Original", 60),
    theme: themeName,
    layout,
    accent: /^#[0-9a-f]{6}$/i.test(String(raw.accent || "")) ? String(raw.accent) : theme.accent,
    content,
    motion: {
      entrance: ENTRANCES.has(motionRaw.entrance) ? motionRaw.entrance : "blur-reveal",
      stagger: motionRaw.stagger !== false,
      intensity: INTENSITIES.has(motionRaw.intensity) ? motionRaw.intensity : "balanced"
    },
    hasImage: !!options.image
  };
}

function definitionSchema(content) {
  const labels = {
    kicker: "Eyebrow label", title: "Main headline", subtitle: "Supporting copy",
    primary: "Primary value or item", secondary: "Secondary value or item", footer: "Footer or call to action"
  };
  return {
    version: 1,
    fields: CONTENT_KEYS.map((key) => ({
      key,
      label: labels[key],
      type: key === "subtitle" ? "textarea" : "text",
      default: content[key],
      maxLength: CONTENT_LIMITS[key]
    })),
    defaults: { ...content }
  };
}

function compileLegacyDefinition(definition, image) {
  const def = normaliseDefinition(definition, { image, prompt: definition && definition.content && definition.content.title });
  const theme = THEMES[def.theme];
  const entranceClass = {
    "fade-up": "ai-fade", "blur-reveal": "ai-blur", "scale-in": "ai-scale", "spring-pop": "ai-pop"
  }[def.motion.entrance];
  const staggerClass = def.motion.stagger ? " ai-stagger" : "";
  const intensity = { subtle: ".55", balanced: "1", bold: "1.3" }[def.motion.intensity];

  const css = `.ai-scene{position:absolute;inset:0;overflow:hidden;background:${theme.bg};color:${theme.dark ? "#fff" : "#111827"};--ai-intensity:${intensity}}`
    + `.ai-mesh{position:absolute;inset:-20%;background:radial-gradient(circle at 22% 22%,color-mix(in srgb,var(--ac) 28%,transparent),transparent 34%),radial-gradient(circle at 78% 76%,rgba(84,115,255,.18),transparent 34%);filter:blur(7cqw)}`
    + `.ai-grid{position:absolute;inset:0;opacity:.35;background-image:linear-gradient(rgba(255,255,255,.05) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.05) 1px,transparent 1px);background-size:6cqw 6cqw;mask-image:linear-gradient(black,transparent 94%)}`
    + `.ai-safe{position:absolute;inset:0;padding:7cqw;display:flex;align-items:center;justify-content:center}.ai-inner{position:relative;z-index:2;width:min(90cqw,880px)}`
    + `.ai-kicker{display:inline-flex;padding:1.2cqw 2.4cqw;border-radius:999px;background:color-mix(in srgb,var(--ac) 17%,transparent);border:1px solid color-mix(in srgb,var(--ac) 45%,transparent);color:var(--ac);font-size:2.25cqw;font-weight:800;letter-spacing:.14em;text-transform:uppercase}`
    + `.ai-title{font-size:8cqw;line-height:.94;letter-spacing:-.05em;font-weight:900;margin:3cqw 0 2cqw;overflow-wrap:anywhere}.ai-sub{font-size:3.2cqw;line-height:1.42;color:var(--dim);max-width:78cqw}`
    + `.ai-card{padding:4cqw;border-radius:4cqw;background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.13);box-shadow:0 4cqw 13cqw rgba(0,0,0,.36);backdrop-filter:blur(16px)}`
    + `.ai-row{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:3cqw;margin-top:5cqw}.ai-value{font-size:7cqw;line-height:.95;font-weight:900;color:var(--ac);overflow-wrap:anywhere}.ai-label{font-size:2.7cqw;line-height:1.3;color:var(--dim);margin-top:1.3cqw}`
    + `.ai-list{display:flex;flex-direction:column;gap:2cqw;margin-top:5cqw}.ai-list .ai-card{display:flex;align-items:center;gap:3cqw;padding:2.6cqw 3.2cqw}.ai-rank{font-size:4.5cqw;font-weight:900;color:var(--ac)}`
    + `.ai-chat{display:flex;flex-direction:column;gap:2.4cqw;margin-top:5cqw}.ai-bubble{max-width:82%;padding:2.8cqw 3.4cqw;border-radius:3.5cqw;background:rgba(255,255,255,.1);font-size:3.2cqw;line-height:1.4}.ai-bubble.out{align-self:flex-end;background:var(--ac);color:#fff}`
    + `.ai-browser{margin-top:5cqw;padding:1.2cqw;border-radius:5cqw;background:rgba(255,255,255,.08);border:1px solid rgba(255,255,255,.14);box-shadow:0 5cqw 16cqw rgba(0,0,0,.42)}.ai-browserbar{height:5cqh;display:flex;align-items:center;gap:1cqw;padding:0 2cqw}.ai-dot{width:1.3cqw;height:1.3cqw;border-radius:50%;background:rgba(255,255,255,.3)}.ai-image{height:34cqh;border-radius:4cqw;background:${image ? "linear-gradient(rgba(5,8,15,.08),rgba(5,8,15,.2)),url(var(--img)) center/cover" : "linear-gradient(145deg,color-mix(in srgb,var(--ac) 42%,#111827),#111827)"};display:grid;place-items:center}`
    + `.ai-footer{margin-top:4cqw;font-size:2.4cqw;color:var(--dim);font-weight:700;letter-spacing:.08em;text-transform:uppercase}`
    + `.ai-enter{animation-duration:var(--D);animation-timing-function:var(--sp);animation-iteration-count:infinite}.ai-stagger .ai-enter{animation-delay:calc(var(--i,0)*90ms)}`
    + `.ai-fade{animation-name:aiFade}.ai-blur{animation-name:aiBlur}.ai-scale{animation-name:aiScale}.ai-pop{animation-name:aiPop}`
    + `@keyframes aiFade{0%,10%{opacity:0;transform:translateY(calc(3cqh*var(--ai-intensity)))}28%,84%{opacity:1;transform:none}100%{opacity:0;transform:translateY(-1cqh)}}`
    + `@keyframes aiBlur{0%,10%{opacity:0;filter:blur(calc(1.8cqw*var(--ai-intensity)));transform:translateY(2cqh)}28%,84%{opacity:1;filter:blur(0);transform:none}100%{opacity:0;filter:blur(.4cqw)}}`
    + `@keyframes aiScale{0%,10%{opacity:0;transform:scale(.92)}28%,84%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.02)}}`
    + `@keyframes aiPop{0%,12%{opacity:0;transform:scale(.82)}30%,84%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(1.025)}}`
    + `@container (min-aspect-ratio:1/1){.ai-inner{width:76cqw}.ai-title{font-size:6cqw}.ai-sub{font-size:2.4cqw}.ai-browser{display:grid;grid-template-columns:1fr}.ai-image{height:42cqh}}`;

  const head = `<span class="ai-kicker">{{kicker}}</span><h2 class="ai-title">{{title}}</h2><p class="ai-sub">{{subtitle}}</p>`;
  let content;
  if (def.layout === "comparison") {
    content = `${head}<div class="ai-row ai-stagger"><div class="ai-card ai-enter ${entranceClass}" style="--i:1"><div class="ai-value">{{primary}}</div><p class="ai-label">Option A</p></div><div class="ai-card ai-enter ${entranceClass}" style="--i:2"><div class="ai-value">{{secondary}}</div><p class="ai-label">Option B</p></div></div>`;
  } else if (def.layout === "metric-card") {
    content = `${head}<div class="ai-card ai-enter ${entranceClass}" style="margin-top:5cqw"><div class="ai-value">{{primary}}</div><p class="ai-label">{{secondary}}</p></div>`;
  } else if (def.layout === "ranked-list") {
    content = `${head}<div class="ai-list ai-stagger"><div class="ai-card ai-enter ${entranceClass}" style="--i:1"><b class="ai-rank">01</b><span>{{primary}}</span></div><div class="ai-card ai-enter ${entranceClass}" style="--i:2"><b class="ai-rank">02</b><span>{{secondary}}</span></div><div class="ai-card ai-enter ${entranceClass}" style="--i:3"><b class="ai-rank">03</b><span>{{footer}}</span></div></div>`;
  } else if (def.layout === "chat") {
    content = `${head}<div class="ai-chat ai-stagger"><div class="ai-bubble ai-enter ${entranceClass}" style="--i:1">{{primary}}</div><div class="ai-bubble out ai-enter ${entranceClass}" style="--i:2">{{secondary}}</div></div>`;
  } else if (def.layout === "product-showcase") {
    content = `${head}<div class="ai-browser ai-enter ${entranceClass}"><div class="ai-browserbar"><i class="ai-dot"></i><i class="ai-dot"></i><i class="ai-dot"></i></div><div class="ai-image"><b class="ai-value">{{primary}}</b></div></div>`;
  } else {
    content = `<div style="text-align:center">${head}<div class="ai-card ai-enter ${entranceClass}" style="margin:5cqw auto 0;max-width:72cqw"><div class="ai-value">{{primary}}</div><p class="ai-label">{{secondary}}</p></div></div>`;
  }
  const body = `<div class="ai-scene"><div class="ai-mesh"></div><div class="ai-grid"></div><div class="ai-safe"><div class="ai-inner${staggerClass}">${content}<p class="ai-footer">{{footer}}</p></div></div></div>`;
  return {
    name: def.name,
    accent: def.accent,
    dark: theme.dark,
    css,
    body,
    img: cleanImage(image),
    schema: definitionSchema(def.content),
    definition: def
  };
}

function normaliseStoryDefinition(raw, options = {}) {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) throw new BadScene("story definition missing");
  const themeName = Object.prototype.hasOwnProperty.call(THEMES, raw.theme) ? raw.theme : "midnight";
  const theme = THEMES[themeName];
  const source = Array.isArray(raw.scenes) ? raw.scenes.slice(0, 4) : [];
  const promptTitle = cleanStoryText(options.prompt || "A premium creator story", STORY_LIMITS.title);
  const defaults = [
    { layout: "kinetic-hero", eyebrow: "THE BIG IDEA", title: promptTitle, body: "A sharp opening built to stop the scroll.", primary: "Watch this", secondary: "", items: [] },
    { layout: "feature-grid", eyebrow: "WHY IT MATTERS", title: "Made for attention", body: "Clear hierarchy, purposeful motion and creator-ready editing.", primary: "Fast", secondary: "Flexible", items: ["Premium motion", "Editable copy", "Clean pacing"] },
    { layout: "product-focus", eyebrow: "YOUR NEXT MOVE", title: "Make it yours", body: "Change every message, color and visual without rebuilding the animation.", primary: "Create now", secondary: "ShortsCraft", items: [] }
  ];
  while (source.length < 2) source.push(defaults[source.length]);

  const scenes = source.map((candidate, index) => {
    const beat = candidate && typeof candidate === "object" && !Array.isArray(candidate) ? candidate : defaults[index] || defaults[2];
    const fallback = defaults[index] || defaults[2];
    const itemsRaw = Array.isArray(beat.items) ? beat.items : [];
    const items = itemsRaw.slice(0, 4).map((item) => cleanStoryText(item, STORY_LIMITS.item)).filter(Boolean);
    return {
      layout: STORY_LAYOUTS.has(beat.layout) ? beat.layout : fallback.layout,
      eyebrow: cleanStoryText(beat.eyebrow || fallback.eyebrow, STORY_LIMITS.eyebrow),
      title: cleanStoryText(beat.title || fallback.title, STORY_LIMITS.title),
      body: cleanStoryText(beat.body || fallback.body, STORY_LIMITS.body),
      primary: cleanStoryText(beat.primary || fallback.primary, STORY_LIMITS.primary),
      secondary: cleanStoryText(beat.secondary || fallback.secondary, STORY_LIMITS.secondary),
      items: items.length ? items : (fallback.items || []).slice(),
      entrance: STORY_ENTRANCES.has(beat.entrance) ? beat.entrance : ["blur-rise", "slide-left", "spring", "wipe-up"][index % 4]
    };
  });

  return {
    version: STORY_VERSION,
    name: cleanPlainText(raw.name || "AI Storyboard", 60),
    theme: themeName,
    accent: /^#[0-9a-f]{6}$/i.test(String(raw.accent || "")) ? String(raw.accent) : theme.accent,
    background: STORY_BACKGROUNDS.has(raw.background) ? raw.background : "mesh-grid",
    transition: STORY_TRANSITIONS.has(raw.transition) ? raw.transition : "crossfade",
    scenes,
    hasImage: !!options.image
  };
}

function storyFieldKey(index, name) {
  return `s${index + 1}${name[0].toUpperCase()}${name.slice(1)}`;
}

function storySchema(scenes) {
  const fields = [];
  const defaults = {};
  scenes.forEach((scene, index) => {
    const beat = index + 1;
    const add = (name, label, value, maxLength, type) => {
      const key = storyFieldKey(index, name);
      const field = { key, label: `Scene ${beat} · ${label}`, type: type || "text", default: value, maxLength };
      fields.push(field);
      defaults[key] = value;
    };
    add("eyebrow", "Eyebrow", scene.eyebrow, STORY_LIMITS.eyebrow);
    add("title", "Headline", scene.title, STORY_LIMITS.title);
    add("body", "Supporting copy", scene.body, STORY_LIMITS.body, "textarea");
    add("primary", "Primary value", scene.primary, STORY_LIMITS.primary);
    add("secondary", "Secondary value", scene.secondary, STORY_LIMITS.secondary);
    scene.items.forEach((item, itemIndex) => add(`item${itemIndex + 1}`, `List item ${itemIndex + 1}`, item, STORY_LIMITS.item));
  });
  return { version: STORY_VERSION, fields, defaults };
}

function storyHead(index) {
  return `<span class="ai2-eye">{{${storyFieldKey(index, "eyebrow")}}}</span>`
    + `<h2 class="ai2-title">{{${storyFieldKey(index, "title")}}}</h2>`
    + `<p class="ai2-copy">{{${storyFieldKey(index, "body")}}}</p>`;
}

function storyItems(scene, index, ranked) {
  return scene.items.map((_, itemIndex) => `<div class="ai2-item"><b>${ranked ? String(itemIndex + 1).padStart(2, "0") : "✦"}</b><span>{{${storyFieldKey(index, `item${itemIndex + 1}`)}}}</span></div>`).join("");
}

function storyLayout(scene, index, hasImage) {
  const primary = `{{${storyFieldKey(index, "primary")}}}`;
  const secondary = `{{${storyFieldKey(index, "secondary")}}}`;
  const head = storyHead(index);
  if (scene.layout === "stat-reveal") return `${head}<div class="ai2-stat"><strong>${primary}</strong><span>${secondary}</span></div>`;
  if (scene.layout === "split-compare") return `${head}<div class="ai2-split"><div class="ai2-card"><small>A</small><strong>${primary}</strong></div><div class="ai2-vs">VS</div><div class="ai2-card"><small>B</small><strong>${secondary}</strong></div></div>`;
  if (scene.layout === "ranked-stack") return `${head}<div class="ai2-list">${storyItems(scene, index, true)}</div>`;
  if (scene.layout === "chat-story") return `${head}<div class="ai2-chat"><div class="ai2-bubble">${primary}</div><div class="ai2-bubble ai2-out">${secondary}</div></div>`;
  if (scene.layout === "product-focus") return `${head}<div class="ai2-device"><div class="ai2-dots"><i></i><i></i><i></i></div><div class="ai2-media${hasImage ? " has-image" : ""}"><strong>${primary}</strong><span>${secondary}</span></div></div>`;
  if (scene.layout === "quote-poster") return `<div class="ai2-quote"><i>“</i>${head}<strong>${primary}</strong><span>${secondary}</span></div>`;
  if (scene.layout === "steps-flow") return `${head}<div class="ai2-steps">${storyItems(scene, index, true)}</div>`;
  if (scene.layout === "feature-grid") return `${head}<div class="ai2-features">${storyItems(scene, index, false)}</div><div class="ai2-pills"><b>${primary}</b><span>${secondary}</span></div>`;
  if (scene.layout === "countdown") return `<div class="ai2-count"><strong>${primary}</strong></div>${head}<div class="ai2-pills"><b>${secondary}</b></div>`;
  return `<div class="ai2-hero">${head}<div class="ai2-pills"><b>${primary}</b><span>${secondary}</span></div></div>`;
}

function beatKeyframes(index, count, entrance, transition) {
  const slot = 100 / count;
  const start = index * slot;
  const end = (index + 1) * slot;
  const fade = Math.min(4.5, slot * .2);
  const visibleStart = start + fade;
  const visibleEnd = end - fade;
  const enter = {
    "blur-rise": "opacity:0;filter:blur(2cqw);transform:translateY(5cqh) scale(.98)",
    spring: "opacity:0;transform:scale(.78)",
    "slide-left": "opacity:0;transform:translateX(14cqw)",
    "wipe-up": "opacity:0;clip-path:inset(100% 0 0 0);transform:translateY(3cqh)",
    zoom: "opacity:0;transform:scale(1.16)",
    type: "opacity:0;filter:blur(.8cqw);transform:translateY(2cqh)",
    flip: "opacity:0;transform:perspective(900px) rotateX(24deg) scale(.92)"
  }[entrance] || "opacity:0;transform:translateY(4cqh)";
  const exit = transition === "zoom-through" ? "opacity:0;transform:scale(1.12);filter:blur(1cqw)"
    : transition === "slide-flow" ? "opacity:0;transform:translateX(-12cqw)"
      : transition === "wipe-up" ? "opacity:0;clip-path:inset(0 0 100% 0);transform:translateY(-3cqh)"
        : "opacity:0;transform:scale(1.02)";
  const pct = (n) => Math.max(0, Math.min(100, n)).toFixed(2).replace(/\.00$/, "");
  const pre = index === 0 ? "0%" : `0%,${pct(start)}%`;
  const post = index === count - 1 ? "100%" : `${pct(end)}%,100%`;
  return `@keyframes ai2Beat${index + 1}{${pre}{${enter}}${pct(visibleStart)}%,${pct(visibleEnd)}%{opacity:1;filter:blur(0);transform:none;clip-path:inset(0)}${post}{${exit}}}`;
}

function compileStoryDefinition(definition, image) {
  const def = normaliseStoryDefinition(definition, { image, prompt: definition && definition.scenes && definition.scenes[0] && definition.scenes[0].title });
  const theme = THEMES[def.theme];
  const count = def.scenes.length;
  const css = `.ai2{position:absolute;inset:0;overflow:hidden;background:${theme.bg};color:${theme.dark ? "#fff" : "#10131d"};isolation:isolate}`
    + `.ai2-bg{position:absolute;inset:-12%;z-index:-2}.ai2.mesh-grid .ai2-bg{background:radial-gradient(circle at 18% 20%,color-mix(in srgb,var(--ac) 42%,transparent),transparent 31%),radial-gradient(circle at 82% 78%,rgba(52,117,255,.26),transparent 32%),linear-gradient(${theme.bg},${theme.bg})}.ai2.mesh-grid:after{content:"";position:absolute;inset:0;z-index:-1;opacity:.24;background-image:linear-gradient(rgba(255,255,255,.07) 1px,transparent 1px),linear-gradient(90deg,rgba(255,255,255,.07) 1px,transparent 1px);background-size:7cqw 7cqw;mask-image:linear-gradient(black,transparent 96%)}`
    + `.ai2.spotlight .ai2-bg{background:radial-gradient(ellipse at 50% 18%,color-mix(in srgb,var(--ac) 48%,transparent),transparent 45%),linear-gradient(160deg,${theme.bg},#05060a)}.ai2.aurora .ai2-bg{background:conic-gradient(from 210deg at 50% 50%,${theme.bg},color-mix(in srgb,var(--ac) 48%,#10172c),${theme.bg},#203054,${theme.bg});filter:blur(7cqw);animation:ai2Drift var(--D) ease-in-out infinite}.ai2.paper .ai2-bg{background:linear-gradient(135deg,rgba(255,255,255,.1),transparent),repeating-linear-gradient(0deg,transparent 0 4cqh,rgba(255,255,255,.045) 4cqh calc(4cqh + 1px))}.ai2.gradient .ai2-bg{background:linear-gradient(145deg,color-mix(in srgb,var(--ac) 42%,${theme.bg}),${theme.bg} 54%,#131d38)}.ai2.minimal .ai2-bg{background:${theme.bg}}`
    + `.ai2-beat{position:absolute;inset:0;padding:8cqw;display:flex;align-items:center;justify-content:center;opacity:0;animation-duration:var(--D);animation-timing-function:cubic-bezier(.2,.76,.2,1);animation-iteration-count:infinite;animation-fill-mode:both}.ai2-wrap{width:min(88cqw,900px);position:relative}.ai2-eye{display:inline-flex;padding:1.1cqw 2.2cqw;border-radius:999px;border:1px solid color-mix(in srgb,var(--ac) 55%,transparent);background:color-mix(in srgb,var(--ac) 14%,transparent);color:var(--ac);font-size:2.2cqw;font-weight:900;letter-spacing:.15em;text-transform:uppercase}.ai2-title{margin:3cqw 0 2cqw;font-size:8.3cqw;line-height:.94;letter-spacing:-.052em;font-weight:950;overflow-wrap:anywhere}.ai2-copy{max-width:78cqw;margin:0;color:var(--dim);font-size:3.15cqw;line-height:1.4}`
    + `.ai2-card,.ai2-item,.ai2-device,.ai2-stat{background:rgba(255,255,255,.075);border:1px solid rgba(255,255,255,.14);box-shadow:0 4cqw 14cqw rgba(0,0,0,.34);backdrop-filter:blur(18px)}.ai2-pills{display:flex;gap:2cqw;align-items:center;margin-top:4cqw}.ai2-pills b,.ai2-pills span{padding:1.6cqw 2.6cqw;border-radius:999px;background:var(--ac);color:#fff;font-size:2.7cqw}.ai2-pills span{background:rgba(255,255,255,.1);color:inherit}.ai2-stat{margin-top:5cqw;border-radius:5cqw;padding:5cqw}.ai2-stat strong{display:block;color:var(--ac);font-size:13cqw;line-height:.9}.ai2-stat span{display:block;margin-top:2cqw;font-size:3.2cqw}.ai2-split{display:grid;grid-template-columns:1fr auto 1fr;align-items:center;gap:2cqw;margin-top:5cqw}.ai2-split .ai2-card{padding:4cqw 2cqw;border-radius:4cqw;text-align:center;min-width:0}.ai2-split small{display:block;color:var(--ac);font-weight:900}.ai2-split strong{display:block;margin-top:2cqw;font-size:4cqw;overflow-wrap:anywhere}.ai2-vs{font-weight:950;color:var(--ac)}`
    + `.ai2-list,.ai2-steps{display:flex;flex-direction:column;gap:1.7cqw;margin-top:4cqw}.ai2-item{display:flex;align-items:center;gap:2.4cqw;padding:2.2cqw 2.8cqw;border-radius:2.6cqw;font-size:3cqw}.ai2-item b{color:var(--ac);font-size:3.5cqw}.ai2-chat{display:flex;flex-direction:column;gap:2.2cqw;margin-top:4cqw}.ai2-bubble{max-width:78%;padding:2.7cqw 3.2cqw;border-radius:3.6cqw;background:rgba(255,255,255,.1);font-size:3.1cqw}.ai2-bubble.ai2-out{align-self:flex-end;background:var(--ac);color:#fff}.ai2-device{margin-top:4cqw;padding:1.2cqw;border-radius:5cqw}.ai2-dots{height:4.7cqh;display:flex;align-items:center;gap:1cqw;padding:0 2cqw}.ai2-dots i{width:1.2cqw;height:1.2cqw;border-radius:50%;background:rgba(255,255,255,.32)}.ai2-media{position:relative;height:31cqh;border-radius:4cqw;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;background:radial-gradient(circle at 50% 42%,color-mix(in srgb,var(--ac) 54%,#27324d),#111827 64%)}.ai2-media:not(.has-image):before{content:"✦";position:absolute;font-size:28cqw;color:color-mix(in srgb,var(--ac) 20%,transparent);transform:rotate(12deg)}.ai2-media.has-image{background:linear-gradient(rgba(5,8,15,.22),rgba(5,8,15,.5)),url(var(--img)) center/cover}.ai2-media strong,.ai2-media span{position:relative}.ai2-media strong{font-size:5cqw}.ai2-media span{margin-top:1cqw;color:rgba(255,255,255,.76)}`
    + `.ai2-quote{padding:5cqw;border-left:1.2cqw solid var(--ac);background:linear-gradient(90deg,color-mix(in srgb,var(--ac) 15%,transparent),transparent);border-radius:0 4cqw 4cqw 0}.ai2-quote i{position:absolute;right:3cqw;top:-5cqw;font-size:25cqw;color:color-mix(in srgb,var(--ac) 28%,transparent);font-family:serif}.ai2-quote strong,.ai2-quote span{display:block;margin-top:2cqw;color:var(--dim)}.ai2-features{display:grid;grid-template-columns:1fr 1fr;gap:1.7cqw;margin-top:4cqw}.ai2-features .ai2-item{min-height:8cqh}.ai2-count{position:absolute;right:0;top:-12cqh;opacity:.18}.ai2-count strong{font-size:39cqw;line-height:1;color:var(--ac)}.ai2-hero{text-align:center}.ai2-hero .ai2-copy{margin-inline:auto}.ai2-hero .ai2-pills{justify-content:center}`
    + `@keyframes ai2Drift{0%,100%{transform:rotate(-7deg) scale(1.05)}50%{transform:rotate(9deg) scale(1.18)}}`
    + def.scenes.map((scene, index) => beatKeyframes(index, count, scene.entrance, def.transition)).join("")
    + def.scenes.map((_, index) => `.ai2-b${index + 1}{animation-name:ai2Beat${index + 1}}`).join("")
    + `@container (min-aspect-ratio:1/1){.ai2-beat{padding:5cqw}.ai2-wrap{width:76cqw}.ai2-title{font-size:6cqw}.ai2-copy{font-size:2.35cqw}.ai2-media{height:42cqh}.ai2-count strong{font-size:29cqw}}`;
  const beats = def.scenes.map((scene, index) => `<section class="ai2-beat ai2-b${index + 1}"><div class="ai2-wrap">${storyLayout(scene, index, !!image)}</div></section>`).join("");
  const body = `<div class="ai2 ${def.background}"><div class="ai2-bg"></div>${beats}</div>`;
  return {
    name: def.name,
    accent: def.accent,
    dark: theme.dark,
    css,
    body,
    img: cleanImage(image),
    schema: storySchema(def.scenes),
    definition: def
  };
}

function compileDefinition(definition, image) {
  if (definition && (Number(definition.version) === STORY_VERSION || Array.isArray(definition.scenes))) {
    return compileStoryDefinition(definition, image);
  }
  return compileLegacyDefinition(definition, image);
}

function cleanEditableSchema(schema) {
  if (!schema || typeof schema !== "object" || !Array.isArray(schema.fields)) return null;
  const fields = schema.fields.slice(0, 40).map((field) => {
    const key = String(field && field.key || "");
    if (!/^[A-Za-z][A-Za-z0-9_-]{0,39}$/.test(key)) throw new BadScene("editable field has an invalid key");
    return {
      key,
      label: cleanPlainText(field.label || key, 60),
      type: field.type === "textarea" ? "textarea" : "text",
      default: cleanPlainText(field.default, Number(field.maxLength) || 140),
      maxLength: Math.max(1, Math.min(Number(field.maxLength) || 140, 600))
    };
  });
  const defaults = {};
  fields.forEach((field) => { defaults[field.key] = field.default; });
  return { version: Number(schema.version) === STORY_VERSION ? STORY_VERSION : 1, fields, defaults };
}

/* Full check of a scene spec, used by /api/animate AND /api/export. */
function sanitise(spec) {
  if (!spec || typeof spec !== "object") throw new BadScene("no scene");
  const compiled = spec.definition ? compileDefinition(spec.definition, spec.img) : spec;
  const name = String(compiled.name || "Custom animation").replace(/[<>&"]/g, "").slice(0, 60);
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(compiled.accent || "")) ? compiled.accent : "#ffffff";
  return {
    name,
    accent,
    dark: compiled.dark !== false,
    css: cleanCss(compiled.css),
    body: cleanBody(compiled.body),
    img: cleanImage(compiled.img),
    schema: cleanEditableSchema(compiled.schema),
    definition: compiled.definition || null
  };
}

/* ── the prompt ───────────────────────────────────────────
   The model is a smart arranger, not an unrestricted web designer. It returns
   content plus choices from the approved vocabulary above; ShortsCraft owns
   every rendered pixel and keyframe in compileDefinition(). */
function scenePrompt({ prompt, dur, hasImage }) {
  return `Plan a premium, editable ShortsCraft STORYBOARD with 2 to 4 sequential motion scenes.

USER BRIEF: ${prompt}
LOOP DURATION: ${dur}ms
ATTACHED IMAGE: ${hasImage ? "yes" : "no"}

RETURN EXACTLY THIS JSON SHAPE:
{"version":2,"name":"Short story name","theme":"midnight","accent":"#5b8cff","background":"mesh-grid","transition":"zoom-through","scenes":[{"layout":"kinetic-hero","eyebrow":"STOP SCROLLING","title":"A strong opening hook","body":"One clear sentence that creates curiosity.","primary":"Watch this","secondary":"In 15 seconds","items":[],"entrance":"blur-rise"},{"layout":"feature-grid","eyebrow":"THE PAYOFF","title":"Three useful benefits","body":"Make every beat advance the story.","primary":"Fast","secondary":"Editable","items":["Benefit one","Benefit two","Benefit three"],"entrance":"slide-left"},{"layout":"product-focus","eyebrow":"NEXT STEP","title":"End with one action","body":"A clean CTA, not an empty slogan.","primary":"Create now","secondary":"ShortsCraft","items":[],"entrance":"spring"}]}

RULES:
1. Return 2-4 scenes. Every scene must add new information: hook, proof/value, then payoff/CTA.
2. layout MUST be one of: kinetic-hero, stat-reveal, split-compare, ranked-stack, chat-story, product-focus, quote-poster, steps-flow, feature-grid, countdown.
3. background MUST be one of: mesh-grid, spotlight, aurora, paper, gradient, minimal.
4. transition MUST be one of: crossfade, zoom-through, slide-flow, wipe-up.
5. entrance MUST be one of: blur-rise, spring, slide-left, wipe-up, zoom, type, flip.
6. theme MUST be one of: dark-futuristic, midnight, emerald, warm-editorial, light.
7. Keep each title under 64 characters, body under 120, and items under 44. Use 2-4 items only when the layout benefits from them.
8. Match visual hierarchy, pacing and copy to the user's actual brief. Avoid generic filler such as "unlock your potential".
9. Use product-focus when an attached image is central. Do not invent URLs.
10. Output raw JSON only. Never output HTML, CSS, React, JavaScript, URLs or markdown.
`;
}

/* ── model call ───────────────────────────────────────────── */
async function generateScene({ prompt, dur, image, model, callModel }) {
  const hasImage = !!image;
  const text = await callModel({
    system: "You are the ShortsCraft scene planner. Choose only from the approved layout, theme and motion vocabulary. Reply with strict JSON only; never write code.",
    user: scenePrompt({ prompt, dur, hasImage }),
    model,
    image: image || null,
    maxTokens: 2200,
    temperature: 0.2
  });

  let raw = String(text || "").trim();
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start < 0 || end <= start) throw new BadScene("the model did not return a scene definition");

  let parsed;
  try {
    parsed = JSON.parse(raw.slice(start, end + 1));
  } catch (err) {
    throw new BadScene("the model returned invalid JSON");
  }

  // Code-shaped responses are a hard failure. Do not quietly accept a legacy
  // css/body payload and undo the constrained architecture through fallback.
  if (Object.prototype.hasOwnProperty.call(parsed, "css") || Object.prototype.hasOwnProperty.call(parsed, "body")) {
    throw new BadScene("the model attempted to return code instead of an approved scene definition");
  }

  const definition = normaliseStoryDefinition(parsed, { prompt, image });
  const compiled = compileStoryDefinition(definition, image || null);
  return sanitise(compiled);
}

function createFallbackScene(prompt, dur) {
  const pLower = String(prompt || "").toLowerCase();
  const isChart = pLower.includes("chart") || pLower.includes("graph") || pLower.includes("subscriber") || pLower.includes("count");
  const isMoney = pLower.includes("money") || pLower.includes("dollar") || pLower.includes("price") || pLower.includes("crypto") || pLower.includes("sale");
  const isTech = pLower.includes("ai") || pLower.includes("neon") || pLower.includes("cyber") || pLower.includes("heart") || pLower.includes("code");

  const accent = isMoney ? "#00E676" : (isTech ? "#00E5FF" : (isChart ? "#3B82F6" : "#FF5252"));
  const definition = normaliseStoryDefinition({
    version: STORY_VERSION,
    name: isChart ? "Metric Growth Pulse" : "Motion Visualizer",
    theme: isMoney ? "emerald" : "midnight",
    accent,
    background: isTech ? "aurora" : "mesh-grid",
    transition: "zoom-through",
    scenes: [
      { layout: "kinetic-hero", eyebrow: "SHORTSCRAFT AI", title: String(prompt || "Premium motion visual"), body: "A clear opening hook designed to earn the next second.", primary: "Watch this", secondary: "Built to move", items: [], entrance: "blur-rise" },
      { layout: isChart || isMoney ? "stat-reveal" : "feature-grid", eyebrow: "THE PAYOFF", title: isChart ? "Growth you can see" : "Every beat has a job", body: "Premium hierarchy, editable content and purposeful pacing.", primary: isChart ? "100K+" : (isMoney ? "+248%" : "Fast"), secondary: isChart ? "Audience growth" : (isMoney ? "Creator revenue" : "Flexible"), items: ["Strong hierarchy", "Smooth motion", "Easy editing"], entrance: "slide-left" },
      { layout: "product-focus", eyebrow: "MAKE IT YOURS", title: "Ready for your next short", body: "Customize the story, colors and message inside the editor.", primary: "Create now", secondary: "Edit every detail", items: [], entrance: "spring" }
    ]
  }, { prompt });
  return sanitise(compileStoryDefinition(definition, null));
}

module.exports = {
  sanitise, generateScene, scenePrompt, createFallbackScene,
  normaliseDefinition, normaliseStoryDefinition, compileDefinition, compileStoryDefinition, BadScene,
  VOCABULARY: {
    version: STORY_VERSION,
    layouts: Array.from(STORY_LAYOUTS),
    legacyLayouts: Array.from(LAYOUTS),
    themes: Object.keys(THEMES),
    backgrounds: Array.from(STORY_BACKGROUNDS),
    transitions: Array.from(STORY_TRANSITIONS),
    entrances: Array.from(STORY_ENTRANCES),
    legacyEntrances: Array.from(ENTRANCES),
    intensities: Array.from(INTENSITIES),
    contentKeys: CONTENT_KEYS.slice()
  },
  LIMITS: { MAX_CSS, MAX_BODY, MAX_IMG_BYTES }
};
