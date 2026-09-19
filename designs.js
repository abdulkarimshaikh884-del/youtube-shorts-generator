/* ============================================================
   designs.js — ShortsCraft Design Projects & Template Store.
   Supports editable YouTube thumbnails, posters, logos, social posts,
   and AI-converted design templates.
   ============================================================ */
const crypto = require("crypto");

let db = null;
try {
  db = require("./db");
} catch (e) {
  // db.js is optional in offline/test environments
}

const MAX_PROJECTS_PER_USER = 60;
const MAX_ELEMENTS = 100;
const MAX_BYTES = 512 * 1024; // 512 KB json document limit

const SAMPLE_TEMPLATES = [
  {
    id: "dt_vox_masterclass",
    title: "Vox-Style Documentary Thumbnail",
    description: "High retention dark documentary thumbnail with bold yellow punchline, investigation badge, and spotlight contrast.",
    category: "youtube-thumbnail",
    design_type: "youtube-thumbnail",
    source_type: "shortscraft_official",
    author_name: "ShortsCraft Official",
    author_handle: "@shortscraft",
    canvas: { width: 1280, height: 720 },
    likes: 42,
    uses: 128,
    elements: [
      { id: "bg", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1280, height: 720, fill: "#0a0a10", zIndex: 0 },
      { id: "glow", type: "shape", shape: "circle", x: 400, y: 160, width: 480, height: 480, fill: "#1e1b4b", opacity: 0.6, zIndex: 1 },
      { id: "badge", type: "shape", shape: "pill", x: 80, y: 80, width: 220, height: 48, fill: "#ef4444", zIndex: 2 },
      { id: "badge_txt", type: "text", text: "INVESTIGATION", x: 96, y: 92, fontSize: 20, fontWeight: 800, fontFamily: "Space Grotesk", fill: "#ffffff", zIndex: 3 },
      { id: "h1", type: "text", text: "THE $100M", x: 80, y: 160, fontSize: 88, fontWeight: 900, fontFamily: "Anton", fill: "#ffffff", stroke: "#000000", strokeWidth: 4, zIndex: 4 },
      { id: "h2", type: "text", text: "COVERUP", x: 80, y: 260, fontSize: 110, fontWeight: 900, fontFamily: "Anton", fill: "#facc15", stroke: "#000000", strokeWidth: 5, zIndex: 5 },
      { id: "sub", type: "text", text: "How one company deceived everyone.", x: 84, y: 400, fontSize: 32, fontWeight: 600, fontFamily: "Inter", fill: "#94a3b8", zIndex: 6 }
    ]
  },
  {
    id: "dt_growth_metrics",
    title: "Viral Creator Growth Thumbnail",
    description: "Modern vibrant YouTube thumbnail featuring dynamic growth curve, bold contrast text, and callout arrow.",
    category: "youtube-thumbnail",
    design_type: "youtube-thumbnail",
    source_type: "shortscraft_official",
    author_name: "ShortsCraft Official",
    author_handle: "@shortscraft",
    canvas: { width: 1280, height: 720 },
    likes: 38,
    uses: 95,
    elements: [
      { id: "bg", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1280, height: 720, fill: "#090d16", zIndex: 0 },
      { id: "card", type: "shape", shape: "roundedRectangle", x: 740, y: 100, width: 460, height: 520, fill: "#131b2e", radius: 24, stroke: "#2563eb", strokeWidth: 2, zIndex: 1 },
      { id: "tag", type: "shape", shape: "pill", x: 80, y: 120, width: 200, height: 44, fill: "#10b981", zIndex: 2 },
      { id: "tag_txt", type: "text", text: "CASE STUDY", x: 100, y: 130, fontSize: 18, fontWeight: 700, fontFamily: "Inter", fill: "#ffffff", zIndex: 3 },
      { id: "title1", type: "text", text: "FROM 0 TO", x: 80, y: 200, fontSize: 84, fontWeight: 900, fontFamily: "Anton", fill: "#ffffff", zIndex: 4 },
      { id: "title2", type: "text", text: "1,000,000", x: 80, y: 300, fontSize: 108, fontWeight: 900, fontFamily: "Anton", fill: "#38bdf8", stroke: "#0f172a", strokeWidth: 4, zIndex: 5 },
      { id: "arrow", type: "shape", shape: "curvedArrow", x: 640, y: 280, width: 140, height: 100, fill: "#f59e0b", rotation: 12, zIndex: 6 }
    ]
  },
  {
    id: "dt_neon_brand_logo",
    title: "Cyberpunk Glow Logo Mockup",
    description: "Minimalist neon geometry logo on dark textured background with customizable glowing emblem and typography.",
    category: "logo",
    design_type: "logo",
    source_type: "shortscraft_official",
    author_name: "ShortsCraft Official",
    author_handle: "@shortscraft",
    canvas: { width: 1080, height: 1080 },
    likes: 56,
    uses: 110,
    elements: [
      { id: "bg", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1080, height: 1080, fill: "#030712", zIndex: 0 },
      { id: "ring", type: "shape", shape: "circle", x: 340, y: 240, width: 400, height: 400, fill: "transparent", stroke: "#06b6d4", strokeWidth: 16, zIndex: 1 },
      { id: "inner_circle", type: "shape", shape: "circle", x: 420, y: 320, width: 240, height: 240, fill: "#06b6d4", opacity: 0.15, zIndex: 2 },
      { id: "brand_name", type: "text", text: "NEONIX", x: 290, y: 720, fontSize: 92, fontWeight: 900, fontFamily: "Space Grotesk", fill: "#ffffff", letterSpacing: 8, zIndex: 3 },
      { id: "brand_tag", type: "text", text: "STUDIOS // 2026", x: 380, y: 840, fontSize: 24, fontWeight: 600, fontFamily: "IBM Plex Mono", fill: "#06b6d4", zIndex: 4 }
    ]
  },
  {
    id: "dt_event_poster",
    title: "Futuristic Conference Poster",
    description: "Vertical event poster template with clean typographic hierarchy, date stamp, and modern grid cards.",
    category: "poster",
    design_type: "poster",
    source_type: "shortscraft_official",
    author_name: "ShortsCraft Official",
    author_handle: "@shortscraft",
    canvas: { width: 1080, height: 1920 },
    likes: 29,
    uses: 74,
    elements: [
      { id: "bg", type: "shape", shape: "rectangle", x: 0, y: 0, width: 1080, height: 1920, fill: "#0f172a", zIndex: 0 },
      { id: "banner", type: "shape", shape: "pill", x: 120, y: 160, width: 320, height: 60, fill: "#6366f1", zIndex: 1 },
      { id: "banner_t", type: "text", text: "GLOBAL SUMMIT 2026", x: 140, y: 178, fontSize: 22, fontWeight: 700, fontFamily: "Space Grotesk", fill: "#ffffff", zIndex: 2 },
      { id: "title", type: "text", text: "AI DESIGN\nFUTURE", x: 120, y: 300, fontSize: 130, fontWeight: 900, fontFamily: "Anton", fill: "#ffffff", zIndex: 3 },
      { id: "card", type: "shape", shape: "roundedRectangle", x: 120, y: 1300, width: 840, height: 380, fill: "#1e293b", radius: 32, stroke: "#334155", strokeWidth: 2, zIndex: 4 },
      { id: "details", type: "text", text: "OCTOBER 24-26 · SAN FRANCISCO\nKeynotes · Workshops · Networking", x: 180, y: 1420, fontSize: 36, fontWeight: 600, fontFamily: "Inter", fill: "#cbd5e1", zIndex: 5 }
    ]
  }
];

