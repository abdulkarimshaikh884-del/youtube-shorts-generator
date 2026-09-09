# ShortsCraft Product Master Plan

> **Project source of truth**  
> Last updated: 2 September 2026  
> Current product scope: **Animation templates only**

This document records the complete agreed direction for ShortsCraft before the full rebuild is finished. New ideas should be checked against this plan so that the product does not again become a collection of disconnected pages and unfinished features.

## 1. Product vision

ShortsCraft is an animation-template platform where a user can:

1. Discover high-quality animation templates.
2. Open a template in the Studio editor.
3. Customize all meaningful parts of the template.
4. Preview the exact result before spending credits.
5. Export a real video at the quality allowed by their plan.
6. Publish their customized template for other users when appropriate.

The product must feel like a serious creator platform built by people—not like a generic AI-generated landing page. It should be clear, useful, trustworthy, accessible and fast.

### Fixed home-page structure

The following order must remain fixed:

1. AI animation prompt/chatbox at the top.
2. Template discovery gallery immediately below it.

All other navigation, cards, pages and dashboard structures may be redesigned when doing so improves clarity.

### Current and future scope

- **Now:** animation templates, animation generation, editing and video export.
- **Later, only after the animation product is stable:** thumbnail templates, banners, post designs and other creator assets.
- Current UI must not advertise future asset types as available.
- The internal architecture may be made extensible, but unfinished future products must not confuse users.

## 2. Non-negotiable product rules

- No fake users, projects, counters, likes, comments, followers, exports, earnings, analytics, urgency banners or testimonials.
- Empty data must produce an honest and useful empty state.
- Every visible action must either work or clearly say that it is coming soon.
- Entitlements, credits, uploads and admin permissions must be enforced on the server—not trusted to browser code.
- Desktop and mobile users must have access to the same important functionality.
- Editing, previewing and exporting must use the same template renderer and the same prop values.
- Light theme is the default. Dark theme is optional and the user's choice is stored.
- Design must avoid excessive neon, glass effects, gradients, glows, inflated marketing copy and decorative clutter.
- Copy must be human and factual. Avoid words such as “premium”, “next-level”, “viral” and “silky smooth” unless they communicate a specific verified fact.
- ShortsCraft's own templates must not receive a special “Original” label or a hidden ranking boost.

## 3. Information architecture and navigation

### Public and user-facing pages

- Home / template discovery
- Template details and preview
- Studio editor
- My Projects
- Community / creator discovery
- Public creator profile
- Creator Studio
- Account and profile settings
- Notifications
- Plans and pricing
- Tutorials and help
- Contact and support tickets
- Login, signup and password reset
- About, Terms and Privacy
- Admin console for the owner

### Shared shell

- One shared full-width top navigation on product pages.
- One shared footer where it is useful.
- No duplicated or conflicting desktop sidebars.
- Mobile navigation must expose all essential destinations and actions.
- Account controls should be grouped in a clear profile menu.
- Creator-only and admin-only options must appear only for authorized users.
- SEO Tools must be removed from the product. ShortsCraft is not an SEO product.

## 4. Visual and interaction design system

### Visual direction

- Professional creator-tool look with restrained color and decoration.
- Default light theme with an intentional dark equivalent.
- Consistent spacing, type scale, button hierarchy, inputs, cards, dialogs and status colors.
- Content hierarchy must come from typography and spacing—not constant glow effects.
- Template media remains the visual focus of gallery cards.

### Accessibility

- Complete keyboard navigation and visible focus states.
- Semantic labels for inputs, buttons, dialogs and menus.
- Screen-reader announcements for errors, saving and long-running jobs.
- WCAG-friendly color contrast.
- Touch targets suitable for mobile use.
- Respect `prefers-reduced-motion`.
- Do not rely only on color to communicate state.
- Modal focus trapping, Escape-to-close and focus restoration.

### Responsive behavior

