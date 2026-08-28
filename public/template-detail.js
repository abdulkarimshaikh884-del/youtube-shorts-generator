/* ============================================================
   ShortsCraft — Template Detail Page Logic (template-detail.js)
   - High-resolution live sandboxed preview stage
   - Real-time comments loading and posting
   - Creator profile display and navigation
   ============================================================ */
(function () {
  "use strict";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function $$(sel, root) { return (root || document).querySelectorAll(sel); }

  var params = new URLSearchParams(window.location.search);
  var tplId = params.get("id") || "docu-red-string";
  var isComm = params.get("comm") === "1";
  var commId = params.get("commId") || "";

  var currentAspect = "9:16";
  var currentTpl = null;
  var currentAuthor = null;

  function getAuthor(t) {
    if (t && t.isCommunity && t.authorHandle) {
      var name = t.authorName || t.authorHandle;
      var handle = t.authorHandle.replace(/^@/, "");
      var initials = handle.slice(0, 2).toUpperCase();
      return { name: name, handle: "@" + handle, initials: initials, bio: "Community template creator on ShortsCraft." };
    }
    return { name: "ShortsCraft Official", handle: "@shortscraft", initials: "SC", bio: "Official ShortsCraft motion graphics library preset." };
  }

  function mountStage(t) {
    var stage = $("#detailStage");
    if (!stage || !window.SC_TPL2) return;

    var html = "";
    try {
      if (t.isCommunity) {
        html = window.SC_TPL2.build(t.tpl, {
          lines: t.lines || [],
          accent: t.accent || "#ffffff",
          font: t.font || "inter",
          dur: Number(t.dur) || 4600,
          aspect: currentAspect
        });
      } else {
        html = window.SC_TPL2.build(t.tpl, { aspect: currentAspect });
      }
    } catch (e) {
      console.error("[template-detail mount error]", e);
    }
    if (!html) return;

    var oldFrame = stage.querySelector("iframe");
    if (oldFrame) oldFrame.remove();

    var frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("tabindex", "-1");
    frame.setAttribute("title", t.name + " live preview");
    frame.srcdoc = html;

    stage.appendChild(frame);
  }

  function loadTemplate() {
    var e = window.SC_TPL2;
    if (!e) return;

    // Find in built-ins
    var list = e.list();
    var found = list.find(function (item) { return item.id === tplId; });

    if (found) {
      currentTpl = {
        tpl: found.id,
        name: found.name,
        desc: found.desc,
        cat: found.cat,
        dur: 4600,
        isCommunity: false,
        likes: 0
      };
      renderDetails();
    } else {
      // Check community templates API
      fetch("/api/community-templates")
        .then(function (r) { return r.json(); })
        .then(function (d) {
          var commList = (d && d.templates) || [];
          var cFound = commList.find(function (ct) { return ct.id === commId || ct.tpl === tplId; });
          if (cFound) {
            currentTpl = {
              tpl: cFound.tpl,
              name: cFound.title || "Community Template",
              desc: cFound.description || "Custom creator animation preset",
              cat: cFound.category || "text",
              dur: cFound.dur || 4600,
              accent: cFound.accent || "#ffffff",
              font: cFound.font || "inter",
              lines: cFound.lines || [],
              isCommunity: true,
              authorHandle: cFound.authorHandle || "creator",
              authorName: cFound.authorName || "Creator",
              likes: Number(cFound.likes || 0)
            };
          } else {
            // fallback
            currentTpl = {
              tpl: tplId,
              name: "Motion Graphics Preset",
              desc: "Dynamic motion graphic template for YouTube Shorts and Instagram Reels.",
              cat: "docu",
              dur: 4600,
              isCommunity: false,
              likes: 0
            };
          }
          renderDetails();
        })
        .catch(function () {
          currentTpl = {
            tpl: tplId,
            name: "Motion Graphics Preset",
            desc: "Dynamic motion graphic template for YouTube Shorts and Instagram Reels.",
            cat: "docu",
            dur: 4600,
            isCommunity: false,
            likes: 0
          };
          renderDetails();
        });
    }
  }

  function renderDetails() {
    if (!currentTpl) return;
    currentAuthor = getAuthor(currentTpl);

    // Title & Category
    var titleEl = $("#detailTitle");
    if (titleEl) titleEl.textContent = currentTpl.name;
    document.title = currentTpl.name + " — ShortsCraft";

    var catEl = $("#detailCat");
    if (catEl) catEl.textContent = "✦ " + (currentTpl.cat ? currentTpl.cat.toUpperCase() : "MOTION");

    var descEl = $("#detailDesc");
    if (descEl) descEl.textContent = currentTpl.desc;

    var durEl = $("#detailDur");
    if (durEl) durEl.textContent = (currentTpl.dur / 1000).toFixed(1) + "s";

    // Edit in Studio CTA
    var studioBtn = $("#detailStudioBtn");
    if (studioBtn) {
      var editUrl = "/editor?tpl=" + encodeURIComponent(currentTpl.tpl);
      if (currentTpl.isCommunity) {
        editUrl += "&accent=" + encodeURIComponent(currentTpl.accent || "#ffffff")
          + "&font=" + encodeURIComponent(currentTpl.font || "inter")
          + "&dur=" + encodeURIComponent(currentTpl.dur || 4600)
          + "&lines=" + encodeURIComponent(JSON.stringify(currentTpl.lines || []));
      }
      studioBtn.href = editUrl;
    }

    // Creator Profile Card
    var creatorCard = $("#detailCreatorCard");
    var creatorUrl = "/creator?handle=" + encodeURIComponent(currentAuthor.handle.replace(/^@/, ""));

    if (creatorCard) {
      creatorCard.href = creatorUrl;
      var av = creatorCard.querySelector(".td-creator-avatar");
      if (av) av.textContent = currentAuthor.initials;

      var nm = creatorCard.querySelector(".td-creator-name");
      if (nm) nm.textContent = currentAuthor.name;

      var hd = creatorCard.querySelector(".td-creator-handle");
      if (hd) hd.textContent = currentAuthor.handle;

      var bi = creatorCard.querySelector(".td-creator-bio");
      if (bi) bi.textContent = currentAuthor.bio || "Motion graphics designer on ShortsCraft.";
    }

    // Like Button
    var likeBtn = $("#detailLikeBtn");
    if (likeBtn) {
      var lCount = likeBtn.querySelector(".td-like-count");
      if (lCount) lCount.textContent = String(currentTpl.likes);

      likeBtn.addEventListener("click", function () {
        if (likeBtn.dataset.liked === "1") return;
        likeBtn.dataset.liked = "1";
        likeBtn.classList.add("liked");
        currentTpl.likes++;
        if (lCount) lCount.textContent = String(currentTpl.likes);
        if (commId) {
          fetch("/api/community-templates/" + encodeURIComponent(commId) + "/like", { method: "POST" }).catch(function () {});
        }
      });
    }

    // Share Button
    var shareBtn = $("#detailShareBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        var url = window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            var sp = shareBtn.querySelector("span");
            if (sp) sp.textContent = "Copied Link!";
            shareBtn.classList.add("copied");
            setTimeout(function () {
              if (sp) sp.textContent = "Share";
              shareBtn.classList.remove("copied");
            }, 2200);
          });
        } else {
          SC_UI.copy(url, "Link copied");
        }
      });
    }

    // Stage Replay button
    var replayBtn = $("#detailReplayBtn");
    if (replayBtn) {
      replayBtn.addEventListener("click", function () {
        mountStage(currentTpl);
      });
    }

    mountStage(currentTpl);
    loadComments();
  }

  /* ── Comments System ───────────────────────────────────── */
  function loadComments() {
    var listEl = $("#commentsList");
    var countEl = $("#commentsCount");
    if (!listEl) return;

    fetch("/api/comments?tpl=" + encodeURIComponent(tplId))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var comments = (d && d.comments) || [];
        renderComments(comments);
      })
      .catch(function () {
        renderComments([]);
      });

    function renderComments(comments) {
      if (countEl) countEl.textContent = "(" + comments.length + ")";
      listEl.innerHTML = "";

      if (comments.length === 0) {
        listEl.innerHTML = '<div class="td-no-comments">No comments yet. Be the first creator to share feedback!</div>';
        return;
      }

      var frag = document.createDocumentFragment();
      comments.forEach(function (c) {
        var item = document.createElement("div");
        item.className = "sh-m-comm-item";

        var initials = (c.authorHandle || "CR").replace(/^@/, "").slice(0, 2).toUpperCase();

        item.innerHTML = [
          '<div class="sh-m-c-item-av">' + initials + '</div>',
          '<div class="sh-m-c-item-body">',
          '  <div class="sh-m-c-item-head">',
          '    <a href="/creator?handle=' + encodeURIComponent((c.authorHandle || "creator").replace(/^@/, "")) + '" class="sh-m-c-item-name">' + (c.authorName || "Creator") + '</a>',
          '    <span class="sh-m-c-item-handle">' + (c.authorHandle || "@creator") + '</span>',
          '    <span class="sh-m-c-item-time">' + (c.time || "Recently") + '</span>',
          '  </div>',
          '  <p class="sh-m-c-item-text">' + escapeHtml(c.text || "") + '</p>',
          '</div>'
        ].join("");

        frag.appendChild(item);
      });

      listEl.appendChild(frag);
    }
  }

  function wireCommentForm() {
    var form = $("#commentForm");
    var input = $("#commentInput");
    if (!form || !input) return;

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var text = input.value.trim();
      if (!text) return;

      var sendBtn = form.querySelector("button[type=submit]");
      if (sendBtn) sendBtn.disabled = true;

      fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          tpl: tplId,
          text: text,
          authorName: "You",
          authorHandle: "@creator"
        })
      })
        .then(function (r) { return r.json(); })
        .then(function (d) {
          input.value = "";
          if (sendBtn) sendBtn.disabled = false;
          loadComments();
        })
        .catch(function () {
          if (sendBtn) sendBtn.disabled = false;
          loadComments();
        });
    });
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  function init() {
    loadTemplate();
    wireCommentForm();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
