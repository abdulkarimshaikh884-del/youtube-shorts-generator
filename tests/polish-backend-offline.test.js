"use strict";
// No dotenv, database connection, HTTP request or gateway call. Real modules
// run against an in-memory transaction adapter; PostgreSQL integration is separate.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
function load(file, deps) {
  const module = { exports: {} };
  vm.runInNewContext(fs.readFileSync(path.join(root, file), "utf8"), {
    module, exports: module.exports, __dirname: root, console, Buffer,
    process: { env: {} },
    require(name) {
      if (Object.hasOwn(deps, name)) return deps[name];
      if (["crypto", "fs", "path"].includes(name)) return require(name);
      throw new Error("Unexpected dependency: " + name);
    }
  }, { filename: file });
  return module.exports;
}

async function run() {
  let state = { receipts: [], user: { plan: "free" }, credit: null, ledger: [] };
  let failure = "";
  const db = {
    query() { throw new Error("Unexpected nontransactional write"); },
    async tx(fn) {
      const draft = structuredClone(state);
      const client = { async query(sql, p) {
        if (sql.includes("pg_advisory_xact_lock")) return { rows: [] };
        if (sql.startsWith("select * from public.processed_payments")) {
          return { rows: draft.receipts.filter(r => r.payment_id === p[0] || r.order_id === p[1]) };
        }
        if (sql.includes("insert into public.processed_payments")) {
          draft.receipts.push({ payment_id: p[0], order_id: p[1], user_id: p[2], plan: p[3], term: p[4], amount_paise: p[5] });
          return { rows: [] };
        }
        if (sql.includes("update public.users")) {
          if (failure === "missing-account") return { rowCount: 0 };
          draft.user = { plan: p[1], until: p[2] };
          return { rowCount: 1 };
        }
        if (sql.startsWith("select * from public.credits")) return { rows: draft.credit ? [draft.credit] : [] };
        if (sql.includes("insert into public.credits")) {
          draft.credit = { key: p[0], day: p[1], plan: p[2], left_credits: p[3], spent: 0, since: p[4] };
          return { rows: [draft.credit] };
        }
        if (sql.includes("insert into public.credit_transactions")) {
          draft.ledger.push(p);
          return { rows: [] };
        }
        if (sql.includes("update public.credits set plan")) {
          if (failure === "credits") throw new Error("Simulated credit write failure");
          draft.credit.plan = p[1]; draft.credit.left_credits = p[2];
          return { rowCount: 1 };
        }
        throw new Error("Unexpected SQL: " + sql);
      } };
      const result = await fn(client);
      state = draft;
      return result;
    }
  };
  const auth = load("auth.js", { "./db": db, "./permissions": require("../permissions"), sharp: () => { throw Error("No image processing in test"); } });
  const credits = load("credits.js", { "./db": db });
  const delivery = load("payment-delivery.js", { "./db": db, "./auth": auth, "./credits": credits });
  const req = { user: { id: "owner", plan: "free" }, credits: { key: "u:owner" } };
  const payment = { paymentId: "pay_test", orderId: "order_test", planId: "pro", term: "month", amount: 19900 };
  failure = "credits";
  await assert.rejects(delivery.deliver(req, payment), /credit write failure/);
  assert.equal(state.receipts.length, 0, "failure does not retain receipt");
  assert.equal(state.user.plan, "free", "failure rolls back plan");
  assert.equal(state.ledger.length, 0, "failure rolls back credit grant ledger");
  failure = "missing-account";
  await assert.rejects(delivery.deliver(req, payment), /no longer exists/);
  assert.equal(state.receipts.length, 0);
  failure = "";
  assert.equal((await delivery.deliver(req, payment)).alreadyProcessed, false);
  assert.equal(state.user.plan, "pro");
  assert.equal(state.credit.left_credits, credits.PLANS.pro.perDay);
  assert.equal(state.ledger.length, 1);
  const delivered = structuredClone(state);
  assert.equal((await delivery.deliver(req, payment)).alreadyProcessed, true);
  assert.equal((await delivery.deliver(req, { ...payment, paymentId: "pay_retry" })).alreadyProcessed, true);
  assert.deepEqual(state, delivered, "replays do not refill credits or move plan expiry");
  await assert.rejects(delivery.deliver({ ...req, user: { id: "other" } }, payment), /does not match/);
  await assert.rejects(delivery.deliver(req, { ...payment, amount: 1 }), /does not match/);
  assert.deepEqual(state, delivered);

  let reads = 0;
  const ownerDb = { async query(sql, p) {
    reads++;
    assert.match(sql, /ct\.id = \$1 and ct\.author_id = \$2/);
    return { rows: p[0] === "comm_private" && p[1] === "owner"
      ? [{ id: p[0], author_id: "owner", tpl: "ui-tabs", status: "private", props: { heading: "Mine" }, aspect: "16:9" }] : [] };
  } };
  // community.js also checks Lottie uploads before publishing; owner lookups
  // never reach it, so a stub that would refuse is enough here.
  const community = load("community.js", { "./db": ownerDb, "./lottie": { assertPublishable: async () => ({ error: "not used in this test" }) } });
  assert.equal(await community.getOwned("comm_private", null), null);
  assert.equal(reads, 0, "guest lookup never reaches storage");
  assert.equal(await community.getOwned("comm_private", { id: "other" }), null);
  const own = await community.getOwned("comm_private", { id: "owner" });
  assert.equal(own.status, "private");
  assert.equal(own.aspect, "16:9");
  assert.equal(own.props.heading, "Mine");

  const server = fs.readFileSync(path.join(root, "server.js"), "utf8");
  let handler;
  const route = server.slice(server.indexOf('app.get("/api/user/creations/:id"'), server.indexOf('app.delete("/api/user/creations/:id"'));
  vm.runInNewContext(route, { app: { get: (_, fn) => { handler = fn; } }, community, console });
  const response = () => ({ code: 200, headers: {}, set(k, v) { this.headers[k] = v; }, status(n) { this.code = n; return this; }, json(body) { this.body = body; return this; } });
  for (const [user, expected] of [[null, 401], [{ id: "other" }, 404], [{ id: "owner" }, 200]]) {
    const res = response();
    await handler({ user, params: { id: "comm_private" } }, res);
    assert.equal(res.code, expected);
    assert.equal(res.headers["Cache-Control"], "private, no-store");
  }
  assert.match(server, /await paymentDelivery\.deliver\(req/);
  console.log("PASS: atomic delivery rollback/retry, duplicate payment/order, recipient checks, real auth/credit executor wiring, owner-only retrieval and HTTP handler (isolated).");
}
run().catch(err => { console.error(err); process.exitCode = 1; });
