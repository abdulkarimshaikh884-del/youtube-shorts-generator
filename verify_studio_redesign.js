const puppeteer = require("puppeteer");
const { spawn } = require("child_process");
const path = require("path");

const BASE = "http://localhost:3000/generator";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const REQUIRED_IDS = [
  "sidebarToggle", "videoPasteTab", "videoGenerateTab", "videoScriptInput",
  "videoTopicInput", "videoGenerateScriptBtn", "videoStyleSelect", "videoAspectSelect",
  "generateVideoBtn", "resetVideoBtn", "videoEditPrompt", "applyVideoEditBtn",
  "resetVideoEditBtn", "videoPreviewFrame", "openVideoPreviewBtn", "copyVideoHtmlBtn",
  "downloadVideoBtn", "aiServiceStatus", "sceneTimeline", "sceneTimelineTrack",
];

async function ensureServer() {
  try { const response = await fetch(BASE); if (response.ok) return null; } catch {}
  const child = spawn(process.execPath, ["server.js"], { cwd: __dirname, stdio: ["ignore", "pipe", "pipe"], windowsHide: true });
  for (let attempt = 0; attempt < 30; attempt += 1) {
    await delay(300);
    try { const response = await fetch(BASE); if (response.ok) return child; } catch {}
  }
  child.kill();
  throw new Error("Studio server did not start on port 3000");
}

(async () => {
  const server = await ensureServer();
  const browser = await puppeteer.launch({ args: ["--no-sandbox"] });
  let failed = false;
  const viewports = [
    { name: "desktop", width: 1536, height: 864, mode: "desktop" },
    { name: "laptop", width: 1366, height: 768, mode: "desktop" },
    { name: "tablet", width: 1024, height: 768, mode: "tablet" },
    { name: "mobile", width: 390, height: 844, mode: "mobile", isMobile: true },
  ];

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage();
      await page.setViewport({ width: viewport.width, height: viewport.height, isMobile: Boolean(viewport.isMobile), deviceScaleFactor: 1 });
      await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
      await delay(300);

      const result = await page.evaluate(async (ids, mode) => {
        const q = (selector) => document.querySelector(selector);
        const rect = (selector) => {
          const element = q(selector); if (!element) return null;
          const box = element.getBoundingClientRect();
          return { x: Math.round(box.x), y: Math.round(box.y), width: Math.round(box.width), height: Math.round(box.height), bottom: Math.round(box.bottom), right: Math.round(box.right) };
        };
        const display = (selector) => q(selector) ? getComputedStyle(q(selector)).display : null;
        const position = (selector) => q(selector) ? getComputedStyle(q(selector)).position : null;
        const config = await fetch("/api/config").then((response) => response.json());
        const status = q("#aiServiceStatus");
        const aiAvailable = Boolean(config.services?.ai);
        const statusText = status?.textContent?.trim() || "";
        const script = rect(".editor-script-panel");
        const canvas = rect(mode === "mobile" ? ".editor-canvas-panel" : ".editor-canvas-column");
        const inspector = rect(".editor-inspector");
        const rail = rect(".editor-toolrail");
        const timeline = rect(".scene-timeline");
        const toolbar = rect(".studio-bar");
        return {
          missing: ids.filter((id) => document.querySelectorAll(`#${id}`).length !== 1),
          regions: {
            script: document.querySelectorAll(".editor-script-panel").length,
            canvas: document.querySelectorAll(".editor-canvas-panel").length,
            inspector: document.querySelectorAll(".editor-inspector").length,
            rail: document.querySelectorAll(".editor-toolrail").length,
            timeline: document.querySelectorAll("#sceneTimeline").length,
          },
          bodyOverflow: document.documentElement.scrollWidth > innerWidth + 2,
          pageScrollable: document.documentElement.scrollHeight > innerHeight + 2,
          toolbar, script, canvas, inspector, rail, timeline,
          railDisplay: display(".editor-toolrail"),
          previewPosition: position(".video-preview-card"),
          mobileHero: display(".mobile-hero-banner"),
          studioCssLoaded: [...document.styleSheets].some((sheet) => sheet.href && new URL(sheet.href).pathname === "/studio.css"),
          aiStatusConsistent: aiAvailable
            ? statusText === "AI ready" && status?.classList.contains("online")
            : statusText === "AI unavailable" && status?.classList.contains("offline"),
          desktopGeometry: mode !== "desktop" || Boolean(script && canvas && inspector && rail && timeline &&
            script.x === 0 && canvas.x >= script.right - 1 && inspector.x >= canvas.right - 1 && rail.x >= inspector.right - 1 &&
            canvas.width > script.width && canvas.width > inspector.width && timeline.y > toolbar.bottom && timeline.bottom <= innerHeight + 2),
          tabletGeometry: mode !== "tablet" || Boolean(script && canvas && inspector &&
            script.x < canvas.x && inspector.y >= Math.min(script.bottom, canvas.bottom) - 2),
          mobileGeometry: mode !== "mobile" || Boolean(script && canvas && inspector && timeline && rail &&
            script.y < canvas.y && canvas.y < inspector.y && inspector.y < timeline.y && timeline.y < rail.y),
        };
      }, REQUIRED_IDS, viewport.mode);

      const problems = [];
      if (result.missing.length) problems.push(`missing/duplicate IDs: ${result.missing.join(", ")}`);
      if (!Object.values(result.regions).every((count) => count === 1)) problems.push(`wrong region counts: ${JSON.stringify(result.regions)}`);
      if (!result.studioCssLoaded) problems.push("studio.css missing");
      if (result.bodyOverflow) problems.push("horizontal document overflow");
      if (result.mobileHero !== "none") problems.push("legacy mobile hero is visible");
      if (result.previewPosition === "sticky") problems.push("preview is still sticky");
      if (!result.aiStatusConsistent) problems.push("AI status contradicts config");
      if (!result.desktopGeometry) problems.push("desktop four-column/timeline geometry failed");
      if (!result.tabletGeometry) problems.push("tablet two-column/inspector geometry failed");
      if (!result.mobileGeometry) problems.push("mobile panel order failed");
      if (viewport.mode === "desktop" && result.pageScrollable) problems.push("desktop editor scrolls the document");
      if (viewport.mode !== "desktop" && !result.pageScrollable) problems.push(`${viewport.mode} document is not scrollable`);
      if (viewport.mode === "tablet" && result.railDisplay !== "none") problems.push("tablet tool rail should collapse");

      console.log(`\n[${viewport.name} ${viewport.width}x${viewport.height}]`);
      console.log(JSON.stringify(result, null, 2));
      console.log(problems.length ? `LAYOUT FAIL: ${problems.join("; ")}` : "LAYOUT PASS");
      failed ||= problems.length > 0;

      await page.screenshot({
        path: path.join(__dirname, "shots", `studio_heygen_${viewport.name}.jpg`),
        type: "jpeg", quality: 86, fullPage: viewport.mode !== "desktop",
      });
      await page.close();
    }
  } finally {
    await browser.close();
    if (server) server.kill();
  }

  console.log(failed ? "\nSTUDIO VISUAL VALIDATION FAILED" : "\nSTUDIO VISUAL VALIDATION PASSED");
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
