"use strict";
// Runs the actual admin module against a closed read-only adapter. No dotenv,
// real accounts, network, providers or production moderation are involved.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const permissions = require("../permissions");
const owner = {id:"owner",role:"super_admin"};
const staff = keys => ({id:"staff",role:"moderator",staff_permissions:keys});
function harness(row, users = []) {
  const calls = [];
  let docOwnerMatches = true;
  const db = {async query(raw, params = []) {
    const sql = raw.replace(/\s+/g," ").trim();
    calls.push({sql, params});
    assert(sql.startsWith("select "), "Preview must not mutate storage");
    if (sql.startsWith("select u.id,")) return {rows:users};
    if (sql.includes("from public.lottie_docs")) {
      assert(sql.includes("id=$1 and owner_id=$2"));
      assert.equal(params[1],row.author_id);
      return {rows:docOwnerMatches ? [{id:params[0]}] : []};
    }
    if (sql.includes("from public.community_templates where id=$1")) return {rows:row && params[0]===row.id ? [structuredClone(row)] : []};
    if (sql.includes("from public.design_templates dt")) return {rows:[]};
    if (sql.includes("from public.community_templates ct") && sql.includes("ct.review_note")) return {rows:row ? [structuredClone(row)] : []};
    if (sql.startsWith("select id, display_name, handle, created_at from public.users")) {
      assert(sql.endsWith("order by created_at desc, id desc limit 5"));
      return {rows:users.slice(0,5)};
    }
    if (sql.includes("from public.admin_audit_log a")) return {rows:[]};
    if (sql.includes("as users,")) return {rows:[{users:users.length}]};
    if (sql.includes("from public.users u")) return {rows:users};
    throw Error("Unexpected read: "+sql);
  }};
  const target = {exports:{}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,"../admin.js"),"utf8"), {
    module:target,exports:target.exports,console,process:{env:{}},
    require:n=>n==="./db"?db:n==="./permissions"?permissions:n==="./notify"||n==="./credits"?{}:require(n)
  });
  return {admin:target.exports,calls,setDocOwnerMatches(value){docOwnerMatches=value;}};
}
function animation(overrides = {}) {
  return {id:"comm_preview",title:"Submitted title",description:"Uploaded description",status:"review",tpl:"text-vox-impact",
    props:{line0:"Creator edited title",offsetX:19,untrusted:"</script><script>unsafe()</script>"},lines:["Actual subtitle"],
    aspect:"16:9",accent:"#2563eb",font:"grotesk",dur:7420,source_format:"shortscraft_preset",author_id:"author",
    author_email:"private@example.test",review_note:"Private audit reason",internal_token:"not-for-preview",...overrides};
}
test("animation moderation denies ungranted callers and malformed IDs before any query", async () => {
  const {admin,calls} = harness(animation());
  for (const user of [null,{id:"u",role:"user"},staff(["overview.view","users.view"])]) assert.equal((await admin.animationPreview(user,"comm_preview")).status,403);
  for (const id of [null, [], "../secret", "x".repeat(101), "comm_' or true --"]) assert.equal((await admin.animationPreview(owner,id)).status,404);
  assert.equal(calls.length,0);
});
test("preview returns exact submitted native fields for nonpublic states without publishing or private row fields", async () => {
  for (const status of ["review","draft","rejected","archived","scheduled","published"]) {
    const row = animation({status,lines:JSON.stringify(["Actual subtitle","Second line"])});
    const {admin,calls} = harness(row);
    const result = await admin.animationPreview(staff(["templates.moderate"]),row.id);
    assert.equal(result.success,true);assert.equal(result.template.status,status);
    assert.equal(result.template.dur,7420);assert.equal(result.template.aspect,"16:9");
    assert.deepEqual(JSON.parse(JSON.stringify(result.template.props)),row.props);
    assert.deepEqual(Array.from(result.template.lines),["Actual subtitle","Second line"]);
    assert.deepEqual(Object.keys(result.template).sort(),["id","title","description","status","tpl","props","lines","aspect","accent","font","dur","sourceFormat"].sort());
    assert.equal(calls.length,1);assert.equal(calls[0].params[0],row.id);
    assert(!calls[0].sql.includes("status = 'published'"));
    assert(!JSON.stringify(result).includes(row.author_email));
    assert(!JSON.stringify(result).includes(row.review_note));
  }
});
test("missing/malformed/oversized submitted state gives explicit unavailable outcome", async () => {
  assert.equal((await harness(null).admin.animationPreview(owner,"missing")).status,404);
  assert.equal((await harness(animation({tpl:"<script>"})).admin.animationPreview(owner,"comm_preview")).status,409);
  assert.equal((await harness(animation({props:{payload:"x".repeat(400001)}})).admin.animationPreview(owner,"comm_preview")).status,409);
  const result = await harness(animation({props:[],lines:"bad json"})).admin.animationPreview(owner,"comm_preview");
  assert.equal(result.success,true);assert.deepEqual(Array.from(result.template.lines),[]);
  assert.deepEqual(Object.keys(result.template.props),[]);
});
test("Lottie lookup is bound to selected submission and its author, never a caller-chosen foreign document", async () => {
  const row=animation({tpl:"lottie",props:{doc:"lt_abcdefghijklmnop",t1:"Edited text",c1:"#ff2200"},source_format:"lottie_json"});
  const h=harness(row);
  assert.equal((await h.admin.animationPreview(owner,row.id)).success,true);
  assert.equal(h.calls[1].params[0],row.props.doc);
  h.setDocOwnerMatches(false);
  assert.equal((await h.admin.animationPreview(owner,row.id)).status,409);
  const invalid=harness(animation({tpl:"lottie",props:{doc:"../../secret"}}));
  assert.equal((await invalid.admin.animationPreview(owner,row.id)).status,409);assert.equal(invalid.calls.length,1);
});
test("recent joins feed requires users.view and carries real public handles without emails", async () => {
  const users=[{id:"person",display_name:"New creator",handle:"actual_handle",created_at:"2026-10-25T10:00:00Z",email:"not-public@example.test"},
    {id:"no-handle",display_name:"Member",handle:null,created_at:"2026-10-24T10:00:00Z",email:"do-not-invent@example.test"}];
  const denied=harness(null,users);
  const limited=await denied.admin.dashboard(staff(["overview.view"]));
  assert.deepEqual(Array.from(limited.recentUsers),[]);
  assert(!denied.calls.some(q=>q.sql.startsWith("select id, display_name")));
  const h=harness(null,users),result=await h.admin.dashboard(staff(["overview.view","users.view"]));
  assert.equal(result.recentUsers.length,2);assert.equal(result.recentUsers[0].profileHandle,"actual_handle");
  assert.equal(result.recentUsers[1].profileHandle,"");
  assert(!JSON.stringify(result.recentUsers).includes("@example.test"));
  assert.deepEqual(Object.keys(result.recentUsers[0]).sort(),["id","displayName","profileHandle","createdAt"].sort());
});
test("account lists do not turn email-derived display handles into public profile links", async () => {
  const users=[{id:"abcdef12",display_name:"Member",handle:null,email:"fallback@example.test"}];
  const {admin}=harness(null,users);
  for (const result of [await admin.listUsers(owner),await admin.listCreators(owner)]) {
    const item=(result.users||result.creators)[0];
    assert.equal(item.handle,"@fallback");assert.equal(item.profileHandle,"");
  }
});
test("protected route is a rate limited read with no-store and leaves public status checks intact", () => {
  const src=fs.readFileSync(path.resolve(__dirname,"../server.js"),"utf8");
  assert.match(src,/registerAdmin\("get", "\/api\/admin\/animation-templates\/:id\/preview", rateLimit/);
  const block=src.slice(src.indexOf('registerAdmin("get", "/api/admin/animation-templates/:id/preview"'));
  assert.match(block.slice(0,600),/Cache-Control", "private, no-store/);
  assert.match(block.slice(0,600),/admin\.animationPreview\(req\.user, req\.params\.id\)/);
  assert.match(src,/req\.path === "\/admin" \? " https:\/\/www\.youtube-nocookie\.com" : ""/);
});
