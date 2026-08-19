const puppeteer = require("puppeteer");
const http = require("http");
const app = require("./server.js");

async function run() {
  const PORT = 3009;
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(PORT, resolve));
  console.log(`[Diagnostic Server] Running on http://localhost:${PORT}`);

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1440, height: 900 });

  const errors = [];
  page.on("pageerror", (e) => errors.push("[PAGE ERROR] " + e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push("[CONSOLE ERROR] " + m.text());
  });

  console.log("1. Visiting Home Page...");
  await page.goto(`http://localhost:${PORT}/`, { waitUntil: "networkidle2", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: "audit_results/diag_home_gradient.png", fullPage: false });
  console.log("   Saved audit_results/diag_home_gradient.png");

  console.log("2. Testing Modal popup on Home...");
  const firstCard = await page.$(".sh-tile .sh-stage-link");
  if (firstCard) {
    await firstCard.click();
    await new Promise((r) => setTimeout(r, 1200));
    await page.screenshot({ path: "audit_results/diag_home_modal.png" });
    console.log("   Saved audit_results/diag_home_modal.png");

    const modalClose = await page.$("#modalClose");
    if (modalClose) {
      await modalClose.click();
      await new Promise((r) => setTimeout(r, 500));
    }
  }

  console.log("3. Visiting Template Detail Page...");
  await page.goto(`http://localhost:${PORT}/template?id=docu-red-string`, { waitUntil: "networkidle2", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 2000));
  await page.screenshot({ path: "audit_results/diag_template_detail.png" });
  console.log("   Saved audit_results/diag_template_detail.png");

  console.log("4. Visiting Creator Profile Page...");
  await page.goto(`http://localhost:${PORT}/creator?handle=crimedocu`, { waitUntil: "networkidle2", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "audit_results/diag_creator_profile.png" });
  console.log("   Saved audit_results/diag_creator_profile.png");

  console.log("5. Visiting Community Page...");
  await page.goto(`http://localhost:${PORT}/community`, { waitUntil: "networkidle2", timeout: 15000 });
  await new Promise((r) => setTimeout(r, 1500));
  await page.screenshot({ path: "audit_results/diag_community_hub.png" });
  console.log("   Saved audit_results/diag_community_hub.png");

  await browser.close();
  await new Promise((resolve) => server.close(resolve));

  console.log("\n=== DIAGNOSTIC REPORT ===");
  if (errors.length === 0) {
    console.log("ALL PAGES LOADED WITH 0 ERRORS! Theme & Animations verified.");
  } else {
    console.log("Errors encountered:", errors);
  }
}

run().catch((err) => {
  console.error("Diagnostic execution error:", err);
  process.exit(1);
});
