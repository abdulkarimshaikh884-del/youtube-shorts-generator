(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var all = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var currentUser = null;
  var activeTicketId = null;
  var PERMISSIONS = [];

  function api(url, options) {
    return fetch(url, options).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.success) throw new Error(j.error || "Request failed.");
        return j;
      });
    });
  }

  function note(message, bad) {
    var el = $("#adminNote");
    if (!el) return;
    el.textContent = message || "";
    el.toggleAttribute("data-bad", !!bad);
  }

  function text(tag, value, className) {
    var el = document.createElement(tag);
    if (className) el.className = className;
    el.textContent = value == null ? "" : String(value);
    return el;
  }

  function isOwner() { return !!currentUser && currentUser.role === "super_admin"; }
  function has(perm) {
    if (!currentUser) return false;
    if (perm === "owner") return isOwner();
    return (currentUser.permissions || []).indexOf(perm) !== -1;
  }

  function showAccess(user) {
    var allowed = user && Array.isArray(user.permissions) && user.permissions.length > 0;
    if (!allowed) {
      $("#adminGate").innerHTML = '<span class="pg-kicker">Private workspace</span><h1>Admin access required</h1><p>This console is for the ShortsCraft owner and the people the owner appoints. If you were given access, log in with that account.</p><a class="pg-bw" href="/login?next=%2Fadmin">Log in</a>';
      return false;
    }
    $("#adminGate").hidden = true;
    $("#adminApp").hidden = false;
    return true;
  }

  function loadOverview() {
    return api("/api/admin/dashboard").then(function (j) {
      var s = j.stats || {};
      $("#adUsers").textContent = s.users || 0;
      $("#adNewUsers").textContent = s.new_users_30d || 0;
      $("#adPublished").textContent = s.published_templates || 0;
      $("#adScheduled").textContent = s.scheduled_templates || 0;
      $("#adExports").textContent = s.exports_30d || 0;
      $("#adAi").textContent = s.ai_generations_30d || 0;
      $("#adTickets").textContent = s.open_tickets || 0;
      $("#adReports").textContent = s.open_reports || 0;
    });
  }

  function refreshOverview() {
    return has("overview.view") ? loadOverview() : Promise.resolve();
  }

  function loadTemplates() {
    var root = $("#adminTemplateList");
    root.innerHTML = "<p>Loading templates…</p>";
    return api("/api/admin/templates").then(function (j) {
      root.innerHTML = "";
      if (!j.templates.length) { root.appendChild(text("p", "No creator templates yet.")); return; }
      j.templates.forEach(function (item) {
        var row = document.createElement("article");
        row.className = "admin-row";
        var main = document.createElement("div"); main.className = "admin-row-main";
        main.appendChild(text("strong", item.title));
        main.appendChild(text("span", (item.authorHandle || item.authorName) + " · " + item.templateId));
        main.appendChild(text("small", item.likes + " likes · " + item.comments + " comments · " + item.exports + " exports"));
        var controls = document.createElement("div"); controls.className = "admin-row-controls";
        var select = document.createElement("select");
        ["review", "published", "rejected", "archived"].forEach(function (v) {
          var o = document.createElement("option"); o.value = v; o.textContent = v; o.selected = item.status === v; select.appendChild(o);
        });
        var input = document.createElement("input"); input.type = "text"; input.maxLength = 1000; input.placeholder = "Review note"; input.value = item.reviewNote || "";
        var save = text("button", "Save", "pg-bo"); save.type = "button";
        save.addEventListener("click", function () {
          save.disabled = true;
          api("/api/admin/templates/" + encodeURIComponent(item.id), {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: select.value, reviewNote: input.value })
          }).then(function () { note("Template moderation saved."); return refreshOverview(); })
            .catch(function (err) { note(err.message, true); }).finally(function () { save.disabled = false; });
        });
        controls.appendChild(select); controls.appendChild(input); controls.appendChild(save);
        row.appendChild(main); row.appendChild(controls); root.appendChild(row);
      });
    });
  }

  function loadSupport() {
    var root = $("#adminTicketList");
    root.innerHTML = "<p>Loading tickets…</p>";
    return api("/api/admin/support/tickets").then(function (j) {
      root.innerHTML = "";
      if (!j.tickets.length) { root.appendChild(text("p", "No feedback or support messages yet.")); return; }
      j.tickets.forEach(function (ticket) {
        var button = document.createElement("button"); button.type = "button"; button.className = "admin-ticket-button";
        button.appendChild(text("strong", ticket.subject));
        button.appendChild(text("span", ticket.reference + " · " + ticket.status.replace(/_/g, " ")));
        button.appendChild(text("small", ticket.email + " · " + (ticket.messageCount || 0) + " messages · " + new Date(ticket.createdAt).toLocaleDateString()));
        button.addEventListener("click", function () { openTicket(ticket.id); });
        root.appendChild(button);
      });
    });
  }

  function openTicket(id) {
    activeTicketId = id;
    var root = $("#adminTicketView"); root.innerHTML = "<p>Loading conversation…</p>";
    return api("/api/support/tickets/" + encodeURIComponent(id)).then(function (j) {
      var ticket = j.ticket; root.innerHTML = "";
      root.appendChild(text("h3", ticket.subject));
      root.appendChild(text("p", ticket.reference + " · " + ticket.email, "pg-fine"));
      var messages = document.createElement("div"); messages.className = "admin-ticket-messages";
      ticket.messages.forEach(function (m) {
        var msg = document.createElement("article"); msg.className = "admin-message is-" + m.role;
        msg.appendChild(text("strong", m.authorName));
        msg.appendChild(text("p", m.body));
        msg.appendChild(text("small", new Date(m.createdAt).toLocaleString()));
        messages.appendChild(msg);
      });
      root.appendChild(messages);
      var form = document.createElement("form"); form.className = "admin-reply-form";
      var area = document.createElement("textarea"); area.required = true; area.maxLength = 4000; area.rows = 4; area.placeholder = "Write a clear support reply…";
      var send = text("button", "Send reply", "pg-bw"); send.type = "submit";
      form.appendChild(area); form.appendChild(send);
      form.addEventListener("submit", function (ev) {
        ev.preventDefault(); if (!area.value.trim()) return;
        send.disabled = true;
        api("/api/support/tickets/" + encodeURIComponent(id) + "/messages", {
          method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message: area.value })
        }).then(function () { note("Support reply sent."); return Promise.all([openTicket(id), loadSupport(), refreshOverview()]); })
          .catch(function (err) { note(err.message, true); }).finally(function () { send.disabled = false; });
      });
      root.appendChild(form);
      var state = document.createElement("div"); state.className = "admin-ticket-state";
      var status = document.createElement("select");
      ["open", "in_progress", "waiting_on_user", "resolved", "closed"].forEach(function (v) {
        var o = document.createElement("option"); o.value = v; o.textContent = v.replace(/_/g, " "); o.selected = ticket.status === v; status.appendChild(o);
      });
      var save = text("button", "Update status", "pg-bo"); save.type = "button";
      save.addEventListener("click", function () {
        api("/api/admin/support/tickets/" + encodeURIComponent(id), {
          method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ status: status.value })
        }).then(function () { note("Ticket status updated."); return Promise.all([loadSupport(), refreshOverview()]); })
          .catch(function (err) { note(err.message, true); });
      });
      state.appendChild(status); state.appendChild(save); root.appendChild(state);
    }).catch(function (err) { root.textContent = err.message; });
  }

  /* ── Access ──────────────────────────────────────────────── */
  function roleLabel(user) {
    if (user.role === "super_admin") return "Owner";
    var n = (user.permissions || []).length;
    if (n) return "Admin · " + n + (n === 1 ? " permission" : " permissions");
    return "Member";
  }

  function loadPermissions() {
    if (PERMISSIONS.length || !isOwner()) return Promise.resolve(PERMISSIONS);
    return api("/api/admin/staff").then(function (j) { PERMISSIONS = j.permissions || []; return PERMISSIONS; });
  }

  /* The editor opened under an account row: one checkbox per permission.
     Saving with none ticked removes admin access altogether. */
  function accessEditor(user, onSaved) {
    var box = document.createElement("div");
    box.className = "admin-access";
    box.appendChild(text("strong", "Admin access for " + (user.displayName || user.handle || "this account")));
    box.appendChild(text("p", "Tick what this person may do. They see only those parts of the console. Appointing admins and feature flags stay with you.", "pg-fine"));
    var list = document.createElement("div"); list.className = "admin-access-list";
    PERMISSIONS.forEach(function (p) {
      var label = document.createElement("label"); label.className = "admin-access-item";
      var cb = document.createElement("input"); cb.type = "checkbox"; cb.value = p.key;
      cb.checked = (user.permissions || []).indexOf(p.key) !== -1;
      var words = document.createElement("span");
      words.appendChild(text("b", p.label));
      words.appendChild(text("small", p.hint));
      label.appendChild(cb); label.appendChild(words); list.appendChild(label);
    });
    box.appendChild(list);
    var actions = document.createElement("div"); actions.className = "admin-access-actions";
    var save = text("button", "Save access", "pg-bw"); save.type = "button";
    var removeBtn = text("button", "Remove admin access", "pg-bo admin-access-remove"); removeBtn.type = "button";
    removeBtn.hidden = !(user.permissions || []).length;
    var cancel = text("button", "Cancel", "pg-bo"); cancel.type = "button";

    function submit(perms) {
      save.disabled = removeBtn.disabled = true;
      return api("/api/admin/users/" + encodeURIComponent(user.id) + "/staff", {
        method: "PATCH", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ permissions: perms })
      }).then(function (j) {
        note(perms.length
          ? (j.user.displayName || "The account") + " is now an admin with " + perms.length + (perms.length === 1 ? " permission." : " permissions.")
          : "Admin access removed.");
        box.remove();
        if (onSaved) onSaved();
      }).catch(function (err) { note(err.message, true); })
        .finally(function () { save.disabled = removeBtn.disabled = false; });
    }

    save.addEventListener("click", function () {
      var perms = Array.prototype.slice.call(list.querySelectorAll("input:checked")).map(function (cb) { return cb.value; });
      if (!perms.length && !(user.permissions || []).length) { note("Tick at least one permission to make this account an admin.", true); return; }
      submit(perms);
    });
    removeBtn.addEventListener("click", function () {
      var name = user.displayName || user.handle || "this account";
      var ask = window.SC_UI && SC_UI.confirm
        ? SC_UI.confirm({ title: "Remove admin access?", body: name + " will no longer see the admin console.", confirmLabel: "Remove", danger: true })
        : Promise.resolve(window.confirm("Remove admin access from " + name + "?"));
      ask.then(function (yes) { if (yes) submit([]); });
    });
    cancel.addEventListener("click", function () { box.remove(); });
    actions.appendChild(save); actions.appendChild(removeBtn); actions.appendChild(cancel);
    box.appendChild(actions);
    return box;
  }

  var usersCache = [];
  function renderUsers(filter) {
    var root = $("#adminUserList");
    root.innerHTML = "";
    var q = String(filter || "").trim().toLowerCase();
    var shown = usersCache.filter(function (u) {
      if (!q) return true;
      return [u.displayName, u.handle, u.email].join(" ").toLowerCase().indexOf(q) !== -1;
    });
    if (!shown.length) { root.appendChild(text("p", q ? "No account matches that search." : "No accounts yet.")); return; }
    shown.forEach(function (user) {
      var row = document.createElement("article"); row.className = "admin-row admin-user-row";
      var main = document.createElement("div"); main.className = "admin-row-main";
      main.appendChild(text("strong", user.displayName || user.handle || user.email || "Account"));
      main.appendChild(text("span", [user.handle || "No handle", user.email].filter(Boolean).join(" · ")));
      main.appendChild(text("small", user.plan + " · " + roleLabel(user) + " · " + user.templateCount + " templates · joined " + new Date(user.createdAt).toLocaleDateString()));
      row.appendChild(main);
      if (isOwner() && user.role !== "super_admin" && user.id !== currentUser.id) {
        var manage = text("button", (user.permissions || []).length ? "Edit access" : "Manage access", "pg-bo admin-manage");
        manage.type = "button";
        manage.addEventListener("click", function () {
          var open = row.nextElementSibling && row.nextElementSibling.classList.contains("admin-access");
          if (open) { row.nextElementSibling.remove(); return; }
          loadPermissions().then(function () {
            row.insertAdjacentElement("afterend", accessEditor(user, function () { loadUsers(); if (isOwner()) loadTeam(); }));
          }).catch(function (err) { note(err.message, true); });
        });
        row.appendChild(manage);
      }
      root.appendChild(row);
    });
  }

  function loadUsers() {
    var root = $("#adminUserList"); root.innerHTML = "<p>Loading accounts…</p>";
    return api("/api/admin/users").then(function (j) {
      usersCache = j.users || [];
      var fine = $("#adminUsersFine");
      if (fine) fine.textContent = j.canManageStaff
        ? "Accounts and plans. Choose Manage access to make someone an admin with limited permissions."
        : "Accounts and plans. Email addresses are visible to the owner only.";
      var search = $("#adminUserSearch");
      renderUsers(search ? search.value : "");
    });
  }

  function loadTeam() {
    var root = $("#adminTeamList"); root.innerHTML = "<p>Loading team…</p>";
    return api("/api/admin/staff").then(function (j) {
      PERMISSIONS = j.permissions || PERMISSIONS;
      var labels = {};
      PERMISSIONS.forEach(function (p) { labels[p.key] = p.label; });
      root.innerHTML = "";
      (j.staff || []).forEach(function (member) {
        var row = document.createElement("article"); row.className = "admin-row";
        var main = document.createElement("div"); main.className = "admin-row-main";
        main.appendChild(text("strong", (member.displayName || member.handle || member.email) + (member.owner ? " · Owner" : "")));
        main.appendChild(text("span", [member.handle, member.email].filter(Boolean).join(" · ")));
        main.appendChild(text("small", member.owner
          ? "Everything, including appointing admins and feature flags."
          : member.permissions.map(function (k) { return labels[k] || k; }).join(" · ")));
        row.appendChild(main);
        if (!member.owner) {
          var edit = text("button", "Edit access", "pg-bo admin-manage"); edit.type = "button";
          edit.addEventListener("click", function () {
            var open = row.nextElementSibling && row.nextElementSibling.classList.contains("admin-access");
            if (open) { row.nextElementSibling.remove(); return; }
            row.insertAdjacentElement("afterend", accessEditor(member, function () { loadTeam(); if (has("users.view")) loadUsers(); }));
          });
          row.appendChild(edit);
        }
        root.appendChild(row);
      });
      if ((j.staff || []).length <= 1) {
        root.appendChild(text("p", "No admins yet. Open Users and choose Manage access on an account to appoint one.", "pg-fine"));
      }
    });
  }

  function loadFlags() {
    var root = $("#adminFlagList"); root.innerHTML = "<p>Loading feature flags…</p>";
    return api("/api/admin/feature-flags").then(function (j) {
      root.innerHTML = "";
      j.flags.forEach(function (flag) {
        var row = document.createElement("article"); row.className = "admin-row admin-flag-row";
        var main = document.createElement("div"); main.className = "admin-row-main";
        main.appendChild(text("strong", flag.key.replace(/_/g, " ")));
        main.appendChild(text("span", flag.description));
        if (flag.key === "creator_monetization") main.appendChild(text("small", "Coming soon — no earning or payout claims are shown to creators."));
        var toggle = document.createElement("input"); toggle.type = "checkbox"; toggle.checked = flag.enabled; toggle.disabled = !isOwner();
        toggle.setAttribute("aria-label", "Enable " + flag.key);
        toggle.addEventListener("change", function () {
          toggle.disabled = true;
          api("/api/admin/feature-flags/" + encodeURIComponent(flag.key), {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: toggle.checked })
          }).then(function () { note("Feature flag updated."); }).catch(function (err) {
            toggle.checked = !toggle.checked; note(err.message, true);
          }).finally(function () { toggle.disabled = !isOwner(); });
        });
        row.appendChild(main); row.appendChild(toggle); root.appendChild(row);
      });
    });
  }

  /* Creator tutorials.

     The row leads with the link, opened in a new tab, because that is the
     one thing worth checking: a submission is somebody else's video until a
     person watches it. Tutorials publish on submit, so this list is a
     takedown tool — the default view is what is already live. */
  function loadSkills() {
    var root = $("#adminSkillList");
    var picker = $("#adminSkillStatus");
    var status = picker ? picker.value : "published";
    root.innerHTML = "<p>Loading tutorials…</p>";
    return api("/api/admin/skills?status=" + encodeURIComponent(status)).then(function (j) {
      root.innerHTML = "";
      if (!j.skills.length) {
        root.appendChild(text("p", status === "published"
          ? "No tutorials have been shared yet."
          : "No " + status + " tutorials."));
        return;
      }
      j.skills.forEach(function (item) {
        var row = document.createElement("article");
        row.className = "admin-row";

        var main = document.createElement("div");
        main.className = "admin-row-main";
        main.appendChild(text("strong", item.title));

        var link = document.createElement("a");
        link.href = item.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.textContent = item.url;
        main.appendChild(link);

        main.appendChild(text("span", "@" + (item.author.handle || "unknown") +
          " · " + item.platform + (item.templateId ? " · " + item.templateId : "")));
        if (item.summary) main.appendChild(text("small", item.summary));

        var controls = document.createElement("div");
        controls.className = "admin-row-controls";
        var select = document.createElement("select");
        ["pending", "published", "rejected"].forEach(function (v) {
          var o = document.createElement("option");
          o.value = v; o.textContent = v; o.selected = item.status === v;
          select.appendChild(o);
        });
        var input = document.createElement("input");
        input.type = "text"; input.maxLength = 300;
        input.placeholder = "Reason (the author reads this)";
        input.value = item.reviewNote || "";
        var save = text("button", "Save", "pg-bo"); save.type = "button";
        save.addEventListener("click", function () {
          save.disabled = true;
          api("/api/admin/skills/" + encodeURIComponent(item.id), {
            method: "PATCH", headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: select.value, note: input.value })
          }).then(function () { note("Tutorial review saved."); return loadSkills(); })
            .catch(function (err) { note(err.message, true); })
            .finally(function () { save.disabled = false; });
        });
        controls.appendChild(select); controls.appendChild(input); controls.appendChild(save);
        row.appendChild(main); row.appendChild(controls); root.appendChild(row);
      });
    });
  }

  var skillStatus = $("#adminSkillStatus");
  if (skillStatus) {
    skillStatus.addEventListener("change", function () {
      loadSkills().catch(function (err) { note(err.message, true); });
    });
  }
  var userSearch = $("#adminUserSearch");
  if (userSearch) userSearch.addEventListener("input", function () { renderUsers(userSearch.value); });

  var loaders = { overview: loadOverview, content: loadTemplates, skills: loadSkills, support: loadSupport, users: loadUsers, team: loadTeam, features: loadFlags };
  var loaded = {};

  function selectTab(key) {
    all("[data-admin-tab]").forEach(function (b) {
      var on = b.getAttribute("data-admin-tab") === key;
      b.setAttribute("aria-pressed", on ? "true" : "false");
      // On a phone the tab row scrolls sideways; keep the open one in view.
      if (on && b.parentNode && b.parentNode.scrollWidth > b.parentNode.clientWidth) {
        b.parentNode.scrollLeft = Math.max(0, b.offsetLeft - 12);
      }
    });
    all("[data-admin-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-admin-panel") !== key; });
    if (!loaded[key]) {
      loaded[key] = true;
      loaders[key]().catch(function (err) { loaded[key] = false; note(err.message, true); });
    }
  }

  all("[data-admin-tab]").forEach(function (button) {
    button.addEventListener("click", function () {
      var key = button.getAttribute("data-admin-tab");
      loaded[key] = false;
      selectTab(key);
      if (history.replaceState) history.replaceState(null, "", "#" + key);
    });
  });
  all("[data-admin-refresh]").forEach(function (button) {
    button.addEventListener("click", function () {
      loaders[button.getAttribute("data-admin-refresh")]().catch(function (err) { note(err.message, true); });
    });
  });

  api("/api/auth/me").then(function (j) {
    currentUser = j.user;
    if (!showAccess(currentUser)) return;
    // Each person sees only the sections they were given.
    var allowedTabs = [];
    all("[data-admin-tab]").forEach(function (b) {
      var ok = has(b.getAttribute("data-perm"));
      b.hidden = !ok;
      if (ok) allowedTabs.push(b.getAttribute("data-admin-tab"));
    });
    all("[data-admin-panel]").forEach(function (p) {
      if (allowedTabs.indexOf(p.getAttribute("data-admin-panel")) === -1) p.remove();
    });
    var wanted = String(location.hash || "").replace("#", "");
    selectTab(allowedTabs.indexOf(wanted) !== -1 ? wanted : allowedTabs[0]);
  }).catch(function (err) {
    showAccess(null);
    note(err.message, true);
  });
})();
