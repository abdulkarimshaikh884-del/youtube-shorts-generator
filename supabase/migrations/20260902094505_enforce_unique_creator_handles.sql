-- Handles are public account identifiers. Application-side availability
-- checks give a friendly error, while this index closes the concurrent-update
-- race and keeps search/profile URLs unambiguous.
create unique index if not exists users_handle_lower_unique
  on public.users (lower(handle))
  where nullif(trim(handle), '') is not null;
