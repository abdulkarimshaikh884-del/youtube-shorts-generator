"use strict";
// Execute the real server handler/helpers, Chromium and ffmpeg without importing
// server.js (which connects to the configured DB). Storage/billing are fixtures.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const http = require("node:http");
const vm = require("node:vm");
const crypto = require("node:crypto");
const {execFileSync} = require("node:child_process");
const root = path.resolve(__dirname, "..");
const out = path.join(root, "audit_results", "export-isolated");
const checks = [];
let server, runtime;
function check(label, fn) { fn(); checks.push(label); console.log("PASS " + label); }
function response() {
  return {statusCode: 200, headers: {}, status(code) {this.statusCode = code; return this;},
    setHeader(name, value) {this.headers[name] = value;},
    json(body) {this.body = body; return this;}, end(buffer) {this.buffer = buffer; return this;}};
}
function request(body, plan = "free", left = 5) {
  return {body, user: {id: "isolated-user"}, credits: {token: "isolated-token"},
    fixture: {plan, left, charges: 0, refunds: 0, events: 0, qualifications: 0}};
}
function probe(file) {
  return JSON.parse(execFileSync("ffprobe", ["-v", "error", "-select_streams", "v:0", "-count_frames",
    "-show_entries", "stream=codec_name,width,height,nb_read_frames,avg_frame_rate,pix_fmt", "-show_entries", "format=duration",
    "-of", "json", file], {encoding: "utf8", timeout: 30000, windowsHide: true}));
}
function frame(file, seconds, name) {
  const target = path.join(out, name + ".png");
  execFileSync("ffmpeg", ["-v", "error", "-y", "-ss", String(seconds), "-i", file, "-frames:v", "1", target],
    {timeout: 30000, windowsHide: true});
  return crypto.createHash("sha256").update(fs.readFileSync(target)).digest("hex");
}
async function render(name, req, expected) {
  const res = response();
  const start = Date.now();
  await runtime.handler(req, res);
  check(name + " returns an MP4", () => {
    assert.equal(res.statusCode, 200); assert.equal(res.headers["Content-Type"], "video/mp4");
    assert.ok(Buffer.isBuffer(res.buffer) && res.buffer.length > 1000);
    assert.equal(res.buffer.toString("ascii", 4, 8), "ftyp");
    assert.equal(res.headers["Content-Length"], String(res.buffer.length));
  });
  const file = path.join(out, name + ".mp4"); fs.writeFileSync(file, res.buffer);
  const info = probe(file), stream = info.streams[0];
  check(name + " codec, dimensions, frames, duration and fps", () => {
    assert.equal(stream.codec_name, "h264"); assert.equal(stream.pix_fmt, "yuv420p");
    assert.equal(stream.width, expected.w); assert.equal(stream.height, expected.h);
    assert.equal(Number(stream.nb_read_frames), expected.frames); assert.equal(stream.avg_frame_rate, "24/1");
    assert.ok(Math.abs(Number(info.format.duration) - expected.seconds) < .15);
  });
  check(name + " fixture billing and server qualification ordering", () => {
    assert.equal(req.fixture.charges, 1); assert.equal(req.fixture.refunds, 0);
    assert.equal(req.fixture.left, 4); assert.equal(req.fixture.events, 1); assert.equal(req.fixture.qualifications, 1);
    assert.equal(res.headers["X-Credits-Left"], "4"); assert.equal(res.headers["Cache-Control"], "no-store");
  });
  console.log(name + " rendered in " + ((Date.now() - start) / 1000).toFixed(1) + "s");
  return file;
}
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const publicRoot = path.join(root, "public");
  server = http.createServer((req, res) => {
    const relative = decodeURIComponent(new URL(req.url, "http://localhost").pathname).replace(/^\/+/, "");
    const target = path.resolve(publicRoot, relative);
    if (req.method !== "GET" || relative.startsWith("api/") || !target.startsWith(publicRoot + path.sep)) {
      res.writeHead(403); return res.end();
    }
    fs.readFile(target, (err, bytes) => {res.writeHead(err ? 404 : 200); res.end(err ? undefined : bytes);});
  });
  await new Promise((resolve, reject) => {server.once("error", reject); server.listen(0, "127.0.0.1", resolve);});
  const source = fs.readFileSync(path.join(root, "server.js"), "utf8");
  const helperStart = source.indexOf('const puppeteer = require("puppeteer");');
  const helperEnd = source.indexOf("// AI ANIMATION", helperStart);
  const routeStart = source.indexOf('app.post("/api/export"');
  const routeEnd = source.indexOf("const SEO_ROUTE_META", routeStart);
  assert.ok(helperStart >= 0 && helperEnd > helperStart && routeStart > helperEnd && routeEnd > routeStart);
  let active;
  const credits = {
    async entitlements(req) {const plan = require("../credits").PLANS[req.fixture.plan]; return {plan:req.fixture.plan, maxHeight:plan.maxHeight, watermark:plan.watermark};},
    async charge(req) {
      if (!req.fixture.left) return {ok:false, need:1, left:0};
      req.fixture.left--; req.fixture.charges++; req._creditChargeIds = {export: "isolated-charge"};
      return {ok:true};
    },
    async state(req) {return {left:req.fixture.left};},
    async refund(req) {req.fixture.left++; req.fixture.refunds++;}
  };
  runtime = vm.createContext({require, Buffer, process, setTimeout, clearTimeout, path, crypto, console,
    __dirname:root, PORT:server.address().port, credits, anim:require("../animate"),
    lottie:{getMeta:async () => null}, community:{get:async () => null},
    social:{recordEvent:async () => {active.fixture.events++;}},
    referrals:{successfulExport:async () => {active.fixture.qualifications++;}},
    rateLimit:() => () => {}, jsonExport:() => {},
    app:{post(route, ...handlers) {assert.equal(route, "/api/export"); runtime.handler = handlers.at(-1);}}
  });
  vm.runInContext(source.slice(helperStart, helperEnd) + source.slice(routeStart, routeEnd) +
    '\nglobalThis.closeBrowser = async () => {if (_browser) await _browser.close();};', runtime);
  const call = runtime.handler;
  runtime.handler = async (req, res) => {active = req; return call(req, res);};
  const base = {tpl:"text-cascade", dur:1000, aspect:"9:16", fps:24, height:1440, watermark:false};
  const portrait = await render("free-portrait", request({...base, lines:["FIRST THREE SECONDS", "MAKE IT COUNT", "ShortsCraft"]}),
    {w:480,h:854,frames:24,seconds:1});
  check("real frames change over time (not a still-image MP4)", () => {
    assert.notEqual(frame(portrait, .08, "portrait-early"), frame(portrait, .75, "portrait-late"));
  });
  const edited = await render("free-edited", request({...base, lines:["A DIFFERENT HOOK", "EDITABLE VIDEO", "Creator"]}),
    {w:480,h:854,frames:24,seconds:1});
  check("customized content reaches the encoded video", () => {
    assert.notEqual(frame(portrait, .75, "portrait-late"), frame(edited, .75, "edited-late"));
  });
  const wide = await render("pro-wide-multiclip", request({fps:24, height:1440, aspect:"16:9", clips:[
    {tpl:"text-cascade", dur:1000, lines:["FIRST CLIP", "CUSTOM ONE", "Creator"]},
    {tpl:"text-cascade", dur:1000, lines:["SECOND CLIP", "CUSTOM TWO", "Creator"]}
  ]}, "pro"), {w:1920,h:1080,frames:48,seconds:2});
  check("multiclip output changes at the second clip", () => {
    assert.notEqual(frame(wide, .75, "wide-first"), frame(wide, 1.75, "wide-second"));
  });
  for (const [name, body, status, left, charged, refunded] of [
    ["invalid id", {...base,tpl:"../../evil"}, 400, 5, 0, 0],
    ["hostile scene", {clips:[{spec:{html:"<script>alert(1)</script>"}}]}, 400, 5, 0, 0],
    ["invalid properties", {...base,props:[]}, 400, 5, 0, 0],
    ["missing uploaded animation", {...base,tpl:"lottie",props:{doc:"missing"}}, 400, 5, 0, 0],
    ["frame budget", {...base,dur:12000,fps:60}, 400, 5, 0, 0],
    ["insufficient credits", base, 402, 0, 0, 0],
    ["unknown template refund", {...base,tpl:"unknown-safe-id"}, 400, 5, 1, 1]
  ]) {
    const req = request(body, "free", name === "insufficient credits" ? 0 : 5), res = response();
    await runtime.handler(req, res);
    check(name, () => {assert.equal(res.statusCode,status); assert.equal(req.fixture.left,left);
      assert.equal(req.fixture.charges,charged); assert.equal(req.fixture.refunds,refunded);
      assert.equal(req.fixture.events,0); assert.equal(req.fixture.qualifications,0);});
  }
  fs.writeFileSync(path.join(out, "evidence.json"), JSON.stringify({testedAt:new Date().toISOString(), checks,
    mode:"Actual server handler/helpers, Chromium and ffmpeg; isolated mocked storage/billing; no DB, payment or AI provider calls",
    unverified:["actual account entitlements", "durable credit/referral ledger", "production container renderer", "all template families", "uploaded Lottie runtime"]}, null, 2));
  console.log(`${checks.length} isolated render checks passed; actual MP4 evidence: ${out}`);
})().catch(error => {console.error(error); process.exitCode = 1;}).finally(async () => {
  if(runtime?.closeBrowser) await runtime.closeBrowser();
  if(server) await new Promise(resolve => server.close(resolve));
});
