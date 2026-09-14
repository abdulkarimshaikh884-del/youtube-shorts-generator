/* ============================================================
   lottie.js — storing and serving uploaded Lottie animations.

   The browser has already recognised the file by the time it arrives here,
   but nothing it concluded is trusted: the document is inspected and cleaned
   again with the same code (public/lottie-inspect.js) before it is stored.
   What is stored is the cleaned document, so every later reader — gallery,
   Studio, exporter — only ever sees an animation with no expressions and no
   remote references.
   ============================================================ */
const crypto = require("crypto");
const db = require("./db");
const inspector = require("./public/lottie-inspect.js");

const ID_RE = /^[A-Za-z0-9_-]{16,64}$/;

function newId() {
  return "lt_" + crypto.randomBytes(18).toString("base64url");
}

/* upload(user, raw) — raw is the animation as the browser packed it: a
   Lottie object, images already inlined from a ZIP or folder. */
async function upload(user, raw) {
  if (!user || !user.id) return { error: "Sign in to upload a template.", status: 401 };
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { error: "Upload a Lottie animation (.json), or a ZIP or folder that contains one." };
  }

  const result = inspector.inspect(raw);
  if (!result.ok) return { error: result.errors[0] || "That file is not a usable Lottie animation." };

  const text = JSON.stringify(result.clean);
  const bytes = Buffer.byteLength(text, "utf8");
  if (bytes > inspector.LIMITS.maxBytes) return { error: "The animation is larger than 8 MB." };
  const sha256 = crypto.createHash("sha256").update(text).digest("hex");

  const meta = Object.assign({}, result.meta, { warnings: result.warnings });

  // Re-uploading the same file returns the document already stored, rather
  // than failing on the unique index or storing a second copy.
  const existing = await db.query(
    `select id, meta from public.lottie_docs where owner_id = $1 and sha256 = $2`,
    [user.id, sha256]
  );
  if (existing.rows.length) {
    return { success: true, id: existing.rows[0].id, meta: existing.rows[0].meta, reused: true };
  }

  const id = newId();
  await db.query(
    `insert into public.lottie_docs (id, owner_id, doc, meta, bytes, sha256)
     values ($1, $2, $3, $4, $5, $6)`,
    [id, user.id, text, JSON.stringify(meta), bytes, sha256]
  );
  return { success: true, id, meta };
}

async function getDoc(id) {
  if (!ID_RE.test(String(id || ""))) return null;
  const { rows } = await db.query(`select doc, sha256 from public.lottie_docs where id = $1`, [id]);
  return rows[0] || null;
}

async function getMeta(id) {
  if (!ID_RE.test(String(id || ""))) return null;
  const { rows } = await db.query(`select id, owner_id, meta from public.lottie_docs where id = $1`, [id]);
  return rows[0] || null;
}

/* Publishing checks: the document exists and belongs to the publisher (an
   admin may publish any). Returns the stored meta, which — not anything the
   client sends — decides the template's aspect and duration. */
async function assertPublishable(id, user) {
  const row = await getMeta(id);
  if (!row) return { error: "That upload no longer exists. Upload the file again." };
  const admin = user && (user.role === "admin" || user.role === "super_admin");
  if (!admin && row.owner_id !== user.id) return { error: "You can only publish animations you uploaded." };
  return { meta: row.meta };
}

module.exports = { upload, getDoc, getMeta, assertPublishable, ID_RE };
