"use strict";
// Isolated browser layout QA. Run tests/polish-preview-server.js first.
// No live database, credentials, payments, AI generation or uploads are used.
const puppeteer = require('puppeteer');
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const base = 'http://127.0.0.1:3327';
const out = path.resolve(__dirname, '../audit_results/mobile-layout');
const phase = process.argv.includes('--before') ? 'before' : 'after';
const routes = ['/', '/pricing', '/community', '/drafts', '/uploads', '/settings', '/tutorials', '/account', '/contact', '/about', '/privacy', '/terms', '/login', '/signup', '/forgot-password', '/reset-password', '/creator?handle=shortscraft', '/template?id=original-chat-story', '/admin', '/404'];
(async () => {
  fs.mkdirSync(out, {recursive: true});
  const browser = await puppeteer.launch({headless: true, args: ['--no-sandbox']});
  try {
  const page = await browser.newPage();
  const results = [];
  const errors = [];
  const interactions = [];
  let signedIn = false;
  page.on('pageerror', e => errors.push(e.message));
  await page.setRequestInterception(true);
  page.on('request', req => {
    const u = new URL(req.url());
    if (u.protocol === 'data:' || u.protocol === 'about:') return req.continue();
    if (u.origin !== base) return req.abort();
    // These are read-only test responses, never data seeded into the app.
    if (u.pathname.startsWith('/api/')) {
      if (req.method() !== 'GET') return req.respond({status: 403, contentType: 'application/json', body: '{"success":false,"error":"Writes disabled in layout QA"}'});
      let data = {success: true, templates: [], notifications: [], items: [], reactions: {}, skills: [], projects: [], creations: [], tickets: [], users: []};
      if (/auth\/me/.test(u.pathname)) data = {success: true, user: signedIn ? {id: 'layout-qa-only', email: 'layout@example.test', handle: 'layout_test', displayName: 'Layout Test', plan: 'free', bio: 'Browser-only layout fixture. Not a real user.'} : null};
      if (/credits/.test(u.pathname)) data = {success: true, plan: 'free', left: 5, perDay: 5, cost: {export: 1, animate: 2}};
      return req.respond({status: 200, contentType: 'application/json', body: JSON.stringify(data)});
    }
    req.continue();
  });
  for (const width of (process.argv.includes('--interactions-only') ? [] : [320, 390, 768, 1440])) {
    await page.setViewport({width, height: width === 320 ? 568 : 844, isMobile: width < 900, hasTouch: width < 900});
    for (const route of routes) {
      const response = await page.goto(base + route, {waitUntil: 'networkidle0', timeout: 30000});
      assert.equal(response.status(), 200, 'Static route exists: ' + route);
      const info = await page.evaluate(() => {
        const outside = [...document.querySelectorAll('main *, #main *')].filter(el => {
          const r = el.getBoundingClientRect(), c = getComputedStyle(el);
          return r.width && r.height && c.position !== 'absolute' && c.position !== 'fixed' && r.right > innerWidth + 2 && !el.closest('[hidden], .sh-filters-scroll, .sh-stage, .sh-nav-mobile');
        }).slice(0, 8).map(el => `${el.tagName}.${el.className}`);
        return {width: innerWidth, scrollWidth: document.documentElement.scrollWidth, outside};
      });
      results.push({route, ...info});
      if (width === 390 && ['/', '/pricing', '/account', '/login', '/uploads', '/tutorials'].includes(route)) {
        await page.screenshot({path: path.join(out, `${phase}-${route.replace(/\W/g, '') || 'home'}-390.png`)});
      }
    }
    await page.goto(base + '/editor?tpl=original-chat-story', {waitUntil: 'networkidle0'});
    await page.waitForSelector('#edFrame iframe');
    if (width <= 1024) {
      for (const panel of ['Canvas', 'Edit', 'Ai']) {
        await page.click('#edMobile' + panel);
        await new Promise(r => setTimeout(r, 200));
        const info = await page.evaluate(() => {
          const rect = s => { const r = document.querySelector(s).getBoundingClientRect(); return {x:r.x, y:r.y, w:r.width, h:r.height, bottom:r.bottom}; };
          return {width: innerWidth, scrollWidth: document.documentElement.scrollWidth, frame: rect('#edFrame'), transport: rect('.ed-transport'), main: rect('.ed-main')};
        });
        results.push({route: '/editor/' + panel, ...info});
        if (width === 390) await page.screenshot({path: path.join(out, `${phase}-editor-${panel}-390.png`)});
      }
    }
  }
  if (phase === 'after') {
    for (const [width, height] of [[320,568], [390,844], [844,390], [1024,768]]) {
      console.log(`Checking Studio interactions at ${width}x${height}`);
      await page.setViewport({width, height, isMobile: true, hasTouch: true});
      await page.goto(base + '/editor?tpl=original-chat-story', {waitUntil: 'networkidle0'});
      await page.waitForSelector('#edFrame iframe');
      assert(await page.evaluate(() => {
        const f = document.querySelector('#edFrame').getBoundingClientRect();
        const tl = document.querySelector('.ed-tl').getBoundingClientRect();
        const nav = document.querySelector('.ed-mobile-nav').getBoundingClientRect();
        return f.width > 40 && f.height > 60 && f.top >= 44 && f.bottom <= tl.top && tl.bottom <= nav.top + 1 && nav.bottom <= innerHeight + 1;
      }), `Preview, timeline and tabs fit ${width}x${height}`);
      await page.click('#edMobileEdit');
      assert(await page.evaluate(() => {
        const f = document.querySelector('#edFrame').getBoundingClientRect();
        const input = document.querySelector('#edFields > .ed-f input[type=text]');
        const r = input.getBoundingClientRect();
        return f.height > 60 && r.height >= 36 && r.bottom < innerHeight && document.querySelector('#main').getAttribute('aria-hidden') === 'false';
      }), 'Live preview and content field available together');
      await page.evaluate(() => {
        const input = document.querySelector('#edFields > .ed-f input[type=text]');
        input.value = 'Mobile QA edit'; input.dispatchEvent(new Event('input', {bubbles:true}));
      });
      try {
        await page.waitForFunction(() => [...document.querySelectorAll('#edFrame iframe')].some(f => f.contentDocument?.body.textContent.includes('Mobile QA edit')));
      } catch (error) {
        console.error('Preview update diagnostic', await page.evaluate(() => ({
          fields: [...document.querySelectorAll('#edFields input[type=text]')].map(el => ({id:el.id, value:el.value})),
          frames: [...document.querySelectorAll('#edFrame iframe')].map(el => ({id:el.id, text:el.contentDocument?.body?.textContent?.slice(-2000)}))
        })));
        throw error;
      }
      await page.evaluate(() => document.querySelector('.ed-advanced-toggle').scrollIntoView({block:'center'}));
      await page.click('.ed-advanced-toggle');
      assert(await page.$eval('#edAdvancedFields', el => el.getBoundingClientRect().height > 0), 'Advanced controls expand');
      await page.evaluate(() => { const s = document.querySelector('.ed-right .ed-scroll'); s.scrollTop = s.scrollHeight; });
      assert(await page.evaluate(() => {
        const r = document.querySelector('#edReset').getBoundingClientRect(), nav = document.querySelector('.ed-mobile-nav').getBoundingClientRect();
        return r.top >= 0 && r.bottom <= nav.top + 1;
      }), 'Final edit control reachable');
      await page.click('#edExport');
      assert(await page.$eval('#exportPop', el => {
        const r = el.getBoundingClientRect();
        return !el.hidden && r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1;
      }), 'Export options fit');
      await page.click('#exportCancel');
      await page.click('#edMobileAi');
      assert(await page.$eval('#edCreate', el => { const r = el.getBoundingClientRect(); return r.top > 0 && r.bottom < innerHeight; }), 'AI composer is reachable');
      interactions.push(`${width}x${height}: live edit, preview, advanced controls, final field, export dialog, AI`);
    }
    signedIn = true;
    await page.setViewport({width: 390, height: 844, isMobile: true, hasTouch: true});
    for (const route of ['/account#edit-profile', '/uploads', '/settings', '/drafts']) {
      await page.goto(base + route, {waitUntil:'networkidle0'});
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1), 'Signed-in fixture layout fits: ' + route);
      await page.screenshot({path: path.join(out, `after-signedin-${route.split('#')[0].slice(1)}-390.png`)});
      if (route.startsWith('/account')) {
        await page.click('#openEditProfileBtn');
        await new Promise(r => setTimeout(r, 400));
        assert(await page.$eval('#igPaneEdit', el => !el.hidden), 'Profile editing opens inline');
        await page.screenshot({path: path.join(out, 'after-profile-form-390.png')});
      }
      if (route === '/uploads') {
        await page.click('.pg-accsec-btn.js-open-upload');
        assert(await page.$eval('.sc-publish-card', el => {
          const r = el.getBoundingClientRect();
          return r.height > 100 && r.left >= 0 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1;
        }), 'Upload dialog fits without clipping');
        await page.screenshot({path: path.join(out, 'after-upload-dialog-390.png')});
      }
    }
    signedIn = false;
    await page.goto(base, {waitUntil:'networkidle0'});
    await page.click('#navBurger');
    assert(await page.$eval('#navMobile', el => !el.hidden && el.getBoundingClientRect().right <= innerWidth), 'Mobile menu opens inside viewport');
    await page.keyboard.press('Escape');
    assert(await page.$eval('#navMobile', el => el.hidden), 'Escape closes menu');
    await page.evaluate(() => { localStorage.setItem('sc_theme', 'dark'); });
    await page.reload({waitUntil:'networkidle0'});
    await page.screenshot({path:path.join(out,'after-home-dark-390.png')});
    assert(await page.$eval('.sh-chip[aria-pressed=true]', el => getComputedStyle(el).color !== getComputedStyle(el).backgroundColor), 'Selected category has distinct foreground/background in dark theme');
    await page.goto(base + '/editor?tpl=original-chat-story', {waitUntil:'networkidle0'});
    await page.click('#edMobileEdit');
    await page.screenshot({path:path.join(out,'after-editor-dark-390.png')});
  }
  const overflow = results.filter(r => r.scrollWidth > r.width + 1);
  fs.writeFileSync(path.join(out, `${phase}.json`), JSON.stringify({results, interactions, errors}, null, 2));
  console.log(JSON.stringify({phase, checks: results.length, overflow, interactions, errors}, null, 2));
  assert.equal(overflow.length, 0, 'No document overflow');
  assert.equal(errors.length, 0, 'No page errors');
  } finally {
    await browser.close();
  }
})().catch(e => { console.error(e); process.exit(1); });