// In-memory cache for fast access & offline/local fallback
const memoryTemplates = new Map();
SAMPLE_TEMPLATES.forEach(t => memoryTemplates.set(t.id, { ...t, status: "published" }));
const memoryProjects = new Map();

function hasDatabase() {
  return Boolean(process.env.DATABASE_URL && db && typeof db.query === "function");
}

// Ensure tables exist on boot
let initPromise = null;
async function ensureTables() {
  if (!hasDatabase()) return true;
  if (initPromise) return initPromise;
  initPromise = (async () => {
    try {
      await db.query(`
        create table if not exists public.design_projects (
          id text primary key,
          user_id uuid not null references public.users(id) on delete cascade,
          name text not null default 'Untitled Design',
          design_type text not null default 'youtube-thumbnail',
          canvas jsonb not null default '{"width": 1280, "height": 720}'::jsonb,
          source jsonb not null default '{"type": "scratch"}'::jsonb,
          elements jsonb not null default '[]'::jsonb,
          preview_url text,
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create index if not exists design_projects_user_updated_idx
          on public.design_projects(user_id, updated_at desc);

        create table if not exists public.design_templates (
          id text primary key,
          author_id uuid references public.users(id) on delete set null,
          author_name text not null default 'ShortsCraft Official',
          author_handle text not null default '@shortscraft',
          title text not null,
          description text default '',
          category text not null default 'youtube-thumbnail',
          design_type text not null default 'youtube-thumbnail',
          source_type text not null default 'shortscraft_official',
          parent_template_id text,
          canvas jsonb not null default '{"width": 1280, "height": 720}'::jsonb,
          elements jsonb not null default '[]'::jsonb,
          preview_url text,
          likes integer not null default 0,
          uses integer not null default 0,
          status text not null default 'published',
          created_at timestamptz not null default now(),
          updated_at timestamptz not null default now()
        );

        create index if not exists design_templates_cat_status_idx
          on public.design_templates(category, status, created_at desc);

        create table if not exists public.design_conversion_jobs (
          id text primary key,
          user_id uuid references public.users(id) on delete cascade,
          status text not null default 'queued',
          progress integer not null default 0,
          design_type text not null default 'youtube-thumbnail',
          source_image_name text not null,
          source_asset_path text,
          result_project_id text references public.design_projects(id) on delete set null,
          result_project jsonb,
          error_message text,
          created_at timestamptz not null default now(),
          completed_at timestamptz
        );
      `);
      await seedOfficialTemplates();
    } catch (err) {
      console.warn("[designs.js] Table init notice (running with memory cache):", err.message);
    }
  })();
  return initPromise;
}

