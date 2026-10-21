'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const source = fs.readFileSync(require.resolve('../public/authui.js'), 'utf8');
test('dedicated follower routes load after the authenticated owner is known', () => {
  const init = source.slice(source.indexOf('  function init() {'), source.indexOf('  if (document.readyState === "loading")', source.indexOf('  function init() {')));
  const assignment = init.indexOf('currentUser = j && j.user;');
  const load = init.indexOf('loadPeoplePane(window.SC_ACCOUNT_NAV.current);');
  assert.ok(assignment >= 0 && load > assignment);
  assert.match(init.slice(assignment, load), /if \(currentUser && window\.SC_ACCOUNT_NAV &&/);
  assert.match(init.slice(assignment, load), /\["followers", "following"\]\.includes/);
  assert.ok(load < init.indexOf('window.SC_AUTH_READY = true;'));
});
test('follow-list loading remains GET-only, owner-scoped and retryable', () => {
  const loader = source.slice(source.indexOf('  function loadPeoplePane(kind) {'), source.indexOf('  function personRow(p) {'));
  assert.match(loader, /currentUser && currentUser.handle/);
  assert.match(loader, /encodeURIComponent\(handle\)/);
  assert.match(loader, /box.dataset.loaded === "1"/);
  assert.match(loader, /box.dataset.loaded = ""/);
  assert.doesNotMatch(loader, /method\s*:\s*["'](?:POST|PUT|DELETE|PATCH)/);
});
