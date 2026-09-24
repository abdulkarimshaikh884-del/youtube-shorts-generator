// Read-only static UI checks; run polish-preview-server.js first.
const puppeteer = require('puppeteer');
const assert = require('node:assert/strict');
const fs = require('node:fs');
(async () => {
  const browser = await puppeteer.launch({headless: true});
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push(e.message));
    await page.setRequestInterception(true);
    page.on('request', r => {
      const url = new URL(r.url());
      if (url.pathname === '/api/credits') return r.respond({status:200,contentType:'application/json',body:JSON.stringify({success:true,plan:'free',planLabel:'Free',left:5,perDay:5,cost:{export:1,animate:2}})});
      if (url.pathname.startsWith('/api/')) return r.respond({status: 200, contentType: 'application/json', body: JSON.stringify({success:true,user:null,templates:[],skills:[],reactions:{},items:[],notifications:[]})});
      if (!['GET', 'HEAD'].includes(r.method())) return r.abort();
      r.continue();
    });
    fs.mkdirSync('audit_results/home-intro', {recursive:true});
    for (const width of [320,390,768,1440]) {
      for (const theme of ['light','dark']) {
        await page.setViewport({width,height:900,isMobile:width<768,hasTouch:width<768});
        await page.goto('http://127.0.0.1:3327/',{waitUntil:'networkidle2'});
        await page.evaluate(t => { document.documentElement.dataset.theme=t; localStorage.setItem('sc_theme',t); },theme);
        await page.waitForFunction(() => document.querySelectorAll('#gallery .sh-tile').length === 10);
        assert.equal(await page.$eval('.sh-sec-more a',el=>el.textContent.trim()),'Browse All Animation');
        assert.equal(await page.$eval('.sh-sec-more a',el=>el.getAttribute('href')),'/animations');
        assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'No page overflow');
        if(width>=1280) assert.equal(await page.$eval('#gallery',el=>getComputedStyle(el).gridTemplateColumns.split(' ').length),5,'Two full rows of five');
        assert.equal(await page.$$eval('#gallery .sh-tile',els=>new Set(els.map(el=>el.dataset.reactionId)).size),10,'Unique template cards');
        await page.type('#composerPrompt','A blue card');
        assert.equal(await page.$eval('#composerCount',el=>el.textContent),'11/500');
        await page.click('#qualityBtn');
        assert(await page.$eval('#qualityMenu',el=>!el.hidden),'Model picker opens');
        await page.click('#qualityBtn');
        await page.$eval('#composerPrompt',el=>{el.value='';el.dispatchEvent(new Event('input',{bubbles:true}));el.blur();});
        await page.click('h1');
        await page.screenshot({path:`audit_results/home-intro/${theme}-${width}.png`});
        console.log(`PASS ${width} ${theme}: 10 templates, no overflow, prompt and model picker`);
      }
    }
    assert.deepEqual(errors,[]);
  } finally { await browser.close(); }
})().catch(e=>{console.error(e);process.exitCode=1;});
