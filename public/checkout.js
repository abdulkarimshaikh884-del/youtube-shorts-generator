/* ============================================================
   checkout.js — Razorpay upgrade flow for the pricing page.

   Order of operations matters: the server decides the price and the term
   (lifetime vs 1 year) from its own tables, so nothing here can change what
   is charged or what is granted. This file only drives the UI.
   ============================================================ */
(function () {
  "use strict";

  var $ = function (s, r) { return (r || document).querySelector(s); };
  var note = null;

  function say(msg, kind) {
    if (!note) return;
    note.textContent = msg || "";
    note.className = "pg-note pg-center" + (kind ? " " + kind : "");
  }

  /* Until the gateway is switched on the page reserves seats instead of
     charging. The server decides which mode we are in, so turning payments on
     needs no edit here. */
  var paymentsLive = true;

  function paintReserveMode(o) {
    var banner = $("#offerBanner");
    var left = $("#offerLeft");
    var term = $("#maxTerm");
    var line = $("#maxLine");

    if (banner) banner.hidden = false;
    if (left) {
      var when = o.opensOn ? " Opens " + o.opensOn + "." : "";
      left.textContent = (o.reserved > 0
        ? o.reserved + (o.reserved === 1 ? " creator has" : " creators have") + " reserved a seat."
        : "Reserve yours before it opens.") + when;
    }
    if (term) term.textContent = "one-time · lifetime";
    if (line) {
      line.innerHTML = "<b>Lifetime access</b> — pay once when it opens, keep "
        + "Pro Max for good. Reserve now and you keep this price.";
    }

    Array.prototype.forEach.call(document.querySelectorAll(".pg-buy"), function (btn) {
      btn.textContent = btn.dataset.plan === "promax"
        ? "Reserve a lifetime seat"
        : "Notify me when Pro opens";
    });
    say("Payments open shortly. Reserve a seat and we will email you the moment they do — nothing is charged now.");
  }

  /* ── Launch offer counter ─────────────────────────────────
     Pro Max is lifetime for the first N members. Once they are gone the same
     price buys a year, so the page must say which one the visitor is getting. */
  function paintOffer() {
    fetch("/api/offer", { headers: { Accept: "application/json" } })
      .then(function (r) { return r.json(); })
      .then(function (o) {
        if (!o || !o.success) return;

        paymentsLive = o.paymentsLive !== false;
        if (!paymentsLive) { paintReserveMode(o); return; }

        var banner = $("#offerBanner");
        var left = $("#offerLeft");
        var term = $("#maxTerm");
        var line = $("#maxLine");
        var btn = document.querySelector('.pg-buy[data-plan="promax"]');

        if (o.lifetimeAvailable) {
          if (banner) banner.hidden = false;
          if (left) {
            left.textContent = o.left === o.total
              ? "All " + o.total + " seats are still open."
              : "Only " + o.left + " of " + o.total + " seats left.";
          }
          if (term) term.textContent = "one-time · lifetime";
          if (line) {
            line.innerHTML = "<b>Lifetime access</b> — pay once, keep "
              + "Pro Max for good. No renewal.";
          }
          if (btn) btn.textContent = "Get lifetime Pro Max · ₹" + o.price;
        } else {
          if (banner) banner.hidden = true;
          if (term) term.textContent = "/year";
          if (line) {
            line.innerHTML = "<b>One year of Pro Max</b> — the lifetime seats "
              + "have all been claimed.";
          }
          if (btn) btn.textContent = "Get Pro Max · ₹" + o.price + "/year";
        }
      })
      .catch(function () { /* the static copy on the page stays as the fallback */ });
  }

  /* ── Buy ──────────────────────────────────────────────────
     Razorpay's checkout script is only fetched when the user actually chooses
     to pay, so visitors who never upgrade are not loading a third-party SDK. */
  function loadRazorpay() {
    return new Promise(function (resolve, reject) {
      if (window.Razorpay) return resolve();
      var s = document.createElement("script");
      s.src = "https://checkout.razorpay.com/v1/checkout.js";
      s.onload = function () { resolve(); };
      s.onerror = function () { reject(new Error("sdk")); };
      document.head.appendChild(s);
    });
  }

  function buy(planId, btn) {
    var original = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Starting…";
    say("");

    fetch("/api/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: planId })
    })
      .then(function (r) {
        return r.json().then(function (j) { return { status: r.status, body: j }; });
      })
      .then(function (res) {
        var j = res.body || {};

        if (res.status === 401) {
          // Send them to log in and bring them straight back here.
          say("Please log in first — taking you to the login page…");
          setTimeout(function () {
            window.location.href = "/login?next=" + encodeURIComponent("/pricing");
          }, 900);
          return null;
        }
        if (!j.success) {
          throw new Error(j.error || "Could not start the payment.");
        }

        return loadRazorpay().then(function () {
          return new Promise(function (resolve) {
            var rzp = new window.Razorpay({
              key: j.keyId,
              order_id: j.orderId,
              amount: j.amount,
              currency: j.currency || "INR",
              name: "ShortsCraft",
              description: planId === "promax"
                ? (j.term === "lifetime" ? "Pro Max — lifetime" : "Pro Max — 1 year")
                : "Pro — 1 month",
              theme: { color: "#7952ff" },
              handler: function (resp) { resolve(resp); },
              modal: {
                ondismiss: function () {
                  resolve(null); // user closed the sheet; not an error
                }
              }
            });
            rzp.on("payment.failed", function () { resolve(null); });
            rzp.open();
          });
        }).then(function (resp) {
          if (!resp) {
            say("Payment cancelled. Nothing was charged.");
            return null;
          }
          say("Confirming your payment…");
          return fetch("/api/razorpay/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              plan: planId
            })
          }).then(function (r) { return r.json(); });
        });
      })
      .then(function (v) {
        if (!v) return;
        if (v.success) {
          var what = v.term === "lifetime" ? "for life" :
            v.term === "year" ? "for one year" : "for one month";
          say("You are on " + (v.plan === "promax" ? "Pro Max" : "Pro") + " " + what + ". Enjoy!", "ok");
          setTimeout(function () { window.location.href = "/account"; }, 1400);
        } else {
          say(v.error || "We could not confirm that payment. If money was deducted, contact us and we will sort it out.", "err");
        }
      })
      .catch(function (err) {
        say(err && err.message === "sdk"
          ? "Could not reach the payment provider. Check your connection and try again."
          : (err && err.message) || "Something went wrong. Nothing was charged.", "err");
      })
      .then(function () {
        btn.disabled = false;
        if (btn.textContent === "Starting…") btn.textContent = original;
      });
  }

  /* ── Reserve a seat (payments not open yet) ───────────────
     Asks for an email rather than silently using the account's, so a signed-in
     visitor can still put a different address on the list. */
  function reserve(planId, btn) {
    var pre = "";
    try {
      var el = document.querySelector("[data-user-email]");
      if (el && el.textContent.indexOf("@") > -1) pre = el.textContent.trim();
    } catch (e) { /* not signed in */ }

    var email = window.prompt(
      "Enter your email and we will tell you the moment " +
      (planId === "promax" ? "lifetime Pro Max" : "Pro") + " opens.\n" +
      "Nothing is charged now.", pre);
    if (email === null) return;

    email = String(email).trim();
    if (!email) { say("Enter an email to reserve a seat.", "err"); return; }

    var label = btn.textContent;
    btn.disabled = true;
    btn.textContent = "Reserving…";

    fetch("/api/waitlist", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email: email, plan: planId })
    })
      .then(function (r) { return r.json(); })
      .then(function (j) {
        if (!j.success) throw new Error(j.error || "Could not reserve that seat.");
        say(j.alreadyOn
          ? "You are already on the list — number " + j.position + ". We will email you when it opens."
          : "Reserved — you are number " + j.position + " on the list. We will email you when it opens.", "ok");
        paintOffer();
      })
      .catch(function (err) {
        say(err.message || "Network problem. Please try again.", "err");
      })
      .then(function () {
        btn.disabled = false;
        btn.textContent = label;
      });
  }

  function init() {
    note = $("#buyNote");
    paintOffer();
    Array.prototype.forEach.call(document.querySelectorAll(".pg-buy"), function (btn) {
      btn.addEventListener("click", function () {
        if (paymentsLive) buy(btn.dataset.plan, btn);
        else reserve(btn.dataset.plan, btn);
      });
    });
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
