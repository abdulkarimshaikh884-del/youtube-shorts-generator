"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const {columnLabels, canUseCards} = require("../public/admin-mobile");
const cell = (text, extra = {}) => ({textContent:text, colSpan:1, rowSpan:1, getAttribute:() => null, querySelector:() => null, ...extra});
const row = (...cells) => ({cells});

test("mobile card labels use the real headers, including checkbox and accessible headings", () => {
  assert.deepEqual(columnLabels([
    cell("  User /\n Account "),
    cell("", {querySelector:() => ({})}),
    cell("", {getAttribute:name => name === "aria-label" ? "Actions" : null}),
    cell(""),
  ]), ["User / Account", "Select record", "Actions", "Column 4"]);
});

test("simple native tables and their full-width empty row can become cards", () => {
  const headers = [cell("User"), cell("Plan"), cell("Actions")];
  assert.equal(canUseCards(headers, [row(cell("A"), cell("Free"), cell("Edit"))]), true);
  assert.equal(canUseCards(headers, [row(cell("No records", {colSpan:3}))]), true);
  assert.equal(canUseCards(headers, []), true);
});

test("complex or mismatched tables retain the original horizontal table", () => {
  const headers = [cell("User"), cell("Plan"), cell("Actions")];
  assert.equal(canUseCards([], []), false);
  assert.equal(canUseCards([cell("Group", {colSpan:2})], []), false);
  assert.equal(canUseCards(headers, [row(cell("A"), cell("Free"))]), false);
  assert.equal(canUseCards(headers, [row(cell("A", {rowSpan:2}), cell("Free"), cell("Edit"))]), false);
  assert.equal(canUseCards(headers, [row(cell("A", {colSpan:2}), cell("Edit"))]), false);
});

test("enhancement is presentation-only and handles rebuilt lists without modifying source HTML", () => {
  const source = fs.readFileSync(path.resolve(__dirname, "../public/admin-mobile.js"), "utf8");
  assert.match(source, /MutationObserver/);
  assert.match(source, /childList: true, subtree: true/);
  assert.match(source, /aria-controls/);
  assert.match(source, /mc-mobile-cards/);
  assert.doesNotMatch(source, /\bfetch\s*\(|XMLHttpRequest|innerHTML|\.submit\s*\(|localStorage|sessionStorage/);
});
