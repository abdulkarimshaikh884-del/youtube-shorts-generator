/* ============================================================
   audit_site.js — one honest pass over every page.

   Not a pass/fail suite: it reports what each page actually contains so
   the gaps are visible in one place. Runs signed in, because half the
   product only exists once you have an account.

   Usage: node audit_site.js   [BASE_URL=http://127.0.0.1:3220]
   ============================================================ */
const puppeteer = require("puppeteer");
const db = require("./db");

const BASE = process.env.BASE_URL || "http://localhost:3000";

const ROUTES = [
  ["/", "Home / gallery"],
  ["/pricing", "Plans"],
  ["/community", "Community"],
  ["/template?id=ui-toggle", "Template detail"],
  ["/editor", "Studio editor"],
  ["/drafts", "My Projects"],
  ["/uploads", "Creator Studio"],
  ["/account", "Profile & account"],
  ["/settings", "Settings"],
  ["/creator?handle=shortscraft", "Public creator"],
  ["/admin", "Admin console"],
  ["/tutorials", "Tutorials"],
  ["/contact", "Support / contact"],
  ["/about", "About"],
  ["/privacy", "Privacy"],
  ["/terms", "Terms"],
  ["/login", "Log in"],
  ["/signup", "Sign up"],
  ["/forgot-password", "Forgot password"],
  ["/definitely-not-a-page", "404"]
];

const EMAIL = `audit_${Date.now()}@example.invalid`;

async function cleanup() {
  await db.tx(async (c) => {
    await c.query(
      `delete from public.sessions where user_id in
         (select id from public.users where lower(email) = $1)`, [EMAIL]);
    await c.query(`delete from public.users where lower(email) = $1`, [EMAIL]);
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  const signedIn = await page.evaluate(async (c) => {
    const r = await fetch("/api/auth/signup", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c)
    });
    return (await r.json().catch(() => ({}))).success === true;
  }, { email: EMAIL, password: "audit-pass-1234", handle: "aud" + Date.now().toString().slice(-8) });
  console.log(signedIn ? "signed in as a fresh account\n" : "COULD NOT SIGN IN\n");

  const rows = [];
  for (const [route, label] of ROUTES) {
    const errs = [];
    const onErr = (e) => errs.push("pageerror: " + e.message);
    const onCon = (m) => { if (m.type() === "error") errs.push("console: " + m.text().slice(0, 90)); };
    page.on("pageerror", onErr);
    page.on("console", onCon);

    let status = 0;
    try {
      const res = await page.goto(BASE + route, { waitUntil: "networkidle2", timeout: 45000 });
      status = res ? res.status() : 0;
    } catch (e) { errs.push("nav: " + e.message); }
    await new Promise((r) => setTimeout(r, 1400));

    const info = await page.evaluate(() => {
      const main = document.querySelector("#main, main");
      const txt = (main ? main.innerText : document.body.innerText).replace(/\s+/g, " ").trim();
      const dead = [...document.querySelectorAll('a[href="#"], a:not([href]), a[href=""]')].length;
      const empties = [...document.querySelectorAll("*")].filter((el) => {
        if (el.children.length || el.closest("script,style,head")) return false;
        const t = (el.textContent || "").trim();
        return /coming soon|not available|no data|todo|placeholder|lorem/i.test(t);
      }).map((el) => el.textContent.trim().slice(0, 44));
      const forms = document.querySelectorAll("form").length;
      const buttons = [...document.querySelectorAll("button, .pg-bw, .pg-bo")]
        .filter((b) => b.offsetParent !== null).length;
      return {
        words: txt.split(" ").filter(Boolean).length,
        preview: txt.slice(0, 110),
        deadLinks: dead,
        placeholders: [...new Set(empties)].slice(0, 4),
        forms, buttons,
        overflowX: document.documentElement.scrollWidth - document.documentElement.clientWidth,
        h1: (document.querySelector("h1") || {}).textContent?.trim().slice(0, 46) || "(no h1)"
      };
    });

    page.off("pageerror", onErr);
    page.off("console", onCon);
    rows.push({ route, label, status, errs, ...info });
  }

  console.log("PAGE AUDIT\n" + "=".repeat(100));
  for (const r of rows) {
    const flag = r.status !== 200 && !r.route.includes("not-a-page") ? ` HTTP ${r.status}` : "";
    console.log(`\n${r.label}  —  ${r.route}${flag}`);
    console.log(`   h1: ${r.h1}`);
    console.log(`   words ${r.words} · forms ${r.forms} · buttons ${r.buttons} · dead links ${r.deadLinks} · overflowX ${r.overflowX}`);
    if (r.placeholders.length) console.log(`   PLACEHOLDER TEXT: ${r.placeholders.join(" | ")}`);
    if (r.errs.length) r.errs.slice(0, 3).forEach((e) => console.log(`   ERROR ${e}`));
  }

  await browser.close();
  await cleanup().catch(() => {});
  process.exit(0);
})().catch(async (e) => {
  await cleanup().catch(() => {});
  console.error("AUDIT FAIL:", e.message);
  process.exit(1);
});
