/* ============================================================
   lottie-inspect.js — the one reader for uploaded Lottie animations.

   Lottie (.json, or a .zip / .lottie / folder that carries one) is the upload
   format for creator templates, the way MP4 is YouTube's. It is chosen because
   it is data rather than a project file: it can be previewed in a browser,
   its text and colours can be edited, and every frame can be rendered for an
   MP4 export.

   This file runs in two places and must give the same answer in both:
     - in the browser, so an upload is recognised the moment a file is picked;
     - on the server, which never trusts what the browser concluded and runs
       the same checks again on the document it is asked to store.

   Three rules follow from "data, not code":
     1. Expressions are removed. They are JavaScript inside the animation and
        the site never runs code a stranger uploaded.
     2. Nothing is fetched from elsewhere. Images must be inside the upload;
        remote font and image URLs are stripped.
     3. Editing addresses text and colours by their order in the document,
        which is fixed once uploaded, so a saved edit always lands on the same
        layer it was made against.
   ============================================================ */
(function (root, factory) {
  if (typeof module === "object" && module.exports) module.exports = factory();
  else root.SC_LOTTIE = factory();
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  var LIMITS = {
    maxBytes: 8 * 1024 * 1024,      // whole document, images included
    maxSide: 4096,
    minSide: 16,
    maxFps: 120,
    // A Studio clip is at most 9 seconds, so an upload is too; a longer one
    // would be cut short in the editor and the export without saying so.
    // The half second is slack for exporters that round the last frame up.
    maxDurationMs: 9500,
    clipMaxMs: 9000,
    maxLayers: 2000,
    maxDepth: 64,
    maxTexts: 12,
    maxColors: 8,
    maxImageBytes: 2 * 1024 * 1024,
    maxImagesBytes: 6 * 1024 * 1024
  };

  var ASPECTS = [["9:16", 9 / 16], ["16:9", 16 / 9], ["1:1", 1], ["4:5", 4 / 5]];
  var IMAGE_MIME = { png: "image/png", jpg: "image/jpeg", jpeg: "image/jpeg", webp: "image/webp", gif: "image/gif" };
  var DATA_IMAGE = /^data:image\/(png|jpeg|jpg|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/i;
  // A transparent 1×1 PNG stands in for an image that was not in the upload,
  // so the layer keeps its place and timing instead of breaking the render.
  var BLANK_PNG = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=";

  function clone(v) { return JSON.parse(JSON.stringify(v)); }
  function isObj(v) { return v !== null && typeof v === "object" && !Array.isArray(v); }
  function num(v) { return typeof v === "number" && isFinite(v); }

  /* ── Colours ───────────────────────────────────────────── */
  function clamp01(n) { return Math.max(0, Math.min(1, n)); }
  function scaleOf(arr) {
    // Old exporters wrote 0–255; current ones write 0–1.
    return (arr[0] > 1 || arr[1] > 1 || arr[2] > 1) ? 255 : 1;
  }
  function arrToHex(arr) {
    var s = scaleOf(arr);
    return "#" + [0, 1, 2].map(function (i) {
      var h = Math.round(clamp01(arr[i] / s) * 255).toString(16);
      return h.length === 1 ? "0" + h : h;
    }).join("");
  }
  function hexToArr(hex, like) {
    var s = like ? scaleOf(like) : 1;
    var out = [1, 3, 5].map(function (i) { return (parseInt(hex.substr(i, 2), 16) / 255) * s; });
    if (like && like.length > 3) out.push(like[3]);
    return out;
  }
  function validHex(v) { return typeof v === "string" && /^#[0-9a-f]{6}$/i.test(v); }

  /* Every static colour in the document, visited in a fixed order. `set` is
     given so the same walk can both read the palette and rewrite it. */
  function eachColor(doc, visit) {
    walkLayers(doc, function (layer) {
      if (layer.ty === 1 && validHex(layer.sc)) {
        visit(layer.sc.toLowerCase(), function (hex) { layer.sc = hex; });
      }
      if (layer.ty === 5 && layer.t && layer.t.d && Array.isArray(layer.t.d.k)) {
        layer.t.d.k.forEach(function (kf) {
          var s = kf && kf.s;
          if (s && Array.isArray(s.fc) && s.fc.length >= 3 && s.fc.every(num)) {
            visit(arrToHex(s.fc), function (hex) { s.fc = hexToArr(hex, s.fc); });
          }
        });
      }
      if (layer.ty === 4 && Array.isArray(layer.shapes)) walkShapes(layer.shapes, visit);
    });
  }
  function walkShapes(items, visit, depth) {
    depth = depth || 0;
    if (depth > LIMITS.maxDepth) return;
    items.forEach(function (it) {
      if (!isObj(it)) return;
      if (it.ty === "gr" && Array.isArray(it.it)) walkShapes(it.it, visit, depth + 1);
      if ((it.ty === "fl" || it.ty === "st") && isObj(it.c) && it.c.a !== 1 &&
          Array.isArray(it.c.k) && it.c.k.length >= 3 && it.c.k.slice(0, 3).every(num)) {
        visit(arrToHex(it.c.k), function (hex) { it.c.k = hexToArr(hex, it.c.k); });
      }
    });
  }

  /* ── Layer walking ─────────────────────────────────────── */
  /* Root layers first, then each precomposition in asset order. Precomps are
     visited once each even when several layers reference them, so an edit to
     a text inside a reused precomp is one edit, not one per instance. */
  function walkLayers(doc, visit) {
    var lists = [doc.layers || []];
    (doc.assets || []).forEach(function (a) { if (isObj(a) && Array.isArray(a.layers)) lists.push(a.layers); });
    lists.forEach(function (list) {
      list.forEach(function (layer) { if (isObj(layer)) visit(layer); });
    });
  }

  /* A text layer names its font, and the renderer looks the name up in
     fonts.list. A file that leaves the list out (hand-made and converted
     Lottie often do) stops the renderer at the first text layer, so nothing
     at all is drawn. Each name that is used but not listed gets an entry
     that falls back to a standard sans-serif. Returns how many were added. */
  function repairFonts(doc) {
    var used = {};
    walkLayers(doc, function (layer) {
      if (layer.ty !== 5 || !layer.t || !layer.t.d || !Array.isArray(layer.t.d.k)) return;
      layer.t.d.k.forEach(function (kf) {
        var f = kf && kf.s && kf.s.f;
        if (typeof f === "string" && f) used[f] = true;
      });
    });
    var names = Object.keys(used);
    if (!names.length) return 0;
    if (!isObj(doc.fonts)) doc.fonts = {};
    if (!Array.isArray(doc.fonts.list)) doc.fonts.list = [];
    var listed = {};
    doc.fonts.list.forEach(function (f) { if (isObj(f) && typeof f.fName === "string") listed[f.fName] = true; });
    var added = 0;
    names.forEach(function (name) {
      if (listed[name]) return;
      // "PlusJakartaSans-ExtraBold" -> family "Plus Jakarta Sans", style "Extra Bold"
      var dash = name.indexOf("-");
      var family = (dash > 0 ? name.slice(0, dash) : name).replace(/([a-z])([A-Z])/g, "$1 $2").trim();
      var style = (dash > 0 ? name.slice(dash + 1) : "Regular").replace(/([a-z])([A-Z])/g, "$1 $2").trim();
      doc.fonts.list.push({
        fName: name,
        fFamily: (family || "Arial") + ", Arial, Helvetica, sans-serif",
        fStyle: style || "Regular",
        ascent: 75,
        origin: 0
      });
      added++;
    });
    return added;
  }

  function textsOf(doc) {
    var out = [];
    if (Array.isArray(doc.chars) && doc.chars.length) return out; // glyph fonts: see inspect()
    walkLayers(doc, function (layer) {
      if (layer.ty !== 5 || !layer.t || !layer.t.d || !Array.isArray(layer.t.d.k) || !layer.t.d.k.length) return;
      // Text that changes over time (a number counting up) is animation, not
      // a caption: one typed value would flatten every keyframe into it.
      if (layer.t.d.k.length > 1) return;
      var first = layer.t.d.k[0] && layer.t.d.k[0].s;
      if (!first || typeof first.t !== "string") return;
      out.push({ layer: layer, value: first.t.replace(/\r/g, "\n") });
    });
    return out;
  }

  function paletteOf(doc) {
    var counts = {}, order = [];
    eachColor(doc, function (hex) {
      if (!counts[hex]) { counts[hex] = 0; order.push(hex); }
      counts[hex]++;
    });
    return order
      .map(function (hex, i) { return { hex: hex, n: counts[hex], i: i }; })
      .sort(function (a, b) { return b.n - a.n || a.i - b.i; })
      .slice(0, LIMITS.maxColors)
      .map(function (x) { return x.hex; });
  }

  /* ── Cleaning ──────────────────────────────────────────── */
  function stripExpressions(node, depth, stats) {
    if (depth > LIMITS.maxDepth) { stats.tooDeep = true; return; }
    if (Array.isArray(node)) { node.forEach(function (v) { stripExpressions(v, depth + 1, stats); }); return; }
    if (!isObj(node)) return;
    if (typeof node.x === "string") { delete node.x; stats.expressions++; }
    Object.keys(node).forEach(function (k) { stripExpressions(node[k], depth + 1, stats); });
  }

  function aspectFor(w, h) {
    var r = w / h, best = ASPECTS[0], bestD = Infinity;
    ASPECTS.forEach(function (a) {
      var d = Math.abs(Math.log(r / a[1]));
      if (d < bestD) { bestD = d; best = a; }
    });
    return best[0];
  }

  function countLayers(doc) {
    var n = 0;
    walkLayers(doc, function () { n++; });
    return n;
  }

  /* inspect(doc) → { ok, errors, warnings, meta, clean }
     `clean` is the document to store and render. `meta` is what the upload
     screen shows and what the Studio turns into editable fields. */
  function inspect(input, opts) {
    opts = opts || {};
    var errors = [], warnings = [];
    var doc = input;
    if (typeof input === "string") {
      if (input.length > LIMITS.maxBytes) return fail("The animation is larger than 8 MB.");
      try { doc = JSON.parse(input); } catch (e) { return fail("This file is not valid JSON, so it cannot be a Lottie animation."); }
    }
    if (!isObj(doc)) return fail("This file is not a Lottie animation.");
    if (!Array.isArray(doc.layers) || !doc.layers.length || !num(doc.fr) || !num(doc.ip) || !num(doc.op)) {
      return fail("This JSON is not a Lottie animation — it has no layers or no timing. Export it from After Effects with the LottieFiles or Bodymovin plugin.");
    }
    if (!num(doc.w) || !num(doc.h) || doc.w < LIMITS.minSide || doc.h < LIMITS.minSide) return fail("The animation has no usable width and height.");
    if (doc.w > LIMITS.maxSide || doc.h > LIMITS.maxSide) return fail("The animation is larger than 4096 pixels on a side.");
    if (doc.fr <= 0 || doc.fr > LIMITS.maxFps) return fail("The frame rate must be between 1 and 120 fps.");
    if (doc.op <= doc.ip) return fail("The animation has no duration.");
    var durationMs = Math.round(((doc.op - doc.ip) / doc.fr) * 1000);
    if (durationMs > LIMITS.maxDurationMs) return fail("The animation is " + (durationMs / 1000).toFixed(1) + " seconds long. Templates can be up to 9 seconds, the same as a Studio clip — trim it in After Effects and export again.");

    var clean = clone(doc);
    if (countLayers(clean) > LIMITS.maxLayers) return fail("The animation has more than 2000 layers.");

    var stats = { expressions: 0, tooDeep: false };
    stripExpressions(clean, 0, stats);
    if (stats.tooDeep) return fail("The animation is nested too deeply to read safely.");
    if (stats.expressions) {
      warnings.push(stats.expressions + " expression" + (stats.expressions === 1 ? " was" : "s were") +
        " removed. Expressions are code, and uploads are not allowed to run code — bake them into keyframes before exporting.");
    }

    // Images: keep what is inside the upload, stand in for what is not.
    var images = 0, missingImages = 0, imageBytes = 0;
    (clean.assets || []).forEach(function (a) {
      if (!isObj(a) || Array.isArray(a.layers) || typeof a.p !== "string") return;
      images++;
      if (DATA_IMAGE.test(a.p)) {
        imageBytes += a.p.length;
        a.u = ""; a.e = 1;
        return;
      }
      a.u = ""; a.p = BLANK_PNG; a.e = 1;
      missingImages++;
    });
    if (imageBytes > LIMITS.maxImagesBytes * 1.37) return fail("The images inside the animation add up to more than 6 MB.");
    if (missingImages) {
      warnings.push(missingImages + " image" + (missingImages === 1 ? " is" : "s are") +
        " not inside the upload and will be blank. Upload the folder or a ZIP that includes the images.");
    }

    // Fonts: never fetched from a URL.
    var fontList = clean.fonts && Array.isArray(clean.fonts.list) ? clean.fonts.list : [];
    var remoteFonts = 0;
    fontList.forEach(function (f) {
      if (!isObj(f)) return;
      if (f.fPath) { delete f.fPath; remoteFonts++; }
      f.origin = 0;
      // A family the viewer does not have falls back to the browser default,
      // which is a serif. A sans-serif fallback is far closer to what motion
      // designers use for on-screen text.
      if (typeof f.fFamily === "string" && !/(sans-serif|serif|monospace|cursive|fantasy|system-ui)\s*$/i.test(f.fFamily)) {
        f.fFamily = f.fFamily + ", Arial, Helvetica, sans-serif";
      }
    });
    if (remoteFonts) warnings.push("Text uses the closest installed font, because fonts linked from the internet are not loaded.");
    if (repairFonts(clean)) warnings.push("The file did not list its fonts, so its text uses a standard font.");

    var hasGlyphs = Array.isArray(clean.chars) && clean.chars.length > 0;
    if (hasGlyphs) warnings.push("Text was exported as glyph shapes, so it cannot be edited. Turn off \"Glyphs\" in the exporter to make text editable.");

    var threeD = 0, effects = 0, cameras = 0, audio = 0;
    walkLayers(clean, function (layer) {
      if (layer.ddd === 1) threeD++;
      if (Array.isArray(layer.ef) && layer.ef.length) effects++;
      if (layer.ty === 13) cameras++;
      if (layer.ty === 6) audio++;
    });
    if (threeD || cameras) warnings.push("3D layers and cameras are shown flat — Lottie in the browser has no 3D.");
    if (effects) warnings.push(effects + " layer" + (effects === 1 ? " uses" : "s use") + " After Effects effects. Some effects (blurs, glows, particle plugins) do not exist in Lottie and will not appear.");
    if (audio) warnings.push("Audio layers are ignored. Add music to the exported video instead.");

    var texts = textsOf(clean);
    if (texts.length > LIMITS.maxTexts) {
      warnings.push("Only the first " + LIMITS.maxTexts + " of " + texts.length + " text layers can be edited.");
    }
    var palette = paletteOf(clean);

    var meta = {
      name: String(doc.nm || "").slice(0, 80),
      width: doc.w,
      height: doc.h,
      aspect: aspectFor(doc.w, doc.h),
      fps: Math.round(doc.fr * 100) / 100,
      durationMs: durationMs,
      layers: countLayers(clean),
      images: images,
      hasGlyphs: hasGlyphs,
      texts: texts.slice(0, LIMITS.maxTexts).map(function (t, i) {
        return { key: "t" + (i + 1), label: String(t.layer.nm || ("Text " + (i + 1))).slice(0, 60), value: t.value.slice(0, 200) };
      }),
      colors: palette.map(function (hex, i) { return { key: "c" + (i + 1), label: "Colour " + (i + 1), value: hex }; })
    };

    var bytes = JSON.stringify(clean).length;
    if (bytes > LIMITS.maxBytes) return fail("The animation is larger than 8 MB once its images are included.");
    meta.bytes = bytes;

    return { ok: true, errors: errors, warnings: warnings, meta: meta, clean: clean };

    function fail(msg) { return { ok: false, errors: [msg], warnings: warnings, meta: null, clean: null }; }
  }

  /* applyEdits(cleanDoc, props) → a new document with the creator's text and
     colours. Unknown or empty values leave the original untouched. */
  function applyEdits(doc, props) {
    props = props || {};
    var out = clone(doc);
    // Documents stored before fonts were repaired on upload still render.
    repairFonts(out);
    textsOf(out).slice(0, LIMITS.maxTexts).forEach(function (t, i) {
      var v = props["t" + (i + 1)];
      if (typeof v !== "string" || !v.trim()) return;
      var text = v.slice(0, 200).replace(/\r?\n/g, "\r");
      t.layer.t.d.k.forEach(function (kf) { if (kf && kf.s) kf.s.t = text; });
    });
    var map = {}, any = false;
    paletteOf(out).forEach(function (hex, i) {
      var v = props["c" + (i + 1)];
      if (validHex(v) && v.toLowerCase() !== hex) { map[hex] = v.toLowerCase(); any = true; }
    });
    if (any) eachColor(out, function (hex, set) { if (map[hex]) set(map[hex]); });
    return out;
  }

  /* ── Packages: .zip, .lottie, or a picked folder ───────── */
  function base64(bytes) {
    if (typeof Buffer !== "undefined") return Buffer.from(bytes).toString("base64");
    var s = "", CHUNK = 0x8000;
    for (var i = 0; i < bytes.length; i += CHUNK) {
      s += String.fromCharCode.apply(null, bytes.subarray(i, i + CHUNK));
    }
    return btoa(s);
  }
  function norm(p) { return String(p || "").replace(/\\/g, "/").replace(/^\.?\//, "").replace(/\/{2,}/g, "/"); }
  function baseName(p) { var n = norm(p); return n.slice(n.lastIndexOf("/") + 1); }

  /* entries: [{ path, bytes: Uint8Array }]. Finds the animation, pulls the
     images it names out of the same package and inlines them, so what is
     stored is one self-contained document. */
  function packFromEntries(entries) {
    var files = (entries || []).filter(function (e) {
      var p = norm(e.path);
      return e && e.bytes && p && !/(^|\/)(__MACOSX|\.)/.test(p);
    });
    var decoder = typeof TextDecoder !== "undefined" ? new TextDecoder("utf-8") : null;
    var candidates = [];
    files.forEach(function (f) {
      if (!/\.json$/i.test(f.path) || /(^|\/)manifest\.json$/i.test(norm(f.path))) return;
      if (f.bytes.length > LIMITS.maxBytes) return;
      try {
        var doc = JSON.parse(decoder ? decoder.decode(f.bytes) : String.fromCharCode.apply(null, f.bytes));
        if (isObj(doc) && Array.isArray(doc.layers) && num(doc.fr)) candidates.push({ path: norm(f.path), doc: doc, size: f.bytes.length });
      } catch (e) { /* not the animation */ }
    });
    if (!candidates.length) {
      return { ok: false, error: "No Lottie animation (.json) was found in this upload. Export it from After Effects with the LottieFiles or Bodymovin plugin, then upload the .json or the folder it created." };
    }
    candidates.sort(function (a, b) {
      var ad = /(^|\/)data\.json$/i.test(a.path) ? 1 : 0, bd = /(^|\/)data\.json$/i.test(b.path) ? 1 : 0;
      return bd - ad || b.size - a.size;
    });
    var chosen = candidates[0];
    var doc = chosen.doc;
    var dir = chosen.path.indexOf("/") >= 0 ? chosen.path.slice(0, chosen.path.lastIndexOf("/") + 1) : "";

    var byPath = {}, byName = {};
    files.forEach(function (f) {
      var ext = (norm(f.path).split(".").pop() || "").toLowerCase();
      if (!IMAGE_MIME[ext]) return;
      byPath[norm(f.path).toLowerCase()] = f;
      byName[baseName(f.path).toLowerCase()] = f;
    });

    var inlined = 0, total = 0, tooBig = 0;
    (doc.assets || []).forEach(function (a) {
      if (!isObj(a) || Array.isArray(a.layers) || typeof a.p !== "string" || DATA_IMAGE.test(a.p)) return;
      var wanted = [norm((a.u || "") + a.p), norm(dir + (a.u || "") + a.p), norm("images/" + a.p), norm(dir + "images/" + a.p)]
        .map(function (p) { return p.toLowerCase(); });
      var hit = null;
      for (var i = 0; i < wanted.length && !hit; i++) hit = byPath[wanted[i]];
      if (!hit) hit = byName[baseName(a.p).toLowerCase()];
      if (!hit) return;
      if (hit.bytes.length > LIMITS.maxImageBytes || total + hit.bytes.length > LIMITS.maxImagesBytes) { tooBig++; return; }
      var ext = (baseName(hit.path).split(".").pop() || "").toLowerCase();
      a.p = "data:" + IMAGE_MIME[ext] + ";base64," + base64(hit.bytes);
      a.u = ""; a.e = 1;
      total += hit.bytes.length;
      inlined++;
    });

    var notes = [];
    if (candidates.length > 1) notes.push("The package had " + candidates.length + " animations; using " + chosen.path + ".");
    if (tooBig) notes.push(tooBig + " image" + (tooBig === 1 ? " was" : "s were") + " too large to include (2 MB each, 6 MB total).");
    return { ok: true, doc: doc, source: chosen.path, imagesInlined: inlined, notes: notes };
  }

  return { LIMITS: LIMITS, inspect: inspect, applyEdits: applyEdits, repairFonts: repairFonts, packFromEntries: packFromEntries, aspectFor: aspectFor };
});
