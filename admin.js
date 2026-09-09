/* Solo-owner administration queries. All callers are role-gated here. */
const db = require("./db");

function isAdmin(user) {
  return Boolean(user && ["admin", "super_admin"].includes(user.role));
}
function isSuperAdmin(user) { return Boolean(user && user.role === "super_admin"); }
function denied() { return { error: "Admin access required.", status: 403 }; }

async function dashboard(user) {
  if (!isAdmin(user)) return denied();
  const { rows } = await db.query(
    `select
       (select count(*)::int from public.users) as users,
       (select count(*)::int from public.community_templates where status = 'published') as published_templates,
       (select count(*)::int from public.community_templates where status = 'scheduled') as scheduled_templates,
       (select count(*)::int from public.support_tickets where status not in ('resolved','closed')) as open_tickets,
       (select count(*)::int from public.content_reports where status in ('open','reviewing')) as open_reports,
       (select count(*)::int from public.template_events where event_type = 'export' and created_at >= now() - interval '30 days') as exports_30d,
       (select count(*)::int from public.credit_transactions where kind like 'ai_%' and created_at >= now() - interval '30 days') as ai_generations_30d,
       (select count(*)::int from public.users where created_at >= now() - interval '30 days') as new_users_30d`
  );
  return { success: true, stats: rows[0] };
}

async function listUsers(user) {
  if (!isAdmin(user)) return denied();
  const { rows } = await db.query(
    `select id, email, display_name, handle, plan, plan_until, billing_cycle,
            verified, role, created_at,
            (select count(*)::int from public.community_templates ct where ct.author_id = u.id) as template_count
       from public.users u order by created_at desc limit 200`
  );
  return {
    success: true,
    users: rows.map((r) => ({
      id: r.id, email: r.email, displayName: r.display_name || "", handle: r.handle || "",
      plan: r.plan || "free", planUntil: r.plan_until, billingCycle: r.billing_cycle,
      verified: r.verified === true, role: r.role || "user", createdAt: r.created_at,
      templateCount: Number(r.template_count) || 0
    }))
  };
}

async function listContent(user) {
  if (!isAdmin(user)) return denied();
  const { rows } = await db.query(
    `select ct.id, ct.title, ct.tpl, ct.category, ct.status, ct.source_format,
            ct.review_note, ct.scheduled_at, ct.published_at, ct.created_at,
            u.display_name as author_name, u.handle as author_handle,
            (select count(*)::int from public.template_reactions tr where tr.template_id = ct.id and tr.reaction = 'like') as likes,
            (select count(*)::int from public.template_comments tc where tc.tpl_id = ct.id and coalesce(tc.status, 'visible') = 'visible') as comments,
            (select count(*)::int from public.template_events te where te.template_id = ct.id and te.event_type = 'export') as exports
       from public.community_templates ct
       left join public.users u on u.id = ct.author_id
      order by coalesce(ct.updated_at, ct.created_at) desc limit 300`
  );
  return {
    success: true,
    templates: rows.map((r) => ({
      id: r.id, title: r.title, templateId: r.tpl, category: r.category,
      status: r.status, sourceFormat: r.source_format, reviewNote: r.review_note || "",
      scheduledAt: r.scheduled_at, publishedAt: r.published_at, createdAt: r.created_at,
      authorName: r.author_name || "Unknown creator", authorHandle: r.author_handle || "",
      likes: Number(r.likes) || 0, comments: Number(r.comments) || 0, exports: Number(r.exports) || 0
    }))
  };
}

async function updateContent(user, id, data) {
  if (!isAdmin(user)) return denied();
  const allowed = new Set(["review", "published", "rejected", "archived"]);
  const status = String(data?.status || "");
  if (!allowed.has(status)) return { error: "Choose a valid moderation status.", status: 400 };
  const note = String(data?.reviewNote || "").trim().slice(0, 1000);
  const before = await db.query(`select * from public.community_templates where id = $1`, [id]);
  if (!before.rows[0]) return { error: "Template not found.", status: 404 };
  const { rows } = await db.query(
    `update public.community_templates
        set status = $2, review_note = $3,
            published_at = case when $2 = 'published' then coalesce(published_at, now()) else published_at end,
            updated_at = now()
      where id = $1 returning *`,
    [id, status, note]
  );
  await audit(user, "template_moderation", "template", id, before.rows[0], rows[0]);
  return { success: true, template: { id, status, reviewNote: note } };
}

async function listFlags(user) {
  if (!isAdmin(user)) return denied();
  const { rows } = await db.query(
    `select key, enabled, description, updated_at from public.feature_flags order by key`
  );
  return { success: true, flags: rows.map((r) => ({ key: r.key, enabled: r.enabled, description: r.description, updatedAt: r.updated_at })) };
}

async function setFlag(user, key, enabled) {
  if (!isSuperAdmin(user)) return { error: "Super Admin access required.", status: 403 };
  const before = await db.query(`select * from public.feature_flags where key = $1`, [key]);
  if (!before.rows[0]) return { error: "Feature flag not found.", status: 404 };
  const { rows } = await db.query(
    `update public.feature_flags set enabled = $2, updated_by = $3, updated_at = now()
      where key = $1 returning *`,
    [key, enabled === true, user.id]
  );
  await audit(user, "feature_flag_update", "feature_flag", key, before.rows[0], rows[0]);
  return { success: true, flag: { key, enabled: rows[0].enabled, description: rows[0].description } };
}

async function audit(user, action, entityType, entityId, before, after) {
  await db.query(
    `insert into public.admin_audit_log
       (actor_id, action, entity_type, entity_id, before_data, after_data)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [user.id, action, entityType, String(entityId || ""), JSON.stringify(before || null), JSON.stringify(after || null)]
  );
}

module.exports = { dashboard, listUsers, listContent, updateContent, listFlags, setFlag, isAdmin, isSuperAdmin };
