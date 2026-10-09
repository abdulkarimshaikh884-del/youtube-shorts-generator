"use strict";
const assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm"),path=require("node:path");
// Exercise the actual post-render response block, not a copied implementation.
const source=fs.readFileSync(path.join(__dirname,"../server.js"),"utf8");
const start=source.indexOf('    res.setHeader("Content-Type", "video/mp4")');
const end=source.indexOf('  } catch (err) {\n    await credits.refund(req, "export");',start);
assert(start>0&&end>start);
let rewarded=0,delivered;
const mp4=Buffer.from("fixture-mp4"),headers={};
const context={mp4,req:{user:{id:"fixture"},_creditChargeIds:{export:"charge"},credits:{token:"fixture"}},tpl:"test",aspect:"9:16",sourceMetricId:"test",crypto:require("node:crypto"),
  res:{setHeader:(k,v)=>headers[k]=v,end:body=>{delivered=body;}},social:{recordEvent:async()=>{}},
  referrals:{successfulExport:async()=>{rewarded++;}},credits:{state:async()=>{throw Error("balance temporarily unavailable");}},console:{error:()=>{},warn:()=>{}}};
vm.runInNewContext("(async()=>{\n"+source.slice(start,end)+"\n})()",context).then(()=>{
  assert.equal(rewarded,1);assert.equal(delivered,mp4);assert.equal(headers["Content-Type"],"video/mp4");assert.equal(headers["X-Credits-Left"],undefined);
  console.log("PASS actual post-render response block: a balance outage does not discard a successful export or reenter the refund handler. Mock dependencies; renderer tested separately.");
}).catch(error=>{console.error(error);process.exitCode=1;});
