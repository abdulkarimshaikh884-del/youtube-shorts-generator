-- Additive change only. Existing users, passwords, roles and entitlements remain.
-- Uses the existing server-only users table and its RLS/access restrictions.
begin;
alter table public.users add column if not exists google_sub text;
create unique index if not exists users_google_sub_unique
  on public.users (google_sub) where google_sub is not null;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant update (google_sub) on public.users to shortscraft_app;
  end if;
end $$;
commit;
