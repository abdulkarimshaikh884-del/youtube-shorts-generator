begin;
select plan(15);
select ok(c.relrowsecurity, c.relname || ' has RLS')
from pg_class c join pg_namespace n on n.oid = c.relnamespace
where n.nspname = 'public' and c.relname in ('referrals','referral_codes','email_verification_tokens');
select ok(not has_table_privilege('anon', t.name, p.privilege)
          and not has_table_privilege('authenticated', t.name, p.privilege),
          t.name || ' denies browser ' || p.privilege)
from (values ('public.referrals'), ('public.referral_codes'), ('public.email_verification_tokens')) t(name)
cross join (values ('SELECT'), ('INSERT'), ('UPDATE'), ('DELETE')) p(privilege);
select * from finish();
rollback;
