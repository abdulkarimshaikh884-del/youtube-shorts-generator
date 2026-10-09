"use strict";
// Actual admin.js + closed VM dependencies and a transactional memory adapter.
// Never loads db.js/dotenv or reaches PostgreSQL, production, mail or providers.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const permissions = require("../permissions");
const owner = {id:"owner",role:"super_admin"};
const staff = keys => ({id:"staff",role:"moderator",staff_permissions:keys});
const targetId = "11111111-1111-4111-8111-111111111111";
const authorId = "22222222-2222-4222-8222-222222222222";
const jobId = "job_" + "a".repeat(32);
const original = "/api/design-assets/" + jobId + "/original.webp";
const cutout = "/api/design-assets/" + jobId + "/assets/cutout_01.webp";
const foreign = "/api/design-assets/job_" + "b".repeat(32) + "/original.webp";
const checks = [], calls = [], failures = [];
let scenario, queryFails = false, failAudit = false, failSessionDelete = false;
let assets = new Map(), design, state;
function reset(mode) {
  scenario = mode; calls.length = 0; queryFails = failAudit = failSessionDelete = false;
  design = {id:"dt_private",title:"Private pending design",status:"review",author_id:authorId,
    canvas:{width:1280,height:720},elements:[{id:"text",type:"text",text:"Native text"},{id:"image",type:"image",src:cutout,dataSrc:original}],
    preview_url:original,author_email:"must-not-leak@example.test",review_note:"Private moderation reason",internal_token:"never-return"};
  assets = new Map([[original,{owner:authorId,public:false,content:Buffer.from("original fixture")}],
    [cutout,{owner:authorId,public:false,content:Buffer.from("cutout fixture")}],
    [foreign,{owner:"another-owner",public:false,content:Buffer.from("foreign fixture")}]]);
  state = {target:{id:targetId,role:"user",handle:"member",verified:false,staff_permissions:["overview.view"]},sessions:["old-session"],audit:[],notices:[]};
}
function record(executor,raw,p=[]) { const sql=raw.replace(/\s+/g," ").trim(); calls.push({executor,sql,p:structuredClone(p)}); return sql; }
const db = {
  async query(raw,p=[]) {
    const sql = record("db",raw,p);
    if (queryFails) throw Error("Isolated database unavailable");
    assert(sql.startsWith("select "),"Nontransactional writes are not permitted by this fixture");
    if (scenario === "jobs") {
      assert(sql.includes("from public.design_conversion_jobs j"));
      assert(sql.includes("j.status = $1"));
      assert(sql.includes("$1 = 'processing' and j.status in ('queued','analyzing','detecting_text','segmenting_objects','reconstructing_background')"));
      const statuses = ["complete","queued","analyzing","detecting_text","segmenting_objects","reconstructing_background","processing","failed","cancelled"];
      const wanted = p[0];
      return {rows:statuses.filter(s=>wanted === "all" || s === wanted || (wanted === "processing" && ["queued","analyzing","detecting_text","segmenting_objects","reconstructing_background"].includes(s))).map((status,i)=>({id:"job"+i,status,user_id:targetId,handle:"member",display_name:"Member",progress:status === "complete" ? 100 : 30,design_type:"thumbnail",source_image_name:"photo.webp",created_at:"2026-10-08T10:00:00Z",completed_at:status === "complete" ? "2026-10-08T10:00:06Z" : null}))};
    }
    if (scenario === "audit") {
      assert(sql.includes("from public.admin_audit_log a"));
      assert(sql.includes("strpos(")); assert(sql.includes("lower($1)")); assert(sql.includes("a.created_at desc, a.id desc limit 250"));
      return {rows:[{id:"audit-fixture",action:"user_banned",entity_type:"user",entity_id:targetId}]};
    }
    if (scenario === "preview") {
      if (sql.includes("from public.design_templates")) return {rows:design && p[0] === design.id ? [structuredClone(design)] : []};
      assert(sql.startsWith("select content from public.design_assets"));
      assert(sql.includes("job_id=$1 and asset_path=$2 and (user_id=$3 or is_public=true)"),"Asset query is scoped to the selected design author or public content");
      assert.equal(p[2],design.author_id);
      const asset = assets.get("/api/design-assets/"+p[0]+"/"+p[1]);
      return {rows:asset && (asset.owner === p[2] || asset.public) ? [{content:asset.content}] : []};
    }
    if (scenario === "flags") return {rows:[{key:"payments",enabled:true,description:"Legacy stored flag",updated_at:"2026-10-08T10:00:00Z"}]};
    throw Error("Unexpected read-only fixture query: " + sql);
  },
  async tx(fn) {
    assert.equal(scenario,"moderation");
    const draft = structuredClone(state);
    const client = {async query(raw,p=[]) {
      const sql=record("tx",raw,p);
      if (sql.startsWith("select id, email, display_name, handle, role, verified from public.users")) {
        assert(sql.endsWith("for update"),"Moderation locks the target row");
        return {rows:draft.target && draft.target.id === p[0] ? [structuredClone(draft.target)] : []};
      }
      if (sql.startsWith("update public.users set role = 'banned'")) { draft.target.role="banned"; return {rows:[]}; }
      if (sql.startsWith("update public.users set role = 'user'")) {
        assert(sql.includes("staff_permissions = '{}'::text[]"),"Unban never restores prior staff grants");
        draft.target.role="user";draft.target.staff_permissions=[];return {rows:[]};
      }
      if (sql.startsWith("delete from public.sessions")) {
        if (failSessionDelete) throw Error("Session deletion unavailable");
        assert.equal(p[0],targetId);draft.sessions=[];return {rows:[]};
      }
      if (sql.startsWith("insert into public.admin_audit_log")) {
        if (failAudit) throw Error("Audit unavailable");
        draft.audit.push({actor:p[0],action:p[1],type:p[2],id:p[3],before:JSON.parse(p[4]),after:JSON.parse(p[5])});return {rows:[]};
      }
      throw Error("Unexpected transactional query: " + sql);
    }};
    const result=await fn(client);state=draft;return result;
  }
};
const moduleStub={exports:{}};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,"../admin.js"),"utf8"),{
  module:moduleStub,exports:moduleStub.exports,process:{env:{}},Buffer,
  console:{log(){},warn(){},error(){}},
  require(name) {
    if(name === "./db") return db;
    if(name === "./permissions") return permissions;
    if(name === "./notify" || name === "./credits") return {};
    throw Error("Unexpected Admin dependency: " + name);
  }
},{filename:"admin.js"});
const admin=moduleStub.exports;
async function check(name,fn) {
  try { await fn(); checks.push(name);console.log("PASS",name); }
  catch(error) { failures.push({name,error:error.message});console.error("FAIL",name,error.message); }
}
(async()=>{
  await check("Each new read endpoint denies ordinary/banned/ungranted staff before querying storage",async()=>{
    reset("jobs");
    for(const user of [null,{role:"user",staff_permissions:permissions.PERMISSIONS.map(p=>p.key)},{role:"banned",staff_permissions:["templates.moderate"]},staff([])]) {
      for(const action of [()=>admin.listAiJobs(user),()=>admin.listAuditLogs(user),()=>admin.designPreview(user,"dt_private"),()=>admin.designPreviewAsset(user,"dt_private",original),()=>admin.listFlags(user)]) assert.equal((await action()).status,403);
    }
    assert.equal(calls.length,0);
  });
  await check("AI complete and legacy completed query actual complete; processing includes actual pipeline stages",async()=>{
    reset("jobs");const viewer=staff(["ai_jobs.view"]);
    for(const status of ["complete","completed"]) { const result=await admin.listAiJobs(viewer,{status});assert.equal(result.success,true);assert.equal(result.jobs.length,1);assert.equal(result.jobs[0].status,"complete");assert.equal(result.jobs[0].durationSec,6);assert.equal(calls.at(-1).p[0],"complete"); }
    const processing=await admin.listAiJobs(viewer,{status:"processing"});
    assert.deepEqual(Array.from(processing.jobs,j=>j.status),["queued","analyzing","detecting_text","segmenting_objects","reconstructing_background","processing"]);
    assert.equal(processing.jobs.every(j=>j.durationSec===null),true);
    assert.equal((await admin.listAiJobs(viewer)).jobs.length,9);
  });
  await check("Unknown/injected AI status is rejected before storage; outages return truthful 503",async()=>{
    reset("jobs");
    for(const status of ["complete' OR 1=1 --","invented","__proto__",["queued","failed"]]) assert.equal((await admin.listAiJobs(owner,{status})).status,400);
    assert.equal(calls.length,0);queryFails=true;const result=await admin.listAiJobs(owner,{status:"failed"});assert.equal(result.status,503);assert.equal(result.success,undefined);
  });
  await check("Audit q is a bounded literal parameter, not SQL or LIKE wildcard input",async()=>{
    reset("audit");const viewer=staff(["audit.view"]),q="  %_' OR 1=1 --  ";
    assert.equal((await admin.listAuditLogs(viewer,{q})).success,true);
    assert.equal(calls[0].p[0],q.trim());assert.equal(calls[0].sql.includes(q.trim()),false);assert.equal(calls[0].sql.includes(" like "),false);
    await admin.listAuditLogs(viewer,{q:"x".repeat(500)});assert.equal(calls[1].p[0].length,150);
    await admin.listAuditLogs(viewer);assert.equal(calls[2].p[0],"");
  });
  await check("Design preview requires templates.moderate, validates IDs and returns only rendering fields",async()=>{
    reset("preview");const moderator=staff(["templates.moderate"]);
    assert.equal((await admin.designPreview(staff(["overview.view","audit.view"]),"dt_private")).status,403);
    for(const id of ["../secret","dt_' OR 1=1 --","x".repeat(101),null]) assert.equal((await admin.designPreview(moderator,id)).status,404);
    assert.equal(calls.length,0);
    const result=await admin.designPreview(moderator,"dt_private");
    assert.equal(result.success,true);assert.deepEqual(Object.keys(result.template).sort(),["canvas","elements","id","previewUrl","status","title"]);
    assert.equal(JSON.stringify(result).includes("must-not-leak@"),false);assert.equal(JSON.stringify(result).includes("Private moderation reason"),false);assert.equal(JSON.stringify(result).includes("never-return"),false);
    const expected=source=>"/api/admin/design-templates/dt_private/asset?src="+encodeURIComponent(source);
    assert.equal(result.template.previewUrl,expected(original));assert.equal(result.template.elements[1].src,expected(cutout));assert.equal(result.template.elements[1].dataSrc,expected(original));
  });
  await check("Private preview assets must be referenced by the selected design and owned by its author",async()=>{
    reset("preview");const moderator=staff(["templates.moderate"]);
    const result=await admin.designPreviewAsset(moderator,"dt_private",cutout);assert.equal(result.success,true);assert.equal(Buffer.from(result.content).toString(),"cutout fixture");
    assert.equal(calls.at(-1).p[2],authorId);
    const before=calls.length;assert.equal((await admin.designPreviewAsset(moderator,"dt_private",foreign)).status,404);assert.equal(calls.length,before+1,"Unreferenced assets never reach the asset table");
    design.elements.push({type:"image",src:foreign});assert.equal((await admin.designPreviewAsset(moderator,"dt_private",foreign)).status,404,"Referencing another user's private asset cannot grant access");
    assets.get(foreign).public=true;assert.equal((await admin.designPreviewAsset(moderator,"dt_private",foreign)).success,true,"Referenced public assets remain readable");
  });
  await check("Asset traversal/URL schemes/oversized references are denied before querying storage",async()=>{
    reset("preview");
    for(const source of ["https://other.invalid/private.webp","data:image/png;base64,secret",original+"?token=private",cutout.replace("cutout_01","../private"),"/api/design-assets/"+jobId+"/assets/"+"x".repeat(161)+".webp","/api/design-assets/"+jobId+"/assets/"+"x".repeat(5000)+".webp",original.replace("a".repeat(32),"A".repeat(32))]) assert.equal((await admin.designPreviewAsset(owner,"dt_private",source)).status,404);
    assert.equal(calls.length,0,"Invalid source references must not trigger even a design lookup");
  });
  await check("Malformed legacy layer payloads are handled without throwing or exposing arbitrary row data",async()=>{
    reset("preview");design.elements=[null,{id:"text",type:"text",text:"Valid layer"}];
    const result=await admin.designPreview(owner,"dt_private");
    assert(result.success===true || [400,404,422,503].includes(result.status));
    if(result.success) assert.equal(result.template.elements.some(e=>e===null),false);
    design.preview_url=null;design.elements={not:"an array"};
    assert.equal((await admin.designPreviewAsset(owner,"dt_private",cutout)).status,404);
  });
  await check("Legacy flags are explicitly unsupported and Boolean updates never mutate storage",async()=>{
    reset("flags");const manager=staff(["flags.manage"]);
    const result=await admin.listFlags(manager);assert.equal(result.flags[0].runtimeSupported,false);assert.match(result.flags[0].readOnlyReason,/deployment configuration/);
    const count=calls.length;
    for(const actor of [owner,manager]) { for(const enabled of [true,false]) {const result=await admin.setFlag(actor,"payments",enabled);assert.equal(result.status,409);assert.equal(result.success,undefined);} assert.equal((await admin.setFlag(actor,"payments","true")).status,400); }
    assert.equal((await admin.setFlag(staff(["audit.view"]),"payments",true)).status,403);assert.equal(calls.length,count);
  });
  await check("Moderation validates authority, target and reason and cannot modify the owner",async()=>{
    reset("moderation");const manager=staff(["users.manage"]);
    assert.equal((await admin.moderateUser(staff(["users.view"]),targetId,"ban",{reason:"QA"})).status,403);
    assert.equal((await admin.moderateUser(manager,"not-a-uuid","ban",{reason:"QA"})).status,404);assert.equal(calls.length,0);
    for(const action of ["ban","unban"]) assert.equal((await admin.moderateUser(manager,targetId,action,{reason:"   "})).status,400);
    assert.equal(calls.every(c=>c.sql.startsWith("select ")),true);
    state.target.role="super_admin";assert.equal((await admin.moderateUser(owner,targetId,"ban",{reason:"QA"})).status,403);assert.equal(state.target.role,"super_admin");
  });
  await check("Ban locks target, revokes all sessions and audits the same committed transaction",async()=>{
    reset("moderation");const result=await admin.moderateUser(staff(["users.manage"]),targetId,"ban",{reason:"  Safety review  "});
    assert.equal(result.success,true);assert.equal(state.target.role,"banned");assert.deepEqual(state.sessions,[]);assert.equal(state.audit.length,1);assert.equal(calls.every(c=>c.executor==="tx"),true);
    assert.equal(state.audit[0].action,"user_banned");assert.deepEqual(state.audit[0].before,{role:"user"});assert.deepEqual(state.audit[0].after,{role:"banned",reason:"Safety review"});
    assert(calls.findIndex(c=>c.sql.startsWith("delete from public.sessions"))<calls.findIndex(c=>c.sql.startsWith("insert into public.admin_audit_log")));
  });
  await check("Audit/session-delete failure rolls back ban state and every session",async()=>{
    reset("moderation");let before=structuredClone(state);failAudit=true;
    await assert.rejects(admin.moderateUser(owner,targetId,"ban",{reason:"QA"}),/Audit unavailable/);assert.deepEqual(state,before);
    failAudit=false;failSessionDelete=true;await assert.rejects(admin.moderateUser(owner,targetId,"ban",{reason:"QA"}),/Session deletion unavailable/);assert.deepEqual(state,before);
  });
  await check("Unban is atomic, requires a banned target, clears staff and never restores sessions",async()=>{
    reset("moderation");assert.equal((await admin.moderateUser(owner,targetId,"unban",{reason:"QA"})).status,400);
    state.target.role="banned";state.sessions=[];const before=structuredClone(state);failAudit=true;
    await assert.rejects(admin.moderateUser(owner,targetId,"unban",{reason:"QA"}),/Audit unavailable/);assert.deepEqual(state,before);
    failAudit=false;assert.equal((await admin.moderateUser(owner,targetId,"unban",{reason:"Appeal approved"})).success,true);
    assert.equal(state.target.role,"user");assert.deepEqual(state.target.staff_permissions,[]);assert.deepEqual(state.sessions,[]);assert.equal(state.audit[0].action,"user_unbanned");assert.equal(calls.every(c=>c.executor==="tx"),true);
  });
  console.log(`ADMIN_HARDENING_OFFLINE=${failures.length?"FAIL":"PASS"} (${checks.length}/${checks.length+failures.length} checks; isolated memory adapter only)`);
  if(failures.length) { console.error(JSON.stringify(failures,null,2));process.exitCode=1; }
})().catch(error=>{console.error(error);process.exitCode=1;});
