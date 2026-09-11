# ShortsCraft updated-version audit

Audit performed 10–11 September 2026. Initial checkout: `b01c618`.

## Verdict: hold the update, not a launch approval

The public-page foundation works, but several reproducible defects remain.
This is a read-only application review: no application fixes, production deploy,
real purchase, test account, support submission or credit-consuming generation/
export was performed. Local audit artifacts are the only files created by this
review. Normal page views can still invoke the site's own analytics handlers.

The local server connects to a remote database; its staging/live status could not
be confirmed by the owner. Write-heavy integration tests were therefore not run.
Supabase's auth/private-data checklist informed that boundary and the guest API
access checks. Earlier test passes were not reused as current end-to-end proof.

During the review, 21 application/page files changed outside this audit. The
observed diff was mainly focus styles and asset versions. Those edits were left
intact. A final release candidate must be frozen and checked again.

## Highest-priority findings

### 1. P1 — Publishing discards advanced customization

**Confirmed with a database-free reproduction and source tracing.**

The editor sends `tpl`, `lines`, `accent`, `font` and `dur`, but omits `props`
and the project aspect ratio. The backend also neither stores nor returns these
fields. Uploaded image references, per-element content and shared layout/style
settings live in `props`; publishing cannot preserve that full edited result.

- Editor payload: [editor.js](C:/Users/karim/kiroai/shortscraft/public/editor.js:2208)
- Backend storage: [community.js](C:/Users/karim/kiroai/shortscraft/community.js:175)
- Published preview reconstruction: [template-detail.js](C:/Users/karim/kiroai/shortscraft/public/template-detail.js:46)

The reproduction supplied an avatar marker, content scale, custom background and
16:9 aspect. Publish reported success, but returned no props/aspect and its SQL
arguments contained no avatar marker. The database was replaced by an in-memory
stub; no real template was published.

**Acceptance:** edit text, image, layout and aspect; publish; reopen from gallery
and another account; preview and export must retain the same configuration.

### 2. P1 before payments open — A paid order can grant benefits repeatedly

**Confirmed by executing the verification handler with all integrations stubbed.**

The signature/order checks are followed by unconditional `changePlan` and
`setPlan`. There is no durable processed-payment/order check in this path.
`changePlan` computes expiry from the time of each call.

- Grant path: [server.js](C:/Users/karim/kiroai/shortscraft/server.js:1476)
- Expiry calculation: [auth.js](C:/Users/karim/kiroai/shortscraft/auth.js:336)

Replaying the same simulated signed, paid order twice returned success twice,
wrote the plan twice and invoked the credit grant twice. Replaying one day later
extended the expiry by one day. No real gateway, secret or customer account was
used. Both local and live public config currently report payments disabled.

**Acceptance:** a unique payment/order ledger and atomic entitlement update;
repeated/concurrent verification must return the original result without changing
expiry or credits. Also test recovery when the browser closes after payment.

### 3. P1 — Retired SEO generation API bypasses the animation credit system

**Source-confirmed; no provider call was made.**

The retired SEO pages redirect, but `/api/generate` remains registered and calls
the LLM. `seoGate` immediately allows any signed-in user, and the handler does not
use the animation credit ledger. Request rate limiting exists, but that is not a
paid-plan or daily-credit entitlement check.

- Gate: [server.js](C:/Users/karim/kiroai/shortscraft/server.js:1162)
- Active route: [server.js](C:/Users/karim/kiroai/shortscraft/server.js:1187)
- Provider invocation: [server.js](C:/Users/karim/kiroai/shortscraft/server.js:1268)

**Acceptance:** retire the unused endpoint server-side or explicitly include it in
the intended authorization, quota and cost policy. Hidden UI alone is not enough.

## Design and user-flow findings

### 4. P2 — Image-upload controls are almost invisible in light mode

**Browser-confirmed at 390px, Apple iOS App List → Edit.**

Five upload labels use white text over an almost-white translucent background.
Computed text colour was `rgb(255, 255, 255)`; the background was
`rgba(255, 255, 255, 0.08)`. The screenshot visibly showed the weak contrast.
These controls are also exposed as generic labels rather than named buttons.

Source: [editor.js](C:/Users/karim/kiroai/shortscraft/public/editor.js:1048).

**Acceptance:** theme-aware colour/contrast plus keyboard-focusable, clearly named
upload controls for every applicable template.

### 5. P2 — Mobile users lose the theme switch

**Browser-confirmed at 320px with the navigation drawer open.**

The desktop rail contains the theme button, but the rail is hidden on mobile and
the drawer has no replacement. The browser found zero visible theme buttons on
the mobile homepage. Login/signup have a separate toggle, but that is not an
accessible site-wide mobile setting.

- Desktop-only placement: [index.html](C:/Users/karim/kiroai/shortscraft/public/index.html:112)
- Rail hidden: [shell.css](C:/Users/karim/kiroai/shortscraft/public/shell.css:2064)

**Acceptance:** reachable theme control in mobile navigation; chosen theme should
remain consistent across routes.

### 6. P2 — Password-recovery pages ignore the shared light-first design

**Browser-confirmed.** Signup was light, but following to recovery produced a
different dark/purple layout. Both recovery pages load old shell/page styles
without the shared theme initialization, redesign styles or theme control.

