/* Template uploads (Lottie), end to end.

   What a creator uploads is recognised, cleaned and stored; only its owner can
   publish it; the published template plays in a sandboxed preview frame; and
   the exporter renders it frame by frame, with the creator's edits, into an
   MP4 whose frames actually move.

   Offline checks run without a server. The rest need BASE_URL (default
   http://localhost:3000) and ffmpeg/ffprobe on PATH. Every fixture this run
   creates is removed in finally. */
require("dotenv").config();
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");
const { execFileSync } = require("node:child_process");
const puppeteer = require("puppeteer");
const auth = require("./auth");
const db = require("./db");
const L = require("./public/lottie-inspect.js");
const sample = require("./tests/fixtures/lottie-sample.js");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const users = [];
const docIds = [];
const templateIds = [];
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "sc-lottie-"));
let failures = 0;

function ok(condition, label, detail) {
  if (condition) console.log(`  PASS  ${label}${detail !== undefined ? "  (" + detail + ")" : ""}`);
  else { failures++; console.log(`  FAIL  ${label}${detail !== undefined ? "  (" + detail + ")" : ""}`); }
}

async function fixture(label) {
  const suffix = crypto.randomBytes(6).toString("hex");
  const headers = {};
  const res = { getHeader: (k) => headers[k.toLowerCase()], setHeader: (k, v) => { headers[k.toLowerCase()] = v; } };
  const out = await auth.signUp(res, `lottie-${suffix}@example.invalid`, "Lottie-test-password-23", `lot_${suffix}`);
  assert.ok(out.user, out.error);
  const user = { ...out.user, label, cookie: String(headers["set-cookie"]).split(";")[0] };
  users.push(user);
  return user;
}

async function call(user, method, route, body, extraHeaders) {
  const r = await fetch(BASE + route, {
    method,
    headers: { "Content-Type": "application/json", ...(user ? { Cookie: user.cookie } : {}), ...(extraHeaders || {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }),
    signal: AbortSignal.timeout(60000)
  });
  const text = await r.text();
  let data = {};
  try { data = JSON.parse(text); } catch (e) { /* not json */ }
  return { status: r.status, data, headers: r.headers, text };
}

async function exportMp4(user, clip) {
  const r = await fetch(BASE + "/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json", Cookie: user.cookie },
    // No height: the plan's own maximum applies, as it would for a free creator.
    body: JSON.stringify({ clips: [clip], aspect: "9:16", fps: 24 }),
    signal: AbortSignal.timeout(180000)
  });
  const type = r.headers.get("content-type") || "";
  if (!r.ok || !/video\/mp4/.test(type)) {
    return { status: r.status, error: await r.text() };
  }
  return { status: r.status, buffer: Buffer.from(await r.arrayBuffer()) };
}

function frameHash(file, atSeconds) {
  const frame = file + "-" + atSeconds + ".png";
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(atSeconds), "-i", file, "-frames:v", "1", "-vf", "scale=180:-1", frame], { stdio: "ignore" });
  return crypto.createHash("sha256").update(fs.readFileSync(frame)).digest("hex");
}

// A real 2×2 PNG, so the package test inlines an image that decodes.
const PNG_2x2 = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAIAAAACCAYAAABytg0kAAAAFklEQVR42mP8z8Dwn4GBgYGJAQoAAB4AAv8XbD0AAAAASUVORK5CYII=", "base64");

