const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', err => console.log('PAGE ERROR:', err.toString()));

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 10000 });

    // Check first tile iframe content
    const iframeDetails = await page.evaluate(() => {
      const tiles = document.querySelectorAll('.sh-tile');
      const results = [];
      tiles.forEach((t, i) => {
        if (i < 5) {
          const iframe = t.querySelector('iframe');
          results.push({
            tpl: t.dataset.tpl,
            mounted: t.dataset.mounted,
            hasIframe: !!iframe,
            srcdocLen: iframe ? (iframe.srcdoc || '').length : 0,
            srcdocPreview: iframe ? (iframe.srcdoc || '').slice(0, 150) : ''
          });
        }
      });
      return results;
    });

    console.log('First 5 tiles details:', JSON.stringify(iframeDetails, null, 2));

    await browser.close();
  } catch (e) {
    console.error('Test error:', e.message);
  }
})();
