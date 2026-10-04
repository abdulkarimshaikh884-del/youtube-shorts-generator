"use strict";
// Copy DDL only (never user rows) to a dedicated local QA container. This is
// intentionally not a deployment/migration command for the configured database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const root = path.resolve(__dirname, "..");
const container = "shortscraft-qa-pg17-20261002";
const image = "public.ecr.aws/supabase/postgres:17.6.1.140";
function docker(args, extra = {}) {
  if(args.includes("psql")) args = [...args.slice(0,args.indexOf("psql")+1), "-h", "127.0.0.1", ...args.slice(args.indexOf("psql")+1)];
  return execFileSync("docker", args, {encoding:"utf8", timeout:60000, maxBuffer:16*1024*1024, windowsHide:true, ...extra});
}
(async () => {
const own = JSON.parse(docker(["inspect", container]))[0];
assert.equal(own.Config.Labels["shortscraft.qa"], "true");
assert.equal(own.Config.Image, image);
assert.equal(own.State.Running, true);
assert.deepEqual(own.HostConfig.PortBindings["5432/tcp"], [{HostIp:"127.0.0.1", HostPort:"55437"}]);
require("dotenv").config({path:path.join(root,".env"),quiet:true});
const source = new URL(process.env.DATABASE_URL);
assert.ok(source.hostname.endsWith(".supabase.com") || source.hostname.endsWith(".supabase.co"), "Expected configured remote metadata source");
const db = require("../db");
let excluded;
try {
  const meta = await db.query("select tablename from pg_tables where schemaname = 'public' and not has_table_privilege(current_user, quote_ident(schemaname)||'.'||quote_ident(tablename), 'SELECT')");
  excluded = meta.rows.map(row => row.tablename);
} finally {await db.getPool().end();}
const dumpEnv = {...process.env, PGHOST:source.hostname, PGPORT:source.port || "5432", PGUSER:decodeURIComponent(source.username),
  PGPASSWORD:decodeURIComponent(source.password), PGDATABASE:source.pathname.slice(1), PGSSLMODE:"require", PGCONNECT_TIMEOUT:"10",
  PGOPTIONS:"-c default_transaction_read_only=on"};
// Environment values, not credentials in command-line arguments or output.
const ddl = docker(["run", "--rm", "-i", "--entrypoint", "pg_dump",
  ...["PGHOST","PGPORT","PGUSER","PGPASSWORD","PGDATABASE","PGSSLMODE","PGCONNECT_TIMEOUT","PGOPTIONS"].flatMap(k => ["-e",k]),
  image, "--schema-only", "--no-owner", "--no-privileges", "--schema=public",
  ...excluded.map(table => "--exclude-table=public."+table)], {env:dumpEnv});
const out = path.join(root,"audit_results","postgres-isolated");
fs.mkdirSync(out,{recursive:true}); fs.writeFileSync(path.join(out,"baseline-schema.sql"),ddl);
const setup = "create role anon; create role authenticated; create role shortscraft_app login bypassrls; create database shortscraft_qa;";
docker(["exec","-i",container,"psql","-v","ON_ERROR_STOP=1","-U","postgres","-d","postgres"],{input:setup});
docker(["exec","-i",container,"psql","-v","ON_ERROR_STOP=1","-U","postgres","-d","shortscraft_qa"],
  {input:"drop schema public;\n"+ddl});
const migration = fs.readFileSync(path.join(root,"supabase/migrations/20260930165509_referral_bonus_credits.sql"),"utf8");
docker(["exec","-i",container,"psql","-v","ON_ERROR_STOP=1","-U","postgres","-d","shortscraft_qa"],
  {input:"begin;\n"+migration+"\ncommit;\ngrant usage on schema public to shortscraft_app; grant select,insert,update,delete on all tables in schema public to shortscraft_app; grant usage,select on all sequences in schema public to shortscraft_app;"});
docker(["exec","-i",container,"psql","-v","ON_ERROR_STOP=1","-U","postgres","-d","shortscraft_qa"],
  {input:"create extension if not exists pgtap;\n"+fs.readFileSync(path.join(root,"supabase/tests/referral_access.test.sql"),"utf8")});
console.log("Prepared isolated PostgreSQL 17 schema and referral migration. Production was read-only DDL export; no user rows copied.");
})().catch(err => {console.error(err.message); process.exitCode=1;});
