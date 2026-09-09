-- Account-side projects.
--
-- Drafts have lived in localStorage since they were introduced, which the
-- drafts page discloses honestly. The account page, however, promises that
-- "Drafts and settings follow you to any device" — and the master plan (§11)
-- requires exactly that. This is the table that makes the promise true.
--
-- A project is small: a name, an aspect ratio and an ordered list of clips,
-- each a template id plus its props. It is stored as one jsonb document
-- rather than a clips table because it is always read and written whole, and
-- nothing queries inside it.

create table if not exists public.projects (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null default 'Untitled animation',
  aspect text not null default '9:16',
  clips jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- A project with no clips cannot be opened, so it should not be stored.
  constraint projects_clips_not_empty check (jsonb_array_length(clips) > 0)
);

-- Every read is "this account's projects, newest first".
create index if not exists projects_user_updated_idx
  on public.projects(user_id, updated_at desc);

alter table public.projects enable row level security;

-- Consistent with the rest of the schema: the browser never talks to Postgres
-- directly, and the application role bypasses RLS. Enabling it with no policy
-- means a leaked anon key still reads nothing.
