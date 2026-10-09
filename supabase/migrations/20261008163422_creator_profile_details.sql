-- Additive only: existing profiles and custom-auth access rules are unchanged.
alter table public.users add column if not exists creator_details jsonb not null default '{}'::jsonb;
comment on column public.users.creator_details is 'Optional public creator profile details; not authorization, identity or payout information.';
do $$ begin
  if not exists (select 1 from pg_constraint where conname = 'users_creator_details_object' and conrelid = 'public.users'::regclass) then
    alter table public.users add constraint users_creator_details_object check (jsonb_typeof(creator_details) = 'object' and octet_length(creator_details::text) <= 4096);
  end if;
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant select (creator_details), update (creator_details) on public.users to shortscraft_app;
  end if;
end $$;
