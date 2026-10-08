"use strict";
// Sequential by design: these DB-free suites own the same preview port.
// Never substitutes for production auth, billing, storage or rendering tests.
const {spawn} = require("node:child_process");
const path = require("node:path");
const fs = require("node:fs");
const root = path.resolve(__dirname,"..");
const files = [
  "tests/home-certification-qa.js",
  "tests/forms-certification-qa.js",
  "tests/primary-button-contrast-qa.js",
  "tests/release-interactions-qa.js",
  "tests/run-polish-browser-qa.js"
];
(async () => {
  const suites = [];
  for (const file of files) {
    console.log("Running DB-free suite: " + file);
    const started = Date.now();
    try {
      await new Promise((resolve,reject) => {
        const child = spawn(process.execPath,[file],{cwd:root,windowsHide:true,stdio:"inherit"});
        child.once("error",reject);
        child.once("close",code=>code===0?resolve():reject(Error(file+" exited "+code)));
      });
      suites.push({file,status:"PASS",durationMs:Date.now()-started});
    } catch (error) {
      suites.push({file,status:"FAIL",error:error.message,durationMs:Date.now()-started});
      console.error(error.message);
    }
  }
  const evidence = {scope:"DB-free browser fixtures only; not production feature approval",finishedAt:new Date().toISOString(),suites};
  fs.mkdirSync(path.join(root,"audit_results"),{recursive:true});
  fs.writeFileSync(path.join(root,"audit_results/release-ui-evidence.json"),JSON.stringify(evidence,null,2));
  console.log(JSON.stringify(evidence,null,2));
  if (suites.some(suite=>suite.status === "FAIL")) process.exitCode = 1;
  else console.log("PASS: isolated release UI suites. Production/backend release gates remain separate.");
})().catch(error=>{console.error(error.message);process.exitCode=1;});
