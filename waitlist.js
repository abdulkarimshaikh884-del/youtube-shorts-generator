/* ============================================================
   waitlist.js — reservations for the launch offer.

   The payment gateway needs an 18+ account holder, so until it is switched on
   the pricing page collects interest instead of money. Nothing here charges
   anyone; it records "tell me when Pro opens" so the first buyers are already
   waiting on day one.

   File-backed like credits.js and auth.js — one small JSON file is the source
   of truth, so a restart or a second process cannot serve a stale list.
   ============================================================ */
const fs = require("fs");
const path = require("path");

const FILE = process.env.WAITLIST_FILE || path.join(__dirname, ".waitlist.json");

let cache = null;
let cacheMtime = 0;

function load() {
  let mtime = 0;
  try { mtime = fs.statSync(FILE).mtimeMs; } catch (e) { mtime = 0; }
  if (cache && mtime === cacheMtime) return cache;
  try {
    cache = JSON.parse(fs.readFileSync(FILE, "utf8"));
  } catch (e) {
    cache = { entries: [] };
  }
  if (!Array.isArray(cache.entries)) cache.entries = [];
  cacheMtime = mtime;
  return cache;
}

function save() {
  fs.writeFileSync(FILE, JSON.stringify(cache, null, 2));
  try { cacheMtime = fs.statSync(FILE).mtimeMs; } catch (e) { cacheMtime = 0; }
}

function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

/* Adding the same address twice is not an error — it is someone checking that
   their reservation stuck. Report the existing position instead of a duplicate. */
function add(email, plan, userId) {
  const db = load();
  const key = normEmail(email);
  const at = db.entries.findIndex((x) => normEmail(x.email) === key);
  if (at > -1) {
    return { already: true, position: at + 1 };
  }
  db.entries.push({
    email: key,
    plan: plan || "promax",
    userId: userId || null,
    at: new Date().toISOString()
  });
  save();
  return { already: false, position: db.entries.length };
}

function count() {
  return load().entries.length;
}

/* For the owner: everyone to email when payments open. */
function list() {
  return load().entries.slice();
}

module.exports = { add, count, list };
