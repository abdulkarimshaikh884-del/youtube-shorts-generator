"use strict";

// Static integration/coverage contracts only. This test does not launch a
// browser, authenticate, contact providers or prove rendered mobile usability.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const server = read("server.js");
const accountRoutes = require("../public/account-routes");
const mobileStyle = "/mobile-compact-20261023.css";

// The finite route matrix includes aliases deliberately. It is not a count of
// unique designs, and query/hash editor states are audited separately.
const auditRoutes = [
  "/", "/animations", "/designs", "/community", "/pricing", "/tutorials",
  "/about", "/contact", "/privacy", "/terms", "/login", "/signup",
  "/forgot-password", "/reset-password", "/creator", "/template", "/drafts",
  "/account", "/account/creations", "/account/edit-profile", "/account/credits",
  "/account/notifications", "/account/support", "/account/referrals",
  "/account/followers", "/account/following", "/editor", "/design-editor",
  "/reference-motion", "/admin", "/help", "/settings", "/uploads",
  "/account/appearance", "/account/earnings", "/account/logout"
];

function registeredPages() {
  const start = server.indexOf("const PAGES = {");
  const end = server.indexOf("\n};", start);
  assert.ok(start !== -1 && end > start, "Actual server page registry is available");
  // Only evaluate the literal registry, never server boot (DB/credits/workers).
  return vm.runInNewContext(server.slice(start, end + 3) + "\nPAGES;", {});
}

function stylesheetTags(html) {
  return [...html.matchAll(/<link\b[^>]*>/gi)].filter(match =>
    /\brel\s*=\s*["']stylesheet["']/i.test(match[0])
  ).map(match => ({tag: match[0], index: match.index,
    href: match[0].match(/\bhref\s*=\s*["']([^"']+)["']/i)?.[1] || ""}));
}

function customerDocuments() {
  const files = new Set(Object.values(registeredPages()));
  files.delete("settings.html"); // compatibility redirect, not another screen
  files.add("404.html");
  return [...files].map(file => "public/" + file).concat("reference-motion/editor.html");
}

test("mobile audit matrix covers registered customer routes, account subpages and explicit aliases", () => {
  assert.equal(auditRoutes.length, new Set(auditRoutes).size, "No duplicate audit entries");
  const registered = new Set([...Object.keys(registeredPages()), ...Object.values(accountRoutes),
    "/uploads", "/reference-motion"]);
  assert.deepEqual([...auditRoutes].sort(), [...registered].sort(),
    "New customer routes need an explicit screenshot-audit entry");
  assert.equal(auditRoutes.length + 1, 37,
    "37 entries include the unknown-route 404 check; aliases are not unique pages");
});

test("canonical customer documents retain responsive viewport and browser zoom", () => {
  for (const file of customerDocuments()) {
    const html = read(file);
    const viewport = html.match(/<meta\b(?=[^>]*\bname=["']viewport["'])[^>]*>/i)?.[0];
    assert.ok(viewport, file + " needs a viewport declaration");
    assert.match(viewport, /width\s*=\s*device-width/i, file);
    assert.match(viewport, /initial-scale\s*=\s*1(?:\D|$)/i, file);
    assert.doesNotMatch(viewport, /user-scalable\s*=\s*(?:no|0)|maximum-scale\s*=\s*1(?:[.,\s"']|$)/i,
      file + " must not disable pinch zoom");
  }
});

test("shared mobile stylesheet is an explicit final layer on every customer document", () => {
  assert.ok(fs.existsSync(path.join(root, "public", mobileStyle.slice(1))),
    "The shared mobile stylesheet must be checked in, not injected by the QA harness");
  for (const file of customerDocuments()) {
    const html = read(file);
    const styles = stylesheetTags(html);
    const added = styles.filter(item => item.href.split("?")[0] === mobileStyle);
    assert.equal(added.length, 1, file + " loads one shared mobile stylesheet");
    assert.equal(styles.at(-1)?.href.split("?")[0], mobileStyle,
      file + " must not load legacy styles after the mobile layer");
    const laterInline = [...html.matchAll(/<style\b/gi)].some(item => item.index > added[0].index);
    assert.equal(laterInline, false, file + " must not override the mobile layer with later inline styles");
  }
});

test("generated and hand-maintained documents share the mobile layer without losing preservation guards", () => {
  const builder = read("build_pages.js");
  assert.ok(builder.includes(mobileStyle), "Generated pages must inherit the layer from their source builder");
  for (const file of ["account.html", "settings.html", "admin.html", "designs.html"]) {
    assert.ok(builder.includes('"' + file + '"'), "Keep hand-maintained preservation policy for " + file);
  }
  assert.match(builder, /Missing canonical hand-maintained page/,
    "A responsive rebuild must not silently replace a missing canonical application page");
});

test("admin audit includes every permission-controlled section, not only its dashboard", () => {
  const expected = ["overview", "users", "creators", "content", "skills", "reports",
    "withdrawals", "stars_ledger", "star_packs", "ai_jobs", "broadcast", "team", "support", "system"];
  const actual = [...read("public/admin.html").matchAll(/data-admin-panel=["']([^"']+)["']/g)].map(item => item[1]);
  assert.deepEqual([...new Set(actual)].sort(), expected.sort(),
    "New admin panels need fixture and mobile-state coverage");
});

test("audit document separates browser evidence, static checks and untested physical devices", () => {
  const doc = read("docs/MOBILE_RESPONSIVE_AUDIT_20261021.md");
  for (const heading of ["## Before", "## After", "## Evidence boundaries", "## Route matrix", "## Interactive states"]) {
    assert.ok(doc.includes(heading), heading);
  }
  assert.match(doc, /37 route entries/);
  assert.match(doc, /physical devices/i);
  assert.match(doc, /aliases/i);
});
