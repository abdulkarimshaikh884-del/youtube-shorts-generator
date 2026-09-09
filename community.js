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
const VALID_CATEGORIES = new Set(["docu", "paper", "text", "maps", "money", "ui", "social", "charts"]);
const VALID_FONTS = new Set(["inter", "grotesk", "roboto", "serif", "mono"]);

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
    authorVerified: row.author_verified === true || String(row.author_handle || "").replace(/^@/, "") === "shortscraft",
    authorAvatarUrl: row.author_has_avatar && row.author_id ? `/api/users/${encodeURIComponent(row.author_id)}/avatar` : "",
    // Legacy aggregate columns may contain old seed values. Public counters
    // come from the durable reaction/event ledgers selected below.
    likes: Number(row.real_likes) || 0,
    downloads: Number(row.real_exports) || 0,
    status: row.status || "published",
    sourceFormat: row.source_format || "shortscraft_preset",
    scheduledAt: row.scheduled_at ? new Date(row.scheduled_at).toISOString() : null,
    publishedAt: row.published_at ? new Date(row.published_at).toISOString() : null,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : null
  };
}

async function publishDue() {
  await db.query(
    `update public.community_templates
        set status = 'published', published_at = coalesce(published_at, scheduled_at, now()), updated_at = now()
      where status = 'scheduled' and scheduled_at <= now()`
  );
}

async function list(category) {
  await publishDue();
  let rows;
  if (category && category !== "all") {
    ({ rows } = await db.query(
      `select ct.*, u.verified as author_verified,
              (u.avatar_bytes is not null) as author_has_avatar,
              (select count(*)::int from public.template_reactions tr
                where tr.template_id = ct.id and tr.reaction = 'like') as real_likes,
              (select count(*)::int from public.template_events te
                where te.template_id = ct.id and te.event_type = 'export') as real_exports
         from public.community_templates ct
         left join public.users u on u.id = ct.author_id
        where ct.status = 'published' and ct.published_at <= now()
          and (ct.category = $1 or ct.tpl = $1)
        order by ct.published_at desc, ct.created_at desc`,
      [category]
    ));
  } else {
    ({ rows } = await db.query(
      `select ct.*, u.verified as author_verified,
              (u.avatar_bytes is not null) as author_has_avatar,
              (select count(*)::int from public.template_reactions tr
                where tr.template_id = ct.id and tr.reaction = 'like') as real_likes,
              (select count(*)::int from public.template_events te
                where te.template_id = ct.id and te.event_type = 'export') as real_exports
         from public.community_templates ct
         left join public.users u on u.id = ct.author_id
        where ct.status = 'published' and ct.published_at <= now()
        order by ct.published_at desc, ct.created_at desc`
    ));
  }
  return rows.filter(livesInEngine).map(toTemplate);
}

/* A published row points at a built-in template by id. If that template is
   later removed from the engine, the row survives in the database and the
   gallery renders it as an empty card — which is what "the templates are
   broken" looked like from the outside. Publishing already refuses unknown
   ids; this is the same check on the way out, so a template retired after
   the fact disappears from the gallery instead of leaving a hole in it. */
function livesInEngine(row) {
  if (VALID_TPL_IDS.has(row.tpl)) return true;
  console.warn("[community] hiding %s — its template %s no longer exists", row.id, row.tpl);
  return false;
}