function publicProject(row) {
  return {
    id: row.id,
    userId: row.user_id || row.userId,
    name: row.name,
    title: row.name,
    designType: row.design_type || row.designType,
    canvas: row.canvas || { width: 1280, height: 720 },
    source: row.source || { type: "scratch" },
    elements: Array.isArray(row.elements) ? row.elements : [],
    previewUrl: row.preview_url || row.previewUrl || "",
    createdAt: row.created_at ? new Date(row.created_at).getTime() : Date.now(),
    updatedAt: row.updated_at ? new Date(row.updated_at).getTime() : Date.now()
  };
}

function publicTemplate(row) {
  return {
    id: row.id,
    title: row.title,
    description: row.description || "",
    category: row.category,
    designType: row.design_type || row.designType,
    sourceType: row.source_type || row.sourceType, // 'shortscraft_official', 'creator_original', 'creator_ai_converted', 'image'
    authorName: row.author_name || row.authorName || "Creator",
    authorHandle: row.author_handle || row.authorHandle || "@creator",
    authorId: row.author_id || row.authorId,
    canvas: row.canvas || { width: 1280, height: 720 },
    elements: Array.isArray(row.elements) ? row.elements : [],
    previewUrl: row.preview_url || row.previewUrl || "",
    likes: Number(row.likes) || 0,
    uses: Number(row.uses) || 0,
    createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString()
  };
}

function cleanElements(elements) {
  if (!Array.isArray(elements)) return [];
  return elements.slice(0, MAX_ELEMENTS).map((el) => {
    if (!el || typeof el !== "object") return null;
    const type = String(el.type || "").toLowerCase();
    if (!["text", "image", "shape", "background"].includes(type)) return null;
    return el;
  }).filter(Boolean);
}

