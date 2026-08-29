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

function cleanPlainText(value, max) {
  return String(value == null ? "" : value)
    .replace(/[<>{}]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
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

function compileDefinition(definition, image) {
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

function cleanEditableSchema(schema) {
  if (!schema || typeof schema !== "object" || !Array.isArray(schema.fields)) return null;
  const fields = schema.fields.slice(0, 12).map((field) => {
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
  return { version: 1, fields, defaults };
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
  return `Arrange ONE premium, editable ShortsCraft motion scene.

USER BRIEF: ${prompt}
LOOP DURATION: ${dur}ms
ATTACHED IMAGE: ${hasImage ? "yes" : "no"}

RETURN EXACTLY THIS JSON SHAPE:
{"name":"Short scene name","theme":"dark-futuristic","layout":"comparison","accent":"#7c5cff","content":{"kicker":"AI COMPARISON","title":"Claude vs ChatGPT","subtitle":"Which one is best for creators?","primary":"Claude","secondary":"ChatGPT","footer":"Pick your winner"},"motion":{"entrance":"blur-reveal","stagger":true,"intensity":"balanced"}}

RULES:
1. layout MUST be one of: centered-hero, metric-card, comparison, ranked-list, chat, product-showcase.
2. theme MUST be one of: dark-futuristic, midnight, emerald, warm-editorial, light.
3. motion.entrance MUST be one of: fade-up, blur-reveal, scale-in, spring-pop.
4. motion.intensity MUST be subtle, balanced or bold.
5. Keep title under 72 characters and subtitle under 140. Write clear creator-facing copy.
6. Use product-showcase when an attached image is central; otherwise choose the layout that best serves the brief.
7. Output raw JSON only. Never output HTML, CSS, React, JavaScript, URLs or markdown.`;
}

/* ── model call ───────────────────────────────────────────── */
async function generateScene({ prompt, dur, image, model, callModel }) {
  const hasImage = !!image;
  const text = await callModel({
    system: "You are the ShortsCraft scene planner. Choose only from the approved layout, theme and motion vocabulary. Reply with strict JSON only; never write code.",
    user: scenePrompt({ prompt, dur, hasImage }),
    model,
    maxTokens: 1200,
    temperature: 0.25
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

  const definition = normaliseDefinition(parsed, { prompt, image });
  const compiled = compileDefinition(definition, image || null);
  return sanitise(compiled);
}

function createFallbackScene(prompt, dur) {
  const pLower = String(prompt || "").toLowerCase();
  const isChart = pLower.includes("chart") || pLower.includes("graph") || pLower.includes("subscriber") || pLower.includes("count");
  const isMoney = pLower.includes("money") || pLower.includes("dollar") || pLower.includes("price") || pLower.includes("crypto") || pLower.includes("sale");
  const isTech = pLower.includes("ai") || pLower.includes("neon") || pLower.includes("cyber") || pLower.includes("heart") || pLower.includes("code");

  const accent = isMoney ? "#00E676" : (isTech ? "#00E5FF" : (isChart ? "#3B82F6" : "#FF5252"));
  const definition = normaliseDefinition({
    name: isChart ? "Metric Growth Pulse" : "Motion Visualizer",
    theme: isMoney ? "emerald" : "midnight",
    layout: (isChart || isMoney) ? "metric-card" : "centered-hero",
    accent,
    content: {
      kicker: "ShortsCraft AI",
      title: String(prompt || "Premium motion visual"),
      subtitle: "A safe fallback built from approved motion primitives.",
      primary: isChart ? "100K+" : (isMoney ? "+248%" : "✦"),
      secondary: isChart ? "Audience growth" : (isMoney ? "Creator revenue" : "Ready to animate"),
      footer: `${Math.max(500, Math.min(Number(dur) || 4000, 30000))}ms loop`
    },
    motion: { entrance: "spring-pop", stagger: true, intensity: "balanced" }
  }, { prompt });
  return sanitise(compileDefinition(definition, null));
}

module.exports = {
  sanitise, generateScene, scenePrompt, createFallbackScene,
  normaliseDefinition, compileDefinition, BadScene,
  VOCABULARY: {
    version: DEFINITION_VERSION,
    layouts: Array.from(LAYOUTS),
    themes: Object.keys(THEMES),
    entrances: Array.from(ENTRANCES),
    intensities: Array.from(INTENSITIES),
    contentKeys: CONTENT_KEYS.slice()
  },
  LIMITS: { MAX_CSS, MAX_BODY, MAX_IMG_BYTES }
};
