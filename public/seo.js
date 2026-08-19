/* ============================================================
   seo.js — the SEO Tools workspace (/seo-tools and the six keyword URLs).

   Six tools share one topic box. Each tool posts {topic, type} to
   /api/generate and renders the model's "=== SECTION ===" headers as real
   headings. The tablist follows the ARIA pattern: one tab in the tab order,
   arrow keys move between them.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var all = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };

  var form = $("#seoForm");
  if (!form) return;

  var topicEl = $("#seoTopic");
  var goBtn = $("#seoGo");
  var outEl = $("#seoOut");
  var outName = $("#seoOutName");
  var copyBtn = $("#seoCopy");
  var dlBtn = $("#seoDl");
  var tabs = all(".pg-tab");

  var current = tabs.length ? tabs[0].dataset.tool : "script";
  var lastText = "";

  /* Each keyword URL preselects its own tool, so someone landing on
     /youtube-shorts-hashtag-generator starts on Hashtags, not Script. */
  var ROUTE_TOOL = {
    "/youtube-shorts-script-generator": "script",
    "/youtube-shorts-title-generator": "titles",
    "/youtube-shorts-description-generator": "description",
    "/youtube-shorts-hashtag-generator": "hashtags",
    "/youtube-shorts-ideas-generator": "ideas",
    "/ai-thumbnail-prompt-generator": "thumbnail"
  };

  function esc(s) {
    return String(s == null ? "" : s).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  function selectTab(toolId, focus) {
    current = toolId;
    tabs.forEach(function (t) {
      var on = t.dataset.tool === toolId;
      t.setAttribute("aria-selected", on ? "true" : "false");
      t.tabIndex = on ? 0 : -1;
      if (on) {
        if (outName) outName.textContent = t.textContent.trim();
        if (focus) t.focus();
      }
    });
  }

  tabs.forEach(function (tab) {
    tab.addEventListener("click", function () {
      selectTab(tab.dataset.tool, false);
      if (topicEl.value.trim()) run();
    });
  });

  // Arrow-key roving tabindex across the tablist.
  var tablist = $(".pg-tabs");
  if (tablist) {
    tablist.addEventListener("keydown", function (ev) {
      var i = tabs.findIndex(function (t) { return t.dataset.tool === current; });
      if (i < 0) return;
      var next = null;
      if (ev.key === "ArrowRight") next = tabs[(i + 1) % tabs.length];
      else if (ev.key === "ArrowLeft") next = tabs[(i - 1 + tabs.length) % tabs.length];
      else if (ev.key === "Home") next = tabs[0];
      else if (ev.key === "End") next = tabs[tabs.length - 1];
      if (!next) return;
      ev.preventDefault();
      selectTab(next.dataset.tool, true);
    });
  }

  /* Render the model's plain text. "=== TITLES ===" becomes a heading and
     [HOOK] style markers become sub-labels, so a long pack stays readable. */
  function render(text) {
    lastText = text;
    var html = "";
    String(text).split(/\r?\n/).forEach(function (line) {
      var t = line.trim();
      if (!t) { html += "<br>"; return; }
      var sec = t.match(/^=+\s*(.+?)\s*=+$/);
      if (sec) { html += "<h3 class='pg-outh'>" + esc(sec[1]) + "</h3>"; return; }
      var tag = t.match(/^\[(.+?)\]$/);
      if (tag) { html += "<p class='pg-outtag'>" + esc(tag[1]) + "</p>"; return; }
      html += "<p>" + esc(t) + "</p>";
    });
    outEl.innerHTML = html;
    copyBtn.disabled = false;
    dlBtn.disabled = false;
  }

  function status(msg, kind) {
    outEl.innerHTML = "<p class='pg-empty" + (kind ? " " + kind : "") + "'>" + esc(msg) + "</p>";
    copyBtn.disabled = true;
    dlBtn.disabled = true;
  }

  function run() {
    var topic = topicEl.value.trim();

    // Refuse before spending a request, and say so where the answer appears.
    if (topic.length < 2) {
      status("Type a topic first — at least 2 characters.", "bad");
      topicEl.focus();
      return;
    }

    var label = goBtn.textContent;
    goBtn.disabled = true;
    goBtn.textContent = "Generating…";
    status("Writing your " + (outName ? outName.textContent.toLowerCase() : "results") + "…");

    fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ topic: topic, type: current })
    })
      .then(function (r) {
        return r.json().then(function (j) { return { ok: r.ok, body: j }; });
      })
      .then(function (res) {
        if (!res.ok || !res.body || !res.body.success) {
          throw new Error((res.body && res.body.error) || "That did not work. Please retry.");
        }
        render(res.body.content);
      })
      .catch(function (err) {
        status(err.message || "Network problem. Please retry.", "bad");
      })
      .then(function () {
        goBtn.disabled = false;
        goBtn.textContent = label;
      });
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    run();
  });

  copyBtn.addEventListener("click", function () {
    if (!lastText) return;
    var done = function () {
      var l = copyBtn.textContent;
      copyBtn.textContent = "Copied";
      setTimeout(function () { copyBtn.textContent = l; }, 1400);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(lastText).then(done, done);
    } else {
      var ta = document.createElement("textarea");
      ta.value = lastText;
      document.body.appendChild(ta);
      ta.select();
      try { document.execCommand("copy"); } catch (e) { /* nothing else to try */ }
      document.body.removeChild(ta);
      done();
    }
  });

  dlBtn.addEventListener("click", function () {
    if (!lastText) return;
    var slug = (topicEl.value.trim().toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "shortscraft").slice(0, 40);
    var blob = new Blob([lastText], { type: "text/plain;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = slug + "-" + current + ".txt";
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  });

  selectTab(ROUTE_TOOL[location.pathname] || current, false);
})();
