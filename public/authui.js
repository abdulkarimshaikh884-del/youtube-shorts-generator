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

  function safeProfileUrl(value, platform) {
    var raw = String(value || "").trim();
    if (!raw) return "";
    if (/^https?:\/\//i.test(raw)) {
      try {
        var url = new URL(raw);
        var host = url.hostname.toLowerCase();
        var valid = platform === "youtube"
          ? (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be")
          : (host === "instagram.com" || host.endsWith(".instagram.com"));
        if (!valid) return "";
        url.protocol = "https:";
        url.username = "";
        url.password = "";
        return url.toString();
      } catch (e) { return ""; }
    }
    if (!/^@?[a-zA-Z0-9._-]{1,100}$/.test(raw)) return "";
    var handle = raw.replace(/^@/, "");
    return platform === "youtube"
      ? "https://youtube.com/@" + handle
      : "https://instagram.com/" + handle;
  }

  function show(el, on) {
    if (on) el.removeAttribute("hidden"); else el.setAttribute("hidden", "");
  }

  function paint(user) {
    all('[data-auth="in"]').forEach(function (el) { show(el, !!user); });
    all('[data-auth="out"]').forEach(function (el) { show(el, !user); });

    var uname = user ? (String(user.email).split("@")[0] || "creator") : "Account";
    var dname = user ? (user.displayName || (uname.charAt(0).toUpperCase() + uname.slice(1))) : "Account";
    var handle = user ? (user.handle || ("@" + uname)) : "@creator";
    var initials = user ? (dname.slice(0, 2).toUpperCase()) : "CR";

    all("[data-auth-email]").forEach(function (el) {
      el.textContent = uname;
      if (user) el.title = user.email;
    });

    all("[data-user-name]").forEach(function (el) {
      el.textContent = dname;
    });

    all("[data-user-handle]").forEach(function (el) {
      el.textContent = handle;
    });

    all("[data-user-email]").forEach(function (el) {
      el.textContent = user ? user.email : "";
    });

    all("[data-user-avatar]").forEach(function (el) {
      el.textContent = initials;
    });

    all("[data-user-plan]").forEach(function (el) {
      el.textContent = "✦ " + ((user && user.plan) || "Free Plan");
    });

    var box = $("#accountBox"), guest = $("#accountGuest");
    if (box && guest) {
      show(box, !!user);
      show(guest, !user);
      if (user) {
        var bio = user.bio || "Designing viral YouTube Shorts, Instagram Reels & AI kinetic typography motion graphics.";

        if ($("#accEmail")) $("#accEmail").textContent = user.email;
        if ($("#accPlan")) $("#accPlan").textContent = user.plan ? (user.plan.charAt(0).toUpperCase() + user.plan.slice(1)) : "Free";
        if ($("#accCredits") && $("#accCredits").textContent.trim() === "—") $("#accCredits").textContent = "8 of 8 left today";
        if ($("#igCreditsCount")) $("#igCreditsCount").textContent = "8";
        if ($("#crDisplayName")) $("#crDisplayName").textContent = dname;
        if ($("#crHandle")) $("#crHandle").textContent = handle;
        if ($("#crAvatarChar")) $("#crAvatarChar").textContent = initials;
        if ($("#pageAvatarPreview")) $("#pageAvatarPreview").textContent = initials;
        if ($("#pageAvatarHandle")) $("#pageAvatarHandle").textContent = handle;
        if ($("#crBio")) $("#crBio").textContent = bio;
        if ($("#crStarsCount")) $("#crStarsCount").textContent = user.stars || 0;

        fetch("/api/credits").then(function(r) { return r.json(); }).then(function(j) {
          if (j && j.success) {
            if ($("#accPlan")) $("#accPlan").textContent = j.planLabel;
            if ($("#accCredits")) $("#accCredits").textContent = j.left + " of " + j.perDay + " left today";
            if ($("#igCreditsCount")) $("#igCreditsCount").textContent = j.left;
          }
        }).catch(function() {});

        // A social link with nothing behind it is worse than no link at all —
        // hide it until the creator has actually filled it in.
        if ($("#crYtLink")) {
          var youtubeUrl = safeProfileUrl(user.youtube, "youtube");
          if (youtubeUrl) {
            $("#crYtLink").href = youtubeUrl;
            $("#crYtLink").hidden = false;
          } else {
            $("#crYtLink").hidden = true;
          }
        }
        if ($("#crIgLink")) {
          var instagramUrl = safeProfileUrl(user.instagram, "instagram");
          if (instagramUrl) {
            $("#crIgLink").href = instagramUrl;
            $("#crIgLink").hidden = false;
          } else {
            $("#crIgLink").hidden = true;
          }
        }

        // Say when a paid plan runs out, or that it never does.
        if ($("#accPlanTerm")) {
          var termEl = $("#accPlanTerm");
          if (!user.plan || user.plan === "free") {
            termEl.textContent = "";
          } else if (user.planLifetime) {
            termEl.textContent = "Lifetime — never expires";
          } else if (user.planUntil) {
            var until = new Date(user.planUntil);
            termEl.textContent = isNaN(until) ? "" : "Renews on " + until.toLocaleDateString();
          } else {
            termEl.textContent = "";
          }
        }

        if ($("#accSince")) {
          var d = new Date(user.createdAt);
          $("#accSince").textContent = isNaN(d) ? "—" : d.toLocaleDateString();
        }

        if ($("#pageDisplayName")) $("#pageDisplayName").value = dname;
        if ($("#pageHandle")) $("#pageHandle").value = handle;
        if ($("#pageBio")) $("#pageBio").value = bio;
        if ($("#pageYoutube")) $("#pageYoutube").value = user.youtube || "";
        if ($("#pageInstagram")) $("#pageInstagram").value = user.instagram || "";

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
    /* /account already has a full-width profile editor in its Edit Profile
       tab. Creating the global settings dialog there gave the same button two
       click handlers: the page switched tabs and then a duplicate modal covered
       it. Keep the dialog for compact settings surfaces only. */
    if ($("#pageEditProfileForm") && $("#igPaneEdit")) return;

    var modal = $("#editProfileModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "editProfileModal";
      modal.className = "sh-modal-backdrop";
      modal.setAttribute("hidden", "");
      modal.innerHTML = '<div class="sh-prof-modal-card" role="dialog" aria-labelledby="editProfTitle" aria-modal="true">'
        + '<div class="sh-prof-head">'
        + '<div class="sh-prof-head-left">'
        + '<div class="sh-prof-avatar" id="editProfAvatar">KA</div>'
        + '<div class="sh-prof-title-box">'
        + '<h3 id="editProfTitle">Creator Profile &amp; Setup</h3>'
        + '<p>Customize your public brand, bio and channel links</p>'
        + '</div>'
        + '</div>'
        + '<button type="button" class="sh-prof-close" id="closeEditProfileBtn" aria-label="Close dialog">'
        + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
        + '</button>'
        + '</div>'
        + '<form id="editProfileForm" class="sh-prof-body">'
        + '<div class="sh-prof-field">'
        + '<label class="sh-prof-label" for="editDisplayName">'
        + '<span>Display Name</span>'
        + '<span style="font-weight:400;text-transform:none;color:#64748b;">Visible on templates</span>'
        + '</label>'
        + '<input type="text" id="editDisplayName" class="sh-prof-input" placeholder="e.g. Karim Abdul" required maxlength="50" />'
        + '</div>'
        + '<div class="sh-prof-field">'
        + '<label class="sh-prof-label" for="editHandle">'
        + '<span>Creator Handle</span>'
        + '<span style="font-weight:400;text-transform:none;color:#64748b;">Unique @username</span>'
        + '</label>'
        + '<input type="text" id="editHandle" class="sh-prof-input" placeholder="e.g. @karim_creates" required maxlength="30" />'
        + '</div>'
        + '<div class="sh-prof-field">'
        + '<label class="sh-prof-label" for="editBio">'
        + '<span>Bio &amp; Style</span>'
        + '<span style="font-weight:400;text-transform:none;color:#64748b;">Short description</span>'
        + '</label>'
        + '<textarea id="editBio" class="sh-prof-input" rows="2" placeholder="Tell other creators about your style and templates..."></textarea>'
        + '</div>'
        + '<div class="sh-prof-row">'
        + '<div class="sh-prof-field">'
        + '<label class="sh-prof-label" for="editYoutube">YouTube Channel</label>'
        + '<div class="sh-prof-input-wrap">'
        + '<svg width="15" height="15" viewBox="0 0 24 24" fill="currentColor"><path d="M23 12s0-3.9-.5-5.8a3 3 0 0 0-2.1-2.1C18.5 3.5 12 3.5 12 3.5s-6.5 0-8.4.6A3 3 0 0 0 1.5 6.2C1 8.1 1 12 1 12s0 3.9.5 5.8a3 3 0 0 0 2.1 2.1c1.9.6 8.4.6 8.4.6s6.5 0 8.4-.6a3 3 0 0 0 2.1-2.1C23 15.9 23 12 23 12ZM9.8 15.5v-7l6 3.5-6 3.5Z"/></svg>'
        + '<input type="text" id="editYoutube" class="sh-prof-input" placeholder="https://youtube.com/@channel" />'
        + '</div>'
        + '</div>'
        + '<div class="sh-prof-field">'
        + '<label class="sh-prof-label" for="editInstagram">Instagram Profile</label>'
        + '<div class="sh-prof-input-wrap">'
        + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>'
        + '<input type="text" id="editInstagram" class="sh-prof-input" placeholder="https://instagram.com/profile" />'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<div id="editProfileNote" class="sh-mnote"></div>'
        + '<div class="sh-prof-foot">'
        + '<button type="button" class="sh-prof-btn-cancel" id="cancelProfileModalBtn">Cancel</button>'
        + '<button type="submit" class="sh-prof-btn-save" id="saveProfileBtn">Save Profile</button>'
        + '</div>'
        + '</form>'
        + '</div>';
      document.body.appendChild(modal);
    }

    var openBtns = all("#openEditProfileBtn, #openEditProfileBtn2");
    var closeBtn = $("#closeEditProfileBtn");
    var cancelBtn = $("#cancelProfileModalBtn");
    var form = $("#editProfileForm");
    var note = $("#editProfileNote");
    var saveBtn = $("#saveProfileBtn");

    function openModal() {
      if (!currentUser) {
        location.href = "/login?next=" + encodeURIComponent(location.pathname);
        return;
      }
      var uname = String(currentUser.email).split("@")[0] || "creator";
      var avEl = $("#editProfAvatar");
      if (avEl) avEl.textContent = ((currentUser.displayName || uname).slice(0, 2)).toUpperCase();
      if ($("#editDisplayName")) $("#editDisplayName").value = currentUser.displayName || uname.charAt(0).toUpperCase() + uname.slice(1);
      if ($("#editHandle")) $("#editHandle").value = currentUser.handle || ("@" + uname);
      if ($("#editBio")) $("#editBio").value = currentUser.bio || "Designing viral YouTube Shorts, Instagram Reels & AI kinetic typography motion graphics.";
      if ($("#editYoutube")) $("#editYoutube").value = currentUser.youtube || "";
      if ($("#editInstagram")) $("#editInstagram").value = currentUser.instagram || "";
      if (note) note.textContent = "";
      show(modal, true);
    }

    function closeModal() {
      show(modal, false);
    }

    /* Escape closes a dialog — people expect it, and without it the only way
       out was to hit the small ✕. Backdrop clicks close it too, but only when
       the press started on the backdrop, so dragging a selection out of a
       field and releasing outside does not throw the form away. */
    modal.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { ev.stopPropagation(); closeModal(); }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !modal.hasAttribute("hidden")) closeModal();
    });
    var backdropDown = false;
    modal.addEventListener("pointerdown", function (ev) { backdropDown = ev.target === modal; });
    modal.addEventListener("click", function (ev) {
      if (ev.target === modal && backdropDown) closeModal();
      backdropDown = false;
    });

    openBtns.forEach(function (btn) {
      btn.addEventListener("click", function (e) {
        e.preventDefault();
        openModal();
      });
    });

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

  function setupPageProfileForm() {
    var form = $("#pageEditProfileForm");
    if (!form) return;

    var cancelBtn = $("#pageCancelProfileBtn");

    function restoreProfileValues() {
      if (!currentUser) return;
      var uname = String(currentUser.email || "creator").split("@")[0] || "creator";
      var dname = currentUser.displayName || (uname.charAt(0).toUpperCase() + uname.slice(1));
      if ($("#pageDisplayName")) $("#pageDisplayName").value = dname;
      if ($("#pageHandle")) $("#pageHandle").value = currentUser.handle || ("@" + uname);
      if ($("#pageBio")) $("#pageBio").value = currentUser.bio || "Designing viral YouTube Shorts, Instagram Reels & AI kinetic typography motion graphics.";
      if ($("#pageYoutube")) $("#pageYoutube").value = currentUser.youtube || "";
      if ($("#pageInstagram")) $("#pageInstagram").value = currentUser.instagram || "";
      if ($("#pageProfileMsg")) $("#pageProfileMsg").textContent = "";
    }

    if (cancelBtn) {
      cancelBtn.addEventListener("click", function () {
        restoreProfileValues();
        if (window.SC_ACCOUNT && SC_ACCOUNT.switchTab) {
          SC_ACCOUNT.switchTab("creations", { updateHash: true });
        }
        var profileTop = $("#accountBox");
        if (profileTop) {
          var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          profileTop.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        }
      });
    }

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      var displayName = $("#pageDisplayName") ? $("#pageDisplayName").value.trim() : "";
      var handle = $("#pageHandle") ? $("#pageHandle").value.trim() : "";
      var bio = $("#pageBio") ? $("#pageBio").value.trim() : "";
      var youtube = $("#pageYoutube") ? $("#pageYoutube").value.trim() : "";
      var instagram = $("#pageInstagram") ? $("#pageInstagram").value.trim() : "";
      var saveBtn = $("#pageSaveProfileBtn");
      var msg = $("#pageProfileMsg");

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.textContent = "Saving…";
      }
      if (msg) msg.textContent = "";

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
        if (msg) {
          msg.style.color = "#10b981";
          msg.textContent = "✓ Profile & links updated successfully!";
        }
        if (window.SC_UI && SC_UI.toast) SC_UI.toast("Profile updated successfully");
      })
      .catch(function (err) {
        if (msg) {
          msg.style.color = "#ef4444";
          msg.textContent = err.message || "Failed to save profile";
        }
      })
      .finally(function () {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.textContent = "Save Profile Changes";
        }
      });
    });
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
    var igCountEl = $("#igCreationsCount");
    if (!grid) return;

    fetch("/api/user/creations")
      .then(function (r) { return r.json(); })
      .then(function (d) {
        var items = (d && d.creations) ? d.creations : [];
        if (countEl) countEl.textContent = items.length + " Template" + (items.length === 1 ? "" : "s");
        if (igCountEl) igCountEl.textContent = items.length;

        if (!items.length) {
          grid.innerHTML = '<div class="cr-cre-empty">' +
            '<h3>No Creations Yet</h3>' +
            '<p>Design viral motion graphics, Instagram Reels &amp; kinetic typography templates in the Studio and share them with the world!</p>' +
            '<a href="/editor" class="ig-btn ig-btn-primary">+ Create Your First Short</a>' +
          '</div>';
          return;
        }

        grid.innerHTML = "";
        var e = window.SC_TPL2;

        items.forEach(function (t) {
          var card = document.createElement("article");
          card.className = "cr-cre-card";

          var editUrl = "/editor?tpl=" + encodeURIComponent(t.tpl || "text-cascade")
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
          var tag = document.createElement("span");
          tag.className = "cr-cre-tag";
          tag.textContent = t.category || "Motion";
          var stats = document.createElement("div");
          stats.className = "cr-cre-stats";
          var likes = document.createElement("span");
          likes.textContent = "❤️ " + (Number(t.likes) || 0);
          var downloads = document.createElement("span");
          downloads.textContent = "📥 " + (Number(t.downloads) || 0);
          stats.appendChild(likes);
          stats.appendChild(downloads);
          meta.appendChild(tag);
          meta.appendChild(stats);

          var title = document.createElement("h3");
          title.className = "cr-cre-title";
          title.textContent = t.title || "Custom Animation";

          var desc = document.createElement("p");
          desc.className = "cr-cre-desc";
          desc.textContent = t.description || (Array.isArray(t.lines) ? t.lines.filter(Boolean).join(" · ") : "Custom motion design animation");

          var acts = document.createElement("div");
          acts.className = "cr-cre-actions";
          acts.innerHTML = '<a href="' + editUrl + '" class="pg-bw">Open in Studio</a>'
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
            if (!tid) return;
            var ask = window.SC_UI && SC_UI.confirm
              ? SC_UI.confirm({
                  title: "Delete this published template?",
                  body: "It will disappear from your creator profile and the Community gallery.",
                  confirmLabel: "Delete",
                  danger: true
                })
              : Promise.resolve(false);
            ask.then(function (yes) {
              if (!yes) return;
              fetch("/api/user/creations/" + encodeURIComponent(tid), { method: "DELETE" })
                .then(function (r) { return r.json(); })
                .then(function (j) {
                  if (j.success) {
                    loadUserCreations();
                    if (window.SC_UI && SC_UI.toast) SC_UI.toast("Creation deleted");
                  }
                })
                .catch(function () {});
            });
          });
        });

        grid.querySelectorAll(".cr-cre-share").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var u = location.origin + btn.getAttribute("data-url");
            if (window.SC_UI && SC_UI.copy) {
              SC_UI.copy(u, "Creation link copied");
            } else if (navigator.clipboard) {
              navigator.clipboard.writeText(u);
            }
          });
        });
      })
      .catch(function () {});
  }

  function setupInstagramTabs() {
    var tabs = all(".ig-tab-btn");
    if (!tabs.length) return;

    var panes = {
      creations: $("#igPaneCreations"),
      saved: $("#igPaneSaved"),
      account: $("#igPaneAccount"),
      edit: $("#igPaneEdit")
    };

    function switchTab(targetName, options) {
      options = options || {};
      if (!panes[targetName]) return;
      tabs.forEach(function (btn) {
        var isTarget = btn.getAttribute("data-ig-tab") === targetName;
        if (isTarget) {
          btn.classList.add("is-active");
          btn.setAttribute("aria-selected", "true");
          btn.setAttribute("tabindex", "0");
        } else {
          btn.classList.remove("is-active");
          btn.setAttribute("aria-selected", "false");
          btn.setAttribute("tabindex", "-1");
        }
      });

      Object.keys(panes).forEach(function (key) {
        var pane = panes[key];
        if (!pane) return;
        if (key === targetName) {
          pane.classList.add("is-active");
          pane.removeAttribute("hidden");
        } else {
          pane.classList.remove("is-active");
          pane.setAttribute("hidden", "");
        }
      });

      if (options.updateHash && window.history && history.replaceState) {
        var nextHash = targetName === "creations" ? "" : "#" + (targetName === "edit" ? "edit-profile" : targetName);
        history.replaceState(null, "", location.pathname + location.search + nextHash);
      }
    }

    tabs.forEach(function (btn, index) {
      btn.addEventListener("click", function () {
        switchTab(btn.getAttribute("data-ig-tab"), { updateHash: true });
      });
      btn.addEventListener("keydown", function (event) {
        var nextIndex = index;
        if (event.key === "ArrowRight") nextIndex = (index + 1) % tabs.length;
        else if (event.key === "ArrowLeft") nextIndex = (index - 1 + tabs.length) % tabs.length;
        else if (event.key === "Home") nextIndex = 0;
        else if (event.key === "End") nextIndex = tabs.length - 1;
        else return;
        event.preventDefault();
        var nextTab = tabs[nextIndex];
        switchTab(nextTab.getAttribute("data-ig-tab"), { updateHash: true });
        nextTab.focus();
      });
    });

    var editBtn = $("#openEditProfileBtn");
    if (editBtn) {
      editBtn.addEventListener("click", function (e) {
        e.preventDefault();
        switchTab("edit", { updateHash: true });
        var editPane = $("#igPaneEdit");
        if (editPane) {
          var reduced = window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
          editPane.scrollIntoView({ behavior: reduced ? "auto" : "smooth", block: "start" });
        }
      });
    }

    var shareBtn = $("#shareProfileBtn");
    if (shareBtn) {
      shareBtn.addEventListener("click", function () {
        var handle = currentUser && currentUser.handle
          ? currentUser.handle.replace(/^@/, "")
          : (currentUser && currentUser.email ? currentUser.email.split("@")[0] : "");
        var url = location.origin + "/creator?handle=" + encodeURIComponent(handle || "shortscraft");
        if (window.SC_UI && SC_UI.copy) SC_UI.copy(url, "Profile link copied");
        else if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(url);
      });
    }

    var requestedTab = location.hash === "#edit-profile" ? "edit" : location.hash.replace(/^#/, "");
    if (panes[requestedTab]) switchTab(requestedTab);

    window.SC_ACCOUNT = window.SC_ACCOUNT || {};
    window.SC_ACCOUNT.switchTab = switchTab;
  }

  /* ── YouTube Studio Style 3-Step Upload & Publish Wizard ────── */
  function setupUploadModal() {
    var modal = $("#uploadTemplateModal");
    if (!modal) {
      modal = document.createElement("div");
      modal.id = "uploadTemplateModal";
      modal.className = "sh-modal-backdrop";
      modal.setAttribute("hidden", "");
      modal.innerHTML = '<div class="yt-modal-card" role="dialog" aria-labelledby="ytModalTitle" aria-modal="true">'
        + '<!-- Header -->'
        + '<div class="yt-modal-head">'
        + '<span class="yt-modal-title" id="ytModalTitle">Upload &amp; Publish Template</span>'
        + '<div class="yt-modal-head-right">'
        + '<span class="yt-save-badge">'
        + '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="2.5" style="vertical-align:-1px;margin-right:4px;"><polyline points="20 6 9 17 4 12"/></svg>'
        + 'Saved as draft'
        + '</span>'
        + '<button type="button" class="yt-close-btn" id="closeYtUploadBtn" aria-label="Close dialog">'
        + '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
        + '</button>'
        + '</div>'
        + '</div>'
        + '<!-- Stepper Bar (YouTube Studio Style) -->'
        + '<div class="yt-stepper">'
        + '<div class="yt-step-node active" id="ytStepNode1" data-step="1">'
        + '<div class="yt-step-circle">1</div>'
        + '<span class="yt-step-text">Details</span>'
        + '</div>'
        + '<div class="yt-step-line" id="ytStepLine1"></div>'
        + '<div class="yt-step-node" id="ytStepNode2" data-step="2">'
        + '<div class="yt-step-circle">2</div>'
        + '<span class="yt-step-text">Video elements</span>'
        + '</div>'
        + '<div class="yt-step-line" id="ytStepLine2"></div>'
        + '<div class="yt-step-node" id="ytStepNode3" data-step="3">'
        + '<div class="yt-step-circle">3</div>'
        + '<span class="yt-step-text">Visibility</span>'
        + '</div>'
        + '</div>'
        + '<!-- Modal Body -->'
        + '<div class="yt-modal-body">'
        + '<!-- Step 1: Upload Dropzone -->'
        + '<div id="ytStepPanel1" class="yt-step-panel">'
        + '<div class="yt-upload-center" id="ytDropzone">'
        + '<div class="yt-upload-icon-wrap">'
        + '<svg viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="1.8" width="32" height="32"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>'
        + '</div>'
        + '<h3 style="margin:0 0 6px;font-size:18px;font-weight:600;color:#F1F1F1;">Drag and drop video template files to upload</h3>'
        + '<p style="margin:0 0 20px;font-size:13px;color:#A1A1AA;">Your templates will be private until you publish them.</p>'
        + '<div style="display:flex;gap:8px;margin-bottom:24px;flex-wrap:wrap;justify-content:center;">'
        + '<span class="yt-fmt-tag"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="2"><polyline points="16 18 22 12 16 6"/><polyline points="8 6 2 12 8 18"/></svg> XML Preset (.xml)</span>'
        + '<span class="yt-fmt-tag"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg> Lottie Motion (.json)</span>'
        + '<span class="yt-fmt-tag"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/></svg> ShortsCraft (.sctemplate)</span>'
        + '<span class="yt-fmt-tag"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg> HTML &amp; CSS (.html)</span>'
        + '</div>'
        + '<button type="button" class="yt-btn yt-btn-primary" id="ytSelectFilesBtn" style="padding:0 24px;height:38px;font-size:13.5px;">Select files</button>'
        + '<input type="file" id="ytFileInput" accept=".xml,.json,.sctemplate,.html,.txt" style="display:none;" />'
        + '</div>'
        + '<div style="margin-top:14px;text-align:center;">'
        + '<span style="font-size:12px;color:#71717A;">Or choose from built-in library: </span>'
        + '<button type="button" class="yt-btn yt-btn-sec" id="ytUsePresetBtn" style="font-size:12px;height:28px;padding:0 12px;margin-left:6px;">Choose 94+ Presets</button>'
        + '</div>'
        + '</div>'
        + '<!-- Step 2: Details & Preview (2-Column YouTube Layout) -->'
        + '<div id="ytStepPanel2" class="yt-step-panel" style="display:none;">'
        + '<div class="yt-2col-layout">'
        + '<div class="yt-form-scroll">'
        + '<div class="yt-field-card">'
        + '<div class="yt-field-head">'
        + '<span class="yt-field-label">Title (required)</span>'
        + '<span class="yt-field-count" id="ytTitleCount">0/60</span>'
        + '</div>'
        + '<input type="text" id="ytInputTitle" class="yt-input-clean" placeholder="Add a title that describes your template" maxlength="60" required />'
        + '</div>'
        + '<div class="yt-field-card">'
        + '<div class="yt-field-head">'
        + '<span class="yt-field-label">Category</span>'
        + '</div>'
        + '<select id="ytInputCat" class="yt-input-clean" style="background:#121212;color:#F1F1F1;cursor:pointer;">'
        + '<option value="text">Kinetic Text &amp; Hooks</option>'
        + '<option value="docu">Documentary &amp; Retro</option>'
        + '<option value="paper">Paper &amp; Cutout</option>'
        + '<option value="maps">Maps &amp; Radar</option>'
        + '<option value="money">Finance &amp; Economy</option>'
        + '<option value="ui">UI &amp; Devices</option>'
        + '<option value="social">Social Proof &amp; Viral</option>'
        + '<option value="charts">Charts &amp; Infographics</option>'
        + '</select>'
        + '</div>'
        + '<div class="yt-field-card">'
        + '<div class="yt-field-head">'
        + '<span class="yt-field-label">Description</span>'
        + '</div>'
        + '<textarea id="ytInputDesc" class="yt-input-clean" rows="2" placeholder="Tell creators what your template is best for..."></textarea>'
        + '</div>'
        + '<div class="yt-field-card">'
        + '<div class="yt-field-head">'
        + '<span class="yt-field-label">Text Lines &amp; Dynamic Hooks</span>'
        + '</div>'
        + '<input type="text" id="ytInputLine1" class="yt-input-clean" placeholder="Line 1 / Hook / Header" style="margin-bottom:8px;" />'
        + '<input type="text" id="ytInputLine2" class="yt-input-clean" placeholder="Line 2 / Headline / Impact Word" style="margin-bottom:8px;" />'
        + '<input type="text" id="ytInputLine3" class="yt-input-clean" placeholder="Line 3 / Tagline / Subtext" />'
        + '</div>'
        + '<div class="yt-field-card">'
        + '<div class="yt-field-head">'
        + '<span class="yt-field-label">Accent Color</span>'
        + '</div>'
        + '<div style="display:flex;align-items:center;gap:12px;">'
        + '<input type="color" id="ytInputAccent" value="#3EA6FF" style="width:36px;height:28px;border:none;background:none;cursor:pointer;" />'
        + '<div style="display:flex;gap:8px;" id="ytPaletteSwatches">'
        + '<span class="swatch" data-col="#3EA6FF" style="width:20px;height:20px;border-radius:50%;background:#3EA6FF;cursor:pointer;"></span>'
        + '<span class="swatch" data-col="#00E5FF" style="width:20px;height:20px;border-radius:50%;background:#00E5FF;cursor:pointer;"></span>'
        + '<span class="swatch" data-col="#FF2A6D" style="width:20px;height:20px;border-radius:50%;background:#FF2A6D;cursor:pointer;"></span>'
        + '<span class="swatch" data-col="#FFD700" style="width:20px;height:20px;border-radius:50%;background:#FFD700;cursor:pointer;"></span>'
        + '<span class="swatch" data-col="#30D158" style="width:20px;height:20px;border-radius:50%;background:#30D158;cursor:pointer;"></span>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<!-- Right Preview Column -->'
        + '<div class="yt-prev-wrapper">'
        + '<div style="display:flex;justify-content:space-between;align-items:center;">'
        + '<span style="font-size:12px;font-weight:600;color:#F1F1F1;">Video Preview</span>'
        + '<select id="ytInputAspect" style="background:#121212;border:1px solid #333333;border-radius:6px;color:#F1F1F1;font-size:11.5px;padding:2px 8px;cursor:pointer;">'
        + '<option value="9:16">9:16 Shorts</option>'
        + '<option value="16:9">16:9 YouTube</option>'
        + '<option value="1:1">1:1 Square</option>'
        + '<option value="4:5">4:5 Feed</option>'
        + '</select>'
        + '</div>'
        + '<div class="yt-prev-box" id="ytPreviewStage">'
        + '<iframe id="ytPreviewFrame" sandbox="allow-same-origin" scrolling="no" tabindex="-1"></iframe>'
        + '</div>'
        + '<div class="yt-meta-card">'
        + '<div class="yt-meta-row"><span>Format</span><b id="ytMetaFormat">Alight Motion XML</b></div>'
        + '<div class="yt-meta-row"><span>Filename</span><b id="ytMetaFilename">preset_motion.xml</b></div>'
        + '<div class="yt-meta-row"><span>Quality</span><b>60 FPS Vector Motion</b></div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<!-- Step 3: Visibility & Publish -->'
        + '<div id="ytStepPanel3" class="yt-step-panel" style="display:none;">'
        + '<div class="yt-vis-container">'
        + '<h3 style="margin:0 0 4px;font-size:17px;font-weight:600;color:#F1F1F1;">Visibility</h3>'
        + '<p style="margin:0 0 16px;font-size:12.5px;color:#A1A1AA;">Choose when to publish and who can see your video template</p>'
        + '<label class="yt-vis-option selected" id="ytOptPublic">'
        + '<input type="radio" name="ytVisibility" value="public" checked class="yt-vis-radio" />'
        + '<div class="yt-vis-info">'
        + '<b>'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="2"><circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/></svg>'
        + 'Public'
        + '</b>'
        + '<p>Everyone can browse, preview, and create videos with your template in the community library.</p>'
        + '</div>'
        + '</label>'
        + '<label class="yt-vis-option" id="ytOptPrivate">'
        + '<input type="radio" name="ytVisibility" value="private" class="yt-vis-radio" />'
        + '<div class="yt-vis-info">'
        + '<b>'
        + '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>'
        + 'Private'
        + '</b>'
        + '<p>Only you can view and edit this template from your account dashboard and projects.</p>'
        + '</div>'
        + '</label>'
        + '<div style="display:flex;gap:12px;margin-top:14px;">'
        + '<button type="button" class="yt-btn yt-btn-sec" id="ytOpenInStudioBtn" style="flex:1;height:40px;">'
        + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg>'
        + 'Open in Studio Editor'
        + '</button>'
        + '<button type="button" class="yt-btn yt-btn-sec" id="ytDownloadJsonBtn" style="flex:1;height:40px;">'
        + '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>'
        + 'Export .sctemplate'
        + '</button>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '</div>'
        + '<!-- Footer -->'
        + '<div class="yt-modal-footer">'
        + '<div class="yt-foot-status">'
        + '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A1A1AA" stroke-width="2"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 14 14"/></svg>'
        + '<span id="ytFootStatus">Saved as draft</span>'
        + '</div>'
        + '<div class="yt-foot-btns">'
        + '<button type="button" class="yt-btn yt-btn-sec" id="ytBtnBack" style="display:none;">Back</button>'
        + '<button type="button" class="yt-btn yt-btn-primary" id="ytBtnNext">Next</button>'
        + '<button type="button" class="yt-btn yt-btn-primary" id="ytBtnPublish" style="display:none;">Save</button>'
        + '</div>'
        + '</div>'
        + '</div>';
      document.body.appendChild(modal);
    }

    var currentStep = 1;
    var customParsedSpec = null;

    var openBtns = all(".sh-tupload-btn, #topbarUploadBtn, #openUploadModalBtn, #popoverUploadBtn, .js-open-upload");
    var closeBtn = $("#closeYtUploadBtn");
    var stepNode1 = $("#ytStepNode1");
    var stepNode2 = $("#ytStepNode2");
    var stepNode3 = $("#ytStepNode3");
    var stepLine1 = $("#ytStepLine1");
    var stepLine2 = $("#ytStepLine2");
    var panel1 = $("#ytStepPanel1");
    var panel2 = $("#ytStepPanel2");
    var panel3 = $("#ytStepPanel3");
    var btnBack = $("#ytBtnBack");
    var btnNext = $("#ytBtnNext");
    var btnPublish = $("#ytBtnPublish");
    var footStatus = $("#ytFootStatus");
    var modalTitle = $("#ytModalTitle");

    var dropzone = $("#ytDropzone");
    var fileInput = $("#ytFileInput");
    var selectFilesBtn = $("#ytSelectFilesBtn");
    var usePresetBtn = $("#ytUsePresetBtn");

    var inputTitle = $("#ytInputTitle");
    var titleCount = $("#ytTitleCount");
    var inputCat = $("#ytInputCat");
    var inputDesc = $("#ytInputDesc");
    var inputLine1 = $("#ytInputLine1");
    var inputLine2 = $("#ytInputLine2");
    var inputLine3 = $("#ytInputLine3");
    var inputAccent = $("#ytInputAccent");
    var inputAspect = $("#ytInputAspect");
    var prevFrame = $("#ytPreviewFrame");
    var metaFormat = $("#ytMetaFormat");
    var metaFilename = $("#ytMetaFilename");

    var openInStudioBtn = $("#ytOpenInStudioBtn");
    var downloadJsonBtn = $("#ytDownloadJsonBtn");

    // Stepper navigation helper
    function setStep(step) {
      currentStep = step;
      if (panel1) panel1.style.display = (step === 1) ? "block" : "none";
      if (panel2) panel2.style.display = (step === 2) ? "block" : "none";
      if (panel3) panel3.style.display = (step === 3) ? "block" : "none";

      var checkSvg = '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="#3EA6FF" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>';

      if (stepNode1) {
        stepNode1.className = "yt-step-node " + (step === 1 ? "active" : "completed");
        var c1 = stepNode1.querySelector(".yt-step-circle");
        if (c1) c1.innerHTML = (step > 1) ? checkSvg : "1";
      }
      if (stepLine1) {
        stepLine1.className = "yt-step-line " + (step >= 2 ? "filled" : "");
      }
      if (stepNode2) {
        stepNode2.className = "yt-step-node " + (step === 2 ? "active" : (step > 2 ? "completed" : ""));
        var c2 = stepNode2.querySelector(".yt-step-circle");
        if (c2) c2.innerHTML = (step > 2) ? checkSvg : "2";
      }
      if (stepLine2) {
        stepLine2.className = "yt-step-line " + (step >= 3 ? "filled" : "");
      }
      if (stepNode3) {
        stepNode3.className = "yt-step-node " + (step === 3 ? "active" : "");
      }

      if (btnBack) btnBack.style.display = (step > 1) ? "inline-block" : "none";
      if (btnNext) btnNext.style.display = (step < 3) ? "inline-block" : "none";
      if (btnPublish) btnPublish.style.display = (step === 3) ? "inline-block" : "none";

      if (step === 2 || step === 3) {
        updatePreview();
      }
    }

    [stepNode1, stepNode2, stepNode3].forEach(function (node, idx) {
      if (node) {
        node.addEventListener("click", function () {
          setStep(idx + 1);
        });
      }
    });

    if (btnNext) {
      btnNext.addEventListener("click", function () {
        if (currentStep < 3) setStep(currentStep + 1);
      });
    }
    if (btnBack) {
      btnBack.addEventListener("click", function () {
        if (currentStep > 1) setStep(currentStep - 1);
      });
    }

    // Radio options styling
    var optPublic = $("#ytOptPublic");
    var optPrivate = $("#ytOptPrivate");
    if (optPublic && optPrivate) {
      optPublic.addEventListener("click", function () {
        optPublic.classList.add("selected");
        optPrivate.classList.remove("selected");
      });
      optPrivate.addEventListener("click", function () {
        optPrivate.classList.add("selected");
        optPublic.classList.remove("selected");
      });
    }

    // Palette swatches
    all("#ytPaletteSwatches .swatch").forEach(function (sw) {
      sw.addEventListener("click", function () {
        var col = sw.getAttribute("data-col");
        if (col && inputAccent) {
          inputAccent.value = col;
          updatePreview();
        }
      });
    });

    function generateCustomHtml(title, lines, accent, dur, aspect) {
      var l1 = (lines[0] || title || "HOOK TEXT").replace(/</g, "&lt;");
      var l2 = (lines[1] || "VIRAL HEADLINE").replace(/</g, "&lt;");
      var l3 = (lines[2] || "@shortscraft.online").replace(/</g, "&lt;");
      return '<!doctype html><html><head><meta charset="utf-8"/><style>'
        + '*{box-sizing:border-box;margin:0;padding:0;}'
        + 'body,html{width:100%;height:100%;background:#09090e;font-family:system-ui,-apple-system,sans-serif;color:#fff;display:flex;align-items:center;justify-content:center;overflow:hidden;}'
        + '.sc-box{position:relative;width:86%;padding:28px 22px;background:rgba(20,20,32,0.85);border:1px solid rgba(255,255,255,0.16);border-radius:20px;box-shadow:0 20px 50px rgba(0,0,0,0.8),0 0 30px ' + accent + '33;text-align:center;animation:scPop 0.7s cubic-bezier(0.16,1,0.3,1) both;}'
        + '@keyframes scPop{0%{transform:scale(0.85) translateY(20px);opacity:0}100%{transform:scale(1) translateY(0);opacity:1}}'
        + '.sc-badge{display:inline-block;padding:4px 12px;border-radius:999px;background:' + accent + '22;border:1px solid ' + accent + '66;color:' + accent + ';font-size:12px;font-weight:750;letter-spacing:0.06em;text-transform:uppercase;margin-bottom:14px;animation:scGlow 2s ease-in-out infinite;}'
        + '@keyframes scGlow{0%,100%{box-shadow:0 0 10px ' + accent + '44}50%{box-shadow:0 0 22px ' + accent + '99}}'
        + '.sc-title{font-size:26px;font-weight:800;line-height:1.2;color:#fff;margin-bottom:12px;background:linear-gradient(180deg,#fff 0%,' + accent + ' 100%);-webkit-background-clip:text;-webkit-text-fill-color:transparent;}'
        + '.sc-sub{font-size:13px;color:#a0a0b8;font-weight:550;letter-spacing:0.02em;}'
        + '</style></head><body>'
        + '<div class="sc-box">'
        + '<div class="sc-badge">' + l1 + '</div>'
        + '<h1 class="sc-title">' + l2 + '</h1>'
        + '<p class="sc-sub">' + l3 + '</p>'
        + '</div></body></html>';
    }

    function updatePreview() {
      if (!prevFrame) return;
      var aspect = (inputAspect && inputAspect.value) || "9:16";
      var accent = (inputAccent && inputAccent.value) || "#00e5ff";
      var lines = [inputLine1 ? inputLine1.value : "", inputLine2 ? inputLine2.value : "", inputLine3 ? inputLine3.value : ""];
      var title = (inputTitle && inputTitle.value) || "Custom Template";

      var stage = $("#ytPreviewStage");
      if (stage) {
        if (aspect === "16:9") stage.style.aspectRatio = "16/9";
        else if (aspect === "1:1") stage.style.aspectRatio = "1/1";
        else if (aspect === "4:5") stage.style.aspectRatio = "4/5";
        else stage.style.aspectRatio = "9/16";
      }

      if (customParsedSpec && customParsedSpec.html) {
        prevFrame.srcdoc = customParsedSpec.html;
      } else {
        prevFrame.srcdoc = generateCustomHtml(title, lines, accent, 4600, aspect);
      }

      if (modalTitle && title) {
        modalTitle.textContent = title;
      }
      if (titleCount && inputTitle) {
        titleCount.textContent = (inputTitle.value.length || 0) + "/60";
      }
    }

    function handleFile(file) {
      if (!file) return;
      var reader = new FileReader();
      var fname = file.name.toLowerCase();

      reader.onload = function (e) {
        var content = e.target.result;
        try {
          if (fname.endsWith(".xml")) {
            var parser = new DOMParser();
            var doc = parser.parseFromString(content, "text/xml");
            var isErr = doc.querySelector("parsererror");
            if (isErr) throw new Error("Invalid XML file structure");

            var texts = [];
            doc.querySelectorAll("text, string, name, title, item, label, property[name*='text']").forEach(function (el) {
              var txt = (el.textContent || "").trim();
              if (txt && txt.length < 80 && !texts.includes(txt)) texts.push(txt);
            });

            var hexMatch = content.match(/#(?:[0-9a-fA-F]{6})\b/);
            var color = hexMatch ? hexMatch[0] : "#00e5ff";
            var title = file.name.replace(/\.[^/.]+$/, "");

            if (inputTitle) inputTitle.value = title;
            if (inputCat) inputCat.value = "text";
            if (inputDesc) inputDesc.value = "Alight Motion XML preset with kinetic text layers and transitions.";
            if (texts[0] && inputLine1) inputLine1.value = texts[0];
            if (texts[1] && inputLine2) inputLine2.value = texts[1];
            if (texts[2] && inputLine3) inputLine3.value = texts[2];
            if (inputAccent) inputAccent.value = color;

            if (metaFormat) metaFormat.textContent = "Alight Motion XML";
            if (metaFilename) metaFilename.textContent = file.name;

            customParsedSpec = {
              type: "xml",
              html: generateCustomHtml(title, [inputLine1.value, inputLine2.value, inputLine3.value], color, 4600, inputAspect.value),
              raw: content
            };

            if (footStatus) footStatus.textContent = "XML preset loaded: " + file.name + " (" + texts.length + " layers)";
          } else if (fname.endsWith(".json") || fname.endsWith(".sctemplate")) {
            var data = JSON.parse(content);
            if (data.v !== undefined || data.layers !== undefined) {
              var ltTitle = data.nm || file.name.replace(/\.[^/.]+$/, "");
              if (inputTitle) inputTitle.value = ltTitle;
              if (inputCat) inputCat.value = "ui";
              if (inputDesc) inputDesc.value = "After Effects Lottie motion graphics animation preset.";
              if (inputAccent) inputAccent.value = "#3EA6FF";

              if (metaFormat) metaFormat.textContent = "Lottie Motion JSON";
              if (metaFilename) metaFilename.textContent = file.name;

              customParsedSpec = {
                type: "lottie",
                html: generateCustomHtml(ltTitle, [inputLine1.value || "LOTTIE MOTION", inputLine2.value || ltTitle, inputLine3.value || "Vector Animation"], "#3EA6FF", 4600, inputAspect.value),
                raw: data
              };
              if (footStatus) footStatus.textContent = "Lottie JSON loaded: " + file.name;
            } else {
              var scTitle = data.name || data.title || file.name.replace(/\.[^/.]+$/, "");
              if (inputTitle) inputTitle.value = scTitle;
              if (data.cat && inputCat) inputCat.value = data.cat;
              if (data.desc && inputDesc) inputDesc.value = data.desc;
              if (data.lines && data.lines[0] && inputLine1) inputLine1.value = data.lines[0];
              if (data.lines && data.lines[1] && inputLine2) inputLine2.value = data.lines[1];
              if (data.lines && data.lines[2] && inputLine3) inputLine3.value = data.lines[2];
              if (data.accent && inputAccent) inputAccent.value = data.accent;

              if (metaFormat) metaFormat.textContent = "ShortsCraft Spec";
              if (metaFilename) metaFilename.textContent = file.name;

              customParsedSpec = {
                type: "sctemplate",
                html: generateCustomHtml(scTitle, [inputLine1.value, inputLine2.value, inputLine3.value], data.accent || "#3EA6FF", 4600, inputAspect.value),
                raw: data
              };
              if (footStatus) footStatus.textContent = "ShortsCraft template loaded: " + file.name;
            }
          } else if (fname.endsWith(".html")) {
            var htTitle = file.name.replace(/\.[^/.]+$/, "");
            if (inputTitle) inputTitle.value = htTitle;
            if (metaFormat) metaFormat.textContent = "HTML & CSS Keyframes";
            if (metaFilename) metaFilename.textContent = file.name;

            customParsedSpec = {
              type: "html",
              html: content,
              raw: content
            };
            if (footStatus) footStatus.textContent = "HTML/CSS animation loaded: " + file.name;
          }

          // Advance to Step 2 smoothly
          setStep(2);
        } catch (err) {
          if (footStatus) footStatus.textContent = "Error parsing file: " + (err.message || "Invalid format");
        }
      };

      reader.readAsText(file);
    }

    // Drag & Drop
    if (dropzone) {
      dropzone.addEventListener("click", function () {
        if (fileInput) fileInput.click();
      });
      dropzone.addEventListener("dragover", function (ev) {
        ev.preventDefault();
        dropzone.classList.add("dragover");
      });
      dropzone.addEventListener("dragleave", function () {
        dropzone.classList.remove("dragover");
      });
      dropzone.addEventListener("drop", function (ev) {
        ev.preventDefault();
        dropzone.classList.remove("dragover");
        if (ev.dataTransfer.files && ev.dataTransfer.files[0]) {
          handleFile(ev.dataTransfer.files[0]);
        }
      });
    }

    if (selectFilesBtn) {
      selectFilesBtn.addEventListener("click", function (ev) {
        ev.stopPropagation();
        if (fileInput) fileInput.click();
      });
    }

    if (fileInput) {
      fileInput.addEventListener("change", function () {
        if (fileInput.files && fileInput.files[0]) {
          handleFile(fileInput.files[0]);
        }
      });
    }

    if (usePresetBtn) {
      usePresetBtn.addEventListener("click", function () {
        if (inputTitle) inputTitle.value = "Kinetic Neon Headline";
        if (inputLine1) inputLine1.value = "TOP 3 HABITS";
        if (inputLine2) inputLine2.value = "OF MILLIONAIRES";
        if (inputLine3) inputLine3.value = "shortscraft.online";
        if (metaFormat) metaFormat.textContent = "Built-in Motion Preset";
        if (metaFilename) metaFilename.textContent = "kinetic_neon.sctemplate";
        setStep(2);
      });
    }

    [inputTitle, inputCat, inputDesc, inputLine1, inputLine2, inputLine3, inputAccent, inputAspect].forEach(function (el) {
      if (el) el.addEventListener("input", updatePreview);
    });

    if (openInStudioBtn) {
      openInStudioBtn.addEventListener("click", function () {
        var lines = encodeURIComponent(JSON.stringify([inputLine1.value, inputLine2.value, inputLine3.value].filter(Boolean)));
        var accent = encodeURIComponent(inputAccent.value || "#3EA6FF");
        var aspect = encodeURIComponent(inputAspect.value || "9:16");
        location.href = "/editor?lines=" + lines + "&accent=" + accent + "&aspect=" + aspect;
      });
    }

    if (downloadJsonBtn) {
      downloadJsonBtn.addEventListener("click", function () {
        var tplSpec = {
          name: inputTitle.value.trim() || "Custom Preset",
          category: inputCat.value,
          description: inputDesc.value.trim(),
          lines: [inputLine1.value.trim(), inputLine2.value.trim(), inputLine3.value.trim()].filter(Boolean),
          accent: inputAccent.value,
          aspect: inputAspect.value,
          dur: 4600
        };
        var blob = new Blob([JSON.stringify(tplSpec, null, 2)], { type: "application/json" });
        var url = URL.createObjectURL(blob);
        var a = document.createElement("a");
        a.href = url;
        a.download = (inputTitle.value.trim() || "template").replace(/\s+/g, "_").toLowerCase() + ".sctemplate";
        a.click();
        URL.revokeObjectURL(url);
      });
    }

    // Publish action
    if (btnPublish) {
      btnPublish.addEventListener("click", function () {
        if (!currentUser) {
          location.href = "/login?next=" + encodeURIComponent(location.pathname);
          return;
        }

        btnPublish.disabled = true;
        btnPublish.textContent = "Saving...";
        if (footStatus) footStatus.textContent = "Saving template...";

        var payload = {
          tpl: "text-cascade",
          title: inputTitle.value.trim() || "Custom Template",
          category: inputCat.value,
          description: inputDesc.value.trim(),
          lines: [inputLine1.value.trim(), inputLine2.value.trim(), inputLine3.value.trim()].filter(Boolean),
          accent: inputAccent.value,
          aspect: inputAspect.value,
          dur: 4600
        };

        fetch("/api/community-templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        })
          .then(function (r) { return r.json(); })
          .then(function (res) {
            btnPublish.disabled = false;
            btnPublish.textContent = "Save";
            if (res && res.success) {
              if (footStatus) footStatus.textContent = "Published successfully to library.";
              setTimeout(function () {
                closeModal();
                loadUserCreations();
                if (window.SC_SHELL && typeof window.SC_SHELL.refreshGallery === "function") {
                  window.SC_SHELL.refreshGallery();
                }
              }, 1000);
            } else {
              if (footStatus) footStatus.textContent = (res && res.error) || "Could not publish template.";
            }
          })
          .catch(function (err) {
            btnPublish.disabled = false;
            btnPublish.textContent = "Save";
            if (footStatus) footStatus.textContent = "Network error. Please try again.";
          });
      });
    }

    function openModal() {
      if (!currentUser) {
        if (window.SC_UI && typeof window.SC_UI.confirm === "function") {
          SC_UI.confirm({
            title: "Log in to Upload & Publish",
            body: "You must be signed in with an account to upload and publish templates to the Community Gallery. Accounts are free and include daily credits!",
            confirmLabel: "Log In / Sign Up",
            cancelLabel: "Maybe later"
          }).then(function (yes) {
            if (yes) {
              location.href = "/login?next=" + encodeURIComponent(location.pathname);
            }
          });
        } else {
          location.href = "/login?next=" + encodeURIComponent(location.pathname);
        }
        return;
      }

      if (!inputTitle.value) {
        inputTitle.value = "Kinetic Hook Highlight";
        inputLine1.value = "FIRST 3 SECONDS";
        inputLine2.value = "DON'T SCROLL AWAY";
        inputLine3.value = "shortscraft.online";
      }
      setStep(1);
      show(modal, true);
    }

    function closeModal() {
      show(modal, false);
    }

    modal.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape") { ev.stopPropagation(); closeModal(); }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !modal.hasAttribute("hidden")) closeModal();
    });
    var backdropDown = false;
    modal.addEventListener("pointerdown", function (ev) { backdropDown = ev.target === modal; });
    modal.addEventListener("click", function (ev) {
      if (ev.target === modal && backdropDown) closeModal();
      backdropDown = false;
    });

    openBtns.forEach(function (b) {
      b.addEventListener("click", function (e) {
        e.preventDefault();
        openModal();
      });
    });

    if (closeBtn) closeBtn.addEventListener("click", closeModal);
  }

  function setupUserTrigger() {
    var trigger = $("#sidebarUserTrigger");
    if (!trigger) return;
    var wrap = trigger.closest(".sh-user-trigger-wrap");
    if (!wrap) return;

    trigger.addEventListener("click", function (ev) {
      ev.stopPropagation();
      var active = wrap.classList.toggle("active");
      trigger.setAttribute("aria-expanded", active ? "true" : "false");
    });

    document.addEventListener("click", function (ev) {
      if (!wrap.contains(ev.target)) {
        wrap.classList.remove("active");
        trigger.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* The desktop rail carries workspace destinations that used to disappear
     completely when the rail collapsed on a phone. Add the same destinations
     to the shared mobile drawer once, before auth state is painted. */
  function completeMobileNav() {
    var menu = $("#navMobile");
    if (!menu || menu.dataset.workspaceReady === "1") return;
    menu.dataset.workspaceReady = "1";

    var editorLink = menu.querySelector('a[href="/editor"]');
    var ref = editorLink ? editorLink.nextSibling : menu.firstChild;
    [
      { href: "/drafts", label: "My Projects" },
      { href: "/uploads", label: "My Uploads", auth: true },
      { href: "/settings", label: "Settings", auth: true },
      { href: "/tutorials", label: "Tutorials & Help" }
    ].forEach(function (item) {
      if (menu.querySelector('a[href="' + item.href + '"]')) return;
      var link = document.createElement("a");
      link.href = item.href;
      link.className = "sh-mobile-workspace-link";
      link.textContent = item.label;
      if (item.auth) {
        link.setAttribute("data-auth", "in");
        link.hidden = true;
      }
      menu.insertBefore(link, ref);
    });
  }

  function init() {
    completeMobileNav();
    all("#logoutBtn, #accLogout, #accLogoutPane, #popoverLogoutBtn, #navMobileLogout").forEach(function (b) {
      b.addEventListener("click", logout);
    });
    setupUserTrigger();
    setupInstagramTabs();
    fetch("/api/auth/me", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        currentUser = j && j.user;
        paint(currentUser);
        setupEditProfile();
        setupPageProfileForm();
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


/* ============================================================
   SC_UI — in-page confirm / prompt / toast.

   window.confirm and window.prompt block the page, cannot be styled, and
   render as raw OS chrome in the middle of an otherwise designed product.
   Everything that used them now calls these instead. Promise-based so the
   call sites read the same way the native ones did.
   ============================================================ */
(function () {
  "use strict";

  var openDlg = null;

  function build(opts) {
    var back = document.createElement("div");
    back.className = "sc-dlg-back";
    back.setAttribute("role", "dialog");
    back.setAttribute("aria-modal", "true");

    var box = document.createElement("div");
    box.className = "sc-dlg";

    var h = document.createElement("h3");
    h.textContent = opts.title || "Are you sure?";
    box.appendChild(h);
    back.setAttribute("aria-label", h.textContent);

    if (opts.body) {
      var pEl = document.createElement("p");
      pEl.textContent = opts.body;
      box.appendChild(pEl);
    }

    var input = null;
    if (opts.kind === "prompt") {
      var lb = document.createElement("label");
      lb.textContent = opts.label || "Value";
      lb.htmlFor = "scDlgInput";
      box.appendChild(lb);
      input = document.createElement("input");
      input.type = "text";
      input.id = "scDlgInput";
      input.value = opts.value == null ? "" : String(opts.value);
      input.placeholder = opts.placeholder || "";
      if (opts.maxLength) input.maxLength = opts.maxLength;
      box.appendChild(input);
    }

    var row = document.createElement("div");
    row.className = "sc-dlg-row";
    var cancel = document.createElement("button");
    cancel.type = "button";
    cancel.className = "sc-dlg-btn sc-dlg-cancel";
    cancel.textContent = opts.cancelLabel || "Cancel";
    var ok = document.createElement("button");
    ok.type = "button";
    ok.className = "sc-dlg-btn sc-dlg-ok" + (opts.danger ? " danger" : "");
    ok.textContent = opts.confirmLabel || "Confirm";
    row.appendChild(cancel);
    row.appendChild(ok);
    box.appendChild(row);
    back.appendChild(box);

    return { back: back, ok: ok, cancel: cancel, input: input };
  }

  function open(opts) {
    // Only one at a time: a second call closes the first rather than stacking.
    if (openDlg) openDlg();

    return new Promise(function (resolve) {
      var el = build(opts);
      var lastFocus = document.activeElement;
      var done = false;

      function close(result) {
        if (done) return;
        done = true;
        openDlg = null;
        document.removeEventListener("keydown", onKey, true);
        if (el.back.parentNode) el.back.parentNode.removeChild(el.back);
        try { if (lastFocus && lastFocus.focus) lastFocus.focus(); } catch (e) {}
        resolve(result);
      }
      openDlg = function () { close(opts.kind === "prompt" ? null : false); };

      function onKey(ev) {
        if (ev.key === "Escape") {
          ev.preventDefault();
          close(opts.kind === "prompt" ? null : false);
          return;
        }
        if (ev.key === "Enter" && opts.kind === "prompt" && ev.target === el.input) {
          ev.preventDefault();
          el.ok.click();
          return;
        }
        // keep focus inside the dialog while it is open
        if (ev.key === "Tab") {
          var f = el.back.querySelectorAll("button, input");
          if (!f.length) return;
          var first = f[0], last = f[f.length - 1];
          if (ev.shiftKey && document.activeElement === first) { ev.preventDefault(); last.focus(); }
          else if (!ev.shiftKey && document.activeElement === last) { ev.preventDefault(); first.focus(); }
        }
      }

      el.ok.addEventListener("click", function () {
        if (opts.kind === "prompt") {
          var v = el.input.value.trim();
          if (opts.required !== false && !v) { el.input.focus(); return; }
          close(v);
        } else {
          close(true);
        }
      });
      el.cancel.addEventListener("click", function () {
        close(opts.kind === "prompt" ? null : false);
      });
      el.back.addEventListener("mousedown", function (ev) {
        if (ev.target === el.back) close(opts.kind === "prompt" ? null : false);
      });
      document.addEventListener("keydown", onKey, true);

      document.body.appendChild(el.back);
      if (el.input) { el.input.focus(); el.input.select(); }
      else el.ok.focus();
    });
  }

  function confirmDlg(opts) {
    return open(Object.assign({ kind: "confirm", confirmLabel: "Confirm" }, opts || {}));
  }
  function promptDlg(opts) {
    return open(Object.assign({ kind: "prompt", confirmLabel: "Save" }, opts || {}));
  }

  var toastWrap = null;
  function toast(msg, bad, ms) {
    if (!msg) return;
    if (!toastWrap) {
      toastWrap = document.createElement("div");
      toastWrap.className = "sc-toast-wrap";
      toastWrap.setAttribute("role", "status");
      toastWrap.setAttribute("aria-live", "polite");
      document.body.appendChild(toastWrap);
    }
    var t = document.createElement("div");
    t.className = "sc-toast" + (bad ? " bad" : "");
    t.textContent = msg;
    toastWrap.appendChild(t);
    setTimeout(function () {
      t.className += " out";
      setTimeout(function () { if (t.parentNode) t.parentNode.removeChild(t); }, 260);
    }, ms || 2600);
  }

  /* Copy helper: the clipboard API is unavailable on insecure origins and in
     some in-app browsers. Falls back to execCommand, then to showing the text
     so the value is never simply lost. */
  function copy(text, okMsg) {
    function fallback() {
      try {
        var ta = document.createElement("textarea");
        ta.value = text;
        ta.setAttribute("readonly", "");
        ta.style.cssText = "position:fixed;top:-1000px;opacity:0";
        document.body.appendChild(ta);
        ta.select();
        var done = document.execCommand("copy");
        document.body.removeChild(ta);
        if (done) { toast(okMsg || "Copied"); return; }
      } catch (e) {}
      promptDlg({
        title: "Copy this link",
        body: "Your browser blocked the clipboard. Select the text and copy it.",
        label: "Link", value: text, confirmLabel: "Done", required: false
      });
    }
    if (navigator.clipboard && navigator.clipboard.writeText) {
      navigator.clipboard.writeText(text).then(function () { toast(okMsg || "Copied"); }, fallback);
    } else fallback();
  }

  window.SC_UI = { confirm: confirmDlg, prompt: promptDlg, toast: toast, copy: copy };
})();
