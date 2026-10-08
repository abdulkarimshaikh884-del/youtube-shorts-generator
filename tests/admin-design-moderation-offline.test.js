"use strict";
// Actual admin module + atomic memory adapter; no production moderation.
const assert=require("node:assert/strict"),fs=require("node:fs"),path=require("node:path"),vm=require("node:vm");
const owner={id:"owner",role:"super_admin"};
let state={design:{id:"dt_test",title:"Design",category:"Thumbnail",status:"published",canvas:{width:1280,height:720},elements:[{type:"text",text:"Native layer"}]},audit:[]};
let failAudit=false;
function client(draft){return {async query(raw,p=[]){
 const sql=raw.replace(/\s+/g," ").trim();
 if(sql.startsWith("select * from public.design_templates"))return {rows:p[0]===draft.design.id?[structuredClone(draft.design)]:[]};
 if(sql.startsWith("update public.design_templates")){draft.design.status=p[1];return {rows:[structuredClone(draft.design)]};}
 if(sql.startsWith("insert into public.admin_audit_log")){if(failAudit)throw Error("Audit unavailable");draft.audit.push({id:draft.audit.length,actor:p[0],action:p[1],entityType:p[2],entityId:p[3],before:JSON.parse(p[4]),after:JSON.parse(p[5])});return {rows:[]};}
 if(sql.includes("from public.community_templates ct"))return {rows:[]};
 if(sql.includes("from public.design_templates dt")){
   assert(sql.includes("a.after_data->>'reviewNote'"));assert(sql.includes("a.action = 'design_template_moderation'"));
   return {rows:[{...structuredClone(draft.design),review_note:draft.audit.at(-1)?.after.reviewNote||"",source_format:"design_template"}]};
 }
 throw Error("Unexpected isolated SQL: "+sql);
}};}
const db={query:(...args)=>client(state).query(...args),async tx(fn){const draft=structuredClone(state);const result=await fn(client(draft));state=draft;return result;}};
const target={exports:{}};
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,"../admin.js"),"utf8"),{
 module:target,exports:target.exports,console,process:{env:{}},require:n=>n==="./db"?db:n==="./permissions"?require("../permissions"):n==="./notify"||n==="./credits"?{}:require(n)
});
const admin=target.exports;
(async()=>{
 assert.equal((await admin.updateContent({role:"user"},"dt_test",{status:"rejected",reviewNote:"No rights"})).status,403);
 assert.equal((await admin.updateContent(owner,"dt_test",{status:"rejected"})).status,400);
 const original=structuredClone(state.design);
 const rejected=await admin.updateContent(owner,"dt_test",{status:"rejected",reviewNote:"  Missing image rights.  "});
 assert.equal(rejected.template.reviewNote,"Missing image rights.");
 assert.equal((await admin.listContent(owner)).templates[0].reviewNote,"Missing image rights.","Rejection reason survives admin reload");
 assert.deepEqual(state.design.canvas,original.canvas);assert.deepEqual(state.design.elements,original.elements);
 assert.equal(JSON.stringify(state.design).includes("Missing image rights"),false,"Private reason is absent from public design data");
 const before=structuredClone(state);failAudit=true;
 await assert.rejects(admin.updateContent(owner,"dt_test",{status:"published"}),/Audit unavailable/);
 assert.deepEqual(state,before,"Audit failure rolls back status and reason together");
 failAudit=false;await admin.updateContent(owner,"dt_test",{status:"published"});
 assert.equal((await admin.listContent(owner)).templates[0].reviewNote,"","Approval clears previous private note from current moderation state");
 console.log("PASS design moderation: permission/reason gates, durable admin reload, untouched canvas/layers, private audit-only note and atomic audit failure rollback (isolated).");
})().catch(e=>{console.error(e);process.exitCode=1;});
