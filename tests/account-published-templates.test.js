"use strict";
// Database-free regression check. Start polish-preview-server.js first.
const assert = require("node:assert/strict");
const puppeteer = require("puppeteer");

(async () => {
  const browser = await puppeteer.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const errors = [];
    page.on("pageerror", (error) => errors.push(error.message));
    await page.setRequestInterception(true);
    page.on("request", (request) => {
      const url = new URL(request.url());
      if (url.pathname === "/api/auth/me") {
        return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({
          success: true,
          user: { id: "test-house", handle: "shortscraft", email: "house@example.test", displayName: "ShortsCraft Official", plan: "free" }
        }) });
      }
      if (url.pathname === "/api/user/creations") {
        return request.respond({ status: 200, contentType: "application/json", body: JSON.stringify({
          success: true,
          creations: [
            { id: "new-upload", tpl: "text-cascade", title: "New upload", status: "published" },
            { id: "private-work", tpl: "text-cascade", title: "Private work", status: "draft" },
            { id: "future-work", tpl: "text-cascade", title: "Future work", status: "scheduled" },
            { id: "old-work", tpl: "text-cascade", title: "Old work", status: "archived" },
            { id: "rejected-work", tpl: "text-cascade", title: "Rejected work", status: "rejected" }
          ]
        }) });
      }
      if (url.pathname.startsWith("/api/")) {
        return request.respond({ status: 200, contentType: "application/json", body: "{}" });
      }
      if (!['GET', 'HEAD'].includes(request.method())) return request.abort();
      request.continue();
    });

    for (const width of [390, 1440]) {
      await page.setViewport({ width, height: 850, isMobile: width < 768, hasTouch: width < 768 });
      await page.goto("http://127.0.0.1:3327/account/creations", { waitUntil: "networkidle2" });
      await page.waitForFunction(() => document.querySelectorAll("#userCreationsGrid .cr-cre-card").length > 5);
      const result = await page.evaluate(() => {
        const cards = [...document.querySelectorAll("#userCreationsGrid .cr-cre-card")];
        const byTitle = (title) => cards.find((card) => card.querySelector(".cr-cre-title")?.textContent === title);
        return {
          builtIns: window.SC_TPL2.list().length,
          total: cards.length,
          published: cards.filter((card) => card.querySelector(".cr-cre-state")?.textContent === "Published").length,
          libraryLabels: cards.filter((card) => card.querySelector(".cr-cre-state")?.textContent === "Library").length,
          section: !!document.querySelector("#userCreationsGrid .cr-cre-section"),
          newUpload: byTitle("New upload")?.querySelector(".cr-cre-state")?.textContent,
          privateWork: byTitle("Private work")?.querySelector(".cr-cre-state")?.textContent,
          futureWork: byTitle("Future work")?.querySelector(".cr-cre-state")?.textContent,
          oldWork: byTitle("Old work")?.querySelector(".cr-cre-state")?.textContent,
          rejectedWork: byTitle("Rejected work")?.querySelector(".cr-cre-state")?.textContent,
          deletableBuiltIns: cards.filter((card) => card.classList.contains("is-library") && card.querySelector(".cr-cre-del")).length
        };
      });
      assert.equal(result.total, result.builtIns + 5);
      assert.equal(result.published, result.builtIns + 1);
      assert.equal(result.libraryLabels, 0);
      assert.equal(result.section, false);
      assert.equal(result.newUpload, "Published");
      assert.equal(result.privateWork, "Draft");
      assert.equal(result.futureWork, "Scheduled");
      assert.equal(result.oldWork, "Archived");
      assert.equal(result.rejectedWork, "Rejected");
      assert.equal(result.deletableBuiltIns, 0);
      console.log(`PASS account ${width}px: ${result.builtIns} built-ins published alongside uploads; nonpublic states preserved`);
    }
    assert.deepEqual(errors, []);
  } finally {
    await browser.close();
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
