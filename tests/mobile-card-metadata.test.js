"use strict";

// Runs the actual card-rendering helpers with an inert DOM double. These
// checks verify metadata/URL/fallback contracts, not card geometry or visuals.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");
const read = file => fs.readFileSync(path.join(__dirname, "..", file), "utf8");

class Element {
  constructor(tag) { this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {}; this.attrs = {}; this.events = {}; this._text = ""; }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  setAttribute(key, value) { this.attrs[key] = value; }
  removeAttribute(key) { delete this.attrs[key]; }
  addEventListener(key, listener) { this.events[key] = listener; }
  remove() { if (this.parentElement) this.parentElement.children = this.parentElement.children.filter(child => child !== this); }
  querySelector() { return new Element("span"); }
  querySelectorAll() { return []; }
}

function tutorials() {
  const source = read("public/shell.js");
  const start = source.indexOf("  function homeTutorialLink(value)");
  const end = source.indexOf("  /* Recent Creator Tutorials", start);
  assert.ok(start > 0 && end > start, "Load production rendering helpers, not copies");
  const sandbox = { URL, location: { origin: "https://shortscraft.online" }, document: { createElement: tag => new Element(tag) } };
  vm.runInNewContext(source.slice(start, end), sandbox);
  return sandbox;
}

const sample = {
  title: "A useful tutorial", url: "https://www.youtube.com/watch?v=abc12345678", platform: "youtube",
  thumbnail: "https://i.ytimg.com/vi/abc12345678/hqdefault.jpg",
  author: { name: "ShortsCraft Official", verified: true, avatarUrl: "/api/users/public-owner/avatar" }
};

test("tutorials retain title, actual avatar/name and Watch on YouTube in a consistent order", () => {
  const card = tutorials().renderHomeTutorialCard(sample);
  assert.equal(card.tagName, "A");
  assert.equal(card.className, "sh-tut-card sh-tut-card--creator");
  assert.equal(card.target, "_blank");
  assert.equal(card.rel, "noopener noreferrer");
  assert.deepEqual(card.children.map(child => child.className), ["sh-tut-thumb sh-tut-youtube", "sh-tut-title", "sh-tut-author", "sh-tut-watch"]);
  const who = card.children[2];
  assert.equal(who.children[0].className, "sh-tut-avatar");
  assert.equal(who.children[0].children[0].src, "https://shortscraft.online/api/users/public-owner/avatar");
  assert.equal(who.children[1].textContent, sample.author.name);
  assert.equal(card.children[3].textContent, "Watch on YouTube ↗");
});

test("missing or failed creator images use initials instead of a broken image", () => {
  const helpers = tutorials();
  const noImage = helpers.renderHomeTutorialCard({ ...sample, author: { name: "My Creator" } });
  assert.equal(noImage.children[2].children[0].textContent, "MY");
  const card = helpers.renderHomeTutorialCard(sample);
  const avatar = card.children[2].children[0];
  avatar.children[0].events.error();
  assert.equal(avatar.textContent, "SH");
  assert.equal(avatar.children.length, 0);
  card.children[0].children[0].events.error.call(card.children[0].children[0]);
  assert.equal(card.children[0].children.length, 0);
});

test("tutorial title and author use text nodes, not executable HTML", () => {
  const card = tutorials().renderHomeTutorialCard({ ...sample, title: '<img src=x onerror="alert(1)">', author: { name: "<script>bad</script>", verified: "true" } });
  assert.equal(card.children[1].textContent, '<img src=x onerror="alert(1)">');
  assert.equal(card.children[2].children[1].textContent, "<script>bad</script>");
  assert.equal(card.children[2].children.length, 2, "Only true API verification gets a tick");
});

test("tutorial links reject executable, credential-bearing and misleading domains", () => {
  const helpers = tutorials();
  for (const url of ["javascript:alert(1)", "data:text/html,bad", "https://youtube.com.evil.example/watch?v=abc12345678", "https://user:password@youtube.com/watch?v=abc12345678", "https://example.org/"]) {
    assert.equal(helpers.renderHomeTutorialCard({ ...sample, url }), null, url);
  }
  assert.ok(helpers.renderHomeTutorialCard({ ...sample, url: "https://www.instagram.com/reel/abc12345/", platform: "instagram" }).children[3].textContent.includes("Instagram"));
});

test("tutorial image URLs reject non-image protocols and protocol-relative identity URLs", () => {
  const helpers = tutorials();
  for (const url of ["javascript:alert(1)", "//evil.example/avatar", "/\\evil.example/avatar", "https://user:password@example.org/a.png", "data:text/html,bad"]) {
    assert.equal(helpers.homeTutorialAsset(url), "", url);
  }
  assert.equal(helpers.homeTutorialAsset("/api/users/creator/avatar"), "https://shortscraft.online/api/users/creator/avatar");
  assert.equal(helpers.homeTutorialAsset("https://cdn.example.org/avatar.png"), "https://cdn.example.org/avatar.png");
});

function designCard(template) {
  const source = read("public/designs.js");
  const renderStart = source.indexOf("  function renderTemplates(templates)");
  const renderEnd = source.indexOf("  function paintLike(", renderStart);
  const escapeStart = source.indexOf("  function escapeHtml(str)");
  const escapeEnd = source.indexOf('  if (document.readyState', escapeStart);
  assert.ok(renderStart > 0 && renderEnd > renderStart && escapeEnd > escapeStart);
  const grid = new Element("div");
  const sandbox = {
    renderVersion: 0, likeVersions: Object.create(null),
    document: { createElement: tag => new Element(tag) },
    $: selector => selector === "#designsGrid" ? grid : null,
    closeCardMenu() {},
    window: { SCDesignPreview: () => '<img class="ds-template-preview" src="/public-preview.png" alt="">' },
    fetch: () => Promise.resolve({ ok: true, json: () => Promise.resolve({ success: true, reactions: {} }) })
  };
  vm.runInNewContext(source.slice(escapeStart, escapeEnd) + source.slice(renderStart, renderEnd), sandbox);
  sandbox.renderTemplates([template]);
  return grid.children[0].innerHTML;
}

