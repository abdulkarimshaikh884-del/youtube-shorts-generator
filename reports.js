/* ============================================================
   reports.js — "Report" on templates, tutorials, creators and comments.

   Anyone may report, signed in or not: the person who notices a stolen
   template is often a visitor, and asking them to make an account first means
   the report never arrives. Abuse is limited three ways: the route is rate
   limited, one person can hold only one open report per item (enforced by a
   unique index on a hash of their session), and the item must exist.

   Reports reach the owner and staff with the reports.review permission as a
   notification. Staff read and close them from the admin console.
   ============================================================ */
const db = require("./db");
const notify = require("./notify");
const permissions = require("./permissions");
const community = require("./community");

const REASONS = {
  copyright: "Copyright or stolen work",
  inappropriate: "Inappropriate content",
  spam: "Spam or misleading",
  impersonation: "Pretending to be someone else",
  broken: "Broken or not working",
  other: "Something else"
};
const TARGETS = {
  template: "template",
  tutorial: "tutorial",
  creator: "creator profile",
  comment: "comment"
};

async function targetExists(type, id) {
  if (type === "template") return community.isPublicTemplateKey(id);
  if (type === "tutorial") {
    const r = await db.query(`select 1 from public.creator_skills where id = $1 and status = 'published'`, [id]);
    return r.rowCount > 0;
  }
  if (type === "creator") {
    const r = await db.query(
      `select 1 from public.users where lower(replace(coalesce(handle, ''), '@', '')) = lower(replace($1, '@', ''))`, [id]);
    return r.rowCount > 0;
  }
  if (type === "comment") {
    const r = await db.query(`select 1 from public.template_comments where id::text = $1`, [id]);
    return r.rowCount > 0;
  }
  return false;
}

async function create(user, reporterHash, body) {
  const type = String(body?.targetType || "").trim();
  const id = String(body?.targetId || "").trim().slice(0, 120);
  const reason = String(body?.reason || "").trim();
  const details = String(body?.details || "").trim().slice(0, 1000);
  if (!TARGETS[type] || !id) return { error: "Nothing to report.", status: 400 };
  if (!REASONS[reason]) return { error: "Choose a reason for the report.", status: 400 };
  if (reason === "other" && details.length < 5) return { error: "Tell us a little about the problem.", status: 400 };
  if (!/^[a-f0-9]{32}$/.test(String(reporterHash || ""))) return { error: "Could not send the report.", status: 400 };
  if (!(await targetExists(type, id))) return { error: "That item no longer exists.", status: 404 };

  try {
    const { rows } = await db.query(
      `insert into public.content_reports
         (target_type, target_id, template_id, reason, details, reporter_id, reporter_hash)
       values ($1, $2, $3, $4, $5, $6, $7)
       returning id`,
      [type, id, type === "template" ? id : null, reason, details, user?.id || null, reporterHash]
    );
    await notify.toStaff(null, "reports.review", {
      actorId: user?.id || null,
      entityType: "report",
      entityId: rows[0].id,
      message: `New report on a ${TARGETS[type]}: ${REASONS[reason]}.`
    }).catch((err) => console.error("[reports] notify", err.message));
    return { success: true };
  } catch (err) {
    // Already reported by this person and still open: the same answer as a
    // new report, so a second tap is not an error.
    if (err.code === "23505") return { success: true, already: true };
    throw err;
  }
}

function templateLink(id, tpl) {
  if (String(id).startsWith("comm_")) {
    return tpl ? "/template?id=" + encodeURIComponent(tpl) + "&comm=1&commId=" + encodeURIComponent(id) : "/animations";
  }
  return "/template?id=" + encodeURIComponent(id);
}
function linkFor(r) {
  if (r.target_type === "template") return templateLink(r.target_id, r.comm_tpl);
  if (r.target_type === "tutorial") return r.tutorial_url || "/community";
  if (r.target_type === "creator") return "/creator?handle=" + encodeURIComponent(String(r.target_id).replace(/^@/, ""));
  if (r.target_type === "comment" && r.comment_template) return templateLink(r.comment_template, null) + "#comments";
  return "/admin";
}

function canReview(user) {
  return permissions.can(user, "reports.review");
}

async function list(user, status = "open") {
  if (!canReview(user)) return { error: "Admin access required.", status: 403 };
  const wanted = ["open", "reviewing", "actioned", "dismissed"].includes(status) ? status : "open";
  const { rows } = await db.query(
    `select r.id, r.target_type, r.target_id, r.reason, r.details, r.status, r.resolution,
            r.created_at, r.resolved_at, u.handle as reporter_handle,
            ct.tpl as comm_tpl, ct.title as comm_title,
            s.url as tutorial_url, s.title as tutorial_title,
            tc.tpl_id as comment_template
       from public.content_reports r
       left join public.users u on u.id = r.reporter_id
       left join public.community_templates ct on r.target_type = 'template' and ct.id = r.target_id
       left join public.creator_skills s on r.target_type = 'tutorial' and s.id = r.target_id
       left join public.template_comments tc on r.target_type = 'comment' and tc.id::text = r.target_id
      where r.status = $1
      order by r.created_at ${wanted === "open" ? "asc" : "desc"}
      limit 200`,
    [wanted]
  );
  return {
    reports: rows.map((r) => ({
      id: r.id,
      targetType: r.target_type,
      targetId: r.target_id,
      reason: r.reason,
      reasonLabel: REASONS[r.reason] || r.reason,
      details: r.details || "",
      status: r.status,
      resolution: r.resolution || "",
      reporter: r.reporter_handle ? "@" + String(r.reporter_handle).replace(/^@/, "") : "Visitor",
      title: r.comm_title || r.tutorial_title || r.target_id,
      link: linkFor(r),
      createdAt: r.created_at,
      resolvedAt: r.resolved_at
    }))
  };
}

async function resolve(user, id, status, resolution) {
  if (!canReview(user)) return { error: "Admin access required.", status: 403 };
  if (!["actioned", "dismissed", "reviewing"].includes(status)) {
    return { error: "A report is marked reviewing, actioned or dismissed.", status: 400 };
  }
  const { rows } = await db.query(
    `update public.content_reports
        set status = $2, resolution = $3, resolved_by = $4,
            resolved_at = case when $2 = 'reviewing' then null else now() end
      where id::text = $1
      returning id`,
    [String(id), status, String(resolution || "").slice(0, 500), user.id]
  );
  if (!rows.length) return { error: "That report no longer exists.", status: 404 };
  return { success: true };
}

module.exports = { create, list, resolve, REASONS, TARGETS };
