"use strict";

// Scoped source contracts only; actual phone geometry is verified separately.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const read = name => fs.readFileSync(path.join(__dirname, "..", name), "utf8");
const css = read("public/mobile-compact-20261023.css");
const start = css.indexOf("/* MOBILE_ACCOUNT_COMPACT_START */");
const end = css.indexOf("/* MOBILE_ACCOUNT_COMPACT_END */");
const block = css.slice(start, end);

test("account density changes are mobile-only and scoped to actual account containers", () => {
  assert.ok(start > 0 && end > start);
  assert.match(block, /@media \(max-width: 640px\)/);
  assert.equal((block.match(/@media/g) || []).length, 1);
  assert.doesNotMatch(block, /display:\s*none|visibility:\s*hidden|overflow:\s*hidden/);
  const rules = Array.from(block.replace(/\/\*[\s\S]*?\*\//g, "").matchAll(/([^{}]+)\{([^{}]*)\}/g));
  assert.ok(rules.length > 60);
  for (const rule of rules) {
    const selector = rule[1].trim();
    assert.match(selector, /^body\.sh-body (?:#accountBox|#accountGuest|\.ig-main)/, selector);
  }
});

test("runtime moved panes keep compact controls and non-zooming input text", () => {
  const routes = read("public/account-settings.js");
  assert.match(routes, /detail\.id = "accountDetail"/);
  assert.match(routes, /detail\.className = "pf-settings pf-detail"/);
  assert.match(routes, /host\.after\(detail\)/);
  assert.match(block, /#accountBox :is\(\.pf-settings,\.pf-detail\)/);
  assert.match(block, /#accountBox :is\(input[^}]+font-size: 16px !important/);
  assert.match(block, /#accountBox \.ig-btn\s*\{[^}]*min-height: 36px/);
  assert.match(block, /#accountBox \.pf-detail-back\s*\{[^}]*min-height: 36px/);
  assert.match(block, /#accountBox \.ig-person-name\s*\{[^}]*min-height: 24px/);
});

test("account facts, support, notification and referral views receive compact spacing", () => {
  for (const selector of [".ig-account-grid", ".ig-account-card", ".pf-transaction-row", ".ig-support-head", ".ig-ticket", ".ig-person", ".pf-notification-feed", "#referralSettings", ".rf-fine-print"]) {
    assert.ok(block.includes(selector), selector);
  }
  const account = read("public/account.html");
  for (const id of ["referralSettings", "accountNotificationList", "supportTicketList", "followersList", "followingList", "accountBox", "accountGuest"]) {
    assert.ok(account.includes('id="' + id + '"'), id);
  }
  assert.ok(account.includes("Money features") || account.includes("Coming Soon"));
});
