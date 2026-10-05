(function () {
  "use strict";
  var section = document.getElementById("referralSettings");
  if (!section) return;
  if (window.SC_ACCOUNT_ROUTES && (!window.SC_ACCOUNT_NAV || window.SC_ACCOUNT_NAV.current !== "referrals")) return;
  var message = document.getElementById("referralMessage");
  var ready = document.getElementById("referralReady");
  var retry = document.getElementById("retryReferral");
  var copy = document.getElementById("copyReferralLink");
  function show(value) { message.hidden = false; message.textContent = value; }
  function api(url, options) {
    var controller = new AbortController();
    var timer = setTimeout(function () { controller.abort(); }, 20000);
    return fetch(url, Object.assign({credentials:"same-origin",cache:"no-store",signal:controller.signal}, options)).then(function (r) { return r.json().then(function (j) {
      if (!r.ok || j.error) throw new Error(j.error || "Request failed. Please retry.");
      return j;
    }); }).finally(function () { clearTimeout(timer); });
  }
  function unavailable(err) {
    if (ready) ready.hidden = true;
    copy.disabled = true;
    document.getElementById("referralLink").value = "";
    if (retry) { retry.hidden = false; retry.disabled = false; }
    show(err.name === "AbortError" ? "The request timed out. Please retry." : err.message || "Referral details could not be loaded. Please retry.");
  }
  function load() {
    if (retry) { retry.hidden = true; retry.disabled = true; }
    show("Loading referral details…");
    return api("/api/referrals").then(function (j) {
      if (!j.enabled) {
        unavailable(new Error("Referrals are not available yet. Invite links and rewards will be enabled after verification is ready."));
        return;
      }
      if (!/^[A-Za-z0-9_-]{16}$/.test(j.code || "") || ![j.rewarded,j.pending,j.this_month,j.monthlyLimit].every(function (n) { return Number.isInteger(n) && n >= 0; })) {
        throw new Error("Referral details could not be loaded. Please retry.");
      }
      if (ready) ready.hidden = false;
      copy.disabled = false;
      document.getElementById("referralLink").value = location.origin + "/signup?ref=" + encodeURIComponent(j.code);
      document.getElementById("referralStats").textContent = j.rewarded + " rewarded · " + j.pending + " pending · " + j.this_month + "/" + j.monthlyLimit + " rewarded this month";
      document.getElementById("referralVerifyRow").hidden = j.emailVerified;
      show(j.emailVerified ? "Your account is verified. Rewards are added after your friend's first successful export." : "Your friend needs a verified account and successful export. Verify your own email if you joined through an invite.");
    });
  }
  if (retry) retry.addEventListener("click", function () { load().catch(unavailable); });
  copy.addEventListener("click", function () {
    var input = document.getElementById("referralLink");
    if (!input.value || this.disabled) return;
    if (!navigator.clipboard || !window.isSecureContext) { input.focus(); input.select(); show("Select and copy your invite link."); return; }
    navigator.clipboard.writeText(input.value).then(function () { show("Invite link copied."); }).catch(function () { input.focus(); input.select(); show("Select and copy your invite link."); });
  });
  document.getElementById("sendVerification").addEventListener("click", function () {
    var button = this; button.disabled = true;
    api("/api/auth/verification/send", { method: "POST" }).then(function (j) { show(j.message); })
      .catch(function (err) { show(err.message); }).finally(function () { button.disabled = false; });
  });
  var token = new URLSearchParams(location.search).get("verify");
  api("/api/auth/me").then(function (j) {
    if (!j.user) {
      if (token) {
        var next = "/account/referrals?verify=" + encodeURIComponent(token);
        var login = document.querySelector('#accountGuest a[href^="/login"]');
        if (login) login.href = "/login?next=" + encodeURIComponent(next);
      }
      return;
    }
    if (!token) return load();
    return api("/api/auth/verification/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token }) })
      .then(function () { return load().then(function () { show("Your email is verified."); }); })
      .catch(function (err) { return load().then(function () { show(err.message); }).catch(unavailable); })
      .finally(function () { var url = new URL(location.href); url.searchParams.delete("verify"); history.replaceState(null, "", url.pathname + url.search + url.hash); });
  }).catch(function (err) {
    // Visible errors for signed-in settings, not fabricated zero counters.
    var account = document.getElementById("accountBox");
    if (account && !account.hidden) unavailable(err);
  });
})();