(async () => {
  try {
    console.log("\n---- recognising an upload (offline) ----");
    const r = L.inspect(JSON.stringify(sample()));
    ok(r.ok, "a real Lottie export is recognised", r.errors.join("; "));
    ok(r.meta.width === 1080 && r.meta.height === 1920 && r.meta.aspect === "9:16", "size and aspect are read from the file", `${r.meta.width}x${r.meta.height} ${r.meta.aspect}`);
    ok(r.meta.fps === 30 && r.meta.durationMs === 3000, "frame rate and length are read from the file", `${r.meta.fps}fps ${r.meta.durationMs}ms`);
    ok(r.meta.texts.length === 1 && r.meta.texts[0].label === "Headline" && r.meta.texts[0].value === "Stop scrolling", "its text layer becomes an editable field named after the layer");
    ok(r.meta.colors.map((c) => c.value).join(",") === "#ffffff,#2563eb", "its colours become editable fields, most-used first", r.meta.colors.map((c) => c.value).join(","));
    ok(!JSON.stringify(r.clean).includes("bm_rt"), "expressions are removed — uploads never carry code");
    ok(!JSON.stringify(r.clean).includes("fonts.example"), "remote font URLs are removed — nothing is fetched from elsewhere");
    ok(r.clean.assets[0].p.startsWith("data:image/png;base64,") && r.warnings.some((w) => /not inside the upload/.test(w)),
      "an image that is not in the upload is blanked, and the creator is told");
    ok(L.inspect(sample({ w: 1920, h: 1080 })).meta.aspect === "16:9", "a landscape export is recognised as 16:9");

    const long = sample(); long.op = 30 * 12;
    ok(!L.inspect(long).ok && /9 seconds/.test(L.inspect(long).errors[0]), "an animation longer than a Studio clip is refused with the reason", L.inspect(long).errors[0]);
    ok(!L.inspect("{broken").ok, "a file that is not JSON is refused");
    ok(!L.inspect({ hello: "world" }).ok && /not a Lottie/.test(L.inspect({ hello: "world" }).errors[0]), "JSON that is not an animation is refused with a next step");
    const huge = sample({ w: 8000, h: 8000 });
    ok(!L.inspect(huge).ok, "an absurd canvas size is refused");
    const glyphs = sample(); glyphs.chars = [{ ch: "S", data: {} }];
    const g = L.inspect(glyphs);
    ok(g.ok && g.meta.texts.length === 0 && g.warnings.some((w) => /glyph/.test(w)), "text exported as glyph shapes is not offered for editing, and the creator is told why");

    // A Lottie with text but no fonts.list draws nothing at all in the browser
    // (RevenueSpikeCard3D, 15 September): the renderer stops at the first text.
    const fontless = sample();
    delete fontless.fonts;
    const fontName = fontless.layers.find((l) => l.ty === 5).t.d.k[0].s.f;
    const fx = L.inspect(fontless);
    const repairedFont = fx.ok && fx.clean.fonts && fx.clean.fonts.list.find((f) => f.fName === fontName);
    ok(repairedFont && /sans-serif$/.test(repairedFont.fFamily), "a file without a font list gets one, falling back to a standard font", repairedFont && repairedFont.fFamily);
    ok(fx.warnings.some((w) => /did not list its fonts/.test(w)), "and the creator is told");
    const storedBefore = sample(); delete storedBefore.fonts;
    ok(L.applyEdits(storedBefore, {}).fonts.list.some((f) => f.fName === fontName), "documents stored before the repair are repaired when they render");
    const counting = sample();
    const countLayer = counting.layers.find((l) => l.ty === 5);
    countLayer.t.d.k = [{ s: { ...countLayer.t.d.k[0].s, t: "$100" }, t: 0 }, { s: { ...countLayer.t.d.k[0].s, t: "$200" }, t: 30 }];
    const cr = L.inspect(counting);
    ok(cr.ok && !cr.meta.texts.some((t) => t.value === "$100"), "text that changes over time is not offered as one caption");
    const keptCount = L.applyEdits(cr.clean, { t1: "flattened?" });
    ok(keptCount.layers.find((l) => l.nm === countLayer.nm).t.d.k.length === 2 && keptCount.layers.find((l) => l.nm === countLayer.nm).t.d.k[1].s.t === "$200", "so an edit cannot flatten a count-up");

    console.log("\n---- editing (offline) ----");
    const edited = L.applyEdits(r.clean, { t1: "New\nhook", c2: "#ff0000", c1: "not-a-colour", t9: "no such layer" });
    ok(edited.layers[0].t.d.k[0].s.t === "New\rhook", "a text edit lands on its layer, line breaks included");
    ok(L.inspect(edited).meta.colors.some((c) => c.value === "#ff0000") && L.inspect(edited).meta.colors.some((c) => c.value === "#ffffff"),
      "a colour edit changes that colour everywhere; an invalid one is ignored");
    ok(r.clean.layers[0].t.d.k[0].s.t === "Stop scrolling", "editing never mutates the stored document");

    console.log("\n---- packages: ZIP, .lottie and folders (offline) ----");
    const pkg = L.packFromEntries([
      { path: "export/data.json", bytes: Buffer.from(JSON.stringify(sample())) },
      { path: "export/images/img_0.png", bytes: PNG_2x2 },
      { path: "__MACOSX/export/._data.json", bytes: Buffer.from("junk") }
    ]);
    ok(pkg.ok && pkg.imagesInlined === 1 && pkg.doc.assets[0].p.startsWith("data:image/png;base64,"), "images next to the animation are inlined into it");
    ok(L.inspect(pkg.doc).warnings.every((w) => !/not inside the upload/.test(w)), "a complete package produces no missing-image warning");
    const none = L.packFromEntries([{ path: "readme.txt", bytes: Buffer.from("hi") }]);
    ok(!none.ok && /No Lottie animation/.test(none.error), "a package with no animation says what to export");

    console.log("\n---- the engine (offline) ----");
    global.window = {};
    require("./public/templates-v2.js");
    const E = global.window.SC_TPL2;
    ok(!E.list().some((t) => t.id === "lottie") && E.list(true).some((t) => t.id === "lottie"), "the upload renderer is not a library template, but the Studio can open it");
    const built = E.build("lottie", { props: { doc: "lt_abcdefghijklmnop", t1: "</script><img src=x onerror=alert(1)>" } });
    ok(!built.includes("</script><img"), "creator text cannot close the config script block");
    ok(E.build("lottie", { props: { doc: "../../etc" } }).includes("not available"), "a malformed document id renders nothing but a notice");

    console.log("\n---- uploading ----");
    const guest = await call(null, "POST", "/api/lottie", { animation: sample() });
    ok(guest.status === 401, "a signed-out visitor cannot upload", guest.status);

    const owner = await fixture("owner");
    const other = await fixture("other");

    const bad = await call(owner, "POST", "/api/lottie", { animation: { hello: "world" } });
    ok(bad.status === 400 && /not a Lottie/.test(bad.data.error || ""), "the server refuses a non-animation itself", bad.data.error);

    const up = await call(owner, "POST", "/api/lottie", { animation: sample() });
    ok(up.status === 200 && /^lt_[A-Za-z0-9_-]{16,}$/.test(up.data.id || ""), "an upload is stored and gets an unguessable id", up.data.id);
    const id = up.data.id;
    if (id) docIds.push(id);
    ok(up.data.meta && up.data.meta.texts.length === 1 && up.data.meta.warnings.some((w) => /expression/.test(w)),
      "the server reports what it recognised, including what it removed");

    const again = await call(owner, "POST", "/api/lottie", { animation: sample() });
    ok(again.status === 200 && again.data.id === id && again.data.reused === true, "uploading the same file twice stores it once");

    const doc = await call(null, "GET", "/api/lottie/" + id, undefined, { Origin: "null" });
    ok(doc.status === 200 && doc.data.layers && !doc.text.includes("bm_rt"), "a sandboxed preview (Origin: null) can fetch the cleaned document", doc.status);
    ok(doc.headers.get("access-control-allow-origin") === "*" && /immutable/.test(doc.headers.get("cache-control") || ""),
      "the document is served cross-origin without credentials, and cached as immutable");
    const missing = await call(null, "GET", "/api/lottie/lt_doesnotexist_000000");
    ok(missing.status === 404, "an unknown id is a 404", missing.status);

    console.log("\n---- publishing ----");
    const stolen = await call(other, "POST", "/api/community-templates",
      { tpl: "lottie", props: { doc: id }, title: "Not mine", visibility: "public" });
    ok(stolen.status === 400 && /only publish animations you uploaded/.test(stolen.data.error || ""), "nobody can publish someone else's upload", stolen.data.error);

    const draft = await call(owner, "POST", "/api/community-templates",
      { tpl: "lottie", props: { doc: id, t1: "Draft hook", extra: "dropped" }, title: "Hook draft", visibility: "private", aspect: "16:9", dur: 12000 });
    ok(draft.status === 200 && draft.data.template, "the owner can save it as a draft", draft.status + " " + (draft.data.error || ""));
    if (draft.data.template) templateIds.push(draft.data.template.id);
    const draftRow = draft.data.template || {};
    ok(draftRow.status === "draft" && draftRow.sourceFormat === "lottie_json", "a draft upload is stored as a Lottie template, unpublished", draftRow.status + " " + draftRow.sourceFormat);
    ok(draftRow.aspect === "9:16" && Number(draftRow.dur) === 3000, "aspect and length come from the file, not from the request", draftRow.aspect + " " + draftRow.dur);
    ok(draftRow.props && draftRow.props.t1 === "Draft hook" && !("extra" in draftRow.props), "only the upload's own edit slots are kept");

    const pub = await call(owner, "POST", "/api/community-templates",
      { tpl: "lottie", props: { doc: id }, title: "Hook live", category: "social", visibility: "public" });
    ok(pub.status === 200 && pub.data.template && pub.data.template.status === "published", "the owner can publish it", pub.status);
    if (pub.data.template) templateIds.push(pub.data.template.id);
    const gallery = await call(null, "GET", "/api/community-templates");
    const listed = (gallery.data.templates || gallery.data.items || []).some((t) => t.id === (pub.data.template || {}).id);
    ok(listed, "a published upload appears in the template library");
    const hidden = (gallery.data.templates || gallery.data.items || []).some((t) => t.id === draftRow.id);
    ok(!hidden, "the draft does not");

    console.log("\n---- playing in a sandboxed preview ----");
    const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
    try {
      const page = await browser.newPage();
      await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
      await page.waitForFunction(() => window.SC_TPL2, { timeout: 20000 });
      // The API returning a row is not the same as the library showing it: the
      // gallery once dropped every row whose renderer was not a library entry.
      const shown = await page.waitForFunction(
        (title) => document.body.innerText.includes(title), { timeout: 20000 }, "Hook live"
      ).then(() => true).catch(() => false);
      ok(shown, "the published upload is shown in the library on the home page");
      await page.evaluate((docId) => {
        const f = document.createElement("iframe");
        f.id = "lottieProbe";
        f.setAttribute("sandbox", "allow-scripts");
        f.style.cssText = "position:fixed;left:0;top:0;width:270px;height:480px;z-index:99999";
        f.srcdoc = window.SC_TPL2.build("lottie", { props: { doc: docId, t1: "Preview edit" }, aspect: "9:16", dur: 3000 });
        document.body.appendChild(f);
      }, id);
      // The library cards on this page are Lottie frames too, so the probe is
      // found by the edit only it carries, not by being the first to draw.
      let frame = null;
      for (let i = 0; i < 60 && !frame; i++) {
        await new Promise((res) => setTimeout(res, 250));
        for (const fr of page.frames()) {
          const hit = await fr.evaluate(() => {
            const el = document.querySelector("#scLottie");
            return !!el && el.querySelectorAll("svg path").length > 0 && /Preview edit/.test(el.textContent);
          }).catch(() => false);
          if (hit) { frame = fr; break; }
        }
      }
      ok(!!frame, "the upload draws inside a sandboxed preview frame (no same-origin access), with the creator's text edit");
    } finally {
      await browser.close();
    }

    console.log("\n---- exporting ----");
    const nope = await exportMp4(owner, { tpl: "lottie", props: { doc: "lt_doesnotexist_000000" }, dur: 3000 });
    ok(nope.status === 400 && /no longer exists/.test(nope.error || ""), "exporting a missing upload is refused before it is billed", nope.status);

    const first = await exportMp4(owner, { tpl: "lottie", props: { doc: id }, dur: 3000 });
    ok(first.status === 200 && first.buffer && first.buffer.length > 5000, "an upload exports to a real MP4", first.status + " " + (first.error || (first.buffer.length + " bytes")));
    if (first.buffer) {
      const file = path.join(tempDir, "default.mp4");
      fs.writeFileSync(file, first.buffer);
      ok(frameHash(file, 0.1) !== frameHash(file, 2.6), "the exported frames move — the exporter seeks the animation, not a frozen first frame");

      const recoloured = await exportMp4(owner, { tpl: "lottie", props: { doc: id, c2: "#ff0000" }, dur: 3000 });
      ok(recoloured.status === 200 && recoloured.buffer, "an edited upload exports too", recoloured.status);
      if (recoloured.buffer) {
        const file2 = path.join(tempDir, "recoloured.mp4");
        fs.writeFileSync(file2, recoloured.buffer);
        ok(frameHash(file, 1.0) !== frameHash(file2, 1.0), "the export carries the creator's colour edit");
      }
    }
  } catch (err) {
    failures++;
    console.error("HARNESS FAIL:", err.stack || err.message);
  } finally {
    try {
      if (templateIds.length) await db.query("delete from public.community_templates where id = any($1::text[])", [templateIds]);
      if (docIds.length) await db.query("delete from public.lottie_docs where id = any($1::text[])", [docIds]);
      for (const u of users) {
        await db.tx(async (c) => {
          await c.query("delete from public.community_templates where author_id = $1", [u.id]);
          await c.query("delete from public.lottie_docs where owner_id = $1", [u.id]);
          await c.query("delete from public.sessions where user_id = $1", [u.id]);
          await c.query("delete from public.users where id = $1", [u.id]);
        });
      }
      await db.getPool().end();
    } catch (err) {
      console.error("cleanup:", err.message);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
    console.log(`\nLOTTIE=${failures ? "FAIL" : "PASS"}`);
    process.exit(failures ? 1 : 0);
  }
})();
