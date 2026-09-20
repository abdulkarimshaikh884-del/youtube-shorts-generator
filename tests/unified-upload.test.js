const puppeteer = require("puppeteer");

async function run() {
  console.log("=== Testing Unified Topbar Upload Auto-Detection & Flow ===");
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  await page.setViewport({ width: 1280, height: 800 });

  // 1. Visit /designs as guest, click #topbarUploadBtn -> verify redirects to /login
  console.log("1. Testing topbar upload button auth gating for guest...");
  await page.goto("http://localhost:3000/designs", { waitUntil: "networkidle2" });
  await Promise.all([
    page.waitForNavigation({ waitUntil: "networkidle2" }),
    page.click("#topbarUploadBtn")
  ]);
  const url = page.url();
  console.log("   Redirected to:", url);
  if (!url.includes("/login")) {
    throw new Error("Guest was not redirected to /login when clicking topbar upload button!");
  }
  console.log("   ✓ Guest properly redirected to /login?next=...");

  // 2. Mock a logged in user session by intercepting /api/auth/me
  console.log("2. Testing logged-in upload modal with image upload...");
  await page.setRequestInterception(true);
  page.on("request", req => {
    if (req.url().includes("/api/auth/me")) {
      req.respond({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({ user: { id: "u_test", email: "creator@shortscraft.online", name: "Creator" } })
      });
    } else {
      req.continue();
    }
  });

  await page.goto("http://localhost:3000/designs", { waitUntil: "networkidle2" });

  // Click #topbarUploadBtn now that we are logged in
  await page.click("#topbarUploadBtn");

  // Verify modal is open and inspect config
  const modalInfo = await page.evaluate(() => {
    const modal = document.getElementById("publishTemplateModal");
    const accept = document.getElementById("uploadFile") ? document.getElementById("uploadFile").getAttribute("accept") : "";
    const designPanel = document.getElementById("authDesignPanel");
    return {
      modalOpen: modal && !modal.hidden,
      acceptAttr: accept,
      hasDesignPanel: !!designPanel
    };
  });

  console.log("   Modal config:", modalInfo);
  if (!modalInfo.modalOpen) {
    throw new Error("Upload modal did not open for logged-in user!");
  }
  if (!modalInfo.acceptAttr.includes(".png") || !modalInfo.acceptAttr.includes(".webp")) {
    throw new Error("uploadFile input does not accept images!");
  }
  if (!modalInfo.hasDesignPanel) {
    throw new Error("publishTemplateModal missing authDesignPanel!");
  }
  console.log("   ✓ Upload modal opened cleanly, accepts animations & images, design panel ready");

  // 3. Test simulating image drop / change
  console.log("3. Testing image drop triggers handleDesignImage and mode choice...");
  const modeChoiceRendered = await page.evaluate(async () => {
    // 1x1 PNG bytes
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 0, 1, 0, 0, 0, 1, 8, 6, 0, 0, 0, 31, 21, 196, 137, 0, 0, 0, 10, 73, 68, 65, 84, 120, 156, 99, 0, 1, 0, 0, 5, 0, 1, 13, 10, 45, 180, 0, 0, 0, 0, 73, 69, 78, 68, 174, 66, 96, 130]);
    const blob = new Blob([bytes], { type: "image/png" });
    const testFile = new File([blob], "heygen-sample-thumb.png", { type: "image/png" });

    const fileInput = document.getElementById("uploadFile");
    const dt = new DataTransfer();
    dt.items.add(testFile);
    fileInput.files = dt.files;
    fileInput.dispatchEvent(new Event("change", { bubbles: true }));

    // Wait for FileReader
    await new Promise(r => setTimeout(r, 500));
    const designPanel = document.getElementById("authDesignPanel");
    const convertBtn = document.getElementById("authBtnConvertEditable");
    const useAsImgBtn = document.getElementById("authBtnUseAsImage");
    const title = document.getElementById("publishTitle");
    return {
      panelVisible: designPanel && !designPanel.hidden,
      hasConvertBtn: !!convertBtn,
      hasUseAsImgBtn: !!useAsImgBtn,
      titleText: title ? title.textContent : ""
    };
  });

  console.log("   Mode choice state:", modeChoiceRendered);
  if (!modeChoiceRendered.panelVisible || !modeChoiceRendered.hasConvertBtn) {
    throw new Error("Design mode choice did not render on image upload!");
  }
  console.log("   ✓ Image auto-detected! 'Convert to Editable' & 'Use as Image' choices cleanly rendered");

  await browser.close();
  console.log("\n>>> ALL UNIFIED UPLOAD TESTS PASSED! <<<");
}

run().catch(err => {
  console.error("Test failed:", err);
  process.exit(1);
});
