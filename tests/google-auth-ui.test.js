"use strict";
const puppeteer = require("puppeteer");
const assert = require("node:assert/strict");
const fs = require("node:fs");
(async () => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    let enabled = true, destination;
    const errors = [];
    page.on("pageerror", err => errors.push(err.message));
    await page.setRequestInterception(true);
    page.on("request", r => {
      const url = new URL(r.url());
      if (url.pathname === "/api/auth/google/config") return r.respond({ status: 200, contentType: "application/json", body: JSON.stringify({ enabled }) });
      if (url.pathname === "/api/auth/google") { destination = url; return r.respond({status:200,contentType:"text/html",body:"Offline Google redirect test"}); }
      if (url.pathname.startsWith("/api/")) return r.respond({ status:200,contentType:"application/json",body:JSON.stringify({ success:true,user:null }) });
      if (url.origin !== "http://127.0.0.1:3327" || r.method() !== "GET") return r.abort();
      r.continue();
    });
    fs.mkdirSync("audit_results/google-auth", { recursive:true });
    for (const width of [390,1440]) for (const theme of ["light","dark"]) for (const route of ["login","signup"]) {
      await page.setViewport({ width,height:900 });
      await page.goto("http://127.0.0.1:3327/" + route + "?next=%2Feditor", { waitUntil:"networkidle0" });
      await page.evaluate(t => document.documentElement.dataset.theme = t, theme);
      assert.equal(await page.$eval("[data-google-signin]", el => el.disabled), false);
      assert.equal(await page.$eval("#authSend", el => el.disabled), false);
      assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
      await page.screenshot({path:`audit_results/google-auth/${route}-${theme}-${width}.png`});
      await Promise.all([page.waitForNavigation(),page.click("[data-google-signin]")]);
      assert.equal(destination.searchParams.get("next"), "/editor");
      console.log(`PASS Google button ${route} ${theme} ${width}`);
    }
    enabled = false;
    await page.goto("http://127.0.0.1:3327/login",{waitUntil:"networkidle0"});
    assert(await page.$eval("[data-google-signin]", el => el.disabled));
    assert.match(await page.$eval("[data-google-status]", el=>el.textContent), /not available/);
    assert.equal(await page.$eval("#authSend", el => el.disabled),false);
    enabled = true;
    await page.goto("http://127.0.0.1:3327/login?google_error=link_required",{waitUntil:"networkidle0"});
    assert.match(await page.$eval("[data-google-status]", el=>el.textContent), /connect Google in Settings/);
    assert.deepEqual(errors,[]);
    console.log("PASS unavailable and existing-account guidance; password form unaffected.");
  } finally { await browser.close(); }
})().catch(err => { console.error(err); process.exitCode=1; });
