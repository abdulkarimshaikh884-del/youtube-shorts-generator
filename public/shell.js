/* ============================================================
   ShortsCraft — App Shell behaviour (index page)
   - Live template gallery from SC_TPL2 (sandboxed, lazy-mounted iframes)
   - Clean category filtering & real-time search
   - Card presentation: preview, title, creator. Description and the
     like/comment/share actions belong to the detail page the card opens.
   - Compact Centered Modal Popup on click (User Spec)
   - Prompt composer -> Video Studio
   Depends on /templates-v2.js -> window.SC_TPL2
   ============================================================ */
(function () {
  "use strict";

  var currentAspect = "9:16";
  var currentCategory = "all";
  var searchQuery = "";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function engine() { return window.SC_TPL2; }

  function getAuthor(t) {
    if (t && t.isCommunity && t.authorHandle) {
      var name = t.authorName || t.authorHandle;
      var handle = t.authorHandle.replace(/^@/, "");
      var initials = handle.slice(0, 2).toUpperCase();
      return { name: name, handle: "@" + handle, initials: initials, bio: "Community template creator on ShortsCraft.", verified: t.authorVerified === true, avatarUrl: t.authorAvatarUrl || "" };
    }
    return { name: "ShortsCraft", handle: "@shortscraft", initials: "SC", bio: "Templates published by the ShortsCraft team.", verified: true };
  }

  function templateKey(t) { return String((t && (t.commId || t.tpl)) || ""); }

  function updateLikeControl(button, t) {
    if (!button) return;
    button.classList.toggle("liked", t.liked === true);
    button.setAttribute("aria-pressed", t.liked === true ? "true" : "false");
    var count = button.querySelector(".sh-like-count, .sh-m-like-num");
    if (count) count.textContent = t.likes > 0 ? String(t.likes) : "Like";
  }

  function setTemplateLike(t, active, button) {
    var id = templateKey(t);
    if (!id || !button || button.disabled) return;
    button.disabled = true;
    fetch("/api/templates/" + encodeURIComponent(id) + "/reactions/like", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ active: active })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.success) throw new Error(j.error || "Could not update that like.");
        return j;
      });
    }).then(function (j) {
      t.liked = j.active === true;
      t.likes = Number(j.count) || 0;
      updateLikeControl(button, t);
    }).catch(function (err) {
      if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message || "Could not update that like.", true);
    }).finally(function () { button.disabled = false; });
  }

  function recordTemplateEvent(t, eventType) {
    var id = templateKey(t);
    if (!id) return;
    fetch("/api/template-events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ templateId: id, eventType: eventType })
    }).catch(function () {});
  }

  /* ── Modal Dialog Logic (Compact Centered Size) ────────── */
  function openTemplateModal(t) {
    var modal = $("#tplModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "tplModal";
      modal.className = "sh-modal-overlay";
      modal.innerHTML = [
        '<div class="sh-modal-card">',
        '  <button type="button" class="sh-modal-close" id="modalClose" aria-label="Close modal">×</button>',
        '  <div class="sh-modal-left">',
        '    <div class="sh-modal-stage" id="modalStage"></div>',
        '    <a href="/editor" class="sh-modal-cta" id="modalStudioBtn">✦ Customize in Studio →</a>',
        '    <div class="sh-modal-ctrls">',
        '      <button type="button" class="sh-modal-act-btn" id="modalReplayBtn">',
        '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M3 12a9 9 0 1 0 3-6.7"/><polyline points="3 3 3 9 9 9"/></svg>',
        '        <span>Replay</span>',
        '      </button>',
        '      <button type="button" class="sh-modal-act-btn sh-act-like" id="modalLikeBtn" aria-pressed="false">',
        '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8l1.1 1.1L12 21.2l7.8-7.7 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>',
        '        <span class="sh-m-like-num">Like</span>',
        '      </button>',
        '      <button type="button" class="sh-modal-act-btn" id="modalShareBtn">',
        '        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" aria-hidden="true"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.6" y1="13.5" x2="15.4" y2="17.5"/><line x1="15.4" y1="6.5" x2="8.6" y2="10.5"/></svg>',
        '        <span>Share</span>',
        '      </button>',
        '    </div>',
        '  </div>',
        '  <div class="sh-modal-right">',
        '    <div>',
        '      <span class="sh-m-cat" id="modalCat">✦ DOCUMENTARY</span>',
        '      <h2 class="sh-m-title" id="modalTitle">Template Title</h2>',
        '      <p class="sh-m-desc" id="modalDesc">Description</p>',
        '      <div class="sh-m-specs">',
        '        <span class="sh-m-spec">Duration: <b id="modalDur">4.6s</b></span>',
        '        <span class="sh-m-spec">Framerate: <b>60 FPS</b></span>',
        '        <span class="sh-m-spec">Format: <b>9:16 Shorts</b></span>',
        '      </div>',
        '    </div>',
        '    <a href="/creator" class="sh-m-creator" id="modalCreatorLink">',
        '      <div class="sh-m-c-av" id="modalCreatorAv">CD</div>',
        '      <div class="sh-m-c-info">',
        '        <span class="sh-m-c-name" id="modalCreatorName">Creator Name</span>',
        '        <span class="sh-m-c-handle" id="modalCreatorHandle">@creator</span>',
        '        <span class="sh-m-c-bio" id="modalCreatorBio">Creator bio description</span>',
        '      </div>',
        '      <span style="color:var(--sh-ink2);font-size:16px;font-weight:700;">→</span>',
        '    </a>',
        '    <div class="sh-m-comments">',
        '      <h3 class="sh-m-comm-head">Community Comments <span id="modalCommCount" style="color:var(--sh-ink2);font-size:13px;">(0)</span></h3>',
        '      <form class="sh-m-comm-form" id="modalCommForm">',
        '        <textarea class="sh-m-comm-input" id="modalCommInput" placeholder="Write a comment about this template..." required></textarea>',
        '        <button type="submit" class="sh-m-comm-btn">Post Comment</button>',
        '      </form>',
        '      <div class="sh-m-comm-list" id="modalCommList"></div>',
        '    </div>',
        '  </div>',
        '</div>'
      ].join("");
      document.body.appendChild(modal);

      modal.addEventListener("click", function (ev) {
        if (ev.target === modal || (ev.target.id && ev.target.id === "modalClose")) {
          closeTemplateModal();
        }
      });

      document.addEventListener("keydown", function (ev) {
        if (ev.key === "Escape" && modal.classList.contains("open")) {
          closeTemplateModal();
        }
      });
    }

    var author = getAuthor(t);
    recordTemplateEvent(t, "open");
    $("#modalTitle").textContent = t.name;
    $("#modalCat").textContent = "✦ " + (t.cat ? t.cat.toUpperCase() : "MOTION");
    $("#modalDesc").textContent = t.desc;
    $("#modalDur").textContent = ((t.dur || 4600) / 1000).toFixed(1) + "s";

    var editUrl = "/editor?tpl=" + encodeURIComponent(t.tpl);
    if (t.isCommunity) {
      editUrl += "&accent=" + encodeURIComponent(t.accent || "#ffffff")
        + "&font=" + encodeURIComponent(t.font || "inter")
        + "&dur=" + encodeURIComponent(t.dur || 4600)
        + "&lines=" + encodeURIComponent(JSON.stringify(t.lines || []));
    }
    $("#modalStudioBtn").href = editUrl;
    $("#modalStudioBtn").onclick = function () { recordTemplateEvent(t, "edit"); };

    var creatorUrl = "/creator?handle=" + encodeURIComponent(author.handle.replace(/^@/, ""));
    $("#modalCreatorLink").href = creatorUrl;
    $("#modalCreatorAv").textContent = author.initials;
    $("#modalCreatorAv").style.backgroundImage = author.avatarUrl ? 'url("' + author.avatarUrl + '")' : "";
    var mName = $("#modalCreatorName");
    mName.textContent = author.name;
    if (author.verified) {
      var mTick = document.createElement("span");
      mTick.className = "sh-verified";
      mTick.setAttribute("aria-label", "Verified creator");
      mTick.title = "Verified creator";
      mTick.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.25l2.08 1.49 2.55-.05.74 2.44 2.1 1.45-.84 2.41.84 2.41-2.1 1.45-.74 2.44-2.55-.05L12 17.75l-2.08-1.49-2.55.05-.74-2.44-2.1-1.45.84-2.41-.84-2.41 2.1-1.45.74-2.44 2.55.05L12 2.25z"/><path d="M8.3 10.15l2.35 2.35 5.05-5.05" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
      mName.appendChild(mTick);
    }
    $("#modalCreatorHandle").textContent = author.handle;
    $("#modalCreatorBio").textContent = author.bio || "Motion graphics designer on ShortsCraft.";

    var lkSpan = modal.querySelector(".sh-m-like-num");
    if (lkSpan) lkSpan.textContent = String(t.likes);

    // Mount live preview stage
    var mStage = $("#modalStage");
    mStage.innerHTML = "";
    var e = engine();
    if (e) {
      var html = t.isCommunity
        ? e.build(t.tpl, { lines: t.lines || [], accent: t.accent || "#ffffff", font: t.font || "inter", dur: Number(t.dur) || 4600, aspect: "9:16" })
        : e.build(t.tpl, { aspect: "9:16" });

      var frame = document.createElement("iframe");
      frame.setAttribute("sandbox", "allow-scripts");
      frame.setAttribute("scrolling", "no");
      frame.srcdoc = html;
      mStage.appendChild(frame);
    }

    // Load comments
    loadModalComments(templateKey(t));

    // Wire Replay
    $("#modalReplayBtn").onclick = function () {
      openTemplateModal(t);
    };

    // Wire Like Button
    var mLikeBtn = $("#modalLikeBtn");
    if (mLikeBtn) {
      updateLikeControl(mLikeBtn, t);
      mLikeBtn.onclick = function () {
        setTemplateLike(t, t.liked !== true, mLikeBtn);
      };
    }

    // Wire Share
    $("#modalShareBtn").onclick = function () {
      var url = window.location.origin + "/template?id=" + encodeURIComponent(t.tpl);
      if (t.isCommunity && t.commId) {
        url += "&comm=1&commId=" + encodeURIComponent(t.commId);
      }
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(url).then(function () {
          recordTemplateEvent(t, "share");
          var sp = $("#modalShareBtn");
          sp.textContent = "Copied!";
          setTimeout(function () { sp.textContent = "🔗 Share"; }, 2000);
        });
      } else {
        SC_UI.copy(url, "Template link copied");
      }
    };

    // Wire Comment form
    $("#modalCommForm").onsubmit = function (ev) {
      ev.preventDefault();
      var inp = $("#modalCommInput");
      var val = inp.value.trim();
      if (!val) return;
      var send = this.querySelector("button[type=submit]");
      if (send) send.disabled = true;
      fetch("/api/comments", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        // A reply carries the comment it answers; a top-level comment does not.
        body: JSON.stringify({
          tpl: templateKey(t), text: val,
          parentId: this.dataset.parentId || null
        })
      })
        .then(function (r) {
          return r.json().then(function (d) {
            if (!r.ok || !d.success) throw new Error(d.error || "Could not post that comment.");
            return d;
          });
        })
        .then(function () {
          inp.value = "";
          // Leaving reply mode on would silently attach the next comment to
          // the same parent.
          var form = document.querySelector("#modalCommForm");
          if (form) delete form.dataset.parentId;
          inp.placeholder = "Write a comment about this template...";
          var hint = document.querySelector("#modalReplyHint");
          if (hint) hint.remove();
          loadModalComments(templateKey(t));
        })
        .catch(function (err) {
          if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message || "Could not post that comment.", true);
        })
        .finally(function () { if (send) send.disabled = false; });
    };

    modal.classList.add("open");
    modal.removeAttribute("hidden");
    document.body.style.overflow = "hidden";
  }

  function closeTemplateModal() {
    var modal = $("#tplModal");
    if (modal) {
      modal.classList.remove("open");
      modal.setAttribute("hidden", "");
      var mStage = $("#modalStage");
      if (mStage) mStage.innerHTML = "";
    }
    document.body.style.overflow = "";
  }

  function loadModalComments(tplId) {
    var list = $("#modalCommList");
    var count = $("#modalCommCount");
    if (!list) return;

    /* Comments used to render as one grey line: no author picture, no way to
       reply, and nothing to do about one posted by mistake. This draws a real
       thread - avatar, verified tick, an "Edited" marker, and the actions the
       viewer is actually allowed to take. */
    fetch("/api/comments?tpl=" + encodeURIComponent(tplId))
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var comms = (d && d.comments) || [];
        if (count) count.textContent = "(" + comms.length + ")";
        list.innerHTML = "";
        if (comms.length === 0) {
          list.innerHTML = '<p class="sh-m-comm-empty">No comments yet. Be the first to share what you made with it.</p>';
          return;
        }

        var byParent = {};
        var roots = [];
        comms.forEach(function (c) {
          if (c.parentId) {
            (byParent[c.parentId] = byParent[c.parentId] || []).push(c);
          } else {
            roots.push(c);
          }
        });

        var frag = document.createDocumentFragment();
        roots.forEach(function (c) {
          frag.appendChild(commentNode(c, tplId, false));
          (byParent[c.id] || []).forEach(function (child) {
            frag.appendChild(commentNode(child, tplId, true));
          });
        });
        list.appendChild(frag);
      })
      .catch(function () {
        list.innerHTML = '<p class="sh-m-comm-empty">Could not load comments right now.</p>';
      });
  }

  function commentNode(c, tplId, isReply) {
    var item = document.createElement("article");
    item.className = "sh-m-comm-item" + (isReply ? " is-reply" : "");

    var handleSlug = encodeURIComponent(String(c.authorHandle || "creator").replace(/^@/, ""));

    var av = document.createElement("a");
    av.className = "sh-m-c-item-av";
    av.href = "/creator?handle=" + handleSlug;
    if (c.authorAvatarUrl) {
      av.style.backgroundImage = 'url("' + c.authorAvatarUrl + '")';
    } else {
      av.textContent = String(c.authorHandle || "CR").replace(/^@/, "").slice(0, 2).toUpperCase();
    }

    var body = document.createElement("div");
    body.className = "sh-m-c-item-body";

    var head = document.createElement("div");
    head.className = "sh-m-c-item-head";
    head.innerHTML = [
      '<a href="/creator?handle=' + handleSlug + '" class="sh-m-c-item-name">' + escapeHtml(c.authorName || "Creator") + "</a>",
      c.authorVerified ? '<span class="sh-verified" title="Verified creator" aria-label="Verified creator"><svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.25l2.08 1.49 2.55-.05.74 2.44 2.1 1.45-.84 2.41.84 2.41-2.1 1.45-.74 2.44-2.55-.05L12 17.75l-2.08-1.49-2.55.05-.74-2.44-2.1-1.45.84-2.41-.84-2.41 2.1-1.45.74-2.44 2.55.05L12 2.25z"/><path d="M8.3 10.15l2.35 2.35 5.05-5.05" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg></span>' : "",
      '<span class="sh-m-c-item-handle">' + escapeHtml(c.authorHandle || "@creator") + "</span>",
      // Says plainly that the text changed after it was posted.
      c.edited ? '<span class="sh-m-c-edited">Edited</span>' : "",
      '<span class="sh-m-c-item-time">' + escapeHtml(c.time || "Recently") + "</span>"
    ].join("");
    body.appendChild(head);

    var text = document.createElement("p");
    text.className = "sh-m-c-item-text";
    text.textContent = c.text || "";
    body.appendChild(text);

    var actions = document.createElement("div");
    actions.className = "sh-m-c-actions";

    // Replies are one level deep, so a reply offers no reply button of its own.
    if (!isReply) {
      var replyBtn = document.createElement("button");
      replyBtn.type = "button";
      replyBtn.className = "sh-m-c-action";
      replyBtn.textContent = "Reply";
      replyBtn.onclick = function () { startReply(c); };
      actions.appendChild(replyBtn);
    }

    if (c.canEdit) {
      var editBtn = document.createElement("button");
      editBtn.type = "button";
      editBtn.className = "sh-m-c-action";
      editBtn.textContent = "Edit";
      editBtn.onclick = function () { startEdit(c, item, text, tplId); };
      actions.appendChild(editBtn);
    }

    if (c.canDelete) {
      var delBtn = document.createElement("button");
      delBtn.type = "button";
      delBtn.className = "sh-m-c-action sh-m-c-danger";
      delBtn.textContent = "Delete";
      delBtn.onclick = function () { removeComment(c, tplId); };
      actions.appendChild(delBtn);
    }

    if (actions.children.length) body.appendChild(actions);
    item.appendChild(av);
    item.appendChild(body);
    return item;
  }

  function removeComment(c, tplId) {
    var ask = (window.SC_UI && SC_UI.confirm)
      ? SC_UI.confirm({
          title: "Delete this comment?",
          body: "It will be removed for everyone, along with any replies to it.",
          confirmLabel: "Delete"
        })
      : Promise.resolve(true);
    ask.then(function (yes) {
      if (!yes) return;
      fetch("/api/comments/" + encodeURIComponent(c.id), { method: "DELETE" })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.success) throw new Error((j && j.error) || "Could not delete that comment.");
          loadModalComments(tplId);
        })
        .catch(function (err) {
          if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message, true);
        });
    });
  }

  /* Editing happens in place: sending someone to a separate form to change one
     word loses the thread they were reading. */
  function startEdit(c, item, textEl, tplId) {
    if (item.querySelector(".sh-m-c-editor")) return;

    var editor = document.createElement("div");
    editor.className = "sh-m-c-editor";

    var field = document.createElement("textarea");
    field.className = "sh-m-comm-input";
    field.value = c.text || "";
    field.maxLength = 500;

    var row = document.createElement("div");
    row.className = "sh-m-c-editor-row";

    var save = document.createElement("button");
    save.type = "button";
    save.className = "sh-m-comm-btn";
    save.textContent = "Save";

    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "sh-m-c-action";
    cancel.textContent = "Cancel";
    cancel.onclick = function () { editor.remove(); textEl.hidden = false; };

    save.onclick = function () {
      var next = field.value.trim();
      if (!next) return;
      save.disabled = true;
      fetch("/api/comments/" + encodeURIComponent(c.id), {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: next })
      })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.success) throw new Error((j && j.error) || "Could not save that edit.");
          loadModalComments(tplId);
        })
        .catch(function (err) {
          save.disabled = false;
          if (window.SC_UI && SC_UI.toast) SC_UI.toast(err.message, true);
        });
    };

    row.appendChild(save);
    row.appendChild(cancel);
    editor.appendChild(field);
    editor.appendChild(row);
    textEl.hidden = true;
    textEl.parentNode.insertBefore(editor, textEl.nextSibling);
    field.focus();
  }

  /* Replying reuses the one composer at the top rather than opening a second
     input under every comment, and says who it is aimed at. */
  function startReply(c) {
    var input = document.querySelector("#modalCommInput");
    var form = document.querySelector("#modalCommForm");
    if (!input || !form) return;

    form.dataset.parentId = c.id;
    input.placeholder = "Replying to " + (c.authorHandle || "@creator") + "...";
    input.focus();

    var hint = document.querySelector("#modalReplyHint");
    if (!hint) {
      hint = document.createElement("button");
      hint.type = "button";
      hint.id = "modalReplyHint";
      hint.className = "sh-m-c-action sh-m-c-replyhint";
      form.insertBefore(hint, form.firstChild);
    }
    hint.textContent = "Replying to " + (c.authorHandle || "@creator") + " - cancel";
    hint.onclick = function () {
      delete form.dataset.parentId;
      input.placeholder = "Write a comment about this template...";
      hint.remove();
    };
  }

  function escapeHtml(str) {
    var div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  /* ── Gallery Rendering ─────────────────────────────────── */
  function mount(tile, force) {
    if (!tile) return;
    if (tile.dataset.mounted === "1" && !force) return;

    var e = engine();
    if (!e || typeof e.build !== "function") return;

    var stage = $(".sh-stage", tile);
    if (!stage) return;

    var html = "";
    try {
      if (tile.dataset.comm === "1") {
        var lines = [];
        try { lines = JSON.parse(tile.dataset.lines || "[]"); } catch (err) {}
        html = e.build(tile.dataset.tpl, {
          lines: lines,
          accent: tile.dataset.accent || "#ffffff",
          font: tile.dataset.font || "inter",
          dur: Number(tile.dataset.dur) || 4600,
          aspect: currentAspect
        });
      } else {
        html = e.build(tile.dataset.tpl, { aspect: currentAspect });
      }
    } catch (err) {
      console.warn("[mount error]", tile.dataset.tpl, err);
      html = "";
    }
    if (!html) return;

    var oldFrame = stage.querySelector("iframe");
    if (oldFrame) oldFrame.remove();

    var frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "allow-scripts");
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("tabindex", "-1");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("title", (tile.dataset.name || "Template") + " animation preview");
    frame.srcdoc = html;

    var sk = $(".sh-skel", stage);
    frame.addEventListener("load", function () {
      if (sk && sk.parentNode) sk.remove();
    });
    setTimeout(function () {
      if (sk && sk.parentNode) sk.remove();
    }, 400);

    stage.appendChild(frame);
    tile.dataset.mounted = "1";
  }

  function filterTiles() {
    var grid = $("#gallery");
    if (!grid) return;
    var q = searchQuery.toLowerCase().trim();
    var cat = currentCategory;

    var count = 0;
    Array.prototype.forEach.call(grid.children, function (tile) {
      var name = (tile.dataset.name || "").toLowerCase();
      var desc = (tile.dataset.desc || "").toLowerCase();
      var tCat = tile.dataset.cat || "";
      var collection = tile.dataset.collection || "";
      var tpl = (tile.dataset.tpl || "").toLowerCase();

      var matchCat = (cat === "all" || tCat === cat);
      var matchSearch = !q || name.indexOf(q) !== -1 || desc.indexOf(q) !== -1 || tpl.indexOf(q) !== -1;

      var show = matchCat && matchSearch;
      tile.hidden = !show;
      if (show) {
        count++;
        mount(tile);
      }
    });

    var emptyState = $("#galleryEmpty");
    if (!emptyState) {
      emptyState = document.createElement("div");
      emptyState.id = "galleryEmpty";
      emptyState.className = "sh-empty-state";
      emptyState.innerHTML = '<h3>No templates found</h3><p>Try a different keyword or category.</p>';
      grid.appendChild(emptyState);
    }
    emptyState.hidden = count > 0;
  }

  function buildGallery() {
    var grid = $("#gallery");
    var e = engine();
    if (!grid || !e) return;

    grid.innerHTML = "";

    // Built-in templates are the core product and do not depend on Postgres.
    // Paint them immediately, then enrich the grid if community data arrives.
    renderAllTemplates([]);

    var ctrl = ("AbortController" in window) ? new AbortController() : null;
    var bail = setTimeout(function () { if (ctrl) ctrl.abort(); }, 8_000);
    fetch("/api/community-templates", ctrl ? { signal: ctrl.signal } : undefined)
      .then(function (r) {
        if (!r.ok) throw new Error("HTTP " + r.status);
        return r.json();
      })
      .then(function (d) {
        var commList = (d && d.templates) || [];
        return loadRealMetrics(commList);
      })
      .catch(function () { return loadRealMetrics([]); })
      .finally(function () { clearTimeout(bail); });

    function loadRealMetrics(commList) {
      var ids = e.list().map(function (t) { return t.id; });
      commList.forEach(function (t) { if (t && t.id) ids.push(t.id); });
      ids = Array.from(new Set(ids)).slice(0, 100);
      return fetch("/api/template-metrics?ids=" + encodeURIComponent(ids.join(",")))
        .then(function (r) { if (!r.ok) throw new Error("HTTP " + r.status); return r.json(); })
        .then(function (d) { renderAllTemplates(commList, (d && d.metrics) || {}); })
        .catch(function () { renderAllTemplates(commList, {}); });
    }

    function renderAllTemplates(commList, metrics) {
      var allItems = [];
      metrics = metrics || {};

      var validTpls = {};
      e.list().forEach(function (t) { validTpls[t.id] = true; });

      // 1. Featured Community Templates
      commList.forEach(function (ct) {
        var tplId = ct.tpl;
        if (!validTpls[tplId]) return;
        var activity = metrics[ct.id] || {};
        var likes = Number(activity.likes !== undefined ? activity.likes : ct.likes) || 0;
        var downloads = Number(activity.exports !== undefined ? activity.exports : ct.downloads) || 0;
        var publishedAt = ct.createdAt ? new Date(ct.createdAt).getTime() : 0;
        var ageDays = publishedAt ? Math.max(0, (Date.now() - publishedAt) / 86400000) : 90;
        /* Only real activity contributes. A small, time-limited discovery
           allowance lets new creator work be seen without permanently boosting
           ShortsCraft's own library above it. */
        var discovery = Math.max(0, 14 - ageDays) * 0.35;
        var score = (Number(activity.score) || 0) + discovery;

        allItems.push({
          id: ct.id || ("comm_" + Math.random()),
          commId: ct.id,
          tpl: tplId,
          name: ct.title || "Community Template",
          desc: ct.description || "Custom creator motion design",
          cat: ct.category || "text",
          authorHandle: ct.authorHandle || "creator",
          authorName: ct.authorName || "Creator",
          authorVerified: ct.authorVerified === true,
          authorAvatarUrl: ct.authorAvatarUrl || "",
          accent: ct.accent || "#ffffff",
          font: ct.font || "inter",
          dur: ct.dur || 4600,
          lines: ct.lines || [],
          isCommunity: true,
          likes: likes,
          downloads: downloads,
          score: score
        });
      });

      // 2. Built-in Templates
      e.list().forEach(function (t, idx) {
        var activity = metrics[t.id] || {};
        allItems.push({
          id: t.id,
          tpl: t.id,
          name: t.name,
          desc: t.desc,
          cat: t.cat,
          collection: t.collection,
          isCommunity: false,
          likes: Number(activity.likes) || 0,
          downloads: Number(activity.exports) || 0,
          // The tiny tie-break keeps a stable library order when real signals
          // are equal; it is not a ShortsCraft-specific popularity boost.
          score: (Number(activity.score) || 0) - idx / 100000
        });
      });

      // Sort by score
      allItems.sort(function (a, b) {
        return b.score - a.score;
      });

      var frag = document.createDocumentFragment();

      allItems.forEach(function (t) {
        var author = getAuthor(t);

        var tile = document.createElement("article");
        tile.className = "sh-tile";
        tile.dataset.tpl = t.tpl;
        tile.dataset.name = t.name;
        tile.dataset.desc = t.desc;
        tile.dataset.cat = t.cat;
        tile.dataset.collection = t.collection || (t.isCommunity ? "community" : "classic");
        tile.dataset.reactionId = templateKey(t);

        if (t.isCommunity) {
          tile.dataset.comm = "1";
          tile.dataset.commId = t.commId;
          tile.dataset.accent = t.accent;
          tile.dataset.font = t.font;
          tile.dataset.dur = t.dur;
          tile.dataset.lines = JSON.stringify(t.lines || []);
        }

        var detailUrl = "/template?id=" + encodeURIComponent(t.tpl);
        if (t.isCommunity) {
          detailUrl += "&comm=1&commId=" + encodeURIComponent(t.commId || "");
        }

        var creatorUrl = "/creator?handle=" + encodeURIComponent(author.handle.replace(/^@/, ""));

        var editUrl = "/editor?tpl=" + encodeURIComponent(t.tpl);
        if (t.isCommunity) {
          editUrl += "&accent=" + encodeURIComponent(t.accent || "#ffffff")
            + "&font=" + encodeURIComponent(t.font || "inter")
            + "&dur=" + encodeURIComponent(t.dur || 4600)
            + "&lines=" + encodeURIComponent(JSON.stringify(t.lines || []))
            + "&commId=" + encodeURIComponent(t.commId || "");
        }

        var stage = document.createElement("div");
        stage.className = "sh-stage";

        var linkCover = document.createElement("a");
        linkCover.className = "sh-stage-link";
        linkCover.href = detailUrl;
        linkCover.setAttribute("aria-label", "View details for " + t.name);
        linkCover.addEventListener("click", function (ev) {
          ev.preventDefault();
          openTemplateModal(t);
        });
        stage.appendChild(linkCover);

        // Shimmer skeleton
        var skel = document.createElement("span");
        skel.className = "sh-skel";
        skel.textContent = "Preview";
        stage.appendChild(skel);

        /* The play and open-in-Studio buttons that used to float over each
           preview are gone: the preview loops by itself and the whole card
           opens the template, so they covered the artwork to offer what was
           already one click away. */


        // Meta Area (Title, Description, Creator Profile, Like/Comment/Share action bar)
        var meta = document.createElement("div");
        meta.className = "sh-tmeta";

        // 1. Title (Clickable to open modal)
        var titleRow = document.createElement("div");
        titleRow.className = "sh-ttitle-row";
        var titleEl = document.createElement("a");
        titleEl.className = "sh-ttitle";
        titleEl.href = detailUrl;
        titleEl.textContent = t.name;
        titleEl.addEventListener("click", function (ev) {
          ev.preventDefault();
          openTemplateModal(t);
        });
        titleRow.appendChild(titleEl);
        meta.appendChild(titleRow);

        /* The card is a preview, a name and whose it is — nothing else.
           The description was clamped to two lines and truncated mid-word on
           most templates, so it cost a row of height to say less than the
           title already did. It still appears in full on the detail page. */

        // 2. Creator Profile Row (Clickable to /creator)
        var creatorRow = document.createElement("a");
        creatorRow.className = "sh-tcreator-row";
        creatorRow.href = creatorUrl;
        creatorRow.title = "View profile of " + author.name;

        var avatarEl = document.createElement("div");
        avatarEl.className = "sh-tcreator-avatar";
        avatarEl.textContent = author.initials;
        if (author.avatarUrl) {
          avatarEl.textContent = "";
          avatarEl.style.backgroundImage = 'url("' + author.avatarUrl + '")';
          avatarEl.style.backgroundSize = "cover";
          avatarEl.style.backgroundPosition = "center";
        }

        var infoEl = document.createElement("div");
        infoEl.className = "sh-tcreator-info";

        var nameEl = document.createElement("span");
        nameEl.className = "sh-tcreator-name";
        nameEl.textContent = author.name;
        if (author.verified) {
          var verified = document.createElement("span");
          verified.className = "sh-verified";
          verified.setAttribute("aria-label", "Verified creator");
          verified.title = "Verified creator";
          verified.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.25l2.08 1.49 2.55-.05.74 2.44 2.1 1.45-.84 2.41.84 2.41-2.1 1.45-.74 2.44-2.55-.05L12 17.75l-2.08-1.49-2.55.05-.74-2.44-2.1-1.45.84-2.41-.84-2.41 2.1-1.45.74-2.44 2.55.05L12 2.25z"/><path d="M8.3 10.15l2.35 2.35 5.05-5.05" fill="none" stroke="white" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>';
          nameEl.appendChild(verified);
        }

        var handleEl = document.createElement("span");
        handleEl.className = "sh-tcreator-handle";
        handleEl.textContent = author.handle;

        infoEl.appendChild(nameEl);
        infoEl.appendChild(handleEl);
        creatorRow.appendChild(avatarEl);
        creatorRow.appendChild(infoEl);
        meta.appendChild(creatorRow);

        /* Like, comment and share used to sit under every card. They are
           per-template actions, and a gallery is for choosing a template,
           not reacting to sixty of them — the row added three controls and
           a divider to each card and pushed the previews out of the fold.
           They live on the detail page the card opens, where the template
           being acted on is unambiguous. */

        tile.appendChild(stage);
        tile.appendChild(meta);
        frag.appendChild(tile);
      });

      grid.innerHTML = "";
      grid.appendChild(frag);

      var reactionIds = allItems.map(templateKey).filter(Boolean);
      if (reactionIds.length) {
        fetch("/api/template-reactions?ids=" + encodeURIComponent(reactionIds.slice(0, 100).join(",")))
          .then(function (r) { return r.json(); })
          .then(function (j) {
            var state = (j && j.reactions) || {};
            allItems.forEach(function (item) {
              var itemState = state[templateKey(item)];
              if (!itemState) return;
              item.liked = itemState.like === true;
              item.likes = Number(itemState.likeCount) || 0;
              var itemTile = grid.querySelector('[data-reaction-id="' + CSS.escape(templateKey(item)) + '"]');
              if (itemTile) updateLikeControl(itemTile.querySelector(".sh-tact-btn.like"), item);
            });
          }).catch(function () {});
      }

      var tiles = Array.prototype.slice.call(grid.children);

      // Mount top tiles
      tiles.slice(0, 16).forEach(function (t) {
        mount(t);
      });

      // Lazy mount via IntersectionObserver
      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) mount(en.target);
          });
        }, { rootMargin: "800px 0px" });
        tiles.forEach(function (t) { io.observe(t); });
      } else {
        tiles.forEach(function (t) { mount(t); });
      }
    }
  }

  /* ── Category Chips & Search Filter ────────────────────── */
  function buildFilters() {
    var bar = $("#filters");
    var e = engine();
    if (!bar || !e) return;

    var categoryLabels = {
      all: "All",
      docu: "Documentary",
      paper: "Paper Craft",
      text: "Kinetic Text",
      maps: "Maps & Radar",
      money: "Finance",
      ui: "UI & Devices",
      social: "Social Media",
      charts: "Charts & Data"
    };

    var cats = [{ id: "all", label: "All" }].concat(e.cats().map(function (c) {
      return { id: c.id, label: categoryLabels[c.id] || c.label };
    }));

    bar.innerHTML = "";
    cats.forEach(function (c, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sh-chip" + (i === 0 ? " active" : "");
      b.dataset.cat = c.id;
      b.textContent = c.label;
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      bar.appendChild(b);
    });

    // Horizontal wheel & drag scrolling
    bar.addEventListener("wheel", function (ev) {
      if (ev.deltaY !== 0) {
        ev.preventDefault();
        bar.scrollLeft += ev.deltaY * 1.5;
      }
    }, { passive: false });

    var isDown = false, startX, scrollLeftVal;
    bar.addEventListener("mousedown", function (e) {
      isDown = true;
      startX = e.pageX - bar.offsetLeft;
      scrollLeftVal = bar.scrollLeft;
    });
    bar.addEventListener("mouseleave", function () { isDown = false; });
    bar.addEventListener("mouseup", function () { isDown = false; });
    bar.addEventListener("mousemove", function (e) {
      if (!isDown) return;
      e.preventDefault();
      var x = e.pageX - bar.offsetLeft;
      var walk = (x - startX) * 1.8;
      bar.scrollLeft = scrollLeftVal - walk;
    });

    bar.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".sh-chip") : null;
      if (!btn) return;

      Array.prototype.forEach.call(bar.querySelectorAll(".sh-chip"), function (c) {
        var isSel = c === btn;
        c.classList.toggle("active", isSel);
        c.setAttribute("aria-pressed", String(isSel));
      });

      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

      currentCategory = btn.dataset.cat || "all";
      filterTiles();
    });

    // Wire Real-Time Search Box
    var searchInput = $("#tplSearch");
    var searchClear = $("#tplSearchClear");

    if (searchInput) {
      searchInput.addEventListener("input", function () {
        searchQuery = searchInput.value;
        if (searchClear) searchClear.hidden = !searchQuery;
        filterTiles();
      });

      if (searchClear) {
        searchClear.addEventListener("click", function () {
          searchInput.value = "";
          searchQuery = "";
          searchClear.hidden = true;
          searchInput.focus();
          filterTiles();
        });
      }
    }
  }

  /* ── Composer Form Wireup ──────────────────────────────── */
  function wireComposer() {
    var form = $("#composer");
    var text = $("#composerPrompt") || $("#promptInput");
    var go   = $("#composerGo") || (form ? form.querySelector(".sh-cgo, .sh-go") : null);
    if (!form || !text || !go) return;

    var img  = $("#composerImg");
    var chip = $("#composerImgClear");
    var qWrap = $("#qualityDropdown");
    var qBtn  = $("#qualityBtn");
    var qMenu = $("#qualityMenu");
    var qVal  = $("#qualityVal");
    var tier  = $("#qualitySelect");
    var attached = null;

    if (qBtn && qMenu && tier) {
      qBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        var open = !qMenu.hidden;
        qMenu.hidden = open;
        qBtn.setAttribute("aria-expanded", String(!open));
      });

      Array.prototype.forEach.call(qMenu.querySelectorAll(".sh-csel-opt"), function (opt) {
        opt.addEventListener("click", function (ev) {
          ev.stopPropagation();
          var val = opt.dataset.val;
          tier.value = val;
          // The credit cost is the same for every tier — the tier picks the
          // model, not the price. Read it from the option's own label so this
          // can never drift from what the server actually charges.
          var costTxt = (opt.querySelector("span") || {}).textContent || "";
          var costNum = (costTxt.match(/(\d+)\s*credits?/i) || [])[1] || "5";
          var tierName = val === "mini" ? "Standard" : (val === "pro" ? "Detailed" : "Advanced");
          if (qVal) qVal.textContent = tierName + " (" + costNum + " credits)";
          if (qBtn) qBtn.setAttribute("aria-label", "Generation model: " + tierName);

          Array.prototype.forEach.call(qMenu.querySelectorAll(".sh-csel-opt"), function (o) {
            var isSel = o === opt;
            o.classList.toggle("selected", isSel);
            o.setAttribute("aria-selected", String(isSel));
          });

          qMenu.hidden = true;
          qBtn.setAttribute("aria-expanded", "false");
        });
      });

      document.addEventListener("click", function (ev) {
        if (qWrap && !qWrap.contains(ev.target)) {
          qMenu.hidden = true;
          qBtn.setAttribute("aria-expanded", "false");
        }
      });
    }

    function sync() {
      text.style.height = "auto";
      text.style.height = Math.min(text.scrollHeight, 180) + "px";
      go.disabled = text.value.trim().length < 2;
    }

    text.addEventListener("input", sync);
    sync();

    if (img) {
      img.addEventListener("change", function () {
        var file = img.files && img.files[0];
        if (!file) return;
        if (file.size > 900 * 1024) {
          SC_UI.toast("That image is " + Math.round(file.size / 1024) + " KB — keep it under 900 KB.", true, 4000);
          img.value = "";
          return;
        }
        var fr = new FileReader();
        fr.onload = function () {
          attached = { name: file.name, dataUrl: String(fr.result) };
          var nameEl = $("#composerImgName");
          if (nameEl) nameEl.textContent = file.name;
          chip.hidden = false;
        };
        fr.readAsDataURL(file);
      });
      if (chip) {
        chip.addEventListener("click", function () {
          attached = null; img.value = ""; chip.hidden = true;
        });
      }
    }

    text.addEventListener("keydown", function (e) {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        if (form.requestSubmit) form.requestSubmit();
        else form.dispatchEvent(new Event("submit", { cancelable: true }));
      }
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var topic = text.value.trim();
      if (topic.length < 2) { text.focus(); return; }

      try {
        localStorage.setItem("sc_pending_prompt", JSON.stringify({
          topic: topic, mode: "ai",
          quality: ($("#qualitySelect") || {}).value || "mini",
          hasImage: !!attached, at: Date.now()
        }));
        if (attached) sessionStorage.setItem("sc_pending_image", attached.dataUrl);
        else sessionStorage.removeItem("sc_pending_image");
      } catch (err) {}

      window.location.href = "/editor?topic=" + encodeURIComponent(topic) + "&mode=ai";
    });
  }

  /* ── App Shell & Live Credit Balance ───────────────────── */
  function wireChrome() {
    var badge = document.querySelector(".sh-plan-badge");
    var creditChip = document.querySelector(".sh-credit-chip");
    if (badge || creditChip) {
      fetch("/api/credits", { headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.success) return;
          if (creditChip) {
            var chipPlan = creditChip.querySelector(".sh-credit-plan");
            var chipBalance = creditChip.querySelector(".sh-credit-balance");
            if (chipPlan) chipPlan.textContent = j.planLabel;
            // "Free · 5 Credits" reads as a plan and a balance. "5 / 5" read as
            // a score, and told you nothing about which plan you are on.
            if (chipBalance) chipBalance.textContent = j.left + " Credit" + (j.left === 1 ? "" : "s");
          }
          var up = null;
          if (badge) {
            var b = badge.querySelector("b");
            var sCredits = badge.querySelector(".sh-plan-credits");
            var sRates = badge.querySelector(".sh-plan-rates");
            var sLegacy = badge.querySelector("span:not(.sh-plan-arrow)");
            up = badge.querySelector(".sh-plan-upgrade-link") || badge.querySelector("a");

            if (b) b.textContent = j.planLabel + " plan";
            if (sCredits) {
              sCredits.textContent = j.left + " of " + j.perDay + " credits left today";
            } else if (sLegacy) {
              sLegacy.textContent = j.left + " of " + j.perDay + " credits left today";
            }
            if (sRates && j.cost) {
              sRates.textContent = "Export " + j.cost.export + " · AI scene " + j.cost.animate;
            }
          }
          document.querySelectorAll(".sh-upop-credits-pill").forEach(function (el) {
            el.textContent = "⚡ " + j.left + " / " + j.perDay + " Credits";
          });
          if (up && j.plan !== "free") {
            up.textContent = "Manage your plan ↗";
          }
        })
        .catch(function () {});
    }

    var burger = $("#navBurger");
    var menu   = $("#navMobile");
    if (burger && menu) {
      burger.setAttribute("aria-controls", "navMobile");
      burger.addEventListener("click", function () {
        var open = menu.hasAttribute("hidden");
        if (open) menu.removeAttribute("hidden");
        else menu.setAttribute("hidden", "");
        burger.setAttribute("aria-expanded", String(open));
        burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
      });

      menu.addEventListener("click", function (e) {
        if (e.target && e.target.tagName === "A") {
          menu.setAttribute("hidden", "");
          burger.setAttribute("aria-expanded", "false");
          burger.setAttribute("aria-label", "Open menu");
        }
      });

      document.addEventListener("keydown", function (e) {
        if (e.key === "Escape" && !menu.hasAttribute("hidden")) {
          menu.setAttribute("hidden", "");
          burger.setAttribute("aria-expanded", "false");
          burger.setAttribute("aria-label", "Open menu");
          burger.focus();
        }
      });
    }

    var bar = $("#scrollBar");
    if (bar) {
      var raf = 0;
      var update = function () {
        raf = 0;
        var doc = document.documentElement;
        var max = doc.scrollHeight - doc.clientHeight;
        var pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
        bar.style.width = pct.toFixed(2) + "%";
      };
      window.addEventListener("scroll", function () {
        if (!raf) raf = requestAnimationFrame(update);
      }, { passive: true });
      update();
    }
  }

  /* ── Boot ─────────────────────────────────────────────── */
  function init() {
    buildFilters();
    buildGallery();
    wireComposer();
    wireChrome();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.SC_SHELL = { refreshGallery: buildGallery, openModal: openTemplateModal };
})();
