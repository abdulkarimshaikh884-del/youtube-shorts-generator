"use strict";
// Actual production handlers with isolated billing/provider dependencies only.
// Do not start server.js, read .env, connect a database or invoke any renderer.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const source = fs.readFileSync(path.resolve(__dirname, "../server.js"), "utf8");
const routes = new Map();
let bill;
let expensiveCalls = 0;
const expensive = async () => { expensiveCalls++; throw Error("Rejected billing executed expensive work"); };
const middleware = () => {};
const context = {
  app: {post(route, ...handlers) { routes.set(route, handlers.at(-1)); }},
  rateLimit: () => middleware,
  jsonDesignUpload: middleware, jsonImage: middleware, jsonExport: middleware,
  Buffer, console, process: {env: {GROQ_API_KEY: "isolated-placeholder-not-a-real-key"}},
  AI_MAX_DUR_MS: 4600,
  credits: {
    state: async () => ({plan: "free", left: 4}),
    entitlements: async () => ({maxHeight: 480, watermark: true}),
    charge: async () => bill,
    refund: expensive,
    PLANS: {free: {label: "Free"}, pro: {label: "Pro"}, promax: {label: "Pro Max"}}
  },
  designConverter: {validateImage: async () => ({success: true}), convertToEditable: expensive},
  designAssets: {persistJob: expensive},
  validateAttachment: expensive,
  anim: {generateScene: expensive}, callAI: expensive,
  EXPORT_LIMITS: {maxClips: 10, aspects: {"9:16": [9, 16]}, fps: [24, 30], heights: [480, 720, 1080], maxDurMs: 30000, maxFrames: 900},
  normaliseTemplateProps: () => ({}), even: number => number,
  serialise: expensive, getBrowser: expensive
};
for (const route of ["/api/designs/convert", "/api/animate", "/api/export"]) {
  const begin = source.indexOf(`app.post("${route}",`);
  assert(begin >= 0, "Handler exists: " + route);
  const end = source.indexOf("\n});", begin);
  assert(end > begin, "Handler has its expected top-level terminator: " + route);
  vm.runInNewContext(source.slice(begin, end + 4), context);
}
const bodies = {
  "/api/designs/convert": {image: "data:image/png;base64,UUE="},
  "/api/animate": {prompt: "A safe isolated animation prompt"},
  "/api/export": {tpl: "text-cascade", dur: 1000, fps: 24, height: 480, aspect: "9:16"}
};
(async () => {
  let cases = 0;
  for (const route of routes.keys()) {
    for (const code of ["CREDIT_OPERATION_REPLAY", "CREDIT_IDEMPOTENCY_CONFLICT", "CREDIT_OPERATION_REFUNDED", "CREDIT_INVALID_OPERATION", null]) {
      bill = {ok: false, status: code === "CREDIT_INVALID_OPERATION" ? 400 : code ? 409 : undefined, code, error: code ? "Isolated rejection" : undefined, need: 2, left: 4, charged: 0};
      const res = {statusCode: 200, status(n) { this.statusCode = n; return this; }, json(value) {this.body = value; return this;}};
      await routes.get(route)({user: {id: "isolated-user", plan: "free"}, body: bodies[route], path: route}, res);
      assert.equal(res.statusCode, code === "CREDIT_INVALID_OPERATION" ? 400 : code ? 409 : 402, route + " " + code);
      assert.equal(res.body.code, code);
      assert.equal(res.body.success, false);
      if (code) assert.equal(res.body.error, "Isolated rejection");
      else assert.match(res.body.error, /credit/);
      cases++;
    }
  }
  assert.equal(expensiveCalls, 0, "Rejected retries perform no AI/conversion/render/refund work");
  console.log(`PASS ${cases} actual charge-route rejection cases: structured 409/400 errors, existing 402, zero model/conversion/render/refund calls (isolated).`);
})().catch(error => {console.error(error); process.exitCode = 1;});
