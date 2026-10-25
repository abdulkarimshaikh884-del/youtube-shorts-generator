"use strict";

// Offline source and inert-DOM regressions. Browser screenshots still verify
// actual geometry, scrolling and readability; this file never boots the server.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const root = path.resolve(__dirname, "..");
const read = name => fs.readFileSync(path.join(root, name), "utf8");
const builder = read("build_pages.js");
const compact = read("public/mobile-compact-20261023.css");
const navOf = html => html.match(/<div\b[^>]*\bid="navMobile"[^>]*>[\s\S]*?<\/div>/)?.[0];
// Follow the actual route registry, rather than changing unregistered legacy
// documents merely because they remain in public/.
const server = read("server.js");
const registryStart = server.indexOf("const PAGES = {");
const registryEnd = server.indexOf("\n};", registryStart);
assert.ok(registryStart >= 0 && registryEnd > registryStart);
const pageRegistry = vm.runInNewContext(server.slice(registryStart, registryEnd + 3) + "\nPAGES;", {});
const shellDocuments = [...new Set([...Object.values(pageRegistry), "404.html"])]
  .map(name => ({ name, html: read("public/" + name) }))
  .filter(doc => navOf(doc.html));

// Read simple style blocks with their containing media queries, without
// evaluating CSS or depending on whitespace/complete stylesheet snapshots.
function rulesOf(css, media = []) {
  const text = css.replace(/\/\*[\s\S]*?\*\//g, "");
  const rules = [];
  let cursor = 0;
  while (cursor < text.length) {
    const open = text.indexOf("{", cursor);
    if (open === -1) break;
    const selector = text.slice(cursor, open).trim();
    let end = open + 1, depth = 1;
    for (; end < text.length && depth; end++) {
      if (text[end] === "{") depth++;
      if (text[end] === "}") depth--;
    }
    assert.equal(depth, 0, "Balanced CSS blocks");
    const body = text.slice(open + 1, end - 1);
    if (selector.startsWith("@")) {
      rules.push(...rulesOf(body, selector.startsWith("@media") ? media.concat(selector) : media));
    } else {
      const declarations = Object.fromEntries(body.split(";").map(part => {
        const colon = part.indexOf(":");
        return colon < 0 ? [] : [part.slice(0, colon).trim(), part.slice(colon + 1).trim()];
      }).filter(pair => pair.length));
      rules.push({ selector, declarations, media });
    }
    cursor = end;
  }
  return rules;
}
const rules = rulesOf(compact);
const phoneOnly = rule => rule.media.some(query => /max-width\s*:\s*640px/.test(query));

test("every mobile menu removes only the duplicate publishing and Profile entries", () => {
  assert.ok(shellDocuments.length >= 15, "Inspect the shipped shell documents, not one fixture");
  assert.ok(shellDocuments.some(doc => doc.name === "account.html"));
  assert.ok(shellDocuments.some(doc => doc.name === "designs.html"));
  for (const doc of [{ name: "build_pages.js", html: builder }, ...shellDocuments]) {
    const menu = navOf(doc.html);
    assert.ok(menu, doc.name + " has the shared mobile menu");
    assert.doesNotMatch(menu, /sh-m-upload-btn|Publish Template|href="\/account"|>\s*Profile\s*</, doc.name);
    for (const href of ["/animations", "/designs", "/community", "/drafts", "/editor", "/login", "/signup"]) {
      assert.ok(menu.includes('href="' + href + '"'), doc.name + " retains " + href);
    }
    assert.match(menu, /id="navMobileLogout"[^>]*data-auth="in"[^>]*hidden/, doc.name + " retains authenticated logout");
  }
});

test("bottom Profile and the existing publishing entry points remain available", () => {
  for (const { name, html } of shellDocuments) {
    const bottom = html.match(/<nav\b[^>]*class="sh-bottomnav"[^>]*>[\s\S]*?<\/nav>/)?.[0];
    assert.ok(bottom, name + " retains bottom navigation");
    assert.match(bottom, /<a\b[^>]*href="\/account"[^>]*sh-bn-profile[^>]*>[\s\S]*?\bProfile\b/, name);
    assert.match(html, /id="topbarUploadBtn"/, name + " retains desktop upload");
    assert.match(html, /id="popoverUploadBtn"/, name + " retains profile upload");
  }
});

test("runtime mobile navigation stays idempotent and does not restore removed items", () => {
  const source = read("public/authui.js");
  const start = source.indexOf("  function completeMobileNav() {");
  const end = source.indexOf("\n  function init()", start);
  assert.ok(start >= 0 && end > start);
  const runtime = source.slice(start, end);
  assert.doesNotMatch(runtime, /sh-m-upload-btn|href=[\\"']*\/account/);
  const menu = { dataset: {}, children: [] };
  function element(tag, attrs = {}) {
    const el = { tag, ...attrs, className: attrs.className || "", setAttribute(name, value) { this[name] = value; } };
    el.classList = { add(name) { if (!el.className.split(/\s+/).includes(name)) el.className += " " + name; } };
    Object.defineProperty(el, "nextSibling", { get: () => menu.children[menu.children.indexOf(el) + 1] || null });
    return el;
  }
  menu.querySelector = selector => menu.children.find(el => {
    if (selector[0] === ".") return el.className.split(/\s+/).includes(selector.slice(1));
    if (selector[0] === "#") return el.id === selector.slice(1);
    return el.tag === "a" && selector === 'a[href="' + el.href + '"]';
  }) || null;
  menu.appendChild = el => { menu.children = menu.children.filter(item => item !== el); menu.children.push(el); };
  menu.insertBefore = (el, ref) => {
    const index = ref ? menu.children.indexOf(ref) : menu.children.length;
    menu.children.splice(index, 0, el);
  };
  Object.defineProperty(menu, "firstChild", { get: () => menu.children[0] || null });
  for (const match of navOf(builder).matchAll(/<(a|button)\b([^>]*)>[\s\S]*?<\/\1>/g)) {
    const attr = name => match[2].match(new RegExp('\\b' + name + '="([^"]*)"'))?.[1];
    menu.children.push(element(match[1], { href: attr("href"), id: attr("id"), className: attr("class"), auth: attr("data-auth") }));
  }
  const complete = vm.runInNewContext(runtime + "\ncompleteMobileNav;", {
    $: selector => selector === "#navMobile" ? menu : null,
    document: { createElement: tag => element(tag) }
  });
  complete();
  const once = menu.children.slice();
  complete();
  assert.deepEqual(menu.children, once, "Repeated auth initialization must not duplicate/reorder links");
  assert.equal(menu.children.filter(el => el.auth !== "out")[0].href, "/editor", "Create Animation remains the first signed-in menu action");
  assert.equal(menu.children.at(-1).id, "navMobileLogout", "Log out remains last");
  assert.equal(menu.children.filter(el => el.href === "/account").length, 0);
  for (const href of ["/drafts", "/settings", "/tutorials"]) {
    assert.equal(menu.children.filter(el => el.href === href).length, 1, href + " is retained once");
  }
});

test("clearing a zero-result gallery filter never counts or mounts its empty-state message", () => {
  const source = read("public/shell.js");
  const start = source.indexOf("  function filterTiles() {");
  const end = source.indexOf("\n  function buildGallery()", start);
  assert.ok(start >= 0 && end > start);
  const makeElement = (className = "") => {
    const el = { className, dataset: {}, hidden: false };
    el.classList = { contains: name => el.className.split(/\s+/).includes(name) };
    return el;
  };
  const first = makeElement("sh-tile"), second = makeElement("sh-tile");
  first.dataset = { name: "Growth chart", cat: "charts", source: "official" };
  second.dataset = { name: "Kinetic title", cat: "text", source: "official" };
  const grid = { children: [first, second], appendChild(el) { this.children.push(el); }, querySelectorAll() { return this.children.filter(el=>el.classList.contains('sh-tile')); } };
  const mounted = [];
  const context = {
    searchQuery: "not a template", currentCategory: "all", currentSource: "all",
    $: selector => selector === "#gallery" ? grid : grid.children.find(el => "#" + el.id === selector) || null,
    document: { createElement: () => makeElement() },
    mount: el => mounted.push(el)
  };
  const filter = vm.runInNewContext(source.slice(start, end) + "\nfilterTiles;", context);
  filter();
  const empty = grid.children.find(el => el.id === "galleryEmpty");
  assert.ok(empty && !empty.hidden, "A missing search shows the empty state");
  assert.ok(first.hidden && second.hidden);
  assert.equal(mounted.length, 0);
  context.searchQuery = "";
  filter();
  assert.ok(empty.hidden, "Clearing the search restores real templates");
  assert.ok(!first.hidden && !second.hidden);
  assert.deepEqual(mounted, [first, second], "Only actual template previews are mounted");
  mounted.length = 0;
  context.currentCategory = "not a category";
  filter();
  assert.ok(!empty.hidden && first.hidden && second.hidden, "A subsequent zero-result category still works");
  assert.equal(grid.children.filter(el => el.id === "galleryEmpty").length, 1);
  assert.equal(mounted.length, 0);
});

test("independent horizontal rows apply only to the phone Home collections", () => {
  const rowRules = rules.filter(rule => /body\.page-home \.mc-card-row$/.test(rule.selector));
  assert.ok(rowRules.length > 0, "Each row owns its horizontal scroll layout");
  for (const rule of rowRules) {
    assert.ok(phoneOnly(rule), "Three rows must not change desktop");
    assert.match(rule.selector, /body\.page-home\b/);
    assert.match(rule.selector, /\.mc-card-row/);
    assert.doesNotMatch(rule.selector, /sh-library/);
  }
  const styles = Object.assign({}, ...rowRules.map(rule => rule.declarations));
  assert.equal(styles["grid-auto-flow"], "column", "Cards continue into columns that can be swiped");
  assert.equal(styles["overflow-x"], "auto");
  assert.ok(Number(styles["grid-auto-columns"]?.replace("%", "")) < 50, "A partial third column indicates horizontal scrolling");
  const galleryTag = read("public/index.html").match(/<div\b[^>]*id="gallery"[^>]*>/)?.[0];
  assert.ok(Number(galleryTag?.match(/data-limit="(\d+)"/)?.[1]) >= 9, "Enough templates populate all three rows");
});

test("compact notification action dimensions override legacy minimums without changing account feeds", () => {
  const summaryRules = rules.filter(rule => /#notificationPanel\b/.test(rule.selector) && /\.sh-notification-actions\s+summary\b/.test(rule.selector));
  assert.ok(summaryRules.length > 0, "Dropdown-specific summary overrides exist");
  for (const rule of summaryRules) {
    assert.ok(phoneOnly(rule), "Notification compaction is phone-only");
    assert.doesNotMatch(rule.selector, /accountBox|pf-notification-feed|accountNotificationList/);
  }
  const styles = Object.assign({}, ...summaryRules.map(rule => rule.declarations));
  for (const property of ["width", "min-width", "height", "min-height"]) {
    assert.match(styles[property] || "", /^\d+px(?:\s*!important)?$/, property + " is explicitly overridden");
    const value = Number.parseFloat(styles[property]);
    assert.ok(value >= 28 && value < 44, property + " remains usable and compact");
  }
  const panelRules = rules.filter(rule => /#notificationPanel\b/.test(rule.selector));
  assert.ok(panelRules.some(rule => rule.declarations["max-height"]), "Panel height remains bounded on phones");
  assert.ok(rules.some(rule => /#navMobile\b/.test(rule.selector) && phoneOnly(rule) && Number.parseFloat(rule.declarations["min-height"]) < 44), "Menu rows override the former 44px minimum");
});
