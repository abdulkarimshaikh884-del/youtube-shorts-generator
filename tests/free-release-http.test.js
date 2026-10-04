"use strict";
// Full Express + real auth + dedicated local PG only. No live writes/providers.
const assert = require("node:assert/strict"), db = require("../db");
const url = new URL(process.env.DATABASE_URL);
assert.equal(process.env.SC_ISOLATED_POSTGRES_QA, "true");
assert.equal(url.hostname, "127.0.0.1"); assert.equal(url.port, "55437"); assert.equal(url.pathname, "/shortscraft_qa");
const base = process.env.BASE_URL;
assert.equal(new URL(base).hostname, "127.0.0.1");
const users = [];
const stamp = Date.now().toString(36);
async function request(path, cookie, body) {
  const response = await fetch(base + path, {method: body ? "POST" : "GET", headers: {"Content-Type": "application/json", ...(cookie ? {Cookie: cookie} : {})}, ...(body ? {body: JSON.stringify(body)} : {})});
  return {status: response.status, body: await response.json(), cookie: response.headers.getSetCookie().map(c => c.split(";")[0]).join("; ")};
}
(async () => {
  try {
    const config = await request("/api/config");
    assert.equal(config.body.release.monetizationEnabled, false);
    assert.equal(config.body.services.payments, false);
    assert.equal(config.body.razorpayKeyId, "");
    assert.equal((await request("/api/offer")).body.paymentsLive, false);
    assert.equal((await request("/api/stars/packs")).body.available, false);
    for (const suffix of ["member", "owner"]) {
      const signup = await request("/api/auth/signup", null, {email: `free_release_${stamp}_${suffix}@example.invalid`, password: "LocalQA-only-9374!", handle: `fr_${stamp}_${suffix}`});
      assert.equal(signup.status, 200, JSON.stringify(signup.body));
      users.push({id: signup.body.user.id, cookie: signup.cookie, role: suffix});
    }
    await db.query("update public.users set role='super_admin' where id=$1", [users[1].id]);
    const paths = ["/api/razorpay/order", "/api/razorpay/verify", "/api/stars/purchase/order", "/api/stars/purchase/verify", "/api/stars/donate", "/api/stars/withdraw", "/api/admin/withdrawals/record/process", "/api/admin/stars/transactions/record/reverse", "/api/admin/star-packs", `/api/admin/users/${users[0].id}/balance`];
    const ledgerBefore = (await db.query("select count(*)::int as count from public.star_transactions")).rows[0].count;
    for (const path of paths) {
      for (const actor of [null, ...users]) {
        const out = await request(path, actor?.cookie, {type: "stars", delta: 5, amount: 2, userId: users[0].id});
        const expected = !actor ? 401 : path.includes("/admin/") && actor.role === "member" ? 403 : 503;
        assert.equal(out.status, expected, path + " " + actor?.role + " " + JSON.stringify(out.body));
        if (expected === 503) assert.equal(out.body.code, "MONETIZATION_COMING_SOON");
      }
    }
    const wallet = await request("/api/stars/wallet", users[0].cookie);
    assert.equal(wallet.status, 200); assert.equal(wallet.body.canWithdraw, false);
    assert.equal((await db.query("select count(*)::int as count from public.star_transactions")).rows[0].count, ledgerBefore);
    console.log("PASS Full Free release HTTP: config/offer/packs, 30 real auth/permission/503 checks, wallet read-only, Star ledger unchanged (local PG17). No gateway call permitted.");
  } finally {
    for (const user of users) {
      await db.query("delete from public.sessions where user_id=$1", [user.id]);
      await db.query("delete from public.users where id=$1", [user.id]);
    }
    await db.getPool().end();
  }
})().catch(error => { console.error(error); process.exitCode = 1; });
