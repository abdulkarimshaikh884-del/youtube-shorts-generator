/* ============================================================
   page.js — shared behaviour for the rebuilt pages:
   mobile nav toggle + the Help & Feedback form.
   No dependency on the legacy script.js.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s) { return document.querySelector(s); };

  /* ── mobile nav ───────────────────────────────────────── */
  var burger = $("#navBurger"), menu = $("#navMobile");
  if (burger && menu) {
    burger.addEventListener("click", function () {
      var open = menu.hasAttribute("hidden");
      if (open) menu.removeAttribute("hidden"); else menu.setAttribute("hidden", "");
      burger.setAttribute("aria-expanded", String(open));
    });
  }

  /* ── log in / sign up ─────────────────────────────────── */
  var af = $("#authForm");
  if (af) {
    var kind = af.dataset.kind === "signup" ? "signup" : "login";
    var note = $("#authNote"), send = $("#authSend");
    var say = function (msg, bad) {
      note.textContent = msg;
      if (bad) note.setAttribute("data-bad", "1"); else note.removeAttribute("data-bad");
    };

    af.addEventListener("submit", function (ev) {
      ev.preventDefault();
      var email = $("#authEmail").value.trim();
      var password = $("#authPassword").value;

      if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
        say("That email address does not look right.", true); $("#authEmail").focus(); return;
      }
      if (kind === "signup" && password.length < 8) {
        say("Use at least 8 characters for the password.", true); $("#authPassword").focus(); return;
      }
      if (!password) { say("Enter your password.", true); $("#authPassword").focus(); return; }

      var label = send.textContent;
      send.disabled = true;
      send.textContent = kind === "signup" ? "Creating…" : "Logging in…";
      say("");

      fetch("/api/auth/" + kind, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email, password: password })
      }).then(function (r) {
        return r.json().then(function (j) {
          if (!r.ok || !j.success) throw new Error(j.error || "That did not work. Please retry.");
          return j;
        });
      }).then(function () {
        // land somewhere useful: back where they came from, or the home page
        var next = new URLSearchParams(location.search).get("next");
        location.href = next && /^\/[a-z0-9\-/?=&]*$/i.test(next) ? next : "/";
      }).catch(function (err) {
        say(err.message, true);
        send.disabled = false;
        send.textContent = label;
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
  var accPlan = $("#accPlan"), accCredits = $("#accCredits");
  if (badge || accPlan || accCredits) {
    fetch("/api/credits", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j || !j.success) throw new Error("credits unavailable");
        if (badge) {
          var b = badge.querySelector("b"), s = badge.querySelector("span");
          if (b) b.textContent = j.planLabel + " plan";
          if (s) {
            s.textContent = j.left + " of " + j.perDay + " credits left today · " +
              "export " + j.cost.export + ", AI scene " + j.cost.animate;
          }
          var up = badge.querySelector("a");
          if (up && j.plan !== "free") up.textContent = "Manage your plan";
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

      var body = {
        name: $("#fbName").value.trim(),
        email: $("#fbEmail").value.trim(),
        subject: $("#fbSubject").value,
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
      }).then(function () {
        form.reset();
        say("Thanks — that reached us. We usually reply within two days.");
      }).catch(function (err) {
        say(err.message || "Could not send that. Please retry.", true);
      }).finally(function () {
        send.disabled = false;
        send.textContent = label;
      });
    });
  }
})();
