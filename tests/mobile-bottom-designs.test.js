"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const builder = fs.readFileSync(path.join(root, "build_pages.js"), "utf8");
const start = builder.indexOf("const BOTTOM_TABS = [");
const end = builder.indexOf("\nfunction chrome(p)", start);
assert.ok(start >= 0 && end > start);
const render = vm.runInNewContext(builder.slice(start, end) + "\nbottomNav;", {});
const navOf = html => html.match(/<nav class="sh-bottomnav"[\s\S]*?<\/nav>/)?.[0];

test("shared mobile second tab is Designs with an image icon and correct destination", () => {
  const html = render({route: "/", active: "home"});
  const tabs = [...html.matchAll(/<a\b[\s\S]*?<\/a>/g)].map(m => m[0]);
  assert.equal(tabs.length, 5);
  assert.match(tabs[1], /href="\/designs"/);
  assert.match(tabs[1], /sh-bn-designs/);
  assert.match(tabs[1], />Designs<\/span>/);
  assert.match(tabs[1], /<circle cx="8.5"/);
  assert.doesNotMatch(html, /sh-bn-templates|>Templates<\/span>/);
});

test("Designs is active only on Designs, not animation or public creator pages", () => {
  assert.match(render({route: "/designs", active: "designs"}), /sh-bn-designs" aria-current="page"/);
  for (const route of ["/", "/animations", "/template", "/creator", "/community", "/account"]) {
    assert.doesNotMatch(render({route}), /sh-bn-designs" aria-current/);
  }
});

test("every shipped shell document matches its builder's Designs tab", () => {
  let count = 0;
  for (const name of fs.readdirSync(path.join(root, "public")).filter(name => name.endsWith(".html"))) {
    const html = fs.readFileSync(path.join(root, "public", name), "utf8");
    const nav = navOf(html);
    if (!nav) continue;
    count++;
    assert.match(nav, /href="\/designs" class="sh-bn-tab sh-bn-designs"/, name);
    assert.match(nav, />Designs<\/span>/, name);
    assert.doesNotMatch(nav, /sh-bn-templates|href="\/animations"/, name);
    assert.equal(/sh-bn-designs" aria-current="page"/.test(nav), name === "designs.html", name);
    assert.match(html, /<a href="\/animations"/, name + " retains other animation-library navigation");
  }
  assert.equal(count, 18);
});
