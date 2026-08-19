const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 10000 });

    await page.screenshot({ path: 'audit_results/desktop_home.png', fullPage: false });
    await page.screenshot({ path: 'audit_results/desktop_full.png', fullPage: true });

    console.log('Saved desktop screenshots to audit_results/');
    await browser.close();
  } catch (e) {
    console.error('Test error:', e.message);
  }
})();