Sources: [forgot-password.html](C:/Users/karim/kiroai/shortscraft/public/forgot-password.html:15)
and [reset-password.html](C:/Users/karim/kiroai/shortscraft/public/reset-password.html:15).

**Acceptance:** the selected light/dark theme and common auth design must apply to
login, signup, forgotten-password and reset-password pages.

### 7. P2 — Publishing success points at the wrong destination

**Source and destination-page confirmed; no real publish was attempted.**

The success link says “View on Community Gallery” and opens `/community`, but that
route now displays Creator Skills teaching videos, not animation templates.

Source: [editor.js](C:/Users/karim/kiroai/shortscraft/public/editor.js:2230).

**Acceptance:** link to the exact newly published template, with a secondary route
to its real gallery/creator listing. Apply matching wording in the other publisher.

### 8. P2 before annual sales — Promised yearly verification is not granted by the app

**Application-source finding, not a real payment test.**

Pricing promises a verified badge throughout an active yearly plan. The plan-grant
function updates plan/billing dates, not verification; account/public-profile
serialization reads the stored `verified` flag rather than deriving annual-plan
eligibility. No annual verification delivery/expiry path was identified in the
reviewed application code. Live database-trigger behavior was not verified.

- Promise: [pricing.html](C:/Users/karim/kiroai/shortscraft/public/pricing.html:408)
- Grant: [auth.js](C:/Users/karim/kiroai/shortscraft/auth.js:345)
- Display: [auth.js](C:/Users/karim/kiroai/shortscraft/auth.js:92)

**Acceptance:** test a previously unverified yearly buyer, expiry and cancellation;
keep permanent official verification separate from subscription verification.

### 9. P2 — Missing/community-load failures masquerade as another template

**Source-confirmed.** Community-detail failures, including missing rows, fall back
to the built-in template. Unknown built-in IDs receive a generic preset identity
instead of a clear missing-template state. A visitor can think they are editing
the creator's work when the page has substituted default artwork.

Source: [template-detail.js](C:/Users/karim/kiroai/shortscraft/public/template-detail.js:85)
and its catch handler at line 139.

**Acceptance:** distinguish not-found from temporary failure; show retry/back
actions and never silently replace a creator's design.

## What passed in this audit

- All **59** listed templates had valid schemas and generated nonempty documents
  across **413** declared template/aspect combinations.
- All **770** advertised fields changed generated HTML when mutated with the
  correct field type. This is a serialization check, not proof of every visual
  outcome or exported frame.
- `node verify_ai_definition.js` passed offline. It does not call an LLM.
- Twenty main routes had no document-wide horizontal overflow in the observed
  390px mobile and 1280px desktop passes.
- Homepage empty-search state, annual-price toggle and shared-theme persistence
  between supported pages worked.
- Guest pages correctly showed login prompts/empty projects rather than sample
  projects. Creator Skills showed an honest empty state and its guest submission
  button led to login with a return destination.
- At 320px/390px the editor exposed AI/Canvas/Edit, text editing, background
  selection, clip addition, template selection and aspect controls. Two 4.6s clips
  produced a displayed 9.2s export duration. Export options showed 480p for Free
  and disabled higher resolutions. The final download action was not submitted.
- Local guest API checks: projects/support history returned 401; admin dashboard
  returned 403; liveness returned 200.

Routes inspected: `/`, `/pricing`, `/community`, `/tutorials`, `/contact`, `/about`,
`/privacy`, `/terms`, `/drafts`, `/uploads`, `/account`, `/settings`, `/admin`,
`/login`, `/signup`, `/forgot-password`, `/reset-password`,
`/creator?handle=shortscraft`, `/template?id=ui-tabs`, and an intentional 404.
Editor interaction checks were additional. Account/admin pages were inspected
only in the guest state, not as a substitute for authenticated QA.

## Local versus live

The local updated build reports 5 daily Free credits. `shortscraft.online` still
reports 8; both health endpoints returned 200. This confirms that testing localhost
does not certify the currently deployed version. The live project/support/admin
URLs probed did not return the updated JSON contract. Do not mix local assets with
the old backend when deploying.

Local email sender/API credentials, Razorpay credentials and the production credit
secret were absent. Production environment values were not inspected; no conclusion
about live email delivery can be drawn from local configuration alone.

## Required before final approval

1. Freeze edits and resolve findings 1–3; keep payments disabled until payment
   replay, recovery and annual-entitlement tests pass.
2. Resolve the visible/mobile issues and publishing/error-state confusion.
3. Confirm or create a staging database. Then run real disposable-account tests
   for signup/login/reset delivery, avatar, unique handles, account isolation,
   save/reopen, publish/schedule, likes/comments/follows/Stars, moderation and support.
4. Run real single- and multi-clip MP4 exports plus AI generation, quality review,
   failed-job refunds, concurrent credit accounting and interrupted-request tests.
5. Run the complete regression suite against that stable staging candidate, then
   verify deployment migrations, secrets, backup/restore and rollback.

No audit can guarantee zero future bugs. These unverified flows and confirmed
findings are why this report does **not** certify every feature as working.

## Reproduction artifact

`audit_results/release-readonly-20260910.cjs` and its `.log` contain the offline
template checks, isolated publish/payment reproductions and minimal public GET
checks. They use fake integrations only inside the audit process, never fake
records in the website. The folder is intentionally Git-ignored.
