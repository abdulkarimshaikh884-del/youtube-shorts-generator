# ShortsCraft historical pre-fix release audit — 7 October 2026

> Historical snapshot: the findings and verdict below describe the audit before
> the 7 October launch fixes and subsequent isolated regression runs. They are
> preserved as reproduction evidence, not the current release verdict. See
> [current launch readiness](launch-readiness-20261007.md) for repaired blockers,
> passing local checks and the remaining production gates. No later result makes
> this snapshot a live-deployment or universal feature certification.

## Historical verdict (before fixes)

**HOLD: not approved as an all-features-working final release.** Several real
save/data-loss/quota defects were reproduced. Passing guest pages and fixture
tests do not certify real production account, database, provider or payment flows.
No audit can promise that there will never be another error.

This turn was an audit: no application source fixes, Git push, deployment,
production signup/upload/publish/donation, migration or credit charge was made.
Tests used isolated storage, mocked external providers or GET-only guest browsing.
The two existing untracked user test files were preserved.

## Version and live service

- Local checkout: `codex/full-product-redesign`, `62b1f0d6d15d60b1cb951730afe6ae49e0f44905`.
- Render service: `youtube-shorts-generator`, `srv-d7ktcp0js32c738607lg`,
  confirmed My Workspace. Latest deployment is LIVE at
  `63d59087dfdf8e95c9a03a9c5615cbb082731b8d`, deployed 4 October.
- Six subsequent local commits, including account/settings navigation and the
  latest Designs/editor/upload repairs, are not on that live deployment.
- Fresh local and live `/api/health` checks returned HTTP 200 at approximately
  `2026-10-07T09:31:51Z` (15:01 IST). This endpoint does not verify database writes,
  email, AI, Chromium or ffmpeg availability.
- Render monitoring: no error-level logs returned for the preceding 24 hours;
  preceding-hour memory peak about 214 MiB of 512 MiB (42%). HTTP latency metrics
  were unavailable, so p95/concurrency/load performance is not certified.
- Actual service is a free native Node service with no configured health-check
  path. Repository blueprint expects Docker with Chromium/ffmpeg and a configured
  `/api/health`. This mismatch requires deployment review, not an assumption that
  live exports are working or necessarily broken.

## Verified checks and their boundaries

| Check | Result | Boundary |
| --- | --- | --- |
| 24 routes, local and live, 390/1440 px | 96 guest page states passed; no observed JS exception, horizontal overflow or HTTP 5xx | GET-only guest pages, not authenticated writes |
| Home, forms, interactions, button contrast | 167 Home, 86 form, 35 interaction checks; 125 controls across 84 contrast states passed | Isolated UI/API fixtures |
| Local Designs menu/preview | Three-dot menu, fit and Escape passed at 390/1440 px | Preview only, no cloud clone |
| Design editor regression | Native HeyGen layers/assets, edit/save/reopen/PNG export passed; six viewport checks passed | Isolated API/storage; targeted regression does not clear findings below |
| Video export | 19 checks passed using actual Chromium, ffmpeg and MP4 inspection | Local runtime; credit/storage/provider fixtures, not Render export |
| Google auth | State, PKCE, redirects, account linking and UI fixtures passed | Live Google config reports enabled, but real consent/callback not tested |
| Converter/storage/assets | Actual Sharp converter manifest, owner isolation, path guards and persistence fixtures passed | Vision provider mocked and DB isolated |
| Referral/admin/financial logic | Six isolated backend suites passed; reward logic is 10 credits each | Does not clear uncovered donation alias or credit replay |

Actual mobile screenshots show current local compact cards and visible options,
while live still has the older conversion button/category strip and no new menu.
Evidence: `audit_results/release-ui-20261007/guest-smoke.json`,
`local-designs-settled-390.png`, `live-designs-settled-390.png`,
`local-design-preview-390.png`; `audit_results/export-isolated/evidence.json`;
`audit_results/designs/editor-working-390.png`.

## Confirmed release blockers

1. **Design autosaves can lose a newer edit while showing Saved to cloud.**
   `public/design-editor.js:1261` permits overlapping requests; `designs.js:655`
   overwrites without a revision guard. A delayed older save completed after a
   newer save; durable isolated storage and reload retained the older edit.
   Needs ordered saving plus server-side concurrency protection and truthful
   dirty/error state.

2. **Larger design save/publish bodies hit the wrong parser.**
   `server.js:163–169` globally parses these routes at 100 KB before their
   intended 2 MB parsers at 741/747/777. Actual extracted middleware rejected a
   valid 122,976-byte request with HTTP 413. The exemption list must be reviewed
   alongside document/asset limits and regression tests.

3. **Ordinary added/replaced images cannot reliably be saved.**
   `public/design-editor.js:735`, `942`, `1006` accept raw data URLs and duplicate
   replacement data. A valid 640×360 PNG of 692,867 bytes produced 1,847,968 bytes
   of elements JSON, above the 512 KB cap at `designs.js:645`. The UI accepted the
   replacement but only showed Not Saved. Needs normalized durable assets or
   safe preflight/compression, not just unlimited request bodies.

