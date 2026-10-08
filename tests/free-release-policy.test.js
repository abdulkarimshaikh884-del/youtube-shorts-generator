"use strict";
// Real HTTP middleware + isolated DB stubs: no production data/providers.
const assert = require("node:assert/strict");
const express = require("express");
const policy = require("../release-policy");
const db = require("../db");
const social = require("../social");
let writes = 0, queries = 0, routeCalls = 0;
const user = { id: "free-release-test", role: "super_admin", plan: "free" };
const app = express();
app.use(express.json());
app.use((req, res, next) => { req.user = req.headers["x-test-role"] ? {...user, role: req.headers["x-test-role"]} : null; next(); });
app.use(policy.middleware);
app.use((req, res) => { routeCalls++; res.json({success: true}); });
const paths = ["/api/auth/star", "/api/razorpay/order", "/api/razorpay/verify", "/api/stars/purchase/order", "/api/stars/purchase/verify", "/api/stars/donate", "/api/stars/withdraw", "/api/admin/withdrawals/record/process", "/api/admin/stars/transactions/record/reverse", "/api/admin/star-packs", "/api/admin/users/member/balance"];
(async () => {
  assert.equal(policy.monetizationEnabled, false);
  const server = app.listen(0, "127.0.0.1");
  await new Promise(resolve => server.once("listening", resolve));
  try {
    const base = "http://127.0.0.1:" + server.address().port;
    for (const path of paths) {
      for (const role of [null, "user", "super_admin"]) {
        const response = await fetch(base + path, {method: "POST", headers: {"Content-Type": "application/json", ...(role ? {"x-test-role": role} : {})}, body: JSON.stringify({type: "stars"})});
        const expected = !role ? 401 : path.includes("/admin/") && role === "user" ? 403 : 503;
        assert.equal(response.status, expected, path + " / " + role);
        if (expected === 503) assert.equal((await response.json()).code, "MONETIZATION_COMING_SOON");
      }
    }
    assert.equal(routeCalls, 0, "No financial route executed");
    for (const path of ["/api/projects", "/api/stars/wallet", "/api/admin/stars/ledger"]) assert.equal((await fetch(base + path)).status, 200);
    assert.equal((await fetch(base + "/api/admin/users/member/balance", {method: "POST", headers: {"Content-Type": "application/json", "x-test-role": "super_admin"}, body: '{"type":"credits"}'})).status, 200);

    // Paid unlock guard must not revoke free, creator or existing buyer rights.
    let template = {id: "template", category: "text", author_id: "creator", props: {}};
    let owned = false;
    db.query = async sql => { queries++; return {rows: sql.includes("community_templates") ? [template] : owned ? [{id: "existing-unlock"}] : []}; };
    db.tx = async () => { writes++; throw Error("Financial write attempted"); };
    assert.equal((await social.unlockTemplate(user, "template")).free, true);
    template = {...template, props: {isPremium: true, starPrice: 2}};
    assert.equal((await social.unlockTemplate({...user, id: "creator"}, "template")).isAuthor, true);
    owned = true;
    assert.equal((await social.unlockTemplate(user, "template")).alreadyUnlocked, true);
    owned = false;
    assert.equal((await social.unlockTemplate(user, "template")).code, "MONETIZATION_COMING_SOON");
    assert.equal((await social.unlockTemplate(null, "template")).status, 401);
    assert.equal(writes, 0);
    console.log("PASS Free release: 33 HTTP auth/Coming Soon cases including legacy donation alias; reads and free/owned/unlocked access preserved; zero financial route calls/writes (isolated stubs). Queries: " + queries);
  } finally { await new Promise(resolve => server.close(resolve)); }
})().catch(error => { console.error(error); process.exitCode = 1; });
