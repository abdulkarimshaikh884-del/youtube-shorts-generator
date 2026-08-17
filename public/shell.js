/* ============================================================
   ShortsCraft — App Shell behaviour (index page)
   - Live template gallery from SC_TPL2 (sandboxed, lazy-mounted iframes)
   - Clean category filtering & real-time search
   - Full card presentation: Title, 2-line clamped Description, Creator Avatar & Handle, Like / Comment / Share action buttons
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
    if (t.isCommunity && t.authorHandle) {
      var name = t.authorName || t.authorHandle;
      var handle = t.authorHandle.replace(/^@/, "");
      var initials = handle.slice(0, 2).toUpperCase();
      return { name: name, handle: "@" + handle, initials: initials };
    }
    var catMap = {
      docu: { name: "Crime Stories", handle: "@crimedocu", initials: "CD" },
      paper: { name: "Aman Motion FX", handle: "@aman_fx", initials: "AF" },
      ui: { name: "Sarah Creative", handle: "@sarah_motion", initials: "SC" },
      social: { name: "Vikram Shorts", handle: "@vikram_creations", initials: "VS" },
      charts: { name: "Kabir Motion", handle: "@kabir_motion", initials: "KM" },
      money: { name: "Finance Pulse", handle: "@finance_pulse", initials: "FP" },
      text: { name: "Kinetic Studio", handle: "@typography_pro", initials: "KS" },
      maps: { name: "Geo Explorer", handle: "@geo_explorer", initials: "GE" }
    };
    return catMap[t.cat] || { name: "ShortsCraft Official", handle: "@shortscraft", initials: "SC" };
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
      emptyState.innerHTML = '<div class="sh-empty-ico">🔍</div><h3>No templates found</h3><p>Try searching for a different keyword or category.</p>';
      grid.appendChild(emptyState);
    }
    emptyState.hidden = count > 0;
  }

  function buildGallery() {
    var grid = $("#gallery");
    var e = engine();
    if (!grid || !e) return;

    grid.innerHTML = "";
    grid.dataset.ar = currentAspect;

    fetch("/api/community-templates")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var commList = (d && d.templates) || [];
        renderAllTemplates(commList);
      })
      .catch(function () {
        renderAllTemplates([]);
      });

    function renderAllTemplates(commList) {
      var allItems = [];
      var seenIds = {};

      // 1. Featured Community Templates
      commList.forEach(function (ct) {
        var likes = Number(ct.likes || 1);
        var downloads = Number(ct.downloads || 1);
        var score = (likes * 25) + (downloads * 12) + 120;
        var tplId = ct.tpl || "text-cascade";

        allItems.push({
          id: ct.id || ("comm_" + Math.random()),
          commId: ct.id,
          tpl: tplId,
          name: ct.title || "Community Template",
          desc: ct.description || "Custom creator motion design",
          cat: ct.category || "text",
          authorHandle: ct.authorHandle || "creator",
          authorName: ct.authorName || "Creator",
          accent: ct.accent || "#ffffff",
          font: ct.font || "inter",
          dur: ct.dur || 4600,
          lines: ct.lines || [],
          isCommunity: true,
          likes: likes,
          downloads: downloads,
          score: score
        });
        seenIds[tplId] = true;
      });

      // 2. Built-in 80+ Templates
      e.list().forEach(function (t, idx) {
        allItems.push({
          id: t.id,
          tpl: t.id,
          name: t.name,
          desc: t.desc,
          cat: t.cat,
          isCommunity: false,
          likes: Math.max(18, 95 - idx),
          downloads: Math.max(30, 180 - (idx * 2)),
          score: (Math.max(18, 95 - idx) * 10) + (Math.max(30, 180 - (idx * 2)) * 5)
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

        if (t.isCommunity) {
          tile.dataset.comm = "1";
          tile.dataset.commId = t.commId;
          tile.dataset.accent = t.accent;
          tile.dataset.font = t.font;
          tile.dataset.dur = t.dur;
          tile.dataset.lines = JSON.stringify(t.lines || []);
        }

        var editUrl = "/editor?tpl=" + encodeURIComponent(t.tpl);
        if (t.isCommunity) {
          editUrl += "&accent=" + encodeURIComponent(t.accent || "#ffffff")
            + "&font=" + encodeURIComponent(t.font || "inter")
            + "&dur=" + encodeURIComponent(t.dur || 4600)
            + "&aspect=" + encodeURIComponent(currentAspect)
            + "&lines=" + encodeURIComponent(JSON.stringify(t.lines || []));
        } else {
          editUrl += "&aspect=" + encodeURIComponent(currentAspect);
        }

        var stage = document.createElement("div");
        stage.className = "sh-stage";

        var linkCover = document.createElement("a");
        linkCover.className = "sh-stage-link";
        linkCover.href = editUrl;
        linkCover.setAttribute("aria-label", "Open " + t.name + " in Editor");
        stage.appendChild(linkCover);

        // Top Badges
        if (t.isCommunity) {
          var commBadge = document.createElement("span");
          commBadge.className = "sh-comm-badge";
          commBadge.innerHTML = '✦ @' + author.handle.replace(/^@/, "");
          stage.appendChild(commBadge);
        } else if (t.cat === "paper" || t.cat === "docu") {
          var proBadge = document.createElement("span");
          proBadge.className = "sh-pro-badge";
          proBadge.textContent = "PRO";
          stage.appendChild(proBadge);
        }

        // Shimmer skeleton
        var skel = document.createElement("span");
        skel.className = "sh-skel";
        skel.textContent = "Preview";
        stage.appendChild(skel);

        // Hover Floating Play Button & Open Button
        var hoverBar = document.createElement("div");
        hoverBar.className = "sh-card-hover-bar";

        var playBtn = document.createElement("button");
        playBtn.type = "button";
        playBtn.className = "sh-card-btn play";
        playBtn.setAttribute("aria-label", "Replay animation");
        playBtn.title = "Replay Animation";
        playBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="6 3 20 12 6 21 6 3"/></svg>';
        playBtn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          mount(tile, true);
        });

        var openBtn = document.createElement("a");
        openBtn.className = "sh-card-btn open";
        openBtn.href = editUrl;
        openBtn.setAttribute("aria-label", "Open in Video Studio");
        openBtn.title = "Open in Studio";
        openBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M7 17L17 7M17 7H8M17 7V16"/></svg>';

        hoverBar.appendChild(playBtn);
        hoverBar.appendChild(openBtn);
        stage.appendChild(hoverBar);

        // Meta Area (Title, Description, Creator Profile, Like/Comment/Share action bar)
        var meta = document.createElement("div");
        meta.className = "sh-tmeta";

        // 1. Title
        var titleRow = document.createElement("div");
        titleRow.className = "sh-ttitle-row";
        var titleEl = document.createElement("b");
        titleEl.className = "sh-ttitle";
        titleEl.textContent = t.name;
        titleRow.appendChild(titleEl);
        meta.appendChild(titleRow);

        // 2. Description (Clamped 2 lines)
        var descEl = document.createElement("p");
        descEl.className = "sh-tdesc";
        descEl.textContent = t.desc;
        meta.appendChild(descEl);

        // 3. Creator Profile Row (Avatar + Account Handle)
        var creatorRow = document.createElement("div");
        creatorRow.className = "sh-tcreator-row";

        var avatarEl = document.createElement("div");
        avatarEl.className = "sh-tcreator-avatar";
        avatarEl.textContent = author.initials;

        var infoEl = document.createElement("div");
        infoEl.className = "sh-tcreator-info";

        var nameEl = document.createElement("span");
        nameEl.className = "sh-tcreator-name";
        nameEl.textContent = author.name;

        var handleEl = document.createElement("span");
        handleEl.className = "sh-tcreator-handle";
        handleEl.textContent = author.handle;

        infoEl.appendChild(nameEl);
        infoEl.appendChild(handleEl);
        creatorRow.appendChild(avatarEl);
        creatorRow.appendChild(infoEl);
        meta.appendChild(creatorRow);

        // 4. Action Bar (Like, Comment, Share)
        var actBar = document.createElement("div");
        actBar.className = "sh-tact-bar";

        // Like Button
        var likeBtn = document.createElement("button");
        likeBtn.type = "button";
        likeBtn.className = "sh-tact-btn like";
        likeBtn.title = "Like template";
        likeBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"/></svg><span class="sh-like-count">' + t.likes + '</span>';
        likeBtn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          if (likeBtn.dataset.liked === "1") return;
          likeBtn.dataset.liked = "1";
          likeBtn.classList.add("liked");
          t.likes++;
          var sp = likeBtn.querySelector(".sh-like-count");
          if (sp) sp.textContent = String(t.likes);

          if (t.commId) {
            fetch("/api/community-templates/" + encodeURIComponent(t.commId) + "/like", { method: "POST" }).catch(function () {});
          }
        });

        // Comment Button
        var commentBtn = document.createElement("a");
        commentBtn.className = "sh-tact-btn comment";
        commentBtn.href = editUrl;
        commentBtn.title = "Open in Studio to comment & remix";
        commentBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg><span>' + Math.max(2, Math.floor(t.likes / 6)) + '</span>';

        // Share Button
        var shareBtn = document.createElement("button");
        shareBtn.type = "button";
        shareBtn.className = "sh-tact-btn share";
        shareBtn.title = "Share template link";
        shareBtn.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="18" cy="5" r="3"/><circle cx="6" cy="12" r="3"/><circle cx="18" cy="19" r="3"/><line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/><line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/></svg><span>Share</span>';
        shareBtn.addEventListener("click", function (ev) {
          ev.preventDefault();
          ev.stopPropagation();
          var shareUrl = window.location.origin + editUrl;
          if (navigator.clipboard && navigator.clipboard.writeText) {
            navigator.clipboard.writeText(shareUrl).then(function () {
              var sp = shareBtn.querySelector("span");
              if (sp) sp.textContent = "Copied!";
              shareBtn.classList.add("copied");
              setTimeout(function () {
                if (sp) sp.textContent = "Share";
                shareBtn.classList.remove("copied");
              }, 2000);
            });
          } else {
            prompt("Copy template link:", shareUrl);
          }
        });

        actBar.appendChild(likeBtn);
        actBar.appendChild(commentBtn);
        actBar.appendChild(shareBtn);
        meta.appendChild(actBar);

        tile.appendChild(stage);
        tile.appendChild(meta);
        frag.appendChild(tile);
      });

      grid.innerHTML = "";
      grid.appendChild(frag);

      var tiles = Array.prototype.slice.call(grid.children);

      // Mount the top tiles immediately
      tiles.slice(0, 16).forEach(function (t) {
        mount(t);
      });

      // Lazy mount the rest via IntersectionObserver
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
          if (qVal) qVal.textContent = val === "mini" ? "Free (5 credits)" : (val === "pro" ? "Pro (10 credits)" : "Pro Max (15 credits)");
          if (qBtn) qBtn.setAttribute("aria-label", "Model tier: " + (val === "mini" ? "Free" : val));

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
          alert("That image is " + Math.round(file.size / 1024) + " KB. Keep it under 900 KB.");
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
    if (badge) {
      fetch("/api/credits", { headers: { Accept: "application/json" } })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j || !j.success) return;
          var b = badge.querySelector("b"), s = badge.querySelector("span");
          if (b) b.textContent = j.planLabel + " plan";
          if (s) {
            s.textContent = j.left + " of " + j.perDay + " credits left today · " +
              "export " + j.cost.export + ", AI scene " + j.cost.animate;
          }
          var up = badge.querySelector("a");
          if (up && j.plan !== "free") up.textContent = "Manage your plan";
        })
        .catch(function () {});
    }

    var burger = $("#navBurger");
    var menu   = $("#navMobile");
    if (burger && menu) {
      burger.addEventListener("click", function () {
        var open = menu.hasAttribute("hidden");
        if (open) menu.removeAttribute("hidden");
        else menu.setAttribute("hidden", "");
        burger.setAttribute("aria-expanded", String(open));
      });

      menu.addEventListener("click", function (e) {
        if (e.target && e.target.tagName === "A") {
          menu.setAttribute("hidden", "");
          burger.setAttribute("aria-expanded", "false");
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

  window.SC_SHELL = { refreshGallery: buildGallery };
})();
