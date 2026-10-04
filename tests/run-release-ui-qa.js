"use strict";
// Sequential by design: these DB-free suites own the same preview port.
// Never substitutes for production auth, billing, storage or rendering tests.
const {spawn} = require("node:child_process");
const path = require("node:path");
const root = path.resolve(__dirname,"..");
const files = [
  "tests/home-certification-qa.js",
  "tests/forms-certification-qa.js",
  "tests/primary-button-contrast-qa.js",
  "tests/release-interactions-qa.js",
  "tests/run-polish-browser-qa.js"
];
(async () => {
  for (const file of files) {
    console.log("Running DB-free suite: " + file);
    await new Promise((resolve,reject) => {
      const child = spawn(process.execPath,[file],{cwd:root,windowsHide:true,stdio:"inherit"});
      child.once("error",reject);
      child.once("close",code=>code===0?resolve():reject(Error(file+" exited "+code)));
    });
  }
  console.log("PASS: isolated release UI suites. Production/backend release gates remain separate.");
})().catch(error=>{console.error(error.message);process.exitCode=1;});
