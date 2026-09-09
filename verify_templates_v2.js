/* ============================================================
   verify_templates_v2.js
   Proves every SC_TPL2 template:
     - builds to a non-empty document
     - contains NO <script> (v2 is CSS-only by contract)
     - renders visible content inside .vp
     - actually animates (>=1 running CSS animation)
     - produces visual change between two sampled frames
     - has no horizontal/vertical overflow of the canvas
     - throws no page errors
   Usage: node verify_templates_v2.js  [BASE_URL=http://localhost:3211]
   ============================================================ */
const puppeteer = require("puppeteer");

const BASE = process.env.BASE_URL || "http://localhost:3000";

function ok(pass, label, extra) {
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra ? "  " + extra : ""}`);
  return pass;
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 420, height: 760, deviceScaleFactor: 1 });

  const pageErrors = [];
  page.on("pageerror", (e) => pageErrors.push(String(e.message)));

  // Load the engine on a blank same-origin page.
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded", timeout: 45000 });
  await page.waitForFunction(() => !!window.SC_TPL2, { timeout: 20000 });

  const list = await page.evaluate(() => window.SC_TPL2.list());
  const cats = await page.evaluate(() => window.SC_TPL2.cats().map((c) => c.id));
  const contract = await page.evaluate(() => ({
    design: window.SC_TPL2.design(),
    types: window.SC_TPL2.fieldTypes(),
    schemas: window.SC_TPL2.list(true).map((t) => ({ id: t.id, result: window.SC_TPL2.validateSchema(t.id) }))
  }));

  const requestedIds = String(process.env.TEMPLATE_IDS || "")
    .split(",").map((id) => id.trim()).filter(Boolean);
  const targets = requestedIds.length ? list.filter((t) => requestedIds.includes(t.id)) : list;

  console.log(`\nSC_TPL2: ${list.length} templates, ${cats.length} categories`
    + (requestedIds.length ? `; testing ${targets.length} selected` : ""));

  let allPass = true;
  const failedTemplates = [];
  const seenCats = new Set(requestedIds.length ? list.map((t) => t.cat) : []);
  allPass = ok(contract.design.version === "1.0.0", "design system is versioned", contract.design.version) && allPass;
  allPass = ok(["text", "textarea", "number", "color", "image", "logo", "boolean", "select", "font", "duration"]
    .every((type) => contract.types.includes(type)), "editable field vocabulary is extensible") && allPass;
  for (const entry of contract.schemas) {
    allPass = ok(entry.result.valid, `schema '${entry.id}' is valid`, entry.result.errors.join("; ")) && allPass;
  }

  // A control is not editable merely because an input exists: changing it must
  // alter the generated scene document. This catches hard-coded renderer copy,
  // icons and values before a template can ship with a dead customization UI.
  const customizationAudit = await page.evaluate(() => {
    const sharedKeys = ["customBackground", "backgroundColor", "customTextColor", "textColor",
      "contentScale", "offsetX", "offsetY", "visualIntensity"];
    const dead = [];
    const missingShared = [];
    let maxFields = 0;
    window.SC_TPL2.list(true).forEach((template) => {
      const schema = template.schema;
      const keys = schema.fields.map((field) => field.key);
      maxFields = Math.max(maxFields, schema.fields.length);
      sharedKeys.forEach((key) => { if (!keys.includes(key)) missingShared.push(template.id + ":" + key); });
      const baseline = window.SC_TPL2.build(template.id, { props: schema.defaults, watermark: false });
      schema.fields.forEach((field) => {
        let changed;
        if (field.type === "toggle" || field.type === "boolean") changed = !Boolean(field.default);
        else if (field.type === "number" || field.type === "duration") changed = Math.min(Number(field.max == null ? 999 : field.max), Number(field.default || 0) + Number(field.step || 1));
        else if (field.type === "color") changed = String(field.default).toLowerCase() === "#123456" ? "#654321" : "#123456";
        else if (field.type === "select") {
          const alternative = (field.options || []).find((option) => String(option.val) !== String(field.default));
          changed = alternative ? alternative.val : field.default;
        } else if (field.type === "image" || field.type === "logo") changed = "https://example.com/" + field.key + ".png";
        else changed = "SHORTSCRAFT_EDIT_" + field.key;
        const html = window.SC_TPL2.build(template.id, {
          props: Object.assign({}, schema.defaults, { [field.key]: changed }), watermark: false
        });
        if (html === baseline) dead.push(template.id + ":" + field.key);
      });
    });
    const iosKeys = window.SC_TPL2.definition("ui-tabs").schema.fields.map((field) => field.key);
    return { dead, missingShared, maxFields, iosKeys, sharedKeys };
  });
  allPass = ok(customizationAudit.dead.length === 0,
    "every advertised customization changes its template", customizationAudit.dead.join(", ")) && allPass;
  allPass = ok(customizationAudit.missingShared.length === 0,
    "every template includes shared style and layout controls", customizationAudit.missingShared.join(", ")) && allPass;
  allPass = ok(customizationAudit.maxFields <= 40,
    "largest template stays inside the export prop limit", customizationAudit.maxFields) && allPass;
  allPass = ok(["user", "avatar", "app1Name", "app1Sub", "app1Icon", "app1Color",
    "app2Name", "app2Sub", "app2Icon", "app2Color", "app3Name", "app3Sub", "app3Icon", "app3Color",
    "app4Name", "app4Sub", "app4Icon", "app4Color"].every((key) => customizationAudit.iosKeys.includes(key)),
    "Apple iOS App List exposes every marked row, icon and colour") && allPass;

  for (const t of targets) {
    console.log(`\n[${t.id}] ${t.name}`);
    seenCats.add(t.cat);

    // Build with NO lines so each template falls back to its own demo content —
    // this is exactly what the gallery renders.
    const html = await page.evaluate(
      (id) => window.SC_TPL2.build(id, { aspect: "9:16" }),
      t.id
    );

    let pass = true;
    pass = ok(typeof html === "string" && html.length > 400, "build() returned a document",
      `(${html ? html.length : 0} chars)`) && pass;
    pass = ok(!/<script/i.test(html), "contains no <script> (CSS-only contract)") && pass;
    pass = ok(cats.indexOf(t.cat) > -1, `category '${t.cat}' is declared`) && pass;
    pass = ok(/^\d+\.\d+\.\d+$/.test(t.version), "template has a semantic version", t.version) && pass;
    pass = ok(Array.isArray(t.supportedRatios) && t.supportedRatios.includes("9:16"),
      "template declares supported ratios") && pass;
    pass = ok(t.metadata && Array.isArray(t.metadata.platforms) && Array.isArray(t.metadata.tags),
      "future recommendation metadata is present") && pass;

    // Render it in an isolated frame.
    const frame = await browser.newPage();
    const frameErrors = [];
    frame.on("pageerror", (e) => frameErrors.push(String(e.message)));
    await frame.setViewport({ width: 300, height: 534 });
    await frame.setContent(html, { waitUntil: "load", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 450));

    const geo = await frame.evaluate(() => {
      const vp = document.querySelector(".vp");
      if (!vp) return null;
      const r = vp.getBoundingClientRect();
      const anims = document.getAnimations
        ? document.getAnimations().filter((a) => a.playState === "running").length
        : -1;
      // any element painting inside the canvas
      const kids = vp.querySelectorAll("*").length;
      return {
        w: Math.round(r.width), h: Math.round(r.height),
        docW: document.documentElement.scrollWidth,
        docH: document.documentElement.scrollHeight,
        winW: window.innerWidth, winH: window.innerHeight,
        anims, kids
      };
    });

    pass = ok(!!geo, ".vp canvas exists") && pass;
    if (geo) {
      pass = ok(geo.kids >= 3, "canvas has content", `(${geo.kids} nodes)`) && pass;
      pass = ok(geo.anims === -1 || geo.anims >= 1, "has running CSS animations",
        `(${geo.anims})`) && pass;
      pass = ok(geo.docW <= geo.winW + 1, "no horizontal overflow",
        `(${geo.docW} <= ${geo.winW})`) && pass;
      pass = ok(geo.docH <= geo.winH + 1, "no vertical overflow",
        `(${geo.docH} <= ${geo.winH})`) && pass;
      const ratio = geo.w / geo.h;
      pass = ok(Math.abs(ratio - 9 / 16) < 0.02, "canvas is 9:16",
        `(${ratio.toFixed(3)})`) && pass;
    }

    // Motion proof: sample across the loop. Two arbitrary instants can legitimately
    // land on the same held pose, so require >=3 distinct frames out of 5.
    const shots = [];
    for (let i = 0; i < 5; i++) {
      shots.push(await frame.screenshot({ encoding: "base64" }));
      if (i < 4) await new Promise((r) => setTimeout(r, 780));
    }
    const uniq = new Set(shots).size;
    pass = ok(uniq >= 3, "frames change across the loop (motion is real)",
      `(${uniq}/5 distinct)`) && pass;

    pass = ok(frameErrors.length === 0, "no runtime errors",
      frameErrors.length ? frameErrors[0] : "") && pass;

    // Wide export must not squash the vertical rhythm: the safe content box
    // stays 9:16 and nothing may spill outside the frame.
    const wide = await page.evaluate((id) => window.SC_TPL2.build(id, { aspect: "16:9" }), t.id);
    await frame.setViewport({ width: 560, height: 315 });
    await frame.setContent(wide, { waitUntil: "load", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 400));
    const wideGeo = await frame.evaluate(() => {
      const vp = document.querySelector(".vp");
      const cv = document.querySelector(".cv");
      if (!vp || !cv) return null;
      const v = vp.getBoundingClientRect(), c = cv.getBoundingClientRect();
      return {
        vRatio: v.width / v.height,
        cRatio: c.width / c.height,
        inside: c.width <= v.width + 1 && c.height <= v.height + 1,
        docW: document.documentElement.scrollWidth,
        winW: window.innerWidth
      };
    });
    pass = ok(!!wideGeo && Math.abs(wideGeo.vRatio - 16 / 9) < 0.03,
      "16:9 frame honours the requested ratio",
      wideGeo && wideGeo.vRatio.toFixed(3)) && pass;
    const expectedCanvasRatio = t.collection === "originals" ? 16 / 9 : 9 / 16;
    pass = ok(!!wideGeo && Math.abs(wideGeo.cRatio - expectedCanvasRatio) < 0.03,
      t.collection === "originals"
        ? "Original adapts its canvas to the requested wide ratio"
        : "classic safe content box stays 9:16 when exported wide",
      wideGeo && wideGeo.cRatio.toFixed(3)) && pass;
    pass = ok(!!wideGeo && wideGeo.inside && wideGeo.docW <= wideGeo.winW + 1,
      "nothing spills outside the wide frame") && pass;

    await frame.close();
    if (!pass) failedTemplates.push(t.id);
    allPass = pass && allPass;
  }

  console.log("\n---- coverage ----");
  for (const c of cats) {
    allPass = ok(seenCats.has(c), `category '${c}' has at least one template`) && allPass;
  }

  const originals = list.filter((t) => t.collection === "originals");
  allPass = ok(originals.length === 3, "exactly three approved ShortsCraft Originals ship", originals.length) && allPass;
  allPass = ok(new Set(originals.map((t) => t.metadata.category)).size === 3,
    "the approved Originals cover three distinct creator use cases") && allPass;
  const retiredRegistry = await page.evaluate(() => {
    const ids = window.SC_TPL2.list(true).map((template) => template.id);
    return ["original-ai-compare", "original-app-showcase"].filter((id) => ids.includes(id));
  });
  allPass = ok(retiredRegistry.length === 0, "retired templates stay out of the public registry",
    retiredRegistry.join(", ")) && allPass;

  const propContract = await page.evaluate(() => {
    const result = window.SC_TPL2.validateProps("original-growth-stats", { contentScale: 999, unsupported: "x" });
    const html = window.SC_TPL2.build("original-growth-stats", {
      props: { title: "A deliberately overlong headline ".repeat(8), contentScale: 999 }, aspect: "9:16"
    });
    return {
      valid: result.valid, errors: result.errors, score: result.value.contentScale, html,
      retired: ["original-ai-compare", "original-app-showcase"].map((id) => ({
        id, definition: window.SC_TPL2.definition(id), html: window.SC_TPL2.build(id, {})
      }))
    };
  });
  allPass = ok(!propContract.valid && propContract.errors.some((e) => /Unsupported property/.test(e)),
    "unsupported properties are reported and ignored") && allPass;
  allPass = ok(propContract.score === 130, "numeric props are clamped to schema limits", propContract.score) && allPass;
  allPass = ok(propContract.retired.every((item) => item.definition === null && item.html === ""),
    "retired templates cannot be opened through direct URLs") && allPass;
  allPass = ok(propContract.html.length > 1000 && !propContract.html.includes("undefined"),
    "long text and missing optional media build safely") && allPass;

  allPass = ok(pageErrors.length === 0, "host page threw no errors",
    pageErrors.length ? pageErrors[0] : "") && allPass;

  await browser.close();

  if (failedTemplates.length) console.log(`FAILED_TEMPLATES=${failedTemplates.join(",")}`);
  console.log(`\nTEMPLATES_V2=${allPass ? "PASS" : "FAIL"}`);
  process.exit(allPass ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
