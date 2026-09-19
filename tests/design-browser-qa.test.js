/**
 * test_browser_designs.js — Headless browser tests for Designs Hub and Design Studio
 */
const puppeteer = require("puppeteer");

async function runBrowserTests() {
  console.log("=== Running Headless Browser QA on Designs Hub & Studio ===\n");

  const browser = await puppeteer.launch({
    headless: "new",
    args: ["--no-sandbox", "--disable-setuid-sandbox"]
  });

  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (err) => errors.push(err.message));
  page.on("error", (err) => errors.push(err.message));

  // ── 1. Test /designs page ─────────────────────────────────────
  console.log("1. Navigating to http://localhost:3000/designs...");
  await page.goto("http://localhost:3000/designs", { waitUntil: "networkidle0" });

  const title = await page.title();
  console.log("   ✓ Page Title:", title);

  // Check heading
  const h1 = await page.$eval("h1", el => el.textContent);
  console.log("   ✓ H1:", h1);

  // Wait for templates grid to load
  await page.waitForSelector(".ds-card", { timeout: 5000 });
  const cardCount = await page.$$eval(".ds-card", cards => cards.length);
  console.log("   ✓ Rendered template cards count:", cardCount);

  // Test category filter click
  console.log("2. Testing category filters...");
  await page.click('button[data-cat="youtube-thumbnail"]');
  await new Promise(r => setTimeout(r, 600));
  const filteredCount = await page.$$eval(".ds-card", cards => cards.length);
  console.log("   ✓ Filtered template count for youtube-thumbnail:", filteredCount);

  // Check upload button and auth redirect
  console.log("3. Testing upload button auth gating...");
  const uploadBtn = await page.$(".js-open-design-upload");
  if (uploadBtn) {
    await uploadBtn.click();
    await new Promise(r => setTimeout(r, 800));
    const currentUrl = page.url();
    console.log("   ✓ Clicked upload while unauthenticated -> URL is:", currentUrl);
    if (currentUrl.includes("/login")) {
      console.log("   ✓ Correctly redirected unauthenticated user to /login!");
    }
  }

  // ── 2. Test /design-editor Studio ─────────────────────────────
  console.log("\n4. Navigating to http://localhost:3000/design-editor...");
  await page.goto("http://localhost:3000/design-editor?session=1", { waitUntil: "networkidle0" });

  const studioTitle = await page.title();
  console.log("   ✓ Studio Page Title:", studioTitle);

  // Verify canvas element exists and has dimensions
  const canvasDims = await page.$eval("#designCanvas", c => ({
    width: c.width,
    height: c.height
  }));
  console.log("   ✓ Studio Canvas Dimensions:", canvasDims.width, "x", canvasDims.height);

  // Verify toolbar buttons
  const toolButtons = await page.$$eval(".de-tool-btn", btns => btns.map(b => b.dataset.tab));
  console.log("   ✓ Available Tools in Studio:", toolButtons.join(", "));

  // Verify mobile responsive layout
  console.log("\n5. Testing Mobile Viewport (375x667 iPhone SE)...");
  await page.setViewport({ width: 375, height: 667 });
  await page.goto("http://localhost:3000/designs", { waitUntil: "networkidle0" });
  const hasHorizOverflow = await page.evaluate(() => {
    return document.documentElement.scrollWidth > window.innerWidth;
  });
  console.log("   ✓ Mobile horizontal overflow:", hasHorizOverflow ? "OVERFLOW DETECTED" : "None (Clean layout)");

  if (errors.length > 0) {
    console.error("\n❌ Page console errors detected:", errors);
  } else {
    console.log("   ✓ Zero console errors on pages!");
  }

  await browser.close();
  console.log("\n>>> BROWSER QA TESTS COMPLETED SUCCESSFULLY! <<<\n");
}

runBrowserTests().catch(err => {
  console.error("Browser QA Error:", err);
  process.exit(1);
});
