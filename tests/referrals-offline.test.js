"use strict";
// Executes the real referral/credits modules with transactional test storage.
// Not evidence of a migrated production PostgreSQL database.
const assert = require("node:assert/strict");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const env = { REFERRALS_ENABLED: "true", CREDITS_SECRET: "test-secret-not-production" };
const day = new Date().toISOString().slice(0, 10);
let state = { users: {}, referrals: {}, credits: {}, ledger: [], codes: {}, tokens: [] };
let fail = false;
let queue = Promise.resolve();
function makeClient(draft) {
  return { async query(raw, p = []) {
    const sql = raw.replace(/\s+/g, " ").trim();
    const rows = value => ({ rows: value ? [structuredClone(value)] : [], rowCount: value ? 1 : 0 });
    if (sql.includes("pg_advisory_xact_lock")) return rows(null);
    if (sql.startsWith("select id from public.users") && sql.endsWith("for share")) return rows(null);
    if (sql.startsWith("delete from public.email_verification_tokens")) {
      if (sql.includes("token_hash")) {
        const found = draft.tokens.find(t => t.hash === p[0] && t.userId === p[1] && t.expires > Date.now());
        if (found) draft.tokens = draft.tokens.filter(t => t !== found);
        return rows(found && { email: found.email });
      }
      draft.tokens = draft.tokens.filter(t => t.userId !== p[0] && t.expires > Date.now()); return rows(null);
    }
    if (sql.startsWith("insert into public.email_verification_tokens")) {
      draft.tokens.push({ hash: p[0], userId: p[1], email: p[2], expires: Date.now() + 864e5 }); return rows(null);
    }
    if (sql.startsWith("update public.users set email_verified_at")) {
      const u = draft.users[p[0]]; if (!u || u.email !== p[1]) return rows(null);
      u.email_verified_at = day; return rows({ id: p[0] });
    }
    if (sql.startsWith("insert into public.referrals")) {
      const inviter = draft.codes[p[1]];
      if (inviter && inviter !== p[0] && draft.users[inviter]?.role !== "banned" && !draft.referrals[p[0]]) draft.referrals[p[0]] = { invitee_id: p[0], inviter_id: inviter, status: "pending", first_export_id: null };
      return rows(null);
    }
    if (sql.startsWith("select inviter_id")) return rows(draft.referrals[p[0]]);
    if (sql.startsWith("select r.invitee_id from public.referrals")) {
      return { rows: Object.values(draft.referrals).filter(r => r.inviter_id === p[0] && r.status === "pending" && draft.users[r.invitee_id]?.role !== "banned" && (draft.users[r.invitee_id]?.email_verified_at || draft.users[r.invitee_id]?.google_sub) && draft.ledger.some(l => l.user_id === r.invitee_id && l.kind === "export" && l.amount < 0 && (l.id === r.first_export_id || l.metadata?.exportSucceeded) && !draft.ledger.some(f => f.idempotency_key === "refund:" + l.id))).slice(0,3) };
    }
    if (sql.startsWith("select r.*")) {
      const r = draft.referrals[p[0]];
      const proof = r && draft.ledger.find(l => l.id === r.first_export_id && l.user_id === p[0] && l.kind === "export" && l.amount < 0);
      if (!proof || draft.ledger.some(l => l.idempotency_key === "refund:" + proof.id)) return rows(null);
      return rows(r && { ...r, email_verified_at: draft.users[p[0]].email_verified_at, google_sub: draft.users[p[0]].google_sub,
        invitee_role: draft.users[p[0]].role, inviter_role: draft.users[r.inviter_id].role, invitee_plan: "free", inviter_plan: "free" });
    }
    if (sql.startsWith("select count(*)::int as total")) return rows({ total: Object.values(draft.referrals).filter(r => r.inviter_id === p[0] && r.status === "rewarded" && r.rewarded_at?.slice(0, 7) === day.slice(0, 7)).length });
    if (sql.startsWith("update public.referrals set first_export_id")) {
      const r = draft.referrals[p[0]];
      const proof = draft.ledger.find(l => (!p[1] || l.id === p[1]) && l.user_id === p[0] && l.kind === "export" && l.amount < 0 && l.metadata?.exportSucceeded && !draft.ledger.some(f => f.idempotency_key === "refund:" + l.id));
      if (r && !r.first_export_id && proof) r.first_export_id = proof.id;
      return rows(null);
    }
    if (sql.startsWith("update public.credit_transactions c set metadata")) {
      const proof = draft.ledger.find(l => l.id === p[0] && l.user_id === p[1] && l.kind === "export" && l.amount < 0);
      if (!proof || draft.referrals[p[1]]?.status !== "pending" || draft.ledger.some(f => f.idempotency_key === "refund:" + proof.id)) return rows(null);
      proof.metadata = { ...proof.metadata, exportSucceeded: true };
      return rows({ id: proof.id });
    }
    if (sql.startsWith("update public.referrals set status")) {
      const r = draft.referrals[p[0]];
      r.status = sql.includes("'rewarded'") ? "rewarded" : "limited"; r.rewarded_at = day;
      return rows(r);
    }
    if (sql.startsWith("select * from public.credits")) return rows(draft.credits[p[0]]);
    if (sql.startsWith("insert into public.credits")) {
      draft.credits[p[0]] = { key: p[0], day: p[1], plan: p[2], left_credits: p[3], spent: 0, since: p[4], bonus_credits: draft.credits[p[0]]?.bonus_credits || 0 };
      return rows(draft.credits[p[0]]);
    }
    if (sql.startsWith("update public.credits")) {
      const c = draft.credits[p[0]];
      if (sql.includes("bonus_credits = bonus_credits + $2")) { c.bonus_credits += p[1]; if (fail && p[0] === "u:owner") throw Error("grant failed"); }
      else if (sql.includes("spent = spent +")) { c.left_credits -= p[1]; c.spent += p[1]; c.bonus_credits -= p[2] || 0; }
      else if (sql.includes("spent = greatest")) { c.left_credits = Math.min(p[1], c.left_credits + p[2]); c.spent = Math.max(0, c.spent - p[2]); c.bonus_credits += p[3] || 0; }
      else c.left_credits = p[1];
      return rows(c);
    }
    if (sql.startsWith("insert into public.credit_transactions")) {
      const grant = sql.includes("'grant'"); const refund = sql.includes("'refund'");
      const entry = grant ? { credit_key:p[0], user_id:p[1], kind:"grant", amount:p[2], balance_after:p[2], idempotency_key:p[3], metadata:JSON.parse(p[4]) } : refund ?
        { credit_key:p[0], user_id:p[1], kind:"refund", amount:p[2], balance_after:p[3], idempotency_key:p[4], metadata:JSON.parse(p[5]) } :
        { credit_key:p[0], user_id:p[1], kind:sql.includes("'admin_adjustment'") ? "admin_adjustment" : p[2], amount:sql.includes("'admin_adjustment'") ? p[2] : p[3], balance_after:sql.includes("'admin_adjustment'") ? p[3] : p[4], idempotency_key:sql.includes("'admin_adjustment'") ? p[4] : p[5], metadata:JSON.parse(sql.includes("'admin_adjustment'") ? p[5] : p[6]) };
      const exists = draft.ledger.find(l => l.idempotency_key === entry.idempotency_key);
      if (exists) { assert.ok(sql.includes("do nothing"), "unique ledger entry"); return rows(null); }
      entry.id = "ledger-" + draft.ledger.length; draft.ledger.push(entry); return rows(entry);
    }
    if (sql.startsWith("select metadata from public.credit_transactions")) return rows(draft.ledger.find(l => l.id === p[0] && l.credit_key === p[1]));
    if (sql.includes("from public.credit_transactions where idempotency_key")) return rows(draft.ledger.find(l => l.idempotency_key === p[0]));
    throw Error("Unexpected SQL: " + sql);
  } };
}
const db = { async query(sql, p) { return makeClient(state).query(sql, p); }, tx(fn) {
  const run = queue.then(async () => { const draft = structuredClone(state); const result = await fn(makeClient(draft)); state = draft; return result; });
  queue = run.catch(() => {}); return run;
} };
function load(file, deps) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname, "..", file), "utf8"), {
    module, exports: module.exports, process: { env }, console, Buffer,
    require: name => deps[name] || require(name)
  }, { filename:file });
  return module.exports;
}
const credits = load("credits.js", { "./db": db });
const referrals = load("referrals.js", { "./db": db, "./credits": credits, "./email-events": { enqueueSafe: async () => false }, "./notify": { toUser: async () => {} } });
async function run() {
  state.users.owner = { role:"super_admin" }; state.users.friend = { role:"user" };
  state.codes.abcdefghijklmnop = "owner";
  await referrals.attachNewUser({ id:"owner" }, "abcdefghijklmnop", makeClient(state));
  assert.equal(state.referrals.owner, undefined, "self referral is ineligible");
  await referrals.attachNewUser({ id:"friend" }, "abcdefghijklmnop", makeClient(state));
  assert.equal((await referrals.qualify("friend")).rewarded, false, "unverified + no export");
  await referrals.successfulExport({id:"friend"}, "forged");
  assert.equal(state.referrals.friend.first_export_id, null, "forged export proof refused");
  state.ledger.push({ id:"not-charged", kind:"export", user_id:"friend", amount:1 });
  await referrals.successfulExport({id:"friend"}, "not-charged");
  assert.equal(state.referrals.friend.first_export_id, null, "uncharged export is not proof");
  state.ledger.push({ id:"export-proof", kind:"export", user_id:"friend", amount:-1 });
  await referrals.successfulExport({id:"friend"}, "export-proof");
  assert.equal(state.referrals.friend.status, "pending", "successful export before email verification stays pending");
  state.users.friend.email_verified_at = day;
  fail = true;
  await assert.rejects(referrals.qualify("friend"), /grant failed/);
  assert.equal(state.referrals.friend.status, "pending", "two grants rollback together");
  assert.equal(state.credits["u:friend"], undefined);
  fail = false;
  await Promise.all(Array.from({length:6}, () => referrals.qualify("friend")));
  assert.equal(state.credits["u:owner"].bonus_credits, 10);
  assert.equal(state.credits["u:friend"].bonus_credits, 10);
  assert.equal(state.ledger.filter(l => l.metadata?.type === "referral_reward").length, 2, "concurrent/repeated qualification grants only once each");
  const req = {user:{id:"friend",plan:"free"}, credits:{key:"u:friend"}, path:"/api/export", body:{} };
  assert.equal((await credits.state(req)).left, 15);
  const charged = await credits.charge(req, "aiAdvanced");
  assert.equal(charged.left, 7, "spend 5 daily + 3 bonus");
  assert.equal(state.credits["u:friend"].bonus_credits, 7);
  await credits.refund(req,"aiAdvanced"); await credits.refund(req,"aiAdvanced");
  assert.equal(state.credits["u:friend"].bonus_credits, 10, "failed work restores bonus exactly once");
  assert.equal(state.credits["u:friend"].left_credits, 5);
  state.credits["u:friend"].day = "2026-01-01";
  assert.equal((await credits.state(req)).left, 15, "daily reset preserves bonus");
  for (let i = 0; i < 10; i++) {
    const id = "cap-" + i; state.users[id] = {role:"user", google_sub:"google"};
    state.ledger.push({ id: "proof-" + id, user_id: id, kind: "export", amount: -1 });
    state.referrals[id] = {inviter_id:"owner",invitee_id:id,status:"pending",first_export_id:"proof-" + id};
    await referrals.qualify(id);
  }
  assert.equal(state.credits["u:owner"].bonus_credits, 100, "monthly inviter cap is 10 x 10");
  assert.equal(state.referrals["cap-9"].status, "limited");
  const cookies=[]; referrals.capture({method:"GET",query:{ref:"abcdefghijklmnop"},headers:{}},{append:(_,v)=>cookies.push(v)},()=>{});
  const header = cookies[0].split(";")[0];
  assert.equal(referrals.readCode({headers:{cookie:header}}),"abcdefghijklmnop");
  assert.equal(referrals.readCode({headers:{cookie:header.replace("abcdefghijklmnop","badcdefghijklmnoz")}}),null);
  const emailUser = { id:"email-user", email:"verified@example.test" };
  state.users[emailUser.id] = { ...emailUser, role:"user" };
  // Test explicit token replacement separately from the durable send cooldown.
  const older = await referrals.createVerification(emailUser, { enforceCooldown: false });
  const current = await referrals.createVerification(emailUser, { enforceCooldown: false });
  assert.equal(state.tokens.length, 1, "resend invalidates the older token");
  assert.notEqual(state.tokens[0].hash, current.token, "only the token hash is stored");
  assert.equal((await referrals.verifyEmail(emailUser, older.token)).status, 400);
  assert.equal((await referrals.verifyEmail({ id:"friend" }, current.token)).status, 400, "token cannot verify another account");
  assert.equal((await referrals.verifyEmail(emailUser, current.token)).success, true);
  assert.ok(state.users[emailUser.id].email_verified_at);
  assert.equal((await referrals.verifyEmail(emailUser, current.token)).status, 400, "single-use verification");
  const expired = await referrals.createVerification(emailUser, { enforceCooldown: false }); state.tokens[0].expires = 0;
  assert.equal((await referrals.verifyEmail(emailUser, expired.token)).status, 400, "expired token refused");
  const changed = await referrals.createVerification(emailUser, { enforceCooldown: false }); state.users[emailUser.id].email = "changed@example.test";
  assert.equal((await referrals.verifyEmail(emailUser, changed.token)).status, 400, "email change invalidates verification");
  env.REFERRALS_ENABLED = "false";
  assert.equal((await credits.state(req)).bonusCredits, 10, "pausing NEW rewards keeps earned bonus spendable");
  assert.equal((await referrals.summary(null)).enabled,false,"off by default / no migration writes");
  console.log("PASS: 10 + 10 rewards, verification/export gates, forged/uncharged proof, rollback, concurrent replay, spending/refund, bonus rollover, UTC cap, signed attribution, hashed single-use verification with resend/expiry/account/email checks, disabled rollout (isolated).");
}
run().catch(e=>{console.error(e);process.exitCode=1;});
