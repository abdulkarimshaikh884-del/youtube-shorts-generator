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
  // Accept older share links generated with just the publication ID.
  if (!commId && /^comm_[a-f0-9]+$/.test(tplId)) commId = tplId;
  if (commId) isComm = true;

  var currentAspect = "9:16";
  var currentTpl = null;
  var currentAuthor = null;

  function getAuthor(t) {
    if (t && t.isCommunity && t.authorHandle) {
      var name = t.authorName || t.authorHandle;
      var handle = t.authorHandle.replace(/^@/, "");
      var initials = handle.slice(0, 2).toUpperCase();
      return { name: name, handle: "@" + handle, initials: initials, bio: "Community template creator on ShortsCraft.", verified: t.authorVerified === true, avatarUrl: t.authorAvatarUrl || "" };
    }
    return { name: "ShortsCraft", handle: "@shortscraft", initials: "SC", bio: "Animation templates published by the ShortsCraft team.", verified: true, avatarUrl: "" };
  }

  function reactionId() { return currentTpl && currentTpl.isCommunity ? commId : tplId; }

  function recordEvent(type) {
    fetch("/api/template-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: reactionId(), eventType: type })
    }).catch(function () {});
  }

  function mountStage(t) {
    var stage = $("#detailStage");
    if (!stage || !window.SC_TPL2) return;

    var html = "";
    try {
      if (t.isCommunity) {
        // props carries every field the creator actually edited. Rebuilding
        // from lines/accent/font alone showed the template's defaults back to
        // them, which read as the editor having thrown their work away.
        html = window.SC_TPL2.build(t.tpl, {
          props: t.props || {},
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

    function showBuiltInOrFallback() {
      if (!found) { showCommunityProblem(true); return; }
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
    }

    /* A community template that cannot be shown gets said so, rather than
       being replaced by whatever built-in happens to share its id. */
    function showCommunityProblem(isGone) {
      var stage = $("#detailStage");
      var host = stage ? stage.closest('.sh-modal-card') : document.querySelector("main");
      if (!host) return;
      document.title = isGone ? "Template unavailable — ShortsCraft" : "Template could not load — ShortsCraft";

      var box = document.createElement("div");
      box.className = "detail-problem";
      var head = document.createElement("h1");
      head.textContent = isGone ? "This template is no longer available" : "Could not load this template";
      var copy = document.createElement("p");
      copy.textContent = isGone
        ? "The creator removed it, or the link is out of date. The library has everything that is still published."
        : "Something went wrong reaching the server. The template is probably fine — the request was not.";

      var actions = document.createElement("div");
      actions.className = "detail-problem-actions";
      if (!isGone) {
        var retry = document.createElement("button");
        retry.type = "button";
        retry.className = "pg-bw";
        retry.textContent = "Try again";
        retry.addEventListener("click", function () { location.reload(); });
        actions.appendChild(retry);
      }
      var browse = document.createElement("a");
      browse.className = isGone ? "pg-bw" : "pg-bo";
      browse.href = "/#templates";
      browse.textContent = "Browse the library";
      actions.appendChild(browse);

      box.appendChild(head);
      box.appendChild(copy);
      box.appendChild(actions);
      host.innerHTML = "";
      host.appendChild(box);
    }

    /* Every community row points at a built-in template id, so looking up the
       built-in first made this branch unreachable and silently discarded the
       creator's custom title, colours and lines. Community URLs must resolve
       their row by id first; the built-in is only the offline fallback. */
    if (isComm && commId) {
      var ctrl = ("AbortController" in window) ? new AbortController() : null;
      var bail = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8_000);
      fetch("/api/community-templates/" + encodeURIComponent(commId), ctrl ? { signal: ctrl.signal } : undefined)
        .then(function (r) {
          if (!r.ok) {
            // 404 is an answer, not a failure: this template is gone. Anything
            // else is the request not getting through, which is temporary.
            var err = new Error("HTTP " + r.status);
            err.notFound = r.status === 404;
            throw err;
          }
          return r.json();
        })
        .then(function (d) {
          var cFound = d && d.template;
          if (!cFound) {
            var gone = new Error("Template not found");
            gone.notFound = true;
            throw gone;
          }
          currentTpl = {
            tpl: cFound.tpl,
            name: cFound.title || "Community Template",
            desc: cFound.description || "Custom creator animation preset",
            cat: cFound.category || "text",
            dur: cFound.dur || 4600,
            accent: cFound.accent || "#ffffff",
            font: cFound.font || "inter",
            lines: cFound.lines || [],
            props: cFound.props || {},
            isCommunity: true,
            authorHandle: cFound.authorHandle || "creator",
            authorName: cFound.authorName || "Creator",
            authorVerified: cFound.authorVerified === true,
            authorAvatarUrl: cFound.authorAvatarUrl || "",
            likes: Number(cFound.likes || 0)
          };
          /* Open at the ratio it was composed at. The page always started at
             9:16, so a template built for YouTube arrived letterboxed into a
             portrait frame and looked like the creator had got it wrong. */
          if (cFound.aspect) {
            currentAspect = cFound.aspect;
            var arBtns = document.querySelectorAll("[data-ar]");
            Array.prototype.forEach.call(arBtns, function (b) {
              var on = b.dataset.ar === currentAspect;
              b.classList.toggle("active", on);
              b.setAttribute("aria-pressed", String(on));
            });
          }
          renderDetails();
        })
        /* This used to be .catch(showBuiltInOrFallback): any failure, including
           a deleted template, quietly rendered a different animation under the
           creator's URL. A visitor had no way to tell they were looking at
           stock artwork rather than the work they had followed a link to — and
           neither did the creator. Say which of the two things happened. */
        .catch(function (err) { showCommunityProblem(err && err.notFound); })
        .finally(function () { clearTimeout(bail); });
      return;
    }

    if (isComm) { showCommunityProblem(true); return; }
    showBuiltInOrFallback();
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
          + "&lines=" + encodeURIComponent(JSON.stringify(currentTpl.lines || []))
          + "&commId=" + encodeURIComponent(commId || "");
      }
      studioBtn.href = editUrl;
      studioBtn.addEventListener("click", function () { recordEvent("edit"); });
    }

    // Creator Profile Card
    var creatorCard = $("#detailCreatorCard");
    var creatorUrl = "/creator?handle=" + encodeURIComponent(currentAuthor.handle.replace(/^@/, ""));

    if (creatorCard) {
      creatorCard.href = creatorUrl;
      var av = creatorCard.querySelector(".td-creator-avatar");
      if (av) {
        av.textContent = currentAuthor.avatarUrl ? "" : currentAuthor.initials;
        av.style.backgroundImage = currentAuthor.avatarUrl ? 'url("' + currentAuthor.avatarUrl + '")' : "";
        av.style.backgroundSize = "cover";
        av.style.backgroundPosition = "center";
      }

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
      fetch("/api/template-reactions?ids=" + encodeURIComponent(reactionId()))
        .then(function (r) { return r.json(); })
        .then(function (j) {
          var state = j && j.reactions && j.reactions[reactionId()];
          if (!state) return;
          currentTpl.likes = Number(state.likeCount) || 0;
          likeBtn.classList.toggle("liked", state.like === true);
          likeBtn.setAttribute("aria-pressed", state.like === true ? "true" : "false");
          if (lCount) lCount.textContent = currentTpl.likes ? String(currentTpl.likes) : "Like";
        }).catch(function () {});

      likeBtn.onclick = function () {
        var active = !likeBtn.classList.contains("liked");
        likeBtn.disabled = true;
        fetch("/api/templates/" + encodeURIComponent(reactionId()) + "/reactions/like", {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: active })
        }).then(function (r) { return r.json().then(function (j) {
          if (!r.ok || !j.success) throw new Error(j.error || "Could not update that like.");
          return j;
        }); }).then(function (j) {
          currentTpl.likes = Number(j.count) || 0;
          likeBtn.classList.toggle("liked", j.active === true);
          likeBtn.setAttribute("aria-pressed", j.active === true ? "true" : "false");
          if (lCount) lCount.textContent = currentTpl.likes ? String(currentTpl.likes) : "Like";
        }).catch(function (err) {
          if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message, true);
        }).finally(function () { likeBtn.disabled = false; });
      };
    }

    // Share Button
    var shareBtn = $("#detailShareBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        var url = window.location.href;
        if (navigator.clipboard && navigator.clipboard.writeText) {
          navigator.clipboard.writeText(url).then(function () {
            recordEvent("share");
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
    recordEvent("open");
    loadComments();
  }

  /* ── Comments System ───────────────────────────────────── */
  function loadComments() {
    var listEl = $("#commentsList");
    var countEl = $("#commentsCount");
    if (!listEl) return;

    fetch("/api/comments?tpl=" + encodeURIComponent(reactionId()))
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
          '<div class="sh-m-c-item-av">' + escapeHtml(initials) + '</div>',
          '<div class="sh-m-c-item-body">',
          '  <div class="sh-m-c-item-head">',
          '    <a href="/creator?handle=' + encodeURIComponent((c.authorHandle || "creator").replace(/^@/, "")) + '" class="sh-m-c-item-name">' + escapeHtml(c.authorName || "Creator") + '</a>',
          '    <span class="sh-m-c-item-handle">' + escapeHtml(c.authorHandle || "@creator") + '</span>',
          '    <span class="sh-m-c-item-time">' + escapeHtml(c.time || "Recently") + '</span>',
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
          tpl: reactionId(),
          text: text
        })
      })
        .then(function (r) {
          return r.json().then(function (d) {
            if (!r.ok || !d.success) throw new Error(d.error || "Could not post that comment.");
            return d;
          });
        })
        .then(function (d) {
          input.value = "";
          if (sendBtn) sendBtn.disabled = false;
          loadComments();
        })
        .catch(function (err) {
          if (sendBtn) sendBtn.disabled = false;
          if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message || "Could not post that comment.", true);
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
