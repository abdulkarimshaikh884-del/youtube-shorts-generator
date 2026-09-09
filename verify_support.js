/* Real support round trip, ownership checks and browser replies. All fixtures
   are identified by IDs created by this run and removed in finally. */
require("dotenv").config();
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs");
const puppeteer = require("puppeteer");
const auth = require("./auth");
const db = require("./db");
const BASE = process.env.BASE_URL || "http://localhost:3000";
const users = [];
const tickets = [];
let browser;
async function fixture(label) {
  const suffix = crypto.randomBytes(6).toString("hex");
  const headers = {};
  const response = { getHeader: key => headers[key.toLowerCase()], setHeader: (key, value) => { headers[key.toLowerCase()] = value; } };
  const result = await auth.signUp(response, `support-${suffix}@example.invalid`, "Support-test-password-23", `sup_${suffix}`);
  assert.ok(result.user, result.error);
  const user = { ...result.user, label, cookie: String(headers["set-cookie"]).split(";")[0] };
  users.push(user);
  return user;
}
async function call(user, method, route, body) {
  const r = await fetch(BASE + route, {
    method, headers: { "Content-Type": "application/json", ...(user ? { Cookie: user.cookie } : {}) },
    ...(body === undefined ? {} : { body: JSON.stringify(body) }), signal: AbortSignal.timeout(30000)
  });
  return { status: r.status, data: await r.json() };
}
function pass(label) { console.log("PASS " + label); }

(async () => {
  try {
    const owner = await fixture("owner");
    const other = await fixture("other");
    const staff = await fixture("staff");
    await db.query("update public.users set role = 'admin' where id = $1", [staff.id]);
    const made = await call(owner, "POST", "/api/support/tickets", {
      name: "Support QA", subject: "Export help", category: "export", message: "My exported video needs review. <script>bad()</script>"
    });
    assert.equal(made.status, 201);
    const id = made.data.ticket.id;
    tickets.push(id);
    pass("a real ticket is stored");
    assert.equal((await call(other, "GET", `/api/support/tickets/${id}`)).status, 404);
    assert.equal((await call(other, "POST", `/api/support/tickets/${id}/messages`, { message: "Unauthorized reply" })).status, 404);
    assert.equal((await call(null, "GET", `/api/support/tickets/${id}`)).status, 401);
    assert.equal((await call(owner, "GET", "/api/support/tickets/not-a-uuid")).status, 404);
    pass("guests, other accounts and malformed IDs cannot access the ticket");
    const replied = await call(staff, "POST", `/api/support/tickets/${id}/messages`, { message: "Please try exporting again.\nYour credits were returned." });
    assert.equal(replied.status, 201);
    assert.equal(replied.data.ticket.status, "waiting_on_user");
    const notifications = await call(owner, "GET", "/api/notifications");
    assert.ok(notifications.data.notifications.some(n => n.entityId === id && n.type === "support_reply"));
    pass("admin reply persists and notifies the owner");

    browser = await puppeteer.launch({ headless: true });
    const page = await browser.newPage();
    await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
    const split = owner.cookie.indexOf("=");
    await page.setCookie({ name: owner.cookie.slice(0, split), value: owner.cookie.slice(split + 1), url: BASE });
    const errors = [];
    page.on("pageerror", e => errors.push(e.message));
    await page.goto(BASE + `/contact?ticket=${id}#supportHistory`, { waitUntil: "networkidle2" });
    await page.waitForSelector("#supportReply", { timeout: 30000 });
    const conversation = await page.$eval("#supportConversation", el => el.textContent);
    assert.match(conversation, /Please try exporting again/);
    assert.match(conversation, /<script>bad\(\)<\/script>/);
    assert.equal(await page.$eval("#supportConversation", el => el.querySelectorAll("script").length), 0);
    await page.type("#supportReply", "The export works now, thank you.");
    await page.click(".sc-support-reply button");
    await page.waitForFunction(() => document.querySelector("#supportConversation").textContent.includes("The export works now, thank you."));
    await page.waitForFunction(() => {
      const list = document.querySelector("#supportTicketGrid");
      return list.textContent.includes("3 messages") && list.textContent.includes(" · open · ");
    });
    assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1), false);
    assert.deepEqual(errors, []);
    fs.mkdirSync("audit_results", { recursive: true });
    await page.screenshot({ path: "audit_results/support-mobile.png", fullPage: true });
    pass("mobile user reads, safely renders and sends a real reply");
    const stored = await call(owner, "GET", `/api/support/tickets/${id}`);
    assert.equal(stored.data.ticket.messages.length, 3);
    assert.equal(stored.data.ticket.status, "open");
    assert.equal((await call(staff, "PATCH", `/api/admin/support/tickets/${id}`, { status: "closed" })).status, 200);
    assert.equal((await call(owner, "POST", `/api/support/tickets/${id}/messages`, { message: "Should not reopen closed ticket" })).status, 409);
    await page.reload({ waitUntil: "networkidle2" });
    await page.waitForFunction(() => document.querySelector("#supportConversation")?.textContent.includes("This ticket is closed"));
    assert.equal(await page.$("#supportReply"), null);
    pass("closed ticket rejects replies on both API and page");
    console.log("SUPPORT=PASS");
  } finally {
    if (browser) await browser.close();
    await db.tx(async c => {
      if (tickets.length) {
        await c.query("delete from public.admin_audit_log where entity_type = 'support_ticket' and entity_id = any($1::text[])", [tickets]);
        await c.query("delete from public.notifications where entity_type = 'support_ticket' and entity_id = any($1::text[])", [tickets]);
        await c.query("delete from public.support_tickets where id = any($1::uuid[])", [tickets]);
      }
      for (const user of users) {
        await c.query("delete from public.credit_transactions where credit_key = $1", ["u:" + user.id]);
        await c.query("delete from public.credits where key = $1", ["u:" + user.id]);
        await c.query("delete from public.sessions where user_id = $1", [user.id]);
        await c.query("delete from public.users where id = $1", [user.id]);
      }
    });
    await db.getPool().end();
  }
})().catch(e => { console.error(e); process.exitCode = 1; });