- Design and test at narrow mobile, common mobile, tablet, laptop and large desktop widths.
- Editor controls that cannot fit beside the canvas become accessible sheets/tabs—not hidden controls.
- Long category lists become horizontally scrollable or use a discoverable filter menu.
- Primary export, save and preview controls must remain reachable on mobile.
- No horizontal page overflow, clipped menus or off-screen dialogs.

## 5. Authentication and account system

- Real signup, login, logout and password-reset flows.
- Protected pages redirect guests to login and preserve a safe return URL.
- A guest must never see another person's projects or account data.
- Sessions should use secure, HTTP-only cookies with production-safe settings.
- Auth errors must be specific enough to help but must not leak sensitive account details.
- Rate-limit login, signup and reset endpoints.

### Unique usernames

- Every account has one case-insensitively unique handle.
- Recommended format: 3–30 characters using lowercase letters, numbers and underscores.
- UI displays the handle with `@`, while storage uses the normalized value.
- Reserved handles include ShortsCraft/system/admin/support names.
- Handle availability is checked live, but the database unique constraint is final authority.
- Handle changes should be rate-limited and old links may redirect for a limited period later.

## 6. User and creator profiles

### Editable profile fields

- Profile photo: upload, replace and remove.
- Display name.
- Unique handle.
- Bio.
- Website.
- Location.
- YouTube URL.
- Instagram URL.

Avatar uploads must validate type and size, be normalized to a safe image format and never execute user-provided content.

### Public profile

- Profile photo, display name, unique handle, verification state and bio.
- Published creation count.
- Followers and following with real lists/counts.
- Follow/unfollow action.
- Published templates grid.
- Received Stars count when useful, with a clear explanation that Stars are non-cash appreciation.
- Shareable stable profile URL.

### Verification

- `@shortscraft` is permanently verified.
- Eligible yearly paid-plan members receive a blue verification badge only while the entitlement is active.
- Verification must never falsely imply identity, government or celebrity verification; its meaning must be explained.

## 7. Plans, credits and commercial model

Credits are delivered daily but displayed as a monthly comparison so users can understand the full value.

| Plan | Price | Credit delivery | Monthly display | Export | Watermark | AI access | Monthly Stars |
|---|---:|---:|---:|---|---|---|---:|
| Free | ₹0 | 5/day | 150/month | 480p | Yes | Standard, 2 credits | 5 |
| Pro | ₹199/month or ₹1,999/year | 40/day | 1,200/month | 1080p | No | Standard, Detailed, Advanced | 25 |
| Pro Max | ₹399/month or ₹3,999/year | 100/day | 3,000/month | 1440p | No | Standard, Detailed, Advanced | 60 |

### Credit costs

- Export any edited animation: **1 credit**.
- Standard AI generation: **2 credits**.
- Detailed AI generation: **5 credits**.
- Advanced AI generation: **8 credits**.

### Credit rules

- Credits refresh at 00:00 UTC and do not stack.
- Pricing UI explains daily delivery even though it displays the monthly equivalent.
- Previewing, editing and browsing templates are free.
- Charge and job creation must happen transactionally and idempotently.
- A generation/export that fails due to the service must automatically refund its credit charge exactly once.
- Every charge/refund must have an auditable transaction ledger entry.
- Credits cannot be transferred or converted to money.

### Paid plan rules

- Pro gets 1080p, no watermark, all AI tiers and priority export queue.
- Pro Max gets 1440p, no watermark, all AI tiers, highest queue priority and early access to stable new features.
- Yearly plans include the eligible verification entitlement.
- No lifetime plan, fake reservation banner or fake limited-seat counter.
- Payments should use Razorpay for monthly/yearly billing only after complete production verification.

### AI model launch strategy

- During the initial launch period, use the strongest reliable free/low-cost backend available without pretending it is a paid model.
- All tiers can temporarily share the same generation backend while plans still differ through limits, quality, queue priority and entitlements.
- After the product is stable and has real users, measured quality/cost tests will select paid models for Pro and Pro Max.
- Provider/model names should not be permanently hard-coded into product promises.

