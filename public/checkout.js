/* ShortsCraft checkout: monthly/yearly pricing with server-owned amounts. */
(function () {
  "use strict";

  var note = document.getElementById("buyNote");
  var paymentsLive = false;
  var opensOn = "";

  function say(message, kind) {
    if (!note) return;
    note.textContent = message || "";
    note.className = "pg-note pg-center" + (kind ? " " + kind : "");
  }

  function selectCycle(cycle) {
    var yearly = cycle === "yearly";
    document.querySelectorAll("[data-cycle]").forEach(function (el) {
      if (el.closest && el.closest(".pg-billing-switch")) {
        el.setAttribute("aria-pressed", String(el.dataset.cycle === cycle));
      }
    });
    document.querySelectorAll(".pg-amt[data-price-monthly]").forEach(function (el) {
      var price = yearly ? el.dataset.priceYearly : el.dataset.priceMonthly;
      el.innerHTML = price + "<small>" + (yearly ? "/year" : "/month") + "</small>";
    });
    document.querySelectorAll(".pg-yearly-only").forEach(function (el) {
      el.hidden = !yearly;
    });
    document.querySelectorAll(".pg-buy").forEach(function (el) {
      el.dataset.cycle = cycle;
    });
  }

  function loadRazorpay() {
    return new Promise(function (resolve, reject) {
      if (window.Razorpay) return resolve();
      var script = document.createElement("script");
      script.src = "https://checkout.razorpay.com/v1/checkout.js";
      script.onload = resolve;
      script.onerror = function () { reject(new Error("Could not load the payment provider.")); };
      document.head.appendChild(script);
    });
  }

  function beginCheckout(button) {
    var plan = button.dataset.plan;
    var billingCycle = button.dataset.cycle === "yearly" ? "yearly" : "monthly";

    if (!paymentsLive) {
      say(opensOn
        ? "Payments are not open yet. Expected availability: " + opensOn + "."
        : "Payments are not open yet. No money has been charged.", "err");
      return;
    }

    var original = button.textContent;
    button.disabled = true;
    button.textContent = "Starting checkout…";
    say("");

    fetch("/api/razorpay/order", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ plan: plan, billingCycle: billingCycle })
    })
      .then(function (response) {
        return response.json().then(function (body) {
          if (response.status === 401) {
            window.location.href = "/login?next=" + encodeURIComponent("/pricing");
            return null;
          }
          if (!response.ok || !body.success) throw new Error(body.error || "Could not start checkout.");
          return body;
        });
      })
      .then(function (order) {
        if (!order) return null;
        return loadRazorpay().then(function () {
          return new Promise(function (resolve) {
            var checkout = new window.Razorpay({
              key: order.keyId,
              order_id: order.orderId,
              amount: order.amount,
              currency: order.currency || "INR",
              name: "ShortsCraft",
              description: (plan === "promax" ? "Pro Max" : "Pro") +
                (billingCycle === "yearly" ? " — yearly" : " — monthly"),
              theme: { color: "#2856d8" },
              handler: resolve,
              modal: { ondismiss: function () { resolve(null); } }
            });
            checkout.on("payment.failed", function () { resolve(null); });
            checkout.open();
          });
        });
      })
      .then(function (payment) {
        if (!payment) {
          say("Checkout closed. If a payment was deducted but your plan is not active, contact support with your payment reference.");
          return null;
        }
        say("Confirming payment…");
        return fetch("/api/razorpay/verify", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payment)
        }).then(function (response) {
          return response.json().then(function (body) {
            if (!response.ok || !body.success) throw new Error(body.error || "Payment could not be confirmed.");
            return body;
          });
        });
      })
      .then(function (result) {
        if (!result) return;
        say("Your " + (result.plan === "promax" ? "Pro Max" : "Pro") + " plan is active.", "ok");
        setTimeout(function () { window.location.href = "/account"; }, 900);
      })
      .catch(function (error) {
        say(error && error.message ? error.message : "Checkout failed. No plan was changed.", "err");
      })
      .finally(function () {
        button.disabled = false;
        button.textContent = original;
      });
  }

  var cycleSwitch = document.querySelector(".pg-billing-switch");
  if (cycleSwitch) {
    cycleSwitch.addEventListener("click", function (event) {
      var button = event.target.closest("button[data-cycle]");
      if (button) selectCycle(button.dataset.cycle);
    });
  }
  document.querySelectorAll(".pg-buy").forEach(function (button) {
    button.addEventListener("click", function () { beginCheckout(button); });
  });

  selectCycle("monthly");
  fetch("/api/offer", { headers: { Accept: "application/json" } })
    .then(function (response) { return response.json(); })
    .then(function (state) {
      if (!state || !state.success) return;
      paymentsLive = state.paymentsLive === true;
      opensOn = state.opensOn || "";
      if (!paymentsLive) {
        say(opensOn
          ? "Payments are not open yet. Expected availability: " + opensOn + "."
          : "Payments are not open yet. You can continue on the Free plan; no checkout will be attempted.");
      }
    })
    .catch(function () {
      say("Could not confirm payment availability. Checkout is disabled for safety.", "err");
    });
})();

