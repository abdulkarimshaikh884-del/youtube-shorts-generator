/* ============================================================
   verify_projects.js

   The account page has always said "Drafts and settings follow you to any
   device". They did not: a project lived in the localStorage of whichever
   browser made it, so signing in somewhere else showed an empty list. The
   master plan (§11) asks for account-side projects; this checks that they
   actually cross devices, and that one account cannot reach another's.

   "Another device" is simulated with a second, independent browser context
   — separate storage, same account. That is exactly the case that was
   broken, so it is the case worth testing.

   Usage: node verify_projects.js   [BASE_URL=http://localhost:3000]
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

const stamp = Date.now();
const OWNER = { email: `proj_a_${stamp}@example.invalid`, handle: `pra${String(stamp).slice(-7)}` };
const OTHER = { email: `proj_b_${stamp}@example.invalid`, handle: `prb${String(stamp).slice(-7)}` };
const PASSWORD = "projects-verify-1234";

async function cleanup() {
  await db.tx(async (client) => {
    const { rows } = await client.query(
      `select id from public.users where lower(email) = any($1)`, [[OWNER.email, OTHER.email]]
    );
    const ids = rows.map((r) => r.id);
    if (!ids.length) return;
    await client.query(`delete from public.projects where user_id = any($1)`, [ids]);
    await client.query(`delete from public.sessions where user_id = any($1)`, [ids]);
    await client.query(`delete from public.credits where key = any($1)`, [ids.map((i) => "u:" + i)]).catch(() => {});
    await client.query(`delete from public.users where id = any($1)`, [ids]);
  });
}

// One browser context is one device: its own cookie jar and its own storage.
async function device(browser, creds, signUp) {
  const ctx = await browser.createBrowserContext();
  const page = await ctx.newPage();
  await page.setViewport({ width: 1280, height: 900 });
  await page.goto(BASE + "/drafts", { waitUntil: "networkidle2" });
  const authed = await page.evaluate(async (c) => {
    const r = await fetch(c.signUp ? "/api/auth/signup" : "/api/auth/login", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(c.signUp
        ? { email: c.email, password: c.password, handle: c.handle }
        : { email: c.email, password: c.password })
    });
    const j = await r.json().catch(() => ({}));
    return j && j.success === true;
  }, { ...creds, password: PASSWORD, signUp });
  return { ctx, page, authed };
}

const CLIPS = [{ tpl: "ui-toggle", dur: 4600, props: { line1: "Made on device one" } }];

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });

  console.log("\n---- device one makes a project ----");
  const one = await device(browser, OWNER, true);
  ok(one.authed, "signed up on the first device");

  const saved = await one.page.evaluate(async (clips) => {
    const r = await fetch("/api/projects/d_crossdevice_test", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "Cross device project", aspect: "9:16", clips })
    });
    return { status: r.status, body: await r.json().catch(() => ({})) };
  }, CLIPS);
  ok(saved.status === 200 && saved.body.success, "the project saves to the account", saved.status);
  ok(saved.body.project && saved.body.project.name === "Cross device project",
    "and comes back with its name", saved.body.project && saved.body.project.name);

  console.log("\n---- a second device sees it ----");
  const two = await device(browser, OWNER, false);
  ok(two.authed, "signed in on a second, separate browser");

  const freshStorage = await two.page.evaluate(() => {
    let n = 0;
    for (let i = 0; i < localStorage.length; i++) {
      if (String(localStorage.key(i)).startsWith("sc_drafts_v2_")) n++;
    }
    return n;
  });
  ok(freshStorage === 0, "the second device starts with no local drafts", freshStorage);

  const pulled = await two.page.evaluate(async () => {
    const r = await fetch("/api/projects");
    const j = await r.json();
    return (j.projects || []).map((p) => p.name);
  });
  ok(pulled.includes("Cross device project"),
    "the project made on device one is there", pulled.join(", ") || "(none)");

  // And through the store the pages actually use, not just the raw API.
  await two.page.goto(BASE + "/drafts", { waitUntil: "networkidle2" });
  await new Promise((r) => setTimeout(r, 2500));
  const throughStore = await two.page.evaluate(() =>
    (window.SC_DRAFTS ? SC_DRAFTS.list() : []).map((d) => d.name));
  ok(throughStore.includes("Cross device project"),
    "and the drafts page lists it", throughStore.join(", ") || "(none)");

  console.log("\n---- edits travel back ----");
  await two.page.evaluate(async () => {
    await fetch("/api/projects/d_crossdevice_test", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: "Renamed on device two", aspect: "9:16",
        clips: [{ tpl: "ui-toggle", dur: 4600, props: { line1: "edited" } }]
      })
    });
  });
  const backOnOne = await one.page.evaluate(async () => {
    const r = await fetch("/api/projects");
    const j = await r.json();
    return (j.projects || []).map((p) => p.name);
  });
  ok(backOnOne.includes("Renamed on device two"),
    "device one sees the rename", backOnOne.join(", "));

  console.log("\n---- one account cannot reach another's ----");
  const intruder = await device(browser, OTHER, true);
  ok(intruder.authed, "a second account exists");

  const reach = await intruder.page.evaluate(async () => {
    const list = await (await fetch("/api/projects")).json();
    const put = await fetch("/api/projects/d_crossdevice_test", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "stolen", aspect: "9:16", clips: [{ tpl: "ui-toggle", dur: 1000 }] })
    });
    const del = await fetch("/api/projects/d_crossdevice_test", { method: "DELETE" });
    return { count: (list.projects || []).length, put: put.status, del: del.status };
  });
  ok(reach.count === 0, "their list is empty", reach.count);
  ok(reach.put === 403, "they cannot overwrite someone else's project", reach.put);
  ok(reach.del === 404, "and cannot delete it", reach.del);

  const stillMine = await one.page.evaluate(async () => {
    const j = await (await fetch("/api/projects")).json();
    return (j.projects || []).map((p) => p.name);
  });
  ok(stillMine.includes("Renamed on device two"), "the owner's project is untouched", stillMine.join(", "));

  console.log("\n---- guests and validation ----");
  const guestCtx = await browser.createBrowserContext();
  const guest = await guestCtx.newPage();
  await guest.goto(BASE + "/drafts", { waitUntil: "networkidle2" });
  const guestTry = await guest.evaluate(async () => {
    const r = await fetch("/api/projects");
    return r.status;
  });
  ok(guestTry === 401, "a guest gets no project list", guestTry);

  const bad = await one.page.evaluate(async () => {
    const empty = await fetch("/api/projects/d_empty_clips", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x", clips: [] })
    });
    const junk = await fetch("/api/projects/../../etc/passwd", {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: "x", clips: [{ tpl: "ui-toggle", dur: 1000 }] })
    });
    return { empty: empty.status, junk: junk.status };
  });
  ok(bad.empty === 400, "a project with no clips is refused", bad.empty);
  ok(bad.junk >= 400, "a path-shaped id is refused", bad.junk);

  console.log("\n---- deleting ----");
  const gone = await one.page.evaluate(async () => {
    const del = await fetch("/api/projects/d_crossdevice_test", { method: "DELETE" });
    const after = await (await fetch("/api/projects")).json();
    return { status: del.status, left: (after.projects || []).length };
  });
  ok(gone.status === 200 && gone.left === 0, "the owner can delete it",
    `${gone.status}/${gone.left} left`);

  await browser.close();
  await cleanup().catch((e) => console.error("cleanup:", e.message));
  const left = await db.query(
    `select count(*)::int as n from public.users where lower(email) = any($1)`,
    [[OWNER.email, OTHER.email]]
  );
  ok(left.rows[0].n === 0, "temporary accounts are removed", left.rows[0].n);

  console.log(`\nPROJECTS=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch(async (e) => {
  await cleanup().catch(() => {});
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
