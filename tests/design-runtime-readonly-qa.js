"use strict";
// Actual running local app + its configured database, READ ONLY. No cloning,
// publishing, conversion, credit charge or save requests are allowed here.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const puppeteer = require("puppeteer");
(async () => {
  require('dotenv').config({quiet:true});
  const db = require('../db');
  try {
    const access = (await db.query("select current_user, has_table_privilege(current_user,'public.design_assets','INSERT') as asset_insert, has_table_privilege(current_user,'public.design_assets','SELECT') as asset_read, has_table_privilege(current_user,'public.design_projects','INSERT,UPDATE') as project_write")).rows[0];
    assert.equal(access.asset_insert,true); assert.equal(access.asset_read,true); assert.equal(access.project_write,true);
    console.log('PASS configured application role has asset/project DML privileges (SELECT-only check; schema CREATE is not required).');
  } finally { await db.getPool().end(); }
  const base = "http://127.0.0.1:3000";
  const response = await fetch(base + "/api/designs/templates");
  assert(response.ok);
  const data = await response.json();
  const heygen = data.templates.find(t=>t.id==="dt_heygen_trick");
  assert.equal(heygen.elements.length,14);
  assert.equal(heygen.canvas.width,1024);
  const unavailable = data.templates.filter(t=>t.editable===false);
  assert.equal(unavailable.length,0,'Known legacy built-ins must recover actual matching artwork layers');
  const browser = await puppeteer.launch({headless:true});
  const blockedWrites = [], errors = [];
  try {
    const page = await browser.newPage();
    await page.setRequestInterception(true);
    page.on('pageerror',e=>errors.push(e.message));
    page.on('request',req=>{
      if(!['GET','HEAD'].includes(req.method())) { blockedWrites.push(new URL(req.url()).pathname); return req.abort(); }
      req.continue();
    });
    fs.mkdirSync('audit_results/designs',{recursive:true});
    for(const width of [1440,390]) {
      await page.setViewport({width,height:900,isMobile:width===390,hasTouch:width===390});
      await page.goto(base+'/designs',{waitUntil:'networkidle2'});
      await page.waitForSelector('#design-dt_heygen_trick');
      assert(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth));
      assert.equal(await page.$$('.ds-card-menu-trigger').then(a=>a.length),data.templates.length);
      assert.equal(await page.$$('.ds-card-unavailable').then(a=>a.length),unavailable.length);
      await page.click('#design-dt_heygen_trick .ds-card-open');
      await page.waitForFunction(()=>document.querySelector('.ds-preview-dialog img')?.naturalWidth>0);
      assert(await page.$('.ds-preview-edit'));
      await page.screenshot({path:`audit_results/designs/runtime-preview-${width}.png`});
      await page.keyboard.press('Escape');
      await page.waitForFunction(()=>!document.querySelector('.ds-preview-dialog'));
      await page.click('#design-dt_heygen_trick .ds-card-menu-trigger');
      assert(await page.$('.ds-design-menu [data-action="edit"]'));
      await page.keyboard.press('Escape');
      await page.screenshot({path:`audit_results/designs/runtime-gallery-${width}.png`});
      console.log(`PASS actual :3000 gallery, restored 14 HeyGen layers, preview, options, unavailable labels, ${width}px; no write requests.`);
    }
    assert.deepEqual(blockedWrites,[]);
    assert.deepEqual(errors,[]);
    fs.writeFileSync('audit_results/designs/runtime-readonly-evidence.json',JSON.stringify({testedAt:new Date().toISOString(),heygenLayers:heygen.elements.length,unavailableTemplateIds:unavailable.map(t=>t.id),blockedWrites,errors,boundary:'Actual app/database reads only. Full edit roundtrip and conversion persistence exercised separately with isolated transport/database fixtures; no real AI-provider or production write certification.'},null,2));
  } finally { await browser.close(); }
})().catch(err=>{console.error(err);process.exitCode=1;});