/* ============================================================
   Credit calculator.

   The plan cards say what each tier gives. This answers the question the
   visitor actually has — which one is enough for me — by turning a posting
   rate into a credit number.

   The estimate: one export per Short, plus roughly 1.4 AI scenes' worth of
   generation per Short, since most people generate more than they keep. It
   is deliberately an over-estimate: recommending a plan that turns out to
   be too small is the failure that costs someone money.

   Thresholds come from the plans themselves, so repricing a tier moves the
   recommendation with it rather than leaving a stale number on the page.
   ============================================================ */
(function () {
  "use strict";

  var range = document.getElementById("calcRange");
  if (!range) return;

  var postsEl = document.getElementById("calcPosts");
  var labelEl = document.getElementById("calcPostsLabel");
  var neededEl = document.getElementById("calcNeeded");
  var nameEl = document.getElementById("calcRecName");
  var priceEl = document.getElementById("calcRecPrice");
  var whyEl = document.getElementById("calcRecWhy");
  var ctaEl = document.getElementById("calcRecCta");

  var plans = null;

  function tiers() {
    // Falls back to the shipped numbers if /api/config has not answered yet,
    // so the calculator is never blank or wrong on first paint.
    var free = (plans && plans.free) || { perDay: 5, inr: "₹0", price: 0 };
    var pro = (plans && plans.pro) || { perDay: 40, inr: "₹199", price: 199 };
    var max = (plans && plans.promax) || { perDay: 100, inr: "₹399", price: 399 };
    return [
      { key: "free", name: "Free", perDay: free.perDay, price: free.price,
        cta: "Create free account", href: "/signup",
        why: free.perDay + " credits a day covers what you post. Start here and upgrade only if that changes." },
      { key: "pro", name: "Pro", perDay: pro.perDay, price: pro.price,
        cta: "Choose Pro", href: "#plans",
        why: pro.perDay + " credits a day leaves room for AI scenes and re-exports at your posting rate." },
      { key: "promax", name: "Pro Max", perDay: max.perDay, price: max.price,
        cta: "Choose Pro Max", href: "#plans",
        why: "At this volume you want the highest queue priority and " + max.perDay + " credits a day." }
    ];
  }

  function paint() {
    var posts = Number(range.value) || 1;
    var needed = posts + Math.ceil(posts * 1.4);
    var list = tiers();
    var rec = list[list.length - 1];
    for (var i = 0; i < list.length; i++) {
      if (needed <= list[i].perDay) { rec = list[i]; break; }
    }

    if (postsEl) postsEl.textContent = String(posts);
    if (labelEl) labelEl.textContent = posts === 1 ? "Short a day" : "Shorts a day";
    if (neededEl) neededEl.textContent = needed + (needed === 1 ? " credit" : " credits");
    if (nameEl) nameEl.textContent = rec.name;
    if (priceEl) {
      priceEl.textContent = rec.price ? "₹" + rec.price + "/month" : "free";
    }
    if (whyEl) whyEl.textContent = rec.why;
    if (ctaEl) { ctaEl.textContent = rec.cta; ctaEl.setAttribute("href", rec.href); }
  }

  range.addEventListener("input", paint);
  paint();

  fetch("/api/config", { headers: { Accept: "application/json" } })
    .then(function (r) { return r.json(); })
    .then(function (j) {
      if (j && j.plans) { plans = j.plans; paint(); }
    })
    .catch(function () {});
})();
