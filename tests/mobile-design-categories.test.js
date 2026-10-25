"use strict";

// Exercise the production helpers with an inert DOM. This checks category
// labels/state/events, not rendered chip geometry or browser acceptance.
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

class EventDouble {
  constructor(type, options = {}) { this.type = type; this.bubbles = !!options.bubbles; }
}

class Element {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.dataset = {};
    this.attributes = {}; this.listeners = {}; this._text = ""; this.value = "";
    this.className = ""; this.hidden = false;
    this.classList = {
      toggle: (name, force) => {
        const names = new Set(this.className.split(/\s+/).filter(Boolean));
        const enabled = force === undefined ? !names.has(name) : !!force;
        if (enabled) names.add(name); else names.delete(name);
        this.className = [...names].join(" "); return enabled;
      },
      add: name => this.classList.toggle(name, true),
      remove: name => this.classList.toggle(name, false),
      contains: name => this.className.split(/\s+/).includes(name)
    };
  }
  get options() { return this.children.filter(child => child.tagName === "OPTION"); }
  set textContent(value) { this._text = String(value); this.children = []; }
  get textContent() { return this._text + this.children.map(child => child.textContent).join(""); }
  set innerHTML(value) {
    assert.equal(value, "", "Category labels must be assigned as text, never parsed as HTML");
    this._text = ""; this.children = [];
  }
  get innerHTML() { return ""; }
  appendChild(child) { child.parentElement = this; this.children.push(child); return child; }
  replaceChildren(...children) { this._text = ""; this.children = []; children.forEach(child => this.appendChild(child)); }
  setAttribute(name, value) {
    this.attributes[name] = String(value);
    if (name.startsWith("data-")) this.dataset[name.slice(5).replace(/-([a-z])/g, (_, char) => char.toUpperCase())] = String(value);
  }
  getAttribute(name) { return this.attributes[name] ?? null; }
  addEventListener(type, listener) { (this.listeners[type] ||= []).push(listener); }
  dispatchEvent(event) {
    if (!event.target) event.target = this;
    for (const listener of this.listeners[event.type] || []) listener.call(this, event);
    if (event.bubbles && this.parentElement) this.parentElement.dispatchEvent(event);
    return true;
  }
  click() { this.dispatchEvent(new EventDouble("click", { bubbles: true })); }
  matches(selector) {
    const [base, attribute] = selector.split("[");
    if (base && base[0] === "." && !this.classList.contains(base.slice(1))) return false;
    if (base && base[0] === "#" && this.id !== base.slice(1)) return false;
    if (base && /^[a-z]/i.test(base) && this.tagName !== base.toUpperCase()) return false;
    if (attribute) {
      const match = attribute.match(/^([^=\]]+)(?:=["']?([^\]"']+)["']?)?\]/);
      if (!match) return false;
      const actual = match[1].startsWith("data-") ? this.dataset[match[1].slice(5)] : this.getAttribute(match[1]);
      if (actual == null || match[2] !== undefined && actual !== match[2]) return false;
    }
    return true;
  }
  querySelectorAll(selector) {
    return this.children.flatMap(child => (child.matches(selector) ? [child] : []).concat(child.querySelectorAll(selector)));
  }
  querySelector(selector) { return this.querySelectorAll(selector)[0] || null; }
}

function fixture({ value = "all", includeContainer = true, includeSelect = true, extra = [] } = {}) {
  const container = new Element("nav"); container.id = "designCategories";
  const select = new Element("select"); select.id = "designFilter"; select.value = value;
  const defaults = [["all", "All designs"], ["free", "Free"], ["premium", "Premium"], ["official", "Official creator"], ["community", "Community creators"],
    ["category:youtube-thumbnail", "Youtube Thumbnail"], ["category:social-post", "Social Post"], ["category:poster", "Poster"], ["category:logo", "Logo"]];
  for (const [key, label] of defaults.concat(extra)) {
    const option = new Element("option"); option.value = key; option.textContent = label;
    select.appendChild(option);
  }
  const nodes = { designCategories: includeContainer ? container : null, designFilter: includeSelect ? select : null };
  const document = {
    readyState: "loading", addEventListener() {}, createElement: tag => new Element(tag),
    getElementById: id => nodes[id] || null,
    querySelector: selector => nodes[selector.replace(/^#/, "")] || null,
    querySelectorAll: selector => selector.startsWith("#designCategories ") ? container.querySelectorAll(selector.slice(18)) : []
  };
  const source = fs.readFileSync(path.join(__dirname, "../public/designs.js"), "utf8");
  assert.match(source, /function designCategoryLabel\(value\)/, "Load the real label helper");
  assert.match(source, /function renderDesignCategories\(\)/, "Load the real renderer");
  assert.match(source, /function syncDesignCategories\(\)/, "Load the real selected-state helper");
  const exposed = source.replace(/\}\)\(\);\s*$/, "window.testCategoryHelpers = { designCategoryLabel, renderDesignCategories, syncDesignCategories };\n})();");
  const window = { Event: EventDouble };
  vm.runInNewContext(exposed, { document, window, Event: EventDouble });
  return { ...window.testCategoryHelpers, container, select, document };
}

