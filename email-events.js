"use strict";
// Private durable outbox. A queued/accepted email is NOT proof of inbox delivery.
const crypto = require("crypto");
const db = require("./db");
const mailer = require("./mailer");
const releasePolicy = require("./release-policy");
const MONEY = new Set(["purchase_receipt", "withdrawal_requested", "withdrawal_processed", "withdrawal_rejected"]);
const KINDS = new Set(["welcome", "new_device", "password_changed", "google_linked", "referral_reward", "support_reply", "template_status", ...MONEY]);
const RETRY_WINDOW_HOURS = 23; // Resend's key retention is 24 hours; never blindly retry past it.
function enabled() { return process.env.TRANSACTIONAL_EMAILS_ENABLED === "true" && mailer.configured(); }
function safeLog(code) { console.warn("[email-events]", String(code || "unavailable").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)); }

async function enqueue(event, client = null) {
  if (!enabled() || !event || !KINDS.has(event.kind)) return false;
  if (MONEY.has(event.kind) && !releasePolicy.monetizationEnabled) return false;
  if (!/^[0-9a-f-]{36}$/i.test(String(event.userId)) || !String(event.eventKey || "") || String(event.eventKey).length > 300) return false;
  // Each event is scoped to both recipient and type; duplicate callbacks don't
  // cause a second email, even after the provider's idempotency window expires.
  const key = crypto.createHash("sha256").update(JSON.stringify([event.userId, event.kind, event.eventKey])).digest("hex");
  const savepoint = "mail_" + crypto.randomBytes(8).toString("hex");
  const query = client || db;
  let saved = false;
  try {
    if (client) { await client.query("savepoint " + savepoint); saved = true; }
    const { rows } = await query.query("select email from public.users where id = $1", [event.userId]);
    const to = rows[0] && rows[0].email;
    if (!to || /\.invalid$/i.test(to) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
      if (saved) await client.query("release savepoint " + savepoint);
      return false;
    }
    // Freeze the payload now: retries must not reuse a key with new content.
    const payload = mailer.transactionalPayload({ to, kind: event.kind, data: event.data || {} });
    const result = await query.query(`insert into public.email_outbox (event_key,user_id,kind,payload,priority)
      values ($1,$2,$3,$4::jsonb,$5) on conflict(event_key) do nothing returning id`,
    [key, event.userId, event.kind, JSON.stringify(payload), ["new_device", "password_changed", "google_linked"].includes(event.kind) ? 0 : 1]);
    if (saved) await client.query("release savepoint " + savepoint);
    return result.rows.length > 0;
  } catch (err) {
    if (saved) {
      try { await client.query("rollback to savepoint " + savepoint); await client.query("release savepoint " + savepoint); }
      catch { safeLog("savepoint_recovery_failed"); }
    }
    safeLog(err.code || "enqueue_failed");
    return false;
  }
}
const enqueueSafe = enqueue;

async function claim() {
  return db.tx(async client => {
    // Serialize budget accounting across instances without holding a database
    // lock while doing network I/O. Default leaves room for direct reset mails.
    await client.query("select pg_advisory_xact_lock(hashtext('shortscraft-email-budget'))");
    const pace = await client.query("select 1 from public.email_outbox where last_attempt_at>now()-interval '1 second' limit 1");
    if (pace.rows.length) return null;
    await client.query(`update public.email_outbox set status='review',lease_until=null,last_error='retry_window_expired'
      where status in ('pending','sending') and first_attempt_at < now()-interval '${RETRY_WINDOW_HOURS} hours'`);
    await client.query("update public.email_outbox set status='cancelled',payload='{}' where status='pending' and first_attempt_at is null and created_at<now()-interval '7 days'");
    const cap = Math.max(1, Math.min(Number(process.env.TRANSACTIONAL_EMAILS_DAILY_LIMIT) || 60, 500));
    const usage = await client.query("select count(*)::int as n from public.email_outbox where first_attempt_at >= now()-interval '24 hours'");
    const row = await client.query(`select * from public.email_outbox
      where (status='pending' and next_attempt_at<=now() or status='sending' and lease_until<now())
        and attempts<5 and created_at>now()-interval '7 days'
        and (first_attempt_at is not null or $1)
      order by priority,created_at for update skip locked limit 1`, [usage.rows[0].n < cap]);
    if (!row.rows[0]) return null;
    const result = await client.query(`update public.email_outbox set status='sending',attempts=attempts+1,
      lease_until=now()+interval '2 minutes',last_attempt_at=now(),first_attempt_at=coalesce(first_attempt_at,now()) where id=$1 returning *`, [row.rows[0].id]);
    return result.rows[0];
  });
}

let running = null, timer = null, scheduled = false;
async function flush() {
  if (!enabled()) return;
  if (running) return running;
  running = (async () => {
    // Bounded work keeps a web service responsive; the next sweep resumes it.
    for (let i = 0; i < 3; i++) {
      const row = await claim();
      if (!row) break;
      try {
        if (MONEY.has(row.kind) && !releasePolicy.monetizationEnabled) {
          await db.query("update public.email_outbox set status='cancelled',payload='{}',lease_until=null where id=$1", [row.id]);
          continue;
        }
        // If the account has been deleted or changed email, don't send to its
        // old address. Cancellation retains the deduplication marker.
        const recipient = await db.query("select email from public.users where id=$1", [row.user_id]);
        if (!recipient.rows[0] || recipient.rows[0].email !== row.payload.to[0]) {
          await db.query("update public.email_outbox set status='cancelled',payload='{}',lease_until=null where id=$1", [row.id]);
          continue;
        }
        const sent = await mailer.sendTransactional(row.payload, row.event_key);
        await db.query("update public.email_outbox set status='accepted',provider_id=$2,accepted_at=now(),lease_until=null,last_error=null where id=$1", [row.id,sent.id]);
      } catch (err) {
        const status = err.permanent || row.attempts >= 5 ? "review" : "pending";
        const delay = Math.min(3600, 60 * 2 ** row.attempts);
        await db.query(`update public.email_outbox set status=$2,lease_until=null,last_error=$3,
          next_attempt_at=now()+$4*interval '1 second' where id=$1`, [row.id,status,err.status ? "provider_"+err.status : "delivery_uncertain",delay]);
        // Provider throttling/authorization outage: do not hammer other rows.
        if ([401,403,429].includes(err.status)) break;
      }
    }
    // Keep dedupe markers while minimising persisted PII; never requeue history.
    await db.query(`update public.email_outbox set payload='{}' where status in ('accepted','cancelled','review')
      and created_at<now()-interval '7 days' and payload<>'{}'::jsonb`);
  })().catch(err => safeLog(err.code || "worker_failed")).finally(() => { running = null; });
  return running;
}
function schedule() {
  if (!enabled() || scheduled) return;
  scheduled = true;
  const job = setTimeout(() => { scheduled = false; void flush(); }, 250);
  job.unref();
}
function start() {
  if (timer || !enabled()) return;
  timer = setInterval(() => void flush(), 60_000); timer.unref(); schedule();
}
module.exports = { enabled, enqueue, enqueueSafe, flush, schedule, start };