function getUserId(user) {
  if (!user) return null;
  if (typeof user === "string") return user.trim();
  return (user.id || user.userId || "").trim();
}

// ── User Design Projects ──────────────────────────────────────
async function listProjects(user) {
  const uid = getUserId(user);
  if (!uid) return { error: "Please log in first.", status: 401 };

  if (hasDatabase()) {
    try {
      await ensureTables();
      const { rows } = await db.query(
        `select * from public.design_projects where user_id = $1 order by updated_at desc limit $2`,
        [uid, MAX_PROJECTS_PER_USER]
      );
      return { success: true, projects: rows.map(publicProject) };
    } catch (e) {
      console.warn("[designs.js] Falling back to memory listProjects:", e.message);
    }
  }

  const list = [];
  for (const p of memoryProjects.values()) {
    if (p.userId === uid) list.push(publicProject(p));
  }
  list.sort((a, b) => b.updatedAt - a.updatedAt);
  return { success: true, projects: list.slice(0, MAX_PROJECTS_PER_USER) };
}

async function getProject(userOrId, optionalId) {
  const isDirectId = typeof userOrId === "string" && !optionalId;
  const id = isDirectId ? userOrId : String(optionalId || "");
  const uid = isDirectId ? null : getUserId(userOrId);

  if (!id) return { error: "Project ID required.", status: 400 };

  if (hasDatabase()) {
    try {
      await ensureTables();
      const query = uid
        ? `select * from public.design_projects where id = $1 and user_id = $2`
        : `select * from public.design_projects where id = $1`;
      const params = uid ? [id, uid] : [id];
      const { rows } = await db.query(query, params);
      if (rows[0]) return { success: true, project: publicProject(rows[0]) };
    } catch (e) {
      console.warn("[designs.js] Falling back to memory getProject:", e.message);
    }
  }

  const p = memoryProjects.get(id);
  if (!p || (uid && p.userId !== uid)) {
    return { error: "Design project not found.", status: 404 };
  }
  return { success: true, project: publicProject(p) };
}

async function saveProject(userOrBody, idOrBody, optionalBody) {
  let user = null;
  let id = null;
  let body = null;

  if (optionalBody) {
    user = userOrBody;
    id = idOrBody;
    body = optionalBody;
  } else if (idOrBody && typeof idOrBody === "object") {
    user = userOrBody;
    body = idOrBody;
    id = body.id;
  } else if (typeof userOrBody === "object" && userOrBody.elements) {
    body = userOrBody;
    id = body.id;
    user = body.userId || "anonymous";
  }

  const uid = getUserId(user) || "anonymous";
  const projectId = String(id || body?.id || `dp_${crypto.randomBytes(6).toString("hex")}`).trim();
  if (!/^[A-Za-z0-9_-]{3,64}$/.test(projectId)) {
    return { error: "Invalid project ID.", status: 400 };
  }

  const name = String(body?.name || body?.title || "Untitled Design").trim().slice(0, 100) || "Untitled Design";
  const designType = String(body?.designType || "youtube-thumbnail").slice(0, 40);
  const canvas = body?.canvas && typeof body.canvas === "object" ? body.canvas : { width: 1280, height: 720 };
  const source = body?.source && typeof body.source === "object" ? body.source : { type: "scratch" };
  const elements = cleanElements(body?.elements);
  const previewUrl = String(body?.previewUrl || "").slice(0, 500);

  const payload = JSON.stringify(elements);
  if (Buffer.byteLength(payload, "utf8") > MAX_BYTES) {
    return { error: "Design project is too large to save.", status: 413 };
  }

  if (hasDatabase() && uid !== "anonymous") {
    try {
      await ensureTables();
      const { rows } = await db.query(
        `insert into public.design_projects (id, user_id, name, design_type, canvas, source, elements, preview_url, updated_at)
         values ($1, $2, $3, $4, $5::jsonb, $6::jsonb, $7::jsonb, $8, now())
         on conflict (id) do update
           set name = excluded.name,
               design_type = excluded.design_type,
               canvas = excluded.canvas,
               source = excluded.source,
               elements = excluded.elements,
               preview_url = coalesce(excluded.preview_url, public.design_projects.preview_url),
               updated_at = now()
           where public.design_projects.user_id = excluded.user_id
         returning *`,
        [projectId, uid, name, designType, JSON.stringify(canvas), JSON.stringify(source), payload, previewUrl]
      );
      if (rows[0]) return { success: true, project: publicProject(rows[0]) };
    } catch (e) {
      console.warn("[designs.js] Falling back to memory saveProject:", e.message);
    }
  }

  const projectRecord = {
    id: projectId,
    userId: uid,
    name,
    designType,
    canvas,
    source,
    elements,
    previewUrl,
    createdAt: memoryProjects.get(projectId)?.createdAt || Date.now(),
    updatedAt: Date.now()
  };
  memoryProjects.set(projectId, projectRecord);
  return { success: true, project: publicProject(projectRecord) };
}

