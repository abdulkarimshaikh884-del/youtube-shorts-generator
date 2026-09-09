/* ============================================================
   verify_pages.js
   Verifies every non-app page is the current product page, not the legacy site:
     - loads only shell.css + page.css (no styles/premium/landing/seo-tools/studio)
     - no legacy markup classes and no legacy script.js
     - light is the default theme; shared shell, topbar and footer are present
     - no horizontal overflow at desktop and phone widths
     - every nav / footer link resolves (no 404s inside the site)
     - retired SEO/generator URLs permanently redirect to animation templates
     - the feedback form posts to /api/feedback and validates first
     - 404 page is served with status 404 and is the new page
   Usage: node verify_pages.js   [BASE_URL=http://localhost:3000]
   ============================================================ */
const puppeteer = require("puppeteer");

const BASE = process.env.BASE_URL || "http://localhost:3000";
let failures = 0;
const wait = (n) => new Promise((r) => setTimeout(r, n));

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

const PAGES = ["/pricing", "/about", "/contact", "/privacy", "/terms"];

const RETIRED_TOOLS = [
  "/seo-tools",
  "/youtube-shorts-script-generator",
  "/youtube-shorts-title-generator",
  "/youtube-shorts-description-generator",
  "/youtube-shorts-hashtag-generator",
  "/youtube-shorts-ideas-generator",
  "/ai-thumbnail-prompt-generator"
];

