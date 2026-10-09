"use strict";
// Real SQL/transactions, owner-marked local PostgreSQL ONLY. No dotenv, provider,
// production URL, HTTP server or email delivery. Fixture rows are cleaned by ID.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const crypto = require("node:crypto");
const { Pool } = require("pg");
require("./helpers/isolated-postgres").assertIsolatedPostgres();
assert.equal(process.env.SC_ISOLATED_POSTGRES_QA, "true", "Explicit local QA opt-in required");
const config = { host: "127.0.0.1", port: 55437, database: "shortscraft_qa", password: "local-qa-only-not-production", ssl: false, max: 12, connectionTimeoutMillis: 5000, statement_timeout: 10000 };
const appPool = new Pool({ ...config, user: "shortscraft_app" });
const setup = new Pool({ ...config, user: "postgres", max: 2 });
const env = { REFERRALS_ENABLED: "true", TRANSACTIONAL_EMAILS_ENABLED: "true", CREDITS_SECRET: "isolated-referral-hardening-secret-not-production" };
const root = path.resolve(__dirname, "..");
const ids = [], checks = [], prefix = crypto.randomBytes(6).toString("hex");
let failProofUser = null, failRewardUser = null;
const fault = Object.assign(new Error("Isolated injected outage"), { code: "08006" });
const db = {
  async query(sql, params = []) {
    if (failProofUser === params[0] && sql.startsWith("update public.referrals set first_export_id")) { failProofUser = null; throw fault; }
    return appPool.query(sql, params);
  },
  async tx(fn) {
    const c = await appPool.connect();
    try {
      await c.query("begin");
      const wrapped = { query(sql, params = []) {
        if (sql.startsWith("update public.credits set bonus_credits") && params[0] === "u:" + failRewardUser) throw fault;
        return c.query(sql, params);
      } };
      const out = await fn(wrapped); await c.query("commit"); return out;
    } catch (error) { await c.query("rollback"); throw error; }
    finally { c.release(); }
  }
};
function load(file, deps) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), { module, exports: module.exports, Buffer,
    process: { env }, console: { warn() {}, error() {}, log() {} }, setInterval, clearInterval,
    require: name => Object.hasOwn(deps, name) ? deps[name] : require(name)
  }, { filename: file });
  return module.exports;
}
const credits = load("credits.js", { "./db": db });
const events = load("email-events.js", { "./db": db, "./release-policy": { monetizationEnabled: false }, "./mailer": {
  configured: () => true,
  transactionalPayload: ({ to, kind, data }) => ({ to, subject: "Mock " + kind, data }),
  // This test never starts/flushes the outbox worker. Provider calls fail closed.
  sendPayload: async () => { throw Error("QA forbids external email delivery"); }
} });
const notify = load("notify.js", { "./db": db, "./notification-controls": {}, "./email-events": events, "web-push": {} });
const newReferrals = () => load("referrals.js", { "./db": db, "./credits": credits, "./notify": notify, "./email-events": events });
let referrals = newReferrals();
const req = user => ({ user, credits: { key: "u:" + user.id }, path: "/api/export", body: {}, get: () => crypto.randomUUID() });
const balance = async user => (await db.query("select * from public.credits where key=$1", ["u:" + user.id])).rows[0];
async function user(name, verified = false) {
  const id = crypto.randomUUID(); ids.push(id);
  const email = `${prefix}-${name}@example.test`;
  await setup.query("insert into public.users(id,email,password_hash,handle,display_name,email_verified_at) values($1,$2,'isolated-disabled-login',$3,$4,$5)",
    [id, email, "@qa_" + id.replaceAll("-", ""), "Private fixture " + name, verified ? new Date() : null]);
  return { id, email, role: "user", plan: "free" };
}
async function attach(owner, friend) {
  const code = (await referrals.summary(owner)).code;
  await db.tx(c => referrals.attachNewUser(friend, code, c));
}
async function charge(user) { const r = req(user); assert.equal((await credits.charge(r, "export")).ok, true); return r; }
async function prioritize(friend) { await setup.query("update public.referrals set qualification_next_at='2000-01-01' where invitee_id=$1", [friend.id]); }
async function check(label, fn) { await fn(); checks.push(label); console.log("PASS " + label); }
async function run() {
  const identity = (await setup.query("select current_database() as db,host(inet_server_addr()) as host,inet_server_port() as port")).rows[0];
  assert.deepEqual(identity, { db: "shortscraft_qa", host: "127.0.0.1", port: 55437 });
  // Applying this additive schema to the owned QA server is explicit; NEVER
  // derive a database URL from a .env file or apply it to any other database.
  await setup.query(fs.readFileSync(path.join(root, "supabase/migrations/20261008191251_referral_reward_recovery.sql"), "utf8"));
  await check("private cooldown table: RLS, all browser DML denied, narrow app rights", async () => {
    assert.equal((await setup.query("select relrowsecurity from pg_class where oid='public.referral_verification_attempts'::regclass")).rows[0].relrowsecurity, true);
    for (const role of ["anon", "authenticated"]) for (const right of ["SELECT", "INSERT", "UPDATE", "DELETE"]) assert.equal((await setup.query("select has_table_privilege($1,'public.referral_verification_attempts',$2) as allowed", [role, right])).rows[0].allowed, false);
    assert.equal((await setup.query("select has_table_privilege('shortscraft_app','public.referral_verification_attempts','INSERT') as allowed")).rows[0].allowed, true);
    const fields = (await setup.query("select column_name from information_schema.columns where table_schema='public' and table_name='referral_verification_attempts'")).rows.map(r => r.column_name).sort();
    assert.deepEqual(fields, ["created_at", "id", "token_hash", "user_id"]);
  });
  const owner = await user("owner", true), friend = await user("friend", true); await attach(owner, friend);
  const paid = await charge(friend), chargeId = paid._creditChargeIds.export;
  await check("a debit alone, browser analytics and wrong-account proof never qualify", async () => {
    assert.equal((await referrals.qualify(friend.id)).rewarded, false);
    await setup.query("insert into public.template_events(template_id,user_id,event_type) values('qa-referral',$1,'export')", [friend.id]);
    assert.equal((await referrals.retryForUser(friend, { force: true })).rewarded, false);
    assert.equal((await referrals.successfulExport(owner, chargeId)).rewarded, false);
    assert.equal((await db.query("select first_export_id from public.referrals where invitee_id=$1", [friend.id])).rows[0].first_export_id, null);
  });
  await check("durable actual-success fact survives attachment outage and process restart", async () => {
    failProofUser = friend.id;
    assert.equal((await referrals.successfulExport(friend, chargeId)).recoveryPending, true);
    assert.equal((await db.query("select metadata->>'exportSucceeded' as proof from public.credit_transactions where id=$1", [chargeId])).rows[0].proof, "true");
    assert.equal((await balance(friend)).bonus_credits, 0);
    referrals = newReferrals(); await prioritize(friend);
    const recovered = await referrals.reconcile({ limit: 1 }); assert.equal(recovered.checked, 1); assert.equal(recovered.rewarded, 1);
    assert.equal((await balance(friend)).bonus_credits, 10); assert.equal((await balance(owner)).bonus_credits, 10);
  });
  await check("concurrent replay queues exactly two notifications and two recipient emails", async () => {
    const replay = await Promise.all(Array.from({ length: 6 }, () => referrals.qualify(friend.id)));
    assert.equal(replay.filter(r => r.rewarded).length, 0);
    assert.equal((await db.query("select count(*)::int as n from public.credit_transactions where metadata->>'inviteeId'=$1 and metadata->>'type'='referral_reward'", [friend.id])).rows[0].n, 2);
    const notices = (await db.query("select entity_id from public.notifications where entity_type='referral' and user_id=any($1::uuid[])", [[owner.id, friend.id]])).rows;
    assert.equal(notices.length, 2); assert.ok(notices.every(r => !r.entity_id.includes(friend.id) && !r.entity_id.includes(owner.id)), "notification identifiers also hide invitee UUIDs");
    assert.equal((await db.query("select count(*)::int as n from public.email_outbox where kind='referral_reward' and user_id=any($1::uuid[])", [[owner.id, friend.id]])).rows[0].n, 2);
  });
  await check("pausing new rewards preserves spending/refund/rollover of earned bonus", async () => {
    env.REFERRALS_ENABLED = "false";
    assert.equal((await credits.state(req(friend))).bonusCredits, 10);
    const r = req(friend); assert.equal((await credits.charge(r, "aiAdvanced")).ok, true);
    assert.equal((await balance(friend)).bonus_credits, 6); // 4 daily + 4 bonus
    await credits.refund(r, "aiAdvanced"); await credits.refund(r, "aiAdvanced");
    assert.equal((await balance(friend)).bonus_credits, 10);
    await setup.query("update public.credits set day='2000-01-01' where key=$1", ["u:" + friend.id]);
    assert.equal((await credits.state(req(friend))).left, 15);
    assert.equal((await referrals.summary(owner)).enabled, false);
    assert.equal((await referrals.history(owner)).items[0].status, "rewarded");
    env.REFERRALS_ENABLED = "true";
  });
  const pausedOwner = await user("paused-owner", true), pausedFriend = await user("paused-friend", true); await attach(pausedOwner, pausedFriend);
  await check("pending export proof survives a reward pause; inviter summary resumes recovery", async () => {
    const pausedPaid = await charge(pausedFriend); env.REFERRALS_ENABLED = "false";
    assert.equal((await referrals.successfulExport(pausedFriend, pausedPaid._creditChargeIds.export)).paused, true);
    assert.equal((await balance(pausedFriend)).bonus_credits, 0);
    assert.equal((await db.query("select metadata->>'exportSucceeded' as proof from public.credit_transactions where id=$1", [pausedPaid._creditChargeIds.export])).rows[0].proof, "true");
    env.REFERRALS_ENABLED = "true"; referrals = newReferrals();
    const progress = await referrals.summary(pausedOwner); assert.equal(progress.rewarded, 1); assert.equal(progress.pending, 0);
    assert.equal((await balance(pausedOwner)).bonus_credits, 10); assert.equal((await balance(pausedFriend)).bonus_credits, 10);
  });
  const brokenOwner = await user("broken-owner", true), brokenFriend = await user("broken-friend", true); await attach(brokenOwner, brokenFriend);
  const brokenPaid = await charge(brokenFriend);
  await check("two grants/outbox/notifications rollback atomically then worker retries once", async () => {
    failRewardUser = [brokenOwner.id, brokenFriend.id].sort()[1];
    assert.equal((await referrals.successfulExport(brokenFriend, brokenPaid._creditChargeIds.export)).recoveryPending, true);
    assert.equal((await balance(brokenFriend)).bonus_credits, 0); assert.equal(await balance(brokenOwner), undefined);
    assert.equal((await db.query("select count(*)::int as n from public.notifications where entity_type='referral' and user_id=any($1::uuid[])", [[brokenFriend.id, brokenOwner.id]])).rows[0].n, 0);
    await prioritize(brokenFriend); const failed = await referrals.reconcile({ limit: 1 }); assert.equal(failed.rewarded, 0);
    const pending = (await db.query("select qualification_error_code,qualification_next_at>now() as delayed from public.referrals where invitee_id=$1", [brokenFriend.id])).rows[0];
    assert.equal(pending.qualification_error_code, "08006"); assert.equal(pending.delayed, true);
    failRewardUser = null; await prioritize(brokenFriend);
    assert.equal((await referrals.reconcile({ limit: 1 })).rewarded, 1);
    assert.equal((await referrals.qualify(brokenFriend.id)).rewarded, false);
  });
  const lateOwner = await user("late-owner", true), late = await user("late"); await attach(lateOwner, late); const latePaid = await charge(late);
  await referrals.successfulExport(late, latePaid._creditChargeIds.export);
  await check("Google linking AFTER export requalifies without a second debit", async () => {
    assert.equal((await balance(late)).bonus_credits, 0);
    await setup.query("update public.users set google_sub=$2 where id=$1", [late.id, "qa-google-" + late.id]);
    assert.equal((await referrals.retryForUser(late, { force: true })).rewarded, true);
    assert.equal((await balance(late)).bonus_credits, 10);
    assert.equal((await db.query("select count(*)::int as n from public.credit_transactions where user_id=$1 and kind='export'", [late.id])).rows[0].n, 1);
  });
  const verifiedOwner = await user("verified-owner", true), verifying = await user("verifying"); await attach(verifiedOwner, verifying); const verificationPaid = await charge(verifying);
  await referrals.successfulExport(verifying, verificationPaid._creditChargeIds.export);
  await check("successful email verification survives reward outage and can recover later", async () => {
    const token = await referrals.createVerification(verifying, { enforceCooldown: true });
    failProofUser = verifying.id;
    assert.equal((await referrals.verifyEmail(verifying, token.token)).success, true);
    assert.equal((await referrals.verifyEmail(verifying, token.token)).status, 400);
    assert.ok((await db.query("select email_verified_at from public.users where id=$1", [verifying.id])).rows[0].email_verified_at);
    await prioritize(verifying); assert.equal((await newReferrals().reconcile({ limit: 1 })).rewarded, 1);
  });
  const cooldownUser = await user("cooldown");
  await check("cross-request cooldown is durable, concurrent sends admit one and store hashes only", async () => {
    const burst = await Promise.all(Array.from({ length: 8 }, () => referrals.createVerification(cooldownUser, { enforceCooldown: true })));
    assert.equal(burst.filter(r => r.token).length, 1); assert.equal(burst.filter(r => r.status === 429 && r.retryAfter > 0 && r.retryAfter <= 60).length, 7);
    const first = burst.find(r => r.token);
    const attempts = (await db.query("select token_hash from public.referral_verification_attempts where user_id=$1", [cooldownUser.id])).rows;
    assert.equal(attempts.length, 1); assert.equal(attempts[0].token_hash, first.tokenHash); assert.notEqual(attempts[0].token_hash, first.token);
    assert.equal((await db.query("select token_hash from public.email_verification_tokens where user_id=$1", [cooldownUser.id])).rows[0].token_hash, first.tokenHash, "throttle does not invalidate the usable link");
  });
  await check("per-account max3/hour survives module restart and IP-independent requests", async () => {
    for (let i = 0; i < 2; i++) {
      await setup.query("update public.referral_verification_attempts set created_at=now()-interval '2 minutes' where user_id=$1", [cooldownUser.id]);
      assert.ok((await newReferrals().createVerification(cooldownUser, { enforceCooldown: true })).token);
    }
    await setup.query("update public.referral_verification_attempts set created_at=now()-interval '2 minutes' where user_id=$1", [cooldownUser.id]);
    const limited = await newReferrals().createVerification(cooldownUser, { enforceCooldown: true });
    assert.equal(limited.status, 429); assert.ok(limited.retryAfter > 60 && limited.retryAfter <= 3600);
    assert.equal((await db.query("select count(*)::int as n from public.referral_verification_attempts where user_id=$1", [cooldownUser.id])).rows[0].n, 3);
  });
  const capOwner = await user("cap-owner", true), capFriends = [];
  for (let i = 0; i < 12; i++) { const f = await user("cap-" + i, true); await attach(capOwner, f); const c = await charge(f); capFriends.push({ user: f, id: c._creditChargeIds.export }); }
  await check("concurrent10 monthly cap is terminal limited, not promised next month", async () => {
    await Promise.all(capFriends.map(f => referrals.successfulExport(f.user, f.id)));
    const statuses = (await db.query("select status,count(*)::int as n from public.referrals where inviter_id=$1 group by status", [capOwner.id])).rows;
    assert.equal(statuses.find(r => r.status === "rewarded").n, 10); assert.equal(statuses.find(r => r.status === "limited").n, 2);
    assert.equal((await balance(capOwner)).bonus_credits, 100);
    const limited = (await db.query("select invitee_id from public.referrals where inviter_id=$1 and status='limited' limit 1", [capOwner.id])).rows[0].invitee_id;
    await setup.query("update public.referrals set rewarded_at=now()-interval '2 months' where inviter_id=$1 and status='rewarded'", [capOwner.id]);
    assert.equal((await referrals.qualify(limited)).rewarded, false); assert.equal((await balance(capOwner)).bonus_credits, 100);
  });
  await check("owner-only encrypted pagination and progress disclose no invitee identities", async () => {
    const first = await referrals.history(capOwner, { limit: 5 }); assert.equal(first.items.length, 5); assert.equal(first.hasMore, true);
    const second = await referrals.history(capOwner, { limit: 5, cursor: first.nextCursor });
    assert.equal(second.items.length, 5); assert.equal(new Set([...first.items, ...second.items].map(i => i.id)).size, 10);
    const wire = JSON.stringify(first); for (const f of capFriends) { assert.ok(!wire.includes(f.user.id)); assert.ok(!wire.includes(f.user.email)); }
    assert.ok(!wire.includes("Private fixture") && !wire.includes("first_export_id"));
    assert.ok(!Buffer.from(first.nextCursor, "base64url").toString().includes(capFriends[0].user.id));
    assert.equal((await referrals.history(owner, { cursor: first.nextCursor })).status, 400);
    assert.equal((await referrals.history(capOwner, { cursor: first.nextCursor + "x" })).status, 400);
    assert.equal((await referrals.history(null)).status, 401); assert.equal((await referrals.history({ ...owner, role: "banned" })).status, 403);
    assert.equal((await referrals.history(capOwner, { limit: "1.5" })).status, 400);
    assert.equal((await referrals.summary(capOwner)).totalInvited, 12);
  });
  const refundedOwner = await user("refunded-owner", true), refundedUser = await user("refunded-user", true); await attach(refundedOwner, refundedUser);
  await check("refunded/invalid stale proof cannot reward; a later genuine success replaces it", async () => {
    const failed = await charge(refundedUser); await credits.refund(failed, "export");
    assert.equal((await referrals.successfulExport(refundedUser, failed._creditChargeIds.export)).rewarded, false);
    await setup.query("update public.referrals set first_export_id=$2 where invitee_id=$1", [refundedUser.id, failed._creditChargeIds.export]);
    assert.equal((await referrals.qualify(refundedUser.id)).rewarded, false);
    assert.equal((await referrals.history(refundedOwner)).items[0].status, "export_pending");
    const actual = await charge(refundedUser);
    assert.equal((await referrals.successfulExport(refundedUser, actual._creditChargeIds.export)).rewarded, true);
    assert.equal((await balance(refundedUser)).bonus_credits, 10);
  });
  const safeOwner = await user("safe-owner", true), bannedOwner = await user("banned-owner", true), bannedFriend = await user("banned-friend", true);
  await attach(bannedOwner, bannedFriend);
  await check("a ban committing during qualification blocks the reward atomically", async () => {
    const owner = await user("race-owner", true), friend = await user("race-friend");
    await attach(owner, friend); const debit = await charge(friend);
    await referrals.successfulExport(friend, debit._creditChargeIds.export);
    await setup.query("update public.users set email_verified_at=now() where id=$1", [friend.id]);
    const blocker = await setup.connect(); let pending;
    try {
      await blocker.query("begin"); await blocker.query("update public.users set role='banned' where id=$1", [friend.id]);
      pending = referrals.qualify(friend.id);
      await new Promise(resolve => setTimeout(resolve, 80));
      await blocker.query("commit");
      assert.equal((await pending).rewarded, false); assert.equal((await balance(friend)).bonus_credits, 0);
    } catch (error) { await blocker.query("rollback"); if (pending) await pending.catch(() => {}); throw error; }
    finally { blocker.release(); }
  });
  await check("self-referrals, changed attribution and banned-party rewards stay blocked", async () => {
    await attach(safeOwner, safeOwner);
    assert.equal((await db.query("select count(*)::int as n from public.referrals where invitee_id=$1", [safeOwner.id])).rows[0].n, 0);
    await attach(safeOwner, bannedFriend);
    assert.equal((await db.query("select inviter_id from public.referrals where invitee_id=$1", [bannedFriend.id])).rows[0].inviter_id, bannedOwner.id, "first stored attribution cannot be replaced");
    await setup.query("update public.users set role='banned' where id=$1", [bannedOwner.id]);
    const c = await charge(bannedFriend); assert.equal((await referrals.successfulExport(bannedFriend, c._creditChargeIds.export)).rewarded, false);
    await setup.query("update public.users set role='user' where id=$1", [bannedOwner.id]);
    await setup.query("update public.users set role='banned' where id=$1", [bannedFriend.id]);
    assert.equal((await referrals.qualify(bannedFriend.id)).rewarded, false);
    assert.equal((await referrals.history(bannedOwner)).items[0].status, "ineligible");
    assert.equal((await balance(bannedFriend)).bonus_credits, 0); assert.equal(await balance(bannedOwner), undefined);
  });
  console.log(`${checks.length} referral hardening checks passed (real isolated PostgreSQL; no provider delivery or production writes).`);
}
run().catch(error => { console.error(error); process.exitCode = 1; }).finally(async () => {
  referrals.stop();
  // Exact owned fixture IDs; do not erase the QA DB or another test's records.
  if (ids.length) {
    await setup.query("delete from public.credit_transactions where user_id=any($1::uuid[])", [ids]);
    await setup.query("delete from public.template_events where user_id=any($1::uuid[])", [ids]);
    await setup.query("delete from public.credits where key=any($1::text[])", [ids.map(id => "u:" + id)]);
    await setup.query("delete from public.users where id=any($1::uuid[])", [ids]);
  }
  await appPool.end(); await setup.end();
});
