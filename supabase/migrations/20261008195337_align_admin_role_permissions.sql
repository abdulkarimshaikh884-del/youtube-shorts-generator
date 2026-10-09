-- Match the CLOSED role and permission lists actually enforced by the server.
-- This does NOT grant staff access, change any user's role/permissions, expose
-- the private users table, or change RLS/SQL role privileges.
alter table public.users drop constraint if exists users_role_check;
alter table public.users add constraint users_role_check
  check (role in ('user', 'moderator', 'admin', 'sub_admin', 'super_admin', 'banned'));

alter table public.users drop constraint if exists users_staff_permissions_check;
alter table public.users add constraint users_staff_permissions_check
  check (staff_permissions <@ array[
    'overview.view',
    'users.view',
    'users.manage',
    'users.balance_adjust',
    'creators.verify',
    'team.manage',
    'templates.moderate',
    'tutorials.moderate',
    'reports.review',
    'comments.moderate',
    'stars.view',
    'stars.manage',
    'withdrawals.manage',
    'revenue.view',
    'star_packs.manage',
    'ai_jobs.view',
    'ai_jobs.retry',
    'credits.manage',
    'notifications.broadcast',
    'featured.manage',
    'challenges.manage',
    'achievements.manage',
    'referrals.view',
    'support.reply',
    'feedback.view',
    'flags.manage',
    'audit.view',
    'pricing.manage',
    'settings.manage'
  ]::text[]);

-- Rollback the application release without blindly shrinking these checks.
-- Re-applying the older six-permission/four-role checks would fail once a
-- legitimate sub_admin/ban/new permission exists; review data first instead.