## 8. AI prompt experience

- Prompt/chatbox remains above templates on the home page.
- The input should help users describe an object, content and motion—not only a vague mood.
- Optional image attachment must visibly affect the generated result when supported.
- Model/tier selector shows exact credit cost and plan requirement.
- Clear prompt examples and constraints.
- Generation produces an editable scene, not a dead video whenever technically possible.
- Failed jobs expose a useful error and refund credits automatically.
- Generation duration and entitlement limits must be enforced server-side.
- Generated content must pass safety and file validation before becoming editable/publishable.

## 9. Template gallery and discovery

### Template card content

- Real animated/static preview.
- Template name and short factual description.
- Creator photo/name/handle and verified badge when applicable.
- Like, comment and share actions.
- Save/favorite action.
- Format or duration information when useful.
- Clear action to preview/use the template.

### Search and filtering

- Search by template name, description, category and creator handle.
- Animation-specific categories only for the current product.
- Useful sorting: Recommended, New, Popular and Saved.
- Empty search/filter results explain how to recover.

### Fair recommendation algorithm

Recommendations must be based on genuine activity such as:

- Unique template opens and previews.
- Saves.
- Meaningful editor starts.
- Successful exports.
- Likes.
- Comments.
- Shares.
- Recency and rolling engagement.

Higher-intent actions such as edits and exports should weigh more than passive views. Use unique users/browser identities and a rolling period such as 30 days to reduce manipulation. New creator templates may receive a small time-limited discovery allowance, but ShortsCraft templates receive no hidden official boost.

The algorithm must be versioned, measurable and protected against repeated self-engagement/spam.

## 10. Template editor

### Customization standard

Every template should expose all meaningful and safe controls supported by its design:

- All visible text.
- Background, accent and element colors.
- Font family, size, weight, alignment, line height and letter spacing where meaningful.
- Position, spacing, padding, radius, borders and layout variants.
- Animation timing, speed, delay and loop duration.
- Shape, icon, image/avatar and media replacements where the template contains them.
- Effect intensity and other template-specific visual properties.

Controls must come from a shared schema/config system. Changing every advertised field must cause a visible output mutation. A field that does not affect rendering must not be shown.

### Renderer requirements

- Template build contract: `SC_TPL2.build(id, { props, watermark: false })`.
- Editor preview and export use the same props and rendering path.
- A universal header background control changes the actual background of every compatible template.
- Uploaded images/icons must appear in the canvas, preview and final export.
- Validate template fields with automated mutation tests; target is zero dead controls.

### Studio experience

- Responsive canvas with aspect-ratio controls.
- Timeline and multi-clip structure where supported.
- Play/pause, restart, current time, duration and loop controls.
- Autosave state plus clear saved/error indication.
- Undo/redo for editing actions.
- Desktop inspector and accessible mobile inspector sheet/tabs.
- Export dialog explains credit cost, quality, watermark and estimated processing.
- Export is a real MP4 render, not a fake download or browser-only animation capture.

## 11. My Projects

- Guests see a sign-in requirement, never seeded example projects.
- Signed-in users see only projects owned by their account.
- Honest empty state with “Start from a template” and “Create with AI”.
- Project cards use real preview/title/duration/edit time/status.
- Rename, open, duplicate and delete must work with confirmation where needed.
- Drafts should ultimately persist to the account for cross-device access.
- Until account-side draft sync is complete, the UI must explicitly say that a draft is stored in the current browser.

## 12. Creator publishing and upload

### Supported publishing now

For the current release, a creator can:

1. Open a shipped ShortsCraft Studio template.
2. Customize it.
3. Save it as a private draft, publish it immediately, or schedule it.
4. See a public item appear in the gallery when publishing is complete.

### Public upload formats

- Never present `.sctemplate` as a public standard; it is not a real interoperable format.
- Do not claim support for arbitrary HTML/CSS/JavaScript or XML presets.
- Do not hide supported formats—show them clearly with limits and examples.
- Planned public file-upload V1 should support **strictly validated Lottie JSON** only after the complete import → preview → customize → export path is proven safe and real.
- Arbitrary executable user content must never run on the platform.

