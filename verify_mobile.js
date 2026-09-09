/* ============================================================
   verify_mobile.js
   Phone regression for the complete ShortsCraft journey:
     - important public/account routes fit 320px and remain scrollable
     - mobile drawer exposes the workspace links lost with the desktop rail
     - touch-critical actions are at least 40px high
     - Editor exposes AI, Canvas, Edit, Publish and Export on a phone
   Usage: node verify_mobile.js [BASE_URL=http://localhost:3000]
   ============================================================ */
const puppeteer = require("puppeteer");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
let failures = 0;

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

const SHELL_ROUTES = [
  "/", "/template?id=original-ranked-list", "/pricing", "/community",
  "/drafts", "/uploads", "/settings", "/tutorials", "/account",
  "/contact", "/seo-tools", "/creator?handle=shortscraft"
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push("pageerror: " + e.message));
  page.on("console", (m) => {
    const text = m.text();
    // The drawer pass calls SC_AUTH.paint() to render the signed-in menu
    // without a real session, so the client then requests an authenticated
    // endpoint and the server correctly answers 401. That rejection is the
    // server behaving properly, not a page error.
    if (m.type() === "error" &&
      !/google-analytics|gtag|favicon/i.test(text) &&
      !/status of 401/i.test(text)) {
      errors.push("console: " + text);
    }
  });

  console.log("\n---- 320px route fit and reachability ----");
  await page.setViewport({ width: 320, height: 568, isMobile: true, hasTouch: true });
  for (const route of SHELL_ROUTES) {
    const response = await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 45000 });
    await wait(250);
    const fit = await page.evaluate(() => {
      const de = document.documentElement;
      const main = document.querySelector("#main");
      const footer = document.querySelector(".sh-footer");
      const burger = document.querySelector("#navBurger");
      const upload = document.querySelector("#topbarUploadBtn");
      const top = document.querySelector(".sh-topbar");
      const rect = (el) => {
        if (!el) return null;
        const r = el.getBoundingClientRect();
        return { w: Math.round(r.width), h: Math.round(r.height) };
      };
      window.scrollTo(0, de.scrollHeight);
      const footerBox = footer && footer.getBoundingClientRect();
      return {
        noOverflow: de.scrollWidth <= window.innerWidth + 1,
        mainVisible: !!main && getComputedStyle(main).display !== "none",
        footerReachable: !footerBox || footerBox.bottom <= window.innerHeight + 2,
        burger: rect(burger),
        upload: rect(upload),
        topFits: !top || top.scrollWidth <= top.clientWidth + 1
      };
    });
    const label = route.split("?")[0].padEnd(11);
    ok(response && response.status() < 400, `${label} loads`, response && response.status());
    ok(fit.noOverflow && fit.mainVisible, `${label} fits a 320px phone`);
    ok(fit.footerReachable, `${label} bottom content is reachable`);
    // The publish button carries data-auth="in", so it is legitimately
    // absent for the guest this pass browses as. Only the controls that are
    // actually rendered have to meet the touch target; measuring a hidden
    // element reports 0px and fails for the wrong reason.
    if (fit.burger) {
      const shown = [["burger", fit.burger], ["upload", fit.upload]]
        .filter(([, box]) => box && box.h > 0);
      ok(fit.topFits && shown.every(([, box]) => box.h >= 40),
        `${label} mobile header remains tappable`,
        shown.map(([name, box]) => `${name} ${box.h}px`).join(" / "));
    }
  }

  console.log("\n---- complete mobile drawer ----");
  await page.goto(BASE + "/", { waitUntil: "networkidle2" });
  await wait(500);
  const homeControls = await page.evaluate(() => {
    const filters = document.querySelector("#filters").getBoundingClientRect();
    const active = document.querySelector("#filters .sh-chip").getBoundingClientRect();
    const heights = ['label[for="composerImg"]', "#qualityBtn", "#composerGo"]
      .map((selector) => {
        const el = document.querySelector(selector);
        return el ? Math.round(el.getBoundingClientRect().height) : 0;
      });
    return { filtersW: Math.round(filters.width), activeVisible: active.left >= 0 && active.right <= innerWidth, heights };
  });
  ok(homeControls.filtersW >= 250 && homeControls.activeVisible,
    "search and swipeable template categories each get a full mobile row", homeControls.filtersW);
  ok(homeControls.heights.every((height) => height >= 40),
    "home composer actions are touch-sized", homeControls.heights.join("/"));
  await page.click("#navBurger");
  const drawer = await page.evaluate(() => {
    const menu = document.querySelector("#navMobile");
    const visible = [...menu.querySelectorAll("a")]
      .filter((a) => getComputedStyle(a).display !== "none")
      .map((a) => a.textContent.trim());
    const allLinks = [...menu.querySelectorAll("a")].map((a) => a.textContent.trim());
    // Destinations are asserted by href, not by label: the wording of a nav
    // item is a copy decision that changes ("My Uploads" is now "Creator
    // Studio"), while the page it has to reach is the actual requirement.
    const allHrefs = [...menu.querySelectorAll("a")].map((a) => a.getAttribute("href"));
    menu.scrollTop = menu.scrollHeight;
    return {
      visible,
      allLinks,
      allHrefs,
      canScroll: menu.scrollHeight <= menu.clientHeight + 1 || menu.scrollTop > 0,
      controls: document.querySelector("#navBurger").getAttribute("aria-controls"),
      label: document.querySelector("#navBurger").getAttribute("aria-label")
    };
  });
  ok(drawer.visible.includes("My Projects") && drawer.visible.includes("Tutorials & Help"),
    "drawer keeps desktop workspace destinations");
  ok(drawer.allHrefs.includes("/uploads") && drawer.allHrefs.includes("/settings"),
    "signed-in mobile destinations exist in the drawer",
    drawer.allHrefs.filter((h) => h === "/uploads" || h === "/settings").join(" "));
  ok(drawer.canScroll, "long phone drawer can scroll to every action");
  ok(drawer.controls === "navMobile" && drawer.label === "Close menu", "drawer has correct ARIA state");
  const signedInDrawer = await page.evaluate(() => {
    window.SC_AUTH.paint({ email: "mobile-check@example.com", displayName: "Mobile Check" });
    return [...document.querySelectorAll("#navMobile a")]
      .filter((a) => getComputedStyle(a).display !== "none")
      .map((a) => a.getAttribute("href"));
  });
  ok(["/uploads", "/settings", "/account"].every((href) => signedInDrawer.includes(href)),
    "signed-in users can see uploads, settings and account on mobile",
    signedInDrawer.join(" "));
  await page.evaluate(() => window.SC_AUTH.paint(null));
  await page.keyboard.press("Escape");
  ok(await page.evaluate(() => document.querySelector("#navMobile").hidden), "Escape closes the drawer");

  console.log("\n---- mobile template actions ----");
  await page.goto(BASE + "/template?id=original-ranked-list", { waitUntil: "networkidle2" });
  await wait(350);
  const detail = await page.evaluate(() => {
    const ids = ["#detailStudioBtn", "#detailReplayBtn", "#detailLikeBtn", "#detailShareBtn"];
    return ids.map((selector) => {
      const el = document.querySelector(selector), r = el.getBoundingClientRect();
      return [selector, Math.round(r.width), Math.round(r.height), getComputedStyle(el).display];
    });
  });
  ok(detail.every((item) => item[2] >= 40 && item[3] !== "none"),
    "Customize, Replay, Like and Share are touch-sized", detail.map((x) => x[2]).join("/"));

  console.log("\n---- mobile editor workspace ----");
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + "/editor?tpl=original-chat-story", { waitUntil: "networkidle2" });
  await wait(700);
  const editorStart = await page.evaluate(() => {
    const skip = document.querySelector(".ed-skip").getBoundingClientRect();
    const top = document.querySelector(".ed-top");
    return {
      selected: document.querySelector('.ed-mobile-tab[aria-selected="true"]').dataset.mobilePanel,
      navVisible: !document.querySelector(".ed-mobile-nav").hidden,
      noOverflow: document.documentElement.scrollWidth <= innerWidth + 1,
      topFits: top.scrollWidth <= top.clientWidth + 1,
      skipHidden: skip.bottom <= 0
    };
  });
  ok(editorStart.selected === "canvas" && editorStart.navVisible, "editor opens on the Canvas phone panel");
  ok(editorStart.noOverflow && editorStart.topFits, "editor header and canvas fit the phone");
  ok(editorStart.skipHidden, "editor skip link is visually hidden until focused");

  await page.click("#edMobileAi");
  await wait(100);
  const ai = await page.evaluate(() => {
    const button = document.querySelector("#edCreate").getBoundingClientRect();
    return {
      panel: document.querySelector(".ed-main").dataset.mobilePanel,
      prompt: getComputedStyle(document.querySelector("#edPrompt")).display,
      createH: Math.round(button.height)
    };
  });
  ok(ai.panel === "ai" && ai.prompt !== "none" && ai.createH >= 44,
    "AI prompt, model, image and Create action are reachable");

  await page.click("#edMobileEdit");
  await wait(100);
  const edit = await page.evaluate(() => {
    window.scrollTo(0, document.documentElement.scrollHeight);
    const last = document.querySelector(".ed-props > .ed-grp:last-child").getBoundingClientRect();
    const aspect = document.querySelector("#edAspect").getBoundingClientRect();
    return {
      panel: document.querySelector(".ed-main").dataset.mobilePanel,
      lastReachable: last.bottom <= innerHeight + 1,
      aspectH: Math.round(aspect.height)
    };
  });
  ok(edit.panel === "edit" && edit.lastReachable && edit.aspectH >= 44,
    "all Properties controls are reachable and touch-sized");

  await page.click("#edMobileCanvas");
  await wait(120);
  await page.click("#edAdd");
  await wait(250);
  const timeline = await page.evaluate(() => {
    const add = document.querySelector("#edAdd").getBoundingClientRect();
    const del = document.querySelector('.ed-clip[aria-current="true"] .ed-clipdel').getBoundingClientRect();
    const handle = document.querySelector('.ed-clip[aria-current="true"] .ed-cliphandle').getBoundingClientRect();
    return {
      clips: document.querySelectorAll(".ed-clip").length,
      addRight: Math.round(add.right),
      del: [Math.round(del.width), Math.round(del.height)],
      handleW: Math.round(handle.width),
      inner: innerWidth
    };
  });
  ok(timeline.clips === 2 && timeline.addRight <= timeline.inner + 1, "Add clip remains reachable on mobile");
  ok(timeline.del[0] >= 30 && timeline.del[1] >= 30 && timeline.handleW >= 20,
    "timeline delete and resize handles are finger-accessible");

  console.log("\n---- compact export and publish ----");
  await page.setViewport({ width: 320, height: 568, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: "networkidle2" });
  await wait(500);
  await page.click("#edExport");
  const exportPop = await page.evaluate(() => {
    const pop = document.querySelector("#exportPop");
    const r = pop.getBoundingClientRect();
    const res = pop.querySelector("#edRes");
    return {
      open: !pop.hidden,
      fits: r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1,
      scrollable: pop.scrollHeight <= pop.clientHeight + 1 || getComputedStyle(pop).overflowY === "auto",
      // Only the two actions carry a touch target; the × is a secondary affordance.
      buttons: [...pop.querySelectorAll("#edDownload, #exportCancel")]
        .map((b) => Math.round(b.getBoundingClientRect().height)),
      // A resolution the plan cannot have used to leave this select showing
      // nothing at all, so assert it names a size rather than merely existing.
      resLabel: res.selectedIndex >= 0 ? res.options[res.selectedIndex].textContent.trim() : ""
    };
  });
  ok(exportPop.open, "the export menu opens from its own button");
  ok(exportPop.fits && exportPop.scrollable, "export menu fits a 320x568 screen");
  ok(exportPop.buttons.every((h) => h >= 34), "export actions are touch-sized", exportPop.buttons.join("/"));
  ok(/\d+p/.test(exportPop.resLabel), "a resolution is selected, not blank", exportPop.resLabel);
  await page.click("#exportCancel");
  ok(await page.evaluate(() => document.querySelector("#exportPop").hidden),
    "cancel closes the export menu");

  let publishDialog = "";
  const dialogSeen = new Promise((resolve) => {
    page.once("dialog", async (dialog) => {
      publishDialog = dialog.message();
      await dialog.dismiss();
      resolve();
    });
  });
  await page.click("#edMobilePublish");
  // The dialog is the outcome, so wait for the outcome. A fixed 1800ms window
  // passed on its own and failed inside the full suite, where everything is
  // slower — reporting a working button as broken.
  await Promise.race([dialogSeen, wait(15000)]);
  ok(/logged in|login/i.test(publishDialog), "mobile Publish action is wired", publishDialog || "no dialog");

  await page.goto(BASE + "/editor?mode=ai", { waitUntil: "networkidle2" });
  await wait(350);
  ok(await page.evaluate(() => document.querySelector(".ed-main").dataset.mobilePanel === "ai"),
    "AI entry links open the AI phone panel directly");

  console.log("\n---- errors ----");
  ok(errors.length === 0, "no mobile console or page errors", errors[0] || 0);

  await browser.close();
  console.log(`\nMOBILE=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((error) => {
  console.error(error);
  process.exit(1);
});
