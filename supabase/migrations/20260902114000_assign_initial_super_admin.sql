-- ShortsCraft currently has one owner. Promote only the exact, verified
-- existing owner account; future owners are configured through
-- SUPER_ADMIN_EMAILS and are promoted after a valid signed-in session.
update public.users
   set role = 'super_admin', updated_at = now()
 where lower(email) = lower('karimabdul9065@gmail.com')
   and lower(handle) in ('karimabdul9065', '@karimabdul9065');
