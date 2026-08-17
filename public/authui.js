/* ============================================================
   authui.js — the signed-in/out state of the chrome, shared by every page.

   One /api/auth/me call drives the top bar, the mobile nav and /account, so
   "Log in" / "Sign up" never show to someone who is already logged in, and the
   log-out button never shows to a guest. Loaded by the landing page (which uses
   shell.js) and by the generated pages (which use page.js), so the logic lives
   in exactly one file.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var all = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };

  function show(el, on) {
    if (on) el.removeAttribute("hidden"); else el.setAttribute("hidden", "");
  }

  function paint(user) {
    all('[data-auth="in"]').forEach(function (el) { show(el, !!user); });
    all('[data-auth="out"]').forEach(function (el) { show(el, !user); });
    all("[data-auth-email]").forEach(function (el) {
      el.textContent = user ? String(user.email).split("@")[0] : "Account";
      if (user) el.title = user.email;
    });

    var box = $("#accountBox"), guest = $("#accountGuest");
    if (box && guest) {
      show(box, !!user);
      show(guest, !user);
      if (user) {
        var uname = String(user.email).split("@")[0] || "creator";
        var dname = user.displayName || (uname.charAt(0).toUpperCase() + uname.slice(1));
        var handle = user.handle || ("@" + uname);
        var bio = user.bio || "Designing viral YouTube Shorts, Instagram Reels & AI kinetic typography motion graphics.";

        if ($("#accEmail")) $("#accEmail").textContent = user.email;
        if ($("#crDisplayName")) $("#crDisplayName").textContent = dname;
        if ($("#crHandle")) $("#crHandle").textContent = handle;
        if ($("#crAvatarChar")) $("#crAvatarChar").textContent = dname.charAt(0).toUpperCase() || uname.charAt(0).toUpperCase();
        if ($("#crBio")) $("#crBio").textContent = bio;
        if ($("#crStarsCount")) $("#crStarsCount").textContent = user.stars || 48;

        if ($("#crYtLink")) {
          if (user.youtube) {
            $("#crYtLink").href = user.youtube.startsWith("http") ? user.youtube : "https://youtube.com/" + (user.youtube.startsWith("@") ? "" : "@") + user.youtube;
          }
        }
        if ($("#crIgLink")) {
          if (user.instagram) {
            $("#crIgLink").href = user.instagram.startsWith("http") ? user.instagram : "https://instagram.com/" + user.instagram.replace(/^@/, "");
          }
        }

        if ($("#accSince")) {
          var d = new Date(user.createdAt);
          $("#accSince").textContent = isNaN(d) ? "—" : d.toLocaleDateString();
        }

        loadUserCreations();
      }
    }
  }

  function logout() {
    fetch("/api/auth/logout", { method: "POST" })
      .then(function () { location.href = "/"; })
      .catch(function () { location.reload(); });
  }

  var currentUser = null;

  function setupEditProfile() {
    var modal = $("#editProfileModal");
    var openBtn = $("#openEditProfileBtn");
    var closeBtn = $("#closeEditProfileBtn");
    var cancelBtn = $("#cancelProfileModalBtn");
    var form = $("#editProfileForm");
    var note = $("#editProfileNote");
    var saveBtn = $("#saveProfileBtn");

    if (!modal || !openBtn) return;

    function openModal() {
      if (!currentUser) return;
      var uname = String(currentUser.email).split("@")[0] || "creator";
      if ($("#editDisplayName")) $("#editDisplayName").value = currentUser.displayName || uname.charAt(0).toUpperCase() + uname.slice(1);
      if ($("#editHandle")) $("#editHandle").value = currentUser.handle || ("@" + uname);
      if ($("#editBio")) $("#editBio").value = currentUser.bio || "Designing viral YouTube Shorts, Instagram Reels & AI kinetic typography motion graphics.";
      if ($("#editYoutube")) $("#editYoutube").value = currentUser.youtube || "https://youtube.com/@VaultGamer-in";
      if ($("#editInstagram")) $("#editInstagram").value = currentUser.instagram || "https://instagram.com/tech_vault_in";
      if (note) note.textContent = "";
      show(modal, true);
    }

    function closeModal() {
      show(modal, false);
    }

    openBtn.addEventListener("click", openModal);
    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    modal.addEventListener("click", function (e) {
      if (e.target === modal) closeModal();
    });

    if (form) {
      form.addEventListener("submit", function (e) {
        e.preventDefault();
        var displayName = $("#editDisplayName") ? $("#editDisplayName").value.trim() : "";
        var handle = $("#editHandle") ? $("#editHandle").value.trim() : "";
        var bio = $("#editBio") ? $("#editBio").value.trim() : "";
        var youtube = $("#editYoutube") ? $("#editYoutube").value.trim() : "";
        var instagram = $("#editInstagram") ? $("#editInstagram").value.trim() : "";

        if (saveBtn) {
          saveBtn.disabled = true;
          saveBtn.textContent = "Saving…";
        }
        if (note) note.textContent = "";

        fetch("/api/auth/profile", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            displayName: displayName,
            handle: handle,
            bio: bio,
            youtube: youtube,
            instagram: instagram
          })
        })
        .then(function (r) { return r.json(); })
        .then(function (j) {
          if (!j.success || !j.user) throw new Error(j.error || "Failed to update profile");
          currentUser = j.user;
          paint(currentUser);
          closeModal();
        })
        .catch(function (err) {
          if (note) note.textContent = err.message || "Failed to save profile";
        })
        .finally(function () {
          if (saveBtn) {
            saveBtn.disabled = false;
            saveBtn.textContent = "Save Profile";
          }
        });
      });
    }
  }

  function setupStars() {
    var starBtn = $("#giveStarBtn");
    var starsCount = $("#crStarsCount");
    if (!starBtn) return;

    starBtn.addEventListener("click", function () {
      if (!currentUser) return;
      starBtn.disabled = true;
      fetch("/api/auth/star", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ userId: currentUser.id })
      })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (j.success && j.stars !== undefined) {
          if (starsCount) starsCount.textContent = j.stars;
          starBtn.classList.add("starred");
        }
      })
      .catch(function () {})
      .finally(function () {
        starBtn.disabled = false;
      });
    });
  }

  function loadUserCreations() {
    var grid = $("#userCreationsGrid");
    var countEl = $("#creationsCount");
    if (!grid) return;

    fetch("/api/user/creations")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var items = (d && d.creations) ? d.creations : [];
        if (countEl) countEl.textContent = items.length + " Template" + (items.length === 1 ? "" : "s");

        if (!items.length) {
          grid.innerHTML = '<div class="cr-cre-empty">' +
            '<h3>No Templates Created Yet</h3>' +
            '<p>Design viral motion graphics & kinetic text templates in the Studio and publish them to build your creator portfolio!</p>' +
            '<a href="/editor" class="pg-bw">+ Create Your First Template</a>' +
          '</div>';
          return;
        }

        grid.innerHTML = "";
        var e = window.SC_TPL2;

        items.forEach(function (t) {
          var card = document.createElement("article");
          card.className = "cr-cre-card";

          var editUrl = "/editor?tpl=" + encodeURIComponent(t.tpl || "type-cascade")
            + "&accent=" + encodeURIComponent(t.accent || "#ffffff")
            + "&font=" + encodeURIComponent(t.font || "inter")
            + "&dur=" + encodeURIComponent(t.dur || 4600)
            + "&lines=" + encodeURIComponent(JSON.stringify(t.lines || []));

          var prev = document.createElement("div");
          prev.className = "cr-cre-preview";

          if (e && typeof e.build === "function") {
            var html = e.build(t.tpl, {
              lines: t.lines,
              accent: t.accent,
              font: t.font,
              dur: t.dur,
              aspect: "9:16"
            });
            if (html) {
              var f = document.createElement("iframe");
              f.setAttribute("sandbox", "");
              f.setAttribute("scrolling", "no");
              f.setAttribute("tabindex", "-1");
              f.setAttribute("aria-hidden", "true");
              f.srcdoc = html;
              prev.appendChild(f);
            }
          }

          var body = document.createElement("div");
          body.className = "cr-cre-body";

          var meta = document.createElement("div");
          meta.className = "cr-cre-meta";
          meta.innerHTML = '<span class="cr-cre-tag">' + (t.category || "Motion") + '</span>'
            + '<div class="cr-cre-stats"><span>❤️ ' + (t.likes || 1) + '</span><span>📥 ' + (t.downloads || 1) + '</span></div>';

          var title = document.createElement("h3");
          title.className = "cr-cre-title";
          title.textContent = t.title || "Custom Animation";

          var desc = document.createElement("p");
          desc.className = "cr-cre-desc";
          desc.textContent = t.description || (Array.isArray(t.lines) ? t.lines.filter(Boolean).join(" · ") : "Custom motion design animation");

          var acts = document.createElement("div");
          acts.className = "cr-cre-actions";
          acts.innerHTML = '<a href="' + editUrl + '" class="pg-bw">Open in Editor</a>'
            + '<button type="button" class="pg-bo cr-cre-share" data-url="' + editUrl + '" title="Copy Link">🔗</button>'
            + '<button type="button" class="pg-bo cr-cre-del" data-id="' + t.id + '" title="Delete Template">🗑️</button>';

          body.appendChild(meta);
          body.appendChild(title);
          body.appendChild(desc);
          body.appendChild(acts);

          card.appendChild(prev);
          card.appendChild(body);
          grid.appendChild(card);
        });

        // Wire delete & share buttons
        grid.querySelectorAll(".cr-cre-del").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var tid = btn.getAttribute("data-id");
            if (!confirm("Are you sure you want to delete this template from your creations?")) return;
            btn.disabled = true;
            fetch("/api/community-templates/" + tid, { method: "DELETE" })
              .then(function () { loadUserCreations(); })
              .catch(function () { btn.disabled = false; });
          });
        });

        grid.querySelectorAll(".cr-cre-share").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var url = location.origin + btn.getAttribute("data-url");
            if (navigator.clipboard) {
              navigator.clipboard.writeText(url).then(function () {
                btn.textContent = "✓";
                setTimeout(function () { btn.textContent = "🔗"; }, 1500);
              });
            }
          });
        });
      })
      .catch(function (err) {
        console.warn("Could not load user creations", err);
      });
  }

  /* ── Upload / Publish Template Modal ───────────────────── */
  function setupUploadModal() {
    var modal = $("#uploadTemplateModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "uploadTemplateModal";
      modal.className = "sh-modal-backdrop";
      modal.setAttribute("hidden", "");
      modal.innerHTML = '<div class="sh-upload-card" role="dialog" aria-labelledby="upModalTitle" aria-modal="true">'
        + '<div class="sh-mhead">'
        + '<div class="sh-mtitle-box">'
        + '<span class="sh-eyebrow">✦ Creator Publishing</span>'
        + '<h3 id="upModalTitle">Upload &amp; Publish Template</h3>'
        + '</div>'
        + '<button type="button" class="sh-mclose" id="closeUploadModalBtn" aria-label="Close modal">✕</button>'
        + '</div>'
        + '<form id="uploadTemplateForm" class="sh-mbody">'
        + '<div class="sh-up-grid">'
        + '<div class="sh-up-form">'
        + '<label class="sh-mlabel">'
        + '<span>Base Animation Motion Preset</span>'
        + '<select id="upTplSelect" class="sh-minput" required></select>'
        + '</label>'
        + '<label class="sh-mlabel">'
        + '<span>Template Title</span>'
        + '<input type="text" id="upTitle" class="sh-minput" placeholder="e.g. Viral Neon Subscriber Surge" required maxlength="60" />'
        + '</label>'
        + '<label class="sh-mlabel">'
        + '<span>Category</span>'
        + '<select id="upCat" class="sh-minput" required>'
        + '<option value="text">Kinetic Text &amp; Hooks</option>'
        + '<option value="docu">Documentary &amp; Retro</option>'
        + '<option value="paper">Paper &amp; Cutout</option>'
        + '<option value="maps">Maps &amp; Radar</option>'
        + '<option value="money">Finance &amp; Economy</option>'
        + '<option value="ui">UI &amp; Devices</option>'
        + '<option value="social">Social Proof &amp; Viral</option>'
        + '<option value="charts">Charts &amp; Infographics</option>'
        + '</select>'
        + '</label>'
        + '<label class="sh-mlabel">'
        + '<span>Description</span>'
        + '<textarea id="upDesc" class="sh-minput" rows="2" placeholder="Briefly describe what this template is best for..."></textarea>'
        + '</label>'
        + '<div class="sh-mlabel">'
        + '<span>Template Text Lines</span>'
        + '<input type="text" id="upLine1" class="sh-minput" placeholder="Line 1 / Hook / Header" style="margin-bottom:6px;" />'
        + '<input type="text" id="upLine2" class="sh-minput" placeholder="Line 2 / Impact Word / Title" style="margin-bottom:6px;" />'
        + '<input type="text" id="upLine3" class="sh-minput" placeholder="Line 3 / Tagline / Footnote" />'
        + '</div>'
        + '<div style="display:flex;gap:12px;align-items:center;margin-top:4px;">'
        + '<label class="sh-mlabel" style="flex:1;">'
        + '<span>Accent Color</span>'
        + '<input type="color" id="upAccent" value="#ffffff" class="sh-mcol" />'
        + '</label>'
        + '<label class="sh-mlabel" style="flex:1;">'
        + '<span>Aspect Ratio</span>'
        + '<select id="upAspect" class="sh-minput">'
        + '<option value="9:16">9:16 Shorts</option>'
        + '<option value="16:9">16:9 YouTube</option>'
        + '<option value="1:1">1:1 Square</option>'
        + '<option value="4:5">4:5 Feed</option>'
        + '</select>'
        + '</label>'
        + '</div>'
        + '</div>'
        + '<div class="sh-up-prev-col">'
        + '<span class="sh-mlabel" style="margin-bottom:6px;display:block;">Live 60 FPS Preview</span>'
        + '<div class="sh-up-preview-stage" id="upPreviewStage">'
        + '<iframe id="upPreviewFrame" sandbox="" scrolling="no" tabindex="-1"></iframe>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<div id="uploadNote" class="sh-mnote"></div>'
        + '<div class="sh-mfoot">'
        + '<button type="button" class="sh-mbtn sh-mcancel" id="cancelUploadBtn">Cancel</button>'
        + '<button type="submit" class="sh-mbtn sh-msave" id="submitUploadBtn">✦ Publish to Community &amp; Library</button>'
        + '</div>'
        + '</form>'
        + '</div>';
      document.body.appendChild(modal);
    }

    var openBtns = all(".sh-tupload-btn, #topbarUploadBtn, #openUploadModalBtn");
    var closeBtn = $("#closeUploadModalBtn");
    var cancelBtn = $("#cancelUploadBtn");
    var form = $("#uploadTemplateForm");
    var tplSelect = $("#upTplSelect");
    var titleInput = $("#upTitle");
    var catSelect = $("#upCat");
    var descInput = $("#upDesc");
    var line1 = $("#upLine1");
    var line2 = $("#upLine2");
    var line3 = $("#upLine3");
    var accentInput = $("#upAccent");
    var aspectSelect = $("#upAspect");
    var prevFrame = $("#upPreviewFrame");
    var note = $("#uploadNote");
    var submitBtn = $("#submitUploadBtn");

    function populateTpls() {
      if (!tplSelect || tplSelect.children.length > 0) return;
      var e = window.SC_TPL2;
      if (e && typeof e.list === "function") {
        e.list().forEach(function (t) {
          var op = document.createElement("option");
          op.value = t.id;
          op.textContent = t.name + " (" + t.cat + ")";
          tplSelect.appendChild(op);
        });
      }
    }

    function updatePreview() {
      if (!prevFrame) return;
      var e = window.SC_TPL2;
      if (!e || typeof e.build !== "function") return;
      var tplId = tplSelect.value || "type-cascade";
      var lines = [line1.value, line2.value, line3.value];
      var aspect = aspectSelect.value || "9:16";
      var accent = accentInput.value || "#ffffff";
      try {
        var html = e.build(tplId, { lines: lines, accent: accent, aspect: aspect });
        prevFrame.srcdoc = html;
        var stage = $("#upPreviewStage");
        if (stage) {
          if (aspect === "16:9") stage.style.aspectRatio = "16/9";
          else if (aspect === "1:1") stage.style.aspectRatio = "1/1";
          else if (aspect === "4:5") stage.style.aspectRatio = "4/5";
          else stage.style.aspectRatio = "9/16";
        }
      } catch (err) {}
    }

    function openModal() {
      if (!currentUser) {
        location.href = "/login?next=" + encodeURIComponent(location.pathname);
        return;
      }
      populateTpls();
      if (!titleInput.value) {
        titleInput.value = "My Viral Motion Graphic";
        line1.value = "THE ULTIMATE";
        line2.value = "SHORT CUT";
        line3.value = "TO 1M VIEWS";
      }
      if (note) note.textContent = "";
      updatePreview();
      show(modal, true);
    }

    function closeModal() {
      show(modal, false);
    }

    openBtns.forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        openModal();
      });
    });

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
    if (cancelBtn) cancelBtn.addEventListener("click", closeModal);

    [tplSelect, line1, line2, line3, accentInput, aspectSelect].forEach(function (el) {
      if (el) el.addEventListener("input", updatePreview);
    });
    if (tplSelect) {
      tplSelect.addEventListener("change", function () {
        var e = window.SC_TPL2;
        if (e && typeof e.list === "function") {
          var t = e.list().find(function (item) { return item.id === tplSelect.value; });
          if (t) {
            if (t.cat && catSelect) catSelect.value = t.cat;
            if (t.demo && t.demo.length) {
              line1.value = t.demo[0] || "";
              line2.value = t.demo[1] || "";
              line3.value = t.demo[2] || "";
            }
          }
        }
        updatePreview();
      });
    }

    if (form) {
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (!currentUser) return;
        submitBtn.disabled = true;
        submitBtn.textContent = "Publishing...";
        note.className = "sh-mnote";
        note.textContent = "Uploading template to library...";

        var payload = {
          tpl: tplSelect.value || "type-cascade",
          title: titleInput.value.trim(),
          category: catSelect.value,
          description: descInput.value.trim(),
          lines: [line1.value.trim(), line2.value.trim(), line3.value.trim()].filter(Boolean),
          accent: accentInput.value,
          aspect: aspectSelect.value,
          dur: 4600
        };

        fetch("/api/community-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            submitBtn.disabled = false;
            submitBtn.textContent = "✦ Publish to Community & Library";
            if (res && res.success) {
              note.className = "sh-mnote";
              note.textContent = "✓ Published successfully to the Template Library & Community!";
              setTimeout(function () {
                closeModal();
                loadUserCreations();
                if (window.SC_SHELL && typeof window.SC_SHELL.refreshGallery === "function") {
                  window.SC_SHELL.refreshGallery();
                }
              }, 1200);
            } else {
              note.className = "sh-mnote error";
              note.textContent = (res && res.error) || "Could not publish template.";
            }
          })
          .catch(function (err) {
            submitBtn.disabled = false;
            submitBtn.textContent = "✦ Publish to Community & Library";
            note.className = "sh-mnote error";
            note.textContent = "Network error. Please try again.";
          });
      });
    }
  }

  function init() {
    all("#logoutBtn, #accLogout").forEach(function (b) {
      b.addEventListener("click", logout);
    });
    fetch("/api/auth/me", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        currentUser = j && j.user;
        paint(currentUser);
        setupEditProfile();
        setupStars();
        setupUploadModal();
      })
      .catch(function () {
        currentUser = null;
        paint(null);
        setupUploadModal();
      });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  window.SC_AUTH = { paint: paint, logout: logout, loadUserCreations: loadUserCreations, setupUploadModal: setupUploadModal };
})();

