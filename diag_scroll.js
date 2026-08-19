const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 10000 });

    // Scroll down gradually to trigger IntersectionObserver
    await page.evaluate(async () => {
      await new Promise((resolve) => {
        let totalHeight = 0;
        const distance = 600;
        const timer = setInterval(() => {
          const scrollHeight = document.body.scrollHeight;
          window.scrollBy(0, distance);
          totalHeight += distance;

          if (totalHeight >= scrollHeight) {
            clearInterval(timer);
            resolve();
          }
        }, 100);
      });
    });

    // Wait a brief moment for iframes to mount
    await new Promise(r => setTimeout(r, 1200));

    const mountedCount = await page.evaluate(() => document.querySelectorAll('.sh-stage iframe').length);
    console.log('Total Mounted Iframes after scroll:', mountedCount);

    await page.screenshot({ path: 'audit_results/desktop_scrolled.png', fullPage: true });
    console.log('Saved audit_results/desktop_scrolled.png');

    await browser.close();
  } catch (e) {
    console.error('Test error:', e.message);
  }
})();
