"use strict";
// Real auth/admin modules and owner-verified local PostgreSQL ONLY. No dotenv,
// real OAuth/email provider, production URL or actual user role changes.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { Pool } = require("pg");
require("./helpers/isolated-postgres").assertIsolatedPostgres();
assert.equal(process.env.SC_ISOLATED_POSTGRES_QA, "true");
const config = { host: "127.0.0.1", port: 55437, database: "shortscraft_qa", password: "local-qa-only-not-production", ssl: false, connectionTimeoutMillis: 5000, statement_timeout: 10000 };
const appPool = new Pool({ ...config, user: "shortscraft_app", max: 12 });
const setup = new Pool({ ...config, user: "postgres", max: 2 });
const root = path.resolve(__dirname, ".."), permissions = require("../permissions");
const ids = [], checks = [], prefix = crypto.randomBytes(6).toString("hex"), password = "Isolated-Auth-Only-Strong-2026";
let failAuditTarget = null;
const db = { query: (sql, p) => appPool.query(sql, p), tx: async fn => {
  const c = await appPool.connect();
  const wrapped = { query(sql, params = []) {
    if (failAuditTarget && sql.includes("insert into public.admin_audit_log") && params.includes(failAuditTarget)) {
      // A real PostgreSQL statement error, not a swallowed JavaScript error.
      return c.query("select qa_missing_audit_column from public.admin_audit_log");
    }
    return c.query(sql, params);
  } };
  try { await c.query("begin"); const result = await fn(wrapped); await c.query("commit"); return result; }
  catch (error) { await c.query("rollback"); throw error; }
  finally { c.release(); }
} };
function load(file, deps) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), { module, exports: module.exports, Buffer, URL,
    process: { env: { NODE_ENV: "test" } }, console,
    require: n => Object.hasOwn(deps, n) ? deps[n] : require(n)
  }, { filename: file });
  return module.exports;
}
const silentEvents = { enqueueSafe: async () => false }, referralOff = { attachNewUser: async () => {} };
const auth = load("auth.js", { "./db": db, "./permissions": permissions, "./creator-details": require("../creator-details"), "./email-events": silentEvents, "./referrals": referralOff, sharp: {} });
const notify = load("notify.js", { "./db": db, "./notification-controls": {}, "./email-events": silentEvents, "web-push": {} });
const admin = load("admin.js", { "./db": db, "./permissions": permissions, "./notify": notify, "./credits": {} });
function response() { return { headers: {}, getHeader(k) { return this.headers[k]; }, setHeader(k, v) { this.headers[k] = v; } }; }
const cookie = r => [].concat(r.headers["Set-Cookie"] || []).find(v => v.startsWith("sc_sid="))?.split(";")[0];
async function user(name) {
  const out = await auth.signUp(response(), `${prefix}-${name}@example.test`, password, `qa_${prefix}_${name}`.slice(0, 30));
  assert.ok(out.user, out.error); ids.push(out.user.id); return out.user;
}
const countSessions = async u => (await db.query("select count(*)::int as n from public.sessions where user_id=$1", [u.id])).rows[0].n;
const stored = async u => (await db.query("select role,staff_permissions,google_sub from public.users where id=$1", [u.id])).rows[0];
async function check(label, fn) { await fn(); checks.push(label); console.log("PASS " + label); }
async function run() {
  const identity = (await setup.query("select current_database() as db,host(inet_server_addr()) as host,inet_server_port() as port")).rows[0];
  assert.deepEqual(identity, { db: "shortscraft_qa", host: "127.0.0.1", port: 55437 });
  const file = "supabase/migrations/20261008195337_align_admin_role_permissions.sql";
  const sql = fs.readFileSync(path.join(root, file), "utf8");
  const declared = [...sql.split("staff_permissions <@ array[")[1].split("]::text[]")[0].matchAll(/'([^']+)'/g)].map(m => m[1]);
  assert.deepEqual(declared, permissions.PERMISSIONS.map(p => p.key), "migration permission list must exactly track the server allowlist");
  // Explicit local-only DDL. No role/permission rows are changed by this SQL.
  await setup.query(sql);
  const owner = await user("owner"), account = await user("account"), staff = await user("staff"), ordinary = await user("ordinary");
  await setup.query("update public.users set role='super_admin' where id=$1", [owner.id]); owner.role = "super_admin";
  await check("closed role/permission constraints accept known roles and deny arbitrary privilege keys", async () => {
    await assert.rejects(setup.query("update public.users set role='invented_root' where id=$1", [ordinary.id]), e => e.code === "23514");
    await assert.rejects(setup.query("update public.users set staff_permissions=array['invented.root'] where id=$1", [ordinary.id]), e => e.code === "23514");
    await setup.query("update public.users set staff_permissions=$2::text[] where id=$1", [ordinary.id, declared]);
    const info = await stored(ordinary); assert.equal(info.role, "user"); assert.equal(permissions.permissionsOf(info).length, 0, "stored keys alone never make an ordinary user staff");
    await setup.query("update public.users set staff_permissions='{}' where id=$1", [ordinary.id]);
  });
  await check("owner-only sub_admin assignment persists legitimate modern permission keys", async () => {
    const list = ["overview.view", "users.manage", "reports.review", "referrals.view", "ai_jobs.view"];
    assert.equal((await admin.setStaff(ordinary, staff.id, { role: "sub_admin", permissions: list })).status, 403);
    assert.equal((await admin.setStaff(owner, staff.id, { role: "sub_admin", permissions: list })).success, true);
    const row = await stored(staff); assert.equal(row.role, "sub_admin"); assert.deepEqual(row.staff_permissions, permissions.normalise(list));
    assert.equal(permissions.can(row, "users.manage"), true); assert.equal(permissions.can(row, "team.manage"), false);
  });
  await check("profile fields cannot self-promote a user or overwrite stored staff permissions", async () => {
    const before = await stored(ordinary);
    assert.equal((await auth.updateProfile(ordinary.id, { role: "super_admin", staffPermissions: declared, staff_permissions: declared, permissions: declared, displayName: "Safe profile edit" })).success, true);
    assert.deepEqual(await stored(ordinary), before);
    assert.equal((await admin.moderateUser(ordinary, ordinary.id, "change_role", { role: "super_admin", reason: "Forged self promotion" })).status, 403);
    assert.equal((await admin.setStaff(owner, owner.id, { role: "user", permissions: [] })).status, 400);
  });
  const login = response(); assert.ok((await auth.logIn(login, account.email, password)).user);
  const oldCookie = cookie(login);
  await check("real ban atomically revokes sessions and a correct password cannot sign in", async () => {
    assert.ok(await countSessions(account));
    assert.equal((await admin.moderateUser(owner, account.id, "ban", { reason: "Isolated QA restriction" })).success, true);
    assert.equal((await stored(account)).role, "banned"); assert.equal(await countSessions(account), 0);
    const r = response(), denied = await auth.logIn(r, account.email, password);
    assert.equal(denied.status, 403); assert.equal(denied.code, "ACCOUNT_BLOCKED"); assert.equal(cookie(r), undefined);
    assert.equal(await countSessions(account), 0);
    const request = { headers: { cookie: oldCookie } }; await auth.middleware(request, response(), () => {}); assert.equal(request.user, null);
  });
  await check("middleware independently rejects a stale session for a banned DB role", async () => {
    const token = crypto.randomBytes(24).toString("base64url");
    await setup.query("insert into public.sessions(token_hash,user_id,expires_at) values($1,$2,now()+interval '1 hour')", [crypto.createHash("sha256").update(token).digest("hex"), account.id]);
    const request = { headers: { cookie: "sc_sid=" + token } }, r = response(); await auth.middleware(request, r, () => {});
    assert.equal(request.user, null); assert.equal(request.authBlocked, true); assert.match(r.headers["Set-Cookie"], /Max-Age=0/);
    await setup.query("delete from public.sessions where user_id=$1", [account.id]);
  });
  await check("banned Google linking/login is denied without identity/session changes", async () => {
    const info = { sub: "qa_google_" + prefix, email: account.email, email_verified: true, name: "QA" };
    assert.equal((await auth.googleAccount(response(), info, account.id)).error, "blocked"); assert.equal((await stored(account)).google_sub, null);
    await setup.query("update public.users set google_sub=$2 where id=$1", [account.id, info.sub]);
    assert.equal((await auth.googleAccount(response(), info)).error, "blocked"); assert.equal(await countSessions(account), 0);
  });
  await check("password reset cannot automatically create a banned account session", async () => {
    const reset = await auth.requestPasswordReset(account.email); assert.ok(reset.token);
    const out = await auth.resetPassword(response(), reset.token, "Replacement-Only-Isolated-2026");
    assert.equal(out.code, "ACCOUNT_BLOCKED"); assert.equal(await countSessions(account), 0);
  });
  await check("unban restores ordinary access, never old sessions or staff grants", async () => {
    assert.equal((await admin.moderateUser(owner, account.id, "unban", { reason: "Isolated QA restoration" })).success, true);
    const row = await stored(account); assert.equal(row.role, "user"); assert.deepEqual(row.staff_permissions, []); assert.equal(await countSessions(account), 0);
    assert.ok((await auth.logIn(response(), account.email, "Replacement-Only-Isolated-2026")).user);
    const request = { headers: { cookie: oldCookie } }; await auth.middleware(request, response(), () => {}); assert.equal(request.user, null);
  });
  await check("concurrent password logins cannot outlive a ban transaction", async () => {
    for (let i = 0; i < 3; i++) {
      const racing = await user("race" + i);
      const outcomes = await Promise.all([auth.logIn(response(), racing.email, password), auth.logIn(response(), racing.email, password), admin.moderateUser(owner, racing.id, "ban", { reason: "QA concurrent ban" })]);
      assert.equal(outcomes[2].success, true); assert.equal((await stored(racing)).role, "banned"); assert.equal(await countSessions(racing), 0);
      assert.equal((await auth.logIn(response(), racing.email, password)).code, "ACCOUNT_BLOCKED");
    }
  });
  const rollbackUser = await user("rollback");
  await check("audit SQL failure rolls back ban/session revocation and warning notification", async () => {
    const beforeSessions = await countSessions(rollbackUser);
    const notices = async () => (await db.query("select count(*)::int as n from public.notifications where user_id=$1", [rollbackUser.id])).rows[0].n;
    const beforeNotices = await notices(); failAuditTarget = rollbackUser.id;
    try {
      await assert.rejects(admin.moderateUser(owner, rollbackUser.id, "ban", { reason: "QA audit outage" }), e => e.code === "42703");
      assert.equal((await stored(rollbackUser)).role, "user"); assert.equal(await countSessions(rollbackUser), beforeSessions);
      await assert.rejects(admin.moderateUser(owner, rollbackUser.id, "warn", { reason: "QA audit outage" }), e => e.code === "42703");
      assert.equal(await notices(), beforeNotices);
    } finally { failAuditTarget = null; }
    assert.equal((await admin.moderateUser(owner, rollbackUser.id, "ban", { reason: "QA audit restored" })).success, true);
    assert.equal((await stored(rollbackUser)).role, "banned"); assert.equal(await countSessions(rollbackUser), 0);
  });
  console.log(`${checks.length} admin/auth checks passed (owned isolated PostgreSQL, no provider calls or production changes).`);
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  if (ids.length) {
    await setup.query("delete from public.admin_audit_log where actor_id=any($1::uuid[]) or entity_id=any($2::text[])", [ids, ids]);
    await setup.query("delete from public.users where id=any($1::uuid[])", [ids]);
  }
  await appPool.end(); await setup.end();
});
