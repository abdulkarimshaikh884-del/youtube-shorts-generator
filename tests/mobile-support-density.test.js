const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const css = fs.readFileSync(path.join(root, 'public/mobile-compact-20261023.css'), 'utf8');
const block = css.split('/* MOBILE_SUPPORT_COMPACT_START */')[1].split('/* MOBILE_SUPPORT_COMPACT_END */')[0];

test('support density changes are phone-only and do not touch app/account selectors', () => {
  assert.match(block, /^\s*@media \(max-width: 640px\) \{/);
  assert.doesNotMatch(block, /@media\s*\(min-width/);
  assert.doesNotMatch(block, /\.page-home|#designsGrid|\.pf-|\.ig-|\.cp-|\.sh-library|\.de-|\.ed-/);
  assert.doesNotMatch(block, /display:\s*none|visibility:\s*hidden|overflow:\s*hidden/);
});

test('auth compact selectors match all four real authentication screens', () => {
  for (const file of ['login.html', 'signup.html', 'forgot-password.html', 'reset-password.html']) {
    const html = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(html, /class="sh-body pg-bare"/);
    assert.match(html, /class="pg-screen"/);
    assert.match(html, /class="pg-form pg-auth"/);
    assert.match(html, /role="status"/);
  }
  assert.match(block, /\.pg-auth :is\(input,select,textarea\)\s*\{[^}]*font-size: 16px/);
  assert.match(block, /\.pg-pw-toggle\s*\{[^}]*min-width: 36px;[^}]*min-height: 36px/);
  assert.match(block, /:is\(\.pg-bw,\.pg-bo,\.pg-google\)\s*\{[^}]*min-height: 36px/);
});

test('support, prose and error page signatures match real markup without changing content', () => {
  for (const file of ['about.html', 'privacy.html', 'terms.html']) {
    const html = fs.readFileSync(path.join(root, 'public', file), 'utf8');
    assert.match(html, /<main class="pg">/);
    assert.match(html, /<section class="pg-sec pg-prose/);
  }
  const help = fs.readFileSync(path.join(root, 'public/tutorials.html'), 'utf8');
  assert.match(help, /class="pg-steps"/);
  assert.match(help, /class="pg-faq"/);
  assert.match(block, /\.pg-prose :is\(p,li\)\s*\{ font-size: 14px; line-height: 1.6;/);
  assert.match(block, /\.pg-faq summary\s*\{ min-height: 36px;/);
  assert.match(fs.readFileSync(path.join(root, 'public/404.html'), 'utf8'), /class="pg-404"/);
});

test('feedback compacts layout but retains readable input and message sizes', () => {
  const html = fs.readFileSync(path.join(root, 'public/contact.html'), 'utf8');
  assert.match(html, /class="pg sc-contact"/);
  assert.match(html, /id="fbForm"/);
  assert.match(html, /id="supportHistory" hidden/);
  assert.match(block, /\.sc-contact-form :is\(input,select,textarea\)\s*\{ font-size: 16px;/);
  assert.match(block, /\.sc-contact-form textarea\s*\{ min-height: 120px;/);
  assert.match(block, /\.sc-contact-actions \.pg-bw\s*\{ min-height: 36px;/);
});
