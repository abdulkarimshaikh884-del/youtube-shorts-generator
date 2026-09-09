/* ============================================================
   verify_auth.js
   Log in / Sign up have to actually work, and safely.

   Server side:
     - signup creates an account and a session; /api/auth/me confirms it
     - the password is never stored in plaintext and never returned
     - duplicate email is refused; weak / short passwords refused; bad email refused
     - login with the right password works, wrong password fails 401
     - login errors do not reveal whether an address exists (no enumeration)
     - the session cookie is HttpOnly + SameSite, and the stored token is hashed
     - logout kills the session, and the old cookie stops working
     - credits follow the ACCOUNT once signed in, not the browser cookie
     - the Pro / Pro Max model tiers are refused on a Free plan (403)
   Browser side:
     - /login and /signup render in the new shell and post to the API
     - the top bar swaps Log in/Sign up for Account/Log out when signed in
     - /account shows the email, plan and credits; logging out returns to guest

   Usage: node verify_auth.js   [BASE_URL=http://localhost:3000]
   ============================================================ */
const fs = require("fs");

/* Read the grant from credits.js so a plan change does not make this stale. */
const FREE_PER_DAY = require("./credits").PLANS.free.perDay;
const path = require("path");
const puppeteer = require("puppeteer");

const BASE = process.env.BASE_URL || "http://localhost:3000";
let failures = 0;
const wait = (n) => new Promise((r) => setTimeout(r, n));

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

function jar() {
  let cookies = {};
  return {
    get header() {
      const s = Object.entries(cookies).map(([k, v]) => `${k}=${v}`).join("; ");
      return s ? { Cookie: s } : {};
    },
    absorb(res) {
      const raw = res.headers.getSetCookie ? res.headers.getSetCookie() : [];
      const list = raw.length ? raw : (res.headers.get("set-cookie") ? [res.headers.get("set-cookie")] : []);
      this.lastSetCookie = list;
      for (const line of list) {
        const [pair] = line.split(";");
        const i = pair.indexOf("=");
        const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
        if (v === "") delete cookies[k]; else cookies[k] = v;
      }
    },
    get(k) { return cookies[k]; },
    clear() { cookies = {}; }
  };
}

