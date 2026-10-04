"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const vm = require("node:vm");
const fs = require("node:fs");
const path = require("node:path");
const env = { RAZORPAY_KEY_ID:"test-key", RAZORPAY_KEY_SECRET:"test-secret" };
let ledger = [], fail = false, queue = Promise.resolve();
const db = { tx(fn) { const task=queue.then(async()=>{
  const draft=structuredClone(ledger);
  const result = await fn({ async query(sql,p){
    if(sql.includes("pg_advisory_xact_lock")) return {rows:[]};
    if(sql.startsWith("select receiver_id")) return {rows:draft.filter(l=>p.includes(l.idempotency_key))};
    if(sql.includes("insert into public.star_transactions")) {
      if(fail && draft.length) throw Error("write failure");
      draft.push({receiver_id:p[0], amount:p[1], idempotency_key:p[2], note:p[3]});return {rows:[]};
    }
    throw Error("Unexpected SQL: "+sql);
  }}); ledger=draft;return result;
 });queue=task.catch(()=>{});return task;} };
const moduleObject = { exports:{} };
vm.runInNewContext(fs.readFileSync(path.resolve(__dirname,"../star-purchases.js"),"utf8"),{
  module:moduleObject,exports:moduleObject.exports, process:{env}, console, Buffer, AbortSignal,
  require:n=>n==="./db" ? db : n==="./credits" ? require("../credits") : require(n)
});
const receipt={razorpay_order_id:"order_test",razorpay_payment_id:"pay_test", packId:"stars_260"};
receipt.razorpay_signature=crypto.createHmac("sha256",env.RAZORPAY_KEY_SECRET).update("order_test|pay_test").digest("hex");
let order={id:"order_test",status:"paid",currency:"INR",amount:4900,amount_paid:4900,notes:{type:"stars_purchase",userId:"owner",packId:"stars_10",stars:10}};
let payment={id:"pay_test",order_id:"order_test",status:"captured",currency:"INR",amount:4900};
const gateway=async url=>({ok:true,json:async()=>url.includes("/orders/") ? order : payment});
const verify = (user={id:"owner"}, r=receipt)=>moduleObject.exports.verifyAndDeliver(user,r,gateway);
(async()=>{
  assert.equal((await verify(null)).status,401);
  assert.equal((await verify({id:"owner"},{...receipt,razorpay_signature:"bad"})).status,400);
  assert.equal((await verify({id:"other"})).status,409,"recipient mismatch");
  payment.status="authorized";assert.equal((await verify()).status,409,"authorized but not captured");payment.status="captured";
  payment.order_id="order_other";assert.equal((await verify()).status,409);payment.order_id="order_test";
  order.amount=1;assert.equal((await verify()).status,409);order.amount=4900;
  const results=await Promise.all(Array.from({length:5},()=>verify()));
  assert.equal(ledger.reduce((n,l)=>n+l.amount,0),10,"browser pack tampering ignored; duplicate callbacks grant once");
  assert.equal(results.filter(r=>!r.alreadyProcessed).length,1);
  ledger=[];order.amount=99900;order.amount_paid=99900;order.notes.packId="stars_260";order.notes.stars=260;payment.amount=99900;
  fail=true;await assert.rejects(verify(),/write failure/);assert.equal(ledger.length,0,"partial grant rolls back");
  fail=false;await verify();assert.equal(ledger.length,3);assert.equal(ledger.reduce((n,l)=>n+l.amount,0),260);
  assert.equal(ledger.map(l=>JSON.parse(l.note).amountPaise).reduce((n,a)=>n+a,0),99900,"capture amount recorded once");
  console.log("PASS: server pack/owner/amount/capture verification, browser tampering, callback replay, atomic chunk delivery and rollback (isolated; no gateway charge).");
})().catch(e=>{console.error(e);process.exitCode=1;});
