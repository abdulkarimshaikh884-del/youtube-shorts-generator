"use strict";
const assert = require("node:assert/strict");
const express = require("express");
const { usesRouteJsonParser } = require("../request-body-policy");

(async () => {
  const app = express();
  const small = express.json({limit:"100kb"});
  app.use((req,res,next) => usesRouteJsonParser(req) ? next() : small(req,res,next));
  const reply = (req,res) => res.json({bytes:Buffer.byteLength(JSON.stringify(req.body))});
  app.put("/api/designs/projects/:id",express.json({limit:"2mb"}),reply);
  app.post("/api/designs/projects/:id",express.json({limit:"2mb"}),reply);
  app.post("/api/designs/publish",express.json({limit:"2mb"}),reply);
  app.post("/api/auth/profile",reply);
  app.use((err,req,res,next) => res.status(err.status || 500).json({error:err.type}));
  const server = await new Promise(resolve => {
    const s=app.listen(0,"127.0.0.1",()=>resolve(s));
  });
  const base="http://127.0.0.1:"+server.address().port;
  try {
    for(const [method,path] of [["PUT","/api/designs/projects/qa"],["POST","/api/designs/projects/qa"],["POST","/api/designs/publish"]]) {
      const good=await fetch(base+path,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({data:"x".repeat(122976)})});
      assert.equal(good.status,200,path);
      assert.ok((await good.json()).bytes>100*1024);
      const large=await fetch(base+path,{method,headers:{"Content-Type":"application/json"},body:JSON.stringify({data:"x".repeat(2*1024*1024)})});
      assert.equal(large.status,413,path+" remains bounded");
    }
    const unrelated=await fetch(base+"/api/auth/profile",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({data:"x".repeat(122976)})});
    assert.equal(unrelated.status,413,"ordinary APIs retain the small limit");
    assert.equal(usesRouteJsonParser({method:"POST",path:"/api/designs/projects/qa/extra"}),false);
    assert.equal(usesRouteJsonParser({method:"DELETE",path:"/api/designs/projects/qa"}),false);
    console.log("PASS: Designs save/publish accept >100KB, retain 2MB cap; unrelated routes retain 100KB cap.");
  } finally { await new Promise(resolve=>server.close(resolve)); }
})().catch(err=>{console.error(err);process.exitCode=1;});
