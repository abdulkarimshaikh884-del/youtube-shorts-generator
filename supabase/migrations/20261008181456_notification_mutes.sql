-- Custom server-auth accounts only; never exposed through the public Data API.
create table if not exists public.notification_mutes (
  user_id uuid not null references public.users(id) on delete cascade,
  type text not null check (type in ('follow','like','comment','star','template_status','support_reply','system')),
  entity_type text not null default '' check (length(entity_type) <= 80),
  created_at timestamptz not null default now(),
  primary key (user_id, type, entity_type)
);
alter table public.notification_mutes enable row level security;
revoke all on public.notification_mutes from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant select, insert, delete on public.notification_mutes to shortscraft_app;
  end if;
end $$;
comment on table public.notification_mutes is 'Account-owned alert category mutes. Historical items remain available; future in-app alerts and Web Push are silent. Email security messages are unaffected.';
