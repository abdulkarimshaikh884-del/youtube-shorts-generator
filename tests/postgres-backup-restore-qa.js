"use strict";
// Local QA data only. Never loads .env, contacts a remote DB or drops a database.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {execFileSync} = require("node:child_process");
const container = "shortscraft-qa-pg17-20261002";
const root = path.resolve(__dirname,"..");
const out = path.join(root,"audit_results/postgres-isolated");
function docker(args) {return execFileSync("docker",args,{encoding:"utf8",windowsHide:true,timeout:60000,maxBuffer:16*1024*1024});}
const own = JSON.parse(docker(["inspect",container]))[0];
assert.equal(own.Config.Labels["shortscraft.qa"],"true");
assert.equal(own.State.Running,true);
assert.deepEqual(own.HostConfig.PortBindings["5432/tcp"],[{HostIp:"127.0.0.1",HostPort:"55437"}]);
const stamp = Date.now().toString();
const restored = "shortscraft_qa_restore_"+stamp;
assert.match(restored,/^shortscraft_qa_restore_\d+$/);
function sql(database,query) {
  assert(database==="shortscraft_qa" || database==="postgres" || database===restored);
  return docker(["exec",container,"psql","-h","127.0.0.1","-U","postgres","-d",database,"-v","ON_ERROR_STOP=1","-At","-c",query]).trim();
}
function snapshot(database) {
  const names=JSON.parse(sql(database,"select coalesce(json_agg(tablename order by tablename),'[]') from pg_tables where schemaname='public'"));
  return Object.fromEntries(names.map(name=>{
    const table='public."'+name.replace(/"/g,'""')+'"';
    const result=JSON.parse(sql(database,"select json_build_object('rows',count(*),'checksum',md5(coalesce(string_agg(row_to_json(t)::text,E'\\n' order by row_to_json(t)::text),''))) from "+table+" t"));
    return [name,result];
  }));
}
const before = snapshot("shortscraft_qa");
assert(before.users.rows>0 && before.credit_transactions.rows>0,"Require actual isolated auth/ledger fixtures");
const dbEnv={...process.env,DATABASE_URL:"postgresql://shortscraft_app:local-qa-only-not-production@127.0.0.1:55437/shortscraft_qa?sslmode=disable"};
// A new app-side Node process reads the persisted database, not an in-memory fixture.
const processResult=JSON.parse(execFileSync(process.execPath,["-e",
  "const db=require('./db');db.query('select count(*)::int as n, coalesce(sum(bonus_credits),0)::int as bonus from public.credits').then(r=>console.log(JSON.stringify(r.rows[0]))).catch(e=>{console.error(e.message);process.exitCode=1}).finally(()=>db.getPool().end())"],
  {cwd:root,env:dbEnv,encoding:"utf8",windowsHide:true,timeout:15000}));
assert.equal(processResult.n,before.credits.rows); assert(processResult.bonus>0);
const remoteFile="/tmp/shortscraft-local-qa-"+stamp+".dump";
const localFile=path.join(out,"local-qa-"+stamp+".dump");
fs.mkdirSync(out,{recursive:true}); assert(!fs.existsSync(localFile));
docker(["exec",container,"pg_dump","-h","127.0.0.1","-U","postgres","-d","shortscraft_qa","-Fc","--no-owner","--no-acl","--schema=public","-f",remoteFile]);
docker(["cp",container+":"+remoteFile,localFile]);
sql("postgres","create database "+restored);
// The archive contains CREATE SCHEMA public. Remove only the empty default
// schema in this newly created QA restore target, never the source database.
assert.equal(sql(restored,"select count(*) from pg_tables where schemaname='public'"),"0");
sql(restored,"drop schema public");
docker(["exec",container,"pg_restore","-h","127.0.0.1","-U","postgres","-d",restored,"--no-owner","--no-acl","--exit-on-error",remoteFile]);
const after=snapshot(restored);
assert.deepEqual(after,before,"Every public QA table must retain its row count and content checksum");
const evidence={testedAt:new Date().toISOString(),source:"local isolated shortscraft_qa",restoredDatabase:restored,
  backup:path.basename(localFile),tables:before,checks:["fresh app-side process sees persisted credit rows and bonuses","local custom-format backup restores to a new database","all public table counts and checksums match"],
  boundary:"Local QA backup drill only; no production data downloaded, production restore, cloud backup policy or Docker container restart certified."};
fs.writeFileSync(path.join(out,"backup-restore-evidence.json"),JSON.stringify(evidence,null,2));
console.log("PASS new-process credit persistence; PASS local backup/restore of "+Object.keys(before).length+" public tables. QA backup and restored database retained.");
