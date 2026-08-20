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
                after those are gone Pro Max falls back to `year`. */
const LIFETIME_SLOTS = 100;

const PLANS = {
  free:   { id: "free",   label: "Free",    perDay: 10,  price: 0,   inr: "₹0",   term: "forever" },
  pro:    { id: "pro",    label: "Pro",     perDay: 100, price: 99,  inr: "₹99",  term: "month" },
  promax: { id: "promax", label: "Pro Max", perDay: 300, price: 499, inr: "₹499", term: "lifetime", fallbackTerm: "year" }
};

/* ── what things cost ───────────────────────────────────── */
const COST = {
  export: 1,      // rendering a template project to MP4
  animate: 5      // generating a brand-new animation from a prompt
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
async function ensureRecord(key, planHint) {
  const day = today();
  const { rows } = await db.query(`select * from public.credits where key = $1`, [key]);
  let rec = rows[0] || null;

  const wanted = PLANS[planHint] ? planHint : (rec && PLANS[rec.plan] ? rec.plan : "free");

  if (!rec || rec.day !== day || rec.plan !== wanted) {
    const perDay = PLANS[wanted].perDay;
    const since = rec ? rec.since : day;
    const { rows: upserted } = await db.query(
      `insert into public.credits (key, day, plan, left_credits, spent, since)
       values ($1, $2, $3, $4, 0, $5)
       on conflict (key) do update
         set day = excluded.day, plan = excluded.plan,
             left_credits = excluded.left_credits, spent = 0
       returning *`,
      [key, day, wanted, perDay, since]
    );
    rec = upserted[0];
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
    spentToday: rec.spent,
    plan: plan.id,
    planLabel: plan.label,
    signedIn: !!req.user,
    email: req.user ? req.user.email : null,
    cost: COST,
    resetsAt: new Date(new Date().setUTCHours(24, 0, 0, 0)).toISOString()
  };
}

/* Charge before doing the work. Returns {ok, left} or {ok:false, need, left}.
   The decrement is one atomic UPDATE guarded by left_credits >= cost, so two
   concurrent requests cannot both succeed past a balance that only covers one. */
async function charge(req, kind) {
  const cost = COST[kind];
  if (!cost) throw new Error("Unknown charge kind: " + kind);

  const rec = await ensureRecord(req.credits.key, req.user ? req.user.plan : null);
  const { rows } = await db.query(
    `update public.credits
        set left_credits = left_credits - $2, spent = spent + $2
      where key = $1 and left_credits >= $2
      returning left_credits`,
    [req.credits.key, cost]
  );
  if (!rows[0]) return { ok: false, need: cost, left: rec.left_credits };
  return { ok: true, left: rows[0].left_credits, charged: cost };
}

/* Give it back when the work failed — nobody pays for our 500. */
async function refund(req, kind) {
  const cost = COST[kind] || 0;
  const rec = await ensureRecord(req.credits.key, req.user ? req.user.plan : null);
  const plan = PLANS[rec.plan] || PLANS.free;
  const { rows } = await db.query(
    `update public.credits
        set left_credits = least($2, left_credits + $3), spent = greatest(0, spent - $3)
      where key = $1
      returning left_credits`,
    [req.credits.key, plan.perDay, cost]
  );
  return rows[0] ? rows[0].left_credits : rec.left_credits;
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

module.exports = { middleware, state, charge, refund, setPlan, PLANS, COST, COOKIE, LIFETIME_SLOTS };
