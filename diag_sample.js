const puppeteer = require('puppeteer');

(async () => {
  try {
    const browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 1440, height: 900 });

    await page.goto('http://localhost:3000/', { waitUntil: 'networkidle2', timeout: 10000 });

    const tileInfo = await page.evaluate(() => {
      const tiles = document.querySelectorAll('.sh-tile');
      const data = [];
      tiles.forEach((t, idx) => {
        if (idx < 15) {
          const iframe = t.querySelector('iframe');
          let docContent = '';
          try {
            if (iframe && iframe.contentDocument) {
              docContent = iframe.contentDocument.body ? iframe.contentDocument.body.innerHTML.slice(0, 100) : 'no-body';
            }
          } catch(e) {
            docContent = 'cross-origin or sandboxed';
          }
          data.push({
            idx,
            tpl: t.dataset.tpl,
            name: t.dataset.name,
            isComm: t.dataset.comm,
            hasIframe: !!iframe,
            srcdocLength: iframe ? (iframe.srcdoc || '').length : 0,
            srcdocSnippet: iframe ? (iframe.srcdoc || '').slice(0, 200) : ''
          });
        }
      });
      return data;
    });

    console.log('Tile Data Sample:');
    tileInfo.forEach(t => {
      console.log(`[${t.idx}] tpl=${t.tpl}, name="${t.name}", isComm=${t.isComm}, srcdocLen=${t.srcdocLength}`);
    });

    await browser.close();
  } catch (e) {
    console.error('Test error:', e.message);
  }
})();