### Publishing states

- Private draft: visible only to owner/admin.
- Scheduled: becomes public at the stored future UTC time through a reliable scheduled worker/process.
- Published: visible in gallery and creator profile.
- Rejected/needs changes: visible to creator with a real moderation note.
- Archived: removed from discovery without destroying audit history.

Required metadata should stay minimal: title, category, short description, preview, template content/source, visibility and optional schedule time. Ask only for fields the platform actually uses.

## 13. Creator Studio

- Dashboard with real published, scheduled, private and review-state counts.
- Template management: edit metadata, open in Studio, schedule, unpublish/archive and delete when safe.
- Real performance metrics: opens, saves, editor starts, exports, likes, comments and shares.
- Audience metrics: followers/following and growth based on genuine events.
- Notifications and support shortcut.
- Account/profile customization.
- Monetization entry shown as **Coming soon** only.

### Creator monetization (future)

Do not display earnings or payout promises until all of the following exist:

- Eligibility policy.
- Real revenue source and creator share formula.
- Fraud/abuse review.
- Tax, KYC and payout-account handling.
- Payout thresholds, refunds and disputes.
- Creator agreement and legally reviewed terms.
- Admin payout review and immutable ledger.

## 14. Social and community system

### Reactions

- Like, comment, save and share are real recorded events.
- Counts are derived from real ledgers and cannot be arbitrary card data.
- Self-actions and repeated clicks must not inflate ranking improperly.
- Comments require authentication and have moderation states.
- Creators receive notifications for relevant activity.

### Follow system

- Follow/unfollow creators.
- Real followers/following counts and lists.
- Cannot follow oneself.
- Idempotent actions so repeated requests do not duplicate records.
- Following may later influence recommendations, but should not trap users in a filter bubble.

### Stars

- Stars are a non-cash appreciation system, fully separate from credits.
- Monthly allowance: Free 5, Pro 25, Pro Max 60.
- Cannot donate Stars to oneself or donate more than the remaining allowance.
- Donations must be transactional and idempotent.
- Creator receives a notification.
- Stars must never imply withdrawable money while monetization is not active.
- Admin can audit abusive or automated Star transfers.

### Reports and moderation

- Report reasons: copyright, spam, abuse/harassment, unsafe content and other.
- Store reporter, target, reason, evidence/details, status and moderator action.
- Rate-limit reporting and protect reporters' private details.

## 15. Notifications

Notification types include:

- Likes, comments and follows.
- Received Stars.
- Template published, scheduled, rejected or needs changes.
- Export/generation completion or failure.
- Support replies.
- Plan/payment status.

Notifications must use real events, have read/unread state and link to an authorized destination.

## 16. Support system

- Durable database-backed support tickets, not local JSON or a fake success alert.
- Guests may submit a valid email address.
- Signed-in users can securely view their ticket history.
- Categories: account, billing, export, template, report/abuse and other.
- Priority and status values with an audit trail.
- User and admin replies stored as a conversation.
- Notify user when support replies.
- Aim to respond within two working days; billing and broken-export issues are prioritized.
- Never claim 24/7 staff or guaranteed response time while the owner is working alone.
- Attachments, if added later, require strict scanning/type/size limits.

## 17. Solo-owner admin console

The current administrator is the owner. The system must be usable by one person and grow into role-based administration later.

### Owner identity and access

- Initial owner email: `karimabdul9065@gmail.com`.
- Initial owner handle: `@karimabdul9065`.
- Role: `super_admin`.
- No admin page or API is available to public/normal users.
- Future admin accounts are granted explicitly; never infer admin from a similar email/handle.

### Admin modules

