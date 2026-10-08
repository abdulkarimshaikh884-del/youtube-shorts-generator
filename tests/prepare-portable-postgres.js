"use strict";
// Local-only alternative when Docker is unavailable. Uses a checksum-verified
// PostgreSQL runtime already extracted into a fresh task-owned temp directory.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const net = require("node:net");
const {execFileSync} = require("node:child_process");
const folder = fs.realpathSync(process.env.SC_QA_PORTABLE_PG || "missing-local-qa-folder");
assert.equal(path.dirname(folder), fs.realpathSync(os.tmpdir()));
assert.match(path.basename(folder), /^shortscraft-launch-pg-[a-f0-9]{32}$/);
const data = path.join(folder, "data"), bin = path.join(folder, "runtime/bin");
const resume = process.argv.includes("--resume-owned");
if (resume) require("./helpers/isolated-postgres").assertIsolatedPostgres();
else assert(!fs.existsSync(data), "Refuse to overwrite an existing database");
const root = path.resolve(__dirname, "..");
const schema = fs.readFileSync(path.join(root,"audit_results/postgres-isolated/baseline-schema.sql"),"utf8");
assert.match(schema, /PostgreSQL database dump/);
assert(!/COPY .* FROM stdin/.test(schema), "Schema-only QA baseline required");
function run(tool,args,input) {
  return execFileSync(path.join(bin,tool+".exe"),args,{input,encoding:"utf8",windowsHide:true,timeout:60000,maxBuffer:16*1024*1024});
}
(async()=>{
  if (!resume) {
    // Bind probe prevents us from attaching to or mutating an unrelated service.
    await new Promise((resolve,reject)=>{const probe=net.createServer();probe.once("error",reject);probe.listen(55437,"127.0.0.1",()=>probe.close(resolve));});
    run("initdb",["-D",data,"-U","postgres","-A","trust","--encoding=UTF8"]);
    fs.writeFileSync(path.join(folder,"qa-owner.json"),JSON.stringify({purpose:"shortscraft-isolated-qa",folder}));
    // Do not inherit a pipe into the background postmaster on Windows.
    execFileSync(path.join(bin,"pg_ctl.exe"),["start","-D",data,"-l",path.join(folder,"postgres.log"),"-o","-h 127.0.0.1 -p 55437","-w"],{windowsHide:true,stdio:"ignore",timeout:60000});
  }
  require("./helpers/isolated-postgres").assertIsolatedPostgres();
  const {Client}=require("pg");
  const sql=async(database,input)=>{
    const client=new Client({host:"127.0.0.1",port:55437,user:"postgres",database,ssl:false});
    await client.connect(); try {return await client.query(input);} finally {await client.end();}
  };
  await sql("postgres","create role anon; create role authenticated; create role shortscraft_app login bypassrls password 'local-qa-only-not-production'; alter role postgres password 'local-qa-only-not-production';");
  await sql("postgres","create database shortscraft_qa;");
  // Remove only psql's client-side dump guard commands; all DDL stays intact.
  await sql("shortscraft_qa","drop schema public;\n"+schema.replace(/^\\(?:un)?restrict[^\r\n]*$/gm,""));
  const migration=fs.readFileSync(path.join(root,"supabase/migrations/20260930165509_referral_bonus_credits.sql"),"utf8");
  await sql("shortscraft_qa","begin;\n"+migration+"\ncommit;\ngrant usage on schema public to shortscraft_app; grant select,insert,update,delete on all tables in schema public to shortscraft_app; grant usage,select on all sequences in schema public to shortscraft_app;");
  console.log("Prepared owned localhost-only PostgreSQL 17 QA database. No production connection or user data copied.");
})().catch(err=>{console.error(err.message);process.exitCode=1;});
