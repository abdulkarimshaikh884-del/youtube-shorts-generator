-- ============================================================
-- 20260920000000_design_projects_and_templates.sql
-- Design Projects, Design Templates & AI Conversion Jobs
-- ============================================================

-- 1. Account-side Design Projects (Thumbnails, Posters, Logos, Social Posts, Banners)
create table if not exists public.design_projects (
  id text primary key,
  user_id uuid not null references public.users(id) on delete cascade,
  name text not null default 'Untitled Design',
  design_type text not null default 'youtube-thumbnail',
  canvas jsonb not null default '{"width": 1280, "height": 720}'::jsonb,
  source jsonb not null default '{"type": "scratch"}'::jsonb,
  elements jsonb not null default '[]'::jsonb,
  preview_url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint design_projects_name_length check (char_length(name) <= 100)
);

create index if not exists design_projects_user_updated_idx
  on public.design_projects(user_id, updated_at desc);

-- 2. Community & Official Design Templates
create table if not exists public.design_templates (
  id text primary key,
  author_id uuid references public.users(id) on delete set null,
  author_name text not null default 'ShortsCraft Official',
  author_handle text not null default '@shortscraft',
  title text not null,
  description text default '',
  category text not null default 'youtube-thumbnail',
  design_type text not null default 'youtube-thumbnail',
  source_type text not null default 'shortscraft_official', -- 'shortscraft_official', 'creator_original', 'creator_ai_converted', 'image'
  parent_template_id text references public.design_templates(id) on delete set null,
  canvas jsonb not null default '{"width": 1280, "height": 720}'::jsonb,
  elements jsonb not null default '[]'::jsonb,
  preview_url text,
  likes integer not null default 0,
  uses integer not null default 0,
  status text not null default 'published', -- 'published', 'draft', 'unlisted'
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists design_templates_cat_status_idx
  on public.design_templates(category, status, created_at desc);

-- 3. AI Conversion Jobs Ledger (tracks upload -> analysis -> layers -> project)
create table if not exists public.design_conversion_jobs (
  id text primary key,
  user_id uuid references public.users(id) on delete cascade,
  status text not null default 'queued', -- 'queued', 'analyzing', 'detecting_text', 'segmenting_objects', 'reconstructing_background', 'complete', 'failed'
  progress integer not null default 0,
  design_type text not null default 'youtube-thumbnail',
  source_image_name text not null,
  source_asset_path text,
  result_project_id text references public.design_projects(id) on delete set null,
  result_project jsonb,
  error_message text,
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists design_conversion_jobs_user_created_idx
  on public.design_conversion_jobs(user_id, created_at desc);

alter table public.design_projects enable row level security;
alter table public.design_templates enable row level security;
alter table public.design_conversion_jobs enable row level security;
