-- ShortsCraft product-platform foundation.
-- The browser never connects to these tables directly. The Express backend
-- uses the least-privilege shortscraft_app role and performs authorization.

alter table public.users
  add column if not exists avatar_bytes bytea,
  add column if not exists avatar_mime text,
  add column if not exists website text not null default '',
  add column if not exists location text not null default '',
  add column if not exists verified boolean not null default false,
  add column if not exists role text not null default 'user',
  add column if not exists billing_cycle text,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.users add constraint users_role_check
    check (role in ('user', 'moderator', 'admin', 'super_admin'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.users add constraint users_billing_cycle_check
    check (billing_cycle is null or billing_cycle in ('monthly', 'yearly'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.users add constraint users_avatar_mime_check
    check (avatar_mime is null or avatar_mime in ('image/jpeg', 'image/png', 'image/webp'));
exception when duplicate_object then null; end $$;

alter table public.credits
  add column if not exists period_kind text not null default 'day',
  add column if not exists allowance integer not null default 0,
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.credits add constraint credits_period_kind_check
    check (period_kind in ('day', 'month'));
exception when duplicate_object then null; end $$;

create table if not exists public.credit_transactions (
  id uuid primary key default gen_random_uuid(),
  credit_key text not null,
  user_id uuid references public.users(id) on delete set null,
  kind text not null,
  amount integer not null,
  balance_after integer not null check (balance_after >= 0),
  idempotency_key text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint credit_transactions_kind_check check
    (kind in ('grant', 'export', 'ai_standard', 'ai_detailed', 'ai_advanced', 'refund', 'admin_adjustment')),
  constraint credit_transactions_amount_check check (amount <> 0)
);
create unique index if not exists credit_transactions_idempotency_idx
  on public.credit_transactions(idempotency_key)
  where idempotency_key is not null;
create index if not exists credit_transactions_key_created_idx
  on public.credit_transactions(credit_key, created_at desc);

create table if not exists public.template_reactions (
  user_id uuid not null references public.users(id) on delete cascade,
  template_id text not null,
  reaction text not null check (reaction in ('like', 'save')),
  created_at timestamptz not null default now(),
  primary key (user_id, template_id, reaction)
);
create index if not exists template_reactions_template_idx
  on public.template_reactions(template_id, reaction);

create table if not exists public.template_events (
  id bigserial primary key,
  template_id text not null,
  user_id uuid references public.users(id) on delete set null,
  event_type text not null check (event_type in ('view', 'open', 'edit', 'export', 'share')),
  session_hash text,
  idempotency_key text,
  created_at timestamptz not null default now()
);
create unique index if not exists template_events_idempotency_idx
  on public.template_events(idempotency_key)
  where idempotency_key is not null;
create index if not exists template_events_rank_idx
  on public.template_events(template_id, event_type, created_at desc);

alter table public.template_comments
  add column if not exists author_id uuid references public.users(id) on delete set null,
  add column if not exists parent_id text references public.template_comments(id) on delete cascade,
  add column if not exists status text not null default 'visible',
  add column if not exists updated_at timestamptz not null default now();

do $$ begin
  alter table public.template_comments add constraint template_comments_status_check
    check (status in ('visible', 'hidden', 'removed'));
exception when duplicate_object then null; end $$;

create index if not exists template_comments_tpl_visible_idx
  on public.template_comments(tpl_id, created_at desc)
  where status = 'visible';

create table if not exists public.user_follows (
  follower_id uuid not null references public.users(id) on delete cascade,
  followed_id uuid not null references public.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (follower_id, followed_id),
  constraint user_follows_no_self check (follower_id <> followed_id)
);
create index if not exists user_follows_followed_idx
  on public.user_follows(followed_id, created_at desc);

create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  actor_id uuid references public.users(id) on delete set null,
  type text not null check (type in ('follow', 'like', 'comment', 'star', 'template_status', 'support_reply', 'system')),
  entity_type text,
  entity_id text,
  message text not null default '',
  read_at timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notifications_user_created_idx
  on public.notifications(user_id, created_at desc);

create table if not exists public.star_transactions (
  id uuid primary key default gen_random_uuid(),
  sender_id uuid references public.users(id) on delete set null,
  receiver_id uuid not null references public.users(id) on delete cascade,
  amount integer not null check (amount > 0 and amount <= 100),
  kind text not null check (kind in ('monthly_grant', 'donation', 'refund', 'admin_adjustment')),
  period_key text,
  idempotency_key text,
  note text not null default '',
  created_at timestamptz not null default now(),
  constraint star_transactions_no_self check (sender_id is null or sender_id <> receiver_id)
);
create unique index if not exists star_transactions_idempotency_idx
  on public.star_transactions(idempotency_key)
  where idempotency_key is not null;
create index if not exists star_transactions_sender_idx
  on public.star_transactions(sender_id, created_at desc);
create index if not exists star_transactions_receiver_idx
  on public.star_transactions(receiver_id, created_at desc);

alter table public.community_templates
  add column if not exists source_format text not null default 'shortscraft_preset',
  add column if not exists source_json jsonb,
  add column if not exists status text not null default 'published',
  add column if not exists scheduled_at timestamptz,
  add column if not exists published_at timestamptz,
  add column if not exists reviewed_at timestamptz,
  add column if not exists review_note text not null default '',
  add column if not exists updated_at timestamptz not null default now();

update public.community_templates
   set published_at = coalesce(published_at, created_at)
 where status = 'published';

do $$ begin
  alter table public.community_templates add constraint community_templates_status_check
    check (status in ('draft', 'scheduled', 'review', 'published', 'rejected', 'archived'));
exception when duplicate_object then null; end $$;

do $$ begin
  alter table public.community_templates add constraint community_templates_format_check
    check (source_format in ('shortscraft_preset', 'lottie_json'));
exception when duplicate_object then null; end $$;

create index if not exists community_templates_status_publish_idx
  on public.community_templates(status, published_at desc);

create table if not exists public.support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete set null,
  email text not null,
  subject text not null,
  category text not null check (category in ('account', 'billing', 'export', 'template', 'report', 'other')),
  priority text not null default 'normal' check (priority in ('low', 'normal', 'high', 'urgent')),
  status text not null default 'open' check (status in ('open', 'waiting_on_user', 'in_progress', 'resolved', 'closed')),
  assigned_to uuid references public.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists support_tickets_status_created_idx
  on public.support_tickets(status, created_at asc);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  ticket_id uuid not null references public.support_tickets(id) on delete cascade,
  author_id uuid references public.users(id) on delete set null,
  author_role text not null check (author_role in ('user', 'admin', 'system')),
  body text not null,
  created_at timestamptz not null default now()
);
create index if not exists support_messages_ticket_idx
  on public.support_messages(ticket_id, created_at asc);

create table if not exists public.content_reports (
  id uuid primary key default gen_random_uuid(),
  reporter_id uuid references public.users(id) on delete set null,
  template_id text not null,
  reason text not null check (reason in ('copyright', 'spam', 'abuse', 'unsafe', 'other')),
  details text not null default '',
  status text not null default 'open' check (status in ('open', 'reviewing', 'actioned', 'dismissed')),
  resolved_by uuid references public.users(id) on delete set null,
  resolution text not null default '',
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists content_reports_status_created_idx
  on public.content_reports(status, created_at asc);

create table if not exists public.feature_flags (
  key text primary key,
  enabled boolean not null default false,
  description text not null default '',
  updated_by uuid references public.users(id) on delete set null,
  updated_at timestamptz not null default now()
);

insert into public.feature_flags (key, enabled, description) values
  ('creator_monetization', false, 'Creator revenue and payout tools'),
  ('paid_ai_models', false, 'Paid model routing for subscribed plans'),
  ('public_lottie_uploads', false, 'Strict validated Lottie JSON uploads')
on conflict (key) do nothing;

create table if not exists public.admin_audit_log (
  id bigserial primary key,
  actor_id uuid references public.users(id) on delete set null,
  action text not null,
  entity_type text not null,
  entity_id text,
  before_data jsonb,
  after_data jsonb,
  ip_hash text,
  created_at timestamptz not null default now()
);
create index if not exists admin_audit_log_created_idx
  on public.admin_audit_log(created_at desc);

-- The app backend is the only data-plane client. Keep new tables unavailable
-- through the Supabase Data API even if they are in the public schema.
alter table public.credit_transactions enable row level security;
alter table public.template_reactions enable row level security;
alter table public.template_events enable row level security;
alter table public.user_follows enable row level security;
alter table public.notifications enable row level security;
alter table public.star_transactions enable row level security;
alter table public.support_tickets enable row level security;
alter table public.support_messages enable row level security;
alter table public.content_reports enable row level security;
alter table public.feature_flags enable row level security;
alter table public.admin_audit_log enable row level security;

revoke all on public.credit_transactions, public.template_reactions,
  public.template_events, public.user_follows, public.notifications,
  public.star_transactions, public.support_tickets, public.support_messages,
  public.content_reports, public.feature_flags, public.admin_audit_log
  from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant select, insert, update, delete on public.credit_transactions,
      public.template_reactions, public.template_events, public.user_follows,
      public.notifications, public.star_transactions, public.support_tickets,
      public.support_messages, public.content_reports, public.feature_flags,
      public.admin_audit_log to shortscraft_app;
    grant usage, select on all sequences in schema public to shortscraft_app;
    grant update (avatar_bytes, avatar_mime, website, location, verified, role,
      billing_cycle, updated_at) on public.users to shortscraft_app;
    grant update (period_kind, allowance, updated_at) on public.credits to shortscraft_app;
    grant update (author_id, parent_id, status, updated_at) on public.template_comments to shortscraft_app;
    grant update (source_format, source_json, status, scheduled_at, published_at,
      reviewed_at, review_note, updated_at) on public.community_templates to shortscraft_app;
  end if;
end $$;
