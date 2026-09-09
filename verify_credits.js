/* ============================================================
   verify_credits.js
   Covers the credit ledger and the AI-animation pipeline.

   1) SANITISER (in-process, no server): the scene spec is untrusted input, so
      every escape route must be refused — script tags, event handlers,
      external url(), <img>, oversized css/body, junk images — while a valid
      scene passes.
   2) LEDGER over HTTP: a fresh visitor gets the daily grant, an export costs
      1 credit, the balance survives a page load, running out returns 402, and
      a rejected request never bills.
   3) CUSTOM SCENE EXPORT: an AI-authored scene renders to a real MP4 through
      the same pipeline as a template (ffprobe-checked), and a hostile scene is
      refused by the export route too — not just by /api/animate.
   4) /api/animate guardrails: too-short prompt, missing API key, bad image.

   The HTTP ledger section deliberately mutates a test visitor's credit row.
   It only runs with ALLOW_DB_MUTATION_TESTS=1; the default command stays
   offline and safe against a production-connected local environment.

   Usage: node verify_credits.js   [BASE_URL=http://localhost:3000]
   ============================================================ */
const { spawn } = require("child_process");
const fs = require("fs");
require("dotenv").config();

/* Read the grant from credits.js so a plan change does not make this stale. */
const FREE_PER_DAY = require("./credits").PLANS.free.perDay;
const COST = require("./credits").COST;
const os = require("os");
const path = require("path");

const anim = require("./animate");
const BASE = process.env.BASE_URL || "http://localhost:3000";
let failures = 0;

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

/* a scene that obeys every house rule — used as the "good" control */
const GOOD = {
  name: "Glass price card",
  accent: "#37e0c8",
  dark: true,
  css: ".sc-card{position:absolute;top:50%;left:50%;width:62cqw;height:34cqh;"
    + "transform:translate(-50%,-50%);border:1px solid var(--hair);border-radius:4cqw;"
    + "background:var(--surf);animation:scIn var(--D) var(--sp) infinite}"
    + ".sc-amt{position:absolute;inset:0;display:grid;place-items:center;"
    + "font-size:12cqw;font-weight:800;color:var(--ac);animation:scPop var(--D) var(--ov) infinite}"
    + "@keyframes scIn{0%{transform:translate(-50%,-50%) scale(.86);opacity:0}"
    + "22%,80%{transform:translate(-50%,-50%) scale(1);opacity:1}"
    + "100%{transform:translate(-50%,-50%) scale(.94);opacity:0}}"
    + "@keyframes scPop{0%,14%{opacity:0;transform:translateY(2cqh)}"
    + "30%,82%{opacity:1;transform:translateY(0)}100%{opacity:0}}",
  body: '<div class="sc-card"><div class="sc-amt">99</div></div>'
};

const GOOD_DEFINITION = {
  name: "Glass price card",
  theme: "emerald",
  layout: "metric-card",
  accent: "#37e0c8",
  content: {
    kicker: "PRICE DROP", title: "A better creator workflow",
    subtitle: "Turn one idea into a polished animated scene.",
    primary: "₹99", secondary: "Launch offer", footer: "Edit every word"
  },
  motion: { entrance: "spring-pop", stagger: true, intensity: "balanced" }
};

function ffprobe(file) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=width,height,r_frame_rate",
      "-show_entries", "format=duration", "-of", "json", file]);
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", reject);
    p.on("close", (c) => (c === 0 ? resolve(JSON.parse(out)) : reject(new Error(err))));
  });
}

/* a tiny cookie jar so the ledger sees one visitor across requests */
function jar() {
  let cookie = "";
  return {
    get header() { return cookie ? { Cookie: cookie } : {}; },
    absorb(res) {
      const set = res.headers.get("set-cookie");
      if (set) cookie = set.split(";")[0];
    },
    reset() { cookie = ""; }
  };
}

async function api(j, url, opts = {}) {
  const res = await fetch(BASE + url, {
    ...opts,
    headers: { "Content-Type": "application/json", ...j.header, ...(opts.headers || {}) }
  });
  j.absorb(res);
  return res;
}

