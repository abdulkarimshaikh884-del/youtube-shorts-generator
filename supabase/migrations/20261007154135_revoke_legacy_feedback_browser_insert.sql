-- Retire the unused legacy direct-Data-API feedback write path. Current
-- /api/feedback creates support_tickets/support_messages through Express,
-- which provides validation and rate limiting; it never writes this table.
-- Keep existing rows, the RLS policy and all other privileges unchanged.
-- In particular, do not revoke the private service_role/backend grants.
REVOKE INSERT ON TABLE public.feedback FROM anon, authenticated, PUBLIC;

-- Rollback for the observed 2026-10-07 production ACL baseline:
--   GRANT INSERT ON TABLE public.feedback TO anon, authenticated;
-- That baseline had direct INSERT grants for postgres, anon, authenticated
-- and service_role, no PUBLIC INSERT grant and no column INSERT grants.
-- Recheck the ACL before a controlled production apply/rollback; do not add
-- a PUBLIC grant on rollback because none existed in the observed baseline.
