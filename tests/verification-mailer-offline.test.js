"use strict";
// Isolated provider fixtures only: no environment secrets, DB or network.
const assert = require("node:assert/strict");
const fs = require("node:fs"), vm = require("node:vm"), path = require("node:path");
const source = fs.readFileSync(path.join(__dirname,"../mailer.js"),"utf8");
const calls=[], delays=[];
let responses=[];
const context={require:name=>{assert.equal(name,"crypto");return require("node:crypto");},module:{exports:{}},
  process:{env:{RESEND_API_KEY:"fixture-not-secret",AUTH_FROM_EMAIL:"ShortsCraft <test@example.test>",PUBLIC_SITE_URL:"https://qa.example.test",NODE_ENV:"test"}},
  URL,AbortSignal,setTimeout:(fn,ms)=>{delays.push(ms);fn();},
  fetch:async (url,options)=>{assert.equal(url,"https://api.resend.com/emails");calls.push(options);const value=responses.shift();if(value instanceof Error)throw value;return value;}};
vm.runInNewContext(source,context);
const send=context.module.exports.sendEmailVerification;
const payload={to:"preview@example.test",verificationUrl:"https://qa.example.test/account?verify="+"a".repeat(43),tokenHash:"b".repeat(64)};
const response=(status,data={id:"fixture-message"})=>({ok:status===200,status,json:async()=>data});
(async()=>{
  responses=[response(503),new Error("network timeout"),response(200)];
  assert.equal((await send(payload)).id,"fixture-message");assert.equal(calls.length,3);
  assert.equal(new Set(calls.map(x=>x.body)).size,1);assert.equal(new Set(calls.map(x=>x.headers["Idempotency-Key"])).size,1);
  assert.deepEqual(delays,[500,1000]);
  calls.length=0;responses=[response(422)];await assert.rejects(send(payload));assert.equal(calls.length,1);
  calls.length=0;responses=[response(429),response(200)];await send(payload);assert.equal(calls.length,2);
  calls.length=0;responses=[response(200,{}),response(200,{}),response(200,{})];await assert.rejects(send(payload),/missing ID/);assert.equal(calls.length,3);
  console.log("PASS verification mailer: bounded transient retries, stable provider idempotency/payload, permanent rejection, rate limit retry and provider ID validation. Mock transport only.");
})().catch(error=>{console.error(error);process.exitCode=1;});
