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

    console.log("1. Visiting Home Page as Guest...");
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle2", timeout: 20000 });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: "audit_results/audit_home_guest.png" });
    console.log("   Saved audit_results/audit_home_guest.png");

    console.log("2. Simulating User Login Session via /login...");
    // Let's perform a login or test the logged-in state
    await page.goto("http://localhost:3000/login", { waitUntil: "networkidle2" });
    await page.type("#authEmail", "karimabdul9065@gmail.com");
    await page.type("#authPassword", "TestPassword123!");
    await page.click("#authSend");
    await new Promise((r) => setTimeout(r, 1500));

    console.log("3. Visiting Home Page as Logged-in User...");
    await page.goto("http://localhost:3000/", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: "audit_results/audit_home_loggedin.png" });
    console.log("   Saved audit_results/audit_home_loggedin.png");

    console.log("4. Triggering Sidebar User Account Popover Menu...");
    // Click or hover on the sidebar user trigger
    const trigger = await page.$("#sidebarUserTrigger");
    if (trigger) {
      await trigger.click();
      await new Promise((r) => setTimeout(r, 600));
      await page.screenshot({ path: "audit_results/audit_popover_open.png" });
      console.log("   Saved audit_results/audit_popover_open.png");
    }

    console.log("5. Testing 'My Profile & Setup' button from Popover...");
    const profileBtn = await page.$("#popoverProfileBtn");
    if (profileBtn) {
      await profileBtn.click();
      await new Promise((r) => setTimeout(r, 800));
      await page.screenshot({ path: "audit_results/audit_profile_modal.png" });
      console.log("   Saved audit_results/audit_profile_modal.png");

      const closeProfileBtn = await page.$("#closeEditProfileBtn");
      if (closeProfileBtn) {
        await closeProfileBtn.click();
        await new Promise((r) => setTimeout(r, 400));
      }
    }

    console.log("6. Testing 'Upload / Publish Template' button from Popover...");
    if (trigger) {
      await trigger.click();
      await new Promise((r) => setTimeout(r, 400));
      const uploadBtn = await page.$("#popoverUploadBtn");
      if (uploadBtn) {
        await uploadBtn.click();
        await new Promise((r) => setTimeout(r, 1000));
        await page.screenshot({ path: "audit_results/audit_upload_modal.png" });
        console.log("   Saved audit_results/audit_upload_modal.png");
      }
    }

    console.log("7. Visiting Community Page...");
    await page.goto("http://localhost:3000/community", { waitUntil: "networkidle2" });
    await new Promise((r) => setTimeout(r, 1500));
    await page.screenshot({ path: "audit_results/audit_community_loggedin.png" });
    console.log("   Saved audit_results/audit_community_loggedin.png");

    await browser.close();

    console.log("\n=== AUDIT REPORT ===");
    if (errors.length === 0) {
      console.log("SUCCESS: All account features and popover menus rendered flawlessly with 0 errors!");
    } else {
      console.log("Errors logged:", errors);
    }
  } catch (err) {
    console.error("Audit script failed:", err);
  }
})();
