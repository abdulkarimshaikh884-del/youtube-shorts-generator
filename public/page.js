/* ============================================================
   page.js — shared behaviour for the rebuilt pages:
   mobile nav toggle + the Help & Feedback form.
   No dependency on the legacy script.js.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };
  function safeNext(value) {
    if (!value || value.charAt(0) !== "/" || value.slice(0, 2) === "//" || value.indexOf("\\") !== -1) {
      return null;
    }
    try {
      var url = new URL(value, location.origin);
      if (url.origin !== location.origin) return null;
      return url.pathname + url.search + url.hash;
    } catch (e) {
      return null;
    }
  }

  /* ── mobile nav ───────────────────────────────────────── */
  var burger = $("#navBurger"), menu = $("#navMobile");
  if (burger && menu) {
    burger.setAttribute("aria-controls", "navMobile");
    burger.addEventListener("click", function () {
      var open = menu.hasAttribute("hidden");
      if (open) menu.removeAttribute("hidden"); else menu.setAttribute("hidden", "");
      burger.setAttribute("aria-expanded", String(open));
      burger.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    });
    menu.addEventListener("click", function (ev) {
      if (ev.target && ev.target.closest("a")) {
        menu.setAttribute("hidden", "");
        burger.setAttribute("aria-expanded", "false");
        burger.setAttribute("aria-label", "Open menu");
      }
    });
    document.addEventListener("keydown", function (ev) {
      if (ev.key === "Escape" && !menu.hasAttribute("hidden")) {
        menu.setAttribute("hidden", "");
        burger.setAttribute("aria-expanded", "false");
        burger.setAttribute("aria-label", "Open menu");
        burger.focus();
      }
    });
  }

  /* ── auth password visibility ─────────────────────────── */
  document.querySelectorAll("[data-password-toggle], #authPasswordToggle").forEach(function (toggle) {
    var selector = toggle.getAttribute("data-password-toggle") || "#authPassword";
    var input = document.querySelector(selector);
    if (!input) return;
    toggle.addEventListener("click", function () {
      var reveal = input.type === "password";
      input.type = reveal ? "text" : "password";
      toggle.setAttribute("aria-pressed", reveal ? "true" : "false");
      var noun = input.id === "resetConfirm" ? "confirmed password" :
        input.id === "resetPassword" ? "new password" : "password";
      toggle.setAttribute("aria-label", (reveal ? "Hide " : "Show ") + noun);
      input.focus();
    });
  });

  /* ── log in / sign up ─────────────────────────────────── */
  var af = $("#authForm");
  if (af) {
    var kind = af.dataset.kind === "signup" ? "signup" : "login";
    var note = $("#authNote"), send = $("#authSend");

    /* Carry ?next= across the login <-> signup switch. The submit handler
       below already honours it, but the "Create one" / "Log in" link under
       the form is static markup, so arriving at /login?next=/settings and
       deciding to sign up instead used to drop the destination and land you
       on the home page. */
    var nextParam = new URLSearchParams(location.search).get("next");
    var safeNextParam = safeNext(nextParam);
    if (safeNextParam) {
      var cross = af.querySelector('.pg-fine a[href="/login"], .pg-fine a[href="/signup"]');
      if (cross) cross.href = cross.getAttribute("href") + "?next=" + encodeURIComponent(safeNextParam);
      var forgot = af.querySelector('.auth-forgot-link[href="/forgot-password"]');
      if (forgot) forgot.href = forgot.getAttribute("href") + "?next=" + encodeURIComponent(safeNextParam);
    }
    var say = function (msg, bad) {
      note.textContent = msg;
      note.removeAttribute("data-ok");
      if (bad) note.setAttribute("data-bad", "1"); else note.removeAttribute("data-bad");
    };

    af.addEventListener("input", function () {
      if (note.textContent) say("");
    });

    af.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = $("#authEmail").value.trim();
      var password = $("#authPassword").value;
      var handleInput = $("#authHandle");
      var handle = handleInput ? handleInput.value.trim().replace(/^@+/, "").toLowerCase() : "";

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        say("That email address does not look right.", true); $("#authEmail").focus(); return;
      }
      if (kind === "signup" && password.length < 8) {
        say("Use at least 8 characters for the password.", true); $("#authPassword").focus(); return;
      }
      if (kind === "signup" && !/^[a-z0-9_]{3,30}$/.test(handle)) {
        say("Use 3–30 letters, numbers, or underscores for your username.", true); handleInput.focus(); return;
      }
      if (!password) { say("Enter your password.", true); $("#authPassword").focus(); return; }

      var label = send.textContent;
      send.disabled = true;
      send.textContent = kind === "signup" ? "Creating…" : "Logging in…";
      say("");

      fetch("/api/auth/" + kind, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password, handle: handle })
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || !j.success) throw new Error(j.error || "That did not work. Please retry.");
          return j;
        });
      }).then(function () {
        // land somewhere useful: back where they came from, or the home page
        var next = new URLSearchParams(location.search).get("next");
        location.href = safeNext(next) || "/";
      }).catch(function (err) {
        say(err.message, true);
        send.disabled = false;
        send.textContent = label;
      });
    });
  }

  /* ── request a password reset ─────────────────────────── */
  var forgotForm = $("#forgotForm");
  if (forgotForm) {
    var forgotEmail = $("#forgotEmail");
    var forgotSend = $("#forgotSend");
    var forgotNote = $("#forgotNote");
    var forgotDevLink = $("#forgotDevLink");
    var forgotNext = safeNext(new URLSearchParams(location.search).get("next"));
    var forgotBack = forgotForm.querySelector('.pg-fine a[href="/login"]');
    if (forgotBack && forgotNext) forgotBack.href = "/login?next=" + encodeURIComponent(forgotNext);

    var forgotSay = function (msg, bad, ok) {
      forgotNote.textContent = msg;
      forgotNote.removeAttribute("data-bad");
      forgotNote.removeAttribute("data-ok");
      if (bad) forgotNote.setAttribute("data-bad", "1");
      if (ok) forgotNote.setAttribute("data-ok", "1");
    };

    forgotEmail.addEventListener("input", function () {
      forgotSay("");
      forgotDevLink.hidden = true;
      forgotDevLink.removeAttribute("href");
    });

    forgotForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = forgotEmail.value.trim();
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        forgotSay("That email address does not look right.", true);
        forgotEmail.focus();
        return;
      }

      var label = forgotSend.textContent;
      forgotSend.disabled = true;
      forgotSend.textContent = "Sending…";
      forgotSay("");
      forgotDevLink.hidden = true;

      fetch("/api/auth/forgot", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email })
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || !j.success) throw new Error(j.error || "We could not send the link. Please retry.");
          return j;
        });
      }).then(function (j) {
        forgotSay(j.message || "If an account exists for that email, a reset link is on its way.", false, true);
        forgotSend.disabled = false;
        forgotSend.textContent = "Send another link";
        if (j.devResetUrl) {
          var resetUrl = new URL(j.devResetUrl, location.origin);
          if (resetUrl.origin === location.origin && resetUrl.pathname === "/reset-password") {
            if (forgotNext) resetUrl.searchParams.set("next", forgotNext);
            forgotDevLink.href = resetUrl.pathname + resetUrl.search;
            forgotDevLink.hidden = false;
          }
        }
      }).catch(function (err) {
        forgotSay(err.message, true);
        forgotSend.disabled = false;
        forgotSend.textContent = label;
      });
    });
  }

  /* ── consume a password reset link ────────────────────── */
  var resetForm = $("#resetForm");
  if (resetForm) {
    var resetPassword = $("#resetPassword");
    var resetConfirm = $("#resetConfirm");
    var resetSend = $("#resetSend");
    var resetNote = $("#resetNote");
    var resetParams = new URLSearchParams(location.search);
    var resetToken = resetParams.get("token") || "";
    var resetNext = safeNext(resetParams.get("next"));
    var validResetToken = /^[A-Za-z0-9_-]{40,64}$/.test(resetToken);
    var resetSay = function (msg, bad, ok) {
      resetNote.textContent = msg;
      resetNote.removeAttribute("data-bad");
      resetNote.removeAttribute("data-ok");
      if (bad) resetNote.setAttribute("data-bad", "1");
      if (ok) resetNote.setAttribute("data-ok", "1");
    };

    if (!validResetToken) {
      resetSend.disabled = true;
      resetSay("That reset link is invalid. Request a fresh link to continue.", true);
    }

    resetForm.addEventListener("input", function () {
      if (validResetToken) resetSay("");
    });

    resetForm.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (!validResetToken) return;
      var password = resetPassword.value;
      var confirmation = resetConfirm.value;
      if (password.length < 8) {
        resetSay("Use at least 8 characters for your new password.", true);
        resetPassword.focus();
        return;
      }
      if (password !== confirmation) {
        resetSay("Those passwords do not match yet.", true);
        resetConfirm.focus();
        return;
      }

      var label = resetSend.textContent;
      resetSend.disabled = true;
      resetSend.textContent = "Updating…";
      resetSay("");

      fetch("/api/auth/reset", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token: resetToken, password: password })
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || !j.success) throw new Error(j.error || "That reset link could not be used.");
          return j;
        });
      }).then(function () {
        resetSay("Password updated. Signing you in…", false, true);
        setTimeout(function () { location.href = resetNext || "/account"; }, 700);
      }).catch(function (err) {
        resetSay(err.message, true);
        resetSend.disabled = false;
        resetSend.textContent = label;
      });
    });
  }

  /* ── live credit balance: sidebar badge + the account cards ───
     The account page's Plan and Credits cards used to be filled inside an
     `if (badge)` branch, so they depended on a sidebar element they have
     nothing to do with — and if the call failed they sat on their "—"
     placeholder forever with no explanation. Fetch when EITHER surface is on
     the page, and give the cards a readable fallback when it does not land. */
  var badge = document.querySelector(".sh-plan-badge");
  var creditChip = document.querySelector(".sh-credit-chip");
  var accPlan = $("#accPlan"), accCredits = $("#accCredits");
  if (badge || creditChip || accPlan || accCredits) {
    fetch("/api/credits", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.success) throw new Error("credits unavailable");
        if (creditChip) {
          var chipPlan = creditChip.querySelector(".sh-credit-plan");
          var chipBalance = creditChip.querySelector(".sh-credit-balance");
          if (chipPlan) chipPlan.textContent = j.planLabel;
          // Same wording as the home page: the chip says which plan you are
          // on and how many credits are left, not a score out of five.
          if (chipBalance) chipBalance.textContent = j.left + " Credit" + (j.left === 1 ? "" : "s");
        }
        if (badge) {
          var b = badge.querySelector("b");
          var sCredits = badge.querySelector(".sh-plan-credits");
          var sRates = badge.querySelector(".sh-plan-rates");
          var sLegacy = badge.querySelector("span:not(.sh-plan-arrow)");
          var up = badge.querySelector(".sh-plan-upgrade-link") || badge.querySelector("a");

          if (b) b.textContent = j.planLabel + " plan";
          if (sCredits) {
            sCredits.textContent = j.left + " of " + j.perDay + " credits left today";
          } else if (sLegacy) {
            sLegacy.textContent = j.left + " of " + j.perDay + " credits left today";
          }
          if (sRates && j.cost) {
            sRates.textContent = "Export " + j.cost.export + " · AI scene " + j.cost.animate;
          }
          document.querySelectorAll(".sh-upop-credits-pill").forEach(function (el) {
            el.textContent = "⚡ " + j.left + " / " + j.perDay + " Credits";
          });
          if (up && j.plan !== "free") {
            up.textContent = "Manage your plan ↗";
          }
        }
        if (accPlan) accPlan.textContent = j.planLabel + (j.plan === "free" ? "" : " · active");
        if (accCredits) accCredits.textContent = j.left + " of " + j.perDay + " left today";
        var fill = $("#crCreditFill");
        if (fill && j.perDay) {
          var pct = Math.max(0, Math.min(100, Math.round((j.left / j.perDay) * 100)));
          fill.style.width = pct + "%";
        }
      })
      .catch(function () {
        // the badge keeps its static copy; the cards say why they are blank
        if (accPlan && accPlan.textContent.trim() === "—") accPlan.textContent = "Could not load";
        if (accCredits && accCredits.textContent.trim() === "—") accCredits.textContent = "Could not load";
      });
  }

  /* ── feedback form ────────────────────────────────────── */
  var form = $("#fbForm");
  if (form) {
    var note = $("#fbNote"), send = $("#fbSend");

    var say = function (msg, bad) {
      note.textContent = msg;
      if (bad) note.setAttribute("data-bad", "1"); else note.removeAttribute("data-bad");
    };

    form.addEventListener("submit", function (ev) {
      ev.preventDefault();
      if (send.disabled) return;

      var body = {
        name: $("#fbName").value.trim(),
        email: $("#fbEmail").value.trim(),
        subject: $("#fbSubject").value,
        category: $("#fbSubject").selectedOptions[0].getAttribute("data-category") || "other",
        message: $("#fbMessage").value.trim()
      };

      if (body.name.length < 2) { say("Please tell us your name.", true); $("#fbName").focus(); return; }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(body.email)) {
        say("That email address does not look right.", true); $("#fbEmail").focus(); return;
      }
      if (body.message.length < 10) {
        say("A little more detail helps — at least a sentence.", true); $("#fbMessage").focus(); return;
      }

      send.disabled = true;
      var label = send.textContent;
      send.textContent = "Sending…";
      say("Sending…");

      fetch("/api/feedback", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body)
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || !j.success) throw new Error(j.error || "Could not send that. Please retry.");
          return j;
        });
      }).then(function (j) {
        form.reset();
        say("Ticket " + (j.ticket && j.ticket.reference ? j.ticket.reference : "created") + ". Your message is safely in the support queue.");
        loadSupportTickets();
      }).catch(function (err) {
        say(err.message || "Could not send that. Please retry.", true);
      }).finally(function () {
        send.disabled = false;
        send.textContent = label;
      });
    });
  }

  var supportRequestVersion = 0;
  function supportRequest(url, options) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 20000);
    return fetch(url, Object.assign({}, options || {}, { signal: controller.signal }))
      .then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || !j.success) throw new Error(j.error || "Could not load support. Please retry.");
          return j;
        });
      }).catch(function (err) {
        if (err.name === "AbortError") throw new Error("The request took too long. Please retry.");
        throw err;
      }).finally(function () { clearTimeout(timer); });
  }

  function openSupportTicket(id, moveFocus) {
    var section = $("#supportHistory");
    if (!section) return;
    var view = $("#supportConversation");
    if (!view) {
      view = document.createElement("section");
      view.id = "supportConversation";
      view.className = "pg-card sc-support-conversation";
      view.tabIndex = -1;
      view.setAttribute("aria-label", "Support conversation");
      section.appendChild(view);
    }
    var version = ++supportRequestVersion;
    view.textContent = "Loading conversation…";
    if (moveFocus) view.focus();
    return supportRequest("/api/support/tickets/" + encodeURIComponent(id)).then(function (j) {
      if (version !== supportRequestVersion) return;
      var ticket = j.ticket;
      view.textContent = "";
      var title = document.createElement("h3");
      title.textContent = ticket.reference + " · " + ticket.subject;
      view.appendChild(title);
      var status = document.createElement("p");
      status.textContent = "Status: " + ticket.status.replace(/_/g, " ");
      view.appendChild(status);
      (ticket.messages || []).forEach(function (m) {
        var row = document.createElement("article");
        row.className = "sc-support-message";
        var author = document.createElement("strong");
        author.textContent = m.role === "admin" ? "ShortsCraft Support" : "You";
        var body = document.createElement("p");
        body.className = "sc-support-body";
        body.textContent = m.body;
        var time = document.createElement("time");
        time.textContent = new Date(m.createdAt).toLocaleString();
        row.append(author, body, time);
        view.appendChild(row);
      });
      if (ticket.status === "closed") {
        var closed = document.createElement("p");
        closed.textContent = "This ticket is closed. Use the form above to send a new request.";
        view.appendChild(closed);
        return;
      }
      var reply = document.createElement("form");
      reply.className = "pg-form sc-support-reply";
      var label = document.createElement("label");
      label.htmlFor = "supportReply";
      label.textContent = "Your reply";
      var area = document.createElement("textarea");
      area.id = "supportReply";
      area.required = true;
      area.minLength = 2;
      area.maxLength = 4000;
      area.rows = 4;
      var button = document.createElement("button");
      button.type = "submit";
      button.className = "pg-bw";
      button.textContent = "Send reply";
      var notice = document.createElement("p");
      notice.setAttribute("role", "status");
      reply.append(label, area, button, notice);
      reply.addEventListener("submit", function (ev) {
        ev.preventDefault();
        if (button.disabled) return;
        if (area.value.trim().length < 2) { notice.textContent = "Write a reply first."; area.focus(); return; }
        button.disabled = true;
        notice.textContent = "Sending…";
        supportRequest("/api/support/tickets/" + encodeURIComponent(id) + "/messages", {
          method: "POST", headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ message: area.value.trim() })
        }).then(function () {
          loadSupportTickets(true);
          return openSupportTicket(id, true);
        })
          .catch(function (err) { notice.textContent = err.message; })
          .finally(function () { button.disabled = false; });
      });
      view.appendChild(reply);
    }).catch(function (err) {
      if (version !== supportRequestVersion) return;
      view.textContent = err.message + " ";
      var retry = document.createElement("button");
      retry.type = "button"; retry.className = "pg-bo"; retry.textContent = "Retry conversation";
      retry.addEventListener("click", function () { openSupportTicket(id, true); });
      view.appendChild(retry);
    });
  }

  function loadSupportTickets(listOnly) {
    var section = $("#supportHistory");
    var grid = $("#supportTicketGrid");
    if (!section || !grid) return;
    supportRequest("/api/auth/me").then(function (auth) {
      if (!auth.user) { section.hidden = true; return null; }
      section.hidden = false;
      grid.textContent = "Loading your tickets…";
      return supportRequest("/api/support/tickets");
    })
      .then(function (j) {
        if (!j) return;
        section.hidden = false;
        var tickets = j.tickets || [];
        if (!tickets.length) {
          grid.innerHTML = '<article class="pg-card"><h3>No previous tickets</h3><p>Your new support requests will appear here.</p></article>';
          return;
        }
        grid.innerHTML = "";
        tickets.forEach(function (ticket) {
          var card = document.createElement("article");
          card.className = "pg-card support-ticket-card";
          var title = document.createElement("h3");
          title.textContent = ticket.subject;
          var meta = document.createElement("p");
          meta.className = "pg-fine";
          meta.textContent = ticket.reference + " · " + ticket.status.replace(/_/g, " ") + " · " + new Date(ticket.updatedAt).toLocaleDateString();
          var count = document.createElement("p");
          count.textContent = (ticket.messageCount || 0) + " message" + (ticket.messageCount === 1 ? "" : "s");
          card.appendChild(title); card.appendChild(meta); card.appendChild(count);
          var open = document.createElement("button");
          open.type = "button"; open.className = "pg-bo"; open.textContent = "Read and reply";
          open.addEventListener("click", function () {
            history.replaceState(null, "", "/contact?ticket=" + encodeURIComponent(ticket.id) + "#supportHistory");
            openSupportTicket(ticket.id, true);
          });
          card.appendChild(open);
          grid.appendChild(card);
        });
        var requested = new URLSearchParams(location.search).get("ticket");
        if (requested && listOnly !== true) openSupportTicket(requested, false);
      })
      .catch(function (err) {
        section.hidden = false;
        grid.textContent = err.message + " ";
        var retry = document.createElement("button");
        retry.type = "button"; retry.className = "pg-bo"; retry.textContent = "Retry tickets";
        retry.addEventListener("click", loadSupportTickets);
        grid.appendChild(retry);
      });
  }
  loadSupportTickets();
})();
