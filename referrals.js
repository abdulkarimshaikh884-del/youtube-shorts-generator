"use strict";
const crypto = require("node:crypto");
const db = require("./db");
const credits = require("./credits");
const REWARD = 10;
const MONTHLY_LIMIT = 10;
const COOKIE = "sc_ref";
const enabled = () => process.env.REFERRALS_ENABLED === "true";
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
    const { rows } = await client.query(
      `select r.*, u.email_verified_at, u.google_sub, u.role as invitee_role, i.role as inviter_role,
              case when u.plan_until is null or u.plan_until > now() then u.plan else 'free' end as invitee_plan,
              case when i.plan_until is null or i.plan_until > now() then i.plan else 'free' end as inviter_plan
         from public.referrals r join public.users u on u.id = r.invitee_id
         join public.users i on i.id = r.inviter_id
        where r.invitee_id = $1 for update of r`, [inviteeId]);
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
    return { rewarded: true, creditsEach: REWARD };
  });
}
async function successfulExport(user, chargeId) {
  if (!enabled() || !user || !chargeId) return;
  // A client-side 'export' analytics event is never sufficient proof.
  await db.query(
    `update public.referrals set first_export_id = $2 where invitee_id = $1 and first_export_id is null
      and exists (select 1 from public.credit_transactions where id = $2 and user_id = $1 and kind = 'export' and amount < 0)`,
    [user.id, chargeId]);
  return qualify(user.id);
}
async function summary(user) {
  if (!enabled()) return { success: true, enabled: false };
  if (!user) return { error: "Please log in.", status: 401 };
  const code = crypto.randomBytes(12).toString("base64url");
  await db.query("insert into public.referral_codes (user_id, code) values ($1, $2) on conflict (user_id) do nothing", [user.id, code]);
  const own = await db.query("select code from public.referral_codes where user_id = $1", [user.id]);
  const stats = await db.query(
    `select count(*) filter (where status = 'rewarded')::int as rewarded,
            count(*) filter (where status = 'pending')::int as pending,
            count(*) filter (where status = 'rewarded' and rewarded_at >= date_trunc('month', now() at time zone 'UTC') at time zone 'UTC')::int as this_month
       from public.referrals where inviter_id = $1`, [user.id]);
  const state = await db.query("select email_verified_at, google_sub from public.users where id = $1", [user.id]);
  return { success: true, enabled: true, code: own.rows[0].code, reward: REWARD, monthlyLimit: MONTHLY_LIMIT,
    ...stats.rows[0], emailVerified: Boolean(state.rows[0]?.email_verified_at || state.rows[0]?.google_sub) };
}
async function createVerification(user) {
  const token = crypto.randomBytes(32).toString("base64url");
  await db.tx(async client => {
    await client.query("select pg_advisory_xact_lock(hashtext($1))", ["verify:" + user.id]);
    await client.query("delete from public.email_verification_tokens where user_id = $1 or expires_at < now()", [user.id]);
    await client.query("insert into public.email_verification_tokens (token_hash, user_id, email, expires_at) values ($1, $2, $3, now() + interval '24 hours')", [hash(token), user.id, user.email]);
  });
  return { token, tokenHash: hash(token) };
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
  await qualify(user.id);
  return { success: true };
}
module.exports = { enabled, capture, readCode, attachNewUser, qualify, successfulExport, summary, createVerification, verifyEmail, REWARD, MONTHLY_LIMIT };
