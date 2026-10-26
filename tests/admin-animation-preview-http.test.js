"use strict";
// Actual server.js route + actual admin.js permission/serialization, mounted
// alone on ephemeral loopback Express with an isolated read-only DB adapter.
// This deliberately does not import server.js/dotenv or use production data.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const express = require("express");
const permissions = require("../permissions");

test("real protected route denies strangers and previews pending content only for granted moderators", async () => {
  let reads = 0;
  const row = {id:"comm_pending",title:"Pending creator edit",tpl:"text-vox-impact",status:"review",props:{line0:"Submitted words"},lines:["Exact words"],aspect:"16:9",dur:5000,accent:"#2244ff",font:"inter",author_id:"creator",author_email:"not-returned@example.test"};
  const db = {async query(sql, params) {
    reads++;
    assert(sql.trim().startsWith("select "));
    assert(sql.includes("from public.community_templates where id=$1"));
    return {rows:params[0]===row.id ? [row] : []};
  }};
  const module = {exports:{}};
  vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,"../admin.js"),"utf8"),{
    module,exports:module.exports,console,process:{env:{}},
    require:n=>n==="./db"?db:n==="./permissions"?permissions:n==="./notify"||n==="./credits"?{}:require(n)
  });
  const app = express();
  // Test identities exist only inside this ephemeral test app.
  app.use((req,_res,next)=>{
    if (req.headers["x-test-role"]==="member") req.user={id:"member",role:"user"};
    if (req.headers["x-test-role"]==="moderator") req.user={id:"staff",role:"moderator",staff_permissions:["templates.moderate"]};
    next();
  });
  const source = fs.readFileSync(path.resolve(__dirname,"../server.js"),"utf8");
  const start = source.indexOf('registerAdmin("get", "/api/admin/animation-templates/:id/preview"');
  assert(start>=0);
  const end = source.indexOf("\n});",start)+5;
  // Preserve the application's asynchronous rejection boundary.
  const register = source.slice(source.indexOf("function registerAdmin("),source.indexOf("\n}\n",source.indexOf("function registerAdmin("))+2);
  vm.runInNewContext(register+"\n"+source.slice(start,end),{
    app,admin:module.exports,Promise,
    rateLimit:()=> (_req,_res,next)=>next()
  });
  app.use((err,_req,res,_next)=>res.status(500).json({success:false,error:"Isolated route error"}));
  const server=await new Promise(resolve=>{const s=app.listen(0,"127.0.0.1",()=>resolve(s));});
  const base="http://127.0.0.1:"+server.address().port;
  try {
    for(const role of [null,"member"]) {
      const response=await fetch(base+"/api/admin/animation-templates/comm_pending/preview",{headers:role?{"x-test-role":role}:{}});
      assert.equal(response.status,403);assert.equal(response.headers.get("cache-control"),"private, no-store");
      assert.equal((await response.json()).success,false);
    }
    assert.equal(reads,0,"Denied identities cannot query submitted content");
    const accepted=await fetch(base+"/api/admin/animation-templates/comm_pending/preview",{headers:{"x-test-role":"moderator"}});
    assert.equal(accepted.status,200);assert.equal(accepted.headers.get("cache-control"),"private, no-store");
    const result=await accepted.json();assert.equal(result.template.status,"review");
    assert.deepEqual(result.template.props,{line0:"Submitted words"});assert.equal(result.template.aspect,"16:9");
    assert.equal(JSON.stringify(result).includes(row.author_email),false);
    assert.equal(reads,1);
    const absent=await fetch(base+"/api/admin/animation-templates/comm_missing/preview",{headers:{"x-test-role":"moderator"}});
    assert.equal(absent.status,404);assert.equal((await absent.json()).success,false);
  } finally {await new Promise(resolve=>server.close(resolve));}
});
