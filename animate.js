/* ============================================================
   animate.js — turn a user prompt into a real animation.

   How it works: the model does NOT write a web page. It returns JSON with only
   `css` and `body`, authored against the same design system our built-in
   templates use (container units, --ac/--fg/--dim/--hair/--surf, --D, --sp).
   The document itself is assembled by SC_TPL2.buildCustom, so an AI scene is
   structurally identical to a shipped template — same canvas, same safe box,
   same watermark, and the existing frame-stepped export works unchanged.

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

/* Full check of a scene spec, used by /api/animate AND /api/export. */
function sanitise(spec) {
  if (!spec || typeof spec !== "object") throw new BadScene("no scene");
  const name = String(spec.name || "Custom animation").replace(/[<>&"]/g, "").slice(0, 60);
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(spec.accent || "")) ? spec.accent : "#ffffff";
  return {
    name,
    accent,
    dark: spec.dark !== false,
    css: cleanCss(spec.css),
    body: cleanBody(spec.body),
    img: cleanImage(spec.img)
  };
}

/* ── the prompt ───────────────────────────────────────────
   Everything the model needs to produce something that looks like our
   templates: the variables, the units, the easing, and the house rules that
   made the v2 set work (animate an object, one accent, spring easing). */
function scenePrompt({ prompt, dur, hasImage }) {
  return `Design ONE looping motion-graphics scene for a vertical short video (9:16 aspect ratio).

USER BRIEF: ${prompt}

EXAMPLE SHAPE & STRUCTURE:
{"name":"Motion Scene","dark":true,"accent":"#00e5ff","css":".sc-wrap{position:absolute;inset:0;display:flex;align-items:center;justify-content:center}.sc-card{width:82cqw;padding:6cqw;background:var(--surf);border:1px solid var(--hair);border-radius:4cqw;text-align:center}.sc-elem{width:100%;height:30cqh;margin-top:2cqh;animation:scAnim var(--D) var(--sp) infinite}@keyframes scAnim{0%,100%{transform:scale(1)}50%{transform:scale(1.06)}}","body":"<div class='sc-wrap'><div class='sc-card'><h2>100K</h2><p>Subscribers</p><svg class='sc-elem' viewBox='0 0 100 50'><polyline points='0,45 25,35 50,30 75,15 100,5' fill='none' stroke='var(--ac)' stroke-width='4'/></svg></div></div>"}

RULES:
1. Animate an OBJECT or UI card (e.g., metric card, subscriber milestone counter, line graph with 4-6 points, pulse ring, or dynamic bar).
2. Monochrome base (#08080a) with EXACTLY ONE accent colour, used via var(--ac).
3. Spring easing: animation: animName var(--D) var(--sp) infinite. var(--D) is loop duration (${dur}ms).
4. Size everything with container units: cqw and cqh (9:16 viewport).
5. Output raw JSON ONLY with double quotes (") around all keys and values. No markdown fences.
6. ${hasImage
    ? "The user attached an image. Use it as the subject: reference it as " +
      "background-image:url(var(--img)) with background-size:cover, and animate " +
      "it (a slow parallax drift, a masked reveal, or a scale-in). url(var(--img)) " +
      "is the ONLY url() you may write."
    : "Do not reference any image. No url(), no <img>, no background-image."}`;
}

/* ── model call ───────────────────────────────────────────── */
async function generateScene({ prompt, dur, image, model, callModel }) {
  const hasImage = !!image;
  const text = await callModel({
    system: "You are a senior motion designer who writes flawless, concise CSS animations and replies with strict JSON only.",
    user: scenePrompt({ prompt, dur, hasImage }),
    model,
    maxTokens: 3500,
    temperature: 0.4
  });

  let raw = String(text || "").trim();
  let start = raw.indexOf('{"name"');
  if (start < 0) start = raw.indexOf('{ "name"');
  if (start < 0) start = raw.indexOf('{"');
  if (start < 0) start = raw.indexOf("{");
  let end = raw.lastIndexOf("}");
  if (start < 0) throw new BadScene("the model did not return JSON");
  if (end <= start) {
    // If cut off, append closing
    raw += '"}';
    end = raw.lastIndexOf("}");
  }

  let spec;
  let jsonSlice = raw.slice(start, end + 1);

  // Normalize unquoted keys like body: -> "body":
  jsonSlice = jsonSlice.replace(/([,{]\s*)(name|dark|accent|css|body)\s*:/g, '$1"$2":');

  // Normalize JS template backticks to valid JSON double-quoted strings
  jsonSlice = jsonSlice.replace(/:\s*`([\s\S]*?)`/g, function (m, content) {
    const escaped = content.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t");
    return ': "' + escaped + '"';
  });

  try {
    spec = JSON.parse(jsonSlice);
  } catch (e) {
    try {
      // LLMs often put raw unescaped newlines in JSON strings: replace unescaped newlines in string properties
      const cleaned = jsonSlice.replace(/"(css|body|name|accent)":\s*"([\s\S]*?)"(?=\s*,\s*"|\s*})/g, function (m, k, v) {
        var fix = v.replace(/\r?\n/g, "\\n").replace(/\t/g, "\\t");
        return '"' + k + '":"' + fix + '"';
      });
      spec = JSON.parse(cleaned);
    } catch (e2) {
      try {
        const nameMatch = raw.match(/"name"\s*:\s*["`]([^"`]+)["`]/);
        const darkMatch = raw.match(/"dark"\s*:\s*(true|false)/);
        const accentMatch = raw.match(/"accent"\s*:\s*["`]([^"`]+)["`]/);
        const cssMatch = raw.match(/"css"\s*:\s*["`]([\s\S]*?)["`](?=\s*,\s*"body"|\s*,\s*"dark"|\s*,\s*"accent"|\s*})/);
        const bodyMatch = raw.match(/"body"\s*:\s*["`]([\s\S]*?)["`](?=\s*})/);
        if (cssMatch && (bodyMatch || cssMatch[1])) {
          spec = {
            name: nameMatch ? nameMatch[1] : "Custom animation",
            dark: darkMatch ? darkMatch[1] === "true" : true,
            accent: accentMatch ? accentMatch[1] : "#ffffff",
            css: (cssMatch ? cssMatch[1] : "").replace(/\\n/g, "\n").replace(/\\"/g, '"'),
            body: (bodyMatch ? bodyMatch[1] : "").replace(/\\n/g, "\n").replace(/\\"/g, '"')
          };
        } else {
          throw e2;
        }
      } catch (e3) {
        console.error("[generateScene] JSON parse error:", e.message, "\nRaw snippet:", jsonSlice.slice(0, 300));
        throw new BadScene("the model returned invalid JSON");
      }
    }
  }

  spec.img = image || null;

  /* Quality gate.

     A near-miss is repaired: if the model wrote a real animation but hardcoded
     its duration ("3s") instead of using var(--D), rewrite it so the scene
     honours the clip length. That produces exactly what the user asked for.

     Anything worse is refused, not patched. Bolting a generic pulse onto a
     static card would hand back a scene the user did not ask for while still
     charging them 5 credits; throwing BadScene makes /api/animate refund the
     credit and tell them to reword. */
  if (spec.css && /@keyframes/i.test(spec.css) && !/var\(--D\)/.test(spec.css)) {
    spec.css = spec.css.replace(/\b\d+(?:\.\d+)?s\b/gi, "var(--D)");
    spec.css = spec.css.replace(/\b\d+ms\b/gi, "var(--D)");
  }

  if (!spec.css || !/@keyframes/i.test(spec.css)) {
    throw new BadScene("the model returned no animation — the scene has no @keyframes");
  }

  // Hostile output is refused outright rather than quietly swapped for a
  // fallback — a silent swap hides that the model produced something unsafe.
  return sanitise(spec);
}

function createFallbackScene(prompt, dur) {
  const pLower = String(prompt || "").toLowerCase();
  const isChart = pLower.includes("chart") || pLower.includes("graph") || pLower.includes("subscriber") || pLower.includes("count");
  const isMoney = pLower.includes("money") || pLower.includes("dollar") || pLower.includes("price") || pLower.includes("crypto") || pLower.includes("sale");
  const isTech = pLower.includes("ai") || pLower.includes("neon") || pLower.includes("cyber") || pLower.includes("heart") || pLower.includes("code");
  
  const accent = isMoney ? "#00E676" : (isTech ? "#00E5FF" : (isChart ? "#3B82F6" : "#FF5252"));
  const title = prompt.length > 30 ? prompt.slice(0, 27) + "…" : prompt;

  if (isChart) {
    return {
      name: "Metric Growth Pulse",
      dark: true,
      accent,
      css: `.sc-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6cqw}.sc-card{width:86cqw;padding:7cqw 6cqw;background:var(--surf);border:1px solid var(--hair);border-radius:5cqw;text-align:center;box-shadow:0 12px 40px rgba(0,0,0,.6)}.sc-val{font-size:10cqw;font-weight:900;color:var(--fg);letter-spacing:-.03em;margin:0 0 1cqh;animation:scCount var(--D) var(--sp) infinite}.sc-label{font-size:3.6cqw;color:var(--dim);text-transform:uppercase;letter-spacing:.14em;margin:0 0 3cqh}.sc-chart{width:100%;height:22cqh;overflow:visible}.sc-line{fill:none;stroke:var(--ac);stroke-width:5;stroke-linecap:round;stroke-linejoin:round;filter:drop-shadow(0 0 12px var(--ac));animation:scLineAnim var(--D) var(--sp) infinite}.sc-grid{stroke:var(--hair);stroke-dasharray:3 3;stroke-width:1}@keyframes scCount{0%,100%{transform:scale(1)}50%{transform:scale(1.08)}}@keyframes scLineAnim{0%,100%{stroke-dashoffset:0}50%{stroke-dashoffset:15}}`,
      body: `<div class="sc-wrap"><div class="sc-card"><h1 class="sc-val">100,000+</h1><p class="sc-label">${title}</p><svg class="sc-chart" viewBox="0 0 100 50"><line x1="0" y1="45" x2="100" y2="45" class="sc-grid"/><line x1="0" y1="25" x2="100" y2="25" class="sc-grid"/><polyline points="5,42 25,32 50,28 75,14 95,6" class="sc-line"/></svg></div></div>`,
      img: null
    };
  }

  return {
    name: "Motion Visualizer",
    dark: true,
    accent,
    css: `.sc-wrap{position:absolute;inset:0;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:6cqw}.sc-orb{width:36cqw;height:36cqw;border-radius:50%;background:radial-gradient(circle,var(--ac) 0%,transparent 70%);border:2px solid var(--ac);box-shadow:0 0 40px var(--ac);animation:scOrb var(--D) var(--sp) infinite;display:grid;place-items:center;margin-bottom:4cqh}.sc-title{font-size:6.8cqw;font-weight:800;letter-spacing:-.02em;color:var(--fg);text-align:center;max-width:90%}.sc-sub{font-size:3.5cqw;color:var(--dim);margin-top:1.5cqh;letter-spacing:.08em}@keyframes scOrb{0%,100%{transform:scale(1) rotate(0deg);box-shadow:0 0 30px var(--ac)}50%{transform:scale(1.15) rotate(180deg);box-shadow:0 0 60px var(--ac)}}`,
    body: `<div class="sc-wrap"><div class="sc-orb"><span style="font-size:12cqw">✦</span></div><h2 class="sc-title">${title}</h2><p class="sc-sub">ShortsCraft AI Studio</p></div>`,
    img: null
  };
}

module.exports = {
  sanitise, generateScene, scenePrompt, createFallbackScene, BadScene,
  LIMITS: { MAX_CSS, MAX_BODY, MAX_IMG_BYTES }
};
