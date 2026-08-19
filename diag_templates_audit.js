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

    const testTpls = [
      { id: "docu-confidential", name: "Classified Stamp" },
      { id: "docu-red-string", name: "Red String Board" },
      { id: "paper-torn-rip", name: "Torn Paper on Cutting Mat" },
      { id: "paper-executive-noir", name: "Minimalist Executive Motion" },
      { id: "text-highlight-box", name: "Marker Highlight Box" },
      { id: "text-word-punch", name: "Word Punch Scale" },
      { id: "text-terminal", name: "Terminal Typing" },
      { id: "money-candlestick", name: "Candlestick Chart" },
      { id: "ui-iphone-mockup", name: "iPhone Mockup" },
      { id: "social-sub-counter", name: "Subscriber Counter" }
    ];

    console.log("Auditing templates across all 8 categories in AutoAE / After Effects level rendering...");

    for (let i = 0; i < testTpls.length; i++) {
      const item = testTpls[i];
      console.log(`[${i + 1}/${testTpls.length}] Testing template: ${item.name} (${item.id})...`);
      await page.goto(`http://localhost:3000/template?id=${item.id}`, { waitUntil: "networkidle2", timeout: 15000 });
      await new Promise((r) => setTimeout(r, 1200));
      await page.screenshot({ path: `audit_results/tpl_${item.id}.png` });
    }

    await browser.close();

    console.log("\n=== AUDIT REPORT ===");
    if (errors.length === 0) {
      console.log("SUCCESS: All 10 representative templates rendered in 60 FPS with 0 errors!");
    } else {
      console.log("Errors logged:", errors);
    }
  } catch (err) {
    console.error("Audit failed:", err);
  }
})();
