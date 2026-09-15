-- Limited admin access for people the owner appoints.
--
-- The owner (role super_admin) holds every permission implicitly. A staff
-- member is role 'moderator' plus the specific permissions listed here; the
-- list is closed, so a typo or a forged value cannot grant anything the
-- server does not know how to enforce. Managing staff and feature flags is
-- never grantable and is not in the list.
alter table public.users
  add column if not exists staff_permissions text[] not null default '{}';

alter table public.users drop constraint if exists users_staff_permissions_check;
alter table public.users add constraint users_staff_permissions_check
  check (staff_permissions <@ array[
    'overview.view',
    'templates.moderate',
    'tutorials.moderate',
    'comments.moderate',
    'support.reply',
    'users.view'
  ]::text[]);
