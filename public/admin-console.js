(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  var all = function (s) {
    if (typeof s === "string") return Array.prototype.slice.call(document.querySelectorAll(s));
    if (s && s.length !== undefined) return Array.prototype.slice.call(s);
    return [];
  };
  var currentUser = null;
  var activeTicketId = null;
  var PERMISSIONS = [];
  var ROLE_PRESETS = {};
  var loaded = {};
  var allowedTabs = [];
  var activeTab = null;
  var pendingReads = {};
  var readGeneration = {};
  var loadGeneration = {};
  var modalsContainer = $("#adminModalsContainer");
  var modalPageOverflow = null;
  var modalPreviewCleanup = null;

  function readSection(path) {
    if (/^\/api\/support\/tickets\//.test(path)) return "support";
    return ({
      dashboard: "overview",
      users: "users",
      creators: "creators",
      templates: "content",
      "design-templates": "content",
      "animation-templates": "content",
      skills: "skills",
      reports: "reports",
      withdrawals: "withdrawals",
      stars: "stars_ledger",
      "star-packs": "star_packs",
      "ai-jobs": "ai_jobs",
      staff: "team",
      support: "support",
      "feature-flags": "system",
      "audit-logs": "system"
    })[path.split("/")[3]] || null;
  }

  function api(url, options) {
    options = options || {};
    var read = !options.method || options.method === "GET";
    var path = url.split("?")[0];
    var key = /^\/api\/support\/tickets\//.test(path) ? "ticket-thread" : path;
    var generation = read ? (readGeneration[key] || 0) + 1 : 0;
    var controller = new AbortController();
    if (read) {
      readGeneration[key] = generation;
      if (pendingReads[key]) pendingReads[key].controller.abort();
      pendingReads[key] = { controller: controller, section: readSection(path) };
    }
    var timedOut = false;
    var timer = setTimeout(function () { timedOut = true; controller.abort(); }, 20000);
    return fetch(url, Object.assign({ credentials: "same-origin", cache: "no-store" }, options, { signal: controller.signal })).then(function (r) {
      return r.json().then(function (j) {
        if (read && readGeneration[key] !== generation) { var stale = new Error(""); stale.stale = true; throw stale; }
        if (!r.ok || !j.success) throw new Error(j.error || "Request failed (" + r.status + ").");
        return j;
      });
    }).catch(function (err) {
      if (read && readGeneration[key] !== generation) { var stale = new Error(""); stale.stale = true; throw stale; }
      if (timedOut) throw new Error(read ? "The request timed out. Refresh this section to retry." : "The request timed out. Refresh and check the current state before retrying the action.");
      throw err;
    }).finally(function () {
      clearTimeout(timer);
      if (read && readGeneration[key] === generation) delete pendingReads[key];
    });
  }

  function note(message, bad) {
    if (!message) return;
    var el = $("#adminNote");
    if (!el) return;
    el.textContent = message || "";
    el.toggleAttribute("data-bad", !!bad);
    clearTimeout(el._timer);
    var modalBody = document.querySelector(".admin-modal-body");
    if (modalBody) {
      var modalError = modalBody.querySelector(".admin-modal-error");
      if (modalError) modalError.remove();
      if (bad) {
        modalError = text("p", message, "admin-load-error admin-modal-error");
        modalError.setAttribute("role", "alert");
        modalBody.prepend(modalError);
      }
    }
    var panel = document.querySelector('[data-admin-panel]:not([hidden])');
    if (panel) {
      var previous = panel.querySelector(".admin-load-error");
      if (previous) previous.remove();
      if (bad) {
        var error = text("p", message + " Use Refresh to retry.", "admin-load-error");
        error.setAttribute("role", "alert");
        panel.prepend(error);
        var retry = text("button", "Retry", "admin-btn admin-btn-outline admin-btn-sm");
        retry.type = "button";
        retry.addEventListener("click", function () { refreshTab(panel.getAttribute("data-admin-panel")); });
        error.appendChild(retry);
        Array.from(panel.querySelectorAll("p, td")).forEach(function (p) {
          if (/^Loading/i.test(p.textContent.trim())) p.textContent = "Data unavailable.";
        });
      }
    }
    if (message && !bad) {
      clearTimeout(el._timer);
      el._timer = setTimeout(function () {
        if (el.textContent === message) el.textContent = "";
      }, 6000);
    }
  }

  function text(tag, value, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = value == null ? "" : String(value);
    return el;
  }

  /* Inline SVG icon system — no emoji icons in the admin console. */
  var ICONS = {
    star: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2.5l1.9 5.4 5.6 1.6-4.4 3.6 1 5.9-4.1-3-4.1 3 1-5.9L4.5 9.5l5.6-1.6L12 2.5Z"/></svg>',
    bolt: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M13 2 4.5 13.5H11L9.5 22 19 10h-6.5L13 2Z"/></svg>',
    check: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m4.5 12.5 5 5 10-11"/></svg>',
    x: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6 6 18"/></svg>',
    activity: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 12h4l3 8 4-16 3 8h4"/></svg>',
    shieldCheck: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 2.8v5.4c0 4.4-2.9 8.3-7 9.8-4.1-1.5-7-5.4-7-9.8V5.8L12 3Z"/><path d="m9.3 12 2 2 3.6-4.2"/></svg>',
    shield: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 2.8v5.4c0 4.4-2.9 8.3-7 9.8-4.1-1.5-7-5.4-7-9.8V5.8L12 3Z"/></svg>',
    eye: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>',
    grid: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>',
    users: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></svg>',
    film: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><rect x="3" y="4" width="18" height="16" rx="2"/><path d="M7 4v16M17 4v16M3 9h4M3 15h4M17 9h4M17 15h4"/></svg>',
    banknote: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><rect x="2" y="6" width="20" height="12" rx="2"/><circle cx="12" cy="12" r="2.5"/><path d="M6 12h.01M18 12h.01" stroke-linecap="round"/></svg>',
    headset: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="M4 13a8 8 0 0 1 16 0"/><rect x="2" y="13" width="4" height="7" rx="1.5"/><rect x="18" y="13" width="4" height="7" rx="1.5"/><path d="M20 20a4 4 0 0 1-4 2h-2"/></svg>',
    gear: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" aria-hidden="true"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9c.14.31.22.65.22 1v1c0 .35-.08.69-.22 1Z"/></svg>',
    search: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="11" cy="11" r="7"/><path d="m20 20-3.5-3.5"/></svg>',
    refresh: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 12a9 9 0 1 1-2.64-6.36"/><path d="M21 3v6h-6"/></svg>',
    archive: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="3" y="4" width="18" height="4" rx="1"/><path d="M5 8v11a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8"/><path d="M10 12h4"/></svg>',
    flag: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 21V4"/><path d="M5 4.5h12l-2.5 3.8L17 12H5"/></svg>',
    trendUp: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 17l6-6 4 4 8-8"/><path d="M14 7h7v7"/></svg>',
    alert: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3 2.5 20h19L12 3Z"/><path d="M12 10v4"/><path d="M12 17.5h.01"/></svg>',
    clock: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3.5 2"/></svg>',
    play: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="9"/><path d="M10 8.3v7.4l6-3.7-6-3.7Z"/></svg>',
    mega: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 5v14l-8-2.7V8.7L21 5Z"/><path d="M13 8.7H8.5L3 10v5l5.5 1.3H13"/><path d="M9 16.5V21h3v-4"/></svg>'
  };
  function adminIcon(name, cls) {
    var s = document.createElement("span");
    s.className = "admin-inline-icon" + (cls ? " " + cls : "");
    s.setAttribute("aria-hidden", "true");
    s.innerHTML = ICONS[name] || "";
    return s;
  }
  function iconText(ic, value) {
    var s = document.createElement("span");
    s.className = "admin-stat";
    s.appendChild(adminIcon(ic));
    s.appendChild(document.createTextNode(" " + String(value == null ? "" : value)));
    return s;
  }

  function isOwner() {
    return !!currentUser && currentUser.role === "super_admin";
  }

  function has(perm) {
    if (!currentUser) return false;
    if (isOwner()) return true;
    if (perm === "owner") return isOwner();
    return (currentUser.permissions || []).indexOf(perm) !== -1;
  }

  function hasAny(perms) { return String(perms || "").split(/\s+/).some(has); }

  function setText(sel, v) { var el = $(sel); if (el) el.textContent = v; }
  function setDot(sel, n) { var el = $(sel); if (!el) return; el.textContent = n > 99 ? "99+" : String(n); el.hidden = n <= 0; }
  function mcSvg(name) {
    var s = document.createElementNS("http://www.w3.org/2000/svg", "svg");
    s.setAttribute("class", "mc-ic");
    s.setAttribute("aria-hidden", "true");
    var u = document.createElementNS("http://www.w3.org/2000/svg", "use");
    u.setAttribute("href", "#mc-i-" + name);
    s.appendChild(u);
    return s;
  }
  function mcTime(iso) {
    if (!iso) return "date unknown";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "date unknown";
    var mins = Math.floor((Date.now() - d.getTime()) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return mins + "m ago";
    if (mins < 1440) return Math.floor(mins / 60) + "h ago";
    if (mins < 10080) return Math.floor(mins / 1440) + "d ago";
    return d.toLocaleDateString();
  }
  function actTone(action) {
    var a = String(action || "").toLowerCase();
    if (/reject|takedown|refund|dismiss|revok|delet/.test(a)) return "red";
    if (/approv|publish|paid|resolv|actioned|broadcast/.test(a)) return "green";
    if (/submit|request|pending|review|flag/.test(a)) return "amber";
    return "";
  }

  function showAccess(user) {
    var allowed = user && ((user.role === "super_admin") || (Array.isArray(user.permissions) && user.permissions.length > 0));
    document.body.classList.toggle("admin-console-active", !!allowed);
    if (!allowed) {
      $("#adminGate").innerHTML = '<div class="admin-gate-badge"><span>Private Workspace</span></div><h1>Admin access required</h1><p>This console is restricted to the ShortsCraft Owner, Sub Admins, and appointed Moderators. If you hold an administrative role, please log in with that account.</p><a class="pg-bw" href="/login?next=%2Fadmin">Log in to continue</a>';
      return false;
    }
    $("#adminGate").hidden = true;
    $("#adminApp").hidden = false;

    var badge = $("#mcRoleBadge");
    var roleText = "Moderator", roleCls = "mc-owner-badge is-moderator", roleIcon = "eye";
    if (user.role === "super_admin") { roleText = "Owner (Super Admin)"; roleCls = "mc-owner-badge"; roleIcon = "shield"; }
    else if (user.role === "sub_admin" || user.role === "admin") { roleText = "Sub Admin"; roleCls = "mc-owner-badge is-sub-admin"; roleIcon = "shield"; }
    if (badge) {
      badge.className = roleCls;
      badge.innerHTML = '<svg class="mc-ic" aria-hidden="true"><use href="#mc-i-' + roleIcon + '"/></svg><span id="mcRoleLabel"></span>';
      setText("#mcRoleLabel", roleText.toUpperCase());
    }
    var legacyBadge = $("#adminRoleBadge");
    if (legacyBadge) legacyBadge.textContent = roleText;

    var av = $("#mcRailAvatar");
    if (av) {
      var nm = user.displayName || user.display_name || user.handle || "Admin";
      av.textContent = String(nm).trim().split(/\s+/).map(function (w) { return w[0]; }).join("").slice(0, 2).toUpperCase() || "A";
      av.title = nm + " \u00B7 " + roleText;
      setText("#mcSideUserName", nm);
      setText("#mcSideUserRole", roleText);
    }

    var qTeam = $("#adQuickTeamBtn");
    if (qTeam) qTeam.hidden = !isOwner();

    return true;
  }

  /* ── Modal Manager ─────────────────────────────────────────── */
  function openModal(title, bodyBuilder, onConfirm, confirmText, isDanger) {
    if (!modalsContainer) modalsContainer = $("#adminModalsContainer");
    if (modalPreviewCleanup) { modalPreviewCleanup(); modalPreviewCleanup = null; }
    if (modalPageOverflow === null) modalPageOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    all(".mc-main,.mc-side").forEach(function (el) { el.inert = true; });
    modalsContainer.innerHTML = "";

    var backdrop = document.createElement("div");
    backdrop.className = "admin-modal-backdrop";

    var box = document.createElement("div");
    box.className = "admin-modal-box";
    box.setAttribute("role", "dialog");
    box.setAttribute("aria-modal", "true");
    box.setAttribute("aria-label", title);
    box.tabIndex = -1;
    var previousFocus = document.activeElement;
    function close() {
      if (!backdrop.isConnected) return;
      if (modalPreviewCleanup) { modalPreviewCleanup(); modalPreviewCleanup = null; }
      backdrop.remove();
      document.body.style.overflow = modalPageOverflow || "";
      modalPageOverflow = null;
      all(".mc-main,.mc-side").forEach(function (el) { el.inert = false; });
      if (previousFocus && previousFocus.isConnected) previousFocus.focus();
    }
    box.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.preventDefault(); close(); return; }
      if (event.key !== "Tab") return;
      var focusable = Array.from(box.querySelectorAll('button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), a[href], [tabindex="0"]')).filter(function (el) { return el.getClientRects().length; });
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (!first) { event.preventDefault(); box.focus(); }
      else if (event.shiftKey && (document.activeElement === first || document.activeElement === box)) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });

    var head = document.createElement("div");
    head.className = "admin-modal-head";
    head.appendChild(text("h3", title));
    var closeBtn = document.createElement("button");
    closeBtn.className = "admin-modal-close";
    closeBtn.innerHTML = ICONS.x;
    closeBtn.type = "button";
    closeBtn.setAttribute("aria-label", "Close modal");
    closeBtn.addEventListener("click", close);
    head.appendChild(closeBtn);
    box.appendChild(head);

    var body = document.createElement("div");
    body.className = "admin-modal-body";
    var formState = bodyBuilder(body);
    box.appendChild(body);

    if (onConfirm) {
      var foot = document.createElement("div");
      foot.className = "admin-modal-foot";
      var cancel = text("button", "Cancel", "admin-btn admin-btn-outline");
      cancel.type = "button";
      cancel.addEventListener("click", close);
      foot.appendChild(cancel);

      var confirmBtn = text("button", confirmText || "Confirm", isDanger ? "admin-btn admin-btn-danger" : "admin-btn admin-btn-primary");
      confirmBtn.type = "button";
      confirmBtn.addEventListener("click", function () {
        confirmBtn.disabled = true;
        Promise.resolve().then(function () { return onConfirm(formState); }).then(function () {
          close();
        }).catch(function (err) {
          note(err.message, true);
        }).finally(function () {
          confirmBtn.disabled = false;
        });
      });
      foot.appendChild(confirmBtn);
      box.appendChild(foot);
    }

    backdrop.appendChild(box);
    backdrop.addEventListener("click", function (e) {
      if (e.target === backdrop) close();
    });
    modalsContainer.appendChild(backdrop);
    box.focus();
    return { box: box, body: body, close: close };
  }

  function profileLink(label, handle) {
    var raw = String(handle || "").trim().replace(/^@+/, "");
    if (!raw) return text("span", label, "admin-profile-unavailable");
    var link = text("a", label, "admin-profile-link");
    link.href = "/creator?handle=" + encodeURIComponent(raw);
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.title = "Open public profile for @" + raw;
    return link;
  }

  function reviewButton(label, action, cls) {
    var button = text("button", label, cls || "admin-btn admin-btn-outline admin-btn-sm admin-preview-trigger");
    button.type = "button";
    button.addEventListener("click", action);
    return button;
  }

  function cleanHandle(h) {
    if (!h) return "";
    var s = String(h).trim().replace(/^@+/, "");
    if (!s) return "";
    return "@" + s;
  }

  function promptModal(title, labelText, defaultValue, onOk, confirmText, isDanger) {
    var inputEl;
    openModal(title, function (body) {
      var grp = document.createElement("div");
      grp.className = "admin-form-group";
      var lbl = document.createElement("label");
      lbl.textContent = labelText;
      grp.appendChild(lbl);
      inputEl = document.createElement("input");
      inputEl.type = "text";
      inputEl.className = "admin-input";
      inputEl.value = defaultValue || "";
      grp.appendChild(inputEl);
      body.appendChild(grp);
      setTimeout(function () { inputEl.focus(); }, 60);
      return function () { return inputEl.value.trim(); };
    }, function (getter) {
      var val = getter();
      if (!val) {
        note("Field cannot be empty.", true);
        throw new Error("Value is mandatory.");
      }
      return onOk(val);
    }, confirmText || "Submit", isDanger);
  }

  /* ── 1. Overview ───────────────────────────────────────────── */
  function loadOverview() {
    if (!has("overview.view")) return Promise.resolve();
    return api("/api/admin/dashboard").then(function (j) {
      var s = j.stats || {};
      setText("#adUsers", (s.users || 0).toLocaleString());
      setText("#adNewUsersSub", "+" + (s.new_users_30d || 0) + " in last 30d");
      setText("#adNewUsersDelta", "+" + Number(s.new_users_30d || 0));
      setText("#adProUsers", (s.pro_users || 0).toLocaleString());
      setText("#adCreators", (s.creators_count || 0).toLocaleString());
      setText("#adRevenueStarPacks", s.starPackGrossINR == null ? "Unavailable" : "₹" + Number(s.starPackGrossINR).toLocaleString());
      setText("#adStarsPurchasedSub", (s.stars_purchased_total || 0).toLocaleString() + " Stars bought");
      setText("#adRevenueFee", s.platformFeeINR == null ? "Unavailable" : "₹" + Number(s.platformFeeINR).toLocaleString());
      setText("#adPendingWithdrawals", (s.pending_withdrawals || 0).toLocaleString());
      setText("#adPublished", (s.published_templates || 0).toLocaleString());
      setText("#adPendingTemplates", Number(s.pending_templates || 0).toLocaleString());
      setText("#adPendingTemplatesSub", (s.pending_templates || 0) + " awaiting review");
      setText("#adAiToday", (s.ai_jobs_today || 0) + " today");
      setText("#adAiFailedSub", (s.ai_jobs_failed_30d || 0) + " failed (30d)");
      setText("#adTickets", (s.open_tickets || 0).toLocaleString());
      setText("#adReportsSub", (s.open_reports || 0) + " open reports");

      var pendT = Number(s.pending_templates || 0);
      var pendW = Number(s.pending_withdrawals || 0);
      var openRep = Number(s.open_reports || 0);
      setDot("#mcCntTemplates", pendT);
      setDot("#adNavWithdrawalsBadge", pendW);
      setDot("#mcCntReports", openRep);
      setText("#adQaTemplates", pendT);
      setText("#adQaWithdrawals", pendW);
      setText("#adQaUsers", Number(s.users || 0).toLocaleString());

      loadAttention();

      var joins = $("#adminRecentUsersList");
      if (joins && has("users.view")) {
        joins.innerHTML = "";
        (j.recentUsers || []).forEach(function (u) {
          var row = text("div", "", "admin-recent-user");
          var identity = text("div", "", "admin-recent-user-identity");
          identity.appendChild(profileLink(u.displayName || "New member", u.profileHandle));
          identity.appendChild(text("small", u.profileHandle ? cleanHandle(u.profileHandle) : "Public profile not set up yet"));
          row.appendChild(identity);
          row.appendChild(text("small", mcTime(u.createdAt), "pg-fine"));
          if (!u.profileHandle) {
            row.appendChild(reviewButton("View account", function () {
              navigate("users");
              $("#adminUserSearch").value = u.displayName || "";
              safeLoad(loadUsers);
            }));
          }
          joins.appendChild(row);
        });
        if (!joins.children.length) joins.appendChild(text("p", "No recent joins to show.", "pg-fine"));
      }

      var list = $("#adminRecentActivityList");
      if (list) {
        list.innerHTML = "";
        var acts = (j.recentActivity || []).slice(0, 8);
        if (!acts.length) {
          list.appendChild(text("p", "No recorded administrative actions yet.", "pg-fine"));
        } else {
          acts.forEach(function (act) {
            var item = document.createElement("div");
            item.className = "mc-feed-item";
            var dot = document.createElement("span");
            dot.className = "mc-feed-dot " + actTone(act.action);
            var body = document.createElement("div");
            var actor = act.actor_name || cleanHandle(act.actor_handle || "admin");
            var actStr = String(act.action || "").replace(/_/g, " ");
            var who = document.createElement("span");
            who.className = "who";
            who.textContent = actor;
            body.appendChild(who);
            body.appendChild(document.createTextNode(" " + actStr + " " + (act.entity_type || "item") + (act.entity_id ? " (#" + String(act.entity_id).slice(0, 8) + ")" : "")));
            var time = document.createElement("span");
            time.className = "ft";
            time.textContent = mcTime(act.created_at);
            item.appendChild(dot);
            item.appendChild(body);
            item.appendChild(time);
            list.appendChild(item);
          });
        }
      }
    });
  }

  function renderAttentionCards(cards) {
    var root = $("#mcAttentionList");
    if (!root) return;
    root.innerHTML = "";
    if (!cards.length) {
      var ok = document.createElement("div");
      ok.className = "mc-allclear";
      ok.appendChild(mcSvg("check"));
      ok.appendChild(document.createTextNode("All clear — nothing needs your attention right now."));
      root.appendChild(ok);
      return;
    }
    cards.forEach(function (c) {
      var item = document.createElement("div");
      item.className = "mc-attn-item";
      var ico = document.createElement("div");
      ico.className = "mc-attn-ico" + (c.tone === "ok" ? " ok" : "");
      ico.appendChild(mcSvg(c.icon));
      item.appendChild(ico);
      var body = document.createElement("div");
      body.className = "mc-attn-body";
      var t = document.createElement("div");
      t.className = "t";
      t.textContent = c.title;
      body.appendChild(t);
      var m = document.createElement("div");
      m.className = "m";
      m.textContent = c.meta;
      body.appendChild(m);
      item.appendChild(body);
      var acts = document.createElement("div");
      acts.className = "mc-attn-actions";
      c.buttons.forEach(function (b) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "mc-btn " + b.cls;
        btn.appendChild(mcSvg(b.icon));
        btn.appendChild(document.createTextNode(b.label));
        btn.addEventListener("click", b.onClick);
        acts.appendChild(btn);
      });
      item.appendChild(acts);
      root.appendChild(item);
    });
  }

  function loadAttention() {
    var root = $("#mcAttentionList");
    if (!root) return;
    root.innerHTML = '<p class="pg-fine">Checking moderation queues\u2026</p>';
    var cards = [];
    var pending = 0;
    function finish() { if (--pending <= 0) renderAttentionCards(cards); }
    if (has("templates.moderate")) {
      pending++;
      api("/api/admin/templates").then(function (j) {
        (j.templates || []).filter(function (t) { return t.status === "review"; }).slice(0, 3).forEach(function (t) {
          cards.push({
            icon: "film",
            tone: "",
            title: "\u201C" + (t.title || "Untitled") + "\u201D is waiting for review",
            meta: (t.authorHandle || t.authorName || "Creator") + " \u00B7 " + (t.category || "Uncategorized") + " \u00B7 submitted " + mcTime(t.createdAt),
            buttons: [
              { label: "Review submission", cls: "mc-btn-dark", icon: "eye", onClick: function () { templateOpenView(t); } }
            ]
          });
        });
      }).catch(function (err) {
        if (!err.stale) {
          cards.push({
            icon: "alert",
            title: "Template review queue unavailable",
            meta: "Open Templates and refresh before making a decision.",
            buttons: [{ label: "Open Templates", cls: "mc-btn-ghost", icon: "eye", onClick: function () { navigate("content"); } }]
          });
        }
      }).then(finish);
    }
    if (has("withdrawals.manage")) {
      pending++;
      api("/api/admin/withdrawals?status=pending").then(function (j) {
        (j.withdrawals || []).slice(0, 2).forEach(function (w) {
          var payoutId = w.txId || w.id;
          var netAmt = w.netAmountINR != null ? w.netAmountINR : (w.payoutINR || 0);
          var starAmt = w.starAmount != null ? w.starAmount : (w.stars || 0);
          var btns;
          if (window.SC_RELEASE && SC_RELEASE.monetizationEnabled) {
            btns = [
              {
                label: "Mark paid", cls: "mc-btn-dark", icon: "check", onClick: function () {
                  promptModal("Process Payout", "Enter Bank Reference Number / UTR for this \u20B9" + netAmt + " payout:", "", function (utr) {
                    return api("/api/admin/withdrawals/" + encodeURIComponent(payoutId) + "/process", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "mark_paid", utr: utr })
                    }).then(function () { note("Payout marked as Paid!"); safeLoad(loadOverview); });
                  }, "Confirm Paid", false);
                }
              },
              {
                label: "Reject", cls: "mc-btn-red", icon: "x", onClick: function () {
                  promptModal("Reject Payout & Refund", "Enter mandatory rejection reason (Stars will be auto-refunded to creator):", "", function (reason) {
                    return api("/api/admin/withdrawals/" + encodeURIComponent(payoutId) + "/process", {
                      method: "POST", headers: { "Content-Type": "application/json" },
                      body: JSON.stringify({ action: "reject", reason: reason })
                    }).then(function () { note("Payout rejected and Stars refunded."); safeLoad(loadOverview); });
                  }, "Reject & Refund", true);
                }
              }
            ];
          } else {
            btns = [{ label: "View", cls: "mc-btn-ghost", icon: "eye", onClick: function () { navigate("withdrawals"); } }];
          }
          cards.push({
            icon: "banknote",
            tone: "",
            title: "Withdrawal #" + String(payoutId).slice(0, 8) + " \u2014 " + starAmt + " stars (\u20B9" + netAmt + ")",
            meta: (w.creatorName || cleanHandle(w.creatorHandle)) + " \u00B7 requested " + mcTime(w.requestedAt),
            buttons: btns
          });
        });
      }).catch(function (err) {
        if (!err.stale) {
          cards.push({
            icon: "alert",
            title: "Payout queue unavailable",
            meta: "Open Withdrawals to retry.",
            buttons: [{ label: "Open Withdrawals", cls: "mc-btn-ghost", icon: "eye", onClick: function () { navigate("withdrawals"); } }]
          });
        }
      }).then(finish);
    }
    if (has("reports.review")) {
      pending++;
      api("/api/admin/reports?status=open").then(function (j) {
        var n = (j.reports || []).length;
        setDot("#mcCntReports", n);
        if (n > 0) {
          cards.push({
            icon: "flag",
            tone: "ok",
            title: n + " open report" + (n === 1 ? "" : "s") + " need" + (n === 1 ? "s" : "") + " review",
            meta: "Safety queue \u00B7 oldest first",
            buttons: [{ label: "View reports", cls: "mc-btn-ghost", icon: "eye", onClick: function () { navigate("reports"); } }]
          });
        }
      }).catch(function (err) {
        if (!err.stale) {
          cards.push({
            icon: "alert",
            title: "Reports queue unavailable",
            meta: "Open Reports to retry.",
            buttons: [{ label: "Open Reports", cls: "mc-btn-ghost", icon: "eye", onClick: function () { navigate("reports"); } }]
          });
        }
      }).then(finish);
    }
    if (!pending) renderAttentionCards(cards);
  }

  /* ── 2. Users ──────────────────────────────────────────────── */
  var usersCache = [];
  function renderUsersTable(users) {
    var root = $("#adminUserList");
    root.innerHTML = "";
    if (!users || !users.length) {
      root.innerHTML = '<tr><td colspan="8" class="admin-td-center">No accounts found.</td></tr>';
      return;
    }
    users.forEach(function (u) {
      var tr = document.createElement("tr");

      var tdUser = document.createElement("td");
      var userBox = document.createElement("div");
      userBox.style.display = "grid";
      userBox.style.gap = "2px";
      var uNameEl = u.profileHandle ? profileLink(u.displayName || u.handle || "Account", u.profileHandle) : reviewButton(u.displayName || "Account", function () { openUserModal(u); }, "admin-record-open");
      if (u.verified) { uNameEl.appendChild(document.createTextNode(" ")); uNameEl.appendChild(adminIcon("check")); }
      userBox.appendChild(uNameEl);
      userBox.appendChild(text("small", cleanHandle(u.handle || "no-handle") + (u.email ? " · " + u.email : ""), "pg-fine"));
      tdUser.appendChild(userBox);
      tr.appendChild(tdUser);

      var tdPlan = document.createElement("td");
      var planPill = text("span", (u.plan || "free").toUpperCase(), "admin-pill" + (u.plan && u.plan !== "free" ? " is-pro" : ""));
      tdPlan.appendChild(planPill);
      tr.appendChild(tdPlan);

      var tdRole = document.createElement("td");
      var rolePill = text("span", u.role === "super_admin" ? "Owner" : (u.role === "sub_admin" || u.role === "admin" ? "Sub Admin" : (u.role === "moderator" ? "Moderator" : (u.role === "banned" ? "Banned" : "Member"))), "admin-pill" + (u.role === "banned" ? " is-banned" : ""));
      tdRole.appendChild(rolePill);
      tr.appendChild(tdRole);

      var tdCredits = document.createElement("td");
      tdCredits.appendChild(iconText("bolt", (u.credits ?? "Unavailable")));
      tr.appendChild(tdCredits);

      var tdStars = document.createElement("td");
      var starsWrap = text("span", "", "pg-fine");
      starsWrap.appendChild(iconText("star", (u.totalStars || 0) + " (Earned: " + (u.earnedStars || 0) + " / Out: " + (u.withdrawnStars || 0) + ")"));
      tdStars.appendChild(starsWrap);
      tr.appendChild(tdStars);

      var tdTemplates = document.createElement("td");
      tdTemplates.textContent = u.templateCount || 0;
      tr.appendChild(tdTemplates);

      var tdJoined = document.createElement("td");
      tdJoined.textContent = u.createdAt ? new Date(u.createdAt).toLocaleDateString() : "—";
      tr.appendChild(tdJoined);

      var tdActions = document.createElement("td");
      tdActions.style.textAlign = "right";
      var btn = text("button", "Manage", "admin-btn admin-btn-outline admin-btn-sm");
      btn.type = "button";
      btn.addEventListener("click", function () { openUserModal(u); });
      tdActions.appendChild(btn);
      tr.appendChild(tdActions);

      root.appendChild(tr);
    });
  }

  function loadUsers() {
    var root = $("#adminUserList");
    root.innerHTML = '<tr><td colspan="8" class="admin-td-center">Loading accounts…</td></tr>';
    var q = ($("#adminUserSearch") || {}).value || "";
    var role = ($("#adminUserRoleFilter") || {}).value || "";
    var plan = ($("#adminUserPlanFilter") || {}).value || "";
    var url = "/api/admin/users?q=" + encodeURIComponent(q) + "&role=" + encodeURIComponent(role) + "&plan=" + encodeURIComponent(plan);
    return api(url).then(function (j) {
      usersCache = j.users || [];
      renderUsersTable(usersCache);
    });
  }

  function openUserModal(u) {
    openModal("Manage Account: " + cleanHandle(u.handle || "user"), function (body) {
      var state = {};
      if (u.profileHandle) body.appendChild(profileLink("View public profile ↗", u.profileHandle));
      else body.appendChild(text("p", "This account has not set up a public profile handle yet.", "pg-fine"));

      var infoCard = document.createElement("div");
      infoCard.style.padding = "14px";
      infoCard.style.borderRadius = "12px";
      infoCard.style.background = "var(--ad-surface-2)";
      infoCard.style.border = "1px solid var(--ad-border)";
      infoCard.style.display = "grid";
      infoCard.style.gridTemplateColumns = "repeat(auto-fit, minmax(130px, 1fr))";
      infoCard.style.gap = "10px";
      [["Name", u.displayName || "—"], ["Plan", u.plan || "Free"], ["Credits", u.credits ?? "—"], ["Withdrawable Stars", u.withdrawableStars ?? "—"]].forEach(function (pair) {
        var item = document.createElement("div");
        item.appendChild(text("small", pair[0]));
        item.appendChild(document.createElement("br"));
        item.appendChild(text("b", pair[1]));
        infoCard.appendChild(item);
      });
      body.appendChild(infoCard);

      if (isOwner() && u.role !== "super_admin") {
        var roleSec = document.createElement("div");
        roleSec.style.border = "1px solid var(--ad-border)";
        roleSec.style.borderRadius = "12px";
        roleSec.style.padding = "14px";
        roleSec.appendChild(text("h4", "Staff Role & Access (Owner Only)", "pg-fine"));

        var roleRow = document.createElement("div");
        roleRow.style.display = "grid";
        roleRow.style.gridTemplateColumns = "repeat(auto-fit, minmax(130px, 1fr))";
        roleRow.style.gap = "8px";
        roleRow.style.marginTop = "8px";

        var roleSel = document.createElement("select");
        roleSel.className = "admin-select";
        roleSel.style.width = "100%";
        [["user", "Member (Standard User)"], ["moderator", "Moderator (Content & Safety)"], ["sub_admin", "Sub Admin (Operations & Money)"]].forEach(function (opt) {
          var o = document.createElement("option");
          o.value = opt[0];
          o.textContent = opt[1];
          if ((u.role || "user") === opt[0]) o.selected = true;
          roleSel.appendChild(o);
        });
        roleRow.appendChild(roleSel);

        var saveRoleBtn = text("button", "Change Role", "admin-btn admin-btn-primary admin-btn-sm");
        saveRoleBtn.style.minHeight = "38px";
        saveRoleBtn.addEventListener("click", function () {
          saveRoleBtn.disabled = true;
          api("/api/admin/users/" + encodeURIComponent(u.id) + "/moderate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "change_role", role: roleSel.value, reason: "Owner role update" })
          }).then(function (res) {
            note(res.message || "Role updated.");
            u.role = roleSel.value;
            safeLoad(loadUsers);
            safeLoad(loadOverview);
          }).catch(function (e) {
            note(e.message, true);
          }).finally(function () {
            saveRoleBtn.disabled = false;
          });
        });
        roleRow.appendChild(saveRoleBtn);
        roleSec.appendChild(roleRow);
        body.appendChild(roleSec);
      }

      var modSec = document.createElement("div");
      modSec.style.border = "1px solid var(--ad-border)";
      modSec.style.borderRadius = "12px";
      modSec.style.padding = "14px";
      modSec.appendChild(text("h4", "Safety & Moderation", "pg-fine"));
      var modBtns = document.createElement("div");
      modBtns.style.display = "grid";
      modBtns.style.gridTemplateColumns = "repeat(auto-fit, minmax(130px, 1fr))";
      modBtns.style.gap = "8px";
      modBtns.style.marginTop = "8px";

      var warnBtn = text("button", "Warn User", "admin-btn admin-btn-outline admin-btn-sm");
      warnBtn.style.minHeight = "38px";
      warnBtn.addEventListener("click", function () {
        if (!has("users.manage") || u.role === "super_admin") return;
        promptModal("Warn " + cleanHandle(u.handle), "Enter warning message to notify user:", "", function (reason) {
          return api("/api/admin/users/" + encodeURIComponent(u.id) + "/moderate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "warn", reason: reason })
          }).then(function () { note("Warning delivered to " + cleanHandle(u.handle)); });
        }, "Send Warning", false);
      });
      warnBtn.hidden = !has("users.manage") || u.role === "super_admin";
      modBtns.appendChild(warnBtn);

      var verifyBtn = text("button", u.verified ? "Remove Verified" : "Grant Verified", "admin-btn admin-btn-outline admin-btn-sm");
      verifyBtn.style.minHeight = "38px";
      verifyBtn.addEventListener("click", function () {
        if (!has("creators.verify") || u.role === "super_admin") return;
        var action = u.verified ? "unverify_creator" : "verify_creator";
        api("/api/admin/users/" + encodeURIComponent(u.id) + "/moderate", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: action })
        }).then(function () {
          note("Creator verification updated.");
          safeLoad(loadUsers);
          safeLoad(loadOverview);
        }).catch(function (e) { note(e.message, true); });
      });
      verifyBtn.hidden = !has("creators.verify") || u.role === "super_admin";
      modBtns.appendChild(verifyBtn);

      if (u.role !== "super_admin") {
        var banned = u.role === "banned";
        var banBtn = text("button", banned ? "Restore Account" : "Suspend / Ban", "admin-btn admin-btn-danger admin-btn-sm");
        banBtn.hidden = !has("users.manage");
        banBtn.style.minHeight = "38px";
        banBtn.addEventListener("click", function () {
          if (!has("users.manage")) return;
          promptModal((banned ? "Restore " : "Suspend / Ban ") + cleanHandle(u.handle), "Enter mandatory audit reason:", "", function (reason) {
            return api("/api/admin/users/" + encodeURIComponent(u.id) + "/moderate", {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ action: banned ? "unban" : "ban", reason: reason })
            }).then(function () { note(banned ? "Account restored." : "Account suspended."); safeLoad(loadUsers); });
          }, banned ? "Restore Account" : "Ban Account", true);
        });
        modBtns.appendChild(banBtn);
      }
      modSec.appendChild(modBtns);
      modSec.hidden = u.role === "super_admin" || (!has("users.manage") && !has("creators.verify"));
      body.appendChild(modSec);

      var balSec = document.createElement("div");
      balSec.hidden = !has("users.balance_adjust");
      balSec.style.border = "1px solid var(--ad-border)";
      balSec.style.borderRadius = "12px";
      balSec.style.padding = "14px";
      balSec.appendChild(text("h4", "Manual Balance Adjustment", "pg-fine"));
      var formGrid = document.createElement("div");
      formGrid.style.display = "grid";
      formGrid.style.gap = "10px";
      formGrid.style.marginTop = "8px";

      var typeSel = document.createElement("select");
      typeSel.className = "admin-select";
      typeSel.innerHTML = '<option value="stars">Stars (Spendable grant)</option><option value="credits">Bonus credits</option>';
      typeSel.options[0].disabled = true;
      typeSel.options[0].textContent = "Stars — Coming Soon";
      typeSel.value = "credits";
      formGrid.appendChild(typeSel);

      var amtInput = document.createElement("input");
      amtInput.type = "number";
      amtInput.className = "admin-search-input";
      amtInput.style.maxWidth = "100%";
      amtInput.placeholder = "Whole amount; credits deduct from bonus only";
      amtInput.required = true;
      formGrid.appendChild(amtInput);

      var reasonInput = document.createElement("input");
      reasonInput.type = "text";
      reasonInput.className = "admin-search-input";
      reasonInput.style.maxWidth = "100%";
      reasonInput.placeholder = "Mandatory Audit Reason (Compulsory)*";
      reasonInput.required = true;
      formGrid.appendChild(reasonInput);

      var applyBalBtn = text("button", "Apply Adjustment", "admin-btn admin-btn-primary");
      applyBalBtn.style.minHeight = "42px";
      applyBalBtn.style.width = "100%";
      applyBalBtn.addEventListener("click", function () {
        if (!has("users.balance_adjust")) return;
        var delta = Number(amtInput.value);
        var reason = reasonInput.value.trim();
        if (!Number.isSafeInteger(delta) || !delta || Math.abs(delta) > 10000) { alert("Enter a non-zero whole amount up to 10,000."); return; }
        if (typeSel.value === "stars" && delta < 0) { alert("Star debits are not supported by the current ledger. No balance will be changed."); return; }
        if (!reason) { alert("Mandatory reason is required for balance adjustment."); return; }
        applyBalBtn.disabled = true;
        var payload = { reason: reason, type: typeSel.value };
        if (typeSel.value === "stars") payload.deltaStars = delta;
        else payload.deltaCredits = delta;
        api("/api/admin/users/" + encodeURIComponent(u.id) + "/balance", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload)
        }).then(function (res) {
          note(res.message || "Balance adjusted.");
          safeLoad(loadUsers);
          safeLoad(loadOverview);
        }).catch(function (e) {
          note(e.message, true);
        }).finally(function () {
          applyBalBtn.disabled = false;
        });
      });
      formGrid.appendChild(applyBalBtn);
      balSec.appendChild(formGrid);
      body.appendChild(balSec);

      return state;
    }, null, null);
  }

  /* ── 3. Creators ───────────────────────────────────────────── */
  function loadCreators() {
    var root = $("#adminCreatorList");
    root.innerHTML = '<tr><td colspan="7" class="admin-td-center">Loading creators…</td></tr>';
    var q = ($("#adminCreatorSearch") || {}).value || "";
    return api("/api/admin/creators?q=" + encodeURIComponent(q)).then(function (j) {
      root.innerHTML = "";
      var creators = j.creators || [];
      if (!creators.length) {
        root.innerHTML = '<tr><td colspan="7" class="admin-td-center">No creators found.</td></tr>';
        return;
      }
      creators.forEach(function (c) {
        var tr = document.createElement("tr");

        var cName = c.displayName || cleanHandle(c.handle) || "Creator";
        var cHandle = cleanHandle(c.handle) || (c.displayName ? "@" + c.displayName.toLowerCase().replace(/\s+/g, "") : "@creator");
        var tdCreator = document.createElement("td");
        tdCreator.appendChild(profileLink(cName, c.profileHandle));
        tdCreator.appendChild(document.createElement("br"));
        tdCreator.appendChild(text("small", cHandle, "pg-fine"));
        tr.appendChild(tdCreator);

        var tdVer = document.createElement("td");
        var verPill = document.createElement("span");
        verPill.className = "admin-pill" + (c.verified ? " is-published" : "");
        if (c.verified) { verPill.appendChild(adminIcon("check")); verPill.appendChild(document.createTextNode(" Verified")); }
        else { verPill.textContent = "Standard"; }
        tdVer.appendChild(verPill);
        tr.appendChild(tdVer);

        var tdPub = document.createElement("td");
        tdPub.textContent = c.templatesCount || 0;
        tr.appendChild(tdPub);

        var tdEarned = document.createElement("td");
        tdEarned.appendChild(iconText("star", (c.starsEarned || 0)));
        tr.appendChild(tdEarned);

        var tdWithdrawn = document.createElement("td");
        tdWithdrawn.appendChild(iconText("star", (c.withdrawnStars || 0)));
        tr.appendChild(tdWithdrawn);

        var tdBal = document.createElement("td");
        var balB = document.createElement("b");
        balB.appendChild(iconText("star", (c.withdrawableStars || 0)));
        tdBal.appendChild(balB);
        tdBal.appendChild(text("small", " (₹" + ((c.withdrawableStars || 0) * 3.50).toFixed(2) + ")", "pg-fine"));
        tr.appendChild(tdBal);

        var tdActions = document.createElement("td");
        tdActions.style.textAlign = "right";
        var tglBtn = text("button", c.verified ? "Remove Badge" : "Verify Badge", "admin-btn admin-btn-outline admin-btn-sm");
        tglBtn.hidden = !has("creators.verify") || (isOwner() && c.id === currentUser.id);
        tglBtn.addEventListener("click", function () {
          if (!has("creators.verify") || (isOwner() && c.id === currentUser.id)) return;
          api("/api/admin/users/" + encodeURIComponent(c.id) + "/moderate", {
            method: "POST", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: c.verified ? "unverify_creator" : "verify_creator" })
          }).then(function () { note("Verification updated."); safeLoad(loadCreators); }).catch(function (e) { note(e.message, true); });
        });
        tdActions.appendChild(tglBtn);
        tr.appendChild(tdActions);

        root.appendChild(tr);
      });
    });
  }

  /* ── 4. Templates Moderation ───────────────────────────────── */
  function templateSetStatus(t, status, extraBody, successMsg) {
    return api("/api/admin/templates/" + encodeURIComponent(t.id), {
      method: "PATCH", headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.assign({ status: status }, extraBody || {}))
    }).then(function () { note(successMsg); safeLoad(loadTemplates); safeLoad(loadOverview); });
  }
  function templateApprove(t) { return templateSetStatus(t, "published", null, "Template approved and published."); }
  function templateReject(t) {
    promptModal("Reject Template", "Enter mandatory rejection reason for " + cleanHandle(t.authorHandle || "creator") + ":", "", function (reason) {
      return templateSetStatus(t, "rejected", { reviewNote: reason }, "Template rejected with note.");
    }, "Reject Template", true);
  }
  function templateArchive(t) {
    openModal("Archive Template", function (body) {
      body.appendChild(text("p", "Archive \"" + t.title + "\"? It will be hidden from the public listing. You can restore it later from the Archived filter.", "pg-fine"));
    }, function () { return templateSetStatus(t, "archived", null, "Template archived."); }, "Archive Template");
  }
  function templateOpenView(t) {
    openContentPreview(t);
  }

  var mcTplSelected = {};
  function mcUpdateBulkbar() {
    var n = Object.keys(mcTplSelected).length;
    var bar = $("#mcBulkbar");
    if (!bar) return;
    bar.classList.toggle("show", n > 0);
    setText("#mcBulkCount", n);
  }
  function mcClearTplSelection() {
    mcTplSelected = {};
    all(".mc-tpl-sel").forEach(function (cb) { cb.checked = false; });
    mcUpdateBulkbar();
  }
  function mcBulkSetStatus(status, reason) {
    var ids = Object.keys(mcTplSelected);
    if (!ids.length) return Promise.resolve();
    var chain = Promise.resolve();
    var okN = 0, failN = 0;
    ids.forEach(function (id) {
      chain = chain.then(function () {
        var body = { status: status };
        if (reason != null) body.reviewNote = reason;
        return api("/api/admin/templates/" + encodeURIComponent(id), {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body)
        }).then(function () { okN++; }).catch(function (e) { failN++; note("Bulk " + status + " failed for " + String(id).slice(0, 12) + ": " + e.message, true); });
      });
    });
    return chain.then(function () {
      mcClearTplSelection();
      if (okN) note(okN + " template(s) " + status + (failN ? " (" + failN + " failed)" : "") + ".", failN > 0);
      safeLoad(loadTemplates);
      safeLoad(loadOverview);
    });
  }

  function loadTemplates() {
    var root = $("#adminTemplateList");
    root.innerHTML = "<p>Loading templates…</p>";
    var filter = ($("#adminTemplateFilter") || {}).value || "all";
    return api("/api/admin/templates").then(function (j) {
      root.innerHTML = "";
      var categorySelect = $("#adminTemplateCategory");
      var category = categorySelect.value;
      var type = $("#adminTemplateType").value;
      var categories = Array.from(new Set((j.templates || []).map(function (t) { return t.category; }).filter(Boolean))).sort();
      categorySelect.innerHTML = '<option value="all">All categories</option>';
      categories.forEach(function (cat) { var opt = text("option", cat); opt.value = cat; categorySelect.appendChild(opt); });
      categorySelect.value = categories.indexOf(category) !== -1 ? category : "all";

      var templates = (j.templates || []).filter(function (t) {
        return (filter === "all" || t.status === filter) &&
          (categorySelect.value === "all" || t.category === categorySelect.value) &&
          (type === "all" || (type === "design") === (t.sourceFormat === "design_template"));
      });

      var pend = (j.templates || []).filter(function (x) { return x.status === "review"; }).length;
      setText("#mcTplHeadSub", templates.length + " matching templates \u00B7 " + pend + " awaiting review");
      setDot("#mcCntTemplates", pend);

      if (!templates.length) {
        root.appendChild(text("p", "No templates match this filter.", "pg-fine"));
        return;
      }

      mcTplSelected = {};
      mcUpdateBulkbar();

      var STATUS_LABEL = { review: "Pending Review", published: "Published", rejected: "Rejected", archived: "Archived" };
      function thumbVariant(id) {
        var h = 0, s = String(id);
        for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 4;
        return h ? "mc-tpl-thumb v" + (h + 1) : "mc-tpl-thumb";
      }

      templates.forEach(function (t) {
        var row = document.createElement("article");
        row.className = "admin-row admin-tpl-card";
        row.setAttribute("data-title", String(t.title || "").toLowerCase());
        row.setAttribute("data-creator", String(t.authorHandle || t.authorName || "").toLowerCase());

        var left = document.createElement("div");
        left.className = "admin-tpl-card-left";

        var cb = document.createElement("input");
        cb.type = "checkbox";
        cb.className = "mc-tpl-sel";
        cb.setAttribute("aria-label", "Select " + (t.title || "template"));
        cb.addEventListener("change", function () {
          if (cb.checked) mcTplSelected[t.id] = t; else delete mcTplSelected[t.id];
          mcUpdateBulkbar();
        });
        left.appendChild(cb);

        var thumb = reviewButton("", function () { templateOpenView(t); }, thumbVariant(t.id));
        thumb.setAttribute("aria-label", "Preview " + (t.title || "Untitled"));
        thumb.innerHTML = '<svg class="mc-ic" aria-hidden="true"><use href="#mc-i-play"/></svg>';
        left.appendChild(thumb);

        var main = document.createElement("div");
        main.className = "admin-row-main";

        var titleLine = document.createElement("div");
        titleLine.className = "admin-tpl-meta-line";
        var nm = reviewButton(t.title || "Untitled", function () { templateOpenView(t); }, "admin-record-open");
        titleLine.appendChild(nm);

        var statusPill = text("span", STATUS_LABEL[t.status] || t.status || "Pending", "admin-pill is-" + (t.status || "review"));
        titleLine.appendChild(statusPill);

        var kindPill = text("span", t.sourceFormat === "design_template" ? "Design" : "Animation", "admin-pill");
        titleLine.appendChild(kindPill);

        if (t.isFeatured) {
          titleLine.appendChild(text("span", "Featured", "admin-pill is-pro"));
        }
        main.appendChild(titleLine);

        var metaLine = document.createElement("div");
        metaLine.className = "admin-tpl-meta-line";
        metaLine.appendChild(profileLink(t.authorHandle || t.authorName || "Creator", t.profileHandle));
        metaLine.appendChild(text("span", "· " + (t.category || "Uncategorized")));
        if (t.createdAt) metaLine.appendChild(text("span", "· " + new Date(t.createdAt).toLocaleDateString()));
        main.appendChild(metaLine);

        if (t.reviewNote) {
          main.appendChild(text("small", "Review note: " + t.reviewNote, "pg-formnote"));
        }

        left.appendChild(main);
        row.appendChild(left);

        var controls = document.createElement("div");
        controls.className = "admin-row-controls";

        var previewBtn = reviewButton(t.sourceFormat === "design_template" ? "Preview design" : "Preview & review", function () {
          templateOpenView(t);
        });
        if (t.sourceFormat === "design_template") {
          previewBtn.setAttribute("data-admin-design-preview", t.id);
        }
        controls.appendChild(previewBtn);

        if (t.status !== "rejected") {
          var rejBtn = text("button", "Reject", "admin-btn admin-btn-danger admin-btn-sm");
          rejBtn.type = "button";
          rejBtn.addEventListener("click", function () { templateReject(t); });
          controls.appendChild(rejBtn);
        }
        if (t.status !== "archived") {
          var archBtn = text("button", "Archive", "admin-btn admin-btn-outline admin-btn-sm");
          archBtn.type = "button";
          archBtn.addEventListener("click", function () { templateArchive(t); });
          controls.appendChild(archBtn);
        }

        row.appendChild(controls);
        root.appendChild(row);
      });
    });
  }

  function openContentPreview(template) {
    if (!has("templates.moderate")) return;
    var isDesign = template.sourceFormat === "design_template";
    var modal = openModal((isDesign ? "Design" : "Animation") + " review: " + template.title, function (body) {
      body.appendChild(text("p", "Loading the submitted content…", "pg-fine"));
    });
    modal.box.classList.add("admin-review-modal");
    var bodyRoot = modal.body;
    bodyRoot.tabIndex = 0;
    var endpoint = isDesign ? "design-templates" : "animation-templates";
    api("/api/admin/" + endpoint + "/" + encodeURIComponent(template.id) + "/preview").then(function (j) {
      if (!bodyRoot.isConnected) return;
      var content = j.template;
      if (!content) throw new Error("This submission has no preview data.");
      bodyRoot.innerHTML = "";
      var layout = text("div", "", "admin-preview-layout");
      var media = text("div", "", "admin-preview-media");
      var stage = text("div", "", "admin-preview-stage" + (isDesign ? " admin-design-preview" : ""));
      var status = text("p", "Loading preview…", "admin-preview-status pg-fine");
      status.setAttribute("role", "status");
      media.append(stage, status);
      var enlarge = reviewButton("Enlarge preview", function () {
        var expanded = stage.classList.toggle("admin-preview-expanded");
        enlarge.textContent = expanded ? "Fit preview" : "Enlarge preview";
        enlarge.setAttribute("aria-pressed", String(expanded));
      });
      enlarge.setAttribute("aria-pressed", "false");
      media.appendChild(enlarge);
      var details = text("div", "", "admin-preview-details");
      details.appendChild(text("h3", content.title || template.title));
      details.appendChild(profileLink(template.authorName || template.authorHandle || "Creator", template.profileHandle));
      var meta = text("dl", "", "admin-preview-meta");
      [["Type", isDesign ? "Design" : "Animation"], ["Status", content.status || template.status], ["Category", template.category || "Uncategorized"], ["Submitted", template.createdAt ? new Date(template.createdAt).toLocaleString() : "Unknown"]].forEach(function (pair) {
        meta.append(text("dt", pair[0]), text("dd", pair[1]));
      });
      if (isDesign && content.canvas) meta.append(text("dt", "Canvas"), text("dd", content.canvas.width + " × " + content.canvas.height));
      if (!isDesign) meta.append(text("dt", "Timing"), text("dd", (Number(content.dur) / 1000) + " seconds · " + content.aspect));
      details.appendChild(meta);
      if (content.description) details.appendChild(text("p", content.description, "pg-fine"));
      if (template.reviewNote) details.appendChild(text("p", "Review note: " + template.reviewNote, "pg-fine"));
      details.appendChild(text("p", "Check the complete preview and creator before making a decision. Opening this preview does not publish or edit it.", "pg-fine"));
      var actions = text("div", "", "admin-review-actions");
      var approve;
      if ((content.status || template.status) !== "published") {
        approve = reviewButton("Approve & publish", function () {
          approve.disabled = true;
          templateApprove(template).then(modal.close).catch(function (err) { approve.disabled = false; note(err.message, true); });
        }, "admin-btn admin-btn-success");
        approve.disabled = true;
        actions.appendChild(approve);
      }
      if ((content.status || template.status) !== "rejected") actions.appendChild(reviewButton("Reject with reason", function () { templateReject(template); }, "admin-btn admin-btn-danger"));
      if ((content.status || template.status) !== "archived") actions.appendChild(reviewButton("Archive", function () { templateArchive(template); }));
      details.appendChild(actions);
      layout.append(media, details);
      bodyRoot.appendChild(layout);
      function ready() {
        if (!bodyRoot.isConnected) return;
        status.textContent = "Read-only preview loaded. Inspect the visual result before approval.";
        status.classList.remove("admin-preview-error");
        status.setAttribute("role", "status");
        if (approve) approve.disabled = false;
      }
      function failed(message) {
        status.textContent = message;
        status.classList.add("admin-preview-error");
        status.setAttribute("role", "alert");
        if (approve) approve.disabled = true;
      }
      if (isDesign) {
        if (!content.canvas || (!content.previewUrl && !(content.elements || []).length) || typeof window.SCDesignPreview !== "function") throw new Error("This design does not have a usable preview.");
        stage.style.aspectRatio = Math.max(1, Number(content.canvas.width)) + "/" + Math.max(1, Number(content.canvas.height));
        stage.style.setProperty("--preview-ratio", Math.max(1, Number(content.canvas.width)) / Math.max(1, Number(content.canvas.height)));
        stage.innerHTML = window.SCDesignPreview(content);
        var image = stage.querySelector("img");
        if (image) {
          image.loading = "eager";
          image.addEventListener("load", ready, { once: true });
          image.addEventListener("error", function () { failed("The submitted preview image could not be loaded. Do not approve until it can be inspected."); }, { once: true });
          if (image.complete && image.naturalWidth > 0) ready();
        } else {
          var assets = Array.from(stage.querySelectorAll("image"));
          if (!assets.length) ready();
          else {
            Promise.all(assets.map(function (asset) {
              return new Promise(function (resolve, reject) {
                var probe = new Image(); probe.onload = resolve; probe.onerror = reject;
                probe.src = asset.getAttribute("href") || "";
              });
            })).then(ready, function () { failed("A design layer asset is unavailable. Preview is incomplete."); });
          }
        }
      } else {
        if (!window.SC_TPL2) throw new Error("The animation preview renderer is unavailable.");
        if (window.SC_TPL2.aspects().indexOf(content.aspect) === -1 || !Number.isFinite(Number(content.dur)) || Number(content.dur) <= 0) throw new Error("The submitted animation has invalid dimensions or timing. It cannot be reviewed reliably.");
        var html = window.SC_TPL2.build(content.tpl, { props: content.props || {}, lines: content.lines || [], accent: content.accent, font: content.font, dur: content.dur, aspect: content.aspect });
        if (!html) throw new Error("This animation format has no supported preview renderer. Nothing was substituted.");
        stage.style.aspectRatio = (content.aspect || "9:16").replace(":", "/");
        var sides = (content.aspect || "9:16").split(":").map(Number);
        stage.style.setProperty("--preview-ratio", sides[0] / sides[1]);
        var frame = document.createElement("iframe");
        frame.className = "admin-preview-frame";
        frame.setAttribute("sandbox", "allow-scripts");
        frame.title = "Submitted animation: " + (content.title || template.title);
        var token;
        var timeout;
        function receivePreview(event) {
          if (event.source !== frame.contentWindow || !event.data || event.data.type !== "sc-admin-preview" || event.data.token !== token) return;
          clearTimeout(timeout);
          if (event.data.ok === true) ready();
          else failed("The animation could not render its submitted assets. Do not approve this incomplete preview.");
        }
        window.addEventListener("message", receivePreview);
        modalPreviewCleanup = function () { clearTimeout(timeout); window.removeEventListener("message", receivePreview); };
        function previewDocument() {
          var bridge = '<script>(function(){function send(ok){parent.postMessage({type:"sc-admin-preview",token:' + JSON.stringify(token) + ',ok:ok},"*");}function loaded(image){return new Promise(function(resolve,reject){image.loading="eager";if(image.complete){image.naturalWidth?resolve():reject();}else{image.addEventListener("load",resolve,{once:true});image.addEventListener("error",reject,{once:true});}});}Promise.all([Promise.resolve(window.__scReady),Promise.all(Array.from(document.images).map(loaded)),document.fonts?document.fonts.ready:Promise.resolve()]).then(function(){requestAnimationFrame(function(){var bad=document.querySelector(".scl.is-missing"),stage=document.querySelector(".cv");send(!!stage&&!bad' + (content.tpl === "lottie" ? '&&!!document.querySelector("#scLottie svg")' : '') + ');});},function(){send(false);});})();<\/script>';
          return html.replace(/<\/body>/i, bridge + "</body>");
        }
        function play() {
          clearTimeout(timeout);
          token = Array.from(crypto.getRandomValues(new Uint32Array(4))).join("-");
          status.textContent = "Loading submitted animation…";
          status.classList.remove("admin-preview-error");
          if (approve) approve.disabled = true;
          timeout = setTimeout(function () { failed("The animation preview timed out. Replay to retry; approval is disabled."); }, 20000);
          frame.srcdoc = previewDocument();
        }
        play();
        stage.appendChild(frame);
        details.insertBefore(reviewButton("Replay animation", play), actions);
      }
    }).catch(function (err) {
      if (!bodyRoot.isConnected || err.stale) return;
      bodyRoot.innerHTML = "";
      var error = text("p", err.message || "The protected preview could not be loaded.", "admin-load-error");
      error.setAttribute("role", "alert");
      bodyRoot.appendChild(error);
      bodyRoot.appendChild(text("p", "Preview unavailable. This submission has not been approved or changed.", "pg-fine"));
      bodyRoot.appendChild(reviewButton("Retry preview", function () { openContentPreview(template); }));
      if (template.status !== "rejected") bodyRoot.appendChild(reviewButton("Reject with reason", function () { templateReject(template); }, "admin-btn admin-btn-danger"));
    });
  }

  /* ── 5. Creator Tutorials ──────────────────────────────────── */
  function openTutorialPreview(item) {
    var url;
    try { url = new URL(item.url); } catch (_) { note("This tutorial has an invalid source link.", true); return; }
    if (!/^https?:$/.test(url.protocol)) { note("This tutorial has an unsupported source link.", true); return; }
    var modal = openModal("Tutorial review: " + item.title, function (body) {
      var stage = text("div", "", "admin-preview-stage");
      stage.style.aspectRatio = "16/9";
      var key = "", host = url.hostname.replace(/^www\./, "");
      if (host === "youtu.be") key = url.pathname.split("/")[1];
      if (["youtube.com", "m.youtube.com"].indexOf(host) !== -1) key = url.searchParams.get("v") || url.pathname.split("/")[2];
      if (/^[A-Za-z0-9_-]{11}$/.test(key)) {
        var frame = document.createElement("iframe");
        frame.className = "admin-preview-frame";
        frame.title = "Watch tutorial: " + item.title;
        frame.src = "https://www.youtube-nocookie.com/embed/" + encodeURIComponent(key);
        frame.allow = "fullscreen";
        frame.setAttribute("allowfullscreen", "");
        frame.referrerPolicy = "strict-origin-when-cross-origin";
        stage.appendChild(frame);
        body.appendChild(stage);
      } else {
        body.appendChild(text("p", "This platform does not provide an embedded preview here. Open the original video to review it.", "pg-fine"));
      }
      var source = text("a", "Open original video ↗", "admin-profile-link");
      source.href = url.href; source.target = "_blank"; source.rel = "noopener noreferrer";
      body.appendChild(source);
      body.appendChild(profileLink((item.author || {}).name || (item.author || {}).displayName || "Creator", (item.author || {}).handle));
      body.appendChild(text("p", "Status: " + item.status + ". If playback is restricted, use the original video link before deciding.", "pg-fine"));
      if (item.summary) body.appendChild(text("p", item.summary, "pg-fine"));
      if (item.reviewNote) body.appendChild(text("p", "Review note: " + item.reviewNote, "pg-fine"));
      var actions = text("div", "", "admin-review-actions");
      if (item.status !== "published") {
        actions.appendChild(reviewButton("Approve & publish", function () {
          openModal("Publish tutorial?", function (b) { b.appendChild(text("p", "Publish “" + item.title + "” after reviewing the video?")); }, function () {
            return api("/api/admin/skills/" + encodeURIComponent(item.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "published" }) }).then(function () { note("Tutorial approved."); safeLoad(loadSkills); });
          }, "Approve & publish");
        }, "admin-btn admin-btn-success"));
      }
      if (item.status !== "rejected") {
        actions.appendChild(reviewButton("Reject with reason", function () {
          promptModal("Reject / Takedown Tutorial", "Enter the rejection reason:", "", function (reason) {
            return api("/api/admin/skills/" + encodeURIComponent(item.id), { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: "rejected", note: reason }) }).then(function () { note("Tutorial rejected."); safeLoad(loadSkills); });
          }, "Reject tutorial", true);
        }, "admin-btn admin-btn-danger"));
      }
      body.appendChild(actions);
    });
    modal.box.classList.add("admin-review-modal");
    modal.body.tabIndex = 0;
  }

  function loadSkills() {
    var root = $("#adminSkillList");
    var status = ($("#adminSkillStatus") || {}).value || "published";
    root.innerHTML = "<p>Loading tutorials…</p>";
    return api("/api/admin/skills?status=" + encodeURIComponent(status)).then(function (j) {
      root.innerHTML = "";
      var skills = j.skills || [];
      if (!skills.length) {
        root.appendChild(text("p", "No " + status + " tutorials.", "pg-fine"));
        return;
      }
      skills.forEach(function (item) {
        var row = document.createElement("article");
        row.className = "admin-row";

        var main = document.createElement("div");
        main.className = "admin-row-main";
        main.appendChild(reviewButton(item.title, function () { openTutorialPreview(item); }, "admin-record-open"));

        var link = document.createElement("a");
        link.href = item.url; link.target = "_blank"; link.rel = "noopener noreferrer";
        link.className = "admin-profile-link";
        link.textContent = item.url;
        main.appendChild(link);
        main.appendChild(profileLink(cleanHandle((item.author || {}).handle || "") || (item.author || {}).name || "Creator", (item.author || {}).handle));
        main.appendChild(text("small", item.platform));
        if (item.summary) main.appendChild(text("small", item.summary));
        if (item.reviewNote) main.appendChild(text("small", "Note: " + item.reviewNote, "pg-formnote"));

        var controls = document.createElement("div");
        controls.className = "admin-row-controls";
        controls.appendChild(reviewButton("Preview & review", function () { openTutorialPreview(item); }));

        row.appendChild(main);
        row.appendChild(controls);
        root.appendChild(row);
      });
    });
  }

  /* ── 6. Reports ────────────────────────────────────────────── */
  function loadReports() {
    var root = $("#adminReportList");
    var status = ($("#adminReportStatus") || {}).value || "open";
    root.innerHTML = "<p>Loading reports…</p>";
    return api("/api/admin/reports?status=" + encodeURIComponent(status)).then(function (j) {
      root.innerHTML = "";
      var reports = j.reports || [];
      if (!reports.length) {
        root.appendChild(text("p", "No " + status + " reports.", "pg-fine"));
        return;
      }
      reports.forEach(function (r) {
        var row = document.createElement("article");
        row.className = "admin-row";

        var main = document.createElement("div");
        main.className = "admin-row-main";
        main.appendChild(text("strong", "Report: " + (r.targetType || "content").toUpperCase() + " (" + (r.reasonLabel || r.reason) + ")"));
        if (r.link) {
          var l = document.createElement("a");
          l.href = r.link; l.target = "_blank"; l.className = "admin-profile-link"; l.textContent = "View Reported Content ↗";
          main.appendChild(l);
        }
        main.appendChild(text("span", "Reported by " + (r.reporter || "visitor") + " on " + new Date(r.createdAt).toLocaleString()));
        if (r.details) main.appendChild(text("small", "“" + r.details + "”"));
        if (r.resolution) main.appendChild(text("small", "Resolution: " + r.resolution, "pg-formnote"));

        var controls = document.createElement("div");
        controls.className = "admin-row-controls";
        var sel = document.createElement("select");
        sel.className = "admin-select";
        [["reviewing", "Reviewing"], ["actioned", "Actioned"], ["dismissed", "Dismissed"]].forEach(function (v) {
          var o = document.createElement("option"); o.value = v[0]; o.textContent = v[1]; o.selected = r.status === v[0]; sel.appendChild(o);
        });
        var save = text("button", "Resolve", "admin-btn admin-btn-primary admin-btn-sm");
        save.addEventListener("click", function () {
          promptModal("Resolve Report", "Enter resolution outcome note (for audit record):", r.resolution || "", function (res) {
            return api("/api/admin/reports/" + encodeURIComponent(r.id), {
              method: "POST", headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ status: sel.value, resolution: res })
            }).then(function () { note("Report resolved."); safeLoad(loadReports); safeLoad(loadOverview); });
          }, "Save Resolution", false);
        });
        controls.appendChild(sel);
        controls.appendChild(save);

        row.appendChild(main);
        row.appendChild(controls);
        root.appendChild(row);
      });
    });
  }

  /* ── 7. Withdrawals ────────────────────────────────────────── */
  function loadWithdrawals() {
    var root = $("#adminWithdrawalList");
    root.innerHTML = '<tr><td colspan="9" class="admin-td-center">Loading payouts…</td></tr>';
    var status = ($("#adminWithdrawalStatus") || {}).value || "pending";
    return api("/api/admin/withdrawals?status=" + encodeURIComponent(status)).then(function (j) {
      root.innerHTML = "";
      var list = j.withdrawals || [];
      if (!list.length) {
        root.innerHTML = '<tr><td colspan="9" class="admin-td-center">No ' + status + ' payouts.</td></tr>';
        return;
      }
      list.forEach(function (w) {
        var tr = document.createElement("tr");

        var payoutId = w.txId || w.id;
        var starAmt = w.starAmount != null ? w.starAmount : (w.stars || 0);
        var grossAmt = w.grossAmountINR != null ? w.grossAmountINR : (w.grossINR || 0);
        var netAmt = w.netAmountINR != null ? w.netAmountINR : (w.payoutINR || 0);

        tr.appendChild(text("td", new Date(w.requestedAt).toLocaleString()));
        var tdCreator = document.createElement("td");
        tdCreator.appendChild(text("b", w.creatorName || cleanHandle(w.creatorHandle)));
        tdCreator.appendChild(document.createElement("br"));
        tdCreator.appendChild(text("small", cleanHandle(w.creatorHandle), "pg-fine"));
        tr.appendChild(tdCreator);

        tr.appendChild(text("td", w.upiId || w.accountDetails || "UPI Not Specified"));
        var tdStarsW = document.createElement("td");
        tdStarsW.appendChild(iconText("star", starAmt));
        tr.appendChild(tdStarsW);
        tr.appendChild(text("td", "₹" + grossAmt));
        tr.appendChild(text("td", "₹" + netAmt));

        var tdSt = document.createElement("td");
        var stPill = text("span", (w.status || "pending").toUpperCase(), "admin-pill is-" + (w.status || "pending"));
        tdSt.appendChild(stPill);
        tr.appendChild(tdSt);

        tr.appendChild(text("td", w.utr ? "UTR: " + w.utr : "—"));

        var tdAct = document.createElement("td");
        tdAct.style.textAlign = "right";
        if (w.status === "pending" && window.SC_RELEASE && SC_RELEASE.monetizationEnabled) {
          var payBtn = text("button", "Mark Paid", "admin-btn admin-btn-success admin-btn-sm");
          payBtn.style.marginRight = "6px";
          payBtn.addEventListener("click", function () {
            promptModal("Process Payout", "Enter Bank Reference Number / UTR for this ₹" + netAmt + " payout:", "", function (utr) {
              return api("/api/admin/withdrawals/" + encodeURIComponent(payoutId) + "/process", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "mark_paid", utr: utr })
              }).then(function () { note("Payout marked as Paid!"); safeLoad(loadWithdrawals); safeLoad(loadOverview); });
            }, "Confirm Paid", false);
          });
          tdAct.appendChild(payBtn);

          var rejBtn = text("button", "Reject & Refund", "admin-btn admin-btn-danger admin-btn-sm");
          rejBtn.addEventListener("click", function () {
            promptModal("Reject Payout & Refund", "Enter mandatory rejection reason (Stars will be auto-refunded to creator):", "", function (reason) {
              return api("/api/admin/withdrawals/" + encodeURIComponent(payoutId) + "/process", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reject", reason: reason })
              }).then(function () { note("Payout rejected and Stars refunded."); safeLoad(loadWithdrawals); safeLoad(loadOverview); });
            }, "Reject & Refund", true);
          });
          tdAct.appendChild(rejBtn);
        } else {
          tdAct.appendChild(text("span", w.status === "pending" ? "Processing unavailable — Coming Soon" : "Read-only record", "pg-fine"));
        }
        tr.appendChild(tdAct);

        root.appendChild(tr);
      });
    });
  }

  /* ── 8. Star Ledger ────────────────────────────────────────── */
  function loadStarLedger() {
    var root = $("#adminLedgerList");
    root.innerHTML = '<tr><td colspan="9" class="admin-td-center">Loading star ledger…</td></tr>';
    var q = ($("#adminLedgerSearch") || {}).value || "";
    var kind = ($("#adminLedgerKindFilter") || {}).value || "";
    var url = "/api/admin/stars/ledger?q=" + encodeURIComponent(q) + "&kind=" + encodeURIComponent(kind);
    return api(url).then(function (j) {
      root.innerHTML = "";
      var txs = j.transactions || j.ledger || [];
      if (!txs.length) {
        root.innerHTML = '<tr><td colspan="9" class="admin-td-center">No transactions found.</td></tr>';
        return;
      }
      txs.forEach(function (tx) {
        var tr = document.createElement("tr");

        tr.appendChild(text("td", new Date(tx.createdAt).toLocaleString()));
        tr.appendChild(text("td", "#" + String(tx.id).slice(0, 8)));
        tr.appendChild(text("td", (tx.kind || "transaction").toUpperCase()));
        tr.appendChild(text("td", tx.senderHandle ? cleanHandle(tx.senderHandle) : (tx.sender || "System")));
        tr.appendChild(text("td", tx.receiverHandle ? cleanHandle(tx.receiverHandle) : (tx.receiver || "Platform")));
        var tdTxAmt = document.createElement("td");
        tdTxAmt.appendChild(iconText("star", (tx.amount || 0)));
        tr.appendChild(tdTxAmt);
        tr.appendChild(text("td", tx.balanceAfter != null ? tx.balanceAfter : "—"));
        tr.appendChild(text("td", tx.note ? String(tx.note).slice(0, 60) : "—"));

        var tdAct = document.createElement("td");
        tdAct.style.textAlign = "right";
        if (has("stars.manage") && tx.kind !== "reversed" && window.SC_RELEASE && SC_RELEASE.monetizationEnabled) {
          var revBtn = text("button", "Reverse", "admin-btn admin-btn-danger admin-btn-sm");
          revBtn.addEventListener("click", function () {
            promptModal("Reverse Star Transaction #" + tx.id, "Enter mandatory audit reason for reversing TX #" + tx.id + ":", "", function (reason) {
              return api("/api/admin/stars/transactions/" + encodeURIComponent(tx.id) + "/reverse", {
                method: "POST", headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ reason: reason })
              }).then(function () { note("Transaction reversed."); safeLoad(loadStarLedger); safeLoad(loadOverview); });
            }, "Reverse TX", true);
          });
          tdAct.appendChild(revBtn);
        }
        tr.appendChild(tdAct);

        root.appendChild(tr);
      });
    });
  }

  /* ── 9. Star Packs ─────────────────────────────────────────── */
  var starPacksCache = [];
  function loadStarPacks() {
    var root = $("#adminStarPacksList");
    root.innerHTML = "<p>Loading packs…</p>";
    return api("/api/admin/star-packs").then(function (j) {
      starPacksCache = j.packs || [];
      root.innerHTML = "";
      starPacksCache.forEach(function (p, idx) {
        var card = document.createElement("div");
        card.className = "admin-pack-card";

        card.appendChild(text("strong", p.label || ("Pack #" + (idx + 1))));

        var gPrice = document.createElement("div");
        gPrice.className = "admin-form-group";
        gPrice.appendChild(text("label", "Price INR (₹)"));
        var priceInput = document.createElement("input");
        priceInput.type = "number";
        priceInput.dataset.packField = "price";
        priceInput.dataset.packIdx = idx;
        priceInput.value = Number(p.price) || 0;
        priceInput.disabled = true;
        gPrice.appendChild(priceInput);
        card.appendChild(gPrice);

        var gStars = document.createElement("div");
        gStars.className = "admin-form-group";
        gStars.appendChild(text("label", "Stars Count"));
        var starsInput = document.createElement("input");
        starsInput.type = "number";
        starsInput.dataset.packField = "stars";
        starsInput.dataset.packIdx = idx;
        starsInput.value = Number(p.stars) || 0;
        starsInput.disabled = true;
        gStars.appendChild(starsInput);
        card.appendChild(gStars);

        var gPop = document.createElement("label");
        gPop.style.display = "flex";
        gPop.style.alignItems = "center";
        gPop.style.gap = "8px";
        gPop.innerHTML = "<input type='checkbox' disabled data-pack-field='popular' data-pack-idx='" + idx + "' " + (p.popular ? "checked" : "") + "> <span>Most Popular Badge</span>";
        card.appendChild(gPop);

        root.appendChild(card);
      });
    });
  }

  var savePacksBtn = $("#adminSaveStarPacksBtn");
  if (savePacksBtn) {
    savePacksBtn.disabled = true;
    savePacksBtn.textContent = "Star pack changes — Coming Soon";
    savePacksBtn.addEventListener("click", function () {
      if (!window.SC_RELEASE || !SC_RELEASE.monetizationEnabled) return;
      all("[data-pack-field]").forEach(function (inp) {
        var idx = parseInt(inp.getAttribute("data-pack-idx"), 10);
        var field = inp.getAttribute("data-pack-field");
        if (field === "popular") starPacksCache[idx][field] = inp.checked;
        else starPacksCache[idx][field] = Number(inp.value) || 0;
      });
      savePacksBtn.disabled = true;
      api("/api/admin/star-packs", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ packs: starPacksCache })
      }).then(function () { note("Star packs updated successfully."); safeLoad(loadStarPacks); })
        .catch(function (e) { note(e.message, true); })
        .finally(function () { savePacksBtn.disabled = false; });
    });
  }

  /* ── 10. AI & Conversion Jobs ──────────────────────────────── */
  function loadAiJobs() {
    var root = $("#adminAiJobList");
    root.innerHTML = '<tr><td colspan="8" class="admin-td-center">Loading AI jobs…</td></tr>';
    var status = ($("#adminAiJobStatus") || {}).value || "all";
    return api("/api/admin/ai-jobs?status=" + encodeURIComponent(status)).then(function (j) {
      root.innerHTML = "";
      var jobs = j.jobs || [];
      if (!jobs.length) {
        root.innerHTML = '<tr><td colspan="8" class="admin-td-center">No jobs recorded yet.</td></tr>';
        return;
      }
      jobs.forEach(function (job) {
        var tr = document.createElement("tr");

        tr.appendChild(text("td", "#" + String(job.id).slice(0, 8)));
        tr.appendChild(text("td", job.userHandle ? cleanHandle(job.userHandle) : (job.user || ("User #" + String(job.userId || "").slice(0, 6)))));

        var tdImg = document.createElement("td");
        var imgUrl = job.originalImage || job.imageName;
        tdImg.textContent = imgUrl || "—";
        tr.appendChild(tdImg);

        var tdSt = document.createElement("td");
        var stPill = text("span", (job.status || "queued").toUpperCase(), "admin-pill is-" + (job.status || "queued"));
        tdSt.appendChild(stPill);
        tr.appendChild(tdSt);

        var dur = job.duration != null ? job.duration : job.durationSec;
        tr.appendChild(text("td", dur != null ? dur + "s" : "—"));
        tr.appendChild(text("td", job.errorMessage ? job.errorMessage.slice(0, 60) : "OK"));
        tr.appendChild(text("td", new Date(job.createdAt).toLocaleString()));

        var tdAct = document.createElement("td");
        tdAct.style.textAlign = "right";
        if (job.status === "failed") tdAct.appendChild(text("small", "Ask the creator to retry from Designs. Background retry is not available."));
        tr.appendChild(tdAct);

        root.appendChild(tr);
      });
    });
  }

  /* ── 11. Broadcast Notifications ───────────────────────────── */
  var bcForm = $("#adminBroadcastForm");
  var bcTarget = $("#adBcTarget");
  var bcHandleGroup = $("#adBcHandleGroup");
  if (bcTarget && bcHandleGroup) {
    bcTarget.addEventListener("change", function () {
      bcHandleGroup.hidden = bcTarget.value !== "handle";
    });
  }
  if (bcForm) {
    bcForm.addEventListener("submit", function (e) {
      e.preventDefault();
      var btn = $("#adBcSubmitBtn");
      var payload = {
        target: $("#adBcTarget").value,
        targetHandle: $("#adBcHandle").value.trim(),
        title: $("#adBcTitle").value.trim(),
        message: $("#adBcMessage").value.trim(),
        link: $("#adBcLink").value.trim()
      };
      if (!payload.title || !payload.message) return;
      btn.disabled = true;
      api("/api/admin/notifications/broadcast", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).then(function (res) {
        note(res.message || "Broadcast notification sent successfully.");
        bcForm.reset();
        if (bcHandleGroup) bcHandleGroup.hidden = true;
      }).catch(function (err) {
        note(err.message, true);
      }).finally(function () {
        btn.disabled = false;
      });
    });
  }

  /* ── 12. Team & Staff Management (Owner Only) ──────────────── */
  function loadTeam() {
    var root = $("#adminTeamList");
    root.innerHTML = "<p>Loading staff…</p>";
    return api("/api/admin/staff").then(function (j) {
      PERMISSIONS = j.permissions || PERMISSIONS;
      ROLE_PRESETS = j.presets || ROLE_PRESETS;
      root.innerHTML = "";
      (j.staff || []).forEach(function (m) {
        var row = document.createElement("article");
        row.className = "admin-row";

        var main = document.createElement("div");
        main.className = "admin-row-main";
        var mName = text("strong", (m.displayName || cleanHandle(m.handle) || "Staff"));
        if (m.owner) { mName.appendChild(document.createTextNode(" · ")); mName.appendChild(adminIcon("shieldCheck")); mName.appendChild(document.createTextNode(" Owner")); }
        main.appendChild(mName);
        main.appendChild(text("span", cleanHandle(m.handle || "no-handle") + (m.email ? " · " + m.email : "")));
        var mRole = text("small", "");
        if (m.owner) { mRole.textContent = "Unrestricted Super Admin. Immune to changes."; }
        else {
          mRole.appendChild(adminIcon(m.role === "sub_admin" ? "shield" : "eye"));
          mRole.appendChild(document.createTextNode(" " + (m.role === "sub_admin" ? "Sub Admin" : "Moderator") + " · " + (m.permissions || []).length + " active permissions"));
        }
        main.appendChild(mRole);

        row.appendChild(main);

        if (!m.owner && isOwner()) {
          var editBtn = text("button", "Configure Permissions", "admin-btn admin-btn-outline admin-btn-sm");
          editBtn.addEventListener("click", function () {
            var open = row.nextElementSibling && row.nextElementSibling.classList.contains("admin-access");
            if (open) { row.nextElementSibling.remove(); return; }
            row.insertAdjacentElement("afterend", staffAccessEditor(m, function () { safeLoad(loadTeam); }));
          });
          row.appendChild(editBtn);
        }
        root.appendChild(row);
      });
    });
  }

  function staffAccessEditor(member, onSaved) {
    var box = document.createElement("div");
    box.className = "admin-access";

    box.appendChild(text("strong", "Staff Permissions for " + cleanHandle(member.handle)));
    box.appendChild(text("p", "Select a role preset or customize granular permission flags. Sub Admins have broad operations access; Moderators focus on content & safety.", "pg-fine"));
    var roleGroup = document.createElement("label");
    roleGroup.className = "admin-form-group";
    roleGroup.appendChild(text("span", "Staff role"));
    var staffRole = document.createElement("select");
    staffRole.className = "admin-select";
    [["moderator", "Moderator"], ["sub_admin", "Sub Admin"]].forEach(function (item) {
      var option = text("option", item[1]);
      option.value = item[0];
      staffRole.appendChild(option);
    });
    staffRole.value = member.role === "sub_admin" || member.role === "admin" ? "sub_admin" : "moderator";
    roleGroup.appendChild(staffRole);
    box.appendChild(roleGroup);

    var presetBar = document.createElement("div");
    presetBar.style.display = "flex";
    presetBar.style.gap = "8px";
    presetBar.style.margin = "8px 0";

    var modPreset = text("button", "Preset: Moderator", "admin-btn admin-btn-outline admin-btn-sm");
    modPreset.type = "button";
    modPreset.addEventListener("click", function () {
      staffRole.value = "moderator";
      var keys = ROLE_PRESETS.moderator || [];
      all(box.querySelectorAll("input[type=checkbox]")).forEach(function (cb) {
        cb.checked = keys.indexOf(cb.value) !== -1;
      });
    });
    presetBar.appendChild(modPreset);

    var subAdminPreset = text("button", "Preset: Sub Admin", "admin-btn admin-btn-outline admin-btn-sm");
    subAdminPreset.type = "button";
    subAdminPreset.addEventListener("click", function () {
      staffRole.value = "sub_admin";
      var keys = ROLE_PRESETS.sub_admin || [];
      all(box.querySelectorAll("input[type=checkbox]")).forEach(function (cb) {
        cb.checked = keys.indexOf(cb.value) !== -1;
      });
    });
    presetBar.appendChild(subAdminPreset);
    box.appendChild(presetBar);

    var list = document.createElement("div");
    list.className = "admin-access-list";
    PERMISSIONS.forEach(function (p) {
      var label = document.createElement("label");
      label.className = "admin-access-item";
      var cb = document.createElement("input");
      cb.type = "checkbox";
      cb.value = p.key;
      cb.checked = (member.permissions || []).indexOf(p.key) !== -1;
      var words = document.createElement("span");
      words.appendChild(text("b", (p.group ? "[" + p.group + "] " : "") + p.label));
      words.appendChild(text("small", p.hint));
      label.appendChild(cb);
      label.appendChild(words);
      list.appendChild(label);
    });
    box.appendChild(list);

    var actions = document.createElement("div");
    actions.className = "admin-access-actions";
    actions.style.marginTop = "12px";

    var save = text("button", "Save Staff Permissions", "admin-btn admin-btn-primary admin-btn-sm");
    save.type = "button";
    var removeBtn = text("button", "Revoke Admin Access", "admin-btn admin-btn-danger admin-btn-sm");
    removeBtn.type = "button";
    var cancel = text("button", "Cancel", "admin-btn admin-btn-outline admin-btn-sm");
    cancel.type = "button";

    function submit(perms, role) {
      save.disabled = removeBtn.disabled = true;
      api("/api/admin/users/" + encodeURIComponent(member.id) + "/staff", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: perms, role: role })
      }).then(function () {
        note("Staff access updated.");
        box.remove();
        if (onSaved) onSaved();
      }).catch(function (err) { note(err.message, true); })
        .finally(function () { save.disabled = removeBtn.disabled = false; });
    }

    save.addEventListener("click", function () {
      var perms = all(list.querySelectorAll("input:checked")).map(function (cb) { return cb.value; });
      submit(perms, staffRole.value);
    });
    removeBtn.addEventListener("click", function () {
      promptModal("Revoke Access", "Type CONFIRM to revoke all staff access for " + cleanHandle(member.handle) + ":", "", function (val) {
        if (val.trim().toUpperCase() !== "CONFIRM") throw new Error("Type CONFIRM to proceed.");
        return submit([], "user");
      }, "Revoke Access", true);
    });
    cancel.addEventListener("click", function () { box.remove(); });

    actions.appendChild(save);
    actions.appendChild(removeBtn);
    actions.appendChild(cancel);
    box.appendChild(actions);
    return box;
  }

  /* ── 13. Support ───────────────────────────────────────────── */
  function loadSupport() {
    var root = $("#adminTicketList");
    root.innerHTML = "<p>Loading tickets…</p>";
    return api("/api/admin/support/tickets").then(function (j) {
      root.innerHTML = "";
      var tickets = j.tickets || [];
      if (!tickets.length) {
        root.appendChild(text("p", "No feedback or support messages yet.", "pg-fine"));
        return;
      }
      tickets.forEach(function (t) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "admin-ticket-button";
        btn.appendChild(text("strong", t.subject));
        btn.appendChild(text("span", t.reference + " · " + (t.status || "").replace(/_/g, " ").toUpperCase()));
        btn.appendChild(text("small", t.email + " · " + (t.messageCount || 0) + " messages · " + new Date(t.createdAt).toLocaleDateString()));
        btn.addEventListener("click", function () { openTicket(t.id).catch(function (err) { note(err.message, true); }); });
        root.appendChild(btn);
      });
    });
  }

  function openTicket(id) {
    activeTicketId = id;
    var root = $("#adminTicketView");
    root.innerHTML = "<p>Loading ticket thread…</p>";
    return api("/api/support/tickets/" + encodeURIComponent(id)).then(function (j) {
      var ticket = j.ticket;
      root.innerHTML = "";
      root.appendChild(text("h3", ticket.subject));
      root.appendChild(text("p", ticket.reference + " · " + ticket.email, "pg-fine"));

      var msgs = document.createElement("div");
      msgs.className = "admin-ticket-messages";
      (ticket.messages || []).forEach(function (m) {
        var msg = document.createElement("article");
        msg.className = "admin-message is-" + m.role;
        msg.appendChild(text("strong", m.authorName || m.role));
        msg.appendChild(text("p", m.body));
        msg.appendChild(text("small", new Date(m.createdAt).toLocaleString()));
        msgs.appendChild(msg);
      });
      root.appendChild(msgs);

      var form = document.createElement("form");
      form.className = "admin-reply-form";
      var area = document.createElement("textarea");
      area.required = true; area.maxLength = 4000; area.rows = 3; area.placeholder = "Write a clear support reply…";
      var send = text("button", "Send Reply", "admin-btn admin-btn-primary admin-btn-sm");
      send.type = "submit";
      form.appendChild(area);
      form.appendChild(send);
      form.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (!area.value.trim()) return;
        send.disabled = true;
        api("/api/support/tickets/" + encodeURIComponent(id) + "/messages", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: area.value })
        }).then(function () { note("Reply sent."); if (activeTicketId === id) openTicket(id).catch(function (err) { note(err.message, true); }); safeLoad(loadSupport); })
          .catch(function (err) { note(err.message, true); })
          .finally(function () { send.disabled = false; });
      });
      root.appendChild(form);

      var stateDiv = document.createElement("div");
      stateDiv.className = "admin-ticket-state";
      var sel = document.createElement("select");
      sel.className = "admin-select";
      ["open", "in_progress", "waiting_on_user", "resolved", "closed"].forEach(function (v) {
        var o = document.createElement("option"); o.value = v; o.textContent = v.replace(/_/g, " ").toUpperCase();
        o.selected = ticket.status === v;
        sel.appendChild(o);
      });
      var upBtn = text("button", "Update Status", "admin-btn admin-btn-outline admin-btn-sm");
      upBtn.addEventListener("click", function () {
        api("/api/admin/support/tickets/" + encodeURIComponent(id), {
          method: "PATCH", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status: sel.value })
        }).then(function () { note("Ticket status updated."); safeLoad(loadSupport); safeLoad(loadOverview); })
          .catch(function (err) { note(err.message, true); });
      });
      stateDiv.appendChild(sel);
      stateDiv.appendChild(upBtn);
      root.appendChild(stateDiv);
    });
  }

  /* ── 14. System (Flags & Audit Logs) ───────────────────────── */
  function loadFlags() {
    var root = $("#adminFlagList");
    root.innerHTML = "<p>Loading flags…</p>";
    return api("/api/admin/feature-flags").then(function (j) {
      root.innerHTML = "";
      (j.flags || []).forEach(function (flag) {
        var row = document.createElement("article");
        row.className = "admin-row";

        var main = document.createElement("div");
        main.className = "admin-row-main";
        main.appendChild(text("strong", flag.key.replace(/_/g, " ")));
        main.appendChild(text("span", flag.description || "Platform feature switch"));

        var toggle = document.createElement("input");
        toggle.type = "checkbox";
        toggle.checked = flag.enabled;
        toggle.style.width = "20px";
        toggle.style.height = "20px";
        var supported = flag.runtimeSupported === true;
        toggle.disabled = !has("flags.manage") || !supported;
        toggle.setAttribute("aria-label", flag.key.replace(/_/g, " "));
        if (!supported) main.appendChild(text("small", flag.readOnlyReason || "Read-only record. This legacy flag does not control the running service.", "pg-fine"));
        toggle.addEventListener("change", function () {
          if (!has("flags.manage") || !supported) { toggle.checked = flag.enabled; return; }
          toggle.disabled = true;
          api("/api/admin/feature-flags/" + encodeURIComponent(flag.key), {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ enabled: toggle.checked })
          }).then(function () { note("Feature flag updated."); })
            .catch(function (err) { toggle.checked = !toggle.checked; note(err.message, true); })
            .finally(function () { toggle.disabled = !has("flags.manage") || !supported; });
        });

        row.appendChild(main);
        row.appendChild(toggle);
        root.appendChild(row);
      });
    });
  }

  function loadAuditLogs() {
    var root = $("#adminAuditLogList");
    root.innerHTML = '<tr><td colspan="5" class="admin-td-center">Loading audit trail…</td></tr>';
    var q = ($("#adminAuditSearch") || {}).value || "";
    return api("/api/admin/audit-logs?q=" + encodeURIComponent(q)).then(function (j) {
      root.innerHTML = "";
      var logs = j.logs || [];
      if (!logs.length) {
        root.innerHTML = '<tr><td colspan="5" class="admin-td-center">No audit records found.</td></tr>';
        return;
      }
      logs.forEach(function (log) {
        var tr = document.createElement("tr");
        tr.appendChild(text("td", new Date(log.created_at).toLocaleString()));
        tr.appendChild(text("td", log.actor_name || cleanHandle(log.actor_handle || "admin")));
        tr.appendChild(text("td", (log.action || "").toUpperCase()));
        tr.appendChild(text("td", (log.entity_type || "") + (log.entity_id ? " (#" + String(log.entity_id).slice(0, 8) + ")" : "")));

        var tdDetails = document.createElement("td");
        var diff = log.after_data ? JSON.stringify(log.after_data) : (log.before_data ? JSON.stringify(log.before_data) : "—");
        tdDetails.appendChild(text("small", diff.slice(0, 90) + (diff.length > 90 ? "…" : ""), "pg-fine"));
        tr.appendChild(tdDetails);

        root.appendChild(tr);
      });
    });
  }

  function loadSystem() {
    var tasks = [];
    if (has("flags.manage")) tasks.push(loadFlags());
    if (has("audit.view")) tasks.push(loadAuditLogs());
    return Promise.all(tasks);
  }

  /* ── Tab Switcher & Navigation Routing ─────────────────────── */
  var loaders = {
    overview: loadOverview,
    users: loadUsers,
    creators: loadCreators,
    content: loadTemplates,
    skills: loadSkills,
    reports: loadReports,
    withdrawals: loadWithdrawals,
    stars_ledger: loadStarLedger,
    star_packs: loadStarPacks,
    ai_jobs: loadAiJobs,
    broadcast: function () { return Promise.resolve(); },
    team: loadTeam,
    support: loadSupport,
    system: loadSystem
  };

  var descriptions = {
    overview: "Live platform metrics, moderation queues, and operations.",
    users: "Search accounts and manage roles, safety, and bonus credits.",
    creators: "Published creators, star balances, and verification badges.",
    content: "Inspect submitted animations and designs in a protected preview before publishing.",
    skills: "Review creator tutorials and educational video links.",
    reports: "Investigate safety reports with an audited moderation outcome.",
    withdrawals: "Creator payout requests and settlement records.",
    stars_ledger: "Read-only transaction ledger across purchases, tips, and adjustments.",
    star_packs: "Stored Star pack tiers and pricing configuration.",
    ai_jobs: "AI conversion job history, durations, and failure diagnostics.",
    broadcast: "Deliver in-app announcements to all users or targeted segments.",
    team: "Owner-managed staff roles and granular permission controls.",
    support: "Read user support tickets, reply directly, and update status.",
    system: "Platform feature flags and immutable administrative audit logs."
  };

  var sectionTitles = {
    overview: "Overview",
    users: "Users",
    creators: "Creators",
    content: "Template review",
    skills: "Tutorial review",
    reports: "Reports",
    withdrawals: "Withdrawals",
    stars_ledger: "Star ledger",
    star_packs: "Star packs",
    ai_jobs: "AI jobs",
    broadcast: "Broadcast",
    team: "Team & roles",
    support: "Support",
    system: "System"
  };

  function refreshTab(key, loader, successMessage) {
    if (allowedTabs.indexOf(key) === -1) return Promise.resolve();
    var panel = document.querySelector('[data-admin-panel="' + key + '"]');
    if (!panel) return Promise.resolve();
    var generation = (loadGeneration[key] || 0) + 1;
    loadGeneration[key] = generation;
    panel.setAttribute("aria-busy", "true");
    var previous = panel.querySelector(".admin-load-error");
    if (previous) previous.remove();
    if (activeTab === key) setText("#adminLiveStatus", "Loading section…");
    return Promise.resolve().then(loader || loaders[key]).then(function () {
      if (loadGeneration[key] !== generation) return;
      loaded[key] = true;
      if (activeTab === key) {
        setText("#adminLiveStatus", "Server data");
        if (successMessage) note(successMessage);
      }
    }).catch(function (err) {
      if (err.stale || loadGeneration[key] !== generation) return;
      loaded[key] = false;
      if (activeTab === key) {
        setText("#adminLiveStatus", "Data unavailable");
        note(err.message || "This section could not be loaded.", true);
      }
    }).finally(function () {
      if (loadGeneration[key] === generation) panel.setAttribute("aria-busy", "false");
    });
  }

  function selectTab(key) {
    if (!loaders[key] || allowedTabs.indexOf(key) === -1) key = allowedTabs[0];
    if (!key) return null;
    Object.keys(pendingReads).forEach(function (path) {
      var pending = pendingReads[path];
      if (pending.section && pending.section !== key) {
        readGeneration[path] = (readGeneration[path] || 0) + 1;
        pending.controller.abort();
        delete pendingReads[path];
      }
    });
    activeTab = key;

    all("[data-admin-tab]").forEach(function (b) {
      var on = b.getAttribute("data-admin-tab") === key;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      if (on) b.setAttribute("aria-current", "page"); else b.removeAttribute("aria-current");
    });

    all("[data-admin-mobile-nav]").forEach(function (b) {
      var on = b.getAttribute("data-admin-mobile-nav") === key;
      b.setAttribute("aria-pressed", on ? "true" : "false");
    });

    var mobSel = $("#adminMobileTabSelect");
    if (mobSel && mobSel.value !== key) mobSel.value = key;

    all("[data-admin-panel]").forEach(function (p) {
      p.hidden = p.getAttribute("data-admin-panel") !== key;
    });
    var selected = document.querySelector('[data-admin-tab="' + key + '"]');
    setText("#adminSectionTitle", sectionTitles[key] || (selected ? selected.textContent.trim() : "Admin"));
    setText("#adminSectionDescription", descriptions[key] || "");
    var contentScroller = $(".mc-main");
    if (contentScroller) contentScroller.scrollTop = 0;
    window.scrollTo(0, 0);
    if (!loaded[key]) refreshTab(key);
    return key;
  }

  function navigate(key, replace) {
    var selected = selectTab(key);
    if (selected && location.hash !== "#" + selected) {
      history[replace ? "replaceState" : "pushState"](null, "", "#" + selected);
    }
  }

  all("[data-admin-tab]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-admin-tab");
      loaded[key] = false;
      navigate(key);
    });
  });

  all("[data-admin-mobile-nav]").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var key = btn.getAttribute("data-admin-mobile-nav");
      loaded[key] = false;
      navigate(key);
    });
  });

  var mobSel = $("#adminMobileTabSelect");
  if (mobSel) {
    mobSel.addEventListener("change", function () {
      var key = mobSel.value;
      loaded[key] = false;
      navigate(key);
    });
  }

  all("[data-admin-jump]").forEach(function (b) {
    b.addEventListener("click", function () {
      var target = b.getAttribute("data-admin-jump");
      loaded[target] = false;
      navigate(target);
    });
  });

  all("[data-admin-refresh]").forEach(function (b) {
    b.addEventListener("click", function () {
      var k = b.getAttribute("data-admin-refresh");
      refreshTab(k, null, "Refreshed.");
    });
  });

  var globRefresh = $("#adminGlobalRefreshBtn");
  if (globRefresh) {
    globRefresh.addEventListener("click", function () {
      refreshTab(activeTab, null, "View refreshed.");
    });
  }

  var themeBtn = $("#adminThemeToggleBtn");
  if (themeBtn) {
    themeBtn.addEventListener("click", function () {
      var cur = document.documentElement.dataset.theme === "dark" ? "dark" : "light";
      var next = cur === "dark" ? "light" : "dark";
      document.documentElement.dataset.theme = next;
      try { localStorage.setItem("sc_theme", next); } catch (_) {}
    });
  }

  var uSearch = $("#adminUserSearch");
  if (uSearch) {
    var uTimer;
    uSearch.addEventListener("input", function () {
      clearTimeout(uTimer);
      uTimer = setTimeout(function () { safeLoad(loadUsers); }, 280);
    });
  }
  var uRole = $("#adminUserRoleFilter");
  if (uRole) uRole.addEventListener("change", function () { safeLoad(loadUsers); });
  var uPlan = $("#adminUserPlanFilter");
  if (uPlan) uPlan.addEventListener("change", function () { safeLoad(loadUsers); });

  var cSearch = $("#adminCreatorSearch");
  if (cSearch) {
    var cTimer;
    cSearch.addEventListener("input", function () {
      clearTimeout(cTimer);
      cTimer = setTimeout(function () { safeLoad(loadCreators); }, 280);
    });
  }

  var tFilter = $("#adminTemplateFilter");
  if (tFilter) tFilter.addEventListener("change", function () { safeLoad(loadTemplates); });
  ["#adminTemplateCategory", "#adminTemplateType"].forEach(function (selector) {
    var el = $(selector);
    if (el) el.addEventListener("change", function () { safeLoad(loadTemplates); });
  });

  var sFilter = $("#adminSkillStatus");
  if (sFilter) sFilter.addEventListener("change", function () { safeLoad(loadSkills); });

  var rFilter = $("#adminReportStatus");
  if (rFilter) rFilter.addEventListener("change", function () { safeLoad(loadReports); });

  var wFilter = $("#adminWithdrawalStatus");
  if (wFilter) wFilter.addEventListener("change", function () { safeLoad(loadWithdrawals); });

  var lSearch = $("#adminLedgerSearch");
  if (lSearch) {
    var lTimer;
    lSearch.addEventListener("input", function () {
      clearTimeout(lTimer);
      lTimer = setTimeout(function () { safeLoad(loadStarLedger); }, 280);
    });
  }
  var lKind = $("#adminLedgerKindFilter");
  if (lKind) lKind.addEventListener("change", function () { safeLoad(loadStarLedger); });

  var aiFilter = $("#adminAiJobStatus");
  if (aiFilter) aiFilter.addEventListener("change", function () { safeLoad(loadAiJobs); });

  var auditSearch = $("#adminAuditSearch");
  if (auditSearch) {
    var aTimer;
    auditSearch.addEventListener("input", function () {
      clearTimeout(aTimer);
      aTimer = setTimeout(function () { safeLoad(loadAuditLogs); }, 280);
    });
  }

  var MC_SEARCH_INDEX = [
    { key: "overview", label: "Overview", hint: "dashboard", keys: "dashboard home overview stats activity" },
    { key: "users", label: "Users", hint: "accounts", keys: "users accounts database search" },
    { key: "creators", label: "Creators", hint: "directory", keys: "creators directory verified badges" },
    { key: "team", label: "Team & Roles", hint: "staff", keys: "team staff roles permissions" },
    { key: "content", label: "Templates", hint: "moderation", keys: "templates moderation animations designs review approve" },
    { key: "skills", label: "Tutorials", hint: "learning", keys: "tutorials skills learning creator" },
    { key: "reports", label: "Safety Reports", hint: "safety", keys: "reports safety abuse review" },
    { key: "withdrawals", label: "Withdrawals", hint: "payouts", keys: "withdrawals payouts money upi stars" },
    { key: "stars_ledger", label: "Star Ledger", hint: "transactions", keys: "ledger transactions stars history" },
    { key: "star_packs", label: "Star Packs", hint: "pricing", keys: "star packs pricing setup" },
    { key: "ai_jobs", label: "AI Jobs", hint: "conversion", keys: "ai conversion jobs history failures" },
    { key: "broadcast", label: "Broadcast", hint: "notify", keys: "broadcast notifications announce message" },
    { key: "support", label: "Support Queue", hint: "tickets", keys: "support tickets help reply" },
    { key: "system", label: "System & Audit", hint: "flags", keys: "system feature flags audit logs" }
  ];
  (function mcWireSearch() {
    var inp = $("#mcSearch"), box = $("#mcSearchResults");
    if (!inp || !box) return;
    function close() { box.hidden = true; box.innerHTML = ""; }
    function go(s) { close(); inp.value = ""; loaded[s.key] = false; navigate(s.key); inp.blur(); }
    inp.addEventListener("input", function () {
      var q = inp.value.trim().toLowerCase();
      box.innerHTML = "";
      if (!q) { close(); return; }
      var hits = MC_SEARCH_INDEX.filter(function (s) {
        return allowedTabs.indexOf(s.key) !== -1 &&
          (s.label.toLowerCase().indexOf(q) > -1 || s.keys.indexOf(q) > -1);
      }).slice(0, 7);
      if (!hits.length) { close(); return; }
      hits.forEach(function (s) {
        var b = document.createElement("button");
        b.type = "button";
        b.innerHTML = '<svg class="mc-ic" aria-hidden="true"><use href="#mc-i-search"/></svg>';
        var lb = document.createElement("span"); lb.textContent = s.label; b.appendChild(lb);
        var sm = document.createElement("small"); sm.textContent = s.hint; b.appendChild(sm);
        b.addEventListener("mousedown", function (e) { e.preventDefault(); go(s); });
        box.appendChild(b);
      });
      box.hidden = false;
    });
    inp.addEventListener("keydown", function (e) {
      if (e.key === "Enter") {
        var first = box.querySelector("button");
        if (first && !box.hidden) { e.preventDefault(); first.dispatchEvent(new MouseEvent("mousedown", { bubbles: true })); }
      }
      if (e.key === "Escape") { close(); inp.blur(); }
    });
    inp.addEventListener("blur", function () { setTimeout(close, 150); });
    document.addEventListener("keydown", function (e) {
      if ((e.metaKey || e.ctrlKey) && String(e.key || "").toLowerCase() === "k") {
        e.preventDefault();
        inp.focus();
        inp.select();
      }
    });
  })();

  (function mcWireTemplates() {
    var bArch = $("#mcBulkArchive");
    if (bArch) bArch.addEventListener("click", function () {
      var n = Object.keys(mcTplSelected).length;
      if (!n) return;
      openModal("Archive " + n + " template(s)", function (body) {
        body.appendChild(text("p", "Archive the selected templates? They will be hidden from the public listing.", "pg-fine"));
      }, function () { return mcBulkSetStatus("archived"); }, "Archive selected");
    });
    var bRej = $("#mcBulkReject");
    if (bRej) bRej.addEventListener("click", function () {
      var n = Object.keys(mcTplSelected).length;
      if (!n) return;
      promptModal("Reject " + n + " template(s)", "Enter rejection reason (applied to all selected):", "", function (reason) {
        return mcBulkSetStatus("rejected", reason);
      }, "Reject selected", true);
    });
    var bClr = $("#mcBulkClear");
    if (bClr) bClr.addEventListener("click", mcClearTplSelection);
    var tSearch = $("#mcTplSearch");
    if (tSearch) tSearch.addEventListener("input", function () {
      var q = tSearch.value.trim().toLowerCase();
      all("#adminTemplateList article").forEach(function (card) {
        var ok = !q || (card.getAttribute("data-title") || "").indexOf(q) > -1 || (card.getAttribute("data-creator") || "").indexOf(q) > -1;
        card.style.display = ok ? "" : "none";
      });
    });
  })();

  function safeLoad(loader) {
    var key = Object.keys(loaders).find(function (name) { return loaders[name] === loader; });
    if (loader === loadFlags || loader === loadAuditLogs) key = "system";
    if (loader === loadFlags && !has("flags.manage")) return Promise.resolve();
    if (loader === loadAuditLogs && !has("audit.view")) return Promise.resolve();
    return refreshTab(key, loader);
  }

  window.addEventListener("hashchange", function () { if (allowedTabs.length) navigate(location.hash.slice(1), true); });
  window.addEventListener("popstate", function () { if (allowedTabs.length) navigate(location.hash.slice(1), true); });

  /* ── Boot Initializer ──────────────────────────────────────── */
  function checkAccess() {
    return api("/api/auth/me").then(function (j) {
      currentUser = j.user;
      if (!showAccess(currentUser)) return;

      allowedTabs = [];
      all("[data-admin-tab]").forEach(function (b) {
        var key = b.getAttribute("data-admin-tab");
        var ok = hasAny(b.getAttribute("data-perm"));
        b.hidden = !ok;
        if (ok && allowedTabs.indexOf(key) === -1) allowedTabs.push(key);
      });

      all("[data-admin-mobile-nav]").forEach(function (b) {
        var key = b.getAttribute("data-admin-mobile-nav");
        b.hidden = allowedTabs.indexOf(key) === -1;
      });

      all("[data-admin-group]").forEach(function (group) {
        group.hidden = !group.querySelector('[data-admin-tab]:not([hidden])');
      });
      all("[data-admin-jump]").forEach(function (button) {
        button.hidden = allowedTabs.indexOf(button.getAttribute("data-admin-jump")) === -1;
      });
      all("[data-admin-permission]").forEach(function (section) {
        section.hidden = !hasAny(section.getAttribute("data-admin-permission"));
      });

      if (mobSel) {
        all(mobSel.options).forEach(function (opt) {
          if (allowedTabs.indexOf(opt.value) === -1) opt.remove();
        });
      }

      all("[data-admin-panel]").forEach(function (p) {
        if (allowedTabs.indexOf(p.getAttribute("data-admin-panel")) === -1) p.hidden = true;
      });

      var wanted = String(location.hash || "").replace("#", "");
      navigate(wanted, true);
    }).catch(function (err) {
      currentUser = null; allowedTabs = []; activeTab = null;
      $("#adminApp").hidden = true;
      var gate = $("#adminGate");
      gate.hidden = false;
      gate.innerHTML = "";
      gate.appendChild(text("h1", "Admin access could not be checked"));
      var error = text("p", err.message || "The connection failed. Please retry.");
      error.setAttribute("role", "alert");
      gate.appendChild(error);
      var retry = text("button", "Retry access check", "admin-btn admin-btn-primary");
      retry.type = "button";
      retry.addEventListener("click", function () {
        retry.disabled = true;
        retry.textContent = "Checking access…";
        checkAccess();
      });
      gate.appendChild(retry);
    });
  }

  checkAccess();
})();
