/* ============================================================
   community.js — Community Templates & Creator Publishing Ledger, backed by
   Postgres. Lets creators publish their customized animations as templates
   for the community to browse, like, and edit in the Studio.
   ============================================================ */
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const db = require("./db");
const verified = require("./verified");
const lottie = require("./lottie");

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
    // Everything the person actually edited. Without these the detail page
    // rebuilds the template from defaults and the published result silently
    // differs from what was composed.
    props: row.props && typeof row.props === "object" ? row.props : {},
    aspect: row.aspect || "9:16",
    accent: row.accent,
    font: row.font,
    dur: row.dur,
    // The creator as their account reads now, not the name stored when the
    // template was published: a renamed account (or the house templates,
    // credited to @shortscraft before that account owned them) otherwise
    // showed a stale name such as an old email prefix.
    authorName: row.account_name || row.author_name,
    authorHandle: row.account_handle || row.author_handle,
    authorId: row.author_id,
    authorVerified: row.author_verified === true || String(row.account_handle || row.author_handle || "").replace(/^@/, "") === "shortscraft",
    authorAvatarUrl: row.author_has_avatar && row.account_id ? `/api/users/${encodeURIComponent(row.account_id)}/avatar` : "",
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
      `select ct.*, ${verified.sql("u")} as author_verified, u.id as account_id,
              u.display_name as account_name, u.handle as account_handle,
              (u.avatar_bytes is not null) as author_has_avatar,
              (select count(*)::int from public.template_reactions tr
                where tr.template_id = ct.id and tr.reaction = 'like') as real_likes,
              (select count(*)::int from public.template_events te
                where te.template_id = ct.id and te.event_type = 'export') as real_exports
         from public.community_templates ct
         left join public.users u on u.id = coalesce(ct.author_id, (select o.id from public.users o
                                   where lower(replace(ct.author_handle, '@', '')) = 'shortscraft'
                                     and lower(replace(o.handle, '@', '')) = 'shortscraft' limit 1))
        where ct.status = 'published' and ct.published_at <= now()
          and (ct.category = $1 or ct.tpl = $1)
        order by ct.published_at desc, ct.created_at desc`,
      [category]
    ));
  } else {
    ({ rows } = await db.query(
      `select ct.*, ${verified.sql("u")} as author_verified, u.id as account_id,
              u.display_name as account_name, u.handle as account_handle,
              (u.avatar_bytes is not null) as author_has_avatar,
              (select count(*)::int from public.template_reactions tr
                where tr.template_id = ct.id and tr.reaction = 'like') as real_likes,
              (select count(*)::int from public.template_events te
                where te.template_id = ct.id and te.event_type = 'export') as real_exports
         from public.community_templates ct
         left join public.users u on u.id = coalesce(ct.author_id, (select o.id from public.users o
                                   where lower(replace(ct.author_handle, '@', '')) = 'shortscraft'
                                     and lower(replace(o.handle, '@', '')) = 'shortscraft' limit 1))
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
    `select ct.*, ${verified.sql("u")} as author_verified, u.id as account_id,
              u.display_name as account_name, u.handle as account_handle,
            (u.avatar_bytes is not null) as author_has_avatar,
            (select count(*)::int from public.template_reactions tr
              where tr.template_id = ct.id and tr.reaction = 'like') as real_likes,
            (select count(*)::int from public.template_events te
              where te.template_id = ct.id and te.event_type = 'export') as real_exports
       from public.community_templates ct
       left join public.users u on u.id = coalesce(ct.author_id, (select o.id from public.users o
                                   where lower(replace(ct.author_handle, '@', '')) = 'shortscraft'
                                     and lower(replace(o.handle, '@', '')) = 'shortscraft' limit 1))
      where ct.id = $1 and ct.status = 'published' and ct.published_at <= now()`, [id]
  );
  return rows[0] && livesInEngine(rows[0]) ? toTemplate(rows[0]) : null;
}

// Private/scheduled rows are never returned by the public detail endpoint.
// Creator Studio resolves them through a session-owned lookup, not a handle.
async function getOwned(id, user) {
  if (!user || !user.id) return null;
  const { rows } = await db.query(
    `select ct.* from public.community_templates ct
      where ct.id = $1 and ct.author_id = $2`,
    [id, user.id]
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
  let dur = Math.min(Math.max(Number(data.dur) || 4600, 1000), 12000);

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

  /* The edited state, not just the headline fields. `props` is whatever the
     template's own schema produced, so it is stored as given rather than
     picked over here — but it is capped, because it is user input that lands
     in a jsonb column and one pasted data: URI could otherwise arrive as
     megabytes. Aspect is validated against the four the composer offers. */
  const ASPECTS = new Set(["9:16", "16:9", "1:1", "4:5"]);
  let aspect = ASPECTS.has(String(data.aspect)) ? String(data.aspect) : "9:16";
  let sourceFormat = "shortscraft_preset";
  let props = data.props && typeof data.props === "object" && !Array.isArray(data.props)
    ? data.props
    : {};
  /* An uploaded animation is published by reference. Its size and length
     are what the stored document says — not what the request claims — and
     only the document's owner may publish it. Props are reduced to the upload
     template's own slots so nothing else rides along. */
  if (data.tpl === "lottie") {
    const check = await lottie.assertPublishable(props.doc, user);
    if (check.error) return { error: check.error };
    const clean = { doc: String(props.doc) };
    for (let i = 1; i <= 12; i++) {
      if (typeof props["t" + i] === "string" && props["t" + i].trim()) clean["t" + i] = props["t" + i].slice(0, 200);
    }
    for (let i = 1; i <= 8; i++) {
      if (/^#[0-9a-f]{6}$/i.test(String(props["c" + i] || ""))) clean["c" + i] = String(props["c" + i]);
    }
    props = clean;
    aspect = ASPECTS.has(check.meta.aspect) ? check.meta.aspect : "9:16";
    dur = Math.min(Math.max(Number(check.meta.durationMs) || 4600, 1000), 9000);
    sourceFormat = "lottie_json";
  }

  const propsJson = JSON.stringify(props);
  if (propsJson.length > 400_000) {
    return { error: "That template carries too much embedded data to publish. Try smaller images." };
  }

  const { rows } = await db.query(
    `insert into public.community_templates
       (id, title, description, category, tpl, lines, props, aspect, accent, font, dur,
        author_id, author_name, author_handle, likes, downloads, source_format,
        status, scheduled_at, published_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,0,0,$17,$15,$16,
             -- The database's clock, not this server's: the library shows rows
             -- whose published_at <= now(), so a timestamp from an app clock
             -- running ahead hid every new template for as long as the skew.
             case when $15::text = 'published' then now() end)
     returning *`,
    [
      id,
      title.slice(0, 80),
      String(data.description || "").trim().slice(0, 300),
      category,
      data.tpl,
      JSON.stringify(lines),
      propsJson,
      aspect,
      accent,
      font,
      dur,
      user.id,
      authorName || "Creator",
      authorHandle || "creator",
      status,
      scheduledAt,
      sourceFormat
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
    /* An account's templates are the rows it owns by id, plus rows credited to
       its handle that nobody owns yet. Returning the id rows alone the moment
       one existed hid every handle-credited template behind the first owned
       one: @shortscraft showed its four house templates while it owned none,
       and one template the moment it owned one. Unowned is the limit — a row
       another account owns is never pulled in by a matching handle. */
    const handleNorm = userHandle ? String(userHandle).toLowerCase().replace(/^@/, "") : null;
    const { rows } = await db.query(
      `select ct.*, ${verified.sql("u")} as author_verified, u.id as account_id,
              u.display_name as account_name, u.handle as account_handle,
              (u.avatar_bytes is not null) as author_has_avatar,
              (select count(*)::int from public.template_reactions tr
                where tr.template_id = ct.id and tr.reaction = 'like') as real_likes,
              (select count(*)::int from public.template_events te
                where te.template_id = ct.id and te.event_type = 'export') as real_exports
         from public.community_templates ct
         left join public.users u on u.id = coalesce(ct.author_id, (select o.id from public.users o
                                   where lower(replace(ct.author_handle, '@', '')) = 'shortscraft'
                                     and lower(replace(o.handle, '@', '')) = 'shortscraft' limit 1))
        where (ct.author_id = $1
               or ($3::text is not null and ct.author_id is null
                   and lower(replace(ct.author_handle, '@', '')) = $3))
          and ($2::boolean or (ct.status = 'published' and ct.published_at <= now()))
        order by coalesce(ct.published_at, ct.scheduled_at, ct.created_at) desc`,
      [userId, includeUnpublished, handleNorm]
    );
    if (rows.length) return rows.filter(livesInEngine).map(toTemplate);
  }
  if (userHandle) {
    const handleNorm = userHandle.toLowerCase().replace(/^@/, "");
    const { rows } = await db.query(
      `select ct.*, ${verified.sql("u")} as author_verified, u.id as account_id,
              u.display_name as account_name, u.handle as account_handle,
              (u.avatar_bytes is not null) as author_has_avatar,
              (select count(*)::int from public.template_reactions tr
                where tr.template_id = ct.id and tr.reaction = 'like') as real_likes,
              (select count(*)::int from public.template_events te
                where te.template_id = ct.id and te.event_type = 'export') as real_exports
         from public.community_templates ct
         left join public.users u on u.id = coalesce(ct.author_id, (select o.id from public.users o
                                   where lower(replace(ct.author_handle, '@', '')) = 'shortscraft'
                                     and lower(replace(o.handle, '@', '')) = 'shortscraft' limit 1))
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

module.exports = { list, get, getOwned, publish, like, unlike, listByAuthor, remove, isPublicTemplateKey };
