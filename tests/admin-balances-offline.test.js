"use strict";
// Real admin module, isolated storage only. Never imports the configured database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");
const env = { REFERRALS_ENABLED: "true" };
const owner = { id: "owner", role: "super_admin" };
const userId = "11111111-1111-4111-8111-111111111111";
let state = { bonus: 10, daily: 5, stars: [], audit: [], notices: [] };
let failAudit = false;
const db = {
  query() { throw Error("Nontransactional write refused"); },
  async tx(fn) {
    const draft = structuredClone(state);
    const client = { async query(sql, p) {
      if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
      if (sql.startsWith("select id, handle")) return { rows: [{ id: userId, handle: "member", plan: "free" }] };
      if (sql.startsWith("update public.credits")) { draft.bonus += p[1]; return { rows: [{ left_credits: draft.daily, bonus_credits: draft.bonus }] }; }
      if (sql.startsWith("insert into public.credit_transactions")) return { rows: [] };
      if (sql.startsWith("insert into public.star_transactions")) { draft.stars.push({ amount: p[1], note: JSON.parse(p[3]), sql }); return { rows: [] }; }
      if (sql.startsWith("insert into public.admin_audit_log")) { if (failAudit) throw Error("Audit unavailable"); draft.audit.push(p); return { rows: [] }; }
      if (sql.startsWith("insert into public.notifications")) { draft.notices.push(p); return { rows: [] }; }
      throw Error("Unexpected query: " + sql);
    }, draft };
    const result = await fn(client); state = draft; return result;
  }
};
const moduleStub = { exports: {} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "../admin.js"), "utf8"), {
  module: moduleStub, exports: moduleStub.exports, console, process: { env },
  require(name) {
    if (name === "./db") return db;
    if (name === "./permissions") return { can: actor => actor.role === "super_admin", isOwner: actor => actor.role === "super_admin" };
    if (name === "./notify") return {};
    if (name === "./credits") return { ensureRecord: async (_key, _plan, client) => ({ bonus_credits: client.draft.bonus, left_credits: client.draft.daily }) };
    if (name === "node:crypto") return require(name);
    throw Error("Unexpected dependency: " + name);
  }
});
const admin = moduleStub.exports;
(async () => {
  assert.equal((await admin.adjustUserBalance({ role: "user" }, userId, { delta: 10, reason: "test" })).status, 403);
  for (const delta of ["10abc", "1.5", 10001, 0]) assert.equal((await admin.adjustUserBalance(owner, userId, { type: "credits", delta, reason: "test" })).status, 400);
  env.REFERRALS_ENABLED = "false";
  assert.equal((await admin.adjustUserBalance(owner, userId, { type: "credits", delta: 10, reason: "test" })).status, 503);
  env.REFERRALS_ENABLED = "true";
  await admin.adjustUserBalance(owner, userId, { type: "credits", delta: 10, reason: "Support correction" });
  assert.equal(state.bonus, 20); assert.equal(state.daily, 5);
  assert.equal((await admin.adjustUserBalance(owner, userId, { type: "credits", delta: -21, reason: "test" })).status, 409);
  await admin.adjustUserBalance(owner, userId, { type: "credits", delta: -5, reason: "Support correction" });
  assert.equal(state.bonus, 15);
  failAudit = true;
  await assert.rejects(admin.adjustUserBalance(owner, userId, { type: "credits", delta: 10, reason: "test" }), /Audit unavailable/);
  assert.equal(state.bonus, 15, "audit failure rolls back the bonus change");
  failAudit = false;
  await admin.adjustUserBalance(owner, userId, { type: "stars", delta: 260, reason: "Support correction" });
  assert.deepEqual(state.stars.map(s => s.amount), [100, 100, 60]);
  assert.ok(state.stars.every(s => s.sql.includes("values (null") && s.note.type === "admin_grant" && !s.sql.includes("'donation'")));
  assert.equal((await admin.adjustUserBalance(owner, userId, { type: "stars", delta: -1, reason: "test" })).status, 409);
  assert.equal((await admin.setStaff({ role: "sub_admin" }, userId, {})).status, 403);
  console.log("PASS: owner-only staff grants, strict balance input, migration gate, separate bonus credits, nonnegative bonus, atomic audit rollback, spendable Star chunks without fake creator earnings (isolated).");
})().catch(err => { console.error(err); process.exitCode = 1; });
