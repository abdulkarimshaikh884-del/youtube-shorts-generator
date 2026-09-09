create table if not exists public.password_reset_tokens (
  token_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists password_reset_tokens_user_id_idx
  on public.password_reset_tokens(user_id);
create index if not exists password_reset_tokens_expires_at_idx
  on public.password_reset_tokens(expires_at);

alter table public.password_reset_tokens enable row level security;
revoke all on table public.password_reset_tokens from public, anon, authenticated;
grant select, insert, update, delete on table public.password_reset_tokens to shortscraft_app;