const LEGACY_CSS = /(?:styles|premium|landing|seo-tools|studio)\.css/;

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/google-analytics|gtag|favicon/.test(t)) errs.push("console: " + t);
  });

  // Public pages must work for guests without creating persistent test users.
  // Signed-in ticket history is covered by verify_support.js with cleanup.

  console.log("\n---- every page is the new page ----");
  for (const route of PAGES) {
    await page.setViewport({ width: 1440, height: 900 });
    const res = await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 45000 });
    await wait(400);
    const info = await page.evaluate(() => {
      const sheets = [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((l) => l.getAttribute("href"))
        .filter((h) => !/^https:\/\/fonts/.test(h));
      const scripts = [...document.querySelectorAll("script[src]")].map((s) => s.getAttribute("src"));
      const bg = getComputedStyle(document.body).backgroundColor;
      return {
        status: 0,
        sheets,
        scripts,
        bg,
        rail: !!document.querySelector(".sh-rail"),
        topbar: !!document.querySelector(".sh-topbar"),
        footer: !!document.querySelector(".sh-footer"),
        main: !!document.querySelector("main.pg"),
        h1: document.querySelectorAll("h1").length,
        legacyMarkup: document.querySelectorAll(
          ".nav-inner, .legal-shell, .seo-hero, .contact-wrap, .error-wrap, .aurora, .seo-tools-page-shell"
        ).length,
        hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        title: document.title
      };
    });

    const label = route.padEnd(12);
    ok(res.status() === 200, `${label} 200`, res.status());
    ok(!info.sheets.some((s) => LEGACY_CSS.test(s)), `${label} no legacy stylesheet`, info.sheets.join(" "));
    ok(info.sheets.some((s) => /shell\.css/.test(s)) && info.sheets.some((s) => /page\.css/.test(s)),
      `${label} loads shell.css + page.css`);
    ok(!info.scripts.some((s) => /\/script\.js/.test(s)), `${label} no legacy script.js`,
      info.scripts.join(" "));
    ok(info.legacyMarkup === 0, `${label} no legacy markup`, info.legacyMarkup);
    // The approved redesign uses an off-white default rather than forcing a
    // dark/near-black page before the visitor has chosen that theme. The
    // upper bound matters as much as the lower one: a paper-white page
    // behind dark previews reads as a document rather than a video tool.
    const bgc = (info.bg.match(/\d+/g) || []).map(Number);
    ok(bgc.length >= 3 && bgc.slice(0, 3).every((c) => c >= 215 && c <= 250),
      `${label} light, non-white default theme`, info.bg);
    ok(info.rail && info.topbar && info.footer && info.main, `${label} shell chrome + main`);
    ok(info.h1 === 1, `${label} exactly one h1`, info.h1);
    ok(!info.hOverflow, `${label} no horizontal overflow`);
  }

  console.log("\n---- phone width ----");
  for (const route of ["/pricing", "/contact", "/tutorials"]) {
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    await page.goto(BASE + route, { waitUntil: "networkidle2" });
    await wait(400);
    const m = await page.evaluate(() => {
      // a node inside a horizontally scrollable box (the tool tabs) is allowed
      // to extend past the viewport; anything else is a real overflow
      const scrollable = (el) => {
        for (let p = el.parentElement; p; p = p.parentElement) {
          const ox = getComputedStyle(p).overflowX;
          if ((ox === "auto" || ox === "scroll") && p.scrollWidth > p.clientWidth) return true;
        }
        return false;
      };
      return {
        hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1,
        burger: !!document.querySelector("#navBurger"),
        wide: [...document.querySelectorAll("main.pg *")]
          .filter((el) => el.getBoundingClientRect().right > window.innerWidth + 2)
          .filter((el) => !scrollable(el))
          .map((el) => el.tagName.toLowerCase() + "." + (el.className || ""))
      };
    });
    ok(!m.hOverflow && m.wide.length === 0, `${route.padEnd(12)} fits a phone`,
      m.wide.join(" ") || "clean");
    ok(m.burger, `${route.padEnd(12)} has the mobile menu button`);
  }

  console.log("\n---- mobile menu works ----");
  await page.goto(BASE + "/pricing", { waitUntil: "networkidle2" });
  await wait(300);
  const menu = await page.evaluate(async () => {
    const b = document.querySelector("#navBurger");
    const m = document.querySelector("#navMobile");
    const before = m.hasAttribute("hidden");
    b.click();
    await new Promise((r) => setTimeout(r, 200));
    const after = m.hasAttribute("hidden");
    return { before, after, expanded: b.getAttribute("aria-expanded"), links: m.querySelectorAll("a").length };
  });
  ok(menu.before && !menu.after && menu.expanded === "true" && menu.links >= 6,
    "burger opens the mobile nav", `${menu.links} links`);

  console.log("\n---- button labels are actually readable ----");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/pricing", { waitUntil: "networkidle2" });
  await wait(400);
  const btns = await page.evaluate(() => {
    const lum = (rgb) => {
      const m = rgb.match(/\d+/g).map(Number);
      return (0.2126 * m[0] + 0.7152 * m[1] + 0.0722 * m[2]) / 255;
    };
    // shell.css forces the body colour with !important and sets a{color:inherit},
    // which once made <a class="pg-bw"> white text on a white pill
    return [...document.querySelectorAll(".pg-bw, .pg-bo")].map((b) => {
      const cs = getComputedStyle(b);
      return {
        text: (b.textContent || "").trim().slice(0, 24),
        contrast: Math.abs(lum(cs.color) - lum(cs.backgroundColor === "rgba(0, 0, 0, 0)"
          ? getComputedStyle(b.parentElement).backgroundColor : cs.backgroundColor))
      };
    });
  });
  const invisible = btns.filter((b) => b.contrast < 0.25).map((b) => b.text || "(empty)");
  ok(invisible.length === 0, `all ${btns.length} buttons have readable labels`,
    invisible.join(" | ") || "ok");

  console.log("\n---- no dead links ----");
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/pricing", { waitUntil: "networkidle2" });
  const links = await page.evaluate(() =>
    [...new Set([...document.querySelectorAll('a[href^="/"]')].map((a) => a.getAttribute("href")))]);
  let dead = [];
  for (const href of links) {
    const url = BASE + href.replace(/#.*$/, "");
    const r = await page.evaluate(async (u) => {
      try { const res = await fetch(u, { method: "GET" }); return res.status; } catch (e) { return 0; }
    }, url === BASE ? BASE + "/" : url);
    if (r !== 200) dead.push(href + "=" + r);
  }
  ok(dead.length === 0, `all ${links.length} internal links resolve`, dead.join(" ") || "0 dead");

  console.log("\n---- retired tools return to animation templates ----");
  for (const route of RETIRED_TOOLS) {
    const response = await page.goto(BASE + route, { waitUntil: "domcontentloaded" });
    const info = await page.evaluate(() => ({
      path: location.pathname,
      hash: location.hash,
      h1: (document.querySelector("h1") || {}).textContent || "",
      toolUi: !!document.querySelector("#seoForm")
    }));
    ok(response && (response.status() === 200 || response.status() === 304) && info.path === "/" && info.hash === "#templates",
      `${route} permanently redirects to the template gallery`,
      `${response ? response.status() : 0} ${info.path}${info.hash}`);
    ok(!info.toolUi && /animate/i.test(info.h1), `${route} exposes no retired tool UI`, info.h1);
  }

  console.log("\n---- feedback form ----");
  await page.goto(BASE + "/contact", { waitUntil: "networkidle2" });
  await wait(400);
  const fb = await page.evaluate(async () => {
    const real = window.fetch;
    let called = false, url = null, body = null;
    // Only the ticket POST is stubbed. The shell also fetches auth state and
    // notifications in the background; swallowing those made `called` true
    // before the form was ever submitted, and reading `.body` off their
    // absent init object threw — so all three assertions failed for a
    // reason that had nothing to do with the form.
    window.fetch = function (u, opt) {
      // The form posts to /api/feedback (which the server turns into a
      // support ticket); /api/support/tickets is the GET that lists history.
      // Stubbing every call let that background GET be recorded as the
      // submit URL, so this assertion used to pass without the form having
      // sent anything.
      const isSubmit = String(u).includes("/api/feedback") &&
        opt && String(opt.method || "GET").toUpperCase() === "POST";
      if (!isSubmit) return real.apply(this, arguments);
      called = true; url = String(u); body = JSON.parse(opt.body);
      return Promise.resolve(new Response(JSON.stringify({
        success: true,
        ticket: { reference: "SC-TEST-0001" }
      }),
        { status: 200, headers: { "Content-Type": "application/json" } }));
    };
    const submit = () => document.querySelector("#fbForm")
      .dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));

    submit();                                  // empty -> must not call
    await new Promise((r) => setTimeout(r, 150));
    const blocked = !called;
    const firstNote = document.querySelector("#fbNote").textContent;

    document.querySelector("#fbName").value = "Karim";
    document.querySelector("#fbEmail").value = "not-an-email";
    document.querySelector("#fbMessage").value = "The export button did nothing on my phone.";
    submit();
    await new Promise((r) => setTimeout(r, 150));
    const blockedEmail = !called;

    document.querySelector("#fbEmail").value = "karim@example.com";
    submit();
    // Wait for the handler to actually settle instead of guessing at a
    // delay. "Sending…" is the in-flight state, so polling until it clears
    // keeps this from reading the form mid-submit on a slower run.
    const note = () => document.querySelector("#fbNote").textContent;
    for (let i = 0; i < 60 && (!called || /sending/i.test(note())); i++) {
      await new Promise((r) => setTimeout(r, 50));
    }
    window.fetch = real;
    return {
      blocked, blockedEmail, firstNote, called, url, body,
      note: document.querySelector("#fbNote").textContent,
      cleared: document.querySelector("#fbMessage").value
    };
  });
  ok(fb.blocked, "empty form is not sent", fb.firstNote);
  ok(fb.blockedEmail, "a bad email is not sent");
  ok(fb.called && fb.url === "/api/feedback", "valid form posts to the support ticket API", fb.url);
  ok(fb.body && fb.body.name === "Karim" && /export button/.test(fb.body.message),
    "sends name, email, subject and message", Object.keys(fb.body || {}).join(","));
  // The confirmation now quotes the ticket reference rather than saying
  // "thanks", which is the part a user actually needs to keep.
  ok(fb.cleared === "" && /SC-[A-Z0-9-]+/i.test(fb.note), "form resets and confirms", fb.note);

  console.log("\n---- errors ----");
  ok(errs.length === 0, "no console or page errors", errs.length ? errs[0] : 0);

  console.log("\n---- 404 ----");
  const r404 = await page.goto(BASE + "/definitely-not-a-page", { waitUntil: "networkidle2" });
  const nf = await page.evaluate(() => ({
    code: (document.querySelector(".pg-404code") || {}).textContent || "",
    sheets: [...document.querySelectorAll('link[rel="stylesheet"]')]
      .map((l) => l.getAttribute("href")).filter((h) => !/^https:\/\/fonts/.test(h)),
    robots: (document.querySelector('meta[name="robots"]') || {}).content || "",
    links: document.querySelectorAll(".pg-404links a").length
  }));
  ok(r404.status() === 404, "unknown URL returns 404", r404.status());
  ok(nf.code === "404" && !nf.sheets.some((s) => LEGACY_CSS.test(s)),
    "404 is the new page", nf.sheets.join(" "));
  ok(/noindex/.test(nf.robots), "404 is noindex", nf.robots);
  ok(nf.links >= 4, "404 offers a way back", nf.links);

  await browser.close();
  console.log(`\nPAGES=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
