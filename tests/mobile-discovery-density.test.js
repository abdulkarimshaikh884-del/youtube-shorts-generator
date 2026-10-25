"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");
const css = read("public/mobile-compact-20261023.css").split("/* MOBILE_DISCOVERY_COMPACT_START */")[1].split("/* MOBILE_DISCOVERY_COMPACT_END */")[0];

test("remaining discovery density is bounded to phone media and approved page hooks", () => {
  const rules = css.replace(/\/\*[\s\S]*?\*\//g, "").trim();
  assert.ok(rules.startsWith("@media (max-width: 640px) {"));
  let depth = 0;
  for (let i = rules.indexOf("{"); i < rules.length; i += 1) {
    if (rules[i] === "{") depth += 1;
    if (rules[i] === "}") depth -= 1;
    if (depth === 0) assert.equal(i, rules.length - 1, "no declarations outside phone media");
  }
  assert.equal(depth, 0);
  assert.doesNotMatch(rules, /page-home|designsGrid|ds-page-container|display:\s*none/);
});

test("tutorial, project and creator collections remain two-column and preserve actionable controls", () => {
  for (const hook of [".sk-grid", "#draftGrid", "#creatorGrid"]) assert.ok(css.includes(hook));
  assert.ok((css.match(/repeat\(2,minmax\(0,1fr\)\)/g) || []).length >= 4);
  assert.match(css, /\.sk-menu-btn\s*\{[^}]*min-width: 26px[^}]*min-height: 28px/);
  assert.match(css, /#draftGrid \.cr-cre-actions \.cr-cre-icon\s*\{[^}]*min-height: 36px/);
  assert.match(css, /\.sk-search input\s*\{[^}]*font-size: 16px/);
  assert.ok(read("public/community.html").includes('id="tutorialSearch"'));
  assert.ok(read("public/drafts-page.js").includes('className = "cr-cre-icon cr-cre-ren"'));
  assert.ok(read("public/creator.html").includes('id="creatorGrid"'));
});

test("pricing is scrollable without removing configured plans, calculator or Coming Soon safeguards", () => {
  assert.match(css, /\.pg-pricing \.pg-plans\s*\{[^}]*grid-auto-flow: column[^}]*overflow-x: auto[^}]*scroll-snap-type: x proximity/);
  assert.match(css, /\.pg-pricing \.pg-calc\s*\{[^}]*display: flex/);
  const pricing = read("public/pricing.html");
  assert.ok(pricing.includes('class="pg-plans pg-plans3" id="plans"'), 'Calculator recommendation has a real plan destination');
  assert.ok(read('build_pages.js').includes('class="pg-plans pg-plans3" id="plans"'));
  for (const pack of ["stars_10", "stars_45", "stars_120", "stars_260"]) {
    assert.match(pricing, new RegExp('data-star-pack="' + pack + '"[^>]*disabled[^>]*>Coming Soon<'));
  }
  for (const plan of ["pro", "promax"]) {
    assert.match(pricing, new RegExp('data-plan="' + plan + '"[^>]*disabled[^>]*>Coming Soon<'));
  }
});

test("template detail retains all four actions, comment input and normal outer-page scrolling", () => {
  const template = read("public/template.html");
  for (const id of ["detailReplayBtn", "detailLikeBtn", "detailShareBtn", "detailReportBtn", "commentInput"]) assert.ok(template.includes('id="' + id + '"'));
  assert.match(css, /\.sh-modal-card:has\(#detailStage\)\s*\{[^}]*max-height: none[^}]*overflow: visible/);
  assert.match(css, /\.sh-modal-card:has\(#detailStage\) \.sh-modal-ctrls\s*\{[^}]*repeat\(4,minmax\(0,1fr\)\)/);
  assert.match(css, /\.sh-m-comm-input\s*\{[^}]*font-size: 16px/);
});
