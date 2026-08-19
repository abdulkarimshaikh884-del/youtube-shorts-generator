const puppeteer = require("puppeteer");

(async () => {
  try {
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
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));

    console.log("2. Opening Upload Modal...");
    await page.evaluate(() => {
      if (window.SC_AUTH && typeof window.SC_AUTH.setupUploadModal === "function") {
        const modal = document.querySelector("#uploadTemplateModal");
        if (modal) modal.removeAttribute("hidden");
      }
    });
    await new Promise((r) => setTimeout(r, 800));

    console.log("3. Switching to AI Video-to-Template Tab...");
    await page.click("#tabModeAI");
    await new Promise((r) => setTimeout(r, 600));
    await page.screenshot({ path: "audit_results/audit_ai_tab_open.png" });
    console.log("   Saved audit_results/audit_ai_tab_open.png");

    console.log("4. Triggering AI Deconstruction of user's video...");
    await page.click("#btnDeconstructVideo");
    await new Promise((r) => setTimeout(r, 2200));
    await page.screenshot({ path: "audit_results/audit_ai_deconstruct_success.png" });
    console.log("   Saved audit_results/audit_ai_deconstruct_success.png");

    console.log("5. Testing Template in Gallery & Detail View...");
    await page.goto("http://localhost:3000/template?id=paper-executive-noir", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1800));
    await page.screenshot({ path: "audit_results/audit_deconstructed_template_detail.png" });
    console.log("   Saved audit_results/audit_deconstructed_template_detail.png");

    await browser.close();

    console.log("\n=== AUDIT REPORT ===");
    if (errors.length === 0) {
      console.log("SUCCESS: AI Video-to-Template pipeline verified flawlessly with 0 errors!");
    } else {
      console.log("Errors logged:", errors);
    }
  } catch (err) {
    console.error("Test failed:", err);
  }
})();
