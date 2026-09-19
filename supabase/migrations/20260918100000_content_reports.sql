-- Reports about any content, not only templates (launch checklist phases 3
-- and 21): a template, tutorial, creator profile or comment that someone
-- believes is stolen, inappropriate, spam, an impersonation or broken.
--
-- content_reports already existed from the platform foundation migration,
-- keyed to template_id only and never written to (0 rows when this ran). It
-- is widened in place so admin.js's open-report count keeps working.
--
-- Anyone can report, signed in or not. A signed-in report carries the
-- reporter's id; every report carries a hash of the visitor's session so one
-- person cannot pile the same open report onto one item.

alter table public.content_reports
  add column if not exists target_type text not null default 'template',
  add column if not exists target_id text,
  add column if not exists reporter_hash text;

update public.content_reports set target_id = template_id where target_id is null;

alter table public.content_reports alter column target_id set not null;
alter table public.content_reports alter column template_id drop not null;

alter table public.content_reports drop constraint if exists content_reports_target_type_check;
alter table public.content_reports add constraint content_reports_target_type_check
  check (target_type in ('template', 'tutorial', 'creator', 'comment'));

alter table public.content_reports drop constraint if exists content_reports_target_id_check;
alter table public.content_reports add constraint content_reports_target_id_check
  check (char_length(target_id) between 1 and 120);

alter table public.content_reports drop constraint if exists content_reports_reason_check;
alter table public.content_reports add constraint content_reports_reason_check
  check (reason in ('copyright', 'inappropriate', 'spam', 'impersonation', 'broken', 'abuse', 'unsafe', 'other'));

alter table public.content_reports drop constraint if exists content_reports_details_check;
alter table public.content_reports add constraint content_reports_details_check
  check (details is null or char_length(details) <= 1000);

alter table public.content_reports drop constraint if exists content_reports_reporter_hash_check;
alter table public.content_reports add constraint content_reports_reporter_hash_check
  check (reporter_hash is null or reporter_hash ~ '^[a-f0-9]{32}$');

create index if not exists content_reports_target_idx
  on public.content_reports(target_type, target_id);

-- One open report per person per item. A closed report does not block a new one.
create unique index if not exists content_reports_open_once_idx
  on public.content_reports(target_type, target_id, reporter_hash)
  where status in ('open', 'reviewing') and reporter_hash is not null;

do $$ begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant select, insert, update on public.content_reports to shortscraft_app;
  end if;
end $$;
