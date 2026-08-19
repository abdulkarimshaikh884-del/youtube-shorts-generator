const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 960 });

    // 1. Test Template Detail Page
    console.log('Testing Template Details page...');
    await page.goto('http://localhost:3000/template?id=docu-red-string', { waitUntil: 'networkidle2', timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'audit_results/desktop_template_detail.png' });
    console.log('Saved audit_results/desktop_template_detail.png');

    // 2. Test Creator Profile Page
    console.log('Testing Creator Profile page...');
    await page.goto('http://localhost:3000/creator?handle=crimedocu', { waitUntil: 'networkidle2', timeout: 10000 });
    await new Promise(r => setTimeout(r, 2000));
    await page.screenshot({ path: 'audit_results/desktop_creator_profile.png' });
    console.log('Saved audit_results/desktop_creator_profile.png');

    await browser.close();
  } catch (e) {
    console.error('Test error:', e.message);
  }
})();
