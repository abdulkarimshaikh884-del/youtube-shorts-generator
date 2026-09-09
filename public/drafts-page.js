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
    if (e && first && typeof e.build === "function") {
      try {
        var html = e.build(first.tpl || "text-cascade", {
          lines: first.lines && first.lines.length ? first.lines : ["ShortsCraft", "Motion Scene"],
          accent: first.accent || "#7952ff",
          font: first.font || "inter",
          dur: first.dur || 4500,
          aspect: draft.aspect || "9:16"
        });
        if (html) {
          var f = document.createElement("iframe");
          f.setAttribute("sandbox", "");
          f.setAttribute("scrolling", "no");
          f.setAttribute("tabindex", "-1");
          f.setAttribute("aria-hidden", "true");
          f.srcdoc = html;
          return f;
        }
      } catch (err) {}
    }
    var poster = document.createElement("div");
    poster.className = "cr-cre-poster";
    poster.innerHTML = '<div class="cr-cre-poster-icon"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="28" height="28"><polygon points="5 3 19 12 5 21 5 3"/></svg></div><span>' + esc(draft.name || "Saved Animation") + '</span>';
    return poster;
  }

  function renderGuest() {
    var countEl = $("#draftCount");
    var note = $("#draftNote");
    if (countEl) countEl.textContent = "0";
    grid.innerHTML = '<div class="cr-cre-empty">' +
      "<h3>Sign in to see your projects</h3>" +
      "<p>Guest editor sessions are not saved as projects. Sign in or create a free account so this page contains only your real work.</p>" +
      '<div class="cr-cre-gate-actions">' +
        '<a href="/login?next=%2Fdrafts" class="pg-bw">Log in</a>' +
        '<a href="/signup?next=%2Fdrafts" class="cr-cre-btn-ren">Create free account</a>' +
      "</div>" +
      "</div>";
    if (note) note.textContent = "No demo or sample projects are shown here. Projects belong to the signed-in account that created them.";
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
      open.className = "cr-cre-btn-open";
      open.href = "/editor?draft=" + encodeURIComponent(d.id);
      open.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg> <span>Open</span>';

      var ren = document.createElement("button");
      ren.type = "button";
      ren.className = "cr-cre-btn-ren";
      ren.title = "Rename Project";
      ren.setAttribute("aria-label", "Rename Project");
      ren.innerHTML = '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg> <span>Rename</span>';
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
      del.className = "cr-cre-btn-del";
      del.title = "Delete Project";
      del.setAttribute("aria-label", "Delete Project");
      del.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>';
      del.addEventListener("click", function () {
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

  fetch("/api/auth/me", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      var user = j && j.user;
      SC_DRAFTS.setOwner(user || null);
      if (!user) { renderGuest(); return; }
      render();
      /* Then reconcile with the account and repaint. Rendering first keeps
         the page instant on a slow connection; the sync fills in anything
         made on another device. */
      if (SC_DRAFTS.sync) SC_DRAFTS.sync().then(function (changed) { if (changed) render(); });
    })
    .catch(function () {
      SC_DRAFTS.setOwner(null);
      renderGuest();
    });

  /* A second tab editing the same account should not leave this list stale. */
  window.addEventListener("storage", function (ev) {
    if (ev.key === SC_DRAFTS.KEY) render();
  });
})();
