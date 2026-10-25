/* Compact catalog filters, preserving the existing search/select elements. */
(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) module.exports = factory;
  else if (root.document.readyState === "loading") {
    root.document.addEventListener("DOMContentLoaded", function () { factory(root.document, root); }, { once: true });
  } else factory(root.document, root);
}(typeof window === "object" ? window : this, function initializeMobileCatalog(document, window) {
  "use strict";
  if (!document || !window || typeof window.matchMedia !== "function") return null;
  var sort = document.getElementById("tplSort");
  var designFilter = document.getElementById("designFilter");
  var header = document.querySelector(sort ? ".pg-head" : ".ds-header");
  var controls = sort ? sort.closest(".sh-lib-controls") : designFilter && designFilter.closest("label");
  var search = document.querySelector(sort ? ".sh-search-box" : ".ds-search-label");
  if (!header || !controls || !search || header.dataset.mobileCatalogReady === "1") return null;
  header.dataset.mobileCatalogReady = "1";

  var media = window.matchMedia("(max-width: 640px)");
  var emptyWrapper = designFilter && controls.parentElement;
  var moved = [];
  var button = null;
  var panel = null;
  var active = false;
  var name = sort ? "Animation filters" : "Design filters";
  var selects = Array.prototype.slice.call(controls.querySelectorAll("select"));

  function rememberAndMove(node, target) {
    var anchor = document.createComment("catalog control location");
    node.parentNode.insertBefore(anchor, node);
    moved.push({ node: node, anchor: anchor });
    target.appendChild(node);
  }

  function close(returnFocus) {
    if (!panel || panel.hidden) return;
    panel.hidden = true;
    button.setAttribute("aria-expanded", "false");
    if (returnFocus) button.focus();
  }

  function updateCount() {
    if (!button) return;
    var count = selects.filter(function (select) {
      var initial = Array.prototype.find.call(select.options, function (option) { return option.defaultSelected; });
      return select.value !== (initial ? initial.value : select.options[0] && select.options[0].value);
    }).length;
    button.dataset.active = String(count);
    button.setAttribute("aria-label", name + (count ? " (" + count + " active)" : ""));
  }

  function enable() {
    if (active) return;
    var focused = document.activeElement;
    active = true;
    button = document.createElement("button");
    button.type = "button";
    button.className = "mcatalog-filter-toggle";
    button.title = "Filters";
    button.setAttribute("aria-expanded", "false");
    button.setAttribute("aria-controls", "mobileCatalogFilters");
    button.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><path d="M4 7h16M4 17h16"/><circle cx="9" cy="7" r="3" fill="currentColor" stroke="none"/><circle cx="15" cy="17" r="3" fill="currentColor" stroke="none"/></svg>';
    panel = document.createElement("div");
    panel.id = "mobileCatalogFilters";
    panel.className = "mcatalog-filter-panel";
    panel.hidden = true;
    panel.setAttribute("role", "group");
    panel.setAttribute("aria-label", name);
    rememberAndMove(search, header);
    header.appendChild(button);
    header.appendChild(panel);
    rememberAndMove(controls, panel);
    header.classList.add("mcatalog-header-active");
    if (emptyWrapper) emptyWrapper.classList.add("mcatalog-controls-empty");
    button.addEventListener("click", function () {
      if (!panel.hidden) { close(true); return; }
      panel.hidden = false;
      button.setAttribute("aria-expanded", "true");
      if (selects[0]) selects[0].focus();
    });
    updateCount();
    if (focused && search.contains(focused)) focused.focus();
    else if (focused && controls.contains(focused)) button.focus();
  }

  function disable() {
    if (!active) return;
    var focused = document.activeElement;
    var returnToSearch = focused === button;
    // Restore in reverse move order so nested origins retain their exact order.
    moved.reverse().forEach(function (entry) {
      if (entry.anchor.parentNode) {
        entry.anchor.parentNode.insertBefore(entry.node, entry.anchor);
        entry.anchor.parentNode.removeChild(entry.anchor);
      }
    });
    moved = [];
    button.remove();
    panel.remove();
    button = null;
    panel = null;
    active = false;
    header.classList.remove("mcatalog-header-active");
    if (emptyWrapper) emptyWrapper.classList.remove("mcatalog-controls-empty");
    if (returnToSearch) {
      var input = search.querySelector("input");
      if (input) input.focus();
    } else if (focused && (controls.contains(focused) || search.contains(focused))) focused.focus();
  }

  function sync() { if (media.matches) enable(); else disable(); }
  function onOutside(event) {
    if (panel && !panel.hidden && !panel.contains(event.target) && !button.contains(event.target)) close(false);
  }
  function onKey(event) {
    if (event.key === "Escape" && panel && !panel.hidden) {
      event.preventDefault();
      close(true);
    }
  }
  function onFocus(event) {
    if (panel && !panel.hidden && !header.contains(event.target)) close(false);
  }
  selects.forEach(function (select) { select.addEventListener("change", updateCount); });
  document.addEventListener("click", onOutside);
  document.addEventListener("keydown", onKey);
  document.addEventListener("focusin", onFocus);
  if (media.addEventListener) media.addEventListener("change", sync);
  else media.addListener(sync);
  sync();

  return {
    destroy: function () {
      disable();
      selects.forEach(function (select) { select.removeEventListener("change", updateCount); });
      document.removeEventListener("click", onOutside);
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("focusin", onFocus);
      if (media.removeEventListener) media.removeEventListener("change", sync);
      else media.removeListener(sync);
      delete header.dataset.mobileCatalogReady;
    }
  };
}));
