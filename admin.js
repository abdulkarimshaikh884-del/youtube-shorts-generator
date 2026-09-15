/* Administration queries. Every function checks its own permission through
   permissions.js; the routes in server.js add no checks of their own. */
const db = require("./db");
const permissions = require("./permissions");
const notify = require("./notify");

const { can, isOwner } = permissions;
function denied() { return { error: "You do not have access to this part of the admin console.", status: 403 }; }
function ownerOnly() { return { error: "Only the owner can do this.", status: 403 }; }
const validId = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

async function dashboard(user) {
  if (!can(user, "overview.view")) return denied();
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

/* Staff with users.view see who has an account, not how to reach them: the
   email column is the owner's alone. */
async function listUsers(user) {
  if (!can(user, "users.view")) return denied();
  const owner = isOwner(user);
  const { rows } = await db.query(
    `select id, email, display_name, handle, plan, plan_until, billing_cycle,
            verified, role, staff_permissions, created_at,
            (select count(*)::int from public.community_templates ct where ct.author_id = u.id) as template_count
       from public.users u order by created_at desc limit 200`
  );
  return {
    success: true,
    canManageStaff: owner,
    users: rows.map((r) => ({
      id: r.id, email: owner ? r.email : "", displayName: r.display_name || "", handle: r.handle || "",
      plan: r.plan || "free", planUntil: r.plan_until, billingCycle: r.billing_cycle,
      verified: r.verified === true, role: r.role || "user", createdAt: r.created_at,
      permissions: permissions.permissionsOf(r),
      templateCount: Number(r.template_count) || 0
    }))
  };
}

async function listContent(user) {
  if (!can(user, "templates.moderate")) return denied();
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
  if (!can(user, "templates.moderate")) return denied();
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
  // The creator hears the outcome, with the note, instead of discovering it.
  await notify.templateModerated(user, before.rows[0], rows[0]);
  return { success: true, template: { id, status, reviewNote: note } };
}

/* Feature flags change the whole site, so they stay with the owner. */
async function listFlags(user) {
  if (!isOwner(user)) return ownerOnly();
  const { rows } = await db.query(
    `select key, enabled, description, updated_at from public.feature_flags order by key`
  );
  return { success: true, flags: rows.map((r) => ({ key: r.key, enabled: r.enabled, description: r.description, updatedAt: r.updated_at })) };
}

async function setFlag(user, key, enabled) {
  if (!isOwner(user)) return ownerOnly();
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

/* ── Staff ────────────────────────────────────────────────────
   The owner appoints staff by giving an account one or more permissions,
   and removes them by taking every permission away. Nobody else can do
   either, the owner's own row cannot be changed here, and the audit log
   keeps who changed what. */
async function listStaff(user) {
  if (!isOwner(user)) return ownerOnly();
  const { rows } = await db.query(
    `select id, email, display_name, handle, role, staff_permissions, created_at
       from public.users
      where role = 'super_admin' or (role in ('moderator', 'admin') and cardinality(staff_permissions) > 0)
      order by (role = 'super_admin') desc, created_at asc`
  );
  return {
    success: true,
    permissions: permissions.PERMISSIONS,
    staff: rows.map((r) => ({
      id: r.id, email: r.email, displayName: r.display_name || "", handle: r.handle || "",
      role: r.role, owner: r.role === "super_admin", permissions: permissions.permissionsOf(r)
    }))
  };
}

async function setStaff(user, targetId, data) {
  if (!isOwner(user)) return ownerOnly();
  if (!validId(targetId)) return { error: "Account not found.", status: 404 };
  if (targetId === user.id) return { error: "Your own access cannot be changed here.", status: 400 };

  const granted = permissions.normalise(data?.permissions);
  return db.tx(async (client) => {
    const found = await client.query(
      `select id, role, staff_permissions, display_name, handle from public.users where id = $1 for update`,
      [targetId]
    );
    const target = found.rows[0];
    if (!target) return { error: "Account not found.", status: 404 };
    if (target.role === "super_admin") return { error: "The owner's access cannot be changed.", status: 400 };

    const role = granted.length ? "moderator" : "user";
    const { rows } = await client.query(
      `update public.users set role = $2, staff_permissions = $3::text[], updated_at = now()
        where id = $1 returning id, role, staff_permissions`,
      [targetId, role, granted]
    );
    await client.query(
      `insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, before_data, after_data)
       values ($1, 'staff_update', 'user', $2, $3::jsonb, $4::jsonb)`,
      [user.id, targetId,
       JSON.stringify({ role: target.role, permissions: target.staff_permissions || [] }),
       JSON.stringify({ role: rows[0].role, permissions: rows[0].staff_permissions })]
    );

    const labels = permissions.PERMISSIONS.filter((p) => granted.includes(p.key)).map((p) => p.label.toLowerCase());
    const hadAccess = (target.staff_permissions || []).length > 0 && target.role !== "user";
    const message = granted.length
      ? `You now have admin access: ${labels.join(", ")}. Open the Admin Console from the menu.`
      : hadAccess ? "Your admin access was removed." : "";
    if (message) {
      await client.query(
        `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
         values ($1, $2, 'system', 'admin', 'access', $3)`,
        [targetId, user.id, message]
      );
    }
    return {
      success: true,
      user: {
        id: rows[0].id, role: rows[0].role, permissions: rows[0].staff_permissions,
        displayName: target.display_name || "", handle: target.handle || ""
      }
    };
  });
}

async function audit(user, action, entityType, entityId, before, after) {
  await db.query(
    `insert into public.admin_audit_log
       (actor_id, action, entity_type, entity_id, before_data, after_data)
     values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
    [user.id, action, entityType, String(entityId || ""), JSON.stringify(before || null), JSON.stringify(after || null)]
  );
}

module.exports = {
  dashboard, listUsers, listContent, updateContent, listFlags, setFlag, listStaff, setStaff,
  isAdmin: permissions.isStaff, isSuperAdmin: isOwner
};
