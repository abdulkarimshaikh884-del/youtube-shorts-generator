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

const MISSING_URL =
  "DATABASE_URL is not set. Accounts, credits and the waitlist are read from " +
  "Postgres — see DEPLOY.md for the connection string.";

/* Built on first use rather than at import. Throwing while the module loaded
   meant anything that merely reached credits.js for a constant — build_pages.js
   wants LIFETIME_SLOTS and the plan table — could not run at all without live
   database credentials, so generating static marketing pages had become a
   privileged operation. The server still fails fast: it calls assertReady() at
   boot, so a misconfigured deploy dies immediately and loudly as before. */
let pool = null;
function getPool() {
  if (pool) return pool;
  if (!process.env.DATABASE_URL) throw new Error(MISSING_URL);
  pool = new Pool({
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
  return pool;
}

/* Boot-time guard for the server, so a missing connection string is still a
   startup failure rather than a surprise on the first visitor request. */
function assertReady() {
  if (!process.env.DATABASE_URL) throw new Error(MISSING_URL);
}

function query(text, params) {
  return getPool().query(text, params);
}

/* Run a set of queries on one connection inside a transaction. `fn` receives
   a client with the same .query(text, params) shape. */
async function tx(fn) {
  const client = await getPool().connect();
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

module.exports = { query, tx, getPool, assertReady };
