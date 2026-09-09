-- users_email_lower_unique now provides both lookup acceleration and the
-- uniqueness guarantee, so retaining the older non-unique copy only adds
-- storage and write overhead.
drop index if exists public.users_email_lower_idx;
