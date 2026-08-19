const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));

    console.log('Navigating to homepage...');
    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 10000 });
    await page.waitForSelector('.sh-tile .sh-stage-link', { timeout: 10000 });
    await new Promise(r => setTimeout(r, 1000));

    // Scroll to templates section
    await page.evaluate(() => {
      window.scrollTo(0, 400);
    });
    await new Promise(r => setTimeout(r, 500));
    await page.screenshot({ path: 'audit_results/desktop_gallery_fitted.png' });
    console.log('Saved audit_results/desktop_gallery_fitted.png');

    // Click the first card
    console.log('Clicking first card linkCover...');
    await page.evaluate(() => {
      const link = document.querySelector('.sh-tile .sh-stage-link');
      if (link) link.click();
    });

    await new Promise(r => setTimeout(r, 1500));
    const modalInfo = await page.evaluate(() => {
      const m = document.getElementById('tplModal');
      return m ? { className: m.className, display: window.getComputedStyle(m).display, opacity: window.getComputedStyle(m).opacity, zIndex: window.getComputedStyle(m).zIndex } : null;
    });
    console.log('Modal status in page:', modalInfo);

    await page.screenshot({ path: 'audit_results/desktop_modal_popup.png' });
    console.log('Saved audit_results/desktop_modal_popup.png');

    await browser.close();
  } catch (e) {
    console.error('Test error:', e.message);
  }
})();