- Real overview: total/new users, published/scheduled templates, exports and AI jobs over a defined period, open support tickets and reports.
- Template review: approve, reject/request changes, publish, schedule, archive and record review notes.
- Support inbox: filter tickets, reply, update priority/status and view history.
- Users: account status, role, plan and moderation history.
- Content reports: triage, action and close with notes.
- Feature flags.
- System/job health and failures when production infrastructure supports it.
- Immutable admin audit log.

### Initial feature flags

- `creator_monetization = false`
- `paid_ai_models = false`
- `public_lottie_uploads = false`

Sensitive changes must always record actor, action, target, before/after values, timestamp and relevant request metadata.

## 18. Security, database and backend rules

- Postgres/Supabase is accessed through controlled backend code.
- Use RLS/revoked browser access for sensitive tables where appropriate.
- Server validates authorization for every private object by owner ID.
- Unique constraints are the source of truth for handles and idempotency keys.
- Credits, Stars and payments use transactions and immutable ledgers.
- Rate-limit auth, generation, export, comments, follows, Stars, uploads, support and reports.
- Validate and normalize all user input.
- Escape/sanitize user-visible text.
- Validate file signature, MIME type, extension, dimensions, duration and size.
- Store secrets only in environment variables.
- Never expose service-role/database credentials to the browser.
- Use structured logs without passwords, tokens or private message bodies.
- Keep backup/restore and database migration procedures documented.
- Do not delete old production data merely because it looks stale; investigate references and migrate/archive deliberately.

## 19. Analytics and measurement

Only record and display genuine product events. Minimum useful events:

- Template impression, open and preview.
- Editor start and meaningful edit.
- Project save.
- Export requested, succeeded, failed and refunded.
- AI generation requested, succeeded, failed and refunded.
- Like, save, comment, share, follow and Star.
- Signup and plan conversion.
- Template publish/schedule/moderation state.

Analytics definitions must be written down so the admin and creator views cannot show conflicting numbers.

## 20. Legal and trust

- Plain-language Terms and Privacy Policy.
- Explain what data is stored and which processors/services are used.
- User keeps ownership of their original uploaded content and output, subject to third-party asset rights.
- Publishing a template grants ShortsCraft only the permissions required to host, preview and let others customize it.
- Clear copyright-report and takedown route.
- Disclose watermark, credit charge and export quality before export.
- Never use fake scarcity or misleading model/quality claims.
- Payments, verification and Stars must each have an understandable explanation.

## 21. Quality assurance and release gates

### Automated checks

- Server and client syntax/static checks.
- Full route/API regression tests.
- Template schema mutation audit: every editable field affects output; dead fields = 0.
- Auth, session, protected-route and unique-handle tests.
- Credit charge/refund/idempotency tests.
- Plan resolution/watermark entitlement tests.
- Export duration, video stream and playable-file checks.
- Like/comment/save/share/follow/Star ledger tests.
- Publish/private/scheduled visibility tests.
- Support authorization and admin-access tests.
- Fake/placeholder-data scan.
- Mobile overflow and accessibility checks.

### Browser and visual QA

- Guest, Free, Pro, Pro Max and owner/admin journeys.
- Desktop and mobile at minimum.
- Light and dark themes.
- Keyboard-only navigation and reduced motion.
- Actual template previews, uploads and exported videos.
- Empty, loading, error, success and long-content states.

Automated runtime tests do not replace visible human QA. The site is not ready for live release until both layers pass.

### Live release policy

- Do not push a large redesign to the live site only because it compiles.
- Deploy after backups, migrations, environment variables, health checks and core journeys are verified.
- Use a staged rollout if real users already exist.
- Keep a rollback procedure.

## 22. Phased delivery plan

### Phase 1 — Product foundation

- Shared shell, design tokens and light/dark themes.
- Mobile navigation and accessibility foundations.
- Real auth/profile/session rules.
- Remove fake data and misleading copy.

### Phase 2 — Core animation experience

- Home prompt and gallery structure.
- Template search/discovery/details.
- Deep customization and zero-dead-field template audit.
- Preview/editor/export parity.
- Real 480p Free export with credits and watermark.

