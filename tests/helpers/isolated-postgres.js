"use strict";
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const os = require("node:os");
const {execFileSync} = require("node:child_process");

function assertIsolatedPostgres() {
  const folder = process.env.SC_QA_PORTABLE_PG;
  if (folder) {
    const absolute = fs.realpathSync(folder);
    assert.equal(path.dirname(absolute), fs.realpathSync(os.tmpdir()));
    assert.match(path.basename(absolute), /^shortscraft-launch-pg-[a-f0-9]{32}$/);
    const marker = JSON.parse(fs.readFileSync(path.join(absolute, "qa-owner.json"), "utf8"));
    assert.equal(marker.purpose, "shortscraft-isolated-qa");
    assert.equal(marker.folder, absolute);
    const data = fs.realpathSync(path.join(absolute, "data"));
    const ctl = path.join(absolute, "runtime/bin/pg_ctl.exe");
    execFileSync(ctl, ["status", "-D", data], {windowsHide:true, stdio:"pipe"});
    const opts = fs.readFileSync(path.join(data, "postmaster.opts"), "utf8");
    assert.match(opts, /127\.0\.0\.1/);
    assert.match(opts, /55437/);
    return {kind:"portable", folder:absolute};
  }
  const own = JSON.parse(execFileSync("docker", ["inspect", "shortscraft-qa-pg17-20261002"], {encoding:"utf8",windowsHide:true}))[0];
  assert.equal(own.Config.Labels["shortscraft.qa"], "true");
  assert.equal(own.State.Running, true);
  assert.deepEqual(own.HostConfig.PortBindings["5432/tcp"], [{HostIp:"127.0.0.1",HostPort:"55437"}]);
  return {kind:"docker"};
}
module.exports = {assertIsolatedPostgres};
