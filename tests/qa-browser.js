"use strict";
// Each QA launch owns a fresh profile. Never attaches to a user's browser.
const puppeteer = require("puppeteer");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");

async function removeOwnedProfile(profile) {
  const absolute = path.resolve(profile);
  const temporaryRoot = path.resolve(os.tmpdir());
  if (path.dirname(absolute) !== temporaryRoot || !path.basename(absolute).startsWith("shortscraft-ui-qa-")) {
    throw new Error("Refusing to remove an unowned browser profile.");
  }
  await fs.rm(absolute, {recursive:true,force:true,maxRetries:10,retryDelay:200});
}

async function launch(options = {}) {
  if (options.userDataDir) throw new Error("QA must not use an existing browser profile.");
  const profile = await fs.mkdtemp(path.join(os.tmpdir(), "shortscraft-ui-qa-"));
  let browser;
  try { browser = await puppeteer.launch({...options,userDataDir:profile,protocolTimeout:options.protocolTimeout || 60000}); }
  catch (error) {
    try { await removeOwnedProfile(profile); }
    catch (cleanupError) { console.warn("QA temp profile retained:", profile, cleanupError.message); }
    throw error;
  }
  const originalClose = browser.close.bind(browser);
  const browserProcess = browser.process();
  let closing;
  browser.close = function () {
    if (closing) return closing;
    closing = (async () => {
      let timer;
      try {
        await Promise.race([
          originalClose(),
          new Promise((_,reject)=>{timer=setTimeout(()=>reject(new Error("Owned QA browser close timed out")),10000);})
        ]);
      } catch (error) {
        // Only this launch's process may be terminated. No system-wide taskkill.
        if (browserProcess && browserProcess.exitCode === null && browserProcess.signalCode === null) browserProcess.kill();
        console.warn("QA browser cleanup:", error.message);
      } finally {
        clearTimeout(timer);
        try { await removeOwnedProfile(profile); }
        catch (error) {
          // A Windows renderer can briefly retain a file lock after close.
          // Leave the owned temp folder intact if retries fail; never touch ACLs.
          console.warn("QA temp profile retained:", profile, error.message);
        }
      }
    })();
    return closing;
  };
  return browser;
}

module.exports = {launch};
