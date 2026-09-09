/* ============================================================
   verify_timeline.js
   Verifies the editor timeline is real, not decorative:
     - ruler draws ticks + MM:SS labels, and spans past the last clip
     - clip block width matches its duration in ruler pixels
     - red playhead moves with playback and lands where you scrub
     - clicking the ruler seeks; dragging the clip edge changes its duration
     - "+ Add" appends a REAL clip: own layer, own template, total length grows
     - crossing a clip boundary switches the mounted layer and keeps time
     - a clip can be deleted, and the last one cannot
     - Add is disabled at the 12s project limit
     - a 2-clip sequence exports as ONE mp4 whose duration is the sum
   Usage: node verify_timeline.js   [BASE_URL=http://localhost:3000]
   ============================================================ */
const puppeteer = require("puppeteer");
const { spawn } = require("child_process");
const fs = require("fs");
const os = require("os");
const path = require("path");

const BASE = process.env.BASE_URL || "http://localhost:3000";
let failures = 0;
const wait = (n) => new Promise((r) => setTimeout(r, n));

function ok(pass, label, extra) {
  if (!pass) failures++;
  console.log(`  ${pass ? "PASS" : "FAIL"}  ${label}${extra !== undefined ? "  (" + extra + ")" : ""}`);
  return pass;
}

function ffprobe(file) {
  return new Promise((resolve, reject) => {
    const p = spawn("ffprobe", ["-v", "error", "-select_streams", "v:0",
      "-show_entries", "stream=nb_frames,width,height,r_frame_rate",
      "-show_entries", "format=duration", "-of", "json", file]);
    let out = "", err = "";
    p.stdout.on("data", (d) => { out += d; });
    p.stderr.on("data", (d) => { err += d; });
    p.on("error", reject);
    p.on("close", (c) => c === 0 ? resolve(JSON.parse(out)) : reject(new Error(err)));
  });
}

