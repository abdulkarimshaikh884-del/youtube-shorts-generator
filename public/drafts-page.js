/* ============================================================
   drafts-page.js — renders /drafts from the browser's project store.

   Reads SC_DRAFTS (drafts-store.js), which the Studio writes to as you edit.
   Every card previews the project's first clip using the same template engine
   the editor and the gallery use, so what you see here is the real frame, not
   a thumbnail that can go stale.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };

  var grid = $("#draftGrid");
  if (!grid || !window.SC_DRAFTS) return;

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function fmtDur(ms) {
    var s = Math.round((Number(ms) || 0) / 100) / 10;
    return s + "s";
  }

  /* "2 minutes ago" beats a timestamp for work you were just doing, and a real
     date beats "9 days ago" for work you were not. */
  function fmtWhen(ts) {
    var d = Number(ts) || 0;
    if (!d) return "";
    var diff = Date.now() - d;
    if (diff < 60000) return "just now";
    if (diff < 3600000) {
      var m = Math.floor(diff / 60000);
      return m + (m === 1 ? " minute ago" : " minutes ago");
    }
    if (diff < 86400000) {
      var h = Math.floor(diff / 3600000);
      return h + (h === 1 ? " hour ago" : " hours ago");
    }
    if (diff < 7 * 86400000) {
      var dd = Math.floor(diff / 86400000);
      return dd + (dd === 1 ? " day ago" : " days ago");
    }
    return new Date(d).toLocaleDateString();
  }

  function preview(draft) {
    var e = window.SC_TPL2;
    var first = draft.clips && draft.clips[0];
    if (!e || !first || typeof e.build !== "function") return null;
    var html = e.build(first.tpl, {
      lines: first.lines,
      accent: first.accent,
      font: first.font,
      dur: first.dur,
      aspect: draft.aspect || "9:16"
    });
    if (!html) return null;
    var f = document.createElement("iframe");
    // No allow-scripts: these frames are pure CSS animation and never need JS.
    f.setAttribute("sandbox", "");
    f.setAttribute("scrolling", "no");
    f.setAttribute("tabindex", "-1");
    f.setAttribute("aria-hidden", "true");
    f.srcdoc = html;
    return f;
  }

  function render() {
    var list = SC_DRAFTS.list();
    var countEl = $("#draftCount");
    if (countEl) countEl.textContent = String(list.length);

    if (!list.length) {
      grid.innerHTML = '<div class="cr-cre-empty">' +
        "<h3>No saved projects yet</h3>" +
        "<p>Open the Studio and start a scene. Every edit is saved here " +
        "automatically, so you can close the tab and come back to it.</p>" +
        '<a href="/editor" class="pg-bw">+ Start a project</a>' +
        "</div>";
      return;
    }

    grid.innerHTML = "";
    list.forEach(function (d) {
      var clips = d.clips || [];
      var card = document.createElement("article");
      card.className = "cr-cre-card";

      var prev = document.createElement("div");
      prev.className = "cr-cre-preview";
      var f = preview(d);
      if (f) prev.appendChild(f);
      card.appendChild(prev);

      var body = document.createElement("div");
      body.className = "cr-cre-body";
      body.innerHTML =
        '<h3 class="cr-cre-title">' + esc(d.name || "Untitled animation") + "</h3>" +
        '<p class="cr-cre-sub">' +
          clips.length + (clips.length === 1 ? " clip" : " clips") +
          " · " + fmtDur(SC_DRAFTS.totalMs(d)) +
          " · " + esc(d.aspect || "9:16") +
        "</p>" +
        '<p class="cr-cre-sub">Edited ' + esc(fmtWhen(d.updatedAt)) + "</p>";

      var row = document.createElement("div");
      row.className = "cr-cre-actions";

      var open = document.createElement("a");
      open.className = "pg-bw cr-cre-btn";
      open.href = "/editor?draft=" + encodeURIComponent(d.id);
      // "in Studio" is redundant on a page that already says so, and the
      // three-button row has about 215px to work with on a card.
      open.textContent = "Open";

      var ren = document.createElement("button");
      ren.type = "button";
      ren.className = "pg-bo cr-cre-btn";
      ren.textContent = "Rename";
      ren.addEventListener("click", function () {
        SC_UI.prompt({
          title: "Rename this project",
          label: "Project name",
          value: d.name || "Untitled animation",
          maxLength: 80,
          confirmLabel: "Rename"
        }).then(function (name) {
          if (name === null) return;
          SC_DRAFTS.rename(d.id, name);
          render();
          SC_UI.toast("Renamed to “" + name + "”");
        });
      });

      var del = document.createElement("button");
      del.type = "button";
      del.className = "pg-bo cr-cre-btn pg-danger";
      del.textContent = "Delete";
      del.addEventListener("click", function () {
        // Deleting is the one irreversible action on this page — a draft lives
        // only in this browser, so there is nothing to restore it from.
        SC_UI.confirm({
          title: "Delete this project?",
          body: "“" + (d.name || "Untitled animation") + "” is saved in this browser only, so deleting it cannot be undone.",
          confirmLabel: "Delete",
          danger: true
        }).then(function (yes) {
          if (!yes) return;
          SC_DRAFTS.remove(d.id);
          render();
          SC_UI.toast("Project deleted");
        });
      });

      row.appendChild(open);
      row.appendChild(ren);
      row.appendChild(del);
      body.appendChild(row);
      card.appendChild(body);
      grid.appendChild(card);
    });
  }

  render();

  /* A second tab editing the same account should not leave this list stale. */
  window.addEventListener("storage", function (ev) {
    if (ev.key === SC_DRAFTS.KEY) render();
  });
})();
