const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 10000 });

    await page.evaluate(() => {
      window.scrollBy(0, 340);
    });

    await new Promise(r => setTimeout(r, 2000));

    await page.screenshot({ path: 'audit_results/desktop_meta_focus.png' });
    console.log('Saved audit_results/desktop_meta_focus.png');

    await browser.close();
  } catch (e) {
    console.error('Test error:', e.message);
  }
})();
