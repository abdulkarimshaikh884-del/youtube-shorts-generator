# Referral and Admin release — 9 October 2026

## Rules and behavior

- A new invitee must verify email (or a verified Google identity) and complete
  one real, charged, successful server export. A click, analytics event, debit
  alone, failed/refunded render or repeated request cannot qualify.
- Both users receive 10 bonus credits once. The inviter has a cap of 10
  rewarded referrals per UTC calendar month. Limited referrals are terminal,
  not promised a reward next month. Existing/self accounts do not qualify.
- Earned bonus is separate from daily allowance. Spending, refunds and daily
  rollover preserve it, even when new referrals are paused.
- Reward/ledger/notification writes are atomic; recipient email events enter
  the durable private outbox. Completion evidence and bounded recovery survive
  transient reward failure. Verification resend is account-bound: 60-second
  cooldown, at most three requests per hour, hashed single-use 24-hour tokens.
- Referral history is owner-scoped with encrypted pagination, not friend
  emails, account IDs or device fingerprints. Copy and Share are separate.

## Admin

Persistent grouped desktop navigation and a mobile section chooser retain all
14 sections. URL history, refresh, errors, timeouts, stale requests and auth-check
retry are handled without losing navigation. Controls and quick jumps honor
server permissions; hidden UI is never the security boundary.

Private Design previews require templates.moderate. Asset access must be bound
to the selected design and its author/public asset, never an arbitrary file.
AI-job filters match actual complete/pipeline statuses. Audit search is bounded
and parameterized. Ban/unban, session revocation and audit records share a
transaction. Banned accounts cannot sign in through password, Google or stale
sessions. Staff roles and the exact 29-key permission list match SQL constraints.

Money/Stars/payout/retry capabilities that were unavailable remain Coming Soon.
Legacy DB feature flags are labelled read-only: no pretend successful live switch.

## Verification boundaries

- 23 isolated offline suites; Admin-specific 13 checks.
- Real owned PostgreSQL: 22 release, 16 referral-hardening, 10 auth/Admin checks.
- Real local Express export returned MP4 and exactly 10+10; replay rejected,
  failed rendering refunded. This was NOT a real email inbox test.
- Referral UI: 37 fixture checks. Admin UI: 140 new layout/navigation/permission
  checks plus 112 existing checks. These are isolated fixtures, not production
  moderation writes. Desktop/mobile screenshots were visually reviewed.
- Real local HTTP auth, Admin, staff and desktop-polish suites passed. The
  Admin ownership fixture permits multiple independent LOCAL owner fixtures;
  it makes no assertion about production owner count.

## Release and rollback

Before opt-in, apply the additive referral, recovery, creator-profile and mute
migrations and the closed Admin role/permission constraint alignment. The live
project is mqsimdmogbycrbizrrsm; new private tables retain RLS with zero anon or
authenticated table grants. The constraints change no users or staff grants.

A read-only encrypted snapshot of 315 user and 2,738 credit rows was restored
into a private LOCAL schema and exactly compared before DDL. This is a scoped
users/credits preflight backup, not full-database disaster recovery certification.
No existing customer rows were deleted by these migrations.

Deploy the code on the confirmed Render My Workspace service
srv-d7ktcp0js32c738607lg, then merge REFERRALS_ENABLED=true. Preserve all other
environment values and disabled financial flags. Verify live revision, config,
catalog retention and authorization. Live inbox confirmation remains a human
verification step; local tokens/mock provider success do not prove delivery.

To pause new referral awards, set REFERRALS_ENABLED=false. Keep the additive
schema, earned bonus, records and completion proof; never roll back by deleting
credits/referrals. Do not shrink role/permission constraints without auditing
stored values first. Deploy status/live canary evidence should be recorded
separately from the pre-deploy fixture checks above.
