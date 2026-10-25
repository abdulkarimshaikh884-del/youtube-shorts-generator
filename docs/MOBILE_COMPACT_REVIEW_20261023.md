# Mobile compact layout — 23 October 2026

The remaining-page follow-up and its wider browser evidence are documented in
`MOBILE_COMPACT_REVIEW_20261024.md` (144 focused checks; local-only).

Scope: the requested Home, Animations and Designs presentation changes. Shared
mobile header/footer are consistent on existing shell documents. Native editors,
generation, private assets, credit charging, database and payment policy are not
changed. Existing desktop components retain their original styling.

## Implemented

- Header: separate spendable Star and credit balances, real API values with
  signed-out/loading/unavailable states, never received/withdrawable totals.
- Home: compact composer and categories; hide the marked helper text/prompt ideas;
  two complete animation cards and a partial third in the swipe row; Popular
  Designs title; compact design details and price outside artwork; equal-height
  tutorial title slots, creator avatar/name and Watch action.
- Home marketing: three short Create Content / Build Audience / Earn Income
  benefit cards; concise workflow cards; hide the marked badges/introductory
  text; compact plan slider retaining Free, Pro and Pro Max; separate four-pack
  Star Pricing slider generated from the existing credit configuration.
- Star purchasing/paid unlocks remain Coming Soon. No paid feature is enabled.
- Both ending callouts use two compact actions. Shared footer retains every
  Product and Legal & Support destination with shorter gaps.
- Animations/Designs: one mobile heading/search/filter row. The actual original
  selects move into an accessible filter panel. Their IDs, listeners and values
  survive opening, filtering and switching back to desktop; there are no clones.

## Verification so far

129 focused tests pass, including seven actual filter-controller fixture tests,
nine actual card-rendering helper tests, eight real category-helper tests, seven compact-layout/balance source
contracts and existing account/navigation/reference-PC release safeguards.
JavaScript syntax and whitespace checks pass.

The initial browser initialization blocker is now resolved. The Designs
follow-up has actual Chrome visual and geometry evidence, described below.
The wider Home/Animations full-page matrix is still pending; unit tests alone
do not certify those views or physical phones.

## Designs follow-up (user clarified two cards per row)

- Mobile Designs now uses two complete cards per row, not three. Title, real
  creator and price/menu each have a separate row so they cannot overlap.
- Decorative, non-focusable search icon; the genuine search input still works.
- Compact swipeable categories are derived from the loaded catalog/filter:
  All, Premium, Thumbnails, Social posts, Posters, Logos (plus future real values).
  Chips use the original filter select/change handlers, not separate fake data.
- Verified in Chrome at 320/378/390/640 widths: two cards in the first row,
  third begins the next; document scroll width equals client width. At 768/1440
  normal desktop controls/styles return, mobile categories/icon are hidden.
- Real catalog checks: Thumbnails 8, Logos 2, Posters 1, Social posts 1,
  Premium 5, All 12. HeyGen search returned its one matching design.
- Existing card options menu opened; native Free filter returned 7 designs.
  No likes, clones, account mutations or payment operations were performed.
- Screenshots in ignored audit_results/mobile-compact-20261023/:
  designs-2-columns-categories-378.jpg, designs-2-columns-categories-320.jpg,
  designs-two-card-change-desktop-1440.jpg. Earlier three-column captures are
  superseded by these two-column captures and are not acceptance evidence.
- Review is light-mode browser emulation, not a physical-device or dark-mode
  certification. Catalog data is public; fixture account balances are synthetic.

## Pending visual acceptance before publication

At 320, 378, 390 and 640 pixels, inspect all three full pages in light/dark mode:

1. Header fits; Stars shows 7 in the labeled read-only fixture (received total
   is deliberately 999), Credits shows 5. Guest Stars shows sign-in state.
2. Composer attachments/model/Create fit without clipping or file-selection loss.
3. Third animation card visibly peeks in Home; categories can swipe.
4. Design price does not cover artwork; creator avatar/name align; tutorials
   have matching heights even for long titles.
5. Benefits/workflow descriptions and paired ending actions fit.
6. Plans and all four Star packs can swipe; purchase remains disabled.
7. Filter button opens real selects, changes real results, supports Escape and
   outside dismissal. Search remains usable and selected values persist.
8. Footer is compact with every destination, no horizontal page overflow.
9. At 768/1440 pixels the normal desktop header/search/selects return, no duplicate
   controls or broken ordering, and mobile-only sections stay hidden.

Use the loopback-only read-only UI fixture for owner/guest states. Its catalog
images are anonymous public GET data, balances/accounts are synthetic, and all
API mutations are refused. Do not mistake its balances for a production account.

## Publication

Not published yet. Await actual browser visual checks and fix observed issues
before committing/publishing this UI pass. The previous live version is intact.
