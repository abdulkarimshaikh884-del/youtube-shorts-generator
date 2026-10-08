"use strict";
// Execute real storage code with a SQL-contract fixture, not a database.
// Complements (does not replace) isolated PostgreSQL HTTP verification.
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const rows=new Map(); let revisionCounter=123,queries=0;
const revision=()=>`2026-10-07 14:49:37.006${revisionCounter++}+00`;
async function query(sql,p=[]) {
  queries++;
  if(sql.includes("create table"))return {rows:[]};
  if(sql.includes("select count(*)"))return {rows:[{count:1}]};
  const row=rows.get(p[0]);
  if(sql.trim().startsWith("insert into public.design_projects")) {
    assert.match(sql,/on conflict \(id\) do nothing/);
    assert.match(sql,/returning \*, updated_at::text as revision/);
    if(row)return {rows:[]};
    const created={id:p[0],user_id:p[1],name:p[2],design_type:p[3],canvas:JSON.parse(p[4]),source:JSON.parse(p[5]),elements:JSON.parse(p[6]),preview_url:p[7],revision:revision(),updated_at:new Date("2026-10-07T14:49:37.006Z")};
    rows.set(p[0],created);return {rows:[created]};
  }
  if(sql.trim().startsWith("update public.design_projects")) {
    assert.match(sql,/where id = \$1 and user_id = \$2 and updated_at = \$9::timestamptz/);
    assert.match(sql,/greatest\(clock_timestamp\(\), updated_at \+ interval '1 microsecond'\)/);
    assert.match(sql,/returning \*, updated_at::text as revision/);
    if(!row||row.user_id!==p[1]||row.revision!==p[8])return {rows:[]};
    const updated={...row,name:p[2],canvas:JSON.parse(p[4]),source:JSON.parse(p[5]),elements:JSON.parse(p[6]),revision:revision()};
    rows.set(p[0],updated);return {rows:[updated]};
  }
  if(sql.includes("from public.design_projects")) {
    assert.match(sql,/user_id = \$2/);
    return {rows:row&&row.user_id===p[1]?[row]:[]};
  }
  throw Error("Unexpected fixture SQL: "+sql);
}
const moduleFixture={exports:{}};
vm.runInNewContext(fs.readFileSync(require.resolve("../designs"),"utf8"),{
  module:moduleFixture,console,Buffer,process:{env:{DATABASE_URL:"isolated-sql-fixture",NODE_ENV:"test"}},
  require(name){if(name==="./db")return {query};if(name==="./design-assets")return {};return require(name.startsWith("./")?require.resolve("../"+name.slice(2)):name);}
});
const designs=moduleFixture.exports;
(async()=>{
  const body={name:"Versioned",canvas:{width:640,height:360},elements:[{id:"text",type:"text",text:"original"}]};
  const created=await designs.saveProject("owner","new",body);assert(created.success);
  assert.equal(created.project.revision,"2026-10-07 14:49:37.006123+00");
  const first=await designs.saveProject("owner",created.project.id,{...body,expectedRevision:created.project.revision});
  assert(first.success);assert.equal(first.project.revision,"2026-10-07 14:49:37.006124+00");
  assert.equal(first.project.updatedAt,created.project.updatedAt,"Fixture deliberately has same JS millisecond timestamp");
  assert.equal((await designs.saveProject("owner",created.project.id,{...body,expectedRevision:created.project.revision})).status,409);
  assert.equal((await designs.saveProject("owner",created.project.id,body)).status,409);
  const races=await Promise.all(Array.from({length:10},(_,i)=>designs.saveProject("owner",created.project.id,{...body,elements:[{id:"text",type:"text",text:"edit "+i}],expectedRevision:first.project.revision})));
  assert.equal(races.filter(r=>r.success).length,1);assert.equal(races.filter(r=>r.status===409).length,9);
  const count=queries;assert.equal((await designs.getProject(null,created.project.id)).status,401);assert.equal(queries,count);
  assert.equal((await designs.getProject("other",created.project.id)).status,404);
  assert.equal((await designs.saveProject("other",created.project.id,body)).status,403);
  console.log("PASS SQL-contract CAS: full microsecond revisions, atomic owner/version predicate, no blind upsert, ten-way stale save race, unauthenticated read denied before query. Not a real PostgreSQL execution.");
})().catch(error=>{console.error(error);process.exitCode=1;});