### Phase 3 — Accounts and paid entitlements

- Cross-device projects/drafts.
- Pricing/credit ledger.
- Razorpay subscriptions.
- Pro/Pro Max quality, watermark and queue priority.

### Phase 4 — Creator platform and community

- Creator Studio and publishing states.
- Scheduling worker.
- Like/comment/save/share/follow/Stars.
- Recommendation algorithm and creator analytics.
- Reports and moderation.

### Phase 5 — Support and administration

- Complete ticket workflow.
- Solo-owner admin modules.
- Feature flags, audit logs, job health and moderation tools.

### Phase 6 — Advanced input and AI

- Safe public Lottie JSON import after end-to-end proof.
- Paid model benchmark/routing after real demand is measured.
- Generation-quality improvements and editable AI scenes.

### Phase 7 — Future products

- Only after animation is stable: thumbnails, banners, post designs and other asset types.
- Each future product needs its own editor/export/data contract rather than being added as a cosmetic menu item.

## 23. Current implementation status

This section is a working status snapshot, not a promise that all listed items have passed final QA.

**9 September 2026 audit update:** see `LAUNCH_READINESS.md` for fresh local
test evidence, completed support-reply work, production-safety checks and the
remaining release gates. Local passes do not mean the live site has been updated.

### Implemented or substantially implemented

- Shared redesign CSS, light-default theme and stored dark-mode toggle.
- Full-width topbar and removal of the old repeated sidebar structure on rebuilt pages.
- Home-page prompt-above-gallery structure.
- Updated pricing structure and removal of the public SEO-tools product path.
- Case-insensitive unique handles.
- Expanded profile fields and real avatar upload/remove flow.
- Real notification foundation.
- Real likes/reactions, follows and Stars ledgers/APIs.
- Public creator profiles.
- Publishing of customized built-in templates with public/private/scheduled states.
- Creator Studio with genuine state counts and Monetization marked Coming soon.
- Real recommendation-metrics endpoint.
- Transactional credit ledger with idempotent charge/refund foundation.
- Database-backed support ticket foundation and user history.
- Solo-owner admin backend/page and initial `super_admin` assignment.
- Template customization mutation audit previously reached zero dead schema fields.
- Free-plan 480p export entitlement.

### Still required before calling the product complete

- Finish signed-in browser QA for support, admin, publishing, Stars, follows and notifications.
- Complete visible desktop/mobile QA for every page and editor control.
- Add safe public Lottie import only after validation/export parity is proven.
- Finish content-report UI and admin moderation workflow.
- Move all drafts/projects to account-side cross-device storage; current browser-local drafts must remain clearly disclosed until then.
- Complete real Razorpay production subscription lifecycle and webhooks.
- Implement/verify actual export queue priorities.
- Benchmark and connect future paid model routing.
- Finish Creator analytics definitions and polished UI.
- Run and pass the complete automated suite after all changes.
- Verify production database migrations, secrets, deployment health, backups and rollback.
- Do final human visual QA and only then push the large redesign live.

## 24. Definition of done

ShortsCraft is considered ready only when:

1. A new user can understand the product, create an account and choose a real template without confusion.
2. Every shown customization changes the preview and final export.
3. A Free user can export a real 480p watermarked MP4 for exactly one credit.
4. Projects and profile data never leak across users or appear for guests.
5. Creator publishing, scheduling and gallery visibility are consistent.
6. Social counts, analytics, credits, Stars and admin numbers are derived from real stored events.
7. Mobile users can reach and use all core actions.
8. Support tickets reach the owner and replies return to the correct user securely.
9. Admin routes and actions reject every unauthorized account.
10. No fake data or misleading promise is visible anywhere.
11. Automated regression checks and visible desktop/mobile QA both pass.
12. Production deployment has a verified rollback path.

---

Future changes should update this document together with the corresponding database, API, UI and tests. If the product behavior and this plan disagree, the mismatch must be resolved deliberately rather than hidden with placeholder UI.
