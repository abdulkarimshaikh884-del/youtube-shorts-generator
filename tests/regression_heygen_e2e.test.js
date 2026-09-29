const express = require("express");
const puppeteer = require("puppeteer");
const path = require("path");
const fs = require("fs");
const designs = require("../designs");

async function runHeyGenRegressionTest() {
  console.log("==========================================================");
  console.log("  REGRESSION TEST: HEYGEN END-TO-END VERIFICATION         ");
  console.log("==========================================================");

  const artDir = "C:\\Users\\karim\\.gemini\\antigravity\\brain\\ef8884d2-ca4f-4c9a-ab61-89f71ec40ef6\\heygen_renders";
  fs.mkdirSync(artDir, { recursive: true });
  const scratchDir = path.resolve(__dirname, "../scratch");

  // 1. BOOT EXPRESS TEST SERVER
  const app = express();
  const PORT = 3899;

  app.use(express.json({ limit: "10mb" }));
  app.use(express.static(path.resolve(__dirname, "../public")));

  app.get("/api/designs/templates/:id", async (req, res) => {
    const out = await designs.getTemplate(req.params.id);
    if (out.error) return res.status(out.status || 400).json(out);
    return res.json(out);
  });

  app.get("/api/designs/projects/:id", async (req, res) => {
    const out = await designs.getProject(req.params.id);
    if (out.error) return res.status(out.status || 400).json(out);
    return res.json(out);
  });

  app.post("/api/designs/projects/:id", async (req, res) => {
    const out = await designs.saveProject({ userId: "guest_creator" }, req.params.id, req.body);
    if (out.error) return res.status(out.status || 400).json(out);
    return res.json(out);
  });

  app.get("/design-editor", (req, res) => {
    res.sendFile(path.resolve(__dirname, "../public/design-editor.html"));
  });

  const server = app.listen(PORT, "127.0.0.1");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  try {
    // 1. Load Template
    await page.goto(`http://127.0.0.1:${PORT}/design-editor?tpl=dt_heygen_trick`, {
      waitUntil: "networkidle2",
      timeout: 30000
    });
    await page.waitForFunction(() => window.SC_STUDIO && window.SC_STUDIO.project && window.SC_STUDIO.project.elements.length > 5, { timeout: 10000 });
    await new Promise(r => setTimeout(r, 800));

    // 2. Perform Replacement (Title + Logo + Name)
    const chatGptLogoBuf = fs.readFileSync(path.join(scratchDir, "chatgpt_logo.png"));
    const chatGptDataUri = `data:image/png;base64,${chatGptLogoBuf.toString("base64")}`;

    await page.evaluate((newLogoUri) => {
      window.SC_STUDIO.updateText("text_2", "ChatGPT Trick!");
      window.SC_STUDIO.replaceImage("product_logo", newLogoUri, "ChatGPT Logo");
      window.SC_STUDIO.updateText("product_name", "ChatGPT");
      window.SC_STUDIO.moveElement("arrow", -160, 20);
      window.SC_STUDIO.recolorElement("arrow", "hue-rotate(185deg) saturate(1.4) brightness(1.05)");
      window.SC_STUDIO.toggleVisibility("youtube_icon", true);
      window.SC_STUDIO.render();
    }, chatGptDataUri);
    await new Promise(r => setTimeout(r, 600));

    // 3. Save Project
    const savedProjectId = "dp_heygen_regression_check";
    await page.evaluate((pId) => {
      window.SC_STUDIO.project.id = pId;
      return fetch(`/api/designs/projects/${pId}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(window.SC_STUDIO.project)
      }).then(r => r.json());
    }, savedProjectId);

    // 4. Reload and Verify
    await page.goto(`http://127.0.0.1:${PORT}/design-editor?id=${savedProjectId}`, {
      waitUntil: "networkidle2",
      timeout: 30000
    });
    await page.waitForFunction(() => window.SC_STUDIO && window.SC_STUDIO.project && window.SC_STUDIO.project.id === "dp_heygen_regression_check", { timeout: 10000 });

    const checks = await page.evaluate(() => {
      const proj = window.SC_STUDIO.project;
      const t2 = proj.elements.find(e => e.id === "text_2");
      const pLogo = proj.elements.find(e => e.id === "product_logo");
      const pName = proj.elements.find(e => e.id === "product_name");
      const arr = proj.elements.find(e => e.id === "arrow");
      const yt = proj.elements.find(e => e.id === "youtube_icon");
      return {
        title: t2 && t2.text === "ChatGPT Trick!",
        logo: pLogo && pLogo.src && pLogo.src.includes("data:image/png"),
        name: pName && pName.text === "ChatGPT",
        arrowMoved: arr && arr.x === -160,
        ytHidden: yt && yt.hidden === true
      };
    });

    if (!checks.title || !checks.logo || !checks.name || !checks.arrowMoved || !checks.ytHidden) {
      throw new Error(`HeyGen regression check failed: ${JSON.stringify(checks)}`);
    }

    console.log("  [PASS] HeyGen E2E Regression Fixture verified successfully.");
    return true;
  } finally {
    await browser.close();
    server.close();
  }
}

if (require.main === module) {
  runHeyGenRegressionTest().catch(err => {
    console.error("Regression check error:", err);
    process.exit(1);
  });
}

module.exports = { runHeyGenRegressionTest };
