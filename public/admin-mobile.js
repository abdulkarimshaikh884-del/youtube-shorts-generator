(function (root) {
  "use strict";

  function columnLabels(cells) {
    return Array.from(cells).map(function (cell, index) {
      var label = (cell.getAttribute("aria-label") || cell.textContent || "").replace(/\s+/g, " ").trim();
      if (!label && cell.querySelector('input[type="checkbox"]')) label = "Select record";
      return label || "Column " + (index + 1);
    });
  }

  function canUseCards(headers, rows) {
    var count = headers.length;
    if (!count || headers.some(function (cell) { return cell.colSpan > 1 || cell.rowSpan > 1; })) return false;
    return rows.every(function (row) {
      var cells = Array.from(row.cells);
      if (cells.length === 1 && cells[0].colSpan === count && cells[0].rowSpan === 1) return true;
      return cells.length === count && cells.every(function (cell) { return cell.colSpan === 1 && cell.rowSpan === 1; });
    });
  }

  // The pure schema checks are also exercised by Node contract tests. Browser
  // behavior below never fetches data or invokes an administrative action.
  if (typeof module === "object" && module.exports) {
    module.exports = { columnLabels: columnLabels, canUseCards: canUseCards };
    return;
  }
  if (!root || !root.document) return;

  function start() {
    var app = root.document.querySelector(".mc-app, .admin-shell, #adminApp");
    if (!app) return;
    var wrappers = new WeakMap();
    var nextId = 0;

    function enhance(table) {
      var wrap = table.closest(".admin-table-wrap, .mc-table-wrap");
      if (!wrap) return;
      var head = table.tHead;
      var headers = head && head.rows.length === 1 ? Array.from(head.rows[0].cells) : [];
      var rows = Array.from(table.tBodies).reduce(function (all, body) { return all.concat(Array.from(body.rows)); }, []);
      var ready = canUseCards(headers, rows);
      var state = wrappers.get(wrap);
      if (!ready) {
        table.removeAttribute("data-mobile-labels");
        wrap.classList.remove("mc-mobile-cards");
        if (state) state.tools.hidden = true;
        return;
      }
      var labels = columnLabels(headers);
      rows.forEach(function (row) {
        Array.from(row.cells).forEach(function (cell, index) {
          if (cell.colSpan === 1) cell.setAttribute("data-label", labels[index]);
        });
      });
      table.setAttribute("data-mobile-labels", "ready");
      // CSS changes the visual layout on phones; retain explicit native table
      // roles for browsers that otherwise drop semantics with display:grid.
      table.setAttribute("role", "table");
      headers.forEach(function (cell) { cell.setAttribute("role", "columnheader"); });
      Array.from(table.rows).forEach(function (row) { row.setAttribute("role", "row"); });
      rows.forEach(function (row) {
        Array.from(row.cells).forEach(function (cell) { cell.setAttribute("role", "cell"); });
      });
      if (!state) {
        if (!wrap.id) {
          do { nextId += 1; wrap.id = "adminMobileTable" + nextId; }
          while (root.document.querySelectorAll('[id="' + wrap.id + '"]').length > 1);
        }
        var tools = root.document.createElement("div");
        tools.className = "mc-mobile-table-tools";
        var hint = root.document.createElement("span");
        var toggle = root.document.createElement("button");
        toggle.type = "button";
        toggle.setAttribute("aria-controls", wrap.id);
        state = { tools: tools, hint: hint, toggle: toggle, cards: true };
        wrappers.set(wrap, state);
        tools.append(hint, toggle);
        wrap.before(tools);
        wrap.tabIndex = 0;
        wrap.setAttribute("role", "region");
        wrap.setAttribute("aria-label", "Admin records");
        toggle.addEventListener("click", function () {
          state.cards = !state.cards;
          update(wrap, state);
        });
      }
      state.tools.hidden = false;
      update(wrap, state);
    }

    function update(wrap, state) {
      wrap.classList.toggle("mc-mobile-cards", state.cards);
      var label = state.cards ? "Table view" : "Card view";
      var hint = state.cards ? "Records" : "Swipe sideways to see all columns";
      if (state.toggle.textContent !== label) state.toggle.textContent = label;
      togglePressed(state.toggle, !state.cards);
      if (state.hint.textContent !== hint) state.hint.textContent = hint;
    }

    function togglePressed(el, val) {
      el.setAttribute("aria-pressed", String(val));
    }

    function scan() {
      app.querySelectorAll("table.admin-table, table.mc-t").forEach(enhance);
    }
    scan();
    // Admin lists are rebuilt after filtering, paging and section switches.
    // Observe children only, so adding labels cannot trigger an observer loop.
    var pending = false;
    new root.MutationObserver(function () {
      if (pending) return;
      pending = true;
      Promise.resolve().then(function () { pending = false; scan(); });
    }).observe(app, { childList: true, subtree: true });
  }

  if (root.document.readyState === "loading") root.document.addEventListener("DOMContentLoaded", start, { once: true });
  else start();
})(typeof window === "undefined" ? null : window);
