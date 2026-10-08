"use strict";
// Real local PG permission checks. Transaction rollback leaves the owned QA
// schema/ACL/roles unchanged; EXPLAIN without ANALYZE never inserts a row.
// No .env, remote connection or application server is loaded by this test.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {Client} = require("pg");
const {assertIsolatedPostgres} = require("./helpers/isolated-postgres");
assert.equal(process.env.SC_ISOLATED_POSTGRES_QA, "true", "Explicit isolated-QA opt-in required");
const owner = assertIsolatedPostgres();
assert.equal(owner.kind, "portable", "This audit uses the marker-bound portable QA server");
const migration = fs.readFileSync(path.resolve(__dirname, "../supabase/migrations/20261007154135_revoke_legacy_feedback_browser_insert.sql"), "utf8");
const sql = migration.replace(/--[^\r\n]*/g, "").trim();
assert.match(sql, /^REVOKE INSERT ON TABLE public\.feedback FROM anon, authenticated, PUBLIC;$/i, "Migration must stay one narrow privilege change");
const client = new Client({host: "127.0.0.1", port: 55437, database: "shortscraft_qa", user: "postgres", ssl: false, connectionTimeoutMillis: 5000});
let cases = 0;
let inTransaction = false;
function pass(label) { cases++; console.log("PASS " + label); }
async function access() {
  return (await client.query(`select
    has_table_privilege('anon','public.feedback','INSERT') as anon_insert,
    has_table_privilege('authenticated','public.feedback','INSERT') as authenticated_insert,
    has_any_column_privilege('anon','public.feedback','INSERT') as anon_column_insert,
    has_any_column_privilege('authenticated','public.feedback','INSERT') as authenticated_column_insert,
    has_table_privilege('service_role','public.feedback','INSERT') as service_insert,
    has_table_privilege('shortscraft_app','public.feedback','INSERT') as backend_insert,
    exists(select 1 from pg_class c cross join lateral aclexplode(c.relacl) a
      where c.oid='public.feedback'::regclass and a.grantee=0 and a.privilege_type='INSERT') as public_insert`)).rows[0];
}
async function deniedInsert(role) {
  await client.query("savepoint denied_insert");
  try {
    // Role is a fixed, trusted fixture value, never user input.
    await client.query("set local role " + role);
    await assert.rejects(client.query("explain insert into public.feedback (message) values ('Isolated permission check; not executed')"),
      error => error.code === "42501" && /feedback/.test(error.message), role + " cannot even plan a legacy insert");
  } finally {
    await client.query("rollback to savepoint denied_insert");
    await client.query("release savepoint denied_insert");
  }
}
(async () => {
  await client.connect();
  try {
    const directory = (await client.query("show data_directory")).rows[0].data_directory;
    assert.equal(fs.realpathSync(directory), fs.realpathSync(path.join(owner.folder, "data")), "Connected server is the exact owned QA data directory");
    assert.equal((await client.query("select current_database() as name")).rows[0].name, "shortscraft_qa");
    const fixtureBefore = (await client.query("select to_regclass('public.feedback')::text as feedback, exists(select 1 from pg_roles where rolname='service_role') as service_role")).rows[0];
    await client.query("begin");
    inTransaction = true;
    await client.query("set local lock_timeout='5s'; set local statement_timeout='10s'");
    if (!(await client.query("select 1 from pg_roles where rolname='service_role'")).rowCount) await client.query("create role service_role nologin");
    if (!(await client.query("select to_regclass('public.feedback') as name")).rows[0].name) {
      // The app-only schema baseline can omit this retired legacy table. Its
      // columns and permissive INSERT policy reproduce the audited surface;
      // both are transaction-only fixtures and disappear on final rollback.
      await client.query(`create table public.feedback (
        id uuid primary key default gen_random_uuid(), user_id uuid,
        name text, email text, message text not null, page_url text,
        user_agent text, created_at timestamptz not null default now());
        alter table public.feedback enable row level security;
        create policy "Anyone can insert feedback" on public.feedback for insert to public with check (true);`);
    }
    // The schema-only local baseline excludes production ACLs. Recreate only
    // the tested INSERT baseline inside this transaction, then roll it back.
    await client.query("grant usage on schema public to anon, authenticated, service_role; grant insert on table public.feedback to anon, authenticated, service_role, shortscraft_app");
    const before = await access();
    assert.equal(before.anon_insert, true); assert.equal(before.authenticated_insert, true); assert.equal(before.service_insert, true);
    const policies = (await client.query("select policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename='feedback' order by policyname")).rows;
    const rowCount = (await client.query("select count(*)::int as total from public.feedback")).rows[0].total;
    await client.query(sql);
    let after = await access();
    assert.equal(after.anon_insert, false); assert.equal(after.authenticated_insert, false);
    assert.equal(after.anon_column_insert, false); assert.equal(after.authenticated_column_insert, false);
    assert.equal(after.public_insert, false);
    assert.equal(after.service_insert, before.service_insert); assert.equal(after.backend_insert, before.backend_insert);
    pass("catalog denies browser table/column INSERT while private grants remain unchanged");
    await deniedInsert("anon"); pass("real PostgreSQL rejects anon INSERT planning with 42501");
    await deniedInsert("authenticated"); pass("real PostgreSQL rejects authenticated INSERT planning with 42501");
    await client.query(sql);
    assert.deepEqual(await access(), after); pass("migration can run twice without changing its result");
    // Exercise PUBLIC inheritance too, independently of direct role grants.
    await client.query("grant insert on table public.feedback to public");
    assert.equal((await access()).anon_insert, true);
    await client.query(sql);
    after = await access();
    assert.equal(after.public_insert, false); assert.equal(after.anon_insert, false); assert.equal(after.authenticated_insert, false);
    assert.equal(after.service_insert, true); assert.equal(after.backend_insert, before.backend_insert);
    pass("PUBLIC inherited INSERT cannot reopen the browser path");
    assert.deepEqual((await client.query("select policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname='public' and tablename='feedback' order by policyname")).rows, policies);
    assert.equal((await client.query("select count(*)::int as total from public.feedback")).rows[0].total, rowCount);
    pass("existing policy and feedback rows remain unchanged");
    await client.query("grant insert on table public.feedback to anon, authenticated");
    const restored = await access();
    assert.equal(restored.anon_insert, true); assert.equal(restored.authenticated_insert, true); assert.equal(restored.public_insert, false);
    assert.equal(restored.service_insert, true); assert.equal(restored.backend_insert, before.backend_insert);
    pass("documented rollback restores only observed browser INSERT grants, never PUBLIC");
    await client.query("rollback");
    inTransaction = false;
    assert.deepEqual((await client.query("select to_regclass('public.feedback')::text as feedback, exists(select 1 from pg_roles where rolname='service_role') as service_role")).rows[0], fixtureBefore, "Transaction-only fixture table/role must not survive the test");
    console.log(`PASS ${cases} legacy-feedback access checks on owned local PostgreSQL; no row writes, all permission fixtures rolled back.`);
  } finally {
    if (inTransaction) await client.query("rollback").catch(() => {});
    await client.end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