async function api(j, url, body, method = "POST") {
  const res = await fetch(BASE + url, {
    method: body === undefined ? "GET" : method,
    headers: { "Content-Type": "application/json", ...j.header },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  j.absorb(res);
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data, res };
}

const uniq = () => "t" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

(async () => {
  const email = `${uniq()}@example.com`;
  const password = "correct-horse-battery";
  const j = jar();

  console.log("\n---- signup ----");
  let r = await api(j, "/api/auth/signup", { email, password });
  ok(r.status === 200 && r.data.success, "signup succeeds", r.status);
  ok(r.data.user && r.data.user.email === email.toLowerCase(), "returns the account", r.data.user && r.data.user.email);
  ok(r.data.user && r.data.user.plan === "free", "new accounts start on Free", r.data.user && r.data.user.plan);
  ok(!JSON.stringify(r.data).includes(password), "the password is not echoed back");
  const sid = j.get("sc_sid");
  ok(!!sid, "a session cookie is set", sid && sid.slice(0, 8) + "…");
  const cookieLine = (j.lastSetCookie || []).find((c) => c.startsWith("sc_sid=")) || "";
  ok(/HttpOnly/i.test(cookieLine), "session cookie is HttpOnly");
  ok(/SameSite=Lax/i.test(cookieLine), "session cookie is SameSite=Lax");

  console.log("\n---- the store ----");
  // Accounts live in Postgres now, not .users.json — read the row back out to
  // prove what was actually written.
  require("dotenv").config();
  const db = require("./db");
  const { rows: userRows } = await db.query(
    `select * from public.users where lower(email) = $1`, [email.toLowerCase()]
  );
  const rec = userRows[0];
  ok(!!rec, "the account is persisted");
  ok(rec && !JSON.stringify(rec).includes(password), "no plaintext password in the store");
  ok(rec && /^scrypt\$/.test(rec.password_hash), "password is an scrypt hash",
    rec && rec.password_hash.slice(0, 14));
  const { rows: sessRows } = await db.query(
    `select token_hash from public.sessions where user_id = $1`, [rec.id]
  );
  const hashes = sessRows.map((s) => s.token_hash);
  ok(!hashes.includes(sid), "the raw session token is NOT in the store (hashed)");
  ok(hashes.length >= 1, "a hashed session row exists", hashes.length);

  console.log("\n---- me / credits follow the account ----");
  r = await api(j, "/api/auth/me");
  ok(r.status === 200 && r.data.user && r.data.user.email === email.toLowerCase(),
    "/api/auth/me knows who I am", r.data.user && r.data.user.email);
  r = await api(j, "/api/credits");
  ok(r.data.signedIn === true && r.data.email === email.toLowerCase(),
    "credits are billed to the account", `${r.data.signedIn}/${r.data.email}`);
  ok(r.data.left === FREE_PER_DAY && r.data.plan === "free", "with the Free grant", r.data.left);

  console.log("\n---- signup validation ----");
  /* The field rules are checked in-process against auth.signUp so this suite
     does not spend the signup rate-limit budget (which is a real protection and
     should stay tight) on four negative cases. */
  const authMod = require("./auth");
  const fakeRes = () => ({ headers: {}, getHeader() { return undefined; }, setHeader() {} });
  const local = [
    ["a short password", uniq() + "@example.com", "short1", /8 characters/i],
    ["a malformed email", "not-an-email", password, /email/i],
    ["a missing password", uniq() + "@example.com", undefined, /8 characters/i],
    ["a password of only spaces", uniq() + "@example.com", "         ", /space|8 characters/i]
  ];
  for (const [label, em, pw, expect] of local) {
    const out = await authMod.signUp(fakeRes(), em, pw);
    ok(!!out.error && expect.test(out.error), "refuses " + label,
      (out.error || "(accepted!)").slice(0, 48));
  }
  // the duplicate check needs the real store, so that one goes over HTTP
  r = await api(jar(), "/api/auth/signup", { email, password: "another-password-1" });
  ok(r.status === 400 && /already/i.test(r.data.error || ""), "refuses a duplicate email",
    `${r.status} ${(r.data && r.data.error || "").slice(0, 42)}`);

  console.log("\n---- login ----");
  const j2 = jar();
  r = await api(j2, "/api/auth/login", { email, password: "wrong-password-here" });
  const wrongMsg = r.data && r.data.error;
  ok(r.status === 401, "a wrong password is refused", r.status);
  ok(!j2.get("sc_sid"), "and no session is issued");

  const j3 = jar();
  r = await api(j3, "/api/auth/login", { email: uniq() + "@example.com", password: "whatever-123" });
  ok(r.status === 401 && r.data.error === wrongMsg,
    "an unknown email gives the SAME message (no user enumeration)", r.data && r.data.error);

  const j4 = jar();
  r = await api(j4, "/api/auth/login", { email: email.toUpperCase(), password });
  ok(r.status === 200 && r.data.success, "login works, and the email is case-insensitive", r.status);
  ok(!!j4.get("sc_sid"), "login issues a session");

  console.log("\n---- logout ----");
  const staleSid = j4.get("sc_sid");
  r = await api(j4, "/api/auth/logout", {});
  ok(r.status === 200, "logout responds", r.status);
  r = await api(j4, "/api/auth/me");
  ok(r.data.user === null, "the session is gone", JSON.stringify(r.data.user));

  // replay the old cookie by hand: the server must not accept it
  const replay = await fetch(BASE + "/api/auth/me", { headers: { Cookie: "sc_sid=" + staleSid } });
  const replayed = await replay.json();
  ok(replayed.user === null, "the old cookie cannot be replayed after logout",
    JSON.stringify(replayed.user));

  console.log("\n---- model tiers are gated by plan ----");
  for (const [tier, label] of [["pro", "Pro"], ["max", "Pro Max"]]) {
    const rr = await api(j, "/api/animate", {
      prompt: "a glass card that flips to reveal a price", quality: tier
    });
    if (rr.status === 503) {
      ok(true, `SKIP ${label} tier gate (no GROQ_API_KEY, config checked first)`, rr.status);
    } else {
      // What matters is that the refusal names the upgrade that lifts it, not
      // which noun it uses. Asserting the literal word "plan" made this fail
      // the moment the copy moved to "requires a Pro or Pro Max subscription",
      // reporting a correct 403 as a product bug.
      ok(rr.status === 403 && /pro max|pro\b/i.test(rr.data.error || ""),
        `the ${label} model is refused on a Free plan`,
        `${rr.status} ${(rr.data && rr.data.error || "").slice(0, 56)}`);
    }
  }
  const rr = await api(j, "/api/animate", { prompt: "a toggle switch flipping on", quality: "mini" });
  ok(rr.status !== 403, "the Free model is allowed on a Free plan", rr.status);

  /* ── browser ───────────────────────────────────────────── */
  console.log("\n---- pages ----");
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => {
    const t = m.text();
    if (m.type() === "error" && !/google-analytics|gtag|favicon|503/.test(t)) errs.push("console: " + t);
  });
  await page.setViewport({ width: 1280, height: 900 });

  // The headings are marketing copy and get rewritten; what has to hold is
  // that each route renders its own real heading, so this asserts a
  // non-trivial h1 rather than pinning one wording.
  for (const [route] of [["/login"], ["/signup"]]) {
    const res = await page.goto(BASE + route, { waitUntil: "networkidle2" });
    await wait(500);
    const info = await page.evaluate(() => ({
      h1: (document.querySelector("h1") || {}).textContent || "",
      sheets: [...document.querySelectorAll('link[rel="stylesheet"]')]
        .map((l) => l.getAttribute("href")).filter((h) => !/^https:\/\/fonts/.test(h)),
      email: !!document.querySelector("#authEmail"),
      pass: (document.querySelector("#authPassword") || {}).type,
      robots: (document.querySelector('meta[name="robots"]') || {}).content || "",
      rail: !!document.querySelector('.sh-rail'),
      topbar: !!document.querySelector('.sh-topbar'),
      footer: !!document.querySelector('.sh-footer'),
      wordmark: !!document.querySelector('.pg-wordmark'),
      hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    }));
    ok(res.status() === 200 && info.h1.trim().length > 3, `${route} renders`, info.h1);
    ok(!info.sheets.some((s) => /(styles|premium|landing|seo-tools|studio)\.css/.test(s)),
      `${route} uses the new stack only`, info.sheets.join(" "));
    ok(info.email && info.pass === "password", `${route} has email + masked password`);
    ok(/noindex/.test(info.robots), `${route} is noindex`, info.robots);
    // the user asked for the form alone: no sidebar, no top bar, no footer
    ok(!info.rail && !info.topbar && !info.footer, `${route} shows no workspace chrome`,
      `rail=${info.rail} topbar=${info.topbar} footer=${info.footer}`);
    ok(info.wordmark, `${route} keeps the wordmark as the way back`);
    ok(!info.hOverflow, `${route} has no horizontal overflow`);
  }

  console.log("\n---- signing up in the browser ----");
  const email2 = `${uniq()}@example.com`;
  await page.goto(BASE + "/signup", { waitUntil: "networkidle2" });
  await wait(400);
  // client-side validation first
  await page.evaluate(() => {
    document.querySelector("#authEmail").value = "nope";
    document.querySelector("#authPassword").value = "abcdefgh";
    document.querySelector("#authForm").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  });
  await wait(300);
  let note = await page.evaluate(() => document.querySelector("#authNote").textContent);
  ok(/email/i.test(note), "a bad email is caught before the request", note);

  // Signup now asks for a unique handle as well. Client-side validation
  // rejects the form before it ever reaches the API when that field is
  // blank, so leaving it empty made this look like a broken redirect.
  await page.evaluate((e, p, h) => {
    document.querySelector("#authEmail").value = e;
    document.querySelector("#authPassword").value = p;
    const handle = document.querySelector("#authHandle");
    if (handle) handle.value = h;
    document.querySelector("#authForm").dispatchEvent(new Event("submit", { cancelable: true, bubbles: true }));
  }, email2, password, email2.split("@")[0].toLowerCase());
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {});
  await wait(800);
  ok(page.url() === BASE + "/" || page.url() === BASE, "signing up lands on the home page", page.url().replace(BASE, ""));

  console.log("\n---- the chrome knows I am signed in ----");
  await page.goto(BASE + "/pricing", { waitUntil: "networkidle2" });
  // The chrome paints signed-in state only after /api/auth/me answers. A
  // fixed delay races that call whenever the database is slow, so wait for
  // the guest links to actually disappear instead of assuming they have.
  await page.waitForFunction(
    () => !document.querySelector('a[href="/login"][data-auth="out"]:not([hidden])'),
    { timeout: 15000 }
  ).catch(() => {});
  const chrome = await page.evaluate(() => {
    const vis = (s) => [...document.querySelectorAll(s)]
      .filter((el) => !el.hasAttribute("hidden") && el.offsetParent !== null).length;
    return {
      loginLinks: vis('a[href="/login"]'),
      signupLinks: vis('a[href="/signup"]'),
      accountLinks: vis('a[href="/account"]'),
      logout: vis("#logoutBtn"),
      email: (document.querySelector("[data-auth-email]") || {}).textContent || "",
      badge: (document.querySelector(".sh-plan-badge span") || {}).textContent || ""
    };
  });
  ok(chrome.loginLinks === 0 && chrome.signupLinks === 0,
    "Log in / Sign up are hidden when signed in", `${chrome.loginLinks}/${chrome.signupLinks}`);
  ok(chrome.accountLinks >= 1 && chrome.logout >= 1, "Account + Log out are shown",
    `${chrome.accountLinks}/${chrome.logout}`);
  ok(chrome.email === email2.split("@")[0], "the sidebar shows who I am", chrome.email);
  ok(/credits left today/.test(chrome.badge), "the sidebar shows my credits", chrome.badge);

  console.log("\n---- /account ----");
  await page.goto(BASE + "/account", { waitUntil: "networkidle2" });
  // The page paints from /api/auth/me + /api/credits + /api/user/creations, and
  // the database is a region away — wait for the panel rather than a fixed
  // delay that only held while storage was a local file.
  await page.waitForFunction(
    () => !document.querySelector("#accountBox").hasAttribute("hidden"),
    { timeout: 15000 }
  ).catch(() => {});
  const acc = await page.evaluate(() => ({
    boxShown: !document.querySelector("#accountBox").hasAttribute("hidden"),
    guestShown: !document.querySelector("#accountGuest").hasAttribute("hidden"),
    email: document.querySelector("#accEmail").textContent,
    plan: document.querySelector("#accPlan").textContent,
    credits: document.querySelector("#accCredits").textContent
  }));
  ok(acc.boxShown && !acc.guestShown, "the account panel is shown, not the guest panel");
  ok(acc.email === email2.toLowerCase(), "it shows my email", acc.email);
  ok(acc.plan === "Free", "it shows my plan", acc.plan);
  ok(new RegExp("of " + FREE_PER_DAY + " left today").test(acc.credits), "it shows my credits", acc.credits);

  console.log("\n---- account profile editor ----");
  const profileBefore = await page.evaluate(() => ({
    modal: !!document.querySelector("#editProfileModal"),
    editHidden: document.querySelector("#igPaneEdit").hasAttribute("hidden"),
    active: document.querySelector('.ig-tab-btn[aria-selected="true"]')?.dataset.igTab || ""
  }));
  ok(!profileBefore.modal, "the account page does not create a duplicate edit-profile modal");
  ok(profileBefore.editHidden && profileBefore.active === "creations", "the account starts on Posts", profileBefore.active);

  await page.click("#openEditProfileBtn");
  await wait(450);
  const profileAfter = await page.evaluate(() => ({
    modal: !!document.querySelector("#editProfileModal"),
    editShown: !document.querySelector("#igPaneEdit").hasAttribute("hidden") && document.querySelector("#igPaneEdit").offsetParent !== null,
    active: document.querySelector('.ig-tab-btn[aria-selected="true"]')?.dataset.igTab || "",
    hash: location.hash,
    controls: document.querySelector("#igTabEdit").getAttribute("aria-controls")
  }));
  ok(!profileAfter.modal && profileAfter.editShown, "Edit profile opens the inline editor without a popup");
  ok(profileAfter.active === "edit" && profileAfter.hash === "#edit-profile", "the Edit tab and URL state stay in sync", `${profileAfter.active}/${profileAfter.hash}`);
  ok(profileAfter.controls === "igPaneEdit", "profile tabs expose their controlled panels", profileAfter.controls);

  await page.evaluate(() => { document.querySelector("#pageDisplayName").value = "Unsaved change"; });
  await page.click("#pageCancelProfileBtn");
  await wait(350);
  const cancelled = await page.evaluate(() => ({
    value: document.querySelector("#pageDisplayName").value,
    active: document.querySelector('.ig-tab-btn[aria-selected="true"]')?.dataset.igTab || "",
    hash: location.hash
  }));
  ok(cancelled.value !== "Unsaved change", "Cancel restores the saved profile values");
  ok(cancelled.active === "creations" && cancelled.hash === "", "Cancel returns to Posts", `${cancelled.active}/${cancelled.hash}`);

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.reload({ waitUntil: "networkidle2" });
  await page.waitForFunction(
    () => !document.querySelector("#accountBox").hasAttribute("hidden"),
    { timeout: 15000 }
  ).catch(() => {});
  const mobileAccount = await page.evaluate(() => {
    const actionButtons = [...document.querySelectorAll(".ig-actions-row .ig-btn")];
    const tabs = document.querySelector(".ig-tabs");
    const reachable = (sel) => {
      const el = document.querySelector(sel);
      return !!el && !el.hasAttribute("hidden");
    };
    return {
      overflow: document.documentElement.scrollWidth > window.innerWidth + 1,
      actionCount: actionButtons.length,
      // The header used to carry a third button that logged you out. Log out
      // now lives in the top bar and under Plan and credits, so this checks
      // that whatever the header does carry is usable, and separately that
      // signing out is still reachable — rather than pinning a count.
      buttonsVisible: actionButtons.length >= 2 && actionButtons.every((button) => {
        const box = button.getBoundingClientRect();
        return box.width >= 80 && box.height >= 44 && box.left >= 0 && box.right <= window.innerWidth;
      }),
      logoutReachable: reachable("#logoutBtn") || reachable("#accLogoutPane"),
      tabsContained: tabs.scrollWidth >= tabs.clientWidth && tabs.getBoundingClientRect().right <= window.innerWidth
    };
  });
  ok(!mobileAccount.overflow, "the mobile account page has no horizontal page overflow");
  ok(mobileAccount.buttonsVisible, "all profile actions remain visible and touch-friendly on mobile",
    mobileAccount.actionCount + " actions");
  ok(mobileAccount.logoutReachable, "signing out is reachable from the account page");
  ok(mobileAccount.tabsContained, "profile tabs stay accessible inside their own mobile scroller");

  console.log("\n---- logging out in the browser ----");
  await page.setViewport({ width: 1280, height: 900 });
  await page.waitForFunction(
    () => document.querySelector("#accountBox") && !document.querySelector("#accountBox").hasAttribute("hidden"),
    { timeout: 15000 }
  ).catch(() => {});
  // The account header no longer carries its own log-out button; the top bar
  // is the one control present on every page.
  await page.click("#logoutBtn");
  await page.waitForNavigation({ waitUntil: "networkidle2", timeout: 20000 }).catch(() => {});
  await wait(900);
  const after = await page.evaluate(() => {
    const vis = (s) => [...document.querySelectorAll(s)]
      .filter((el) => !el.hasAttribute("hidden") && el.offsetParent !== null).length;
    return { login: vis('a[href="/login"]'), logout: vis("#logoutBtn") };
  });
  ok(after.login >= 1 && after.logout === 0, "the chrome returns to the guest state",
    `${after.login}/${after.logout}`);

  console.log("\n---- errors ----");
  ok(errs.length === 0, "no console or page errors", errs.length ? errs[0] : 0);

  await browser.close();

  /* Verifiers must not become fake production users. Remove only the two
     unique addresses generated by this run, including their sessions. */
  const testEmails = [email.toLowerCase(), email2.toLowerCase()];
  await db.tx(async (client) => {
    await client.query(
      `delete from public.sessions
        where user_id in (select id from public.users where lower(email) = any($1::text[]))`,
      [testEmails]
    );
    await client.query(
      `delete from public.users where lower(email) = any($1::text[])`,
      [testEmails]
    );
  });
  await db.getPool().end();
  ok(true, "temporary auth test accounts are removed");

  console.log(`\nAUTH=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
