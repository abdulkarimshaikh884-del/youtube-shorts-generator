/* ============================================================
   ShortsCraft — App Shell behaviour (index page)
   - live template gallery from SC_TPL2 (sandboxed, lazy-mounted iframes)
   - category filter chips, driven by engine metadata
   - prompt composer -> Video Studio
   - mobile nav + scroll progress (this page does not load script.js)
   Depends on /templates-v2.js -> window.SC_TPL2
   ============================================================ */
(function () {
  "use strict";

  // Each template carries its own demo content (SC_TPL2 DEMO map), so the
  // gallery passes no lines and lets every card show what it is best at.
  var MAX_LIVE = 16; // v2 templates are pure CSS, so a full gallery is affordable

  var currentAspect = "9:16";

  function $(sel, root) { return (root || document).querySelector(sel); }
  function engine() { return window.SC_TPL2; }

  /* ── Gallery ──────────────────────────────────────────── */
  function mount(tile, force) {
    if (!tile) return;
    if (tile.dataset.mounted === "1" && !force) return;

    var e = engine();
    if (!e || typeof e.build !== "function") return;

    var stage = $(".sh-stage", tile);
    if (!stage) return;

    var html;
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
      html = "";
    }
    if (!html) return;

    var oldFrame = stage.querySelector("iframe");
    if (oldFrame) oldFrame.remove();

    var frame = document.createElement("iframe");
    frame.setAttribute("sandbox", "");
    frame.setAttribute("scrolling", "no");
    frame.setAttribute("tabindex", "-1");
    frame.setAttribute("aria-hidden", "true");
    frame.setAttribute("title", (tile.dataset.name || "Template") + " animation preview");
    frame.srcdoc = html;

    var sk = $(".sh-skel", stage);
    frame.addEventListener("load", function () {
      if (sk && sk.parentNode) sk.remove();
    });
    // Fallback: also remove skeleton after short timeout if load event already fired
    setTimeout(function () {
      if (sk && sk.parentNode) sk.remove();
    }, 300);

    stage.appendChild(frame);
    tile.dataset.mounted = "1";
  }

  function buildGallery() {
    var grid = $("#gallery");
    var e = engine();
    if (!grid || !e) return;

    grid.innerHTML = "";
    grid.dataset.ar = currentAspect;

    // Fetch community templates and merge with built-in templates
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

      // 1. Built-in templates with base engagement score
      e.list().forEach(function (t, idx) {
        allItems.push({
          id: t.id,
          tpl: t.id,
          name: t.name,
          desc: t.desc,
          cat: t.cat,
          isCommunity: false,
          likes: Math.max(12, 45 - idx),
          downloads: Math.max(20, 80 - (idx * 2)),
          score: (Math.max(12, 45 - idx) * 10) + (Math.max(20, 80 - (idx * 2)) * 5)
        });
      });

      // 2. User-uploaded community templates with engagement ranking
      commList.forEach(function (ct) {
        var likes = Number(ct.likes || 1);
        var downloads = Number(ct.downloads || 1);
        // Ranking score: user uploaded templates get active community bonus + likes/downloads
        var score = (likes * 25) + (downloads * 12) + 60;

        allItems.push({
          id: ct.tpl || "type-cascade",
          commId: ct.id,
          tpl: ct.tpl || "type-cascade",
          name: ct.title || "Community Template",
          desc: ct.description || (Array.isArray(ct.lines) ? ct.lines.filter(Boolean).join(" · ") : "Custom motion design"),
          cat: ct.category || "text",
          authorHandle: ct.authorHandle || "creator",
          authorName: ct.authorName,
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

      // 3. Sort by engagement ranking score (highest first)
      allItems.sort(function (a, b) {
        return b.score - a.score;
      });

      var frag = document.createDocumentFragment();

      allItems.forEach(function (t) {
        var tile = document.createElement("article");
        tile.className = "sh-tile";
        tile.dataset.tpl = t.tpl;
        tile.dataset.name = t.name;
        tile.dataset.cat = t.cat;

        if (t.isCommunity) {
          tile.dataset.comm = "1";
          tile.dataset.commId = t.commId;
          tile.dataset.accent = t.accent;
          tile.dataset.font = t.font;
          tile.dataset.dur = t.dur;
          tile.dataset.lines = JSON.stringify(t.lines || []);
        }

        var stage = document.createElement("a");
        stage.className = "sh-stage";

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

        stage.href = editUrl;
        stage.setAttribute("aria-label", "Open " + t.name + " in the Video Studio");

        if (t.isCommunity) {
          var badge = document.createElement("span");
          badge.className = "sh-comm-badge";
          badge.textContent = "✦ By @" + t.authorHandle;
          stage.appendChild(badge);
        }

        var skel = document.createElement("span");
        skel.className = "sh-skel";
        skel.textContent = "Preview";

        var use = document.createElement("span");
        use.className = "sh-use";
        use.textContent = "Use template";

        stage.appendChild(skel);
        stage.appendChild(use);

        var meta = document.createElement("div");
        meta.className = "sh-tmeta";
        var b = document.createElement("b");
        b.textContent = t.name;
        var sp = document.createElement("span");
        sp.textContent = t.desc;
        meta.appendChild(b);
        meta.appendChild(sp);

        if (t.isCommunity) {
          var crow = document.createElement("div");
          crow.className = "sh-tcomm-row";
          crow.innerHTML = '<span class="sh-tcomm-author">@' + t.authorHandle + '</span>'
            + '<span class="sh-tcomm-likes">❤️ ' + t.likes + '</span>';
          meta.appendChild(crow);
        }

        tile.appendChild(stage);
        tile.appendChild(meta);
        frag.appendChild(tile);
      });

      grid.innerHTML = "";
      grid.appendChild(frag);

      var tiles = Array.prototype.slice.call(grid.children);

      // Mount all tiles directly so previews are instantly animated
      tiles.forEach(function (t) {
        mount(t);
      });

      if ("IntersectionObserver" in window) {
        var io = new IntersectionObserver(function (entries) {
          entries.forEach(function (en) {
            if (en.isIntersecting) mount(en.target);
          });
        }, { rootMargin: "600px 0px" });
        tiles.forEach(function (t) { io.observe(t); });
      }
    }
  }

  /* ── Aspect Ratio Switcher ─────────────────────────────── */
  function wireRatioSwitch() {
    var bar = $("#ratioSwitch");
    var grid = $("#gallery");
    if (!bar || !grid) return;

    bar.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".sh-rchip") : null;
      if (!btn || !btn.dataset.ar) return;

      var ar = btn.dataset.ar;
      if (ar === currentAspect) return;
      currentAspect = ar;

      Array.prototype.forEach.call(bar.querySelectorAll(".sh-rchip"), function (b) {
        var active = b === btn;
        b.classList.toggle("active", active);
        b.setAttribute("aria-pressed", String(active));
      });

      grid.dataset.ar = currentAspect;

      // Re-mount and update URLs for all tiles
      Array.prototype.forEach.call(grid.children, function (tile) {
        var stage = tile.querySelector(".sh-stage");
        if (stage) {
          if (tile.dataset.comm === "1") {
            stage.href = "/editor?tpl=" + encodeURIComponent(tile.dataset.tpl)
              + "&accent=" + encodeURIComponent(tile.dataset.accent || "#ffffff")
              + "&font=" + encodeURIComponent(tile.dataset.font || "inter")
              + "&dur=" + encodeURIComponent(tile.dataset.dur || 4600)
              + "&aspect=" + encodeURIComponent(currentAspect)
              + "&lines=" + encodeURIComponent(tile.dataset.lines || "[]");
          } else {
            stage.href = "/editor?tpl=" + encodeURIComponent(tile.dataset.tpl) + "&aspect=" + encodeURIComponent(currentAspect);
          }
        }
        if (!tile.hidden) {
          mount(tile, true);
        }
      });
    });
  }

  /* ── Filter chips ─────────────────────────────────────── */
  function buildFilters() {
    var bar = $("#filters");
    var grid = $("#gallery");
    var e = engine();
    if (!bar || !grid || !e) return;

    var cats = [{ id: "all", label: "All" }].concat(e.cats());
    bar.innerHTML = "";
    cats.forEach(function (c, i) {
      var b = document.createElement("button");
      b.type = "button";
      b.className = "sh-chip";
      b.dataset.cat = c.id;
      b.textContent = c.label;
      b.setAttribute("aria-pressed", i === 0 ? "true" : "false");
      bar.appendChild(b);
    });

    // Horizontal mouse wheel scrolling
    bar.addEventListener("wheel", function (ev) {
      if (ev.deltaY !== 0) {
        ev.preventDefault();
        bar.scrollLeft += ev.deltaY * 1.5;
      }
    }, { passive: false });

    // Drag-to-scroll
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

    // Prev / Next arrow buttons
    var prevBtn = $("#fnavPrev");
    var nextBtn = $("#fnavNext");
    if (prevBtn) {
      prevBtn.addEventListener("click", function () {
        bar.scrollBy({ left: -220, behavior: "smooth" });
      });
    }
    if (nextBtn) {
      nextBtn.addEventListener("click", function () {
        bar.scrollBy({ left: 220, behavior: "smooth" });
      });
    }

    bar.addEventListener("click", function (ev) {
      var btn = ev.target && ev.target.closest ? ev.target.closest(".sh-chip") : null;
      if (!btn) return;

      Array.prototype.forEach.call(bar.querySelectorAll(".sh-chip"), function (c) {
        c.setAttribute("aria-pressed", String(c === btn));
      });

      btn.scrollIntoView({ behavior: "smooth", block: "nearest", inline: "center" });

      var cat = btn.dataset.cat;
      Array.prototype.forEach.call(grid.children, function (tile) {
        var show = cat === "all" || tile.dataset.cat === cat;
        tile.hidden = !show;
        if (show) mount(tile);
      });
    });
  }

  /* ── Composer: fill template options from the engine ──── */
  function fillTemplateSelect() {
    var sel = $("#styleSelect");
    var e = engine();
    if (!sel || !e) return;
    sel.innerHTML = "";
    e.list().forEach(function (t) {
      var op = document.createElement("option");
      op.value = t.id;
      op.textContent = t.name;
      sel.appendChild(op);
    });
  }

  /* The composer is the AI path: a prompt, an optional image, and which model
     tier to use. Templates are picked from the gallery below it, so the bar does
     not repeat that choice — and aspect ratio belongs in the editor, where all
     seven ratios have device toggles. */
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
    var cost  = $("#composerCost") || $(".sh-chint", form) || $(".sh-cost", form);
    var attached = null;      // {name, dataUrl}

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
          if (qVal) qVal.textContent = val === "mini" ? "Free" : (val === "pro" ? "Pro" : "Pro Max");
          if (qBtn) qBtn.setAttribute("aria-label", "Model tier: " + (val === "mini" ? "Free" : val));

          Array.prototype.forEach.call(qMenu.querySelectorAll(".sh-csel-opt"), function (o) {
            var isSel = o === opt;
            o.classList.toggle("selected", isSel);
            o.setAttribute("aria-selected", String(isSel));
          });

          if (cost) {
            if (val === "mini") cost.textContent = "5 credits";
            else if (val === "pro") cost.textContent = "Pro · 10 credits";
            else if (val === "max") cost.textContent = "Pro Max · 15 credits";
          }

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
    } else if (tier && cost) {
      tier.addEventListener("change", function () {
        var v = tier.value;
        if (v === "mini") cost.textContent = "5 credits";
        else if (v === "pro") cost.textContent = "Pro · 10 credits";
        else if (v === "max") cost.textContent = "Pro Max · 15 credits";
      });
    }

    function sync() {
      text.style.height = "auto";
      text.style.height = Math.min(text.scrollHeight, 210) + "px";
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

      // Hand off to the editor. Stored as well as passed on the URL so the
      // editor can pick it up either way. The image is too big for a URL, so it
      // travels in sessionStorage and is dropped if storage refuses it.
      try {
        localStorage.setItem("sc_pending_prompt", JSON.stringify({
          topic: topic, mode: "ai",
          quality: ($("#qualitySelect") || {}).value || "mini",
          hasImage: !!attached, at: Date.now()
        }));
        if (attached) sessionStorage.setItem("sc_pending_image", attached.dataUrl);
        else sessionStorage.removeItem("sc_pending_image");
      } catch (err) { /* storage blocked; the URL still carries the text */ }

      window.location.href = "/editor?topic=" + encodeURIComponent(topic) + "&mode=ai";
    });
  }

  /* ── Mobile nav + scroll progress ─────────────────────── */
  function wireChrome() {
    /* live credit balance in the sidebar badge — the server owns the number */
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
        .catch(function () { /* the badge keeps its static copy */ });
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
    fillTemplateSelect();
    buildFilters();
    buildGallery();
    wireRatioSwitch();
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
