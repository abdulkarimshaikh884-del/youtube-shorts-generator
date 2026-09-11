-- Publishing kept only a fraction of what was edited.
--
-- The editor's unit of work is a clip: a template id plus a `props` object
-- holding every field the person actually changed — each text line, colours
-- per element, layout and scale choices, and references to images they
-- uploaded — plus the aspect ratio the project was composed at.
--
-- Publish sent, and this table stored, only tpl/lines/accent/font/dur. So a
-- creator could spend an hour on a template, publish it, open it back from the
-- gallery, and find their work reduced to the first three text lines over a
-- default arrangement. Nothing was corrupted; the detail page rebuilt the
-- template from the little that survived, which is why it looked like the
-- editor had silently reverted.
--
-- These two columns are what was missing. `props` is stored whole rather than
-- normalised because it is always read and written whole, and its shape is
-- owned by whichever template schema produced it.

alter table public.community_templates
  add column if not exists props jsonb not null default '{}'::jsonb;

alter table public.community_templates
  add column if not exists aspect text;

-- Only the four the composer can produce. Rows published before this migration
-- keep NULL, which readers treat as the 9:16 default they were built at.
alter table public.community_templates
  drop constraint if exists community_templates_aspect_valid;

alter table public.community_templates
  add constraint community_templates_aspect_valid
  check (aspect is null or aspect in ('9:16', '16:9', '1:1', '4:5'));

do $$
begin
  if exists (select 1 from pg_roles where rolname = 'shortscraft_app') then
    grant update (props, aspect) on public.community_templates to shortscraft_app;
  end if;
end $$;
