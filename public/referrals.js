(function () {
  "use strict";
  var section = document.getElementById("referralSettings");
  if (!section) return;
  var message = document.getElementById("referralMessage");
  function show(value) { message.hidden = false; message.textContent = value; }
  function api(url, options) {
    return fetch(url, options).then(function (r) { return r.json().then(function (j) {
      if (!r.ok || j.error) throw new Error(j.error || "Request failed. Please retry.");
      return j;
    }); });
  }
  function load() {
    return api("/api/referrals").then(function (j) {
      if (!j.enabled) return;
      section.hidden = false;
      document.getElementById("referralLink").value = location.origin + "/signup?ref=" + encodeURIComponent(j.code);
      document.getElementById("referralStats").textContent = j.rewarded + " rewarded · " + j.pending + " pending · " + j.this_month + "/" + j.monthlyLimit + " rewarded this month";
      document.getElementById("referralVerifyRow").hidden = j.emailVerified;
    });
  }
  document.getElementById("copyReferralLink").addEventListener("click", function () {
    var input = document.getElementById("referralLink");
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
        var next = "/settings?verify=" + encodeURIComponent(token);
        var login = document.querySelector('#accountGuest a[href^="/login"]');
        if (login) login.href = "/login?next=" + encodeURIComponent(next);
      }
      return;
    }
    if (!token) return load();
    return api("/api/auth/verification/confirm", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ token: token }) })
      .then(function () { return load().then(function () { show("Your email is verified."); }); })
      .catch(function (err) { section.hidden = false; show(err.message); })
      .finally(function () { var url = new URL(location.href); url.searchParams.delete("verify"); history.replaceState(null, "", url.pathname + url.search + url.hash); });
  }).catch(function (err) {
    // Visible errors for signed-in settings, not fabricated zero counters.
    var account = document.getElementById("accountBox");
    if (account && !account.hidden) { section.hidden = false; show(err.message); }
  });
})();
