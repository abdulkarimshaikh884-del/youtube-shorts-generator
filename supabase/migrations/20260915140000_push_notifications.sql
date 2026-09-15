-- Notifications that reach a person's phone or computer.
--
-- The bell already reads public.notifications. Device delivery (Web Push) is
-- driven from the same table: a row is sent once, and pushed_at records that
-- it was, so every place in the app that creates a notification is delivered
-- without having to call anything extra.

alter table public.notifications add column if not exists pushed_at timestamptz;

-- Everything that existed before device delivery counts as already sent, so
-- turning this on does not replay a backlog to anyone's phone.
update public.notifications set pushed_at = created_at where pushed_at is null;

create index if not exists notifications_unpushed_idx
  on public.notifications(created_at) where pushed_at is null;

-- One row per browser or phone that agreed to receive notifications.
create table if not exists public.push_subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  endpoint text not null unique check (endpoint ~ '^https://' and length(endpoint) <= 1000),
  p256dh text not null check (length(p256dh) between 40 and 200),
  auth text not null check (length(auth) between 8 and 100),
  user_agent text not null default '' check (length(user_agent) <= 300),
  created_at timestamptz not null default now(),
  last_success_at timestamptz
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

-- The server's Web Push identity (VAPID key pair), created on first use
-- unless the environment provides one. Read only by the backend.
create table if not exists public.app_keys (
  name text primary key check (name ~ '^[a-z0-9_]{3,40}$'),
  value text not null,
  created_at timestamptz not null default now()
);

-- The app backend is the only data-plane client (see earlier migrations).
alter table public.push_subscriptions enable row level security;
alter table public.app_keys enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant select, insert, update, delete on public.push_subscriptions to shortscraft_app;
    grant select, insert on public.app_keys to shortscraft_app;
  end if;
end $$;
