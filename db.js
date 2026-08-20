/* ============================================================
   db.js — the one Postgres connection pool, shared by every data module.

   Replaces the JSON file pattern that auth.js / credits.js / waitlist.js /
   community.js / comments.js used to write. Accounts, credits, the launch
   waitlist, community templates and comments now live in Supabase Postgres,
   so a redeploy or a restart on any host — Render, Railway, wherever — can no
   longer wipe them the way an ephemeral filesystem did.

   The app connects as a dedicated, least-privilege role (`shortscraft_app`)
   created specifically for this backend: SELECT/INSERT/UPDATE/DELETE on the
   six tables it owns, nothing on Supabase's own auth/storage schemas. It is
   granted BYPASSRLS because it is the only thing that ever talks to these
   tables — the browser never gets Postgres credentials, only our Express API
   — so authorization stays in the application code that already had it,
   rather than being re-implemented as SQL policies.
   ============================================================ */
const { Pool } = require("pg");

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL is not set. The app now reads accounts, credits and the " +
    "waitlist from Postgres — see DEPLOY.md for the connection string."
  );
}

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase terminates TLS with a cert that isn't in Node's default trust
  // store; rejectUnauthorized:false trusts the connection without pinning
  // the cert, which matches how supabase-js and every quick-start snippet
  // connect. It is not the same as skipping TLS.
  ssl: { rejectUnauthorized: false },
  max: 10,
  // Keep connections warm for longer. The database is a few hundred
  // milliseconds away, so re-establishing TLS per burst of traffic is the
  // expensive part; holding idle sockets avoids paying it repeatedly.
  idleTimeoutMillis: 5 * 60_000,
  keepAlive: true,
  // A cold connection over a slow link occasionally passed 10s and surfaced as
  // "Connection terminated due to connection timeout" during load.
  connectionTimeoutMillis: 20_000
});

pool.on("error", (err) => {
  // A dropped idle connection must not crash the process — the next query
  // just opens a new one from the pool.
  console.error("[db] idle client error:", err.message);
});

function query(text, params) {
  return pool.query(text, params);
}

/* Run a set of queries on one connection inside a transaction. `fn` receives
   a client with the same .query(text, params) shape. */
async function tx(fn) {
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await fn(client);
    await client.query("COMMIT");
    return result;
  } catch (e) {
    await client.query("ROLLBACK").catch(() => {});
    throw e;
  } finally {
    client.release();
  }
}

module.exports = { query, tx, pool };
