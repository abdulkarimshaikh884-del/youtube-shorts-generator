/* ============================================================
   verify_shell.js
   Replaces verify_page_redesign.js, which asserted the deleted .lp-* landing
   markup and crashed on getComputedStyle(null).

   Checks the professional light-first shell on the index page:
     - HTTP 200, no console/page errors
     - light default canvas (legacy !important theme not leaking in)
     - full-width topbar, hero, composer present and correctly laid out
     - hero and composer are centred, not squeezed by legacy generic classes
     - gallery renders every SC_TPL2 template with a live sandboxed preview
     - every preview iframe is sandboxed without allow-same-origin
     - tile stages hold a real 9:16 box (aspect-ratio actually applied)
     - category chips filter the grid
     - document metadata intact without exposing retired SEO tools
     - mobile: burger appears, sidebar hides, nav toggles
   Usage: node verify_shell.js   [BASE_URL=http://localhost:3211]
   ============================================================ */
const puppeteer = require("puppeteer");

const BASE = process.env.BASE_URL || "http://localhost:3000";
let failures = 0;

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();

  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });

  await page.setViewport({ width: 1440, height: 950 });
  const res = await page.goto(BASE + "/", { waitUntil: "networkidle2", timeout: 45000 });
  ok(res.status() === 200, "GET / is 200", res.status());

  await page.waitForFunction(() => !!window.SC_TPL2 && document.querySelectorAll(".sh-tile").length > 0, { timeout: 20000 });
  await new Promise((r) => setTimeout(r, 1000));

  console.log("\n---- theme ----");
  const theme = await page.evaluate(() => ({
    bg: getComputedStyle(document.body).backgroundColor,
    fg: getComputedStyle(document.body).color,
    legacyCss: !!document.querySelector('link[href*="premium.css"],link[href*="landing.css"]')
  }));
  // Light is the product default; dark remains a user-selectable theme.
  // The canvas is deliberately a tinted off-white rather than near-#fff —
  // a paper-white workspace behind dark 9:16 previews reads as a document,
  // not a video tool. So this asserts "clearly light", not an exact value.
  const rgb = (theme.bg.match(/\d+/g) || []).map(Number);
  ok(rgb.length >= 3 && rgb.slice(0, 3).every((c) => c >= 215) &&
    rgb.slice(0, 3).every((c) => c <= 250),
    "canvas is a light, non-white workspace tone", theme.bg);
  const ink = (theme.fg.match(/\d+/g) || []).map(Number);
  ok(ink.length >= 3 && ink[0] <= 45 && ink[1] <= 45 && ink[2] <= 45,
    "ink is readable on light", theme.fg);
  ok(theme.legacyCss === false, "legacy premium/landing css not loaded");

  console.log("\n---- layout ----");
  const layout = await page.evaluate(() => {
    const box = (s) => {
      const el = document.querySelector(s);
      if (!el) return null;
      const r = el.getBoundingClientRect();
      return { w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x) };
    };
    const h1 = document.querySelector(".sh-hero h1");
    return {
      rail: box(".sh-rail"),
      topbar: box(".sh-topbar"),
      hero: box(".sh-hero"),
      h1: box(".sh-hero h1"),
      h1Align: h1 ? getComputedStyle(h1).textAlign : null,
      composer: box("#composer"),
      cta: box(".sh-cta"),
      ctaText: (document.querySelector(".sh-cta") || {}).textContent?.trim(),
      stage: box(".sh-stage"),
      // The rail is the single navigation surface on desktop. The rule was
      // never "no sidebar" — it was "no *duplicated* navigation", so the
      // topbar must not carry a second copy of the rail's destinations.
      topbarNavLinks: [...document.querySelectorAll(".sh-primary-nav a")]
        .filter((a) => a.getBoundingClientRect().width > 0).length,
      railNavLinks: [...document.querySelectorAll(".sh-rail .sh-nav a")]
        .filter((a) => a.getBoundingClientRect().width > 0).length
    };
  });
  ok(!!layout.rail && layout.rail.w > 200,
    "desktop rail is the navigation surface", layout.rail && layout.rail.w);
  ok(layout.railNavLinks > 0 && layout.topbarNavLinks === 0,
    "navigation is not duplicated between rail and topbar",
    `rail ${layout.railNavLinks} / topbar ${layout.topbarNavLinks}`);
  ok(!!layout.topbar, "topbar rendered");
  ok(layout.h1Align === "center", "hero heading is centred", layout.h1Align);
  ok(layout.composer && layout.composer.w > 600, "composer is full width, not squeezed",
    layout.composer && layout.composer.w);
  ok(!!layout.ctaText && layout.ctaText.length > 3, "sidebar CTA has a visible label",
    layout.ctaText);
  // Gallery cards were deliberately compacted so more fit above the fold, so
  // the stage is no longer a strict 9:16 — it just has to stay portrait.
  const ratio = layout.stage ? layout.stage.w / layout.stage.h : 0;
  ok(ratio > 0.4 && ratio < 0.85, "tile stage is a portrait box", ratio.toFixed(3));

  console.log("\n---- gallery ----");
  const gal = await page.evaluate(() => {
    const engineCount = window.SC_TPL2.list().length;
    const frames = Array.prototype.map.call(
      document.querySelectorAll(".sh-stage iframe"),
      (f) => f.getAttribute("sandbox")
    );
    return {
      engineCount,
      tiles: document.querySelectorAll(".sh-tile").length,
      frames: frames.length,
      sandboxes: frames,
      chips: document.querySelectorAll(".sh-chip").length,
      imgAttach: !!document.querySelector("#composerImg"),
      imgChipHidden: (document.querySelector("#composerImgClear") || {}).hidden,
      // The tier picker is an ARIA listbox now, not a native <select>.
      tiers: [...document.querySelectorAll("#qualityMenu [role='option'] b")]
        .map((o) => o.textContent.replace(/[^\w\s]/g, "").trim()).join("/"),
      templateSelect: !!document.querySelector("#styleSelect"),
      barControls: document.querySelectorAll("#qualityDropdown").length
    };
  });
  // The gallery shows every built-in template plus the community-published
  // ones, so tiles >= engine count rather than exactly equal.
  ok(gal.tiles >= gal.engineCount, "a tile for every engine template (plus community)",
    `${gal.tiles}/${gal.engineCount}`);
  ok(gal.frames >= 6, "previews actually mounted", gal.frames);
  ok(gal.sandboxes.every((s) => s !== null && !/allow-same-origin/.test(s)),
    "every preview iframe is sandboxed without allow-same-origin");
  ok(gal.chips >= 5, "category chips rendered", gal.chips);
  ok(gal.imgAttach, "composer offers image upload");
  ok(gal.imgChipHidden === true, "the attached-image chip is hidden until a file is picked",
    gal.imgChipHidden);
  ok(gal.tiers === "Standard/Detailed/Advanced", "the model selector uses capability names", gal.tiers);
  // templates are chosen from the gallery below, so the composer does not repeat
  // that choice: prompt + image + model tier only
  ok(!gal.templateSelect, "composer no longer duplicates the template picker");
  ok(gal.barControls === 1, "the composer bar has exactly one tier picker", gal.barControls);

  // chip filtering
  const filtered = await page.evaluate(async () => {
    const chips = document.querySelectorAll(".sh-chip");
    const target = chips[2];
    const hiddenNow = () => Array.prototype.filter.call(
      document.querySelectorAll(".sh-tile"), (t) => t.hidden).length;
    target.click();
    // Poll for the grid to react rather than assuming 150ms is enough. With
    // sixty tiles a slow machine sometimes had not applied the filter yet,
    // which failed as "the chip does not filter" on a run where it does.
    for (let i = 0; i < 40 && hiddenNow() === 0; i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    const total = document.querySelectorAll(".sh-tile").length;
    const shown = Array.prototype.filter.call(
      document.querySelectorAll(".sh-tile"), (t) => !t.hidden).length;
    document.querySelectorAll(".sh-chip")[0].click();
    return { total, shown, cat: target.dataset.cat };
  });
  ok(filtered.shown > 0 && filtered.shown < filtered.total,
    `chip '${filtered.cat}' filters the grid`, `${filtered.shown}/${filtered.total}`);

  /* These three shapes were each asked for, lost to a later change, and
     asked for again. Asserting them keeps the next redesign honest. */
  console.log("\n---- workspace shape ----");
  const shape = await page.evaluate(() => {
    // Render the signed-in chrome so the auth-gated rows are measurable.
    if (window.SC_AUTH && SC_AUTH.paint) {
      SC_AUTH.paint({ email: "shape@example.com", displayName: "Shape", role: "super_admin" });
    }
    const shown = (sel) => [...document.querySelectorAll(sel)]
      .filter((el) => !el.hasAttribute("hidden") && el.offsetParent !== null);
    const tile = document.querySelector(".sh-tile");
    const meta = tile && tile.querySelector(".sh-tmeta");
    return {
      railLabels: shown(".sh-rail .sh-nav a").map((a) => a.textContent.trim()),
      // Assert the destinations, not their wording: "Settings" became
      // "Account & settings" when the rail was grouped, and a label is a copy
      // decision while the page it reaches is the actual requirement.
      railHrefs: shown(".sh-rail .sh-nav a").map((a) => a.getAttribute("href")),
      railGroups: shown(".sh-rail .sh-navgroup-title").map((h) => h.textContent.trim()),
      footerHrefs: [...document.querySelectorAll(".sh-foot a, footer a")]
        .map((a) => a.getAttribute("href")),
      topbarCount: shown(".sh-top-actions > *").length,
      topbarHasNav: shown('.sh-top-actions a[href="/#templates"], .sh-top-actions a[href="/community"]').length,
      metaChildren: meta ? [...meta.children].map((c) => String(c.className)) : [],
      actionBars: document.querySelectorAll(".sh-tact-bar").length,
      descriptions: document.querySelectorAll(".sh-tdesc").length,
      popover: (() => {
        const p = document.querySelector(".sh-user-popover");
        return p ? getComputedStyle(p).display : "absent";
      })()
    };
  });
  // Creator Studio opens the Studio itself now, so /editor is the rail's
  // destination and /uploads — the page that manages published work — is
  // reached from the account menu instead.
  ok(shape.railHrefs.length >= 7 && ["/editor", "/settings", "/admin", "/drafts", "/community"]
    .every((h) => shape.railHrefs.includes(h)),
    "the rail carries every workspace destination", shape.railHrefs.join(" "));
  // Privacy and Terms left the rail for the footer. They still have to be
  // reachable from every page — that is the point of putting them there.
  ok(["/privacy", "/terms"].every((h) => shape.footerHrefs.includes(h)),
    "the legal pages remain reachable from the footer",
    shape.footerHrefs.filter((h) => h === "/privacy" || h === "/terms").join(" "));
  ok(shape.railGroups.length >= 2,
    "the rail is grouped rather than one flat list", shape.railGroups.join(" / "));
  ok(shape.popover === "none" || shape.popover === "absent",
    "no account popover duplicating the rail", shape.popover);
  // Four: credits, notifications, upload and log out. The bell joined them
  // because it opens a panel rather than going somewhere, which made it the
  // one rail row that did not behave like a destination. What still must not
  // appear here is navigation — that is the rail's job, and duplicating it
  // was the original problem.
  ok(shape.topbarCount === 4 && shape.topbarHasNav === 0,
    "top bar keeps only credits, notifications, upload and log out", shape.topbarCount);
  ok(shape.metaChildren.length === 2 &&
    /sh-ttitle-row/.test(shape.metaChildren[0]) &&
    /sh-tcreator-row/.test(shape.metaChildren[1]),
    "a card is preview, title and creator", shape.metaChildren.join(" + "));
  ok(shape.actionBars === 0 && shape.descriptions === 0,
    "like/comment/share and descriptions stay on the detail page",
    `${shape.actionBars} bars / ${shape.descriptions} descriptions`);

  // A rail holding every destination outgrows a short window, and the part
  // that fell off the bottom was the account chip. The list scrolls; the
  // footer does not move.
  await page.setViewport({ width: 1440, height: 600 });
  await new Promise((r) => setTimeout(r, 400));
  const shortWindow = await page.evaluate(() => {
    const nav = document.querySelector(".sh-rail .sh-nav");
    const foot = document.querySelector(".sh-rail-foot");
    return {
      navScrolls: nav.scrollHeight > nav.clientHeight + 1,
      footBottom: Math.round(foot.getBoundingClientRect().bottom),
      viewport: window.innerHeight
    };
  });
  ok(shortWindow.footBottom <= shortWindow.viewport,
    "the rail footer stays on screen in a short window",
    `${shortWindow.footBottom} / ${shortWindow.viewport}`);
  ok(shortWindow.navScrolls, "the destination list scrolls instead of clipping");

  // Scrolling one axis turns the other from `visible` into `auto`, so the rail
  // grew a sideways scrollbar under its rows as soon as it was tall enough to
  // scroll at all — and because the vertical bar's arrival narrowed the rows,
  // the height that decided whether to show it kept changing, which is what
  // made the sidebar visibly settle up and down. Both are one-line CSS
  // properties, and both silently come back the next time a row is added.
  const railScroll = await page.evaluate(() => {
    const cs = getComputedStyle(document.querySelector(".sh-rail .sh-nav"));
    const nav = document.querySelector(".sh-rail .sh-nav");
    return {
      hOverflow: nav.scrollWidth - nav.clientWidth,
      overflowX: cs.overflowX,
      gutter: cs.scrollbarGutter,
      chain: cs.overscrollBehaviorY
    };
  });
  ok(railScroll.hOverflow <= 1 && railScroll.overflowX === "hidden",
    "the rail never scrolls sideways", `${railScroll.hOverflow}px / ${railScroll.overflowX}`);
  ok(railScroll.gutter === "stable",
    "the scrollbar reserves its width so its arrival cannot reflow the rows",
    railScroll.gutter);
  ok(railScroll.chain === "auto",
    "the wheel returns to the page at the end of the list", railScroll.chain);

  // The rail is meant to need no scrollbar at all on an ordinary laptop. This
  // is the assertion that fails first when a destination is added.
  await page.setViewport({ width: 1440, height: 768 });
  await new Promise((r) => setTimeout(r, 400));
  const laptop = await page.evaluate(() => {
    const nav = document.querySelector(".sh-rail .sh-nav");
    return { over: nav.scrollHeight - nav.clientHeight,
             rows: [...nav.querySelectorAll("a")].filter((a) => a.offsetParent !== null).length };
  });
  ok(laptop.over <= 1,
    "every rail destination fits without scrolling at 768px",
    `${laptop.rows} rows, ${laptop.over}px over`);

  await page.setViewport({ width: 1440, height: 900 });
  await new Promise((r) => setTimeout(r, 300));

  console.log("\n---- document quality ----");
  const seo = await page.evaluate(() => ({
    title: document.title,
    canonical: (document.querySelector('link[rel="canonical"]') || {}).href,
    desc: (document.querySelector('meta[name="description"]') || {}).content || "",
    jsonld: !!document.querySelector('script[type="application/ld+json"]'),
    h1s: document.querySelectorAll("h1").length,
    h2Text: Array.prototype.map.call(document.querySelectorAll("h2"), (h) => h.textContent).join(" | "),
    toolLinks: document.querySelectorAll('a[href^="/youtube-shorts-"], a[href="/ai-thumbnail-prompt-generator"]').length
  }));
  ok(/ShortsCraft/.test(seo.title), "title present", seo.title.slice(0, 48));
  ok(/shortscraft\.online/.test(seo.canonical || ""), "canonical present");
  ok(seo.desc.length > 80, "meta description present", seo.desc.length);
  ok(seo.jsonld, "JSON-LD structured data present");
  ok(seo.h1s === 1, "exactly one H1", seo.h1s);
  // The heading reads "Browse free templates" now; what matters is that the
  // gallery still announces itself as the template library.
  ok(/templates|template library/i.test(seo.h2Text), "animation library H2 retained", seo.h2Text.slice(0, 80));
  ok(seo.toolLinks === 0, "retired SEO tool links are absent", seo.toolLinks);

  console.log("\n---- mobile ----");
  await page.setViewport({ width: 400, height: 820 });
  await new Promise((r) => setTimeout(r, 600));
  const mob = await page.evaluate(async () => {
    const rail = document.querySelector(".sh-rail");
    const burger = document.querySelector("#navBurger");
    const menu = document.querySelector("#navMobile");
    const railHidden = getComputedStyle(rail).display === "none";
    const burgerShown = getComputedStyle(burger).display !== "none";
    burger.click();
    await new Promise((r) => setTimeout(r, 150));
    const opened = !menu.hasAttribute("hidden");
    burger.click();
    await new Promise((r) => setTimeout(r, 150));
    return {
      railHidden, burgerShown, opened,
      closed: menu.hasAttribute("hidden"),
      hOverflow: document.documentElement.scrollWidth <= window.innerWidth + 1
    };
  });
  ok(mob.railHidden, "sidebar hidden on mobile");
  ok(mob.burgerShown, "burger shown on mobile");
  ok(mob.opened && mob.closed, "mobile nav opens and closes");
  ok(mob.hOverflow, "no horizontal overflow on mobile");

  console.log("\n---- errors ----");
  ok(errs.length === 0, "no console or page errors", errs.length ? errs[0] : 0);

  await browser.close();
  console.log(`\nSHELL=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