(async () => {
  console.log("\n---- sanitiser: a valid scene passes ----");
  let clean = null;
  try {
    clean = anim.sanitise(GOOD);
    ok(true, "valid scene accepted", clean.name);
    ok(/@keyframes/.test(clean.css) && clean.body.includes("sc-card"), "css and body preserved");
  } catch (e) {
    ok(false, "valid scene accepted", e.message);
  }

  console.log("\n---- sanitiser: hostile scenes are refused ----");
  const ATTACKS = [
    ["script tag in body", { ...GOOD, body: GOOD.body + "<script>fetch('/steal')</script>" }],
    ["event handler", { ...GOOD, body: '<div class="sc-card" onclick="alert(1)"></div>' }],
    ["iframe", { ...GOOD, body: '<iframe src="https://evil.test"></iframe>' }],
    ["img with external src", { ...GOOD, body: '<img src="https://evil.test/p.gif">' }],
    ["external url() in css", { ...GOOD, css: GOOD.css + '.x{background:url("https://evil.test/t.png")}' }],
    ["@import", { ...GOOD, css: '@import url("https://evil.test/x.css");' + GOOD.css }],
    ["javascript: url", { ...GOOD, css: GOOD.css + '.x{background:url(javascript:alert(1))}' }],
    ["style tag", { ...GOOD, body: GOOD.body + "<style>body{display:none}</style>" }],
    ["angle brackets in css", { ...GOOD, css: GOOD.css + "</style><script>x</script>" }],
    ["forbidden attribute", { ...GOOD, body: '<div class="sc-card" srcdoc="x"></div>' }],
    ["form element", { ...GOOD, body: "<form><input></form>" }],
    ["oversized css", { ...GOOD, css: GOOD.css + ".pad{}".repeat(9000) }],
    ["oversized body", { ...GOOD, body: GOOD.body + "<div></div>".repeat(2000) }],
    ["empty css", { ...GOOD, css: "   " }],
    ["non-image data url", { ...GOOD, img: "data:text/html;base64,PHNjcmlwdD4x" }],
    ["image that is not base64", { ...GOOD, img: "https://evil.test/p.png" }]
  ];
  for (const [label, spec] of ATTACKS) {
    let refused = false, why = "";
    try { anim.sanitise(spec); } catch (e) { refused = e instanceof anim.BadScene; why = e.message; }
    ok(refused, "refuses " + label, why.slice(0, 64));
  }

  console.log("\n---- generateScene: the model path, with a stubbed model ----");
  /* No API key is needed to prove the wiring: prompt -> parse -> sanitise ->
     quality gate. The model is injected, so these run offline. */
  const stub = (reply) => async () => reply;

  try {
    const s = await anim.generateScene({
      prompt: "a glass card that flips to reveal a price", dur: 4600,
      callModel: stub("```json\n" + JSON.stringify(GOOD_DEFINITION) + "\n```")
    });
    ok(s.name === GOOD_DEFINITION.name, "accepts a good definition even inside a code fence", s.name);
    ok(s.definition && s.schema && /@keyframes/.test(s.css),
      "compiles the definition into editable, animated house code");
  } catch (e) {
    ok(false, "accepts a good definition even inside a code fence", e.message);
  }

  const MODEL_FAILURES = [
    ["prose instead of JSON", "Sure! Here is a lovely animation for you.", /did not return a scene definition/],
    ["broken JSON", '{"name":"x","css":"a{}"', /invalid JSON/],
    ["legacy model-authored code", JSON.stringify(GOOD), /code instead of an approved scene definition/],
    ["script-shaped model code", JSON.stringify({ ...GOOD_DEFINITION, body: "<script>x</script>" }), /code instead of an approved scene definition/]
  ];
  for (const [label, reply, expect] of MODEL_FAILURES) {
    let msg = "";
    try {
      await anim.generateScene({ prompt: "something", dur: 4600, callModel: stub(reply) });
    } catch (e) {
      msg = e.message;
    }
    ok(expect.test(msg), "rejects " + label, msg.slice(0, 60) || "(accepted!)");
  }

  const withImage = anim.scenePrompt({ prompt: "a product shot", dur: 4600, hasImage: true });
  const noImage = anim.scenePrompt({ prompt: "a product shot", dur: 4600, hasImage: false });
  ok(/ATTACHED IMAGE: yes/.test(withImage) && /product-focus/.test(withImage),
    "the planner knows when product media is attached");
  ok(/ATTACHED IMAGE: no/.test(noImage), "and knows when there is no image");
  ok(/Never output HTML, CSS, React, JavaScript, URLs or markdown/.test(withImage),
    "the prompt explicitly forbids model-authored code");

  if (process.env.ALLOW_DB_MUTATION_TESTS !== "1") {
    console.log("\nSKIP  HTTP ledger/export mutation tests (set ALLOW_DB_MUTATION_TESTS=1 to opt in)");
    console.log(`\nCREDITS=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
    process.exit(failures === 0 ? 0 : 1);
  }

  console.log("\n---- ledger: a fresh visitor ----");
  const j = jar();
  let r = await api(j, "/api/credits");
  let st = await r.json();
  ok(r.status === 200 && st.success, "GET /api/credits works", r.status);
  ok(st.left === st.perDay && st.perDay === FREE_PER_DAY, "starts with the daily grant",
    `${st.left}/${st.perDay}`);
  ok(st.cost.export === COST.export && st.cost.animate === COST.animate, "costs are published",
    JSON.stringify(st.cost));
  ok(st.plan === "free" && st.planLabel === "Free", "free plan by default", st.plan);

  console.log("\n---- ledger: exporting costs a credit ----");
  const exportBody = (extra = {}) => JSON.stringify({
    clips: [{ tpl: "text-cascade", lines: ["a", "b", "c"], dur: 1000 }],
    aspect: "9:16", fps: 30, height: 720, ...extra
  });
  r = await api(j, "/api/export", { method: "POST", body: exportBody() });
  const buf = Buffer.from(await r.arrayBuffer());
  ok(r.status === 200 && buf.length > 2000, "export returns an mp4", buf.length + " bytes");
  ok(r.headers.get("x-credits-left") === String(FREE_PER_DAY - 1), "the response reports the new balance",
    r.headers.get("x-credits-left"));
  st = await (await api(j, "/api/credits")).json();
  ok(st.left === FREE_PER_DAY - 1 && st.spentToday === 1, "balance persisted server-side",
    `${st.left} left, ${st.spentToday} spent`);

  console.log("\n---- ledger: a rejected request never bills ----");
  const before = st.left;
  r = await api(j, "/api/export", {
    method: "POST",
    body: JSON.stringify({ clips: [{ tpl: "../../etc/passwd", dur: 1000 }], aspect: "9:16" })
  });
  ok(r.status === 400, "path traversal in the template id is refused", r.status);
  st = await (await api(j, "/api/credits")).json();
  ok(st.left === before, "and no credit was taken", `${st.left} vs ${before}`);

  console.log("\n---- custom AI scene exports like a template ----");
  r = await api(j, "/api/export", {
    method: "POST",
    body: JSON.stringify({
      clips: [{ spec: anim.compileDefinition(GOOD_DEFINITION, null), dur: 1000 }],
      aspect: "9:16", fps: 30, height: 720
    })
  });
  ok(r.status === 200, "AI scene accepted by the export route", r.status);
  if (r.status === 200) {
    const mp4 = Buffer.from(await r.arrayBuffer());
    const file = path.join(os.tmpdir(), "sc_scene_" + Date.now() + ".mp4");
    fs.writeFileSync(file, mp4);
    const info = await ffprobe(file);
    const s = info.streams[0];
    ok(Math.abs(Number(info.format.duration) - 1.0) < 0.12, "1s scene renders 1s of video",
      info.format.duration);
    ok(s.width === 480 && s.height === 854, "Free plan 9:16 export is 480p", `${s.width}x${s.height}`);
    fs.unlinkSync(file);
  } else {
    await r.text();
  }

  console.log("\n---- the export route re-checks the scene itself ----");
  r = await api(j, "/api/export", {
    method: "POST",
    body: JSON.stringify({
      clips: [{ spec: { ...GOOD, body: GOOD.body + "<script>alert(1)</script>" }, dur: 1000 }],
      aspect: "9:16", fps: 30, height: 720
    })
  });
  const rejected = await r.json().catch(() => ({}));
  ok(r.status === 400 && /Scene rejected/.test(rejected.error || ""),
    "a hostile scene posted straight to /api/export is refused",
    `${r.status} ${(rejected.error || "").slice(0, 48)}`);

  console.log("\n---- /api/animate guardrails ----");
  r = await api(j, "/api/animate", { method: "POST", body: JSON.stringify({ prompt: "hi" }) });
  let jr = await r.json();
  ok(r.status === 400, "a too-short prompt is refused before any charge", r.status);

  const beforeAnim = (await (await api(j, "/api/credits")).json()).left;
  r = await api(j, "/api/animate", {
    method: "POST",
    body: JSON.stringify({ prompt: "a glass card that flips to reveal a price", image: "data:text/html;base64,AAA" })
  });
  jr = await r.json();
  ok(r.status === 400 && /image/i.test(jr.error || ""), "a bad image is refused", jr.error);
  let after = (await (await api(j, "/api/credits")).json()).left;
  ok(after === beforeAnim, "no credit spent on a refused request", `${after} vs ${beforeAnim}`);

  r = await api(j, "/api/animate", {
    method: "POST",
    body: JSON.stringify({ prompt: "a toggle switch flipping on with a soft glow" })
  });
  jr = await r.json();
  const configured = !!(process.env.GROQ_API_KEY || process.env.GEMINI_API_KEY || process.env.NVIDIA_API_KEY);
  if (!configured) {
    ok(r.status === 503 && /not configured/i.test(jr.error || ""),
      "without an API key it says so plainly instead of failing oddly", jr.error);
    after = (await (await api(j, "/api/credits")).json()).left;
    ok(after === beforeAnim, "and still charges nothing", `${after} vs ${beforeAnim}`);
  } else {
    ok(r.status === 200 && jr.scene, "a scene is generated", r.status);
    if (jr.scene) {
      ok(/@keyframes/.test(jr.scene.css), "the scene actually animates");
      ok(!/<script/i.test(jr.scene.body), "the scene has no script");
      ok(jr.credits.left === beforeAnim - COST.animate, COST.animate + " credits charged",
        `${jr.credits.left} vs ${beforeAnim - COST.animate}`);
    }
  }

  console.log("\n---- running out of credits ----");
  /* Draining credits through exports would trip the export rate limit (6 per
     2 minutes), which is a separate protection we do not want to weaken. The
     ledger table IS the source of truth, so the balance is set to zero there —
     which also proves the server reads Postgres per request rather than
     trusting a cache another process cannot see. */
  require("dotenv").config();
  const pgdb = require("./db");
  const token = decodeURIComponent((j.header.Cookie || "").split("=").slice(1).join("="));
  ok(!!token, "the visitor has a signed cookie id", token.slice(0, 8) + "…");
  const { rows: ledgerRows } = await pgdb.query(
    `select * from public.credits where key = $1`, [token]
  );
  ok(!!ledgerRows[0], "the ledger has a row for this visitor",
    ledgerRows[0] && ledgerRows[0].left_credits);
  await pgdb.query(`update public.credits set left_credits = 0 where key = $1`, [token]);

  st = await (await api(j, "/api/credits")).json();
  ok(st.left === 0, "the server reads the balance back from the ledger", st.left);

  r = await api(j, "/api/animate", {
    method: "POST", body: JSON.stringify({ prompt: "a bar chart racing upward with a green accent" })
  });
  jr = await r.json().catch(() => ({}));
  if (configured) {
    ok(r.status === 402 && new RegExp(COST.animate + " credits").test(jr.error || ""),
      "AI generation returns 402 and names its price", `${r.status} ${(jr.error || "").slice(0, 52)}`);
  } else {
    // with no key the route stops before billing, which is the correct order
    ok(r.status === 503, "with no API key it still refuses before billing", r.status);
  }

  // the export rate limit is per IP and was already exercised above, so this
  // check tolerates a 429 and retries the assertion on a fresh window only if
  // the limiter is not in the way
  r = await api(j, "/api/export", { method: "POST", body: exportBody() });
  if (r.status === 429) {
    await r.text().catch(() => {});
    console.log("  SKIP  export 402 (rate limit window still open — ledger check above covers it)");
  } else {
    jr = await r.json().catch(() => ({}));
    ok(r.status === 402 && /credit/i.test(jr.error || ""), "export returns 402 when out of credits",
      `${r.status} ${(jr.error || "").slice(0, 52)}`);
  }

  console.log("\n---- a different visitor has their own balance ----");
  const j2 = jar();
  st = await (await api(j2, "/api/credits")).json();
  ok(st.left === FREE_PER_DAY, "a new cookie gets a fresh grant", st.left);

  console.log(`\nCREDITS=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
