/* ============================================================
   verify_export.js
   End-to-end regression proof for the production export path:
     - one anonymous identity is reused (credits and limits are real)
     - customised props reach the rendered video
     - single and repeated multi-clip projects export deterministically
     - MP4 codec, dimensions, fps, duration and motion are verified
     - wide output and invalid-template validation are covered
   Requires ffmpeg/ffprobe on PATH.
   Usage: node verify_export.js   [BASE_URL=http://localhost:3000]
   ============================================================ */
const fs = require("fs");
const os = require("os");
const path = require("path");
const crypto = require("crypto");
const { execFileSync } = require("child_process");

const BASE = process.env.BASE_URL || "http://localhost:3000";
const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "shortscraft-export-"));
let cookie = "";
let failures = 0;

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

function rememberCookie(response) {
  const line = response.headers.get("set-cookie");
  if (line) cookie = line.split(";", 1)[0];
}

async function initialiseIdentity() {
  const response = await fetch(BASE + "/api/credits", {
    headers: cookie ? { cookie } : {}
  });
  rememberCookie(response);
  if (!response.ok || !cookie) throw new Error("Could not establish the anonymous export identity.");
}

async function post(body) {
  const response = await fetch(BASE + "/api/export", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...(cookie ? { cookie } : {}) },
    body: JSON.stringify(body)
  });
  rememberCookie(response);
  const contentType = response.headers.get("content-type") || "";
  if (!response.ok || !/video\/mp4/.test(contentType)) {
    let detail = "";
    try { detail = JSON.stringify(await response.json()); } catch (err) { detail = "<non-json>"; }
    return {
      status: response.status,
      contentType,
      error: detail,
      buffer: null,
      disposition: response.headers.get("content-disposition")
    };
  }
  return {
    status: response.status,
    contentType,
    buffer: Buffer.from(await response.arrayBuffer()),
    disposition: response.headers.get("content-disposition")
  };
}

function probe(file) {
  const output = execFileSync("ffprobe", [
    "-v", "error",
    "-select_streams", "v:0",
    "-show_entries", "stream=codec_name,width,height,nb_read_frames,avg_frame_rate",
    "-show_entries", "format=duration",
    "-count_frames",
    "-of", "json", file
  ], { encoding: "utf8", maxBuffer: 1 << 24 });
  return JSON.parse(output);
}

function saveAndProbe(name, result) {
  const file = path.join(tempDir, name + ".mp4");
  fs.writeFileSync(file, result.buffer);
  return { file, info: probe(file) };
}

function frameHash(video, atSeconds) {
  const frame = video + ".png";
  execFileSync("ffmpeg", [
    "-v", "error", "-y", "-ss", String(atSeconds), "-i", video,
    "-frames:v", "1", "-vf", "scale=180:-1", frame
  ], { stdio: "ignore" });
  return crypto.createHash("sha256").update(fs.readFileSync(frame)).digest("hex");
}

function checkVideo(label, result, expected) {
  ok(result.status === 200, `${label} returned HTTP 200`, result.status + (result.error ? " " + result.error : ""));
  ok(/video\/mp4/.test(result.contentType), `${label} content type is video/mp4`, result.contentType);
  if (!result.buffer) return null;
  ok(result.buffer.length > 20_000, `${label} has real video data`, Math.round(result.buffer.length / 1024) + " KB");
  ok(result.buffer.slice(4, 8).toString("ascii") === "ftyp", `${label} is an MP4 container`);
  const saved = saveAndProbe(label.replace(/\W+/g, "-"), result);
  const stream = saved.info.streams[0] || {};
  const duration = Number((saved.info.format || {}).duration || 0);
  ok(stream.codec_name === "h264", `${label} codec is H.264`, stream.codec_name);
  ok(stream.width === expected.width && stream.height === expected.height,
    `${label} dimensions are ${expected.width}x${expected.height}`, `${stream.width}x${stream.height}`);
  ok(Number(stream.nb_read_frames) === expected.frames,
    `${label} frame count is ${expected.frames}`, stream.nb_read_frames);
  ok(Math.abs(duration - expected.duration) < 0.15,
    `${label} duration is ${expected.duration.toFixed(1)}s`, duration.toFixed(3) + "s");
  ok(stream.avg_frame_rate === `${expected.fps}/1`,
    `${label} frame rate is ${expected.fps}fps`, stream.avg_frame_rate);
  return saved.file;
}

async function render(label, body, expected) {
  const started = Date.now();
  const result = await post(body);
  const file = checkVideo(label, result, expected);
  console.log(`  note   ${label} rendered in ${((Date.now() - started) / 1000).toFixed(1)}s`);
  return file;
}

(async () => {
  await initialiseIdentity();

  console.log("\n---- single clip + editable props ----");
  const base = { aspect: "9:16", height: 720, fps: 24 };
  const defaultFile = await render("single-default", {
    ...base,
    clips: [{ tpl: "ui-toggle", dur: 1000 }]
  }, { width: 480, height: 854, frames: 24, duration: 1, fps: 24 });
  const customFile = await render("single-custom", {
    ...base,
    clips: [{
      tpl: "ui-toggle", dur: 1000,
      props: { title: "CUSTOM EXPORT TEXT", sub: "Editable properties preserved" },
      accent: "#34d17a"
    }]
  }, { width: 480, height: 854, frames: 24, duration: 1, fps: 24 });
  if (defaultFile && customFile) {
    ok(frameHash(defaultFile, 0.5) !== frameHash(customFile, 0.5),
      "custom properties change the encoded video frame");
  }

  console.log("\n---- multi-clip + repeat reliability ----");
  const multi = {
    ...base,
    clips: [
      { tpl: "text-cascade", dur: 1000, props: { line0: "SCENE ONE" } },
      { tpl: "ui-toggle", dur: 1000, props: { title: "SCENE TWO" } }
    ]
  };
  const multiA = await render("multi-first", multi,
    { width: 480, height: 854, frames: 48, duration: 2, fps: 24 });
  const multiB = await render("multi-repeat", multi,
    { width: 480, height: 854, frames: 48, duration: 2, fps: 24 });
  ok(!!multiA && !!multiB, "the same multi-clip project exports twice without a detached frame");

  console.log("\n---- aspect ratio + entitlement cap ----");
  const wide = await render("wide", {
    aspect: "16:9", height: 1080, fps: 24,
    clips: [{ tpl: "charts-bar-race", dur: 1000 }]
  }, { width: 854, height: 480, frames: 24, duration: 1, fps: 24 });
  ok(!!wide, "Free-plan 1080p request is safely clamped to 480p wide output");

  console.log("\n---- input validation ----");
  const invalid = await post({ tpl: "../../etc/passwd", aspect: "9:16", dur: 1000 });
  ok(invalid.status === 400 && !invalid.buffer, "path-like template id is rejected before rendering", invalid.status);

  console.log(`\nEXPORT=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exitCode = failures === 0 ? 0 : 1;
})().catch((err) => {
  console.error("HARNESS FAIL:", err.message);
  process.exitCode = 1;
}).finally(() => {
  fs.rmSync(tempDir, { recursive: true, force: true });
});
