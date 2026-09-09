/* ============================================================
   ShortsCraft — Creator Profile Page Logic (creator-profile.js)
   - Loads creator banner, stats, bio and published templates
   ============================================================ */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c];
    });
  }

  var params = new URLSearchParams(window.location.search);
  var handle = (params.get("handle") || "shortscraft").replace(/^@/, "");
  var currentCreator = null;

  function mountStage(tile) {
    if (!tile || tile.dataset.mounted === "1" || !window.SC_TPL2) return;
    var stage = tile.querySelector(".sh-stage");
    if (!stage) return;

    var html = "";
    try {
      var opts = { aspect: "9:16" };
      if (tile.dataset.comm === "1") {
        try { opts.lines = JSON.parse(tile.dataset.lines || "[]"); } catch (e) { opts.lines = []; }
        opts.accent = tile.dataset.accent || "#ffffff";
        opts.font = tile.dataset.font || "inter";
        opts.dur = Number(tile.dataset.dur) || 4600;
      }
      html = window.SC_TPL2.build(tile.dataset.tpl, opts);
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
    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var bail = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8_000);
    fetch("/api/creator?handle=" + encodeURIComponent(handle), ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (!r.ok) {
          var err = new Error(r.status === 404 ? "Creator not found" : "Creator profiles are temporarily unavailable");
          err.status = r.status;
          throw err;
        }
        return r.json();
      })
      .then(function (d) {
        var c = (d && d.creator) || {};
        var commTpls = (d && d.communityTemplates) || [];
        renderProfile(c, commTpls);
      })
      .catch(function (err) {
        renderUnavailable(err && err.status === 404);
      })
      .finally(function () { clearTimeout(bail); });
  }

  function renderUnavailable(notFound) {
    document.title = (notFound ? "Creator not found" : "Creator unavailable") + " — ShortsCraft";
    var nm = $("#creatorName");
    var hd = $("#creatorHandle");
    var bi = $("#creatorBio");
    var grid = $("#creatorGrid");
    if (nm) nm.textContent = notFound ? "Creator not found" : "Profiles temporarily unavailable";
    if (hd) hd.textContent = "@" + handle;
    if (bi) bi.textContent = notFound
      ? "This creator profile does not exist or has been renamed."
      : "Please try again in a moment.";
    if (grid) grid.innerHTML = '<div class="cr-cre-empty"><h3>'
      + (notFound ? "No profile at this address" : "Could not load this profile")
      + '</h3><p><a href="/community">Browse Community templates</a></p></div>';
  }

  function renderProfile(c, commTpls) {
    currentCreator = c;
    document.title = c.name + " (" + c.handle + ") — ShortsCraft Creator";

    var av = $("#creatorAvatar");
    if (av) {
      av.textContent = c.avatarUrl ? "" : (c.initials || "CR");
      av.style.backgroundImage = c.avatarUrl ? 'url("' + c.avatarUrl + '")' : "";
      av.style.backgroundSize = "cover";
      av.style.backgroundPosition = "center";
    }

    var nm = $("#creatorName");
    if (nm) nm.textContent = c.name;

    var hd = $("#creatorHandle");
    if (hd) hd.textContent = c.handle;

    var bi = $("#creatorBio");
    if (bi) bi.textContent = c.bio;
    var verified = $("#creatorVerified");
    if (verified) verified.hidden = c.verified !== true;
    if ($("#creatorFollowers")) $("#creatorFollowers").textContent = String(Number(c.followers) || 0);
    if ($("#creatorFollowing")) $("#creatorFollowing").textContent = String(Number(c.following) || 0);
    if ($("#creatorStars")) $("#creatorStars").textContent = String(Number(c.stars) || 0);
    setupCreatorActions(c);

    // Gather all templates associated with this creator
    var e = window.SC_TPL2;
    var allTpls = [];

    if (handle === "shortscraft" || !handle) {
      if (e) {
        allTpls = e.list().map(function (t) {
          return {
            tpl: t.id,
            name: t.name,
            desc: t.desc,
            cat: t.cat,
            likes: 0
          };
        });
      }
    }

    commTpls.forEach(function (ct) {
      allTpls.unshift({
        tpl: ct.tpl || "text-cascade",
        name: ct.title || "Community Template",
        desc: ct.description || "Custom creator design",
        cat: ct.category || "text",
        likes: Number(ct.likes || 0),
        isComm: true,
        commId: ct.id,
        lines: ct.lines || [],
        accent: ct.accent || "#ffffff",
        font: ct.font || "inter",
        dur: ct.dur || 4600
      });
    });

    var totalLikes = allTpls.reduce(function (sum, t) { return sum + (Number(t.likes) || 0); }, 0);
    var lk = $("#creatorLikes");
    if (lk) lk.textContent = String(totalLikes);

    var countEl = $("#creatorTplCount");
    if (countEl) countEl.textContent = String(allTpls.length);

    var grid = $("#creatorGrid");
    if (!grid) return;
    grid.innerHTML = "";
    if (!allTpls.length) {
      grid.innerHTML = '<div class="cr-cre-empty"><h3>No published templates yet</h3><p>This creator has not shared a community template.</p></div>';
      return;
    }

    var frag = document.createDocumentFragment();
    allTpls.forEach(function (t) {
      var detailUrl = "/template?id=" + encodeURIComponent(t.tpl);
      if (t.isComm) detailUrl += "&comm=1&commId=" + encodeURIComponent(t.commId);

      var tile = document.createElement("article");
      tile.className = "sh-tile";
      tile.dataset.tpl = t.tpl;
      if (t.isComm) {
        tile.dataset.comm = "1";
        tile.dataset.lines = JSON.stringify(t.lines || []);
        tile.dataset.accent = t.accent;
        tile.dataset.font = t.font;
        tile.dataset.dur = t.dur;
      }

      var editUrl = "/editor?tpl=" + encodeURIComponent(t.tpl);
      if (t.isComm) editUrl += "&accent=" + encodeURIComponent(t.accent) + "&font=" + encodeURIComponent(t.font)
        + "&dur=" + encodeURIComponent(t.dur) + "&lines=" + encodeURIComponent(JSON.stringify(t.lines || []));

      tile.innerHTML = [
        '<div class="sh-stage">',
        '  <a href="' + detailUrl + '" class="sh-stage-link" aria-label="View ' + escapeHtml(t.name) + '"></a>',
        '  <span class="sh-skel">Preview</span>',
        '</div>',
        /* Preview and title only, matching the gallery. This page used to add
           hover controls over the artwork, a clamped description and a
           like/comment/share row, so the same template looked like a
           different product depending on where you found it - and at phone
           width that extra row was 60px wider than the card holding it. */
        '<div class="sh-tmeta">',
        '  <div class="sh-ttitle-row"><a href="' + detailUrl + '" class="sh-ttitle">' + escapeHtml(t.name) + '</a></div>',
        '</div>'
      ].join("");

      // The card no longer carries a play button; the preview loops on its own.
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

  function setupCreatorActions(c) {
    var wrap = $("#creatorActions");
    var follow = $("#creatorFollowBtn");
    var star = $("#creatorStarBtn");
    if (!wrap || !follow || !star) return;
    if (!c.id || c.viewerIsSelf) {
      wrap.hidden = true;
      return;
    }
    wrap.hidden = false;
    follow.dataset.active = c.followedByMe ? "1" : "0";
    follow.textContent = c.followedByMe ? "Following" : "Follow";
    follow.onclick = function () {
      var active = follow.dataset.active === "1";
      follow.disabled = true;
      fetch("/api/creators/" + encodeURIComponent(c.id) + "/follow", { method: active ? "DELETE" : "POST" })
        .then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.success) throw new Error(j.error || "Could not update follow."); return j; }); })
        .then(function (j) {
          follow.dataset.active = j.active ? "1" : "0";
          follow.textContent = j.active ? "Following" : "Follow";
          if ($("#creatorFollowers")) $("#creatorFollowers").textContent = String(Number(j.followers) || 0);
        })
        .catch(function (err) { if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message, true); })
        .finally(function () { follow.disabled = false; });
    };
    star.onclick = function () {
      if (!window.SC_UI || !SC_UI.prompt) return;
      SC_UI.prompt({
        title: "Send Stars",
        body: "Stars are non-cash appreciation. Enter an amount from 1 to 20.",
        label: "Stars", value: "1", confirmLabel: "Send"
      }).then(function (value) {
        if (value == null) return;
        var amount = Number(value);
        star.disabled = true;
        return fetch("/api/stars/donate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userId: c.id, amount: amount, idempotencyKey: "star:" + c.id + ":" + Date.now() })
        }).then(function (r) { return r.json().then(function (j) { if (!r.ok || !j.success) throw new Error(j.error || "Could not send Stars."); return j; }); })
          .then(function () { if (window.SC_UI && SC_UI.toast) SC_UI.toast("Stars sent to " + c.handle); })
          .catch(function (err) { if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message, true); })
          .finally(function () { star.disabled = false; });
      });
    };
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
