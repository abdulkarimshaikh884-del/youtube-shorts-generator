"use strict";
// Test-only guard, injected before dotenv/server imports. Never production code.
const assert = require("node:assert/strict");
const target = new URL(process.env.DATABASE_URL);
assert.equal(target.hostname,"127.0.0.1"); assert.equal(target.port,"55437"); assert.equal(target.pathname,"/shortscraft_qa");
const net = require("node:net");
const listen = net.Server.prototype.listen;
net.Server.prototype.listen = function(...args) {
  if(typeof args[0] === "number" || /^\d+$/.test(String(args[0]))) {
    if(typeof args[1] === "string") args[1] = "127.0.0.1";
    else args.splice(1,0,"127.0.0.1");
  }
  return listen.apply(this,args);
};
const originalFetch = globalThis.fetch;
globalThis.fetch = function(input,...rest) {
  const u = new URL(typeof input === "string" || input instanceof URL ? input : input.url);
  if(!["127.0.0.1","localhost"].includes(u.hostname)) throw Error("QA blocks external fetch: " + u.hostname);
  return originalFetch(input,...rest);
};
// Web Push uses https.request, not fetch. Never contact real providers with QA
// subscriptions. The notification suite injects its own explicit sender.
require("web-push").sendNotification = async () => {throw Error("QA blocks real Web Push delivery");};
if (process.argv.some(arg => /(?:^|[\\/])server\.js$/.test(arg))) {
  // Keep the HTTP server's worker from racing the child suite's stubbed flush.
  const notify=require("../../notify");
  notify.start=()=>{};
  notify.schedule=()=>{};
}
