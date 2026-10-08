-- Opt-in rollout: apply schema, verify ACLs, then enable TRANSACTIONAL_EMAILS_ENABLED.
-- Existing password-reset delivery is independent and remains available.
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  event_key text not null unique check (event_key ~ '^[a-f0-9]{64}$'),
  user_id uuid not null references public.users(id) on delete cascade,
  kind text not null check (kind in ('welcome','new_device','password_changed','google_linked','referral_reward','support_reply','template_status','purchase_receipt','withdrawal_requested','withdrawal_processed','withdrawal_rejected')),
  payload jsonb not null,
  priority integer not null default 1 check (priority in (0,1)),
  status text not null default 'pending' check (status in ('pending','sending','accepted','cancelled','review')),
  attempts integer not null default 0 check (attempts between 0 and 5),
  created_at timestamptz not null default now(),
  next_attempt_at timestamptz not null default now(),
  first_attempt_at timestamptz,
  last_attempt_at timestamptz,
  lease_until timestamptz,
  accepted_at timestamptz,
  provider_id text,
  last_error text
);
create index email_outbox_pending_idx on public.email_outbox(priority, next_attempt_at,created_at) where status in ('pending','sending');
create index email_outbox_budget_idx on public.email_outbox(first_attempt_at) where first_attempt_at is not null;
create index email_outbox_user_idx on public.email_outbox(user_id);
create index email_outbox_attempt_idx on public.email_outbox(last_attempt_at) where last_attempt_at is not null;
create table public.account_devices (
  user_id uuid not null references public.users(id) on delete cascade,
  device_hash text not null check (device_hash ~ '^[a-f0-9]{64}$'),
  browser_label text not null,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  primary key(user_id, device_hash)
);
alter table public.email_outbox enable row level security;
alter table public.account_devices enable row level security;
revoke all on public.email_outbox, public.account_devices from public, anon, authenticated;
do $$ begin
  if exists (select 1 from pg_roles where rolname='shortscraft_app') then
    grant select,insert,update,delete on public.email_outbox,public.account_devices to shortscraft_app;
  end if;
end $$;
