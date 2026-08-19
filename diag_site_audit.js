/* Walks every page as a logged-in user and reports things a visitor would
   call broken: dead links, buttons that do nothing, console errors, layout
   overflow, and links that 404. */
const puppeteer = require("puppeteer");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const PAGES = [
  "/", "/editor", "/community", "/account", "/pricing", "/about",
  "/contact", "/privacy", "/terms", "/seo-tools", "/404",
  "/template?id=docu-red-string", "/creator?handle=crimedocu"
];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });

  // sign in once so we audit the real, logged-in surface
  await page.goto(BASE + "/", { waitUntil: "networkidle2" });
  const email = "audit" + Date.now() + "@example.com";
  await page.evaluate(async (email) => {
    await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password: "TestPass123!" })
    });
  }, email);

  const report = {};
  const allLinks = new Set();

  for (const route of PAGES) {
    const errors = [];
    const onErr = (e) => errors.push("pageerror: " + e.message);
    const onMsg = (m) => { if (m.type() === "error") errors.push("console: " + m.text().slice(0, 160)); };
    page.on("pageerror", onErr);
    page.on("console", onMsg);

    let status = 0;
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 30000 });
      status = resp ? resp.status() : 0;
    } catch (e) {
      report[route] = { fatal: e.message };
      page.off("pageerror", onErr); page.off("console", onMsg);
      continue;
    }
    await new Promise((r) => setTimeout(r, 900));

    const found = await page.evaluate(() => {
      const out = { deadLinks: [], inertButtons: [], overflow: null, links: [], h1: 0, emptyText: [] };

      document.querySelectorAll("a").forEach((a) => {
        const href = a.getAttribute("href") || "";
        const label = (a.textContent || "").trim().slice(0, 40);
        if (href === "" || href === "#" || href === "javascript:void(0)") {
          out.deadLinks.push(label || "(no label)");
        }
        if (href.startsWith("/")) out.links.push(href.split("#")[0]);
      });

      // A button with no id, no type=submit, no form, and no data-* hook is
      // very likely wired to nothing.
      document.querySelectorAll("button").forEach((b) => {
        if (b.type === "submit") return;
        if (b.id || b.className.match(/js-|pg-buy|sh-/) || Object.keys(b.dataset).length) return;
        const label = (b.textContent || "").trim().slice(0, 40);
        if (label) out.inertButtons.push(label);
      });

      out.overflow = document.documentElement.scrollWidth > window.innerWidth + 1
        ? document.documentElement.scrollWidth + " > " + window.innerWidth : null;
      out.h1 = document.querySelectorAll("h1").length;

      // visible elements that render as an empty placeholder dash
      document.querySelectorAll("p,span,b").forEach((el) => {
        const t = (el.textContent || "").trim();
        if ((t === "—" || t === "-") && el.offsetParent) {
          out.emptyText.push(el.id || el.className || "(unnamed)");
        }
      });
      return out;
    });

    found.links.forEach((l) => allLinks.add(l));
    report[route] = {
      status,
      errors,
      deadLinks: found.deadLinks,
      inertButtons: found.inertButtons,
      overflow: found.overflow,
      h1: found.h1,
      emptyText: found.emptyText
    };

    page.off("pageerror", onErr); page.off("console", onMsg);
  }

  // every internal link must resolve
  const linkStatus = {};
  for (const href of allLinks) {
    try {
      const r = await page.goto(BASE + href, { waitUntil: "domcontentloaded", timeout: 20000 });
      const s = r ? r.status() : 0;
      if (s >= 400) linkStatus[href] = s;
    } catch (e) { linkStatus[href] = "ERR"; }
  }

  await browser.close();

  console.log("\n================ SITE AUDIT ================");
  for (const route of PAGES) {
    const r = report[route];
    if (!r) continue;
    const problems = [];
    if (r.fatal) problems.push("FATAL " + r.fatal);
    if (r.status && r.status >= 400 && route !== "/404") problems.push("HTTP " + r.status);
    if (r.errors && r.errors.length) problems.push(r.errors.length + " js error(s): " + r.errors[0]);
    if (r.deadLinks && r.deadLinks.length) problems.push("dead links: " + r.deadLinks.join(", "));
    if (r.inertButtons && r.inertButtons.length) problems.push("inert buttons: " + r.inertButtons.join(", "));
    if (r.overflow) problems.push("h-overflow " + r.overflow);
    if (r.h1 !== 1 && route !== "/editor") problems.push("h1 count = " + r.h1);
    if (r.emptyText && r.emptyText.length) problems.push("empty placeholders: " + r.emptyText.join(", "));

    console.log("\n" + route + (problems.length ? "" : "   OK"));
    problems.forEach((p) => console.log("   - " + p));
  }

  const broken = Object.keys(linkStatus);
  console.log("\n---- internal links ----");
  console.log(broken.length ? JSON.stringify(linkStatus, null, 1) : "all " + allLinks.size + " internal links resolve");
  console.log("\n============================================");
})().catch((e) => { console.error("HARNESS FAIL:", e.message); process.exit(1); });
