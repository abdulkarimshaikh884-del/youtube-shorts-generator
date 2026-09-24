"use strict";
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const fs = require("node:fs/promises");
const os = require("node:os");
const path = require("node:path");
const db = require("../db");
const assets = require("../design-assets");

(async () => {
  const jobId = `job_${crypto.randomBytes(16).toString("hex")}`;
  const dir = path.join(os.tmpdir(), "shortscraft-design-conversion", jobId);
  const records = [];
  const oldTx = db.tx;
  const oldQuery = db.query;
  try {
    await fs.mkdir(path.join(dir, "assets"), { recursive: true });
    await fs.writeFile(path.join(dir, "original.webp"), Buffer.from("original"));
    await fs.writeFile(path.join(dir, "assets", "background.webp"), Buffer.from("background"));
    db.tx = async (fn) => fn({ query: async (_sql, params) => { records.push(params); return { rowCount: 1 }; } });
    db.query = async (_sql, params) => ({ rows: records
      .filter((r) => r[0] === params[0] && r[1] === params[1] && params[2] === "owner")
      .map((r) => ({ content: r[3], byte_size: r[4], is_public: false })) });
    const persisted = await assets.persistJob("owner", jobId);
    assert.equal(persisted.count, 2);
    assert.equal(records.length, 2);
    await assert.rejects(fs.stat(dir), { code: "ENOENT" });
    assert.equal((await assets.getAsset("owner", jobId, "assets/background.webp")).content.toString(), "background");
    assert.equal(await assets.getAsset("other", jobId, "assets/background.webp"), null);
    assert.equal(await assets.getAsset("owner", jobId, "../original.webp"), null);
    assert.deepEqual(assets.jobIdsFromElements([{ src: `/api/design-assets/${jobId}/assets/background.webp` }]), [jobId]);
    let publicCount = 0;
    await assets.makePublic({ query: async (_sql, params) => { assert.equal(params[1], "owner"); publicCount++; return { rowCount: 2 }; } }, "owner", [{ src: `/api/design-assets/${jobId}/original.webp` }]);
    assert.equal(publicCount, 1);
    console.log("PASS durable design assets: commit before response, owner scope, path validation, public promotion.");
  } finally {
    db.tx = oldTx;
    db.query = oldQuery;
    await fs.rm(dir, { recursive: true, force: true });
  }
})().catch((error) => { console.error(error); process.exitCode = 1; });
