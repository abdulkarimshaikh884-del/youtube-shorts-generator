(function () {
  "use strict";
  var $ = function (s) { return document.querySelector(s); };
  var all = function (s) { return Array.prototype.slice.call(document.querySelectorAll(s)); };
  var currentUser = null;
  var activeTicketId = null;

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

  function showAccess(user) {
    var allowed = user && (user.role === "admin" || user.role === "super_admin");
    if (!allowed) {
      $("#adminGate").innerHTML = '<span class="pg-kicker">Private workspace</span><h1>Admin access required</h1><p>Log in with the configured ShortsCraft owner account to use this console.</p><a class="pg-bw" href="/login?next=%2Fadmin">Log in</a>';
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
          }).then(function () { note("Template moderation saved."); return loadOverview(); })
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
      if (!j.tickets.length) { root.appendChild(text("p", "No support tickets.")); return; }
      j.tickets.forEach(function (ticket) {
        var button = document.createElement("button"); button.type = "button"; button.className = "admin-ticket-button";
        button.appendChild(text("strong", ticket.subject));
        button.appendChild(text("span", ticket.reference + " · " + ticket.status.replace(/_/g, " ")));
        button.appendChild(text("small", ticket.email + " · " + (ticket.messageCount || 0) + " messages"));
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
        }).then(function () { note("Support reply sent."); return Promise.all([openTicket(id), loadSupport(), loadOverview()]); })
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
        }).then(function () { note("Ticket status updated."); return Promise.all([loadSupport(), loadOverview()]); })
          .catch(function (err) { note(err.message, true); });
      });
      state.appendChild(status); state.appendChild(save); root.appendChild(state);
    }).catch(function (err) { root.textContent = err.message; });
  }

  function loadUsers() {
    var root = $("#adminUserList"); root.innerHTML = "<p>Loading accounts…</p>";
    return api("/api/admin/users").then(function (j) {
      root.innerHTML = "";
      if (!j.users.length) { root.appendChild(text("p", "No accounts yet.")); return; }
      j.users.forEach(function (user) {
        var row = document.createElement("article"); row.className = "admin-row";
        var main = document.createElement("div"); main.className = "admin-row-main";
        main.appendChild(text("strong", user.displayName || user.email));
        main.appendChild(text("span", (user.handle || "No handle") + " · " + user.email));
        main.appendChild(text("small", user.plan + " · " + user.role + " · " + user.templateCount + " templates · joined " + new Date(user.createdAt).toLocaleDateString()));
        row.appendChild(main); root.appendChild(row);
      });
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
        var toggle = document.createElement("input"); toggle.type = "checkbox"; toggle.checked = flag.enabled; toggle.disabled = currentUser.role !== "super_admin";
        toggle.setAttribute("aria-label", "Enable " + flag.key);
        toggle.addEventListener("change", function () {
          toggle.disabled = true;
          api("/api/admin/feature-flags/" + encodeURIComponent(flag.key), {
            method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ enabled: toggle.checked })
          }).then(function () { note("Feature flag updated."); }).catch(function (err) {
            toggle.checked = !toggle.checked; note(err.message, true);
          }).finally(function () { toggle.disabled = currentUser.role !== "super_admin"; });
        });
        row.appendChild(main); row.appendChild(toggle); root.appendChild(row);
      });
    });
  }

  /* Creator tutorials.

     The row leads with the link, opened in a new tab, because approving one
     of these without watching it is the whole risk: a submission is somebody
     else's video until a person confirms otherwise. */
  function loadSkills() {
    var root = $("#adminSkillList");
    var picker = $("#adminSkillStatus");
    var status = picker ? picker.value : "pending";
    root.innerHTML = "<p>Loading tutorials…</p>";
    return api("/api/admin/skills?status=" + encodeURIComponent(status)).then(function (j) {
      root.innerHTML = "";
      if (!j.skills.length) {
        root.appendChild(text("p", status === "pending"
          ? "Nothing is waiting for review."
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

  var loaders = { overview: loadOverview, content: loadTemplates, skills: loadSkills, support: loadSupport, users: loadUsers, features: loadFlags };
  all("[data-admin-tab]").forEach(function (button) {
    button.addEventListener("click", function () {
      var key = button.getAttribute("data-admin-tab");
      all("[data-admin-tab]").forEach(function (b) { b.setAttribute("aria-pressed", b === button ? "true" : "false"); });
      all("[data-admin-panel]").forEach(function (p) { p.hidden = p.getAttribute("data-admin-panel") !== key; });
      loaders[key]().catch(function (err) { note(err.message, true); });
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
    return Promise.all([loadOverview(), loadTemplates(), loadSupport(), loadUsers(), loadFlags()]);
  }).catch(function (err) {
    showAccess(null);
    note(err.message, true);
  });
})();