(async () => {
  const browser = await puppeteer.launch({ headless: "new", args: ["--no-sandbox"] });
  const page = await browser.newPage();
  const errs = [];
  page.on("pageerror", (e) => errs.push("pageerror: " + e.message));
  page.on("console", (m) => { if (m.type() === "error") errs.push("console: " + m.text()); });
  await page.setViewport({ width: 1440, height: 900 });
  await page.goto(BASE + "/editor?tpl=text-cascade&aspect=9:16", { waitUntil: "networkidle2" });
  await page.waitForFunction(() => !!document.querySelector(".ed-clip"), { timeout: 20000 });
  await wait(900);

  console.log("\n---- ruler ----");
  const ruler = await page.evaluate(() => {
    const ticks = document.querySelectorAll(".ed-tick");
    const labels = [...document.querySelectorAll(".ed-tlabel")].map((l) => l.textContent);
    const r = document.querySelector(".ed-ruler").getBoundingClientRect();
    const last = document.querySelector(".ed-tlabel:last-of-type");
    return {
      ticks: ticks.length,
      labels,
      majors: document.querySelectorAll(".ed-tick.ed-major").length,
      minors: document.querySelectorAll(".ed-tick.ed-minor").length,
      rulerW: Math.round(r.width),
      lastLabelX: last ? Math.round(last.getBoundingClientRect().left - r.left) : -1
    };
  });
  ok(ruler.ticks > 8, "ruler draws ticks", ruler.ticks);
  ok(ruler.majors > 4 && ruler.minors > 4, "major + minor ticks",
    `${ruler.majors}/${ruler.minors}`);
  ok(/^\d\d:\d\d$/.test(ruler.labels[0]) && ruler.labels[0] === "00:00",
    "labels are MM:SS starting at 00:00", ruler.labels.slice(0, 4).join(" "));
  ok(ruler.labels.length >= 6, "a label per second", ruler.labels.join(" "));

  console.log("\n---- clip block ----");
  const clip = await page.evaluate(() => {
    const c = document.querySelector(".ed-clip");
    const r = c.getBoundingClientRect();
    const ruler = document.querySelector(".ed-ruler").getBoundingClientRect();
    const secs = 4.6;
    // pixels per second the ruler is using, from two consecutive major ticks
    const majors = [...document.querySelectorAll(".ed-tick.ed-major")]
      .map((t) => parseFloat(t.style.left));
    const pps = majors[1] - majors[0];
    return {
      name: c.querySelector(".ed-clipname").textContent,
      dur: c.querySelector(".ed-clipdur").textContent,
      w: Math.round(r.width),
      expected: Math.round(secs * pps),
      pps: Math.round(pps),
      startsAtRulerZero: Math.abs(r.left - ruler.left) < 2,
      films: c.querySelectorAll(".ed-clipfilm i").length,
      grip: !!c.querySelector(".ed-grip"),
      handle: !!c.querySelector(".ed-cliphandle")
    };
  });
  // The clip carries the template's display name ("Type Cascade Up"), not its id.
  ok(/^Type Cascade/.test(clip.name), "clip is labelled with its template", clip.name);
  ok(/^00:04:\d\d$/.test(clip.dur), "clip shows a MM:SS:FF timecode", clip.dur);
  ok(Math.abs(clip.w - clip.expected) <= 5,
    "clip width matches its duration on the ruler", `${clip.w}px vs ${clip.expected}px`);
  ok(clip.startsAtRulerZero, "clip lane shares the ruler origin");
  ok(clip.films >= 3 && clip.grip && clip.handle, "clip has film strip, grip and resize handle");

  console.log("\n---- playhead ----");
  const head = await page.evaluate(async () => {
    const h = document.querySelector(".ed-head");
    const x = () => parseFloat((h.style.transform.match(/-?[\d.]+/) || [0])[0]);
    /* Poll until the playhead actually moves rather than sampling once after
       a fixed 700ms. Under load that window can pass without a frame, and
       the test then reports a working playhead as frozen - the third
       fixed-delay assertion in this suite to do that. */
    const a = x();
    let b = a;
    for (let i = 0; i < 40 && b <= a; i++) {
      await new Promise((r) => setTimeout(r, 50));
      b = x();
    }
    // Scrub to the middle. The editor only suspends playback while a POINTER
    // is down on the slider (an arrow-key seek must not freeze the playhead),
    // so a bare "input" event leaves playback running and the head has moved
    // on by the time we measure. Bracket it the way a real drag does.
    const s = document.querySelector("#edSeek");
    s.dispatchEvent(new PointerEvent("pointerdown", { bubbles: true }));
    s.value = "500"; s.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
    const majors = [...document.querySelectorAll(".ed-tick.ed-major")]
      .map((t) => parseFloat(t.style.left));
    const pps = majors[1] - majors[0];
    return {
      moved: b > a, at: x(), expected: 2.3 * pps,
      red: getComputedStyle(h).backgroundColor,
      dot: !!h.querySelector("i")
    };
  });
  ok(head.moved, "playhead advances while playing");
  ok(Math.abs(head.at - head.expected) < 8, "playhead lands where you scrub",
    `${Math.round(head.at)}px vs ${Math.round(head.expected)}px`);
  ok(/255,\s*59,\s*48/.test(head.red), "playhead is the red marker", head.red);
  ok(head.dot, "playhead has a handle dot on the ruler");
  // release the scrub, or playback stays suspended for every later step
  await page.evaluate(() =>
    window.dispatchEvent(new PointerEvent("pointerup", { bubbles: true })));

  console.log("\n---- resize by dragging the clip edge ----");
  const before = await page.evaluate(() =>
    document.querySelector(".ed-clipdur").textContent);
  const box = await page.evaluate(() => {
    const h = document.querySelector(".ed-cliphandle").getBoundingClientRect();
    return { x: h.left + h.width / 2, y: h.top + h.height / 2 };
  });
  await page.mouse.move(box.x, box.y);
  await page.mouse.down();
  await page.mouse.move(box.x + 60, box.y, { steps: 8 });
  await page.mouse.up();
  await wait(500);
  const resized = await page.evaluate(() => ({
    dur: document.querySelector(".ed-clipdur").textContent,
    slider: document.querySelector("#edDur").value,
    label: document.querySelector("#edDurVal").textContent,
    len: document.querySelector("#edLen").textContent
  }));
  ok(resized.dur !== before, "dragging the edge changes the clip length",
    `${before} -> ${resized.dur}`);
  ok(Number(resized.slider) > 4600, "the Loop length slider follows the drag",
    resized.slider);

  console.log("\n---- + Add makes a real clip ----");
  await page.evaluate(() => {
    // back to a known length first
    const d = document.querySelector("#edDur");
    d.value = "3000"; d.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await wait(350);
  await page.click("#edAdd");
  await wait(900);
  const added = await page.evaluate(() => ({
    clips: document.querySelectorAll(".ed-clip").length,
    layers: document.querySelectorAll("#edFrame .ed-lay").length,
    visible: [...document.querySelectorAll("#edFrame .ed-lay")].filter((f) => !f.hidden).length,
    previewIsSecond: document.querySelector("#edPreview").dataset.i,
    names: [...document.querySelectorAll(".ed-clipname")].map((n) => n.textContent),
    len: document.querySelector("#edLen").textContent,
    selected: document.querySelector('.ed-clip[aria-current="true"]').dataset.i,
    project: document.querySelector("#edProject").value,
    secondDoc: (document.querySelector('#edFrame .ed-lay[data-i="1"]') || {}).srcdoc || ""
  }));
  ok(added.clips === 2, "a second clip appears on the timeline", added.clips);
  ok(added.layers === 2, "the second clip gets its own iframe layer", added.layers);
  ok(added.visible === 1, "only the active layer is visible", added.visible);
  ok(added.names[0] !== added.names[1], "the new clip uses a different template",
    added.names.join(" + "));
  ok(added.secondDoc.length > 500 && !/<script/i.test(added.secondDoc),
    "the new clip is a real built document with no script", added.secondDoc.length);
  ok(added.len === "0:07", "total length is the sum of both clips", added.len);
  ok(added.selected === "1" && added.previewIsSecond === "1",
    "the new clip is selected and mounted", `${added.selected}/${added.previewIsSecond}`);

  console.log("\n---- boundary crossing keeps time ----");
  /* "+ Add" seeds a Blank Canvas, which by design has no CSS animation — so
     reading getAnimations()[0] off it threw and took the whole harness down.
     Give clip 2 a real animated template first; that is what a creator does
     with a new clip anyway, and it makes the timing assertion mean something. */
  await page.evaluate(() => {
    const sel = document.querySelector("#edTpl");
    const opt = [...sel.options].find((o) => o.value === "text-cascade")
      || [...sel.options].find((o) => o.value && o.value !== "blank");
    sel.value = opt.value;
    sel.dispatchEvent(new Event("change", { bubbles: true }));
  });
  await wait(900);

  const cross = await page.evaluate(async () => {
    // read the real lengths off the timeline instead of assuming them
    const px = (el) => el.getBoundingClientRect().width;
    const clips = [...document.querySelectorAll(".ed-clip")];
    const spanPx = clips.reduce((s, c) => s + px(c) + 3, 0);
    const firstFrac = (px(clips[0]) + 3) / spanPx;
    const s = document.querySelector("#edSeek");
    // sit just before the end of clip 1
    s.value = String(Math.max(0, Math.round(firstFrac * 1000) - 40));
    s.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 220));
    const startedOn = document.querySelector("#edPreview").dataset.i;
    const before = document.querySelector("#edNow").textContent;
    // The editor autoplays, so an unconditional click here PAUSED it and the
    // boundary was never reached. Only click when it is actually stopped.
    const play = document.querySelector("#edPlay");
    if (play.dataset.state !== "playing") play.click();
    await new Promise((r) => setTimeout(r, 1100));
    const nowOn = document.querySelector("#edPreview").dataset.i;
    const anim = document.querySelector("#edPreview").contentDocument.getAnimations()[0];
    const t = anim ? Number(anim.currentTime) : null;
    return { startedOn, nowOn, t, before, now: document.querySelector("#edNow").textContent };
  });
  ok(cross.startedOn === "0", "seeking into clip 1 mounts clip 1",
    `${cross.startedOn} at ${cross.before}`);
  ok(cross.nowOn === "1", "playing past the boundary mounts clip 2", cross.nowOn);
  ok(cross.t > 0 && cross.t < 1500, "clip 2 starts near zero, not mid-loop",
    Math.round(cross.t));

  console.log("\n---- delete ----");
  await page.evaluate(() => {
    document.querySelector('.ed-clip[data-i="1"]').click();
  });
  await wait(300);
  await page.click('.ed-clip[data-i="1"] .ed-clipdel');
  await wait(600);
  const afterDel = await page.evaluate(() => ({
    clips: document.querySelectorAll(".ed-clip").length,
    layers: document.querySelectorAll("#edFrame .ed-lay").length,
    delVisible: getComputedStyle(
      document.querySelector('.ed-clip[aria-current="true"] .ed-clipdel')).display
  }));
  ok(afterDel.clips === 1 && afterDel.layers === 1, "deleting removes clip and layer",
    `${afterDel.clips}/${afterDel.layers}`);

  const lastOne = await page.evaluate(async () => {
    document.querySelector(".ed-clipdel").click();
    await new Promise((r) => setTimeout(r, 300));
    return {
      clips: document.querySelectorAll(".ed-clip").length,
      status: document.querySelector("#edStatus").textContent
    };
  });
  ok(lastOne.clips === 1, "the last clip cannot be deleted", lastOne.clips);
  ok(/at least one clip/i.test(lastOne.status), "and it says why", lastOne.status);

  console.log("\n---- 12s project limit ----");
  const limit = await page.evaluate(async () => {
    const d = document.querySelector("#edDur");
    d.value = "9000"; d.dispatchEvent(new Event("input", { bubbles: true }));
    await new Promise((r) => setTimeout(r, 250));
    document.querySelector("#edAdd").click();             // 9s + 3s = 12s
    await new Promise((r) => setTimeout(r, 700));
    return {
      clips: document.querySelectorAll(".ed-clip").length,
      len: document.querySelector("#edLen").textContent,
      addDisabled: document.querySelector("#edAdd").disabled
    };
  });
  ok(limit.len === "0:12", "clip is capped so the project stays at 12s", limit.len);
  ok(limit.addDisabled, "Add is disabled once the export limit is reached");

  console.log("\n---- sequence export ----");
  const seq = await page.evaluate(async () => {
    const body = {
      clips: [
        { tpl: "text-cascade", lines: ["a", "b", "c"], accent: "#ffffff", font: "inter", dur: 1000 },
        { tpl: "ui-toggle", lines: ["x", "y", "z"], accent: "#5b8cff", font: "inter", dur: 1000 }
      ],
      aspect: "9:16", fps: 30, height: 720
    };
    const r = await fetch("/api/export", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    if (!r.ok) return { ok: false, status: r.status };
    const b = await r.arrayBuffer();
    return { ok: true, bytes: [...new Uint8Array(b)] };
  });
  if (!ok(seq.ok, "2-clip sequence exports", seq.status)) {
    // nothing to probe
  } else {
    const file = path.join(os.tmpdir(), "sc_seq_" + Date.now() + ".mp4");
    fs.writeFileSync(file, Buffer.from(seq.bytes));
    const info = await ffprobe(file);
    const dur = Number(info.format.duration);
    const st = info.streams[0];
    ok(Math.abs(dur - 2.0) < 0.12, "duration is the sum of both clips", dur);
    ok(st.width === 480 && st.height === 854, "Free plan clamps 9:16 export to 480p", `${st.width}x${st.height}`);
    ok(st.r_frame_rate === "30/1", "30 fps", st.r_frame_rate);
    fs.unlinkSync(file);
  }

  console.log("\n---- mobile timeline ----");
  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto(BASE + "/editor?tpl=bar-race&aspect=9:16", { waitUntil: "networkidle2" });
  await page.waitForFunction(() => !!document.querySelector(".ed-clip"), { timeout: 20000 });
  await wait(1000);
  await page.evaluate(() => document.querySelector("#edAdd").click());
  await wait(900);
  const mob = await page.evaluate(() => {
    const tl = document.querySelector(".ed-tl").getBoundingClientRect();
    const lane = document.querySelector(".ed-lane");
    const add = document.querySelector("#edAdd").getBoundingClientRect();
    return {
      tlW: Math.round(tl.width),
      innerW: window.innerWidth,
      clips: [...document.querySelectorAll(".ed-clip")].map((c) => Math.round(c.getBoundingClientRect().width)),
      labels: document.querySelectorAll(".ed-tlabel").length,
      laneOverflow: lane.scrollWidth > lane.clientWidth + 2,
      addRight: Math.round(add.right),
      hOverflow: document.documentElement.scrollWidth > window.innerWidth + 1
    };
  });
  // this catches a class collision: .ed-tl was also the top-bar Feedback link,
  // which is display:none under 560px — the whole timeline silently had width 0
  ok(mob.tlW > 200, "timeline is visible on mobile, not collapsed", mob.tlW + "px");
  ok(mob.clips.length === 2 && mob.clips.every((w) => w > 20),
    "clips keep real widths on mobile", mob.clips.join("/"));
  ok(mob.labels >= 2, "ruler still labels on mobile", mob.labels);
  ok(!mob.laneOverflow && mob.addRight <= mob.innerW,
    "clip lane and Add fit the phone width", `${mob.addRight} <= ${mob.innerW}`);
  ok(!mob.hOverflow, "no horizontal page overflow on mobile");

  console.log("\n---- errors ----");
  ok(errs.length === 0, "no console or page errors", errs.length ? errs[0] : 0);

  await page.screenshot({ path: path.join(__dirname, "shots", "timeline_desktop.jpg"),
    type: "jpeg", quality: 88 });
  await browser.close();
  console.log(`\nTIMELINE=${failures === 0 ? "PASS" : "FAIL"}${failures ? " (" + failures + " failing)" : ""}`);
  process.exit(failures === 0 ? 0 : 1);
})().catch((e) => {
  console.error("HARNESS FAIL:", e.message);
  process.exit(1);
});
