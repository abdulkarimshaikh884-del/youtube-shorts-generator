-- Uploaded Lottie animations.
--
-- A creator's upload is stored the moment it is recognised, before they have
-- written a title or chosen to publish: the upload screen previews the real
-- stored document, not a copy held in the browser. Publishing then creates a
-- community_templates row (source_format 'lottie_json') whose props name the
-- document here.
--
-- The document lives in its own table rather than community_templates.source_json
-- because template lists select whole rows, and a gallery page must not carry
-- several megabytes of animation per card. It is stored as text, exactly as
-- cleaned by lottie-inspect.js, so it is served byte-for-byte without being
-- parsed and re-serialised on every request.
--
-- The id is random and unguessable. A published template's document is public
-- by design; an unpublished upload is reachable only by someone holding its id.

create table if not exists public.lottie_docs (
  id text primary key check (id ~ '^[A-Za-z0-9_-]{16,64}$'),
  owner_id uuid not null references public.users(id) on delete cascade,
  doc text not null,
  meta jsonb not null,
  bytes integer not null check (bytes > 0 and bytes <= 8388608),
  sha256 text not null check (sha256 ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);

create index if not exists lottie_docs_owner_idx
  on public.lottie_docs(owner_id, created_at desc);

-- The same file uploaded twice by the same person is one document.
create unique index if not exists lottie_docs_owner_sha_idx
  on public.lottie_docs(owner_id, sha256);

-- The app backend is the only data-plane client (see earlier migrations).
alter table public.lottie_docs enable row level security;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant select, insert, delete on public.lottie_docs to shortscraft_app;
  end if;
end $$;
