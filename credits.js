/* ============================================================
   credits.js — server-side credit ledger.

   Why server-side: the old UI kept a credit count in the browser, which any
   user can reset by clearing storage. Charging happens here, next to the work
   that costs money (an AI call or a CPU-heavy render).

   Identity: there is no auth yet, so each visitor gets a signed anonymous id in
   an HttpOnly cookie. The signature stops someone minting a fresh id by hand;
   clearing cookies still gets a new allowance, which is the honest limit of an
   anonymous system and is why the daily grant is small.

   Storage: a single JSON file written atomically. Good for one instance, which
   is what we run. Swap `load`/`save` for Supabase when accounts land.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const FILE = process.env.CREDITS_FILE || path.join(__dirname, ".credits.json");
const COOKIE = "sc_uid";

const PLANS = {
  free:    { id: "free",    label: "Free",    perDay: 10,  price: 0,  usd: "$0", inr: "$0" },
  pro:     { id: "pro",     label: "Pro",     perDay: 100, price: 5,  usd: "$5", inr: "$5", discountUsd: "$2.50", discountPct: 50 },
  promax:  { id: "promax",  label: "Pro Max", perDay: 300, price: 10, usd: "$10", inr: "$10" }
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

/* ── store ────────────────────────────────────────────────── */
let cache = null;
let cacheMtime = 0;

/* The file is the single source of truth, so the cache is dropped whenever
   something else writes it — a second instance, `node --watch` restarting, or a
   test setting up a balance. Statting a small file per request is cheap. */
function load() {
  let mtime = 0;
  try { mtime = fs.statSync(FILE).mtimeMs; } catch (e) { mtime = 0; }
  if (cache && mtime === cacheMtime) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8"));
    if (!cache || typeof cache !== "object") cache = {};
  } catch (e) {
    cache = {};
  }
  cacheMtime = mtime;
  return cache;
}

let writeTimer = null;
function save() {
  clearTimeout(writeTimer);
  // debounce: a burst of charges should not mean a burst of fsyncs
  writeTimer = setTimeout(() => {
    try {
      const tmp = FILE + ".tmp";
      fs.writeFileSync(tmp, JSON.stringify(cache), "utf8");
      fs.renameSync(tmp, FILE);
      cacheMtime = fs.statSync(FILE).mtimeMs;   // our own write is not a change
    } catch (e) {
      console.warn("[credits] could not persist:", e.message);
    }
  }, 250);
}

const today = () => new Date().toISOString().slice(0, 10);

/* One row per identity per day. `planHint` comes from the signed-in account,
   which is the source of truth for the plan — so an upgrade takes effect at once
   (fresh grant) rather than at midnight. */
function record(key, planHint) {
  const db = load();
  let rec = db[key];
  const day = today();
  const wanted = PLANS[planHint] ? planHint : (rec && PLANS[rec.plan] ? rec.plan : "free");

  if (!rec || rec.day !== day || rec.plan !== wanted) {
    rec = {
      day,
      plan: wanted,
      left: PLANS[wanted].perDay,
      spent: 0,
      since: (rec && rec.since) || day
    };
    db[key] = rec;
    save();
  }
  return rec;
}

/* ── public API ───────────────────────────────────────────── */

/* Attaches req.credits = {key, plan, rec}.
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
  const key = user ? "u:" + user.id : token;
  const rec = record(key, user ? user.plan : null);

  req.credits = {
    key,
    token,
    signedIn: !!user,
    get left() { return rec.left; },
    plan: PLANS[rec.plan] || PLANS.free,
    rec
  };
  next();
}

function state(req) {
  const rec = record(req.credits.key, req.user ? req.user.plan : null);
  const plan = PLANS[rec.plan] || PLANS.free;
  return {
    left: rec.left,
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

/* Charge before doing the work. Returns {ok, left} or {ok:false, need, left}. */
function charge(req, kind) {
  const cost = COST[kind];
  if (!cost) throw new Error("Unknown charge kind: " + kind);
  const rec = record(req.credits.key, req.user ? req.user.plan : null);
  if (rec.left < cost) return { ok: false, need: cost, left: rec.left };
  rec.left -= cost;
  rec.spent += cost;
  save();
  return { ok: true, left: rec.left, charged: cost };
}

/* Give it back when the work failed — nobody pays for our 500. */
function refund(req, kind) {
  const cost = COST[kind] || 0;
  const rec = record(req.credits.key, req.user ? req.user.plan : null);
  const plan = PLANS[rec.plan] || PLANS.free;
  rec.left = Math.min(plan.perDay, rec.left + cost);
  rec.spent = Math.max(0, rec.spent - cost);
  save();
  return rec.left;
}

/* Used by the (future) payment webhook. */
function setPlan(req, planId) {
  if (!PLANS[planId]) return false;
  const rec = record(req.credits.key, planId);
  rec.plan = planId;
  rec.left = PLANS[planId].perDay;
  save();
  return true;
}

module.exports = { middleware, state, charge, refund, setPlan, PLANS, COST, COOKIE };
