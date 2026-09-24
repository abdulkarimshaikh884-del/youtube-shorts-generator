/* Durable, owner-scoped storage for generated design layers. Conversion may
   use temporary files, but a successful API response is only sent after all
   files have been committed to Postgres. */
const fs = require("fs/promises");
const os = require("os");
const path = require("path");
const db = require("./db");

const ROOT = path.join(os.tmpdir(), "shortscraft-design-conversion");
const JOB_RE = /^job_[a-f0-9]{32}$/;
const ASSET_RE = /^(?:original\.webp|assets\/[a-zA-Z0-9_-]+\.webp)$/;
const MAX_JOB_BYTES = 12 * 1024 * 1024;
const MAX_FILE_COUNT = 20;

function validJob(jobId) { return JOB_RE.test(String(jobId || "")); }
function validAsset(assetPath) { return ASSET_RE.test(String(assetPath || "")); }

async function persistJob(userId, jobId) {
  if (!userId || !validJob(jobId)) throw new Error("Invalid design asset owner or job.");
  const dir = path.join(ROOT, jobId);
  const paths = ["original.webp"];
  for (const name of await fs.readdir(path.join(dir, "assets")).catch((error) => {
    if (error.code === "ENOENT") return [];
    throw error;
  })) {
    const assetPath = `assets/${name}`;
    if (!validAsset(assetPath)) throw new Error("Unexpected generated asset name.");
    paths.push(assetPath);
  }
  if (paths.length > MAX_FILE_COUNT) throw new Error("Too many generated design layers.");
  const files = [];
  let total = 0;
  for (const assetPath of paths) {
    const bytes = await fs.readFile(path.join(dir, ...assetPath.split("/")));
    total += bytes.length;
    if (!bytes.length || total > MAX_JOB_BYTES) {
      throw new Error("Generated design is too large to store. Try a smaller image.");
    }
    files.push({ assetPath, bytes });
  }
  await db.tx(async (client) => {
    for (const file of files) {
      await client.query(
        `insert into public.design_assets (job_id, asset_path, user_id, content, byte_size)
         values ($1, $2, $3, $4, $5)`,
        [jobId, file.assetPath, userId, file.bytes, file.bytes.length]
      );
    }
  });
  // Keep only the durable copy; the scratch folder must not accumulate private
  // uploads on a long-running host.
  await fs.rm(dir, { recursive: true, force: true }).catch((error) => {
    console.warn("[design-assets] scratch cleanup failed:", error.message);
  });
  return { count: files.length, bytes: total };
}

async function getAsset(userId, jobId, assetPath) {
  if (!validJob(jobId) || !validAsset(assetPath)) return null;
  const { rows } = await db.query(
    `select content, byte_size, is_public from public.design_assets
     where job_id = $1 and asset_path = $2 and (is_public = true or user_id = $3)`,
    [jobId, assetPath, userId || null]
  );
  return rows[0] || null;
}

function jobIdsFromElements(elements) {
  const jobs = new Set();
  for (const element of elements || []) {
    const match = String(element && element.src || "")
      .match(/^\/api\/design-assets\/(job_[a-f0-9]{32})\/(?:original\.webp|assets\/[a-zA-Z0-9_-]+\.webp)$/);
    if (match) jobs.add(match[1]);
  }
  return [...jobs];
}

async function makePublic(client, userId, elements) {
  for (const jobId of jobIdsFromElements(elements)) {
    const result = await client.query(
      `update public.design_assets set is_public = true
       where job_id = $1 and user_id = $2`, [jobId, userId]
    );
    if (!result.rowCount) throw new Error("A design layer is missing or not owned by this creator.");
  }
}

module.exports = { persistJob, getAsset, makePublic, validJob, validAsset, jobIdsFromElements };
