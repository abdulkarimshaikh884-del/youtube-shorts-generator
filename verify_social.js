/* ============================================================
   verify_social.js

   Follow and Stars are the two community features the plan leans on, and
   both were already built — the earlier gap review missed them because it
   grepped for the wrong identifiers. Built is not the same as working, so
   this exercises them end to end against the real API and the real page.

   Server side:
     - follow / unfollow moves the counts on both accounts
     - following twice does not double-count
     - you cannot follow yourself
     - Stars move from sender to receiver and decrement the allowance
     - you cannot send Stars to yourself
     - amounts outside 1-20 are refused, as is more than you hold
     - the idempotency key stops a double-spend on a retry
     - the receiver gets a notification
   Browser side:
     - the buttons exist, are wired, and hide on your own profile

   Usage: node verify_social.js   [BASE_URL=http://localhost:3000]
   ============================================================ */
require("dotenv").config();
const puppeteer = require("puppeteer");
const db = require("./db");

const BASE = process.env.BASE_URL || "http://localhost:3000";
let failures = 0;

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
      for (const line of list) {
        const [pair] = line.split(";");
        const i = pair.indexOf("=");
        const k = pair.slice(0, i).trim(), v = pair.slice(i + 1).trim();
        if (v === "") delete cookies[k]; else cookies[k] = v;
      }
    }
  };
}

