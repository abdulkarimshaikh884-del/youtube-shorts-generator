-- Creator skill videos.
--
-- The community page used to be a second template grid. Every template on it
-- already appeared in the main library, by the same author, on an identical
-- card — so the page carried nothing the home page did not. This table is what
-- replaces that content: tutorials and teaching videos made by creators.
--
-- The video itself is never stored here, only a link to it. Hosting video
-- would mean storage, bandwidth and transcoding for a product whose payments
-- are not open yet — but the stronger reason is that a creator submits a
-- tutorial to be seen. Views belong on their channel, which is the thing they
-- are actually being paid in.

create table if not exists public.creator_skills (
  id text primary key,
  author_id uuid not null references public.users(id) on delete cascade,

  title text not null,
  summary text not null default '',
  url text not null,

  -- Parsed out of the URL on submit so a listing never has to re-parse, and
  -- so the same video cannot be submitted twice under two URL spellings
  -- (youtu.be/X, watch?v=X, and shorts/X are all the same video).
  platform text not null,
  video_key text not null,

  -- Which template the video teaches, when it teaches one. Free text rather
  -- than a foreign key: the library lives in templates-v2.js, not in a table,
  -- and a renamed template must not delete somebody's tutorial.
  template_id text,

  status text not null default 'pending',
  review_note text,
  reviewed_at timestamptz,
  reviewed_by uuid references public.users(id) on delete set null,

  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint creator_skills_status_valid
    check (status in ('pending', 'published', 'rejected')),
  constraint creator_skills_platform_valid
    check (platform in ('youtube', 'instagram')),
  constraint creator_skills_title_not_blank
    check (length(btrim(title)) > 0)
);

-- Anyone can submit a link to anyone's video, so the same video arriving twice
-- is the ordinary case, not an edge one. Refusing it at the database means no
-- request has to check first and then race with another.
create unique index if not exists creator_skills_video_unique
  on public.creator_skills(platform, video_key);

-- The public page reads "published, newest first" and nothing else.
create index if not exists creator_skills_published_idx
  on public.creator_skills(status, created_at desc);

-- The author's own list, and the admin queue, are both "by one column, newest
-- first" over a small slice.
create index if not exists creator_skills_author_idx
  on public.creator_skills(author_id, created_at desc);

-- Consistent with the rest of the schema: the browser never talks to Postgres
-- directly, and the application role bypasses RLS. Enabling it with no policy
-- means a leaked anon key still reads nothing.
alter table public.creator_skills enable row level security;
revoke all on public.creator_skills from anon, authenticated;

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant select, insert, update, delete on public.creator_skills to shortscraft_app;
  end if;
end $$;