async function removeProject(user, id) {
  const uid = getUserId(user);
  if (!uid) return { error: "Please log in first.", status: 401 };

  if (hasDatabase()) {
    try {
      await ensureTables();
      const { rowCount } = await db.query(
        `delete from public.design_projects where id = $1 and user_id = $2`,
        [String(id || ""), uid]
      );
      if (rowCount) return { success: true };
    } catch (e) {
      console.warn("[designs.js] Falling back to memory removeProject:", e.message);
    }
  }

  const p = memoryProjects.get(id);
  if (p && p.userId === uid) {
    memoryProjects.delete(id);
    return { success: true };
  }
  return { error: "Project not found or unauthorized.", status: 404 };
}

// ── Design Templates (Public & Community) ──────────────────────
async function listTemplates(category) {
  if (hasDatabase()) {
    try {
      await ensureTables();
      let query = `select * from public.design_templates where status = 'published'`;
      const params = [];
      if (category && category !== "all") {
        params.push(category);
        query += ` and (category = $1 or design_type = $1)`;
      }
      query += ` order by uses desc, likes desc, created_at desc limit 40`;
      const { rows } = await db.query(query, params);
      if (rows && rows.length) return { success: true, templates: rows.map(publicTemplate) };
    } catch (e) {
      console.warn("[designs.js] Falling back to memory listTemplates:", e.message);
    }
  }

  const list = [];
  for (const t of memoryTemplates.values()) {
    if (t.status === "published") {
      if (!category || category === "all" || t.category === category || t.design_type === category) {
        list.push(publicTemplate(t));
      }
    }
  }
  list.sort((a, b) => (b.uses + b.likes) - (a.uses + a.likes));
  return { success: true, templates: list };
}

async function getTemplate(id) {
  const templateId = String(id || "");
  if (hasDatabase()) {
    try {
      await ensureTables();
      const { rows } = await db.query(
        `select * from public.design_templates where id = $1 and status = 'published'`,
        [templateId]
      );
      if (rows[0]) return { success: true, template: publicTemplate(rows[0]) };
    } catch (e) {
      console.warn("[designs.js] Falling back to memory getTemplate:", e.message);
    }
  }

  const t = memoryTemplates.get(templateId);
  if (!t || t.status !== "published") return { error: "Design template not found.", status: 404 };
  return { success: true, template: publicTemplate(t) };
}

async function cloneTemplate(userOrId, templateId) {
  const uid = getUserId(userOrId);
  if (!uid) return { error: "Please log in to use this template.", status: 401 };

  const tplRes = await getTemplate(templateId);
  if (!tplRes.success) return tplRes;
  const tpl = tplRes.template;

  // Increment usage count
  if (hasDatabase()) {
    db.query(`update public.design_templates set uses = uses + 1 where id = $1`, [tpl.id]).catch(() => {});
  }
  const cached = memoryTemplates.get(tpl.id);
  if (cached) cached.uses = (cached.uses || 0) + 1;

  const newProjectId = `dp_${crypto.randomBytes(6).toString("hex")}`;
  const sourceMeta = {
    type: "template_clone",
    parentTemplateId: tpl.id,
    sourceCreatorName: tpl.authorName,
    sourceCreatorHandle: tpl.authorHandle,
    sourceType: tpl.sourceType
  };

  return saveProject(userOrId, newProjectId, {
    name: `${tpl.title} (Copy)`,
    designType: tpl.designType,
    canvas: tpl.canvas,
    source: sourceMeta,
    elements: tpl.elements,
    previewUrl: tpl.previewUrl
  });
}

