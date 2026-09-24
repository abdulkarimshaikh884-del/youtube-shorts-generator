-- Generated design layers survive Render restarts. Only the server's
-- least-privilege database role can write or read these private objects.
create table if not exists public.design_assets (
  job_id text not null check (job_id ~ '^job_[a-f0-9]{32}$'),
  asset_path text not null check (asset_path ~ '^(original\.webp|assets/[a-zA-Z0-9_-]+\.webp)$'),
  user_id uuid not null references public.users(id) on delete cascade,
  content bytea not null,
  byte_size integer not null check (byte_size > 0 and byte_size <= 12582912),
  is_public boolean not null default false,
  created_at timestamptz not null default now(),
  primary key (job_id, asset_path)
);

create index if not exists design_assets_owner_idx
  on public.design_assets (user_id, created_at desc);

alter table public.design_assets enable row level security;
revoke all on public.design_assets from anon, authenticated;
do $$
begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant select, insert, update, delete on public.design_assets to shortscraft_app;
  end if;
end $$;
