-- Private, bounded recovery for actual server-completed export referrals.
-- Apply after 20260930165509_referral_bonus_credits.sql, before opting in.
-- No public grants/policies or new reward rules are introduced here.
alter table public.referrals
  add column if not exists qualification_next_at timestamptz not null default now(),
  add column if not exists qualification_attempts integer not null default 0 check (qualification_attempts >= 0),
  add column if not exists qualification_error_code text;
create index if not exists referrals_pending_recovery_idx
  on public.referrals (qualification_next_at, created_at, invitee_id)
  where status = 'pending';
create index if not exists referrals_owner_history_idx
  on public.referrals (inviter_id, created_at desc, invitee_id desc);
create index if not exists credit_transactions_referral_export_idx
  on public.credit_transactions (user_id, created_at, id)
  where kind = 'export' and amount < 0;

-- Cross-IP cooldowns are account-bound and serialized with verify:<user id>.
-- No plaintext token, email address, IP address or device fingerprint is kept.
create table if not exists public.referral_verification_attempts (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  token_hash text not null check (token_hash ~ '^[a-f0-9]{64}$'),
  created_at timestamptz not null default now()
);
create index if not exists referral_verification_attempts_user_created_idx
  on public.referral_verification_attempts (user_id, created_at desc);
alter table public.referral_verification_attempts enable row level security;
revoke all on public.referral_verification_attempts from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant select, insert, delete on public.referral_verification_attempts to shortscraft_app;
  end if;
end $$;

-- Rollback code/REFERRALS_ENABLED to pause new awards; keep these additive
-- columns and earned bonus balances. There is no data-deleting rollback.