async function get(id) {
  await publishDue();
  const { rows } = await db.query(
    `select ct.*, u.verified as author_verified,
            (u.avatar_bytes is not null) as author_has_avatar,
            (select count(*)::int from public.template_reactions tr
              where tr.template_id = ct.id and tr.reaction = 'like') as real_likes,
            (select count(*)::int from public.template_events te
              where te.template_id = ct.id and te.event_type = 'export') as real_exports
       from public.community_templates ct
       left join public.users u on u.id = ct.author_id
      where ct.id = $1 and ct.status = 'published' and ct.published_at <= now()`, [id]
  );
  return rows[0] && livesInEngine(rows[0]) ? toTemplate(rows[0]) : null;
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
  const title = String(data.title).trim();
  if (!title) return { error: "Template title is required." };
  const category = VALID_CATEGORIES.has(String(data.category)) ? String(data.category) : "text";
  const font = VALID_FONTS.has(String(data.font)) ? String(data.font) : "inter";
  const accent = /^#[0-9a-fA-F]{6}$/.test(String(data.accent || "")) ? String(data.accent) : "#ffffff";
  const dur = Math.min(Math.max(Number(data.dur) || 4600, 1000), 12000);

  const id = "comm_" + crypto.randomBytes(6).toString("hex");
  const authorName = user.displayName || (user.email
    ? user.email.split("@")[0].replace(/[^a-zA-Z0-9_]/g, "")
    : (data.authorName || "Creator"));
  const authorHandle = (user.handle || data.authorHandle || authorName).toLowerCase().replace(/[^a-z0-9_]/g, "");
  const lines = Array.isArray(data.lines) ? data.lines.map((l) => String(l || "").slice(0, 120)) : ["", "", ""];
  const visibility = String(data.visibility || "public").toLowerCase();
  let status = visibility === "private" ? "draft" : "published";
  let scheduledAt = null;
  if (visibility === "scheduled") {
    const parsed = new Date(data.scheduledAt || "");
    const min = Date.now() + 10 * 60_000;
    const max = Date.now() + 365 * 864e5;
    if (!Number.isFinite(parsed.getTime()) || parsed.getTime() < min || parsed.getTime() > max) {
      return { error: "Choose a schedule time at least 10 minutes from now and within one year." };
    }
    status = "scheduled";
    scheduledAt = parsed;
  }

  const { rows } = await db.query(
    `insert into public.community_templates
       (id, title, description, category, tpl, lines, accent, font, dur,
        author_id, author_name, author_handle, likes, downloads, source_format,
        status, scheduled_at, published_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,0,0,'shortscraft_preset',$13,$14,$15)
     returning *`,
    [
      id,
      title.slice(0, 80),
      String(data.description || "").trim().slice(0, 300),
      category,
      data.tpl,
      JSON.stringify(lines),
      accent,
      font,
      dur,
      user.id,
      authorName || "Creator",
      authorHandle || "creator",
      status,
      scheduledAt,
      status === "published" ? new Date() : null
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

async function unlike(id) {
  const { rows } = await db.query(
    `update public.community_templates set likes = greatest(0, likes - 1) where id = $1 returning likes`,
    [id]
  );
  if (!rows[0]) return { error: "Template not found" };
  return { success: true, likes: rows[0].likes };
}

async function listByAuthor(userId, userHandle, options = {}) {
  await publishDue();
  const includeUnpublished = options.includeUnpublished === true;
  if (userId) {
    const { rows } = await db.query(
      `select ct.*, u.verified as author_verified,
              (u.avatar_bytes is not null) as author_has_avatar,
              (select count(*)::int from public.template_reactions tr
                where tr.template_id = ct.id and tr.reaction = 'like') as real_likes,
              (select count(*)::int from public.template_events te
                where te.template_id = ct.id and te.event_type = 'export') as real_exports
         from public.community_templates ct
         left join public.users u on u.id = ct.author_id
        where ct.author_id = $1 and ($2::boolean or (ct.status = 'published' and ct.published_at <= now()))
        order by coalesce(ct.published_at, ct.scheduled_at, ct.created_at) desc`,
      [userId, includeUnpublished]
    );
    if (rows.length) return rows.filter(livesInEngine).map(toTemplate);
  }
  if (userHandle) {
    const handleNorm = userHandle.toLowerCase().replace(/^@/, "");
    const { rows } = await db.query(
      `select ct.*, u.verified as author_verified,
              (u.avatar_bytes is not null) as author_has_avatar,
              (select count(*)::int from public.template_reactions tr
                where tr.template_id = ct.id and tr.reaction = 'like') as real_likes,
              (select count(*)::int from public.template_events te
                where te.template_id = ct.id and te.event_type = 'export') as real_exports
         from public.community_templates ct
         left join public.users u on u.id = ct.author_id
        where (lower(ct.author_handle) = $1 or lower(ct.author_name) = $1)
          and ($2::boolean or (ct.status = 'published' and ct.published_at <= now()))
        order by coalesce(ct.published_at, ct.scheduled_at, ct.created_at) desc`,
      [handleNorm, includeUnpublished]
    );
    if (rows.length) return rows.filter(livesInEngine).map(toTemplate);
  }
  // A creator with no published work must have an honest empty state. Returning
  // somebody else's latest templates here made Account say they belonged to
  // the signed-in user and made empty creator profiles impersonate other users.
  return [];
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

async function isPublicTemplateKey(id) {
  const key = String(id || "").trim();
  if (VALID_TPL_IDS.has(key)) return true;
  if (!/^comm_[a-z0-9]+$/i.test(key)) return false;
  return Boolean(await get(key));
}

module.exports = { list, get, publish, like, unlike, listByAuthor, remove, isPublicTemplateKey };
