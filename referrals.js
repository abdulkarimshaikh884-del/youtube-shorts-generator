"use strict";
const crypto = require("node:crypto");
const db = require("./db");
const credits = require("./credits");
const REWARD = 10;
const MONTHLY_LIMIT = 10;
const COOKIE = "sc_ref";
const enabled = () => process.env.REFERRALS_ENABLED === "true";
const userId = user => user && typeof user.id === "string" && user.id.length <= 100 ? user.id : null;
const safeLog = error => console.warn("[referrals]", String(error?.code || "recovery_unavailable").replace(/[^A-Za-z0-9_]/g, "").slice(0, 40));
const schemaUnavailable = error => ["42P01", "42703"].includes(error?.code);
const hash = value => crypto.createHash("sha256").update(value).digest("hex");
const sign = value => crypto.createHmac("sha256", process.env.CREDITS_SECRET || "shortscraft-dev-secret").update("referral:" + value).digest("base64url");
function readCode(req) {
  if (!enabled()) return null;
  try {
    const raw = (req.headers.cookie || "").split(";").map(s => s.trim()).find(s => s.startsWith(COOKIE + "="));
    const [code, expires, signature] = String(raw?.slice(COOKIE.length + 1) || "").split(".");
    const expected = sign(code + "." + expires);
    if (!/^[A-Za-z0-9_-]{16}$/.test(code) || Number(expires) <= Date.now() || !signature || signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return null;
    return code;
  } catch { return null; }
}
function capture(req, res, next) {
  const code = req.query?.ref;
  if (enabled() && req.method === "GET" && typeof code === "string" && /^[A-Za-z0-9_-]{16}$/.test(code) && !readCode(req)) {
    // First valid attribution wins for 30 days. The DB validates the owner at signup.
    const value = code + "." + (Date.now() + 30 * 864e5);
    res.append("Set-Cookie", `${COOKIE}=${value}.${sign(value)}; Path=/; HttpOnly; SameSite=Lax; Max-Age=2592000${process.env.NODE_ENV === "production" ? "; Secure" : ""}`);
  }
  next();
}
async function attachNewUser(user, code, client) {
  if (!enabled() || !code) return;
  // Only called inside the new-account INSERT transaction; existing users cannot claim.
  await client.query(
    `insert into public.referrals (invitee_id, inviter_id)
     select $1, rc.user_id from public.referral_codes rc join public.users u on u.id = rc.user_id
      where rc.code = $2 and rc.user_id <> $1 and u.role <> 'banned'
     on conflict (invitee_id) do nothing`, [user.id, code]);
}
async function qualify(inviteeId) {
  if (!enabled()) return { rewarded: false };
  return db.tx(async client => {
    const initial = await client.query("select inviter_id from public.referrals where invitee_id = $1", [inviteeId]);
    if (!initial.rows[0]) return { rewarded: false };
    const inviterId = initial.rows[0].inviter_id;
    // Serialize all awards for this inviter; the cap and the two grants are atomic.
    await client.query("select pg_advisory_xact_lock(hashtext($1))", ["referral:" + inviterId]);
    // Eligibility and the grants share locks with account bans. A ban that
    // commits first must be visible; one that follows an award waits for it.
    await client.query("select id from public.users where id = any($1::uuid[]) order by id for share", [[inviterId, inviteeId].sort()]);
    const { rows } = await client.query(
      `select r.*, u.email_verified_at, u.google_sub, u.role as invitee_role, i.role as inviter_role,
              case when u.plan_until is null or u.plan_until > now() then u.plan else 'free' end as invitee_plan,
              case when i.plan_until is null or i.plan_until > now() then i.plan else 'free' end as inviter_plan
         from public.referrals r join public.users u on u.id = r.invitee_id
         join public.users i on i.id = r.inviter_id
        where r.invitee_id = $1
          and exists (select 1 from public.credit_transactions c
            where c.id = r.first_export_id and c.user_id = r.invitee_id and c.kind = 'export' and c.amount < 0
              and not exists (select 1 from public.credit_transactions f where f.idempotency_key = 'refund:' || c.id::text))
        for update of r`, [inviteeId]);
    const row = rows[0];
    if (!row || row.status !== "pending" || !row.first_export_id || (!row.email_verified_at && !row.google_sub) ||
        row.invitee_role === "banned" || row.inviter_role === "banned" || row.inviter_id === row.invitee_id) return { rewarded: false };
    const count = await client.query(
      `select count(*)::int as total from public.referrals where inviter_id = $1 and status = 'rewarded'
        and rewarded_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC'`, [inviterId]);
    if (Number(count.rows[0].total) >= MONTHLY_LIMIT) {
      await client.query("update public.referrals set status = 'limited' where invitee_id = $1", [inviteeId]);
      return { rewarded: false, limited: true };
    }
    // Deterministic credit lock order avoids a deadlock with another referral.
    for (const id of [inviterId, inviteeId].sort()) {
      const key = "u:" + id;
      await credits.ensureRecord(key, id === inviterId ? row.inviter_plan : row.invitee_plan, client);
      const grant = await client.query("update public.credits set bonus_credits = bonus_credits + $2 where key = $1 returning left_credits, bonus_credits", [key, REWARD]);
      await client.query(
        `insert into public.credit_transactions (credit_key, user_id, kind, amount, balance_after, idempotency_key, metadata)
         values ($1, $2, 'admin_adjustment', $3, $4, $5, $6::jsonb)`,
        [key, id, REWARD, Number(grant.rows[0].left_credits) + Number(grant.rows[0].bonus_credits),
          `referral:${inviteeId}:${id}`, JSON.stringify({ type: "referral_reward", inviteeId, inviterId })]);
    }
    await client.query("update public.referrals set status = 'rewarded', rewarded_at = now() where invitee_id = $1", [inviteeId]);
    for (const id of [inviterId, inviteeId]) {
      await require("./notify").toUser(client, id, { type: "system", entityType: "referral", entityId: "referral:" + sign(id + ":" + inviteeId).slice(0, 24),
        message: `You received ${REWARD} bonus credits for a qualifying referral.` });
      await require("./email-events").enqueueSafe({userId:id,kind:"referral_reward",eventKey:inviteeId,data:{credits:REWARD}},client);
    }
    return { rewarded: true, creditsEach: REWARD };
  });
}
async function successfulExport(user, chargeId) {
  if (!userId(user) || !chargeId) return { rewarded: false };
  // Only the trusted render-success handler calls this. Commit that server
  // fact to the charged ledger BEFORE touching referral qualification. A
  // debit or browser analytics event alone is never proof of completion.
  try {
    const marked = await db.query(
      `update public.credit_transactions c set metadata = coalesce(c.metadata, '{}'::jsonb) ||
         jsonb_build_object('exportSucceeded', true, 'exportSucceededAt', coalesce(c.metadata->>'exportSucceededAt', now()::text))
       where c.id = $1 and c.user_id = $2 and c.kind = 'export' and c.amount < 0
         and exists (select 1 from public.referrals r where r.invitee_id = $2 and r.status = 'pending')
         and not exists (select 1 from public.credit_transactions f where f.idempotency_key = 'refund:' || c.id::text)
       returning c.id`, [chargeId, user.id]);
    if (!marked.rows[0]) return { rewarded: false };
  } catch (error) {
    if (!schemaUnavailable(error)) safeLog(error);
    return { rewarded: false, recoveryPending: true };
  }
  // Pending referrals retain their genuine completion proof during a pause.
  // The flag controls NEW awards, not already-earned bonus spending.
  if (!enabled()) return { rewarded: false, paused: true };
  try { await attachExportProof(user.id, chargeId); return await qualify(user.id); }
  catch (error) { safeLog(error); return { rewarded: false, recoveryPending: true }; }
}
async function attachExportProof(inviteeId, chargeId = null) {
  await db.query(
    `update public.referrals set first_export_id = coalesce($2::uuid, (
       select c.id from public.credit_transactions c where c.user_id = $1 and c.kind = 'export' and c.amount < 0
         and c.metadata->>'exportSucceeded' = 'true'
         and not exists (select 1 from public.credit_transactions f where f.idempotency_key = 'refund:' || c.id::text)
       order by c.created_at, c.id limit 1))
     where invitee_id = $1 and status = 'pending'
       and (first_export_id is null or not exists (
         select 1 from public.credit_transactions old where old.id = first_export_id
           and old.user_id = $1 and old.kind = 'export' and old.amount < 0
           and not exists (select 1 from public.credit_transactions f where f.idempotency_key = 'refund:' || old.id::text)))
       and exists (select 1 from public.credit_transactions c where c.user_id = $1 and c.kind = 'export' and c.amount < 0
         and ($2::uuid is null or c.id = $2::uuid) and c.metadata->>'exportSucceeded' = 'true'
         and not exists (select 1 from public.credit_transactions f where f.idempotency_key = 'refund:' || c.id::text))`,
    [inviteeId, chargeId]);
}
async function summary(user) {
  if (!userId(user)) return enabled() ? { error: "Please log in.", status: 401 } : { success: true, enabled: false };
  if (user.role === "banned") return { error: "This account is unavailable.", status: 403 };
  await retryForUser(user);
  try {
  const code = crypto.randomBytes(12).toString("base64url");
  if (enabled()) await db.query("insert into public.referral_codes (user_id, code) values ($1, $2) on conflict (user_id) do nothing", [user.id, code]);
  const own = await db.query("select code from public.referral_codes where user_id = $1", [user.id]);
  const stats = await db.query(
    `select count(*) filter (where status = 'rewarded')::int as rewarded,
            count(*) filter (where status = 'pending')::int as pending,
            count(*) filter (where status = 'rewarded' and rewarded_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')::int as this_month,
            count(*) filter (where status = 'limited')::int as limited, count(*)::int as total_invited
       from public.referrals where inviter_id = $1`, [user.id]);
  const state = await db.query("select email_verified_at, google_sub from public.users where id = $1", [user.id]);
  const earned = await db.query(`select coalesce(sum(amount), 0)::int as total from public.credit_transactions
    where user_id = $1 and amount > 0 and metadata->>'type' = 'referral_reward'`, [user.id]);
  const counts = stats.rows[0] || {};
  return { success: true, enabled: enabled(), available: true, code: own.rows[0]?.code || null, reward: REWARD, monthlyLimit: MONTHLY_LIMIT,
    ...counts, totalInvited: Number(counts.total_invited) || 0, bonusEarned: Number(earned.rows[0]?.total) || 0,
    monthlyRemaining: Math.max(0, MONTHLY_LIMIT - (Number(counts.this_month) || 0)), capReached: Number(counts.this_month) >= MONTHLY_LIMIT,
    emailVerified: Boolean(state.rows[0]?.email_verified_at || state.rows[0]?.google_sub) };
  } catch (error) {
    if (!enabled() && schemaUnavailable(error)) return { success: true, enabled: false, available: false, reward: REWARD, monthlyLimit: MONTHLY_LIMIT };
    throw error;
  }
}
async function verificationCooldown(user, client = db) {
  if (!userId(user)) return { error: "Please log in first.", status: 401 };
  const result = await client.query(`select count(*)::int as total, min(created_at) as oldest, max(created_at) as newest
    from public.referral_verification_attempts where user_id = $1 and created_at > now() - interval '1 hour'`, [user.id]);
  const row = result.rows[0] || {};
  const retryAfter = Number(row.total) >= 3 ? Math.ceil((new Date(row.oldest).getTime() + 3600_000 - Date.now()) / 1000)
    : row.newest ? Math.ceil((new Date(row.newest).getTime() + 60_000 - Date.now()) / 1000) : 0;
  return retryAfter > 0 ? { error: "Please wait before requesting another verification email.", status: 429, retryAfter } : { allowed: true };
}
async function createVerification(user, { enforceCooldown = true } = {}) {
  if (!userId(user)) return { error: "Please log in first.", status: 401 };
  const token = crypto.randomBytes(32).toString("base64url");
  const created = await db.tx(async client => {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", ["verify:" + user.id]);
    if (enforceCooldown) { const cooldown = await verificationCooldown(user, client); if (cooldown.error) return cooldown; }
    await client.query("delete from public.email_verification_tokens where user_id = $1 or expires_at < now()", [user.id]);
    await client.query("insert into public.email_verification_tokens (token_hash, user_id, email, expires_at) values ($1, $2, $3, now() + interval '24 hours')", [hash(token), user.id, user.email]);
    if (enforceCooldown) await client.query("insert into public.referral_verification_attempts (user_id, token_hash) values ($1, $2)", [user.id, hash(token)]);
    return { token, tokenHash: hash(token) };
  });
  return created;
}
async function verifyEmail(user, token) {
  if (!user || typeof token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(token)) return { error: "Invalid verification link.", status: 400 };
  const verified = await db.tx(async client => {
    const claim = await client.query(
      `delete from public.email_verification_tokens where token_hash = $1 and user_id = $2 and expires_at > now() returning email`, [hash(token), user.id]);
    if (!claim.rows[0]) return false;
    const updated = await client.query("update public.users set email_verified_at = now() where id = $1 and email = $2 returning id", [user.id, claim.rows[0].email]);
    return Boolean(updated.rows[0]);
  });
  if (!verified) return { error: "This link expired, was already used, or belongs to another account.", status: 400 };
  await retryForUser(user, { force: true });
  return { success: true };
}
// Cursor payloads are authenticated AND encrypted. They disclose neither the
// invitee UUID nor another user's identity, and cannot be replayed by an owner
// other than the one who requested the page.
const cursorKey = () => crypto.createHash("sha256").update("referral-history:" + (process.env.CREDITS_SECRET || "shortscraft-dev-secret")).digest();
function makeCursor(ownerId, row) {
  const nonce = crypto.randomBytes(12), cipher = crypto.createCipheriv("aes-256-gcm", cursorKey(), nonce);
  const content = Buffer.from(JSON.stringify({ ownerId, at: row.created_at, id: row.invitee_id, expires: Date.now() + 864e5 }));
  return Buffer.concat([nonce, cipher.update(content), cipher.final(), cipher.getAuthTag()]).toString("base64url");
}
function readCursor(value, ownerId) {
  if (!value) return null;
  if (typeof value !== "string" || value.length > 700 || !/^[A-Za-z0-9_-]+$/.test(value)) throw Error("Invalid cursor");
  const raw = Buffer.from(value, "base64url");
  if (raw.length < 29 || raw.toString("base64url") !== value) throw Error("Invalid cursor");
  const decipher = crypto.createDecipheriv("aes-256-gcm", cursorKey(), raw.subarray(0, 12));
  decipher.setAuthTag(raw.subarray(-16));
  const cursor = JSON.parse(Buffer.concat([decipher.update(raw.subarray(12, -16)), decipher.final()]).toString());
  if (cursor.ownerId !== ownerId || !Number.isFinite(cursor.expires) || cursor.expires <= Date.now() || !Number.isFinite(Date.parse(cursor.at)) || typeof cursor.id !== "string" || cursor.id.length > 100) throw Error("Invalid cursor");
  return cursor;
}
async function history(user, options = {}) {
  if (!userId(user)) return { error: "Please log in first.", status: 401 };
  if (user.role === "banned") return { error: "This account is unavailable.", status: 403 };
  const limit = options.limit == null || options.limit === "" ? 10 : Number(options.limit);
  if (!Number.isInteger(limit) || limit < 1) return { error: "Invalid page size.", status: 400 };
  let cursor;
  try { cursor = readCursor(options.cursor, user.id); } catch { return { error: "Invalid referral page. Reload your history.", status: 400 }; }
  const pageSize = Math.min(limit, 20);
  try {
    const result = await db.query(`select r.invitee_id, r.status, r.created_at::text as created_at, r.rewarded_at,
      exists (select 1 from public.credit_transactions c where c.user_id = r.invitee_id and c.kind = 'export' and c.amount < 0
        and (c.id = r.first_export_id or c.metadata->>'exportSucceeded' = 'true')
        and not exists (select 1 from public.credit_transactions f where f.idempotency_key = 'refund:' || c.id::text)) as exported,
      (u.email_verified_at is not null or u.google_sub is not null) as verified,
      u.role = 'banned' as blocked from public.referrals r join public.users u on u.id = r.invitee_id
      where r.inviter_id = $1 ${cursor ? "and (r.created_at, r.invitee_id) < ($2::timestamptz, $3::uuid)" : ""}
      order by r.created_at desc, r.invitee_id desc limit $${cursor ? 4 : 2}`, cursor ? [user.id, cursor.at, cursor.id, pageSize + 1] : [user.id, pageSize + 1]);
    const hasMore = result.rows.length > pageSize, rows = result.rows.slice(0, pageSize);
    return { success: true, available: true, enabled: enabled(), items: rows.map(row => {
      const id = crypto.createHmac("sha256", cursorKey()).update(user.id + ":" + row.invitee_id).digest("hex").slice(0, 24);
      const status = row.status === "rewarded" || row.status === "limited" ? row.status : row.blocked ? "ineligible" : !row.verified ? "unverified" : row.exported ? "reward_pending" : "export_pending";
      return { id, displayLabel: "Referral " + id.slice(0, 6), status, createdAt: new Date(row.created_at).toISOString(),
        rewardedAt: row.rewarded_at ? new Date(row.rewarded_at).toISOString() : null, credits: status === "rewarded" ? REWARD : 0 };
    }), hasMore, nextCursor: hasMore ? makeCursor(user.id, rows[rows.length - 1]) : null };
  } catch (error) {
    if (!enabled() && schemaUnavailable(error)) return { success: true, enabled: false, available: false, items: [], hasMore: false, nextCursor: null };
    throw error;
  }
}

const recentRecovery = new Map();
async function retryForUser(user, { force = false } = {}) {
  if (!enabled() || !userId(user) || user.role === "banned") return { rewarded: false };
  if (!force && (recentRecovery.get(user.id) || 0) > Date.now() - 5000) return { rewarded: false, recoveryPending: true };
  recentRecovery.set(user.id, Date.now());
  if (recentRecovery.size > 1000) recentRecovery.delete(recentRecovery.keys().next().value);
  try {
    await attachExportProof(user.id);
    const own = await qualify(user.id);
    // Opening the inviter's progress also retries a small, owner-scoped batch.
    // It cannot synthesize qualification from a click, analytics or a debit.
    const invited = await db.query(`select r.invitee_id from public.referrals r join public.users u on u.id = r.invitee_id
      where r.inviter_id = $1 and r.status = 'pending' and u.role <> 'banned'
        and (u.email_verified_at is not null or u.google_sub is not null)
        and exists (select 1 from public.credit_transactions c where c.user_id = r.invitee_id and c.kind = 'export' and c.amount < 0
          and (c.id = r.first_export_id or c.metadata->>'exportSucceeded' = 'true')
          and not exists (select 1 from public.credit_transactions f where f.idempotency_key = 'refund:' || c.id::text))
      order by r.created_at, r.invitee_id limit 3`, [user.id]);
    let recoveredInvites = 0;
    for (const row of invited.rows) { await attachExportProof(row.invitee_id); if ((await qualify(row.invitee_id)).rewarded) recoveredInvites++; }
    return { ...own, recoveredInvites };
  }
  catch (error) { safeLog(error); return { rewarded: false, recoveryPending: true }; }
}
let timer = null, running = null;
async function reconcile({ limit = 20 } = {}) {
  if (!enabled()) return { enabled: false, checked: 0 };
  if (running) return running;
  const batch = Math.min(20, Math.max(1, Math.floor(Number(limit)) || 20));
  running = (async () => {
    const selected = await db.tx(async client => {
      const lock = await client.query("select pg_try_advisory_xact_lock(hashtext('shortscraft-referral-reconcile')) as acquired");
      if (!lock.rows[0]?.acquired) return [];
      const candidates = await client.query(`select r.invitee_id from public.referrals r
        join public.users u on u.id = r.invitee_id join public.users i on i.id = r.inviter_id
        where r.status = 'pending' and r.qualification_next_at <= now()
          and (u.email_verified_at is not null or u.google_sub is not null) and u.role <> 'banned' and i.role <> 'banned'
          and exists (select 1 from public.credit_transactions c where c.user_id = r.invitee_id and c.kind = 'export' and c.amount < 0
            and (c.id = r.first_export_id or c.metadata->>'exportSucceeded' = 'true')
            and not exists (select 1 from public.credit_transactions f where f.idempotency_key = 'refund:' || c.id::text))
        order by r.qualification_next_at, r.created_at, r.invitee_id limit $1 for update of r skip locked`, [batch]);
      for (const row of candidates.rows) await client.query(`update public.referrals set qualification_attempts = least(qualification_attempts + 1, 1000000),
        qualification_next_at = now() + interval '30 seconds' where invitee_id = $1`, [row.invitee_id]);
      await client.query(`delete from public.referral_verification_attempts where id in
        (select id from public.referral_verification_attempts where created_at < now() - interval '2 days' limit 500)`);
      return candidates.rows;
    });
    let rewarded = 0;
    for (const row of selected) {
      try { await attachExportProof(row.invitee_id); const result = await qualify(row.invitee_id); if (result.rewarded) rewarded++; }
      catch (error) {
        safeLog(error);
        await db.query(`update public.referrals set qualification_error_code = $2,
          qualification_next_at = now() + least(900, 30 * power(2, least(qualification_attempts, 5))) * interval '1 second'
          where invitee_id = $1 and status = 'pending'`, [row.invitee_id, String(error.code || "qualification_failed").replace(/[^A-Za-z0-9_]/g, "").slice(0, 40)]).catch(safeLog);
      }
    }
    return { enabled: true, checked: selected.length, rewarded };
  })().catch(error => { safeLog(error); return { enabled: true, available: false, checked: 0 }; }).finally(() => { running = null; });
  return running;
}
function start() {
  if (!enabled() || timer) return;
  timer = setInterval(() => { void reconcile(); }, 30_000); timer.unref(); void reconcile();
}
function stop() { if (timer) clearInterval(timer); timer = null; }
module.exports = { enabled, capture, readCode, attachNewUser, qualify, successfulExport, summary, history, retryForUser, reconcile, start, stop,
  createVerification, verificationCooldown, verifyEmail, REWARD, MONTHLY_LIMIT };