4. **Legacy Stars donation bypasses the free-release guard.**
   `server.js:468` registers `/api/auth/star` before the release guard at 495;
   `social.js:392` has no internal policy guard. Actual route/module with isolated
   storage returned HTTP 200 and made test grant/donation/notification writes,
   while the normal route returned 503 without writes. Also present in the live
   commit by source inspection; no live donation was attempted.

5. **Credit idempotency is not tied to the requested operation/result.**
   `credits.js:284–305` approves reuse without payload binding; conversion/AI/
   export handlers continue work. Actual isolated credit module approved seven
   changed requests for one debit, and a changed request after refund for no net
   debit. Provider work is inferred from handlers, not executed against providers.
   Needs operation state, payload binding and safe result replay; legitimate
   retries must not be double-charged. Reproducers and details are in
   `audit_results/account-release-audit-20261007.md`.

## Other issues and unverified gates

- Local referrals are disabled; verification-email configuration is absent.
  Production referral configuration, migration, email delivery and actual
  10+10-credit grant remain unverified. Authenticated referral GET was not called
  live because it can create a referral-code row.
- Local Google keys are absent; live config says enabled. Real signup/login,
  Google callback, password-reset email, session persistence and account linking
  still need isolated integration/staging verification.
- Fresh isolated PostgreSQL write suites could not run: Docker Desktop Linux
  engine pipe is unavailable. No production writes were used to compensate.
- Design publishing defaults to Premium and displays star earnings despite
  money features being Coming Soon (`design-editor.js:1399`, HTML:356). Free can
  be selected; this is misleading presentation, not proof all free publishing fails.
- Design moderation rejection reasons are returned but not stored
  (`admin.js:677`, `727–730`). Admin AI-job retry intentionally returns 409.
  Category filters exist, but are not a complete category-management system.
- Image conversion is approximate cropping/background repair, not a guarantee
  of clean independent layers for every arbitrary image. Duplicate artwork/title
  mismatches and E2E-labelled public templates still need content review.
- Automated viewports do not replace Android/iPhone/Safari touch, keyboard,
  file-picker and download testing. Real authenticated mobile workflows, Render
  video exports/load, backup restoration and production durable writes are not
  newly certified by this turn.
- Full UI runner is not green: stale `tests/mobile-layout-qa.js:129` expects the
  removed inline profile editor. Admin/settings browser attempts also hit a
  temporary-profile cleanup error/navigation timeout. These are non-passing test
  results, not established product defects; harnesses need updating/retesting.

## Dependency audit

Fresh `npm audit --omit=dev` reports one Critical and one High advisory:

- `proxy-addr` 2.0.7, patched in 2.0.8. The described exploit requires particular
  misconfigured IPv6 trust subnets; this app uses numeric `trust proxy = 1`, so
  current exploitability is not established. Still update the vulnerable dependency.
  [Maintainer advisory](https://github.com/jshttp/proxy-addr/security/advisories/GHSA-jqcg-44mw-7w3h).
- `sharp` 0.35.4, patched in 0.35.5. Advisory concerns SVG/librsvg and runtime-
  specific Linux conditions. No malicious-image exploit was performed; update
  and re-run converter/image validation tests before release.
  [Maintainer advisory](https://github.com/lovell/sharp/security/advisories/GHSA-wq5f-xc86-pv6w).

Do not run a blind forced dependency fix against this release.

## Payment/PAN decision

User confirms PAN is not yet allotted or the card is pending. Keep payments,
paid unlocks, donations and payouts Coming Soon for the free release, including
every legacy route. Do not market or accept paid orders before approved onboarding
and verified payment/refund/webhook/ledger flows.

Razorpay individual onboarding requires personal PAN and KYC. If PAN already
exists and only the physical card is pending, retrieve the existing e-PAN/status
and confirm Razorpay's applicable verification route; its video-KYC instructions
request physical copies. Do not apply for a second PAN.

If no PAN has been allotted, the Income Tax instant e-PAN service is free for
eligible non-minors with Aadhaar-linked mobile/DigiLocker; minors and existing
PAN holders are ineligible. Razorpay account registration requires age 18+.
Cashfree also requires proprietor PAN/KYC, so changing gateway does not remove
this prerequisite. An adult-owned business route must have the real consenting
adult owner, matching KYC/bank details and provider approval—not borrowed details.

Official sources: [Razorpay onboarding](https://razorpay.com/docs/payments/set-up/),
[Razorpay terms](https://razorpay.com/terms/),
[Income Tax instant e-PAN](https://www.incometax.gov.in/iec/foportal/help/all-topics/e-filing-services/instant-e-pan),
[Cashfree document checklist](https://www.cashfree.com/blog/documents-required-for-payment-gateway-in-india/).

## Required before final approval

Fix and regression-test the five confirmed blockers, apply reviewed dependency
updates, align free-release UI, make explicit referral/email readiness decisions,
complete isolated durable auth/save/referral tests, then deploy the intended
revision and verify that exact live revision. Run real mobile and live export
smoke tests under controlled test accounts and permission. Until then, neither
an all-features certification nor a paid release is approved.