function chips(container) { return container.querySelectorAll("button"); }

test("design category labels use the requested human-readable names", () => {
  const { designCategoryLabel } = fixture();
  for (const [value, label] of [["youtube-thumbnail", "Thumbnails"], ["social-post", "Social posts"], ["poster", "Posters"], ["logo", "Logos"], ["category:logo", "Logos"], ["constructor", "Constructor"]]) {
    assert.equal(designCategoryLabel(value), label);
  }
});

test("visible category chips include All, Premium and data categories, not filter-only options", () => {
  const ui = fixture(); ui.renderDesignCategories();
  const buttons = chips(ui.container);
  assert.deepEqual(buttons.map(button => button.dataset.filter), ["all", "premium", "category:youtube-thumbnail", "category:social-post", "category:poster", "category:logo"]);
  assert.deepEqual(buttons.map(button => button.textContent), ["All", "Premium", "Thumbnails", "Social posts", "Posters", "Logos"]);
  for (const button of buttons) {
    assert.equal(button.type, "button");
    assert.equal(button.getAttribute("aria-pressed"), button.dataset.filter === "all" ? "true" : "false");
  }
});

test("chip clicks reuse the existing select and send its bubbling change event", () => {
  const ui = fixture(); const originalSelect = ui.select; const events = [];
  ui.select.addEventListener("change", event => { events.push(event); ui.syncDesignCategories(); });
  ui.renderDesignCategories();
  chips(ui.container).find(button => button.dataset.filter === "category:logo").click();
  assert.equal(ui.document.getElementById("designFilter"), originalSelect);
  assert.equal(ui.select.value, "category:logo");
  assert.equal(events.length, 1);
  assert.equal(events[0].type, "change"); assert.equal(events[0].bubbles, true);
  assert.deepEqual(chips(ui.container).filter(button => button.getAttribute("aria-pressed") === "true").map(button => button.dataset.filter), ["category:logo"]);
});

test("selected chip state follows manual filter changes, including filter-only choices", () => {
  const ui = fixture({ value: "premium" }); ui.renderDesignCategories();
  for (const value of ["premium", "category:poster", "free", "official", "community", "all"]) {
    ui.select.value = value; ui.syncDesignCategories();
    const selected = chips(ui.container).filter(button => button.getAttribute("aria-pressed") === "true").map(button => button.dataset.filter);
    assert.deepEqual(selected, ["free", "official", "community"].includes(value) ? [] : [value]);
  }
});

test("category labels remain inert text even when source values contain HTML", () => {
  const payload = '<img src=x onerror="bad()">';
  const ui = fixture({ extra: [["category:" + payload, payload]] });
  ui.renderDesignCategories();
  const unsafe = chips(ui.container).find(button => button.dataset.filter === "category:" + payload);
  assert.ok(unsafe, "Unknown real category remains selectable");
  assert.ok(unsafe.textContent.includes("<"), "HTML-looking content is literal text");
  assert.equal(unsafe.children.length, 0, "No label markup is created");
});

test("rerendering replaces chips without duplicate controls or duplicate change events", () => {
  const ui = fixture(); let changes = 0;
  ui.select.addEventListener("change", () => { changes += 1; });
  ui.renderDesignCategories(); ui.renderDesignCategories();
  assert.equal(chips(ui.container).length, 6);
  chips(ui.container).find(button => button.dataset.filter === "premium").click();
  assert.equal(changes, 1); assert.equal(ui.select.value, "premium");
});

test("known categories keep their curated order and additional categories remain selectable", () => {
  const ui = fixture({ extra: [["category:zine", "Zine"], ["category:brand-kit", "Brand kit"]] });
  ui.select.children.reverse();
  ui.renderDesignCategories();
  assert.deepEqual(chips(ui.container).map(button => button.dataset.filter), ["all", "premium", "category:youtube-thumbnail", "category:social-post", "category:poster", "category:logo", "category:brand-kit", "category:zine"]);
});

test("category helpers safely no-op on pages without the category bar or filter", () => {
  for (const options of [{ includeContainer: false }, { includeSelect: false }, { includeContainer: false, includeSelect: false }]) {
    const ui = fixture(options);
    assert.doesNotThrow(() => { ui.renderDesignCategories(); ui.syncDesignCategories(); });
  }
});
