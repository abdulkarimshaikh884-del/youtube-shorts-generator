/* ============================================================
   credits.js — server-side credit ledger, backed by Postgres.

   Why server-side: the old UI kept a credit count in the browser, which any
   user can reset by clearing storage. Charging happens here, next to the work
   that costs money (an AI call or a CPU-heavy render).

   Identity: a signed-in visitor is billed against their account; everyone
   else gets a signed anonymous id in an HttpOnly cookie. The signature stops
   someone minting a fresh id by hand; clearing cookies still gets a new
   allowance, which is the honest limit of an anonymous system and is why the
   daily grant is small.

   Storage: public.credits in Supabase, one row per identity. Was a single
   JSON file, which meant a redeploy on a host with an ephemeral filesystem
   wiped every balance — Postgres survives that.
   ============================================================ */
const crypto = require("crypto");
const db = require("./db");

const COOKIE = "sc_uid";

/* Prices are in whole rupees. `inr` is the display string, `price` the number
   Razorpay is charged (x100 for paise). `term` is what the payment buys:
     month    — renews monthly
     lifetime — never expires, but only for the first LIFETIME_SLOTS buyers;
                after those are gone Pro Max falls back to `year`.

   How the tiers are drawn, and why:

   Editing, previewing and browsing are pure client-side CSS and cost us
   nothing, so they are unlimited on every plan — throttling them would only
   make the product feel mean without saving a rupee.

   Exporting is the expensive part: each render is Chromium plus ffmpeg, and
   exports are serialised, so one long export blocks the queue for everyone.
   Measured on a fast machine: 720p/4s ≈ 14s, 1080p/6s ≈ 19s, 1080p/12s ≈ 38s,
   and a small cloud instance is several times slower again. That is the real
   constraint, so that is what the plans price.

   The earlier numbers (10/100/300 a day) were written before anyone measured
   this. 300 exports a day sold ONCE as a lifetime deal is several hours of
   dedicated CPU per user per day, forever, for ₹499 — the deal would have cost
   far more to honour than it brought in. These caps sit above what a working
   Shorts creator actually needs (a few posts a day, a couple of takes each)
   while staying survivable if every seat is sold.

   The paid tiers therefore lead on capability, not volume: no watermark and a
   higher resolution ceiling are what people are really buying. */
/* Kept as a compatibility export for older callers. Lifetime sales are no
   longer offered; every paid plan has a monthly and yearly billing option. */
const LIFETIME_SLOTS = 0;

const PLANS = {
  free: {
    id: "free", label: "Free", price: 0, inr: "₹0", term: "forever",
    // Enough for a real first session: try a few templates, export them, and
    // still have room to generate one or two AI scenes. Below this the trial
    // stops proving anything, which costs signups rather than saving CPU.
    perDay: 5,
    monthlyCredits: 150,
    yearlyPrice: 0,
    starsPerMonth: 5,
    watermark: true,
    maxHeight: 480
  },
  pro: {
    id: "pro", label: "Pro", price: 199, inr: "₹199", term: "month",
    yearlyPrice: 1999,
    perDay: 40,
    monthlyCredits: 1200,
    starsPerMonth: 25,
    watermark: false,
    maxHeight: 1080
  },
  promax: {
    id: "promax", label: "Pro Max", price: 399, inr: "₹399",
    yearlyPrice: 3999,
    term: "month",
    perDay: 100,
    monthlyCredits: 3000,
    starsPerMonth: 60,
    watermark: false,
    maxHeight: 1440
  }
};

/* ── what things cost ─────────────────────────────────────
   Priced by what each one actually costs us to serve.

   An export is Chromium plus ffmpeg — 14 to 38 seconds of CPU, serialised, so
   it also blocks the queue for everyone else. An AI scene is a single model
   call: a few seconds, and cheap. Animate was priced at 5 against export's 1,
   which had it backwards — the cheaper operation cost the user five times
   more, and on the Free grant a single export left them unable to try the AI
   feature at all that day. That is the headline feature; it should not be the
   one a new user cannot reach.

   Note that generating a scene does not produce a video on its own — the user
   still pays an export credit to render it — so the AI path is billed twice
   over its life, which is the right shape. */
const COST = {
  export: 1,      // rendering a template project to MP4 — the expensive one
  animate: 2,     // compatibility alias for the standard model
  aiStandard: 2,
  aiDetailed: 5,
  aiAdvanced: 8
};

const secret = () => process.env.CREDITS_SECRET || "shortscraft-dev-secret";

function sign(id) {
  return crypto.createHmac("sha256", secret()).update(id).digest("base64url").slice(0, 22);
}
function newId() {
  const id = crypto.randomBytes(9).toString("base64url");
  return id + "." + sign(id);
}
function validId(token) {
  if (typeof token !== "string" || token.length < 12 || token.length > 80) return null;
  const dot = token.lastIndexOf(".");
  if (dot < 1) return null;
  const id = token.slice(0, dot);
  const sig = token.slice(dot + 1);
  const want = sign(id);
  if (sig.length !== want.length) return null;
  return crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(want)) ? token : null;
}

