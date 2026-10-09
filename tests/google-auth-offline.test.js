"use strict";
// No real Google calls, database writes, dotenv or live accounts.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const { register, safeNext, pack, unpack } = require("../google-auth");

async function run() {
  for (const next of ["//evil.test", "/\\evil", "https://evil.test", "/\nevil"]) assert.equal(safeNext(next), "/");
  assert.equal(safeNext("/editor?tpl=one#two"), "/editor?tpl=one#two");
  const value = pack({ expires: Date.now() + 5000, next: "/settings" }, "secret");
  assert.equal(unpack(value, "secret").next, "/settings");
  assert.equal(unpack(value + "x", "secret"), null);
  assert.equal(unpack(value, "wrong"), null);
  assert.equal(unpack(pack({ expires: 1 }, "secret"), "secret"), null);

  process.env.GOOGLE_CLIENT_ID = "offline-client";
  process.env.GOOGLE_CLIENT_SECRET = "offline-secret";
  const routes = {};
  let fetchCount = 0, accountCount = 0;
  register({ get(path, ...handlers) { routes[path] = handlers.at(-1); } }, {
    rateLimit: () => () => {}, publicSiteUrl: () => "https://example.test",
    auth: { async googleAccount(res, info) { accountCount++; assert.equal(info.sub, "123"); return { user: {} }; } },
    async fetchImpl(url, options) {
      fetchCount++;
      if (url.endsWith("/token")) { assert.ok(options.body.get("code_verifier")); return { ok: true, json: async () => ({ access_token: "offline-token" }) }; }
      assert.equal(options.headers.Authorization, "Bearer offline-token");
      return { ok: true, json: async () => ({ sub: "123", email_verified: true }) };
    }
  });
  function response() { return { cookies: [], set() { return this; }, append(k, v) { this.cookies.push(v); }, redirect(url) { this.url = url; }, json(data) { this.data = data; } }; }
  const start = response();
  routes["/api/auth/google"]({ query: { next: "/editor" } }, start);
  const state = new URL(start.url).searchParams.get("state");
  assert.equal(new URL(start.url).hostname, "accounts.google.com");
  assert.match(start.cookies[0], /HttpOnly; SameSite=Lax/);
  const headers = { cookie: start.cookies[0].split(";")[0] };
  const bad = response();
  await routes["/api/auth/google/callback"]({ headers, query: { state: "bad", code: "code" } }, bad);
  assert.match(bad.url, /expired/); assert.equal(fetchCount, 0);
  const changed = response();
  await routes["/api/auth/google/callback"]({ headers, user: { id: "other" }, query: { state, code: "code" } }, changed);
  assert.match(changed.url, /expired/); assert.equal(fetchCount, 0);
  const cancelled = response();
  await routes["/api/auth/google/callback"]({ headers, query: { state, error: "access_denied" } }, cancelled);
  assert.match(cancelled.url, /cancelled/); assert.equal(fetchCount, 0);
  const done = response();
  await routes["/api/auth/google/callback"]({ headers, query: { state, code: "code" } }, done);
  assert.equal(done.url, "/editor"); assert.equal(accountCount, 1);
  delete process.env.GOOGLE_CLIENT_SECRET;
  const unavailable = response(); routes["/api/auth/google"]({ query: {} }, unavailable);
  assert.match(unavailable.url, /unavailable/);

  let users = [], sessions = 0;
  const query = async (sql, p) => {
    if (sql.includes("pg_advisory")) return { rows: [] };
    if (sql.includes("where google_sub")) return { rows: users.filter(u => u.google_sub === p[0]) };
    if (sql.includes("where lower(email)")) return { rows: users.filter(u => u.email === p[0]) };
    if (sql.includes("where id = $1 for update")) return { rows: users.filter(u => u.id === p[0]) };
    if (sql.startsWith("update public.users")) { const row = users.find(u => u.id === p[0]); row.google_sub = p[1]; return { rows: [row] }; }
    if (sql.startsWith("insert into public.users")) { const row = { id: "new", email: p[0], password_hash: p[1], plan: "free", handle: p[2], google_sub: p[4] }; users.push(row); return { rows: [row] }; }
    if (sql.startsWith("delete from public.sessions")) return { rows: [] };
    if (sql.startsWith("insert into public.sessions")) { sessions++; return { rows: [] }; }
    throw new Error("Unexpected SQL: " + sql);
  };
  const moduleMock = { exports: {} };
  vm.runInNewContext(fs.readFileSync(require.resolve("../auth"), "utf8"), { module: moduleMock, console, Buffer, process: { env: {} }, require(name) {
    if (name === "./db") return { query, tx: fn => fn({ query }) };
    if (name === "./permissions") return { permissionsOf: () => [] };
    if (name === "./email-events") return { enqueueSafe: async () => false };
    if (name === "./creator-details") return require("../creator-details");
    if (name === "sharp") return {};
    return require(name);
  } });
  const auth = moduleMock.exports;
  const res = { getHeader() {}, setHeader() {} };
  const info = { sub: "123", email: "test@example.com", email_verified: true, name: "Test" };
  assert.equal((await auth.googleAccount(res, { ...info, email_verified: false })).error, "unverified");
  assert.equal(sessions, 0);
  users = [{ id: "existing", email: info.email, password_hash: "preserved", plan: "pro" }];
  assert.equal((await auth.googleAccount(res, info)).error, "link_required");
  assert.equal(sessions, 0);
  assert.equal((await auth.googleAccount(res, info, "existing")).user.id, "existing");
  assert.equal(users[0].password_hash, "preserved"); assert.equal(users[0].plan, "pro");
  assert.equal((await auth.googleAccount(res, info)).user.id, "existing");
  assert.equal((await auth.googleAccount(res, info, "wrong")).error, "conflict");
  users = [];
  const fresh = await auth.googleAccount(res, info);
  assert.equal(fresh.user.plan, "free"); assert.match(fresh.user.handle, /^@creator_[a-f0-9]{20}$/);
  assert.equal(users[0].password_hash, "google-only");
  console.log("PASS Google OAuth: state, expiry, PKCE, cancellation, safe redirects, session binding, new/returning accounts, explicit linking, role/plan/password preservation.");
}
run().catch(err => { console.error(err); process.exitCode = 1; });
