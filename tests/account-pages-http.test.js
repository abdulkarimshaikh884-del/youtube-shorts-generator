"use strict";
// Run the actual page-route registration from server.js with real Express.
// No application boot, dotenv, DB, session, provider or background-worker calls.
const assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const root = path.resolve(__dirname,"..");
const source = fs.readFileSync(path.join(root,"server.js"),"utf8");
const app = require("express")();
const routes = require("../public/account-routes");
const start = source.indexOf("const PAGES = {");
const end = source.indexOf("// ── Global error handler",start);
assert(start>0 && end>start);
vm.runInNewContext(source.slice(start,end),{
  app,path,__dirname:root,console,
  require(name) { assert.equal(name,"./public/account-routes"); return routes; }
});
(async()=>{
  const server = app.listen(0,"127.0.0.1");
  await new Promise(resolve=>server.once("listening",resolve));
  try {
    const base = "http://127.0.0.1:"+server.address().port;
    for (const route of Object.values(routes)) {
      const response = await fetch(base+route+"?route_qa=1");
      assert.equal(response.status,200,route);
      assert.match(response.headers.get("content-type"),/text\/html/);
      assert((await response.text()).includes('/account-routes.js?v=2026100502'));
    }
    assert.equal((await fetch(base+routes.edit,{method:"HEAD"})).status,200);
    assert.equal((await fetch(base+"/account/not-a-setting")).status,404);
    console.log("PASS actual Express page routing: all 12 account URLs serve the canonical page, query/HEAD supported, unknown path 404. DB/auth boot intentionally excluded.");
  } finally { await new Promise(resolve=>server.close(resolve)); }
})().catch(err=>{console.error(err);process.exitCode=1;});
