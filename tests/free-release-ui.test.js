"use strict";
// Browser-only fixtures; never contacts a DB, gateway or real account.
const assert = require("node:assert/strict"), path = require("node:path"), fs = require("node:fs");
const {spawn} = require("node:child_process"), puppeteer = require("puppeteer");
const base = "http://127.0.0.1:3327", writes = [], errors = [];
const out = path.resolve(__dirname, "../audit_results/free-release-ui");
(async () => {
  const preview = spawn(process.execPath, ["tests/polish-preview-server.js"], {windowsHide: true, stdio: ["ignore", "pipe", "pipe"]});
  let browser;
  try {
    await new Promise((resolve, reject) => {
      const timer = setTimeout(() => reject(Error("QA preview startup timeout")), 10000);
      preview.stdout.on("data", d => {if(String(d).includes("database-free QA preview")) {clearTimeout(timer); resolve();}});
      preview.once("error", reject); preview.once("exit", code => {clearTimeout(timer); reject(Error("Preview exited " + code));});
    });
    fs.mkdirSync(out, {recursive: true});
    browser = await puppeteer.launch({headless: true, args: ["--no-sandbox"]});
    const page = await browser.newPage();
    page.on("pageerror", error => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", request => {
      const url = new URL(request.url());
      if (url.origin !== base) return request.abort();
      if (!url.pathname.startsWith("/api/")) return request.continue();
      if (request.method() !== "GET") writes.push(url.pathname);
      let data = {success: true, templates: [], notifications: [], projects: [], items: [], creations: [], reactions: {}, skills: []};
      if (url.pathname === "/api/auth/me") data.user = {id: "browser-fixture", handle: "free_ui_test", plan: "free", email: "fixture@example.invalid"};
      if (url.pathname === "/api/credits") data = {success: true, plan: "free", left: 5, perDay: 5, cost: {export: 1, animate: 2}};
      if (url.pathname === "/api/stars") data = {success: true, monetizationEnabled: false, allowance: 0, balance: 0, sent: 0, received: 0};
      if (url.pathname === "/api/stars/wallet") data = {success: true, monetizationEnabled: false, canWithdraw: true, availableStars: 100, history: []};
      // Even a stale readiness response cannot bypass this Free UI release.
      if (url.pathname === "/api/offer") data = {success: true, paymentsLive: true};
      return request.respond({status: 200, contentType: "application/json", body: JSON.stringify(data)});
    });
    let checks = 0;
    for (const width of [390, 1440]) {
      await page.setViewport({width, height: 900});
      await page.goto(base + "/pricing", {waitUntil: "networkidle0"});
      const buttons = await page.$$eval(".pg-buy,.pg-buy-stars", els => els.map(el => ({disabled: el.disabled, text: el.textContent})));
      assert.equal(buttons.length, 6);
      assert(buttons.every(b => b.disabled && /Coming Soon/.test(b.text))); checks += 6;
      await page.evaluate(() => document.querySelectorAll(".pg-buy,.pg-buy-stars").forEach(el => el.click()));
      await page.screenshot({path: path.join(out, "pricing-" + width + ".png"), fullPage: true});
      await page.goto(base + "/account#stars", {waitUntil: "networkidle0"});
      assert(await page.$eval("#requestPayoutBtn", el => el.disabled && /Coming Soon/.test(el.textContent)));
      assert(await page.$eval("#payoutUpiInput", el => el.disabled));
      assert(await page.$eval("#payoutStarsInput", el => el.disabled)); checks += 3;
      await page.evaluate(() => {document.querySelector("#requestPayoutBtn").click(); document.querySelector("#accountBuyStarsBtn").click();});
      await page.screenshot({path: path.join(out, "account-" + width + ".png"), fullPage: true});
    }
    assert.deepEqual(writes, []); assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, "evidence.json"), JSON.stringify({testedAt: new Date().toISOString(), checks, writes, errors, boundary: "Isolated browser fixtures, not production/payment certification"}, null, 2));
    console.log("PASS Free UI: " + checks + " mobile/desktop money controls; zero mutation requests or page errors.");
  } finally {if(browser) await browser.close(); preview.kill();}
})().catch(error => {console.error(error); process.exitCode = 1;});