async function api(j, url, body, method) {
  const res = await fetch(BASE + url, {
    method: method || (body === undefined ? "GET" : "POST"),
    headers: { "Content-Type": "application/json", ...j.header },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  j.absorb(res);
  let data = null;
  try { data = await res.json(); } catch (e) { data = null; }
  return { status: res.status, data };
}

const stamp = Date.now();
const A = { email: `social_a_${stamp}@example.invalid`, handle: `soca${String(stamp).slice(-7)}`, jar: jar() };
const B = { email: `social_b_${stamp}@example.invalid`, handle: `socb${String(stamp).slice(-7)}`, jar: jar() };
const PASSWORD = "social-verify-1234";

async function cleanup() {
  const emails = [A.email, B.email];
  await db.tx(async (client) => {
    const { rows } = await client.query(
      `select id from public.users where lower(email) = any($1)`, [emails]
    );
    const ids = rows.map((r) => r.id);
    if (ids.length) {
      await client.query(`delete from public.star_transactions where sender_id = any($1) or receiver_id = any($1)`, [ids]);
      await client.query(`delete from public.user_follows where follower_id = any($1) or followed_id = any($1)`, [ids]);
      await client.query(`delete from public.notifications where user_id = any($1) or actor_id = any($1)`, [ids]).catch(() => {});
      await client.query(`delete from public.sessions where user_id = any($1)`, [ids]);
      await client.query(`delete from public.credits where key = any($1)`, [ids.map((i) => "u:" + i)]).catch(() => {});
      await client.query(`delete from public.users where id = any($1)`, [ids]);
    }
  });
}

(async () => {
  console.log("\n---- two real accounts ----");
  for (const who of [A, B]) {
    const r = await api(who.jar, "/api/auth/signup", { email: who.email, password: PASSWORD, handle: who.handle });
    ok(r.status === 200 && r.data.success, `signed up ${who.handle}`, r.status);
    who.id = r.data.user && r.data.user.id;
  }
  ok(!!A.id && !!B.id, "both accounts have ids");

  console.log("\n---- follow ----");
  let r = await api(A.jar, `/api/creators/${encodeURIComponent(B.id)}/follow`, {});
  ok(r.status === 200 && r.data.active === true, "A follows B", `${r.status} active=${r.data && r.data.active}`);
  ok(r.data.followers === 1, "B's follower count is 1", r.data && r.data.followers);

  // A second POST must be idempotent: the plan requires repeated requests
  // not to duplicate the record.
  r = await api(A.jar, `/api/creators/${encodeURIComponent(B.id)}/follow`, {});
  ok(r.data.followers === 1, "following twice still counts once", r.data && r.data.followers);

  r = await api(A.jar, `/api/creators/${encodeURIComponent(A.id)}/follow`, {});
  ok(r.status === 400, "you cannot follow yourself", r.status);

  r = await api(B.jar, "/api/creator?handle=" + encodeURIComponent(A.handle));
  const seenFromB = r.data && r.data.creator;
  ok(seenFromB && seenFromB.followers === 0 && seenFromB.following === 1,
    "the counts read back on the profile", seenFromB && `${seenFromB.followers}/${seenFromB.following}`);

  r = await api(A.jar, `/api/creators/${encodeURIComponent(B.id)}/follow`, undefined, "DELETE");
  ok(r.status === 200 && r.data.active === false && r.data.followers === 0,
    "unfollowing removes it", r.data && `${r.data.active}/${r.data.followers}`);

  console.log("\n---- Stars ----");
  const before = (await api(A.jar, "/api/stars")).data;
  ok(before && before.balance > 0, "a new account has an allowance to give", before && before.balance);

  r = await api(A.jar, "/api/stars/donate", { userId: A.id, amount: 1 });
  ok(r.status === 400, "you cannot send Stars to yourself", r.status);

  r = await api(A.jar, "/api/stars/donate", { userId: B.id, amount: 0 });
  ok(r.status === 400, "zero Stars is refused", r.status);
  r = await api(A.jar, "/api/stars/donate", { userId: B.id, amount: 999 });
  ok(r.status === 400 || r.status === 402, "more than the per-send cap is refused", r.status);

  const key = `verify:${stamp}`;
  r = await api(A.jar, "/api/stars/donate", { userId: B.id, amount: 2, idempotencyKey: key });
  ok(r.status === 200 && r.data.success, "A sends 2 Stars to B", r.status);
  ok(r.data.balance === before.balance - 2, "the sender's allowance goes down", r.data && r.data.balance);

  // Same key again: a retried request must not spend twice.
  r = await api(A.jar, "/api/stars/donate", { userId: B.id, amount: 2, idempotencyKey: key });
  ok(r.status === 200 && r.data.duplicate === true, "the same key does not spend twice",
    r.data && `duplicate=${r.data.duplicate}`);
  ok(r.data.balance === before.balance - 2, "and the balance is unchanged", r.data && r.data.balance);

  const bStars = (await api(B.jar, "/api/stars")).data;
  ok(bStars && bStars.received === 2, "B received exactly 2", bStars && bStars.received);

  const notes = (await api(B.jar, "/api/notifications")).data;
  const list = (notes && (notes.notifications || notes.items)) || [];
  ok(Array.isArray(list) && list.length > 0, "B has a notification about it", list.length);

  console.log("\n---- the buttons on the page ----");
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + "/", { waitUntil: "domcontentloaded" });
  await page.evaluate(async (c) => {
    await fetch("/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: c.email, password: c.password })
    });
  }, { email: A.email, password: PASSWORD });

  await page.goto(`${BASE}/creator?handle=${encodeURIComponent(B.handle)}`, { waitUntil: "networkidle2" });
  // The profile paints from an API call, so wait for the button to be wired
  // rather than for a fixed delay: under load the fixed wait reported a
  // perfectly good button as dead.
  await page.waitForFunction(
    () => { const f = document.querySelector("#creatorFollowBtn"); return !!(f && f.onclick); },
    { timeout: 15000 }
  ).catch(() => {});
  const onOther = await page.evaluate(() => {
    const wrap = document.querySelector("#creatorActions");
    const f = document.querySelector("#creatorFollowBtn");
    const s = document.querySelector("#creatorStarBtn");
    return {
      actionsShown: !!wrap && !wrap.hidden,
      followLabel: f && f.textContent.trim(),
      followWired: !!(f && f.onclick),
      starWired: !!(s && s.onclick),
      promptAvailable: !!(window.SC_UI && window.SC_UI.prompt)
    };
  });
  ok(onOther.actionsShown, "the actions show on someone else's profile");
  ok(onOther.followWired && onOther.starWired, "both buttons are wired",
    `follow=${onOther.followWired} star=${onOther.starWired}`);
  // The Stars button returns early when SC_UI.prompt is missing, which would
  // make it look alive and do nothing at all.
  ok(onOther.promptAvailable, "the Stars dialog helper is loaded on this page");

  /* Wait for the button to actually change rather than for a fixed 1400ms.
     The follow round-trip goes through the connection pooler, which on a
     loaded run takes longer than that - so the old delay reported a working
     button as broken, which is worse than no test at all. */
  await page.evaluate(() => { document.querySelector("#creatorFollowBtn").click(); });
  await page.waitForFunction(
    () => document.querySelector("#creatorFollowBtn").dataset.active === "1",
    { timeout: 15000 }
  ).catch(() => {});
  const clicked = await page.evaluate(() => ({
    label: document.querySelector("#creatorFollowBtn").textContent.trim(),
    followers: document.querySelector("#creatorFollowers").textContent.trim()
  }));
  ok(clicked.label === "Following", "clicking Follow updates the button", clicked.label);
  ok(clicked.followers === "1", "and the follower count on screen", clicked.followers);

  await page.goto(`${BASE}/creator?handle=${encodeURIComponent(A.handle)}`, { waitUntil: "networkidle2" });
  await new Promise((r2) => setTimeout(r2, 1500));
  const onSelf = await page.evaluate(() => {
    const wrap = document.querySelector("#creatorActions");
    return { hidden: !wrap || wrap.hidden };
  });
  ok(onSelf.hidden, "the actions hide on your own profile");

  await browser.close();
  await cleanup().catch((e) => console.error("cleanup:", e.message));
  const left = await db.query(
    `select count(*)::int as n from public.users where lower(email) = any($1)`, [[A.email, B.email]]
  );
  ok(left.rows[0].n === 0, "temporary accounts are removed", left.rows[0].n);

  console.log(`\nSOCIAL=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (e) => {
  await cleanup().catch(() => {});
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
