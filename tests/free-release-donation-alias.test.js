"use strict";
// Actual legacy handler + actual social module; no dotenv/database/provider.
const assert = require("node:assert/strict"), express = require("express");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const db = require("../db"), social = require("../social"), releasePolicy = require("../release-policy");
let dataCalls = 0;
db.query = async () => { dataCalls++; throw Error("Production/storage call prohibited"); };
db.tx = async () => { dataCalls++; throw Error("Production/storage call prohibited"); };
const app = express(); app.use(express.json());
app.use((req,_res,next) => { req.user = req.headers["x-test-user"] ? {id:"isolated-sender",role:"user",plan:"pro"} : null; next(); });
const source = fs.readFileSync(path.resolve(__dirname,"../server.js"),"utf8");
vm.runInNewContext(source.slice(source.indexOf('app.post("/api/auth/star"'),source.indexOf('// ── Credits')),{app,social,releasePolicy});
// Deliberately register the global gate later, reproducing the original order.
app.use(releasePolicy.middleware);
(async () => {
  assert.equal(releasePolicy.monetizationEnabled,false);
  assert.equal((await social.donateStars(null,"recipient",1)).status,401);
  const direct = await social.donateStars({id:"isolated-sender",plan:"pro"},"recipient",1);
  assert.equal(direct.status,503); assert.equal(direct.code,"MONETIZATION_COMING_SOON");
  const server=app.listen(0,"127.0.0.1");await new Promise(r=>server.once("listening",r));
  try {
    const base="http://127.0.0.1:"+server.address().port;
    for(const signedIn of [false,true]) {
      const response=await fetch(base+"/api/auth/star",{method:"POST",headers:{"Content-Type":"application/json",...(signedIn?{"x-test-user":"true"}:{})},body:'{"userId":"recipient","amount":1}'});
      assert.equal(response.status,signedIn?503:401);
      if(signedIn)assert.equal((await response.json()).code,"MONETIZATION_COMING_SOON");
    }
    assert.equal(dataCalls,0,"Legacy and internal donations stop before lookup/grant/donation/notification writes");
    console.log("PASS legacy donation alias and internal caller: guest401/authenticated503, zero DB reads/writes even with late global middleware (actual handler/module, isolated).");
  } finally { await new Promise(r=>server.close(r)); }
})().catch(e=>{console.error(e);process.exitCode=1;});
