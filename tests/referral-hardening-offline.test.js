"use strict";
// Actual referral/OAuth modules with narrow fixtures; no .env, DB, provider or
// production config. Covers rollout compatibility and worker/callback wiring.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const env = { REFERRALS_ENABLED: "false", CREDITS_SECRET: "offline-hardening-secret", GOOGLE_CLIENT_ID: "offline-google-id", GOOGLE_CLIENT_SECRET: "offline-google-secret" };
let intervalMs = null, unrefCount = 0, cleared = 0;
function load(file, deps) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), {
    module, exports: module.exports, Buffer, URL, URLSearchParams, AbortSignal,
    process: { env }, console: { warn() {}, error() {} },
    setInterval(fn, ms) { intervalMs = ms; return { unref() { unrefCount++; } }; },
    clearInterval() { cleared++; },
    require: n => Object.hasOwn(deps, n) ? deps[n] : require(n)
  }, { filename: file });
  return module.exports;
}
let queries = [];
const missing = Object.assign(new Error("Fixture has no new referral schema"), { code: "42P01" });
const absentDB = { query: async sql => { queries.push(sql); throw missing; }, tx: async fn => fn(absentDB) };
const deps = db => ({ "./db": db, "./credits": {}, "./notify": {}, "./email-events": {} });
async function run() {
  const paused = load("referrals.js", deps(absentDB));
  assert.equal((await paused.reconcile()).enabled, false); paused.start();
  assert.equal(queries.length, 0); assert.equal(intervalMs, null);
  assert.equal((await paused.summary(null)).enabled, false);
  const own = { id: "11111111-1111-4111-8111-111111111111", role: "user" };
  assert.equal((await paused.summary(own)).available, false, "legacy-schema disabled summary is unavailable, not fabricated");
  assert.equal((await paused.history(own)).available, false, "paused pre-migration history degrades honestly");
  env.REFERRALS_ENABLED = "true";
  await assert.rejects(paused.summary(own), e => e.code === "42P01", "enabled schema absence fails closed for API handler");
  await assert.rejects(paused.createVerification(own), e => e.code === "42P01", "cooldown is enforced by default, not silently bypassed on missing schema");
  console.log("PASS offline rollout: disabled zero-work, old-schema safe fallback, enabled cooldown/schema fail closed.");

  let releases = [], selections = 0;
  const workerDB = { query: async sql => { queries.push(sql); return { rows: [] }; }, tx: async fn => fn({ query: async (sql, params = []) => {
    if (sql.includes("pg_try_advisory_xact_lock")) return { rows: [{ acquired: true }] };
    if (sql.startsWith("select r.invitee_id")) { selections++; queries.push({ sql, params }); await new Promise(resolve => releases.push(resolve)); }
    return { rows: [] };
  } }) };
  const worker = load("referrals.js", deps(workerDB));
  const a = worker.reconcile({ limit: 999 }), b = worker.reconcile({ limit: 2 });
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(selections, 1, "overlapping process sweeps share one bounded claim"); releases.shift()(); await a; await b;
  assert.equal(queries.find(q => typeof q === "object").params[0], 20);
  worker.start(); await new Promise(resolve => setImmediate(resolve));
  assert.equal(intervalMs, 30000); assert.equal(unrefCount, 1);
  releases.shift()(); await worker.reconcile(); worker.stop(); assert.equal(cleared, 1);
  console.log("PASS offline worker: max20 claim, shared in-process sweep,30s unref timer and stop.");

  const routes = {}, attempts = [], linked = { ...own, google_sub: "fixture-verified-google" };
  const oauth = load("google-auth.js", { "./auth-email": { rememberBrowser: async () => {} } });
  oauth.register({ get(url, ...handlers) { routes[url] = handlers.at(-1); } }, {
    rateLimit: () => () => {}, publicSiteUrl: () => "https://example.test",
    auth: { googleAccount: async () => ({ user: linked, linkedNow: true }) },
    referrals: { readCode: () => null, retryForUser: async (u, options) => { attempts.push([u, options]); throw Error("Fixture reward outage"); } },
    fetchImpl: async url => ({ ok: true, json: async () => url.endsWith("/token") ? { access_token: "mock-token" } : { sub: linked.google_sub, email_verified: true } })
  });
  const response = () => ({ cookies: [], set() { return this; }, append(_, v) { this.cookies.push(v); }, redirect(url) { this.url = url; } });
  const start = response(); routes["/api/auth/google"]({ user: own, query: { next: "/account#referrals" } }, start);
  const state = new URL(start.url).searchParams.get("state"), done = response();
  await routes["/api/auth/google/callback"]({ user: own, query: { state, code: "mock-code" }, headers: { cookie: start.cookies[0].split(";")[0] } }, done);
  assert.equal(done.url, "/account#referrals"); assert.equal(attempts.length, 1);
  assert.equal(attempts[0][0].id, own.id); assert.equal(attempts[0][1].force, true);
  console.log("PASS offline Google link: verified linked account forces recheck; reward outage cannot fail successful sign-in.");
}
run().catch(error => { console.error(error); process.exitCode = 1; });
