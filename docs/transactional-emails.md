# Transactional emails — 8 October 2026

The owner confirmed one **live password-reset email reached Gmail**. Reset-link
completion/replay/expiry were tested locally, but that particular live link has
not been confirmed completed. No claim of universal inbox delivery is made.

## Event policy

| Event | Trigger | Status of this change |
| --- | --- | --- |
| Welcome | Newly persisted password or Google account, once | New opt-in queue |
| Password reset | User requests a reset for an existing account | Existing live mail, inbox confirmed once |
| Password changed | One-use reset completes; previous sessions revoked | New opt-in queue |
| New browser/device | Successful password/Google login from a previously unseen device cookie | New opt-in queue |
| Google linked | Google identity is newly linked to a logged-in account | New opt-in queue |
| Referral reward | Verified qualifying first export actually grants 10 credits to each person | New queue; referrals remain independently disabled in production |
| Support reply | Staff posts a new reply to the user's ticket | New opt-in queue, private reply content stays on site |
| Creation moderation | Staff changes template/tutorial status | New opt-in queue |
| Purchase receipt | Validated captured payment and benefits are persisted, not an order/click | Staged hook; **money features disabled** |
| Withdrawal requested | Request successfully persists | Staged hook; **money features disabled** |
| Withdrawal processed/rejected | Admin action persists and completes its audit path | Staged hook; **money features disabled**, not independent bank-settlement proof |

No mail for every refresh, failed login, follow/like, abandoned checkout or
ordinary export. Marketing/bulk campaigns are not included. Signup welcome
is not proof of email ownership; referral verification is a separate flow.

Device recognition means a remembered **browser**, not hardware identification.
Clearing cookies/private mode or a different browser may cause an alert. First
signup sets a baseline without a redundant login alert. Existing users' first
login after rollout can alert. Only a random HttpOnly, SameSite=Lax cookie's hash
is stored, scoped by account. Production cookie is Secure. Browser labels are
coarse; raw user-agent, exact IP/location and session secrets are not emailed.

## Delivery safeguards and limits

- New events require `TRANSACTIONAL_EMAILS_ENABLED=true` and the existing sender
  credentials. Default is off, independent of reset email and referral flags.
- Apply `20261008142346_transactional_email_events.sql` first. It creates only
  private outbox/device tables with RLS; public/anon/authenticated privileges
  are revoked. Only the backend app role is granted access.
- Durable event keys deduplicate by account, event type and persisted event ID.
  A leased worker has bounded batches/retries and a shared one-request-per-second
  pacing gate. A database savepoint prevents auxiliary mail failure from aborting
  the main transaction. Queue loss on an infrastructure failure is logged, never
  silently described as delivered.
- Payloads freeze at enqueue, so retries reuse identical provider content/key.
  Resend retains its idempotency keys for 24 hours; uncertain attempts older than
  23 hours go to `review`, never blind automatic resend. At most five attempts.
- `accepted` means Resend accepted the request, **not delivered to the inbox**.
  Delivery/bounce/complaint webhooks and an operational review dashboard are not
  implemented by this change. Review failures need operator action; no automatic
  resend of ambiguous old attempts. Sender-level suppression remains at Resend.
- Default `TRANSACTIONAL_EMAILS_DAILY_LIMIT=60` counts newly attempted outbox
  events over 24 hours, not direct reset/verification emails. Set it within the
  account's actual provider quota, allowing headroom for reset mails and retries.
  This is not a certification of free-plan capacity or a provider billing limit.
- Sender/recipient snapshot payloads are removed after seven days for terminal
  events; non-PII dedupe markers remain. Deleted accounts cascade away. Changed
  account email cancels queued mail to the previous address. Never backfill old
  notifications as email.
- Full UPI details, UTR, passwords and reset/verification tokens are excluded
  from event emails. The separate reset/verification templates intentionally
  include their one-use links. New templates have text and mobile HTML versions.

## Release boundary and checklist

Rollout requires deployment and opt-in activation. On 8 October the additive
email migration was applied to production and its private RLS/ACLs verified;
the existing Render service's email flag was enabled without replacing secrets.
No live DNS, API keys, money flags or customer records were changed. Consult the
live revision/config endpoint rather than assuming a local commit is deployed.

Local evidence: 23 real isolated PostgreSQL email checks (provider mocked),
19/19 offline regression suites and 5/5 actual isolated auth/reset/support/
notifications/free-release HTTP suites passed. These are not live inbox tests
for the new events. The PostgreSQL checks cover welcome/Google, remembered
browser races, one-use reset change alerts, support privacy, moderation,
10+10 referral events, outbox dedupe/retry/budget and private-table ACLs.

The broader 16-suite isolated HTTP rerun passed 15 suites; `verify_admin.js`
failed its exactly-one-owner assertion because this retained QA database has
two `owner-...@example.com` fixtures from previous isolated runs. Its guest,
ordinary-user and self-promotion permission checks passed. This is not a claim
that the full suite passed or a production admin audit.

## Branding and previews

All 13 templates share an email-safe table/inline-style layout, public PNG logo,
visible text wordmark, escaped content and plain-text alternative. Logo loading
can be blocked by recipient settings; this does not affect the message or CTA.
`npm run test:emails:preview` generates `shots/email-templates/index.html` with
all actual templates and offline logo previews. It checks every template at
320, 390 and 640 pixels (39 renders); preview links cannot navigate and sample
tokens are not valid credentials. Money/referral examples are explicitly staged.

The Gmail sender avatar is separate from HTML branding. Gmail's BIMI support
requires a VMC or CMC and an enforced DMARC policy. No certificates were bought
and no DMARC/BIMI changes were made by this release. See
[Google's BIMI requirements](https://knowledge.workspace.google.com/admin/security/set-up-bimi).

1. Run isolated PostgreSQL email and auth/support regression tests. Do not point
   these mutation fixtures at production or use real recipients/provider keys.
2. Review/apply the additive migration, verify ACL/RLS with metadata queries.
3. Deploy the tested code. Privately enable `TRANSACTIONAL_EMAILS_ENABLED=true`
   in the existing service; keep payments/withdrawals Coming Soon and referrals
   disabled until their separate migration/journey is approved.
4. With a controlled owner account, check new-browser alert and support reply
   arrive once. Inspect provider acceptance/failure logs without exposing tokens.
5. Before enabling money later, audit/reconcile the financial ledger and complete
   signed gateway/captured-state tests. Existing admin payout processing is not
   certified for financial launch by merely adding an email hook.

Disable only `TRANSACTIONAL_EMAILS_ENABLED` to roll back new event delivery.
Existing reset emails continue. Retain the private additive tables so dedupe
history is not lost; no data-deleting rollback is needed.

References: [Resend send API](https://resend.com/docs/api-reference/emails/send-email),
[24-hour idempotency](https://resend.com/docs/dashboard/emails/idempotency-keys),
[Supabase API security](https://supabase.com/docs/guides/api/securing-your-api).
