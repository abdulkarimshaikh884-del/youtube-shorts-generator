-- ShortsCraft database hardening (prepared for the next controlled deploy).
--
-- The main ShortsCraft server uses a dedicated Postgres role and custom
-- sessions. Server-only tables intentionally keep RLS enabled with no Data API
-- policies, which makes anon/authenticated requests deny by default.

-- Cover every user foreign key reported by the Supabase performance advisor.
create index if not exists feedback_user_id_idx on public.feedback (user_id);
create index if not exists history_user_id_idx on public.history (user_id);
create index if not exists saved_scripts_user_id_idx on public.saved_scripts (user_id);
create index if not exists script_history_user_id_idx on public.script_history (user_id);
create index if not exists waitlist_user_id_idx on public.waitlist (user_id);

-- Legacy Supabase-Auth policies: evaluate auth.uid() once per statement instead
-- of once per row. Keep the original access rules unchanged.
alter policy "users can read own profile" on public.profiles
  using ((select auth.uid()) = id);
alter policy "users can insert own profile" on public.profiles
  with check ((select auth.uid()) = id);
alter policy "users can update own profile" on public.profiles
  using ((select auth.uid()) = id)
  with check ((select auth.uid()) = id);

alter policy "users can read own history" on public.history
  using ((select auth.uid()) = user_id);
alter policy "users can insert own history" on public.history
  with check ((select auth.uid()) = user_id);
alter policy "users can delete own history" on public.history
  using ((select auth.uid()) = user_id);

-- This broad legacy policy duplicates the three explicit saved-script rules.
drop policy if exists "Users see own saved" on public.saved_scripts;
alter policy "users can read own saved scripts" on public.saved_scripts
  using ((select auth.uid()) = user_id);
alter policy "users can insert own saved scripts" on public.saved_scripts
  with check ((select auth.uid()) = user_id);
alter policy "users can delete own saved scripts" on public.saved_scripts
  using ((select auth.uid()) = user_id);

alter policy "Users see own history" on public.script_history
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

-- Remove three obsolete ShortsCraft seed cards whose underlying built-in
-- templates no longer exist. They have no creator owner or engagement; the
-- server already hides them, so this only stops repeated stale-row warnings.
delete from public.community_templates
where author_id is null
  and author_handle = 'shortscraft'
  and likes = 0
  and downloads = 0
  and (id, tpl) in (
    ('comm_crypto_card', 'money-crypto-surge'),
    ('comm_neon_ring', 'charts-ring'),
    ('comm_paper_torn', 'paper-torn-rip')
  );
