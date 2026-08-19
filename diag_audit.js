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
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: "audit_results/audit_home.png" });
    console.log("   Saved audit_results/audit_home.png");

    console.log("2. Clicking first template card to test Modal...");
    const firstStageLink = await page.$(".sh-tile .sh-stage-link");
    if (firstStageLink) {
      await firstStageLink.click();
      await new Promise((r) => setTimeout(r, 1500));
      await page.screenshot({ path: "audit_results/audit_modal.png" });
      console.log("   Saved audit_results/audit_modal.png");

      const closeBtn = await page.$("#modalClose");
      if (closeBtn) {
        await closeBtn.click();
        await new Promise((r) => setTimeout(r, 500));
      }
    }

    console.log("3. Visiting Template Detail Page...");
    await page.goto("http://localhost:3000/template?id=docu-red-string", { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 2000));
    await page.screenshot({ path: "audit_results/audit_template_detail.png" });
    console.log("   Saved audit_results/audit_template_detail.png");

    console.log("4. Visiting Creator Profile Page...");
    await page.goto("http://localhost:3000/creator?handle=crimedocu", { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: "audit_results/audit_creator_profile.png" });
    console.log("   Saved audit_results/audit_creator_profile.png");

    console.log("5. Visiting Community Page...");
    await page.goto("http://localhost:3000/community", { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: "audit_results/audit_community.png" });
    console.log("   Saved audit_results/audit_community.png");

    await browser.close();

    console.log("\n=== AUDIT REPORT ===");
    if (errors.length === 0) {
      console.log("SUCCESS: All pages and interactions rendered flawlessly with 0 errors!");
    } else {
      console.log("Errors logged:", errors);
    }
  } catch (err) {
    console.error("Audit script failed:", err);
  }
})();