test("premium designs have a separate metadata price without removing their desktop badge", () => {
  const html = designCard({ id: "one", title: "A design", isPremium: true, starPrice: 2, authorName: "Creator", authorHandle: "creator" });
  assert.match(html, /ds-card-prem-badge/);
  assert.match(html, /ds-card-mobile-price" aria-label="Unlock for 2 Stars"/);
  assert.ok(html.indexOf('class="ds-card-mobile-price"') > html.indexOf('class="ds-card-heading"'));
  assert.ok(html.indexOf('class="ds-card-heading"') > html.indexOf('class="ds-card-body"'));
  assert.ok(html.indexOf('class="ds-card-body"') > html.indexOf('class="ds-card-prem-badge"'));
  for (const hook of ["ds-card-open", "ds-card-like", "ds-card-menu-trigger", "ds-card-author"]) assert.ok(html.includes(hook), hook + " interaction retained");
});

test("design metadata escapes untrusted text and encodes creator destinations", () => {
  const html = designCard({ id: "two", title: '<img src=x onerror="bad">', authorName: '<script>bad</script>', authorHandle: 'name&"<bad>', isPremium: true, starPrice: Infinity });
  assert.ok(html.includes("&lt;img src=x onerror=&quot;bad&quot;&gt;"));
  assert.ok(html.includes("&lt;script&gt;bad&lt;/script&gt;"));
  assert.ok(html.includes("/creator?handle=name%26%22%3Cbad%3E"));
  assert.ok(html.includes("Unlock for 1 Star"));
  assert.equal(html.includes("Infinity"), false);
});

test("free designs do not acquire an invented Star price", () => {
  const html = designCard({ id: "free", title: "Free design", authorName: "Creator" });
  assert.equal(html.includes('class="ds-card-mobile-price"'), false);
  assert.equal(html.includes('class="ds-card-prem-badge"'), false);
});

async function homeDesignCard(template) {
  const source = read("public/shell.js");
  const start = source.indexOf("  function loadHomeDesigns()");
  const end = source.indexOf("  function useDesignTemplate(", start);
  assert.ok(start > 0 && end > start, "Load the Home fallback actually included on index.html");
  const grid = new Element("div");
  const sandbox = {
    document: { createElement: tag => new Element(tag) },
    $: selector => selector === "#homeDesignsGrid" ? grid : null,
    escapeHtml: value => String(value ?? "").replace(/[&<>"']/g, char => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[char])),
    window: { SCDesignPreview: () => '<img src="/public-preview.png" alt="">' },
    useDesignTemplate() {},
    fetch: () => Promise.resolve({ json: () => Promise.resolve({ success: true, templates: [template] }) }),
    console
  };
  vm.runInNewContext(source.slice(start, end), sandbox);
  sandbox.loadHomeDesigns();
  await new Promise(resolve => setImmediate(resolve));
  return grid.children[0].innerHTML;
}

test("community creator avatars use initials for unavailable images, including cached failures", () => {
  function helper(source) {
    const start = source.indexOf('  function wireCreatorAvatar(el, name)');
    const end = source.indexOf('  function card(s)', start);
    assert.ok(start > 0 && end > start);
    return source.slice(start, end);
  }
  const actual = helper(read('public/community.html'));
  assert.equal(actual, helper(read('build_pages.js')), 'Builder preserves the same fallback');
  const context = {};
  vm.runInNewContext(actual, context);
  let onError;
  const avatar = {textContent: ''};
  const img = {complete: false, naturalWidth: 0, parentElement: avatar,
    addEventListener(type, listener, options) {assert.equal(type, 'error'); assert.equal(options.once, true); onError = listener;}};
  const card = {querySelector: () => img};
  context.wireCreatorAvatar(card, 'ShortsCraft Official');
  assert.equal(avatar.textContent, '');
  onError();
  assert.equal(avatar.textContent, 'S');
  img.complete = true;
  context.wireCreatorAvatar(card, '  Preview Creator');
  assert.equal(avatar.textContent, 'P');
  img.parentElement = null;
  assert.doesNotThrow(() => onError());
  assert.doesNotThrow(() => context.wireCreatorAvatar({querySelector: () => null}, 'Missing'));
});

test("Home fallback retains its open/profile controls and places a bounded Star price below artwork", async () => {
  const html = await homeDesignCard({ id: "home", title: "Useful design", authorName: "Real Creator", authorHandle: "real", isPremium: true, starPrice: 3 });
  for (const hook of ["ds-card-open", "sh-tcreator-row", "/creator?handle=real", "Real Creator", "ds-card-prem-badge"]) assert.ok(html.includes(hook), hook);
  assert.match(html, /ds-card-mobile-price" aria-label="Unlock for 3 Stars"/);
  assert.ok(html.indexOf('class="ds-card-mobile-price"') > html.indexOf('class="ds-card-body"'));
  const invalid = await homeDesignCard({ title: "Invalid price", isPremium: true, starPrice: '<img src=x onerror="bad">' });
  assert.ok(invalid.includes("Unlock for 1 Star"));
  assert.equal(invalid.includes('<img src=x onerror="bad">'), false);
  const free = await homeDesignCard({ title: "Free" });
  assert.equal(free.includes('class="ds-card-mobile-price"'), false);
});
