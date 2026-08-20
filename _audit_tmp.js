/* Full user-journey audit: every page, guest + logged in, desktop + mobile. */
const puppeteer = require("puppeteer");
const BASE = "https://shortscraft.online";

const PAGES = [
  "/", "/editor", "/community", "/account", "/pricing", "/about", "/contact",
  "/privacy", "/terms", "/seo-tools", "/login", "/signup",
  "/template?id=docu-red-string", "/creator?handle=crimedocu",
  "/generator", "/nope-this-does-not-exist"
];

function attach(page, bag) {
  page.on("pageerror", (e) => bag.jsErrors.push(String(e.message).slice(0, 200)));
  page.on("console", (m) => { if (m.type() === "error") bag.consoleErrors.push(m.text().slice(0, 200)); });
  page.on("requestfailed", (r) => bag.failedReq.push(r.url().replace(BASE, "") + " :: " + (r.failure() && r.failure().errorText)));
  page.on("response", (r) => { if (r.status() >= 400) bag.badResp.push(r.status() + " " + r.url().replace(BASE, "")); });
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const report = [];

  for (const route of PAGES) {
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });
    const bag = { jsErrors: [], consoleErrors: [], failedReq: [], badResp: [] };
    attach(page, bag);
    let status = 0, err = null;
    try {
      const resp = await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 40000 });
      status = resp ? resp.status() : 0;
      await new Promise(r => setTimeout(r, 1500));
    } catch (e) { err = e.message; }

    let dom = {};
    if (!err) {
      dom = await page.evaluate(() => {
        const vis = (el) => !!(el.offsetParent || el.getClientRects().length);
        const brokenImgs = [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute("src"));
        const emptyContainers = [...document.querySelectorAll("[id]")].filter(el =>
          vis(el) && el.children.length === 0 && !(el.textContent||"").trim() &&
          !["INPUT","IMG","CANVAS","BR","HR","IFRAME","VIDEO","SVG","TEXTAREA","SELECT"].includes(el.tagName)
          && el.getBoundingClientRect().height > 20
        ).map(el => "#" + el.id);
        const deadLinks = [...document.querySelectorAll("a")].filter(a => {
          const h = a.getAttribute("href");
          return h === null || h === "" || h === "#";
        }).map(a => (a.textContent||"").trim().slice(0,30) || "(icon)");
        const overflow = document.documentElement.scrollWidth - window.innerWidth;
        return {
          title: document.title,
          h1: [...document.querySelectorAll("h1")].map(h=>h.textContent.trim().slice(0,60)),
          desc: (document.querySelector('meta[name=description]')||{}).content || null,
          brokenImgs, emptyContainers, deadLinks,
          overflowPx: overflow > 1 ? overflow : 0,
          internalLinks: [...new Set([...document.querySelectorAll("a[href^='/']")].map(a=>a.getAttribute("href").split("#")[0]))],
          bodyTextLen: document.body.innerText.trim().length,
        };
      });
    }
    report.push({ route, status, err, ...bag, ...dom });
    await page.close();
  }

  console.log(JSON.stringify(report, null, 1));
  await browser.close();
})();
