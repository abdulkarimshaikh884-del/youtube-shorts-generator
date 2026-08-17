/* ============================================================
   ShortsCraft — Creator Profile Page Logic (creator-profile.js)
   - Loads creator banner, stats, bio and published templates
   ============================================================ */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }

  var params = new URLSearchParams(window.location.search);
  var handle = (params.get("handle") || "crimedocu").replace(/^@/, "");

  function mountStage(tile) {
    if (!tile || tile.dataset.mounted === "1" || !window.SC_TPL2) return;
    var stage = tile.querySelector(".sh-stage");
    if (!stage) return;

    var html = "";
    try {
      html = window.SC_TPL2.build(tile.dataset.tpl, { aspect: "9:16" });
    } catch (e) {}
    if (!html) return;

    var frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("tabindex", "-1");
    frame.srcdoc = html;

    var sk = stage.querySelector(".sh-skel");
    frame.addEventListener("load", function () {
      if (sk && sk.parentNode) sk.remove();
    });
    setTimeout(function () {
      if (sk && sk.parentNode) sk.remove();
    }, 400);

    stage.appendChild(frame);
    tile.dataset.mounted = "1";
  }

  function loadCreator() {
    fetch("/api/creator?handle=" + encodeURIComponent(handle))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var c = (d && d.creator) || {};
        var commTpls = (d && d.communityTemplates) || [];
        renderProfile(c, commTpls);
      })
      .catch(function () {
        renderProfile({
          name: handle.charAt(0).toUpperCase() + handle.slice(1),
          handle: "@" + handle,
          initials: handle.slice(0, 2).toUpperCase(),
          bio: "Motion graphics designer creating templates for ShortsCraft.",
          followers: "5.2k",
          likes: "14.8k",
          cat: "docu"
        }, []);
      });
  }

  function renderProfile(c, commTpls) {
    document.title = c.name + " (" + c.handle + ") — ShortsCraft Creator";

    var av = $("#creatorAvatar");
    if (av) av.textContent = c.initials || "CR";

    var nm = $("#creatorName");
    if (nm) nm.textContent = c.name;

    var hd = $("#creatorHandle");
    if (hd) hd.textContent = c.handle;

    var bi = $("#creatorBio");
    if (bi) bi.textContent = c.bio;

    var lk = $("#creatorLikes");
    if (lk) lk.textContent = c.likes || "24.5k";

    var fl = $("#creatorFollowers");
    if (fl) fl.textContent = c.followers || "8.2k";

    // Gather all templates associated with this creator
    var e = window.SC_TPL2;
    var allTpls = [];

    if (e) {
      var catTemplates = e.list().filter(function (t) {
        return c.cat === "all" || t.cat === c.cat;
      });
      allTpls = catTemplates.map(function (t, idx) {
        return {
          tpl: t.id,
          name: t.name,
          desc: t.desc,
          cat: t.cat,
          likes: Math.max(25, 120 - idx * 5)
        };
      });
    }

    commTpls.forEach(function (ct) {
      allTpls.unshift({
        tpl: ct.tpl || "text-cascade",
        name: ct.title || "Community Template",
        desc: ct.description || "Custom creator design",
        cat: ct.category || "text",
        likes: ct.likes || 42,
        isComm: true,
        commId: ct.id
      });
    });

    var countEl = $("#creatorTplCount");
    if (countEl) countEl.textContent = String(allTpls.length);

    var grid = $("#creatorGrid");
    if (!grid) return;
    grid.innerHTML = "";

    var frag = document.createDocumentFragment();
    allTpls.forEach(function (t) {
      var detailUrl = "/template?id=" + encodeURIComponent(t.tpl);
      if (t.isComm) detailUrl += "&comm=1&commId=" + encodeURIComponent(t.commId);

      var tile = document.createElement("article");
      tile.className = "sh-tile";
      tile.dataset.tpl = t.tpl;

      tile.innerHTML = [
        '<div class="sh-stage">',
        '  <a href="' + detailUrl + '" class="sh-stage-link" aria-label="View ' + t.name + '"></a>',
        '  <span class="sh-skel">Preview</span>',
        '  <div class="sh-card-hover-bar">',
        '    <button type="button" class="sh-card-btn play" aria-label="Replay"><svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg></button>',
        '    <a href="/editor?tpl=' + encodeURIComponent(t.tpl) + '" class="sh-card-btn open" title="Customize in Studio"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 17L17 7M17 7H8M17 7V16"/></svg></a>',
        '  </div>',
        '</div>',
        '<div class="sh-tmeta">',
        '  <div class="sh-ttitle-row"><a href="' + detailUrl + '" class="sh-ttitle">' + t.name + '</a></div>',
        '  <p class="sh-tdesc">' + t.desc + '</p>',
        '  <div class="sh-tact-bar">',
        '    <a href="' + detailUrl + '" class="sh-tact-btn like">♥ <span>' + t.likes + '</span></a>',
        '    <a href="' + detailUrl + '#comments" class="sh-tact-btn comment">💬 <span>' + Math.max(2, Math.floor(t.likes / 6)) + '</span></a>',
        '    <a href="' + detailUrl + '" class="sh-tact-btn share">View Details →</a>',
        '  </div>',
        '</div>'
      ].join("");

      var playB = tile.querySelector(".sh-card-btn.play");
      if (playB) {
        playB.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          mountStage(tile);
        });
      }

      frag.appendChild(tile);
    });

    grid.appendChild(frag);

    // Lazy mount
    var tiles = Array.prototype.slice.call(grid.children);
    tiles.slice(0, 8).forEach(mountStage);

    if ("IntersectionObserver" in window) {
      var io = new IntersectionObserver(function (entries) {
        entries.forEach(function (en) {
          if (en.isIntersecting) mountStage(en.target);
        });
      }, { rootMargin: "600px 0px" });
      tiles.forEach(function (t) { io.observe(t); });
    }
  }

  function init() {
    loadCreator();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
