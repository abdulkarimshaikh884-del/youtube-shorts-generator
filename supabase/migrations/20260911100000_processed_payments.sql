-- One payment, one entitlement.
--
-- The verification route checked the signature, re-read the order from the
-- gateway and confirmed it was paid — all correct — and then granted the plan
-- unconditionally. Nothing recorded that a payment had already been delivered,
-- so the same signed order replayed twice granted twice, and because the
-- expiry is computed from the moment of each call, replaying it a day later
-- extended the subscription by a day. A double-submit, a retried request or a
-- refreshed success page was enough; no attack required.
--
-- The gateway's own payment id is the primary key, which makes the database
-- the thing that decides whether a payment has been seen before. Two
-- concurrent verifications of one payment cannot both win that insert, so the
-- entitlement can only be granted once without any locking in the route.

create table if not exists public.processed_payments (
  payment_id text primary key,
  order_id text not null,
  user_id uuid not null references public.users(id) on delete cascade,
  plan text not null,
  term text not null,
  amount_paise integer,
  created_at timestamptz not null default now()
);

-- "What did this account pay, and when" — for support answering a billing
-- question, and for reconciling against the gateway.
create index if not exists processed_payments_user_idx
  on public.processed_payments(user_id, created_at desc);

alter table public.processed_payments enable row level security;
revoke all on public.processed_payments from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant select, insert, delete on public.processed_payments to shortscraft_app;
  end if;
end $$;
