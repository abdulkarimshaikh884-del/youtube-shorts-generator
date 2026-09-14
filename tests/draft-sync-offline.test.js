"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

async function run() {
  const requests = [], storage = new Map(), window = {};
  vm.runInNewContext(fs.readFileSync(path.join(__dirname, "../public/drafts-store.js"), "utf8"), {
    window, console, AbortController, setTimeout, clearTimeout,
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    fetch(url, options) {
      assert.equal(url, "/api/projects", "no test data may be published");
      return new Promise(resolve => requests.push({ resolve, options }));
    }
  });
  const store = window.SC_DRAFTS;
  const respond = (request, id) => request.resolve({ ok: true, json: async () => ({ success: true, projects: [{ id, name: id, clips: [], updatedAt: 1 }] }) });
  assert.equal(await store.sync(), false);
  assert.equal(requests.length, 0);
  store.setOwner({ id: "alice" });
  const a = store.sync();
  assert.equal(store.sync(), a, "concurrent callers await the same request");
  assert.equal(requests.length, 1);
  store.setOwner({ id: "bob" });
  const b = store.sync();
  assert.notEqual(a, b);
  respond(requests[0], "alice-private");
  assert.equal(await a, false, "old account response is discarded");
  assert.equal(storage.size, 0, "old data was not written into the new account");
  assert.equal(store.sync(), b, "old cleanup does not clear the new account's pending request");
  respond(requests[1], "bob-project");
  assert.equal(await b, true);
  assert.equal(store.list()[0].id, "bob-project");
  const last = store.sync();
  store.setOwner(null);
  store.setOwner({ id: "bob" });
  respond(requests[2], "stale-session");
  assert.equal(await last, false, "sign-out/sign-in invalidates an earlier response even for same account");
  assert.equal(store.list()[0].id, "bob-project");
  console.log("PASS: draft-sync request coalescing and account/session isolation (offline).");
}
run().catch(err => { console.error(err); process.exitCode = 1; });
