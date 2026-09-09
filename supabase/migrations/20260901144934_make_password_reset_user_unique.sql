-- Exactly one active recovery token may exist per account. This lets the API
-- atomically replace an older link even when requests arrive concurrently.
drop index if exists public.password_reset_tokens_user_id_idx;
create unique index password_reset_tokens_user_id_key
  on public.password_reset_tokens (user_id);