async function publishTemplate(user, body) {
  const uid = getUserId(user);
  if (!uid) return { error: "Please log in first.", status: 401 };

  const title = String(body.title || "").trim().slice(0, 100);
  if (!title) return { error: "Template title is required.", status: 400 };

  const projectId = String(body.projectId || "");
  const elements = cleanElements(body.elements);
  if (!elements.length) return { error: "Cannot publish an empty design template.", status: 400 };

  const designType = String(body.designType || "youtube-thumbnail");
  const category = String(body.category || designType);
  const description = String(body.description || "").slice(0, 300);
  const canvas = body.canvas && typeof body.canvas === "object" ? body.canvas : { width: 1280, height: 720 };
  const previewUrl = String(body.previewUrl || "").slice(0, 500);

  const tplId = `dt_${crypto.randomBytes(6).toString("hex")}`;
  const authorName = String(user.displayName || user.name || "Creator").slice(0, 60);
  const authorHandle = String(user.handle || "@creator").slice(0, 40);

  if (hasDatabase()) {
    try {
      await ensureTables();
      const { rows } = await db.query(
        `insert into public.design_templates
          (id, author_id, author_name, author_handle, title, description, category, design_type,
           source_type, parent_template_id, canvas, elements, preview_url, status)
         values ($1, $2, $3, $4, $5, $6, $7, $8, 'creator_original', $9, $10::jsonb, $11::jsonb, $12, 'published')
         returning *`,
        [tplId, uid, authorName, authorHandle, title, description, category, designType,
         projectId, JSON.stringify(canvas), JSON.stringify(elements), previewUrl]
      );
      if (rows[0]) return { success: true, template: publicTemplate(rows[0]) };
    } catch (e) {
      console.warn("[designs.js] Falling back to memory publishTemplate:", e.message);
    }
  }

  const tplRecord = {
    id: tplId,
    author_id: uid,
    author_name: authorName,
    author_handle: authorHandle,
    title,
    description,
    category,
    design_type: designType,
    source_type: "creator_original",
    parent_template_id: projectId,
    canvas,
    elements,
    preview_url: previewUrl,
    likes: 0,
    uses: 0,
    status: "published"
  };
  memoryTemplates.set(tplId, tplRecord);
  return { success: true, template: publicTemplate(tplRecord) };
}

async function seedOfficialTemplates() {
  if (!hasDatabase()) return;
  try {
    const { rows } = await db.query(`select count(*)::int as count from public.design_templates where source_type = 'shortscraft_official'`);
    if (rows[0]?.count > 0) return;

    for (const tpl of SAMPLE_TEMPLATES) {
      await db.query(
        `insert into public.design_templates
          (id, title, description, category, design_type, source_type, canvas, elements, status)
         values ($1, $2, $3, $4, $5, $6, $7::jsonb, $8::jsonb, 'published')
         on conflict (id) do nothing`,
        [tpl.id, tpl.title, tpl.description, tpl.category, tpl.design_type, tpl.source_type,
         JSON.stringify(tpl.canvas), JSON.stringify(tpl.elements)]
      ).catch(() => {});
    }
  } catch (e) {
    // Ignore seed warning in non-db environments
  }
}

module.exports = {
  ensureTables,
  listProjects,
  getProject,
  saveProject,
  removeProject,
  listTemplates,
  getTemplate,
  cloneTemplate,
  publishTemplate,
  publicProject,
  publicTemplate
};
