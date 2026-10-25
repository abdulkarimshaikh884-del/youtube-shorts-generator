"use strict";

// Source and inert-DOM contracts do not certify visual spacing or real phones.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const home = read("public/index.html"), css = read("public/mobile-compact-20261023.css");
const auth = read("public/authui.js");

test("mobile benefits and Star packs are additive and hidden on desktop", () => {
  const base = css.slice(0, css.indexOf("@media"));
  for (const selector of [".mc-benefits", "#homeStarPricing", ".mc-stars-balance", ".ds-card-mobile-price", ".sh-tut-avatar"]) assert.ok(base.includes(selector));
  assert.match(base, /display: none/);
  assert.match(base, /\.ds-card-heading\s*\{\s*display: contents/);
  assert.match(css, /@media \(max-width: 640px\)/);
  assert.equal((home.match(/class="mc-benefit"/g) || []).length, 3);
  for (const title of ["Create Content", "Build Audience", "Earn Income", "Star Pricing", "Popular Designs"]) assert.ok(home.includes(title));
});

test("all configured Star packs retain their real quantity and price, without enabling purchases", () => {
  const credits = read("credits.js");
  const start = credits.indexOf("const STAR_PACKS = ["), end = credits.indexOf("\n];", start);
  const packs = vm.runInNewContext(credits.slice(start, end + 3) + "\nSTAR_PACKS;", {});
  const section = home.slice(home.indexOf('id="homeStarPricing"'), home.indexOf('<!-- Final mobile CTA'));
  assert.equal((section.match(/class="mc-star-card/g) || []).length, packs.length);
  for (const pack of packs) {
    assert.ok(section.includes('data-star-pack="' + pack.id + '"'));
    assert.ok(section.includes(pack.inr));
    assert.ok(section.includes(" " + pack.stars + " <small>Stars"));
  }
  assert.equal((section.match(/disabled aria-disabled="true">Coming Soon/g) || []).length, packs.length);
});

test("mobile removes helper rows, uses swipe previews, compact footer and paired CTA actions", () => {
  for (const selector of [".sh-studio-sub", ".sh-prompt-ideas", ".sh-stars-strip", ".sh-ce-badge-pill", ".sh-ce-subhead"]) assert.ok(css.includes(selector));
  assert.match(css, /grid-auto-columns: 43%/);
  assert.match(css, /grid-auto-columns: 76%/);
  assert.match(css, /\.sh-fcol a[^}]*min-height: 28px/);
  assert.match(css, /\.sh-frow[^}]*grid-template-columns: repeat\(2/);
  assert.match(css, /\.sh-gallery-end-actions[^}]*grid-template-columns: repeat\(2/);
  assert.match(css, /\.sh-workflow-card\s*\{\s*position: relative/);
});

test("mobile Designs catalog has two columns and a decorative search icon without changing Home", () => {
  const phone = css.slice(css.indexOf('@media (max-width: 640px)'));
  assert.match(phone, /\.ds-page-container #designsGrid\s*\{[^}]*grid-template-columns: repeat\(2,minmax\(0,1fr\)\)/);
  assert.match(phone, /#designsGrid \.ds-card-author\s*\{[^}]*grid-column: 1 \/ -1; grid-row: 2/);
  assert.match(phone, /#designsGrid \.ds-card-menu-trigger\s*\{[^}]*grid-column: 2; grid-row: 3/);
  assert.match(phone, /\.ds-search-icon\s*\{[^}]*pointer-events: none/);
  const html = read('public/designs.html');
  const source = read('build_pages.js');
  for (const content of [html, source]) {
    assert.equal((content.match(/class="ds-search-icon"/g) || []).length, 1);
    assert.match(content, /class="ds-search-icon"[^>]*aria-hidden="true" focusable="false"/);
    assert.ok(content.includes('id="designSearch"'));
    assert.ok(content.includes('id="designFilter"'));
  }
});

test("catalog integration loads the controller once after original handlers with current cache keys", () => {
  for (const file of ["public/animations.html", "public/designs.html"]) {
    const html = read(file);
    assert.equal((html.match(/<script src="\/mobile-catalog\.js/g) || []).length, 1, file);
    assert.ok(html.includes('/mobile-catalog.js?v=2026102301'));
    assert.ok(html.indexOf('/mobile-catalog.js') > html.indexOf(file.includes('designs') ? '/designs.js?' : '/shell.js?'));
  }
  const builder = read('build_pages.js');
  assert.ok(builder.includes('/authui.js?v=2026102301'));
  for (const page of ['animationsPage', 'designsPage']) {
    const start = builder.indexOf('const ' + page + ' = {');
    const end = builder.indexOf('\n};', start);
    assert.ok(start > 0 && end > start);
    const definition = builder.slice(start, end);
    assert.equal((definition.match(/\/mobile-catalog\.js\?v=2026102301/g) || []).length, 1, page + ' retains filters when rebuilt');
  }
});

test("mobile credit UI uses validated live credits and never substitutes a static balance", () => {
  const start = auth.indexOf("  window.SC_CREDIT_UI = {");
  const end = auth.indexOf("\n  function safeProfileUrl", start);
  const number = {textContent: "—"}, legacy = {textContent: ""};
  const chip = {dataset: {}, classList: {contains: name => name === 'sh-credit-chip'}, removeAttribute() {}, setAttribute(name, value) {this[name] = value;}};
  const context = {window: {}, all: selector => selector === '.mc-credit-value' ? [number] : selector.includes('.sh-credit-chip') ? [chip] : [legacy]};
  vm.runInNewContext(auth.slice(start, end), context);
  const ui = context.window.SC_CREDIT_UI;
  ui.validate({success: true, left: 1234, perDay: 5, plan: 'free'});
  assert.equal(number.textContent, '1,234');
  assert.equal(chip['aria-label'], '1234 available credits. View plan and credits.');
  ui.state('unavailable');
  assert.equal(number.textContent, '—');
  assert.equal(chip['aria-label'], 'Credits could not load. Reload to retry.');
  ui.state('loading');
  assert.equal(chip['aria-label'], 'Loading your balance');
  for (const left of [-1, 1.5, '5', NaN]) assert.throws(() => ui.validate({success: true, left, perDay: 5}));
});

test("Star header reads only spendable balance, not received or withdrawable totals", async () => {
  const start = auth.indexOf("  if ($('.mc-stars-value')) {");
  const end = auth.indexOf("\n  // Same reviewed Free-only", start);
  assert.ok(start >= 0 && end > start);
  async function scenario(status, data, timeoutAvailable = true) {
    const value = {textContent: '—'}, link = {setAttribute(key, val) {this[key] = val;}};
    let calls = 0;
    const context = {$: () => value, all: selector => selector === '.mc-stars-value' ? [value] : [link],
      AbortSignal: timeoutAvailable ? AbortSignal : undefined, Number, Error,
      fetch: async (url, options) => {calls++; assert.equal(url, '/api/stars'); assert.equal(options.method, undefined); return {status, ok: status === 200, json: async () => data};}};
    vm.runInNewContext(auth.slice(start, end), context);
    await new Promise(resolve => setImmediate(resolve));
    return {value, link, calls};
  }
  const ready = await scenario(200, {success: true, balance: 7, received: 999, withdrawableStars: 888, monetizationEnabled: false});
  assert.equal(ready.value.textContent, '7');
  assert.match(ready.link.title, /paid unlocks Coming Soon/);
  assert.equal(ready.calls, 1);
  assert.equal((await scenario(200, {success: true, balance: 7}, false)).value.textContent, '7', 'Older browsers without AbortSignal.timeout retain the shared auth initializer');
  assert.equal((await scenario(500, {})).value.textContent, '—');
  const guest = await scenario(401, {});
  assert.equal(guest.value.textContent, '—');
  assert.match(guest.link.href, /^\/login\?/);
  assert.equal((await scenario(200, {success: true, balance: '7'})).value.textContent, '—');
});
