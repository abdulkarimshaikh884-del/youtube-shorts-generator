// Read-only UI regression: no feedback submissions or real account requests.
const assert = require('node:assert/strict');
const puppeteer = require('puppeteer');
(async () => {
  const browser = await puppeteer.launch({headless: true});
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('request', request => {
      const url = new URL(request.url());
      if (url.pathname.startsWith('/api/')) return request.respond({status: 200, contentType: 'application/json', body: JSON.stringify({success: true, user: null, templates: [], items: [], plan: 'free', left: 5, perDay: 5})});
      if (request.method() !== 'GET') return request.abort();
      request.continue();
    });
    for (const theme of ['light', 'dark']) {
      for (const width of [390, 1440]) {
        await page.setViewport({width, height: 900});
        await page.goto('http://127.0.0.1:3327/', {waitUntil: 'networkidle2'});
        await page.evaluate(t => localStorage.setItem('sc_theme', t), theme);
        await page.reload({waitUntil: 'networkidle2'});
        const homeColor = await page.$eval('.sh-brand', e => getComputedStyle(e).color);
        await Promise.all([
          page.waitForNavigation({waitUntil: 'networkidle2'}),
          page.$eval('.sh-rail a[href="/contact"]', e => e.click())
        ]);
        assert.equal(await page.evaluate(() => document.documentElement.dataset.theme), theme);
        assert.equal(await page.$eval('.sh-brand', e => getComputedStyle(e).color), homeColor);
        assert.equal(await page.$$eval('.sh-rail a[href="/uploads"], .sh-rail a[href="/admin"], .sh-rail [data-theme-toggle]', es => es.length), 0);
        assert(await page.$('link[href^="/monochrome.css"]'));
        assert(await page.$('#fbForm'));
        assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const button = await page.$eval('#fbSend', e => getComputedStyle(e).backgroundColor);
        const channels = button.match(/[\d.]+/g).slice(0, 3).map(Number);
        assert(Math.max(...channels) - Math.min(...channels) < 8, `Expected neutral button: ${button}`);
        console.log(`PASS Home → Feedback: ${theme}, ${width}px`);
      }
    }
  } finally { await browser.close(); }
})().catch(error => { console.error(error); process.exitCode = 1; });
