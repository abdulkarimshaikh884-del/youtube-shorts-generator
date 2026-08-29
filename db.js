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
  const connectionTimeoutMillis = Math.max(
    1_000,
    Math.min(Number(process.env.DB_CONNECTION_TIMEOUT_MS) || 8_000, 30_000)
  );
  const queryTimeoutMillis = Math.max(
    1_000,
    Math.min(Number(process.env.DB_QUERY_TIMEOUT_MS) || 10_000, 60_000)
  );
  pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  // Supabase terminates TLS with a cert that isn't in Node's default trust
  // store; rejectUnauthorized:false trusts the connection without pinning
  // the cert, which matches how supabase-js and every quick-start snippet
  // connect. It is not the same as skipping TLS.
  ssl: { rejectUnauthorized: false },
  max: 10,
  /* Keep connections warm, but retire them before the server does. Holding
     sockets for 5 minutes meant Supabase closed them from its side first, and
     every one surfaced here as "Connection terminated unexpectedly" — noise
     that reads like an outage in the logs. Closing at 30s keeps the TLS
     handshake amortised across a burst of traffic while making the teardown
     ours, and therefore silent. */
  idleTimeoutMillis: 30_000,
  keepAlive: true,
  // Fail in a bounded time. Without query_timeout a dead socket or a queued
  // pool request could leave API responses (and the template gallery) pending
  // indefinitely even after the connection attempt itself had timed out.
  connectionTimeoutMillis,
  query_timeout: queryTimeoutMillis,
  statement_timeout: queryTimeoutMillis
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
  warnIfIpv6Only(process.env.DATABASE_URL);
}

/* Supabase's direct host, db.<project-ref>.supabase.co, resolves to an AAAA
   record and no A record. On a network without an IPv6 route every query dies
   with "Connection terminated due to connection timeout" — which reads as a
   database outage or an app bug, not as the addressing problem it is. Say so
   once at boot instead of leaving it to be rediscovered from request logs.
   Advisory only: the lookup is async and never blocks or fails startup, since
   a host can be IPv6-only and perfectly reachable on an IPv6 network. */
function warnIfIpv6Only(url) {
  let host;
  try { host = new URL(url).hostname; } catch (e) { return; }
  if (!/^db\..*\.supabase\.co$/i.test(host)) return;

  /* dns.lookup, not dns.resolve4: resolve* talks to the configured nameserver
     directly, which plenty of corporate and VPN resolvers refuse outright
     (ECONNREFUSED) — that told us nothing about the host. dns.lookup goes
     through getaddrinfo, the same path the driver itself will take, so it
     answers the question that actually matters: can this process reach an
     IPv4 address for the host. */
  const dns = require("dns");
  dns.lookup(host, { family: 4 }, (err4, v4) => {
    if (v4) return;                              // IPv4 available, nothing to say
    dns.lookup(host, { family: 6 }, (err6, v6) => {
      if (!v6) return;                           // host unresolvable entirely
      console.warn(
        "[db] " + host + " resolves to IPv6 only (" + v6 + ") and this host has " +
        "no IPv4 address for it. If connections time out, switch DATABASE_URL to " +
        "the Supabase transaction pooler, which answers on IPv4: " +
        "postgresql://postgres.<project-ref>:PASSWORD@aws-0-<region>.pooler.supabase.com:6543/postgres " +
        "(Project Settings -> Database -> Connection string). See .env.example."
      );
    });
  });
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
