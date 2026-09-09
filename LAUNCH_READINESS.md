# ShortsCraft launch audit — 9 September 2026

## Decision

**Not yet approved for public launch.** Core local regressions have passed, but
production delivery, payment lifecycle, AI output quality and deployment recovery
are not proven. A passing local check is not production evidence.

Product requirements remain in `SHORTSCRAFT_PRODUCT_MASTER_PLAN.md`.
This report records this audit's evidence, not every change in the dirty checkout.

## Repairs in this audit

- Support now has a real conversation view and reply form on Contact. Account
  support history and reply notifications link directly to the correct ticket.
- Support text is rendered as text, including script-looking input. Requests have
  a timeout, visible errors and retry controls. Duplicate submits are prevented.
- After replying, both the conversation and ticket-list status/count refresh.
- Invalid ticket IDs return a not-found response. Ownership remains server-side.
  Closing a ticket and adding a reply now lock the ticket row inside transactions
  so a concurrent reply cannot silently reopen a closed ticket.
- Added `verify_support.js`: real persisted ticket, admin reply, notification,
  mobile user reply, other-account/guest denial, closed-ticket denial and cleanup
  of the exact temporary accounts/tickets created by that run.
- Public-page smoke tests no longer create leftover signup accounts. Required
  regression scripts are no longer excluded by the blanket Git ignore rule.
- Public Pro-price config now derives from the plan definition. Paid-generation
  denial messages name actual subscriptions rather than nonexistent model plans.
- Checkout dismissal no longer promises that no money was deducted.
- Retired SEO-product links were removed from the sitemap; relevant animation
  community/help routes remain. Environment-template descriptions were corrected.
- Production startup refuses a missing/short credit-cookie secret or explicitly
  disabled rate limits. Neither failure logs secret values.

## Executed checks

The original `npm test` run on the existing port 3000 server passed these groups:

| Group | Result |
|---|---|
| Shell, editor, timeline | PASS |
| Template-schema mutations and AI-definition validation | PASS |
| Public pages and mobile journeys | PASS |
| Auth and local password-reset flow | PASS |
| Real MP4 export, credits and render queue | PASS |

That run stopped at a creator-profile browser failure in the social suite.
On a fresh port 3220 server, the isolated social suite passed, including real
button interactions and stored counts. The failure's original cause is not
established; do not describe it as a confirmed product fix.

The following were then independently verified on port 3220:

| Group | Result |
|---|---|
| Social API and creator-profile buttons | PASS |
| Cross-device projects and account isolation | PASS |
| Admin API access restrictions | PASS |
| Real support conversation, mobile reply and ticket-list refresh | PASS |
| Guest public pages | PASS |
| Layout overlap/clipping audit | PASS |
| Quick text-contrast audit | PASS |
| Unsafe production-startup configuration rejection | PASS |

Evidence logs: `audit-launch-20260908.log` and `audit-*-20260909.log`.
Mobile support screenshot: `audit_results/support-mobile.png` (visually inspected).
Logs/screenshots are local QA artifacts, intentionally ignored by Git.

These are staged/isolated passes, **not an uninterrupted final npm-test pass**.
Support was added to the main test chain after its standalone verification.
The full chain must run on the final release candidate before deployment.

## Remaining release gates

1. **Password-reset delivery:** local `RESEND_API_KEY` and `AUTH_FROM_EMAIL` are
   absent. Local reset tests do not prove inbox delivery. Configure a verified
   sender and test expiry, reuse rejection and delivery in production mode.
2. **Payments:** local Razorpay credentials are absent. Keep checkout unavailable
   until gateway verification, monthly/yearly entitlements, idempotency,
   interrupted-checkout recovery, refunds and webhook handling are proven.
3. **Production configuration:** set a random stable `CREDITS_SECRET` (at least
   32 characters), the actual public URL and verified hosting environment.
   Local missing credentials do not establish the production host's state.
4. **AI quality:** model-definition validation is not proof of useful generated
   animations. Benchmark actual provider responses using realistic prompts;
   inspect editable output, preview/export parity, timeouts and failure refunds.
   Gemini/NVIDIA key presence was observed; provider availability/quality was not
   established in this audit. No paid provider was purchased or enabled.
5. **Creator publishing/moderation:** complete real upload/import, scheduled
   publication, report/moderation and notification browser journeys, including
   failures. Do not advertise import formats that cannot be safely edited/exported.
