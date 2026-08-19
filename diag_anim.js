const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 10000 });

    // Wait 2 seconds for CSS animations to play to their visible peak
    await new Promise(r => setTimeout(r, 2000));

    await page.screenshot({ path: 'audit_results/desktop_animated.png' });
    console.log('Saved audit_results/desktop_animated.png after 2s of animation playback');

    await browser.close();
  } catch (e) {
    console.error('Test error:', e.message);
  }
})();
