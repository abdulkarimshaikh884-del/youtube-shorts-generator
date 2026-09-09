/* ============================================================
   purge_fixtures.js — remove leftover test accounts.

   Every verify and audit script signs up a throwaway account and deletes it
   again on the way out. A run that is interrupted — Ctrl-C, a killed terminal,
   a crashed browser — never reaches that teardown, so the account stays. Those
   survivors accumulate: they inflate the admin user count and make every
   signup metric meaningless.

   Only RFC 2606 / RFC 6761 reserved domains are ever considered. Those names
   are permanently unregistrable, so an address at one of them cannot belong to
   a real person — that, not a hand-kept list of prefixes, is what makes this
   safe to run against the live database.

   Dry run by default. Pass --yes to actually delete.
   ============================================================ */
const fs = require("fs");
const path = require("path");

if (!process.env.DATABASE_URL) {
  const envFile = path.join(__dirname, ".env");
  if (fs.existsSync(envFile)) {
    for (const line of fs.readFileSync(envFile, "utf8").split(/\r?\n/)) {
      const m = line.match(/^([A-Z_0-9]+)=(.*)$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
    }
  }
}

const db = require("./db");

const COMMIT = process.argv.includes("--yes");
// A suite running right now owns a fixture minutes old. Anything older than
// this belongs to a run that already finished or died.
const MIN_AGE_HOURS = Number(
  (process.argv.find((a) => a.startsWith("--min-age=")) || "").split("=")[1] || 2
);

const RESERVED = "(email ~* '@(.+\.)?(example|test|invalid|localhost)(\.(com|net|org|invalid))?$')";

(async () => {
  const { rows } = await db.query(
    `select id, email, role, created_at
       from public.users
      where ${RESERVED}
        and role not in ('admin', 'super_admin')
        and created_at < now() - ($1 || ' hours')::interval
      order by created_at`,
    [String(MIN_AGE_HOURS)]
  );

  const { rows: keep } = await db.query(
    `select count(*)::int n from public.users where not ${RESERVED}`
  );

  console.log(`real accounts (left untouched) : ${keep[0].n}`);
  console.log(`fixtures older than ${MIN_AGE_HOURS}h        : ${rows.length}`);

  if (!rows.length) {
    console.log("\nnothing to purge.");
    await db.getPool().end();
    return;
  }

  const byDay = new Map();
  for (const r of rows) {
    const d = String(r.created_at).slice(4, 15);
    byDay.set(d, (byDay.get(d) || 0) + 1);
  }
  console.log("");
  for (const [d, n] of byDay) console.log(`  ${d}  ${String(n).padStart(4)}`);

  if (!COMMIT) {
    console.log(`\nDRY RUN — nothing deleted. Re-run with --yes to remove these ${rows.length}.`);
    await db.getPool().end();
    return;
  }

  // One transaction per account rather than one for all of them: a single row
  // that will not delete (an unexpected foreign key) must not roll back the
  // other few hundred that would have gone cleanly.
  let done = 0;
  const failed = [];
  for (const r of rows) {
    try {
      await db.tx(async (client) => {
        await client.query(`delete from public.sessions where user_id = $1`, [r.id]);
        await client.query(`delete from public.users where id = $1`, [r.id]);
      });
      done++;
    } catch (err) {
      failed.push(`${r.email}: ${err.code || ""} ${err.message.split("\n")[0]}`);
    }
  }

  console.log(`\ndeleted ${done} of ${rows.length}`);
  if (failed.length) {
    console.log(`could not delete ${failed.length}:`);
    failed.slice(0, 10).forEach((f) => console.log("  " + f));
  }

  const { rows: after } = await db.query(`select count(*)::int n from public.users`);
  console.log(`users now: ${after[0].n}`);
  await db.getPool().end();
})().catch((e) => {
  console.error("purge failed:", e.message);
  process.exitCode = 1;
});
