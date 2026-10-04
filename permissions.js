/* Who may do what in the admin console.

   There are three tiers of admin access:

   - The owner (role super_admin). Karim has permanent, immutable root authority.
     Holds every permission automatically. Only the owner can appoint staff,
     grant/revoke roles and permissions, configure finances, star packs, pricing,
     or toggle critical system settings. The owner cannot be demoted or edited.
   - Sub Admin (role sub_admin / admin). Holds broad operational defaults (users,
     creators, templates, reports, tutorials, challenges, support, notifications)
     and any additional permissions customized by the Owner. Cannot edit the Owner.
   - Moderator (role moderator). Community, content and safety focused (moderate
     templates, tutorials, reports, warn users, handle support). Defaults exclude
     financial data, star modifications, withdrawals, pricing, and system settings.

   Role gives default permissions, and the Owner can customize permissions per user.
   Every admin check on the server goes through `can` or `isOwner`. */

const PERMISSIONS = [
  // ── OVERVIEW ──
  { key: "overview.view", label: "Dashboard & Overview", group: "Overview", hint: "Totals for users, revenue, templates, conversions and open tickets." },

  // ── PEOPLE ──
  { key: "users.view", label: "View User Accounts", group: "People", hint: "Names, handles, plans, stars, and verification status. Emails hidden for staff." },
  { key: "users.manage", label: "Manage User Accounts", group: "People", hint: "Warn, suspend, or ban user accounts." },
  { key: "users.balance_adjust", label: "Manual Stars & Credits Adjustment", group: "People", hint: "Manually credit or debit stars and credits with mandatory audit reason." },
  { key: "creators.verify", label: "Verify & Manage Creators", group: "People", hint: "Review and grant verified creator badges and tiers." },
  { key: "team.manage", label: "Team & Roles Management", group: "People", hint: "Owner only: Appoint and manage Sub Admins, Moderators, and custom permissions." },

  // ── CONTENT ──
  { key: "templates.moderate", label: "Moderate Templates", group: "Content", hint: "Publish, reject with reason, feature, or archive creator templates." },
  { key: "tutorials.moderate", label: "Moderate Creator Tutorials", group: "Content", hint: "Approve, reject, or take down creator tutorials." },
  { key: "reports.review", label: "Review & Action Reports", group: "Content", hint: "Inspect user and content reports, take moderation action, and resolve." },
  { key: "comments.moderate", label: "Moderate Comments", group: "Content", hint: "Remove spam, offensive, or inappropriate comments." },

  // ── MONEY ──
  { key: "stars.view", label: "View Stars & Ledger", group: "Money", hint: "View star analytics, purchased vs earned breakdown, and full ledger." },
  { key: "stars.manage", label: "Reverse & Manage Star Transactions", group: "Money", hint: "Reverse star transactions with mandatory audit reason." },
  { key: "withdrawals.manage", label: "Approve & Process Withdrawals", group: "Money", hint: "Review payout requests, mark as paid with UTR/Ref, or reject with reason." },
  { key: "revenue.view", label: "View Revenue & Financials", group: "Money", hint: "Gross revenue, net revenue, platform fees, payouts, and financial metrics." },
  { key: "star_packs.manage", label: "Manage Star Packs", group: "Money", hint: "Configure prices, star quantities, bonus stars, and availability." },

  // ── PLATFORM ──
  { key: "ai_jobs.view", label: "Monitor AI & Conversion Jobs", group: "Platform", hint: "Monitor live Convert to Editable & AI generation jobs, durations, and errors." },
  { key: "ai_jobs.retry", label: "Retry / Cancel AI Jobs", group: "Platform", hint: "Manually retry or cancel failed AI conversion jobs." },
  { key: "credits.manage", label: "Manage Credit Allowances", group: "Platform", hint: "View global credit usage, allowances, and daily limits." },
  { key: "notifications.broadcast", label: "Send Broadcast Notifications", group: "Platform", hint: "Send mass notifications to all users, creators, or specific tiers." },
  { key: "featured.manage", label: "Manage Featured Content", group: "Platform", hint: "Configure featured templates, creators, and homepage announcements." },

  // ── ENGAGEMENT ──
  { key: "challenges.manage", label: "Manage Challenges & Missions", group: "Engagement", hint: "Create and manage creator challenges, submissions, and rewards." },
  { key: "achievements.manage", label: "Manage Achievements & Badges", group: "Engagement", hint: "Define achievements, badges, and automated reward criteria." },
  { key: "referrals.view", label: "View Referrals & Affiliates", group: "Engagement", hint: "Track referral conversions, rewards, and fraud prevention." },

  // ── SUPPORT ──
  { key: "support.reply", label: "Answer Support Tickets", group: "Support", hint: "Read user support tickets, reply, assign, and close tickets." },
  { key: "feedback.view", label: "View Community Feedback", group: "Support", hint: "Review user suggestions and platform feedback." },

  // ── SYSTEM ──
  { key: "flags.manage", label: "Manage Feature Flags", group: "System", hint: "Toggle live feature flags across the platform." },
  { key: "audit.view", label: "View Audit Logs", group: "System", hint: "Inspect immutable admin action audit trail." },
  { key: "pricing.manage", label: "Manage Subscription Plans", group: "System", hint: "Owner only: Configure Pro and Pro Max pricing and quotas." },
  { key: "settings.manage", label: "Manage System Settings", group: "System", hint: "Owner only: Global settings, platform fee %, withdrawal minimums." }
];

