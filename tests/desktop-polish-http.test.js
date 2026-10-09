"use strict";
// Owned local PostgreSQL only. External calls are blocked by the QA runner.
const assert = require("node:assert/strict"), crypto = require("node:crypto"), fs = require("node:fs"), path = require("node:path");
const {Pool} = require("pg");
require("./helpers/isolated-postgres").assertIsolatedPostgres();
const base = process.env.BASE_URL;
assert.equal(new URL(base).origin,"http://127.0.0.1:3341");
const setup = new Pool({connectionString:"postgresql://postgres:local-qa-only-not-production@127.0.0.1:55437/shortscraft_qa",ssl:false});
const suffix = crypto.randomBytes(5).toString("hex"), password="Local-QA-strong-password-2026";
const checks=[];
function pass(label) { checks.push(label); console.log("PASS "+label); }
function jar() {
  const cookies = {};
  return async (url,method="GET",body)=>{
    const cookie = Object.entries(cookies).map(([k,v])=>k+"="+v).join("; ");
    const r=await fetch(base+url,{method,headers:{Cookie:cookie,"Content-Type":"application/json"},body:body===undefined?undefined:JSON.stringify(body)});
    for(const line of r.headers.getSetCookie()) { const pair=line.split(";")[0],i=pair.indexOf("=");cookies[pair.slice(0,i)]=pair.slice(i+1); }
    return {status:r.status,data:await r.json()};
  };
}
(async()=>{
  await setup.query(fs.readFileSync(path.join(__dirname,"../supabase/migrations/20261008163422_creator_profile_details.sql"),"utf8"));
  const a=jar(),b=jar(),guest=jar();
  const first=await a("/api/auth/signup","POST",{email:`profile-${suffix}@example.test`,password,handle:"profile_"+suffix});
  assert(first.data.user,JSON.stringify(first.data));const uid=first.data.user.id;
  const other=await b("/api/auth/signup","POST",{email:`other-${suffix}@example.test`,password,handle:"other_"+suffix});assert(other.data.user);
  assert.equal((await guest("/api/account/transactions")).status,401);pass("History requires authentication");
  const fields={creatorType:"Motion designer",niche:"Hindi motion design",languages:"Hindi, English",businessEmail:"collabs@example.test",portfolio:"https://portfolio.example.test/creator",telegram:"https://t.me/qa_creator",x:"https://x.com/qa_creator",linkedin:"https://linkedin.com/in/qa_creator",tiktok:"https://www.tiktok.com/@qa_creator"};
  const saved=await a("/api/auth/profile","POST",{creatorDetails:fields});assert.equal(saved.status,200);assert.equal(saved.data.user.creatorDetails.niche,fields.niche);
  assert.equal((await a("/api/auth/me")).data.user.creatorDetails.telegram,fields.telegram);pass("Creator details persist through real DB and auth reload");
  const publicProfile=await guest("/api/creator?handle=profile_"+suffix);assert.equal(publicProfile.status,200);assert.equal(publicProfile.data.creator.creatorDetails.niche,fields.niche);assert.equal(publicProfile.data.creator.email,undefined);pass("Only intentional public business info is exposed; login email remains private");
  for(const bad of [{portfolio:"javascript:alert(1)"},{x:"https://x.com.evil.test/foo"},{telegram:"https://t.me@evil.test/foo"},{businessEmail:"evil\nBcc:other@example.test"},{creatorType:"super_admin"},{niche:"x".repeat(81)}]) {
    const r=await a("/api/auth/profile","POST",{creatorDetails:{...fields,...bad}});assert.equal(r.status,400,JSON.stringify(r));
  }
  assert.equal((await a("/api/auth/me")).data.user.creatorDetails.niche,fields.niche);pass("Unsafe links, forged type, control characters and oversize fields rejected without erasing saved profile");
  await a("/api/auth/profile","POST",{creatorDetails:{...fields,role:"super_admin",verified:true}});
  assert.equal((await a("/api/auth/me")).data.user.role,"user");assert.equal((await a("/api/auth/me")).data.user.creatorDetails.role,undefined);pass("Profile metadata cannot change role or verification");
  const tag="qa-ledger-"+suffix;
  for(let i=0;i<30;i++) await setup.query("insert into public.credit_transactions (credit_key,user_id,kind,amount,balance_after,metadata) values($1,$2,'grant',1,5,$3)",["u:"+uid,uid,JSON.stringify({tag})]);
  const hist=await a("/api/account/transactions?userId="+other.data.user.id);assert.equal(hist.status,200,JSON.stringify(hist));assert.equal(hist.data.transactions.length,25);assert.equal(hist.data.hasMore,true);assert(hist.data.transactions.some(t=>t.unit==="credits"));
  const hist2=await a("/api/account/transactions?offset=25");assert(hist2.data.transactions.length>=5);assert(!hist.data.transactions.some(t=>hist2.data.transactions.some(u=>u.id===t.id)));pass("Actual ledger pagination has stable ordering and no duplicate rows");
  const otherHist=await b("/api/account/transactions?userId="+uid);const ids=new Set(hist.data.transactions.concat(hist2.data.transactions).map(t=>t.id));assert(!otherHist.data.transactions.some(t=>ids.has(t.id)));pass("Client userId cannot read another account's ledger");
  assert.equal((await a("/api/account/transactions?offset=-1")).status,400);assert.equal((await a("/api/account/transactions?offset=abc")).status,400);pass("History rejects invalid pagination");
  const designs=await guest("/api/designs/templates");assert(designs.data.templates.length);const id=designs.data.templates[0].id;
  assert.equal((await guest(`/api/designs/templates/${id}/like`,"PUT",{active:true})).status,401);
  assert.equal((await a("/api/designs/templates/nonexistent/like","PUT",{active:true})).status,404);
  const liked=await a(`/api/designs/templates/${id}/like`,"PUT",{active:true});assert.equal(liked.data.active,true);
  const repeat=await a(`/api/designs/templates/${id}/like`,"PUT",{active:true});assert.equal(repeat.data.count,liked.data.count);pass("Design likes require auth, reject missing designs and are idempotent");
  const reaction=await a("/api/template-reactions?ids="+encodeURIComponent("design:"+id));assert.equal(reaction.data.reactions["design:"+id].like,true);
  const unlike=await a(`/api/designs/templates/${id}/like`,"PUT",{active:false});assert.equal(unlike.data.active,false);pass("Design likes reload from PostgreSQL and unlike removes the real row");
  const column=await setup.query("select relrowsecurity from pg_class where oid='public.users'::regclass");assert.equal(column.rows[0].relrowsecurity,true);
  const access=await setup.query("select has_column_privilege('anon','public.users','creator_details','select') as anon,has_column_privilege('authenticated','public.users','creator_details','select') as authenticated,has_column_privilege('shortscraft_app','public.users','creator_details','update') as app");assert.deepEqual(access.rows[0],{anon:false,authenticated:false,app:true});pass("Migration preserves private custom-auth table and backend-only write access");
  console.log(checks.length+" real PostgreSQL / HTTP checks passed");
})().catch(e=>{console.error(e);process.exitCode=1;}).finally(()=>setup.end());