const today = () => new Date().toISOString().slice(0, 10);

/* Returns the current row for `key`, resetting it first if the day has
   rolled over or the account's plan changed (an upgrade takes effect at
   once — fresh grant — rather than waiting for midnight). `planHint` comes
   from the signed-in account, which is the source of truth for the plan. */
async function ensureRecord(key, planHint, executor = db) {
  const day = today();
  const { rows } = await executor.query(`select * from public.credits where key = $1`, [key]);
  let rec = rows[0] || null;

  const wanted = PLANS[planHint] ? planHint : (rec && PLANS[rec.plan] ? rec.plan : "free");

  if (!rec || rec.day !== day || rec.plan !== wanted) {
    const perDay = PLANS[wanted].perDay;
    const since = rec ? rec.since : day;
    const { rows: upserted } = await executor.query(
      `insert into public.credits (key, day, plan, left_credits, spent, since)
       values ($1, $2, $3, $4, 0, $5)
       on conflict (key) do update
         set day = excluded.day, plan = excluded.plan,
             left_credits = excluded.left_credits, spent = 0
       returning *`,
      [key, day, wanted, perDay, since]
    );
    rec = upserted[0];
    await executor.query(
      `insert into public.credit_transactions
         (credit_key, user_id, kind, amount, balance_after, idempotency_key, metadata)
       values ($1, $2, 'grant', $3, $3, $4, $5::jsonb)
       on conflict (idempotency_key) where idempotency_key is not null do nothing`,
      [key, key.startsWith("u:") ? key.slice(2) : null, perDay,
       `grant:${key}:${day}:${wanted}`, JSON.stringify({ plan: wanted, day })]
    );
  } else {
    /* Same day, same plan — but the plan's daily allowance itself may have
       been changed since this row was granted. Nothing above re-grants in
       that case, so the row kept yesterday's number and the UI showed
       balances like "8 / 5": more credits left than the plan even gives.

       Credits only move through grant, charge and refund, so the day's
       balance is always `perDay - spent`. Restating that heals a row whether
       the allowance went up or down, and never hands back credits that were
       already spent. */
    const perDay = PLANS[wanted].perDay;
    const correct = Math.max(0, perDay - (Number(rec.spent) || 0));
    if (Number(rec.left_credits) !== correct) {
      const { rows: fixed } = await executor.query(
        `update public.credits set left_credits = $2 where key = $1 returning *`,
        [key, correct]
      );
      rec = fixed[0] || rec;
    }
  }
  return rec;
}

/* ── public API ───────────────────────────────────────────── */

/* Attaches req.credits = {key, token, signedIn}.

   Deliberately does NO database work: it only resolves which identity would be
   billed. Most requests never spend a credit, and the database is a few
   hundred milliseconds away, so touching the ledger on every request made the
   whole API pay for a row almost nothing reads. state(), charge() and refund()
   each call ensureRecord() themselves, so the row is created the first time it
   actually matters.

   Runs AFTER auth.middleware: a signed-in visitor is billed against their
   account, everyone else against a signed anonymous cookie. */
function middleware(req, res, next) {
  const raw = (req.headers.cookie || "")
    .split(";")
    .map((c) => c.trim())
    .find((c) => c.startsWith(COOKIE + "="));
  let token = raw ? validId(decodeURIComponent(raw.slice(COOKIE.length + 1))) : null;

  if (!token) {
    token = newId();
    const line = `${COOKIE}=${encodeURIComponent(token)}; Path=/; Max-Age=31536000; HttpOnly; SameSite=Lax` +
      (process.env.NODE_ENV === "production" ? "; Secure" : "");
    const prev = res.getHeader("Set-Cookie");
    res.setHeader("Set-Cookie", prev ? [].concat(prev, line) : line);
  }

  const user = req.user || null;
  req.credits = {
    key: user ? "u:" + user.id : token,
    token,
    signedIn: !!user
  };
  next();
}

async function state(req) {
  const rec = await ensureRecord(req.credits.key, req.user ? req.user.plan : null);
  const plan = PLANS[rec.plan] || PLANS.free;
  return {
    left: rec.left_credits,
    perDay: plan.perDay,
    monthlyCredits: plan.monthlyCredits,
    spentToday: rec.spent,
    plan: plan.id,
    planLabel: plan.label,
    watermark: plan.watermark === true,
    maxHeight: plan.maxHeight,
    signedIn: !!req.user,
    email: req.user ? req.user.email : null,
    cost: COST,
    resetsAt: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString()
  };
}

/* What this request is entitled to, resolved from the ledger — never from
   anything the client sent. The export route asks this before rendering, so a
   crafted request cannot drop the watermark or ask for a resolution the plan
   does not include. */
async function entitlements(req) {
  const rec = await ensureRecord(req.credits.key, req.user ? req.user.plan : null);
  const plan = PLANS[rec.plan] || PLANS.free;
  return {
    plan: plan.id,
    planLabel: plan.label,
    watermark: plan.watermark === true,
    maxHeight: plan.maxHeight
  };
}

