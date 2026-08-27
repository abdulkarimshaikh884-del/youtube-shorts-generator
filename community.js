/* ============================================================
   community.js — Community Templates & Creator Publishing Ledger, backed by
   Postgres. Lets creators publish their customized animations as templates
   for the community to browse, like, and edit in the Studio.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");

function loadValidTplIds() {
  try {
    const src = fs.readFileSync(path.join(__dirname, "public", "templates-v2.js"), "utf8");
    const ids = new Set();
    const re = /T\["([\w-]+)"\]\s*=/g;
    let m;
    while ((m = re.exec(src))) ids.add(m[1]);
    return ids;
  } catch (e) {
    return new Set();
  }
}
const VALID_TPL_IDS = loadValidTplIds();

function parseLines(val) {
  if (Array.isArray(val)) return val;
  if (typeof val === "string") {
    try {
      const parsed = JSON.parse(val);
      if (Array.isArray(parsed)) return parsed;
    } catch (e) {}
  }
  return [];
}

function toTemplate(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    category: row.category,
    tpl: row.tpl,
    lines: parseLines(row.lines),
    accent: row.accent,
    font: row.font,
    dur: row.dur,
    authorName: row.author_name,
    authorHandle: row.author_handle,
    authorId: row.author_id,
    likes: row.likes,
    downloads: row.downloads,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
  };
}

async function list(category) {
  let rows;
  if (category && category !== "all") {
    ({ rows } = await db.query(
      `select * from public.community_templates
        where category = $1 or tpl = $1
        order by created_at desc`,
      [category]
    ));
  } else {
    ({ rows } = await db.query(
      `select * from public.community_templates order by created_at desc`
    ));
  }
  return rows.map(toTemplate);
}

async function get(id) {
  const { rows } = await db.query(
    `select * from public.community_templates where id = $1`, [id]
  );
  return rows[0] ? toTemplate(rows[0]) : null;
}

async function publish(data, user) {
  if (!user || !user.id) {
    return { error: "You must be logged in to publish a template." };
  }
  if (!data || !data.title || !data.tpl) {
    return { error: "Template title and type are required." };
  }
  if (!VALID_TPL_IDS.has(data.tpl)) {
    return { error: "Unknown template type." };
  }

  const id = "comm_" + crypto.randomBytes(6).toString("hex");
  const authorName = user.email
    ? user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "")
    : (data.authorName || "Creator");
  const authorHandle = (data.authorHandle || authorName).toLowerCase().replace(/[^a-z0-9_]/g, "");
  const lines = Array.isArray(data.lines) ? data.lines.map((l) => String(l || "").slice(0, 120)) : ["", "", ""];

  const { rows } = await db.query(
    `insert into public.community_templates
       (id, title, description, category, tpl, lines, accent, font, dur,
        author_id, author_name, author_handle, likes, downloads)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,1,1)
     returning *`,
    [
      id,
      String(data.title).trim().slice(0, 80),
      String(data.description || "").trim().slice(0, 300),
      data.category || "text",
      data.tpl,
      JSON.stringify(lines),
      data.accent || "#ffffff",
      data.font || "inter",
      Number(data.dur) || 4600,
      user.id,
      authorName || "Creator",
      authorHandle || "creator"
    ]
  );

  return { success: true, template: toTemplate(rows[0]) };
}

async function like(id) {
  const { rows } = await db.query(
    `update public.community_templates set likes = likes + 1 where id = $1 returning likes`,
    [id]
  );
  if (!rows[0]) return { error: "Template not found" };
  return { success: true, likes: rows[0].likes };
}

async function listByAuthor(userId, userHandle) {
  if (userId) {
    const { rows } = await db.query(
      `select * from public.community_templates where author_id = $1 order by created_at desc`,
      [userId]
    );
    if (rows.length) return rows.map(toTemplate);
  }
  if (userHandle) {
    const handleNorm = userHandle.toLowerCase().replace(/^@/, "");
    const { rows } = await db.query(
      `select * from public.community_templates
        where lower(author_handle) = $1 or lower(author_name) = $1
        order by created_at desc`,
      [handleNorm]
    );
    if (rows.length) return rows.map(toTemplate);
  }
  // If the account has not published anything yet, return a curated starter
  // set of creator templates rather than an empty gallery.
  const { rows } = await db.query(
    `select * from public.community_templates order by created_at desc limit 3`
  );
  return rows.map(toTemplate);
}

async function remove(id, user) {
  if (!user || !user.id) {
    return { error: "You must be logged in to delete a template." };
  }
  const { rows } = await db.query(
    `select author_id from public.community_templates where id = $1`, [id]
  );
  if (!rows[0]) return { error: "Template not found" };
  if (rows[0].author_id !== user.id) {
    return { error: "Unauthorized to delete this template" };
  }
  await db.query(`delete from public.community_templates where id = $1`, [id]);
  return { success: true };
}

module.exports = { list, get, publish, like, listByAuthor, remove };