const KEYS = new Set(PERMISSIONS.map((p) => p.key));

const ROLE_PRESETS = {
  moderator: [
    "overview.view",
    "templates.moderate",
    "tutorials.moderate",
    "reports.review",
    "comments.moderate",
    "support.reply",
    "feedback.view",
    "users.view",
    "users.manage"
  ],
  sub_admin: [
    "overview.view",
    "users.view",
    "users.manage",
    "creators.verify",
    "templates.moderate",
    "tutorials.moderate",
    "reports.review",
    "comments.moderate",
    "support.reply",
    "feedback.view",
    "ai_jobs.view",
    "ai_jobs.retry",
    "credits.manage",
    "notifications.broadcast",
    "featured.manage",
    "challenges.manage",
    "achievements.manage",
    "referrals.view",
    "stars.view",
    "audit.view"
  ]
};

function isOwner(user) {
  return Boolean(user && user.role === "super_admin");
}

/* Permissions exactly as stored, filtered to known keys. Accepts either a
   database row (staff_permissions) or a public user (permissions). */
function storedPermissions(user) {
  const raw = user && (user.staff_permissions || user.staffPermissions);
  return Array.isArray(raw) ? raw.filter((k) => KEYS.has(k)) : [];
}

function permissionsOf(user) {
  if (!user) return [];
  if (isOwner(user)) return PERMISSIONS.map((p) => p.key);
  if (user.role !== "moderator" && user.role !== "admin" && user.role !== "sub_admin") return [];
  return storedPermissions(user);
}

function can(user, permission) {
  if (!user) return false;
  if (isOwner(user)) return true;
  if (!KEYS.has(permission)) return false;
  return permissionsOf(user).includes(permission);
}

/* Anyone who should see the admin console at all. */
function isStaff(user) {
  return isOwner(user) || permissionsOf(user).length > 0;
}

/* Cleans a requested permission list: unknown keys dropped, duplicates
   removed, order fixed so the stored value is stable. */
function normalise(list) {
  const wanted = new Set(Array.isArray(list) ? list.map(String) : []);
  return PERMISSIONS.map((p) => p.key).filter((k) => wanted.has(k));
}

module.exports = {
  PERMISSIONS,
  ROLE_PRESETS,
  can,
  isOwner,
  isStaff,
  permissionsOf,
  normalise
};