/* Charge before doing the work. Returns {ok, left} or {ok:false, need, left}.
   The decrement is one atomic UPDATE guarded by left_credits >= cost, so two
   concurrent requests cannot both succeed past a balance that only covers one. */
const TRANSACTION_KIND = {
  export: "export",
  animate: "ai_standard",
  aiStandard: "ai_standard",
  aiDetailed: "ai_detailed",
  aiAdvanced: "ai_advanced"
};

function operationKey(req, kind) {
  req._creditOperationKeys = req._creditOperationKeys || {};
  if (req._creditOperationKeys[kind]) return req._creditOperationKeys[kind];
  const supplied = String(req.get?.("Idempotency-Key") || req.body?.idempotencyKey || "").trim();
  const safe = /^[a-zA-Z0-9._:-]{12,160}$/.test(supplied) ? supplied : crypto.randomUUID();
  req._creditOperationKeys[kind] = `credit:${req.credits.key}:${kind}:${safe}`;
  return req._creditOperationKeys[kind];
}

async function charge(req, kind) {
  const cost = COST[kind];
  if (!cost) throw new Error("Unknown charge kind: " + kind);
  const idem = operationKey(req, kind);

  return db.tx(async (client) => {
    await ensureRecord(req.credits.key, req.user ? req.user.plan : null, client);
    const existing = await client.query(
      `select id, balance_after from public.credit_transactions where idempotency_key = $1`,
      [idem]
    );
    if (existing.rows[0]) {
      return { ok: true, left: existing.rows[0].balance_after, charged: 0, reused: true };
    }

    const locked = await client.query(
      `select left_credits from public.credits where key = $1 for update`,
      [req.credits.key]
    );
    const left = Number(locked.rows[0]?.left_credits) || 0;
    if (left < cost) return { ok: false, need: cost, left };

    const updated = await client.query(
      `update public.credits
          set left_credits = left_credits - $2, spent = spent + $2
        where key = $1 returning left_credits`,
      [req.credits.key, cost]
    );
    const balance = Number(updated.rows[0].left_credits);
    const inserted = await client.query(
      `insert into public.credit_transactions
         (credit_key, user_id, kind, amount, balance_after, idempotency_key, metadata)
       values ($1, $2, $3, $4, $5, $6, $7::jsonb)
       returning id`,
      [req.credits.key, req.user?.id || null, TRANSACTION_KIND[kind], -cost,
       balance, idem, JSON.stringify({ path: req.path })]
    );
    req._creditChargeIds = req._creditChargeIds || {};
    req._creditChargeIds[kind] = inserted.rows[0].id;
    return { ok: true, left: balance, charged: cost };
  });
}

/* Give it back when the work failed — nobody pays for our 500. */
async function refund(req, kind) {
  const cost = COST[kind] || 0;
  if (!cost) return (await ensureRecord(req.credits.key, req.user ? req.user.plan : null)).left_credits;
  const chargeId = req._creditChargeIds?.[kind] || null;
  // A reused idempotent charge belongs to an earlier completed request and
  // must not be refunded by a duplicate retry that happens to fail later.
  if (!chargeId) return (await ensureRecord(req.credits.key, req.user ? req.user.plan : null)).left_credits;
  const idem = `refund:${chargeId}`;

  return db.tx(async (client) => {
    const rec = await ensureRecord(req.credits.key, req.user ? req.user.plan : null, client);
    const prior = await client.query(
      `select balance_after from public.credit_transactions where idempotency_key = $1`,
      [idem]
    );
    if (prior.rows[0]) return Number(prior.rows[0].balance_after);
    const plan = PLANS[rec.plan] || PLANS.free;
    const updated = await client.query(
      `update public.credits
          set left_credits = least($2, left_credits + $3),
              spent = greatest(0, spent - $3)
        where key = $1 returning left_credits`,
      [req.credits.key, plan.perDay, cost]
    );
    const balance = Number(updated.rows[0]?.left_credits ?? rec.left_credits);
    await client.query(
      `insert into public.credit_transactions
         (credit_key, user_id, kind, amount, balance_after, idempotency_key, metadata)
       values ($1, $2, 'refund', $3, $4, $5, $6::jsonb)
       on conflict (idempotency_key) where idempotency_key is not null do nothing`,
      [req.credits.key, req.user?.id || null, cost, balance, idem,
       JSON.stringify({ refundedTransactionId: chargeId, operation: kind })]
    );
    return balance;
  });
}

/* Called right after a payment is verified, to grant the new plan's daily
   allowance immediately. */
async function setPlan(req, planId) {
  if (!PLANS[planId]) return false;
  await ensureRecord(req.credits.key, req.user ? req.user.plan : null);
  await db.query(
    `update public.credits set plan = $2, left_credits = $3 where key = $1`,
    [req.credits.key, planId, PLANS[planId].perDay]
  );
  return true;
}

module.exports = { middleware, state, entitlements, charge, refund, setPlan, PLANS, COST, COOKIE, LIFETIME_SLOTS };
