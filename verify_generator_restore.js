const puppeteer = require("puppeteer");
const { spawn } = require("child_process");
const path = require("path");

const BASE = "http://localhost:3000/generator";
const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const SCRIPT = "AI se paise kamane ke teen simple tareeke. Pehla skill seekho. Doosra portfolio banao. Teesra clients ko pitch karo. Aaj se action lena shuru karo.";

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
  const page = await browser.newPage();
  await page.setViewport({ width: 1536, height: 864, deviceScaleFactor: 1 });
  const pageErrors = [];
  page.on("pageerror", (error) => pageErrors.push(error.message));
  let failed = false;

  try {
    await page.goto(BASE, { waitUntil: "networkidle2", timeout: 60000 });
    await page.evaluate(() => {
      localStorage.setItem("sc:credits:v2", "10");
      localStorage.setItem("sc:credits:day", new Date().toISOString().slice(0, 10));
    });
    await page.reload({ waitUntil: "networkidle2", timeout: 60000 });

    await page.type("#videoScriptInput", SCRIPT);
    await delay(100);
    const draft = await page.evaluate(() => ({
      words: document.getElementById("scriptWordCount")?.textContent,
      cards: document.querySelectorAll("#sceneTimelineTrack .scene-card").length,
      count: document.getElementById("sceneTimelineCount")?.textContent,
      credits: Number(document.getElementById("creditsCount")?.textContent),
    }));

    await page.click("#generateVideoBtn");
    await delay(750);
    const generated = await page.evaluate(() => ({
      status: document.getElementById("videoPreviewStatus")?.textContent?.trim(),
      emptyHidden: document.getElementById("videoEmptyState")?.classList.contains("hidden"),
      htmlLength: document.getElementById("videoPreviewFrame")?.srcdoc?.length || 0,
      timelineCards: document.querySelectorAll("#sceneTimelineTrack .scene-card").length,
      timelineCount: document.getElementById("sceneTimelineCount")?.textContent,
      credits: Number(document.getElementById("creditsCount")?.textContent),
    }));

    const ratios = { "9:16": 9/16, "16:9": 16/9, "1:1": 1, "4:5": 4/5, "3:4": 3/4, "2:3": 2/3, "21:9": 21/9 };
    const ratioResults = {};
    for (const [value, expected] of Object.entries(ratios)) {
      await page.select("#videoAspectSelect", value);
      await delay(120);
      ratioResults[value] = await page.$eval("#videoFrameWrap", (element, target) => {
        const box = element.getBoundingClientRect();
        return { actual: box.width / box.height, target, pass: Math.abs((box.width / box.height) - target) <= Math.max(.025, target * .025), label: document.getElementById("canvasAspectLabel")?.textContent };
      }, expected);
    }
    const creditsAfterRatios = await page.$eval("#creditsCount", (element) => Number(element.textContent));

    const editCreditsBefore = creditsAfterRatios;
    const quickEditReachable = await page.evaluate(() => {
      const element = document.querySelector('.quick-edit-chips button[data-edit="bigger text"]');
      element.scrollIntoView({ block: "center" });
      const box = element.getBoundingClientRect();
      const hit = document.elementFromPoint(box.left + box.width / 2, box.top + box.height / 2);
      return hit === element || element.contains(hit);
    });
    await page.$eval('.quick-edit-chips button[data-edit="bigger text"]', (element) => element.click());
    await delay(220);
    const editState = await page.evaluate(() => ({
      prompt: document.getElementById("videoEditPrompt")?.value,
      credits: Number(document.getElementById("creditsCount")?.textContent),
      htmlLength: document.getElementById("videoPreviewFrame")?.srcdoc?.length || 0,
    }));

    await page.click("#videoGenerateTab");
    const generateTab = await page.evaluate(() => ({
      tabActive: document.getElementById("videoGenerateTab")?.classList.contains("active"),
      panelActive: document.getElementById("videoGeneratePanel")?.classList.contains("active"),
      aria: document.getElementById("videoGenerateTab")?.getAttribute("aria-selected"),
    }));
    await page.click("#videoPasteTab");

    await page.click("#sidebarToggle");
    await delay(150);
    const sidebarOpen = await page.$eval("#sidebar", (element) => element.classList.contains("open"));
    await page.$eval("#sidebarClose", (element) => element.click());
    await delay(120);

    await page.click("#downloadVideoBtn");
    await delay(100);
    const upgradeOpened = await page.$eval("#upgradeModal", (element) => !element.classList.contains("hidden"));
    await page.$eval("#upgradeModalClose", (element) => element.click());
    await delay(100);

    await page.click("#resetVideoBtn");
    await delay(100);
    const reset = await page.evaluate(() => ({
      script: document.getElementById("videoScriptInput")?.value,
      topic: document.getElementById("videoTopicInput")?.value,
      prompt: document.getElementById("videoEditPrompt")?.value,
      status: document.getElementById("videoPreviewStatus")?.textContent?.trim(),
      htmlLength: document.getElementById("videoPreviewFrame")?.srcdoc?.length || 0,
      emptyVisible: !document.getElementById("videoEmptyState")?.classList.contains("hidden"),
      timelineCards: document.querySelectorAll("#sceneTimelineTrack .scene-card").length,
      timelineEmpty: document.querySelector("#sceneTimelineTrack .scene-card")?.classList.contains("empty"),
    }));

    await page.type("#videoScriptInput", "Ek final short script. Do simple scenes. Abhi start karo.");
    const creditsBeforeTopGenerate = await page.$eval("#creditsCount", (element) => Number(element.textContent));
    await page.click("#topGenerateBtn");
    await delay(600);
    const topGenerate = await page.evaluate(() => ({
      status: document.getElementById("videoPreviewStatus")?.textContent?.trim(),
      credits: Number(document.getElementById("creditsCount")?.textContent),
      htmlLength: document.getElementById("videoPreviewFrame")?.srcdoc?.length || 0,
    }));

    const assertions = {
      draftTimelineBuilt: draft.cards > 1 && /words$/.test(draft.words || ""),
      generatedPreview: generated.status === "Preview ready" && generated.emptyHidden && generated.htmlLength > 500,
      generatedTimeline: generated.timelineCards > 1 && generated.timelineCount === `${generated.timelineCards} scenes`,
      oneCreditCharged: generated.credits === draft.credits - 1,
      ratiosPass: Object.values(ratioResults).every((item) => item.pass && item.label),
      ratioChangesFree: creditsAfterRatios === generated.credits,
      quickEditWorks: quickEditReachable && /bigger text/i.test(editState.prompt || "") && editState.credits === editCreditsBefore && editState.htmlLength > 500,
      tabsWork: generateTab.tabActive && generateTab.panelActive && generateTab.aria === "true",
      sidebarWorks: sidebarOpen,
      exportGateWorks: upgradeOpened,
      resetClearsAll: reset.script === "" && reset.topic === "" && reset.prompt === "" && reset.status === "No video generated yet" && reset.htmlLength === 0 && reset.emptyVisible && reset.timelineCards === 1 && reset.timelineEmpty,
      topGenerateWorks: topGenerate.status === "Preview ready" && topGenerate.htmlLength > 500 && topGenerate.credits === creditsBeforeTopGenerate - 1,
      noPageErrors: pageErrors.length === 0,
    };

    console.log("\n[draft]", draft);
    console.log("\n[generated]", generated);
    console.log("\n[ratios]", ratioResults);
    console.log("\n[quick edit]", editState);
    console.log("\n[generate tab]", generateTab);
    console.log("\n[reset]", reset);
    console.log("\n[top generate]", topGenerate);
    console.log("\n[page errors]", pageErrors);
    console.log("\n[assertions]", assertions);
    failed = Object.values(assertions).some((value) => !value);

    await page.evaluate(() => document.getElementById("toasts")?.replaceChildren());
    await delay(80);
    await page.screenshot({ path: path.join(__dirname, "shots", "studio_heygen_generated.jpg"), type: "jpeg", quality: 88, fullPage: false });
  } finally {
    await page.close();
    await browser.close();
    if (server) server.kill();
  }

  console.log(failed ? "\nGENERATOR FUNCTIONAL VALIDATION FAILED" : "\nGENERATOR FUNCTIONAL VALIDATION PASSED");
  process.exit(failed ? 1 : 0);
})().catch((error) => { console.error(error); process.exit(1); });
