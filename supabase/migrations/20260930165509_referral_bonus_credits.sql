-- Enable REFERRALS_ENABLED only after applying and checking this migration.
-- Custom server sessions are used; these tables are never accessible to anon.
alter table public.users add column if not exists email_verified_at timestamptz;
alter table public.credits add column if not exists bonus_credits integer not null default 0 check (bonus_credits >= 0);

create table public.referral_codes (
  user_id uuid primary key references public.users(id) on delete cascade,
  code text not null unique check (code ~ '^[A-Za-z0-9_-]{16}$'),
  created_at timestamptz not null default now()
);
create table public.referrals (
  invitee_id uuid primary key references public.users(id) on delete cascade,
  inviter_id uuid not null references public.users(id) on delete cascade,
  status text not null default 'pending' check (status in ('pending','rewarded','limited')),
  first_export_id uuid references public.credit_transactions(id) on delete set null,
  created_at timestamptz not null default now(),
  rewarded_at timestamptz,
  check (inviter_id <> invitee_id)
);
create index referrals_inviter_status_idx on public.referrals (inviter_id, status, rewarded_at);
create table public.email_verification_tokens (
  token_hash text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  email text not null,
  expires_at timestamptz not null,
  created_at timestamptz not null default now()
);
create index email_verification_tokens_user_idx on public.email_verification_tokens(user_id);

alter table public.referral_codes enable row level security;
alter table public.referrals enable row level security;
alter table public.email_verification_tokens enable row level security;
revoke all on public.referral_codes, public.referrals, public.email_verification_tokens from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant select, insert, update, delete on public.referral_codes, public.referrals, public.email_verification_tokens to shortscraft_app;
  end if;
end $$;
