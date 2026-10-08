"use strict";
// Execute the real generator with a read-only filesystem fixture. A regression
// must fail before any checked-in page can be overwritten by this test itself.
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const manual = ["admin.html", "designs.html", "account.html", "settings.html"];
const source = fs.readFileSync(path.join(root, "build_pages.js"), "utf8");

function run(missing) {
  const writes = [], logs = [];
  const readonly = Object.assign({}, fs, {
    existsSync(file) { return path.basename(file) === missing ? false : fs.existsSync(file); },
    writeFileSync(file) { writes.push(file); throw Error("Generator attempted to overwrite a manual page"); }
  });
  const plan = {perDay: 1, maxHeight: 480, monthlyCredits: 1, price: 0, starsPerMonth: 0, yearlyPrice: 0};
  vm.runInNewContext(source, {
    require(name) {
      if (name === "fs") return readonly;
      // The preservation test never needs a database-backed credit ledger.
      if (name === "./credits") return {PLANS: {free: plan, pro: plan, promax: plan}, COST: {export: 1, animate: 2}};
      return require(name);
    },
    __dirname: root,
    process: {argv: [process.execPath, "build_pages.js", ...manual]},
    console: {log(message) { logs.push(message); }}
  }, {filename: "build_pages.js", timeout: 10000});
  assert.deepEqual(writes, []);
  for (const file of manual) assert(logs.includes("kept hand-maintained public/" + file));
}

run();
assert.throws(() => run("admin.html"), /Missing canonical hand-maintained page: admin.html/);
const admin = fs.readFileSync(path.join(root, "public/admin.html"), "utf8");
assert.equal([...admin.matchAll(/data-admin-tab="([^"]+)"/g)].length, 14);
assert.match(admin, /href="\/admin\.css\?v=/);
assert.match(admin, /id="adminMobileTabSelect"/);
const designs = fs.readFileSync(path.join(root, "public/designs.html"), "utf8");
for (const id of ["modalStepError", "btnErrorTryAgain", "btnErrorUseAsImage", "btnErrorOpenPartial", "designSearch", "designsGrid"])
  assert.match(designs, new RegExp('id="' + id + '"'));
console.log("PASS manual Admin/Designs/account/settings pages survive scoped generator builds; missing canonical files fail safely, with 14 Admin tabs and Designs recovery controls retained.");
