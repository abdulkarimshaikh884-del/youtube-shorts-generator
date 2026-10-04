"use strict";
// Own the DB-free preview for the test run; never start the real app server.
const { spawn } = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const preview = spawn(process.execPath, ["tests/polish-preview-server.js"], { cwd: root, windowsHide: true, stdio: ["ignore", "pipe", "pipe"] });
function run(file) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [file], { cwd: root, windowsHide: true, stdio: "inherit" });
    child.once("error", reject);
    child.once("exit", code => code === 0 ? resolve() : reject(new Error(file + " exited " + code)));
  });
}
(async () => {
  try {
    await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(Error("QA preview startup timeout")), 10000);
      preview.stdout.on("data", chunk => { if (String(chunk).includes("database-free QA preview")) { clearTimeout(timeout); resolve(); } });
      preview.stderr.on("data", chunk => process.stderr.write(chunk));
      preview.once("error", err => { clearTimeout(timeout); reject(err); });
      preview.once("exit", code => { clearTimeout(timeout); reject(Error("QA preview exited " + code)); });
    });
    for (const file of ["tests/mobile-layout-qa.js", "tests/design-mobile-qa.js", "tests/admin-release-qa.js", "tests/account-published-templates.test.js"]) await run(file);
  } finally { preview.kill(); }
})().catch(err => { console.error(err); process.exitCode = 1; });
