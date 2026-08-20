/* ============================================================
   waitlist.js — reservations for the launch offer, backed by Postgres.

   The payment gateway needs an 18+ account holder, so until it is switched on
   the pricing page collects interest instead of money. Nothing here charges
   anyone; it records "tell me when Pro opens" so the first buyers are already
   waiting on day one.
   ============================================================ */
const db = require("./db");

function normEmail(e) {
  return String(e || "").trim().toLowerCase();
}

/* Adding the same address twice is not an error — it is someone checking that
   their reservation stuck. Report the existing position instead of a
   duplicate row (the unique index on lower(email) is what actually enforces
   this — ON CONFLICT just turns that into a friendly response). */
async function add(email, plan, userId) {
  const key = normEmail(email);
  const { rows } = await db.query(
    `insert into public.waitlist (email, plan, user_id)
     values ($1, $2, $3)
     on conflict (lower(email)) do nothing
     returning id`,
    [key, plan || "promax", userId || null]
  );

  if (rows.length) {
    const { rows: pos } = await db.query(
      `select count(*)::int as n from public.waitlist where id <= $1`,
      [rows[0].id]
    );
    return { already: false, position: pos[0].n };
  }

  // Already on the list — find its position by insertion order.
  const { rows: existing } = await db.query(
    `select id from public.waitlist where lower(email) = $1`, [key]
  );
  const { rows: pos } = await db.query(
    `select count(*)::int as n from public.waitlist where id <= $1`,
    [existing[0].id]
  );
  return { already: true, position: pos[0].n };
}

async function count() {
  const { rows } = await db.query(`select count(*)::int as n from public.waitlist`);
  return rows[0].n;
}

/* For the owner: everyone to email when payments open. */
async function list() {
  const { rows } = await db.query(
    `select email, plan, user_id as "userId", created_at as "at" from public.waitlist order by id asc`
  );
  return rows;
}

module.exports = { add, count, list };
