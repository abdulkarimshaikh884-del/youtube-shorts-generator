/* ============================================================
   verify_editor.js
   Verifies the /editor app:
     - fixed viewport: the PAGE does not scroll, panels scroll internally
     - top bar: back, project name, device toggles, background chip, Export
     - three columns on desktop, focused AI / Canvas / Edit workspace on mobile
     - ?tpl= / ?aspect= honoured, template rail + select in sync
     - preview iframe: sandbox has allow-same-origin and NOT allow-scripts
     - editing text / background / hex / font / aspect / duration re-renders
     - playback: pause, restart, timeline scrub actually drive the animation
     - Reset restores defaults
     - landing page has no links to the old /generator
   Usage: node verify_editor.js   [BASE_URL=http://localhost:3000]
   ============================================================ */
const puppeteer = require("puppeteer");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:3000";
let failures = 0;
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}
const doc = (page) => page.evaluate(() =>
  (document.querySelector("#edPreview") || {}).srcdoc || "");

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await page.setViewport({ width: 1440, height: 900 });

  console.log("\n---- landing links ----");
  await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForFunction(() => !!window.SC_TPL2, { timeout: 20000 });
  await page.waitForSelector('.sh-tile', { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 800));
  const links = await page.evaluate(() => ({
    gen: document.querySelectorAll('a[href^="/generator"]').length,
    // the tile's own link — .sh-stage is a plain div now, the anchor wraps it
    href: (document.querySelector('.sh-tile a[href^="/template"], .sh-tile a[href^="/editor"]') || {})
      .getAttribute?.("href") || ""
  }));
  ok(links.gen === 0, "landing has no /generator links", links.gen);
  // Gallery tiles now open the template detail page, which carries the
  // "Customize in Studio" link into /editor. Either destination is valid.
  ok(/^\/(editor|template)\?/.test(links.href), "tiles open a template destination", links.href);

  console.log("\n---- editor boot ----");
  const res = await page.goto(BASE + "/editor?tpl=ui-toggle&aspect=1%3A1",
    { waitUntil: "networkidle2", timeout: 45000 });
  ok(res.status() === 200, "GET /editor is 200", res.status());
  await page.waitForFunction(() => {
    const f = document.querySelector("#edPreview");
    return f && f.srcdoc && f.srcdoc.length > 400;
  }, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 700));

  const boot = await page.evaluate(() => {
    const de = document.documentElement;
    const cols = getComputedStyle(document.querySelector(".ed-main"))
      .gridTemplateColumns.split(" ").length;
    return {
      pageScrolls: de.scrollHeight > de.clientHeight + 1,
      overflow: getComputedStyle(de).overflow,
      cols,
      hasBack: !!document.querySelector(".ed-back"),
      hasName: !!document.querySelector("#edProject"),
      devices: document.querySelectorAll(".ed-dev").length,
      hasChip: !!document.querySelector("#edChip"),
      hasExport: !!document.querySelector("#edExport"),
      scrollers: document.querySelectorAll(".ed-scroll").length,
      sandbox: document.querySelector("#edPreview").getAttribute("sandbox"),
      tpl: document.querySelector("#edTpl").value,
      aspect: document.querySelector("#edAspect").value,
      arw: document.querySelector("#edFrame").style.getPropertyValue("--arw"),
      tplSelectValue: document.querySelector("#edTpl").value,
      fonts: document.querySelectorAll("#edFont option").length,
      fields: document.querySelectorAll("#edFields .ed-f").length,
      hasSeek: !!document.querySelector("#edSeek"),
      hasPlay: !!document.querySelector("#edPlay")
    };
  });

  ok(boot.pageScrolls === false, "page itself does NOT scroll");
  ok(boot.overflow === "hidden", "html overflow hidden", boot.overflow);
  ok(boot.cols === 3, "three columns on desktop", boot.cols);
  ok(boot.scrollers >= 2, "panels scroll internally", boot.scrollers);
  ok(boot.hasBack && boot.hasName && boot.hasChip && boot.hasExport,
    "top bar has back, name, background chip and Export");
  ok(boot.devices === 5, "device/aspect toggles present", boot.devices);
  ok(/allow-same-origin/.test(boot.sandbox) && !/allow-scripts/.test(boot.sandbox),
    "preview sandbox: allow-same-origin, no allow-scripts", boot.sandbox);
  ok(boot.tpl === "ui-toggle", "?tpl= honoured", boot.tpl);
  ok(boot.aspect === "1:1" && boot.arw === "1", "?aspect= honoured", boot.aspect);
  // The old left template rail was replaced by the AI Assistant panel; the
  // template is now chosen from Properties → Current template, which the
  // "?tpl= honoured" assertion above already covers.
  ok(boot.tplSelectValue === "ui-toggle", "properties panel shows the current template",
    boot.tplSelectValue);
  ok(boot.fonts >= 4, "font choices available", boot.fonts);
  ok(boot.fields === 11, "template content plus shared style controls built", boot.fields);
  ok(boot.hasSeek && boot.hasPlay, "playback controls present");

  console.log("\n---- edits re-render ----");
  let prev = await doc(page);
  await page.evaluate(() => {
    const i = document.querySelector('.ed-f-custom[data-key="title"] input[type="text"]');
    i.value = "SWITCHED"; i.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 400));
  let cur = await doc(page);
  ok(cur !== prev && /SWITCHED/.test(cur), "text edit re-renders");

  prev = cur;
  await page.click(".ed-swb:nth-child(4)");
  await new Promise((r) => setTimeout(r, 350));
  cur = await doc(page);
  ok(cur !== prev, "background swatch re-renders");

  prev = cur;
  await page.evaluate(() => {
    const h = document.querySelector("#edHex");
    h.value = "#ff00aa"; h.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 350));
  cur = await doc(page);
  ok(/#ff00aa/i.test(cur), "hex input reaches the animation");

  prev = cur;
  await page.select("#edFont", "serif");
  await new Promise((r) => setTimeout(r, 350));
  cur = await doc(page);
  ok(/Georgia/.test(cur), "font choice reaches the animation");

  await page.click('.ed-dev[data-ar="9:16"]');
  await new Promise((r) => setTimeout(r, 400));
  const ar = await page.evaluate(() => ({
    arw: document.querySelector("#edFrame").style.getPropertyValue("--arw"),
    sel: document.querySelector("#edAspect").value,
    pressed: document.querySelector('.ed-dev[data-ar="9:16"]').getAttribute("aria-pressed")
  }));
  ok(ar.arw === "9" && ar.sel === "9:16" && ar.pressed === "true",
    "device toggle changes aspect", JSON.stringify(ar));

  await page.evaluate(() => {
    const d = document.querySelector("#edDur");
    d.value = "7000"; d.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await new Promise((r) => setTimeout(r, 450));
  const dur = await page.evaluate(() => ({
    label: document.querySelector("#edDurVal").textContent,
    len: document.querySelector("#edLen").textContent,
    doc: document.querySelector("#edPreview").srcdoc
  }));
  ok(dur.label === "7.0s" && /7000ms/.test(dur.doc), "duration reaches the animation",
    dur.label);
  ok(dur.len === "0:07", "timeline length label updates", dur.len);

  console.log("\n---- playback ----");
  const play = await page.evaluate(async () => {
    const anims = () => {
      const f = document.querySelector("#edPreview");
      return f.contentDocument ? f.contentDocument.getAnimations() : [];
    };
    const count = anims().length;
    document.querySelector("#edPlay").click();          // pause
    await new Promise((r) => setTimeout(r, 220));
    const paused = anims().every((a) => a.playState === "paused");
    const t1 = Number(anims()[0].currentTime);
    await new Promise((r) => setTimeout(r, 420));
    const t2 = Number(anims()[0].currentTime);
    document.querySelector("#edPlay").click();          // play
    await new Promise((r) => setTimeout(r, 260));
    const running = anims().some((a) => a.playState === "running");
    return { count, paused, frozen: t1 === t2, running };
  });
  ok(play.count > 0, "parent can read animations inside the frame", play.count);
  ok(play.paused, "pause actually pauses every animation");
  ok(play.frozen, "paused time does not advance");
  ok(play.running, "play resumes");

  const scrub = await page.evaluate(async () => {
    const s = document.querySelector("#edSeek");
    s.value = "500"; s.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 260));
    const f = document.querySelector("#edPreview");
    const t = Number(f.contentDocument.getAnimations()[0].currentTime);
    return { t, now: document.querySelector("#edNow").textContent };
  });
  ok(scrub.t > 3000 && scrub.t < 4100, "scrubbing seeks the animation", Math.round(scrub.t));
  ok(scrub.now === "0:03", "time readout follows the scrub", scrub.now);

  await page.click("#edRestart");
  await new Promise((r) => setTimeout(r, 300));
  const restarted = await page.evaluate(() => {
    const f = document.querySelector("#edPreview");
    return Number(f.contentDocument.getAnimations()[0].currentTime);
  });
  ok(restarted < 700, "restart returns to the start", Math.round(restarted));

  console.log("\n---- reset ----");
  await page.click("#edReset");
  await new Promise((r) => setTimeout(r, 450));
  const reset = await page.evaluate(() => ({
    dur: document.querySelector("#edDur").value,
    font: document.querySelector("#edFont").value
  }));
  ok(reset.dur === "4600" && reset.font === "inter", "Reset restores defaults",
    `${reset.dur}/${reset.font}`);

  console.log("\n---- image upload + universal background ----");
  await page.goto(BASE + "/editor?tpl=ui-tabs", { waitUntil: "networkidle2", timeout: 45000 });
  await page.waitForSelector('.ed-f-custom[data-key="avatar"] input[type="file"]', { timeout: 20000 });
  const upload = await page.$('.ed-f-custom[data-key="avatar"] input[type="file"]');
  await upload.uploadFile(path.join(__dirname, "public", "favicon-48.png"));
  /* The upload is resized in the browser and then decoded by the preview, so
     wait for the image to actually finish loading rather than for a fixed
     900ms - under load that window closes before the decode and the test
     reports a working upload as broken. */
  await page.waitForFunction(() => {
    const frame = document.querySelector("#edPreview");
    const img = frame && frame.contentDocument &&
      frame.contentDocument.querySelector(".sc-ios-av img");
    return !!img && img.complete && img.naturalWidth > 0;
  }, { timeout: 15000, polling: 200 }).catch(() => {});
  const uploadApplied = await page.evaluate(() => {
    const frame = document.querySelector("#edPreview");
    const image = frame && frame.contentDocument && frame.contentDocument.querySelector(".sc-ios-av img");
    return {
      input: document.querySelector('.ed-f-custom[data-key="avatar"] input[type="text"]').value,
      inDocument: /data:image\/(webp|png|jpeg)/.test((frame || {}).srcdoc || ""),
      imageVisible: !!image && image.complete && image.naturalWidth > 0
    };
  });
  ok(uploadApplied.input === "(Custom Image)" && uploadApplied.inDocument && uploadApplied.imageVisible,
    "uploaded image is optimised and immediately applied to the animation", JSON.stringify(uploadApplied));

  await page.evaluate(() => {
    const colour = document.querySelector("#edChip");
    colour.value = "#123456";
    colour.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait(450);
  const backgroundApplied = await page.evaluate(() => {
    const frame = document.querySelector("#edPreview");
    const stage = frame && frame.contentDocument && frame.contentDocument.querySelector(".sc-user-stage");
    return {
      label: document.querySelector('label[for="edHex"]').textContent,
      enabled: !!stage && stage.classList.contains("sc-user-bg"),
      variable: stage && stage.style.getPropertyValue("--sc-user-background"),
      computed: stage && getComputedStyle(stage).backgroundColor
    };
  });
  ok(backgroundApplied.label === "Template background" && backgroundApplied.enabled
    && backgroundApplied.variable === "#123456" && backgroundApplied.computed === "rgb(18, 52, 86)",
    "header colour picker changes the whole template background", JSON.stringify(backgroundApplied));

  console.log("\n---- mobile ----");
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1200));
  const mobStart = await page.evaluate(() => {
    const top = document.querySelector(".ed-top");
    const name = document.querySelector(".ed-name");
    const skip = document.querySelector(".ed-skip").getBoundingClientRect();
    const nav = document.querySelector(".ed-mobile-nav");
    return {
      hOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1,
      topFits: top.scrollWidth <= top.clientWidth + 1,
      nameFits: name.scrollWidth <= name.clientWidth + 2,
      navVisible: !nav.hidden && getComputedStyle(nav).display === "flex",
      selected: document.querySelector('.ed-mobile-tab[aria-selected="true"]').dataset.mobilePanel,
      canvasVisible: getComputedStyle(document.querySelector("#main")).display !== "none",
      aiHidden: getComputedStyle(document.querySelector("#edAiPanel")).display === "none",
      editHidden: getComputedStyle(document.querySelector("#edPropertiesPanel")).display === "none",
      skipOffscreen: skip.bottom <= 0
    };
  });
  ok(mobStart.hOverflow, "no horizontal overflow on mobile");
  ok(mobStart.topFits, "top bar fits the mobile viewport", `${mobStart.topFits}`);
  ok(mobStart.nameFits, "project name input is not squeezed");
  ok(mobStart.navVisible && mobStart.selected === "canvas", "mobile workspace opens on Canvas");
  ok(mobStart.canvasVisible && mobStart.aiHidden && mobStart.editHidden,
    "only the selected mobile panel is shown");
  ok(mobStart.skipOffscreen, "skip link stays hidden until keyboard focus");

  await page.click("#edMobileAi");
  await wait(150);
  const mobAi = await page.evaluate(() => {
    const create = document.querySelector("#edCreate").getBoundingClientRect();
    return {
      selected: document.querySelector('.ed-mobile-tab[aria-selected="true"]').dataset.mobilePanel,
      panel: getComputedStyle(document.querySelector("#edAiPanel")).display,
      prompt: getComputedStyle(document.querySelector("#edPrompt")).display,
      createH: Math.round(create.height)
    };
  });
  ok(mobAi.selected === "ai" && mobAi.panel !== "none" && mobAi.prompt !== "none",
    "AI Assistant and composer are reachable on mobile");
  ok(mobAi.createH >= 44, "AI create action has a touch-sized target", mobAi.createH);

  await page.click("#edMobileEdit");
  await wait(150);
  const mobEdit = await page.evaluate(() => {
    const last = document.querySelector(".ed-props > .ed-grp:last-child");
    window.scrollTo(0, 99999);
    return {
      selected: document.querySelector('.ed-mobile-tab[aria-selected="true"]').dataset.mobilePanel,
      panel: getComputedStyle(document.querySelector("#edPropertiesPanel")).display,
      lastReachable: last.getBoundingClientRect().bottom <= window.innerHeight + 1,
      aspectH: Math.round(document.querySelector("#edAspect").getBoundingClientRect().height)
    };
  });
  ok(mobEdit.selected === "edit" && mobEdit.panel !== "none", "Properties are reachable on mobile");
  ok(mobEdit.lastReachable, "last Properties control is reachable by scrolling");
  ok(mobEdit.aspectH >= 44, "mobile form controls avoid tiny tap targets", mobEdit.aspectH);

  console.log("\n---- short desktop viewport ----");
  await page.setViewport({ width: 1440, height: 700, isMobile: false, hasTouch: false });
  await page.reload({ waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 1200));
  const shortvp = await page.evaluate(() => {
    const sc = document.querySelector(".ed-right .ed-scroll");
    const last = document.querySelector(".ed-props > .ed-grp:last-child");
    sc.scrollTop = 99999;
    return {
      pageStatic: document.documentElement.scrollHeight <= window.innerHeight + 1,
      panelScrolls: sc.scrollHeight > sc.clientHeight + 1 && sc.scrollTop > 1,
      lastReachable: last.getBoundingClientRect().bottom <= window.innerHeight + 1
    };
  });
  ok(shortvp.pageStatic, "page itself does not scroll on desktop");
  ok(shortvp.panelScrolls, "Properties panel scrolls internally");
  ok(shortvp.lastReachable, "Export controls reachable at 700px height");

  console.log("\n---- errors ----");
  ok(errs.length === 0, "no console or page errors", errs.length ? errs[0] : 0);

  await browser.close();
  console.log(`\nEDITOR=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
