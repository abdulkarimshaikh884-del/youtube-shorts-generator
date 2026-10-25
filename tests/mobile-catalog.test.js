"use strict";

// DOM-behavior tests with a small in-memory fixture. These exercise real control
// movement/events, not browser geometry or a substitute for rendered mobile QA.
const test = require("node:test");
const assert = require("node:assert/strict");
const initialize = require("../public/mobile-catalog");

class Target {
  constructor() { this.listeners = {}; }
  addEventListener(type, callback) { (this.listeners[type] ||= new Set()).add(callback); }
  removeEventListener(type, callback) { this.listeners[type]?.delete(callback); }
  dispatch(type, values = {}) {
    const event = { type, target: this, defaultPrevented: false,
      preventDefault() { this.defaultPrevented = true; }, ...values };
    for (const callback of this.listeners[type] || []) callback(event);
    return event;
  }
}

class Element extends Target {
  constructor(tag, doc) {
    super(); this.tagName = tag.toUpperCase(); this.ownerDocument = doc;
    this.parentNode = null; this.childNodes = []; this.dataset = {};
    this.attributes = {}; this.className = ""; this.hidden = false; this.value = "";
    this.classList = {
      add: name => { this.className = [...new Set(this.className.split(/\s+/).filter(Boolean).concat(name))].join(" "); },
      remove: name => { this.className = this.className.split(/\s+/).filter(item => item !== name).join(" "); },
      contains: name => this.className.split(/\s+/).includes(name)
    };
  }
  get parentElement() { return this.parentNode; }
  get children() { return this.childNodes.filter(node => node.tagName !== "#COMMENT"); }
  get options() { return this.children.filter(node => node.tagName === "OPTION"); }
  appendChild(node) { return this.insertBefore(node, null); }
  insertBefore(node, before) {
    if (node.parentNode) node.parentNode.removeChild(node);
    const index = before ? this.childNodes.indexOf(before) : this.childNodes.length;
    assert.ok(index >= 0, "insertBefore target belongs to its parent");
    this.childNodes.splice(index, 0, node); node.parentNode = this; return node;
  }
  removeChild(node) {
    const index = this.childNodes.indexOf(node); assert.ok(index >= 0);
    this.childNodes.splice(index, 1); node.parentNode = null; return node;
  }
  remove() { if (this.parentNode) this.parentNode.removeChild(this); }
  setAttribute(name, value) { this.attributes[name] = String(value); }
  getAttribute(name) { return this.attributes[name] ?? null; }
  matches(selector) {
    if (selector[0] === ".") return this.classList.contains(selector.slice(1));
    if (selector[0] === "#") return this.id === selector.slice(1);
    return this.tagName.toLowerCase() === selector;
  }
  closest(selector) { return this.matches(selector) ? this : this.parentNode?.closest(selector) || null; }
  querySelectorAll(selector) {
    return this.children.flatMap(child => (child.matches(selector) ? [child] : []).concat(child.querySelectorAll(selector)));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
  contains(node) { return this === node || this.childNodes.some(child => child.contains(node)); }
  focus() {
    this.ownerDocument.activeElement = this;
    this.ownerDocument.dispatch("focusin", { target: this });
  }
}

class Document extends Element {
  constructor() { super("document", null); this.ownerDocument = this; this.activeElement = null; }
  createElement(tag) { return new Element(tag, this); }
  createComment() { return new Element("#comment", this); }
  getElementById(id) { return this.querySelector("#" + id); }
}

function fixture(kind, mobile = false) {
  const document = new Document();
  const media = new Target(); media.matches = mobile;
  const window = { matchMedia(query) { assert.equal(query, "(max-width: 640px)"); return media; } };
  function make(tag, parent, className = "", id = "") {
    const node = document.createElement(tag); node.className = className; node.id = id;
    parent.appendChild(node); return node;
  }
  function select(parent, id, values) {
    const node = make("select", parent, "", id); node.value = values[0];
    values.forEach((value, index) => { const option = make("option", node); option.value = value; option.defaultSelected = index === 0; });
    return node;
  }
  const header = make("header", document, kind === "animation" ? "pg-head" : "ds-header");
  const title = make("h1", header);
  let origin; let controls; let search; let input; let selects;
  if (kind === "animation") {
    search = make("div", header, "sh-search-box"); input = make("input", search, "", "tplSearch");
    origin = make("div", document, "sh-search-bar-row");
    controls = make("div", origin, "sh-lib-controls");
    const sortLabel = make("label", controls, "sh-lib-select");
    const sourceLabel = make("label", controls, "sh-lib-select");
    selects = [select(sortLabel, "tplSort", ["trending", "popular", "newest"]),
      select(sourceLabel, "tplSource", ["all", "official", "community"])];
    make("div", origin, "sh-filters-scroll");
  } else {
    origin = make("div", header, "ds-discovery-controls");
    controls = make("label", origin, "ds-filter-label");
    selects = [select(controls, "designFilter", ["all", "free", "premium", "official", "community"])];
    search = make("label", origin, "ds-search-label"); input = make("input", search, "", "designSearch");
  }
  const outside = make("input", document);
  const originals = { header: header.children.slice(), origin: origin.children.slice() };
  const controller = initialize(document, window);
  return { document, window, media, header, title, origin, controls, search, input, selects,
    outside, originals, controller,
    resize(value) { media.matches = value; media.dispatch("change"); },
    toggle() { return header.querySelector(".mcatalog-filter-toggle"); },
    panel() { return header.querySelector(".mcatalog-filter-panel"); }
  };
}

test("mobile moves original animation controls and leaves existing filter/search listeners working", () => {
  const f = fixture("animation");
  assert.equal(f.toggle(), null, "Desktop has no extra control");
  let changes = 0; let searches = 0;
  f.selects[0].addEventListener("change", () => changes++);
  f.input.addEventListener("input", () => searches++);
  f.resize(true);
  assert.deepEqual(f.header.children, [f.title, f.search, f.toggle(), f.panel()]);
  assert.equal(f.controls.parentNode, f.panel());
  assert.equal(f.document.getElementById("tplSort"), f.selects[0]);
  assert.equal(f.document.querySelectorAll("#tplSort").length, 1);
  f.selects[0].value = "popular"; f.selects[0].dispatch("change");
  f.input.value = "revenue"; f.input.dispatch("input");
  assert.equal(changes, 1); assert.equal(searches, 1);
  assert.equal(f.toggle().dataset.active, "1");
  assert.match(f.toggle().getAttribute("aria-label"), /1 active/);
});

test("accessible disclosure supports selection, Escape focus return and outside dismissal", () => {
  const f = fixture("animation", true);
  assert.equal(f.panel().hidden, true);
  assert.equal(f.toggle().getAttribute("aria-controls"), f.panel().id);
  assert.equal(f.panel().getAttribute("role"), "group");
  f.toggle().dispatch("click");
  assert.equal(f.panel().hidden, false);
  assert.equal(f.toggle().getAttribute("aria-expanded"), "true");
  assert.equal(f.document.activeElement, f.selects[0]);
  f.document.dispatch("click", { target: f.selects[1] });
  assert.equal(f.panel().hidden, false, "Native dropdown interaction is not dismissed");
  const escape = f.document.dispatch("keydown", { key: "Escape" });
  assert.equal(escape.defaultPrevented, true);
  assert.equal(f.panel().hidden, true);
  assert.equal(f.document.activeElement, f.toggle());
  f.toggle().dispatch("click"); f.outside.focus();
  assert.equal(f.panel().hidden, true);
  assert.equal(f.document.activeElement, f.outside, "Outside focus is not stolen");
  f.toggle().dispatch("click"); f.document.dispatch("click", { target: f.outside });
  assert.equal(f.panel().hidden, true);
  assert.equal(f.toggle().getAttribute("aria-expanded"), "false");
});

test("desktop restoration preserves exact DOM order, current values and focused native select", () => {
  for (const kind of ["animation", "design"]) {
    const f = fixture(kind, true);
    f.selects[0].value = kind === "animation" ? "newest" : "free";
    f.input.value = "chosen search";
    f.toggle().dispatch("click");
    f.resize(false);
    assert.deepEqual(f.header.children, f.originals.header);
    assert.deepEqual(f.origin.children, f.originals.origin);
    assert.equal(f.selects[0].value, kind === "animation" ? "newest" : "free");
    assert.equal(f.input.value, "chosen search");
    assert.equal(f.document.activeElement, f.selects[0]);
    assert.equal(f.document.querySelectorAll(".mcatalog-filter-panel").length, 0);
    assert.equal(f.header.classList.contains("mcatalog-header-active"), false);
    assert.equal(f.origin.classList.contains("mcatalog-controls-empty"), false);
    f.resize(true); f.resize(false);
    assert.deepEqual(f.origin.childNodes, f.originals.origin, "No stranded location comments after repeated resize");
  }
});

test("design search moves alongside heading and original dynamically populated filter remains live", () => {
  const f = fixture("design", true);
  assert.equal(f.search.parentNode, f.header);
  assert.equal(f.origin.classList.contains("mcatalog-controls-empty"), true);
  assert.equal(f.controls.parentNode, f.panel());
  const category = f.document.createElement("option"); category.value = "category:youtube-thumbnail";
  f.selects[0].appendChild(category);
  f.selects[0].value = category.value; f.selects[0].dispatch("change");
  assert.equal(f.toggle().dataset.active, "1");
  assert.equal(f.selects[0].options.length, 6);
  f.toggle().focus(); f.resize(false);
  assert.equal(f.document.activeElement, f.input, "Removing focused toggle returns focus to visible search");
  assert.equal(f.selects[0].value, category.value);
});

test("breakpoint changes preserve typing focus and do not leave focus in a newly hidden filter", () => {
  const f = fixture("design");
  f.input.focus(); f.resize(true);
  assert.equal(f.document.activeElement, f.input);
  f.resize(false);
  assert.equal(f.document.activeElement, f.input);
  f.selects[0].focus(); f.resize(true);
  assert.equal(f.document.activeElement, f.toggle());
  assert.equal(f.panel().hidden, true);
});

test("initialization is idempotent; teardown restores controls and removes media/document listeners", () => {
  const f = fixture("animation", true);
  assert.equal(initialize(f.document, f.window), null);
  assert.equal(f.document.querySelectorAll(".mcatalog-filter-toggle").length, 1);
  f.controller.destroy();
  assert.deepEqual(f.origin.childNodes, f.originals.origin);
  assert.equal(f.media.listeners.change.size, 0);
  assert.equal(f.document.listeners.click.size, 0);
  f.resize(true); assert.equal(f.toggle(), null);
  const next = initialize(f.document, f.window);
  assert.ok(next); next.destroy();
});

test("unrelated documents and unavailable matchMedia are safe no-ops", () => {
  assert.equal(initialize(new Document(), { matchMedia: () => ({ matches: true }) }), null);
  assert.equal(initialize(new Document(), {}), null);
});