6. **Operational release:** verify deployed migrations, backups and restore,
   monitoring, resource limits, database health and rollback. No deployment was
   made by this audit.
7. **Final visual acceptance:** inspect all key pages and editor actions on real
   phone/desktop widths in both themes. Automated contrast/overlap checks are not
   comprehensive accessibility or human design approval.

## Next verification commands

Run against the intended local/staging server, never silently against production.
The server must be **freshly started** and must have the signup rate limit off:

```powershell
$env:DISABLE_RATE_LIMIT='true'; $env:PORT='3242'; node server.js
```

```powershell
$env:BASE_URL='http://localhost:3242'
npm test
```

Both conditions are load-bearing. `/api/auth/signup` allows 20 requests per hour
per client and the limiter is an in-memory `Map`, so the counter belongs to the
server process, not the clock. The full chain needs more than 20 signups, which
means it can never finish against one rate-limited process: the run dies partway
through with a `429` and every assertion downstream of the account it could not
create fails with it. That is what produced the "12 failing" password-reset run
and, on the evidence, the unexplained social-suite failure recorded above — the
retry that "passed on a fresh port" passed because it was a fresh *process*.
`DISABLE_RATE_LIMIT` is the sanctioned switch for this; production refuses to
boot with it set (`server.js`), so it cannot leak into a live deployment.

The suite creates real disposable fixtures in the configured database. Use a
dedicated staging database for the release run; do not run arbitrary test suites
against customer data. Keep current user changes and existing data intact.

An interrupted run never reaches its teardown, so its fixture account survives.
`node purge_fixtures.js` lists the survivors; `--yes` removes them. It only ever
considers RFC 2606 / 6761 reserved domains, which can never belong to a real
person, and never touches an admin account.

## Verification of this audit — 9 September 2026

The report above was checked claim by claim against the working tree.

Confirmed as described: support ticket row locks, support text rendered as text,
request timeouts, the production `CREDITS_SECRET` guard, the corrected checkout
dismissal copy, the retired SEO routes (`/seo-tools` and `/generator` now `301`
to `/#templates` and are linked from nowhere), and both moderation gaps — content
reports are counted on the admin dashboard but no route or UI can file one, and
`admin_audit_log` is written by `admin.js` and `support.js` and read by nothing.

Corrected:

- **"Auth and local password-reset flow: PASS" was stale.** That group last ran
  before this audit changed the paid-tier denial copy. `verify_auth.js` asserted
  the literal word "plan"; the new message says "requires a Pro or Pro Max
  subscription", so a correct `403` was reported as a product failure. The
  assertion now checks that the refusal names the tier that lifts it.
- **Payments are not a launch gate.** `paymentsLive()` derives from credential
  presence alone: with no Razorpay keys the checkout stays closed and the
  waitlist serves in its place. The site can ship with payments off.
- **AI output quality is now partly established.** A real `/api/animate` call
  returned a usable scene — prompt-matched name and accent, three wired
  `@keyframes`, sixteen bound editable fields across two beats, and the correct
  two-credit charge. Provider benchmarking across many prompts is still open.

Not covered by the report:

- **The cache-busting version was stale.** `page.js`, `authui.js`, `redesign.css`
  and `checkout.js` all changed after the last page build, while every generated
  page still stamped `?v=2026090418`. The next deploy would have served returning
  visitors the previous assets, including the support conversation view this
  audit added. `V` was bumped and the pages rebuilt; only the `?v=` changed.
- **246 of 253 accounts were test fixtures.** Eight belong to real people. Every
  signup and user figure on the admin dashboard was measuring its own test runs.
- **Those eight real accounts make the reset-email gate urgent, not theoretical.**
  `mailer.js` correctly refuses to pretend a send succeeded, so until
  `RESEND_API_KEY` and `AUTH_FROM_EMAIL` are set, a real user who forgets their
  password has no route back into their account.
- **Nothing is committed.** 46 modified and 45 untracked files, roughly 19,700
  inserted lines, on an unpushed branch. `shortscraft.online` still serves
  `4bb4c7f`; none of the work in this report is live.

With a fresh server and the rate limit off, the full chain then completed
uninterrupted for the first time: **18 groups, 1688 passing, 0 failing.**
