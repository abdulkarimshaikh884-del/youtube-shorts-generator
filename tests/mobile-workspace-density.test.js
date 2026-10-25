"use strict";
// Static style scope checks, not substitutes for editor rendering/interaction QA.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const css = read("public/mobile-compact-20261023.css");
const block = css.slice(css.indexOf("/* MOBILE_WORKSPACES_COMPACT_START */"), css.indexOf("/* MOBILE_WORKSPACES_COMPACT_END */"));

test("workspace density is phone-only, scoped and does not hide processing or edit controls", () => {
  assert.equal((block.match(/@media/g) || []).length, 1);
  assert.match(block, /@media \(max-width: 640px\)/);
  assert.doesNotMatch(block, /display:\s*none|visibility:\s*hidden|transform:\s*scale/);
  assert.ok(block.includes("body.ed-body"));
  assert.ok(block.includes(".de-app"));
  assert.ok(block.includes("body.rm-body"));
  assert.ok(block.includes(".admin-page"));
});

test("editable inputs keep 16px text and toolbar actions remain reachable", () => {
  assert.match(block, /\.ed-name\s*\{[^}]*font-size: 16px/);
  assert.match(block, /\.de-proj-title\s*\{[^}]*font-size: 16px/);
  assert.match(block, /body\.rm-body :is\(input,select,textarea\)[^}]*font-size: 16px/);
  assert.match(block, /\.ed-back,\.ed-credits,\.ed-export,\.ed-pbtn[^}]*min-height: 36px/);
  assert.match(block, /\.de-mob-btn\s*\{[^}]*min-height: 40px/);
});

test("reference presentation has a dedicated hook without changing its renderer or consent flow", () => {
  assert.ok(read("reference-motion/editor.html").includes('<body class="rm-body">'));
  const editor = read("remotion/src/ReferenceEditor.tsx");
  for (const text of ["owner-pc-upload-notice", "Allow private processing on the ShortsCraft operator PC", "Audio is not reconstructed"]) assert.ok(editor.includes(text));
  for (const file of ["public/editor.html", "public/design-editor.html", "reference-motion/editor.html"]) assert.ok(read(file).includes("/mobile-compact-20261023.css"));
});
