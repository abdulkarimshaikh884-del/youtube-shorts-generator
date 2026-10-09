(function () {
  "use strict";
  var section = document.getElementById("referralSettings");
  if (!section || (window.SC_ACCOUNT_ROUTES && (!window.SC_ACCOUNT_NAV || window.SC_ACCOUNT_NAV.current !== "referrals"))) return;
  var byId = function (id) { return document.getElementById(id); };
  var message = byId("referralMessage"), ready = byId("referralReady"), retry = byId("retryReferral");
  var copy = byId("copyReferralLink"), share = byId("shareReferralLink"), verify = byId("sendVerification");
  var state = {enabled:false,user:null,cursor:null,historyBusy:false,historyIds:new Set(),sending:false,confirming:false};
  var token = new URLSearchParams(location.search).get("verify");
  // Page load never consumes a token. Keep it only in this closure until an
  // explicit confirmation or login return, not in storage or the visible URL.
  if (new URLSearchParams(location.search).has("verify")) {
    var clean = new URL(location.href); clean.searchParams.delete("verify");
    history.replaceState(null, "", clean.pathname + clean.search + clean.hash);
  }
  var validToken = typeof token === "string" && /^[A-Za-z0-9_-]{43}$/.test(token);
  var cooldownUntil = 0, cooldownTimer;
  function integer(value) { return Number.isInteger(value) && value >= 0; }
  function text(id, value) { byId(id).textContent = value; }
  function request(url, options) {
    var controller = new AbortController(), timer = setTimeout(function () { controller.abort(); }, 20000);
    return fetch(url, Object.assign({credentials:"same-origin",cache:"no-store",signal:controller.signal}, options)).then(function (response) {
      return response.json().catch(function () { return {}; }).then(function (body) {
        if (!response.ok || body.error || body.success === false) {
          var error = new Error(body.error || "Something went wrong. Please retry.");
          error.status = response.status;
          var delay = response.headers.get("Retry-After");
          error.retryAfter = /^\d+$/.test(delay || "") ? Number(delay) : Math.max(0, Math.ceil((Date.parse(delay) - Date.now()) / 1000)) || 0;
          throw error;
        }
        return body;
      });
    }).finally(function () { clearTimeout(timer); });
  }
  function errorText(error) { return error.name === "AbortError" ? "The request timed out. Please retry." : error.message || "Could not load referral details. Please retry."; }
  function setState(kind, value) {
    byId("referralState").dataset.state = kind;
    section.setAttribute("aria-busy", String(kind === "loading"));
    message.textContent = value; retry.hidden = kind !== "error"; retry.disabled = kind === "loading";
  }
  function unavailable(error) {
    state.enabled = false; ready.hidden = true; copy.disabled = true; share.disabled = true;
    byId("referralLink").value = ""; byId("confirmReferralEmail").disabled = true;
    setState("error", errorText(error));
  }
  function stat(id, value) { text(id, integer(value) ? value.toLocaleString() : "—"); }
  function renderSummary(data) {
    state.enabled = data.enabled === true;
    var hasStats = [data.rewarded,data.pending,data.this_month,data.monthlyLimit].every(integer);
    // Old disabled responses contain no counters. Never fabricate zero data.
    if (!state.enabled && (!hasStats || data.available === false)) {
      ready.hidden = true; copy.disabled = true; share.disabled = true; byId("referralLink").value = "";
      setState("disabled", "Referrals are not available yet. Invite links and rewards will be enabled after verification is ready.");
      renderConfirmation(); return;
    }
    if (!hasStats || (state.enabled && !/^[A-Za-z0-9_-]{16}$/.test(data.code || ""))) throw new Error("Referral details could not be loaded. Please retry.");
    ready.hidden = false; byId("referralInvitePanel").hidden = !state.enabled;
    copy.disabled = !state.enabled; share.disabled = !state.enabled;
    byId("referralLink").value = state.enabled ? location.origin + "/signup?ref=" + encodeURIComponent(data.code) : "";
    stat("referralTotal", data.totalInvited); stat("referralPending", data.pending); stat("referralBonus", data.bonusEarned);
    text("referralMonth", data.this_month + "/" + data.monthlyLimit);
    text("referralStats", data.rewarded + " rewarded · " + data.pending + " pending · " + data.this_month + "/" + data.monthlyLimit + " rewarded this month");
    text("referralCapNotice", data.this_month >= data.monthlyLimit ? "Monthly limit reached. New qualifying referrals do not earn credits for either person and are not carried into next month." : "Up to " + data.monthlyLimit + " rewarded referrals per month (UTC). Bonus credits are separate from your daily credits.");
    byId("referralVerificationBadge").hidden = data.emailVerified !== true;
    byId("referralVerifyRow").hidden = !state.enabled || data.emailVerified === true;
    if (data.emailVerified === true) text("referralVerificationMessage", "");
    setState(state.enabled ? "ready" : "paused", state.enabled ? (data.emailVerified ? "Your account is verified. Rewards are added after your friend's first successful export." : "Share your link with a new friend. Their verified account and first successful export unlock both rewards.") : "New invites and rewards are paused. Your existing activity and earned bonus credits are kept.");
    renderConfirmation(); updateCooldown();
  }
  var statusText = {unverified:"Needs verification",export_pending:"First export pending",reward_pending:"Reward processing",rewarded:"Rewarded",limited:"Monthly limit reached",ineligible:"Not eligible"};
  function rowDate(value) {
    if (typeof value !== "string" || !value.trim()) return "";
    var date = new Date(value);
    return Number.isFinite(date.getTime()) ? date.toLocaleDateString(undefined,{day:"numeric",month:"short",year:"numeric"}) : "";
  }
  function appendHistory(items) {
    items.forEach(function (item) {
      if (!item || typeof item.id !== "string" || !item.id || item.id.length > 160 || !Object.prototype.hasOwnProperty.call(statusText, item.status)) throw new Error("Activity could not be read safely. Please retry.");
    });
    items.forEach(function (item) {
      if (state.historyIds.has(item.id)) return;
      state.historyIds.add(item.id);
      var row = document.createElement("li"); row.className = "rf-history-row";
      var content = document.createElement("div"), label = document.createElement("strong"), caption = document.createElement("small"), badge = document.createElement("span");
      // Only generic owner-scoped labels; never friend emails/raw account IDs.
      label.textContent = /^Referral [A-Za-z0-9_-]{4,24}$/.test(item.displayLabel || "") ? item.displayLabel : "Referral";
      caption.textContent = (rowDate(item.createdAt) || "Date unavailable") + (item.status === "rewarded" && rowDate(item.rewardedAt) ? " · Reward added " + rowDate(item.rewardedAt) : "");
      badge.className = "rf-status"; badge.dataset.status = item.status;
      badge.textContent = statusText[item.status] + (item.status === "rewarded" && integer(item.credits) ? " · +" + item.credits + " credits" : "");
      content.append(label,caption); row.append(content,badge); byId("referralHistoryList").appendChild(row);
    });
  }
  function loadHistory(reset) {
    if (state.historyBusy) return Promise.resolve();
    state.historyBusy = true;
    if (reset) { state.cursor = null; state.historyIds.clear(); byId("referralHistoryList").replaceChildren(); }
    byId("moreReferralHistory").disabled = true; byId("retryReferralHistory").hidden = true;
    text("referralHistoryMessage", "Loading activity…");
    var url = "/api/referrals/history?limit=10" + (state.cursor ? "&cursor=" + encodeURIComponent(state.cursor) : "");
    return request(url).then(function (data) {
      if (data.available === false) {
        text("referralHistoryMessage", "Detailed activity is not available yet. Your existing credit balance is unchanged.");
        byId("moreReferralHistory").hidden = true; return;
      }
      if (!Array.isArray(data.items) || typeof data.hasMore !== "boolean" || (data.hasMore && (typeof data.nextCursor !== "string" || !data.nextCursor || data.nextCursor.length > 2048))) throw new Error("Activity could not be loaded. Please retry.");
      appendHistory(data.items); state.cursor = data.hasMore ? data.nextCursor : null;
      byId("moreReferralHistory").hidden = !data.hasMore;
      text("referralHistoryMessage", state.historyIds.size ? "Only referral progress is shown. Your friends' personal details stay private." : "No referrals yet. When a new friend joins through your link, their progress will appear here.");
    }).catch(function (error) {
      byId("moreReferralHistory").hidden = true;
      if (error.status === 404) text("referralHistoryMessage", "Detailed activity is not available in this version yet.");
      else { text("referralHistoryMessage", errorText(error)); byId("retryReferralHistory").hidden = false; }
    }).finally(function () { state.historyBusy = false; byId("moreReferralHistory").disabled = false; });
  }
  function load() {
    ready.hidden = true; copy.disabled = true; share.disabled = true; setState("loading", "Loading referral details…");
    return request("/api/referrals").then(function (data) { renderSummary(data); if (!ready.hidden) return loadHistory(true); });
  }
  function cooldownKey() { return state.user ? "sc_referral_resend_" + state.user.id : null; }
  function rememberCooldown() { try { sessionStorage.setItem(cooldownKey(), String(cooldownUntil)); } catch (_) {} }
  function updateCooldown() {
    clearTimeout(cooldownTimer);
    var seconds = Math.max(0, Math.ceil((cooldownUntil - Date.now()) / 1000));
    verify.disabled = state.sending || !state.enabled || seconds > 0;
    verify.textContent = state.sending ? "Sending…" : seconds ? "Resend in " + seconds + "s" : cooldownUntil ? "Resend email" : "Verify email";
    if (seconds) cooldownTimer = setTimeout(updateCooldown, 1000);
  }
  function renderConfirmation() {
    if (!token) return;
    byId("referralConfirmPanel").hidden = false;
    byId("confirmReferralEmail").disabled = !validToken || !state.user || !state.enabled || state.confirming;
    text("referralConfirmMessage", !validToken ? "This verification link is invalid. Request a new email below." : !state.enabled ? "Email confirmation is unavailable while referrals are paused. No token has been used." : "Choose Confirm email to finish. Verification links expire after 24 hours.");
  }
  retry.addEventListener("click", function () { load().catch(unavailable); });
  byId("moreReferralHistory").addEventListener("click", function () { loadHistory(false); });
  byId("retryReferralHistory").addEventListener("click", function () { loadHistory(state.historyIds.size === 0); });
  copy.addEventListener("click", function () {
    var input = byId("referralLink"); if (!input.value || copy.disabled) return;
    function fallback() { input.focus(); input.select(); text("referralFeedback", "Select and copy your invite link."); }
    if (!navigator.clipboard || !window.isSecureContext) return fallback();
    navigator.clipboard.writeText(input.value).then(function () { text("referralFeedback", "Invite link copied."); }).catch(fallback);
  });
  share.addEventListener("click", function () {
    if (share.disabled || !byId("referralLink").value) return;
    if (window.SC_UI && typeof SC_UI.share === "function") SC_UI.share({url:byId("referralLink").value,title:"Join me on ShortsCraft",text:"Get 10 bonus credits each after your verified account's first successful export."});
    else text("referralFeedback", "Use Copy to share your invite link.");
  });
  verify.addEventListener("click", function () {
    if (verify.disabled || state.sending || !state.enabled) return;
    state.sending = true; cooldownUntil = Date.now() + 60000; rememberCooldown(); updateCooldown(); verify.setAttribute("aria-busy", "true");
    text("referralVerificationMessage", "Requesting a verification email…");
    // Never retry email POSTs automatically: a timeout can mean it was accepted.
    request("/api/auth/verification/send", {method:"POST"}).then(function (data) {
      if (data.success !== true) throw new Error("The send could not be confirmed. Check your inbox before requesting another email.");
      text("referralVerificationMessage", data.message || "Verification requested. Check your inbox; arrival can take a moment.");
    }).catch(function (error) {
      if (error.retryAfter) { cooldownUntil = Math.max(cooldownUntil, Date.now() + Math.min(error.retryAfter, 86400) * 1000); rememberCooldown(); }
      text("referralVerificationMessage", error.name === "AbortError" ? "We could not confirm the send. Check your inbox before requesting another email." : errorText(error));
    }).finally(function () { state.sending = false; verify.removeAttribute("aria-busy"); updateCooldown(); });
  });
  byId("confirmReferralEmail").addEventListener("click", function () {
    if (this.disabled || state.confirming || !validToken) return;
    state.confirming = true; this.disabled = true; this.setAttribute("aria-busy", "true"); text("referralConfirmMessage", "Confirming your email…");
    var suppliedToken = token;
    function confirmed() {
      token = null; validToken = false;
      text("referralConfirmMessage", "Your email is verified.");
      byId("confirmReferralEmail").hidden = true;
    }
    request("/api/auth/verification/confirm", {method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({token:suppliedToken})}).then(function (data) {
      if (data.success !== true) throw new Error("Email confirmation could not be verified. Please open a new verification email.");
      confirmed();
      // A subsequent summary outage must not misreport a successful confirmation.
      return load().catch(unavailable);
    }).catch(function (error) {
      if (error.status === 400 || error.status === 403) {
        token = null; validToken = false;
        text("referralConfirmMessage", errorText(error) + " You can request a new verification email below.");
        return;
      }
      // A timeout/503 may follow an accepted request. Read the current state,
      // never silently repeat the POST, and keep an unused token in memory only.
      text("referralConfirmMessage", "Checking whether your email was verified…");
      return request("/api/referrals").then(function (data) {
        renderSummary(data);
        if (data.emailVerified === true) confirmed();
        else {
          text("referralConfirmMessage", errorText(error) + " Your email is not verified yet. You can retry confirmation below.");
          byId("confirmReferralEmail").textContent = "Retry confirmation";
        }
        if (!ready.hidden) return loadHistory(true);
      }).catch(function (summaryError) {
        unavailable(summaryError);
        text("referralConfirmMessage", "We could not confirm the request or check your email status. Retry loading referral details before confirming again. No automatic retry was sent.");
      });
    }).finally(function () {
      state.confirming = false;
      var button = byId("confirmReferralEmail");
      button.hidden = !validToken;
      button.disabled = !validToken || !state.user || !state.enabled;
      button.removeAttribute("aria-busy");
    });
  });
  request("/api/auth/me").then(function (data) {
    state.user = data.user;
    if (!state.user) {
      setState("guest", "Log in to view your referral activity.");
      if (token) {
        var next = "/account/referrals?verify=" + encodeURIComponent(token), login = document.querySelector('#accountGuest a[href^="/login"]');
        if (login) login.href = "/login?next=" + encodeURIComponent(next);
      }
      return;
    }
    try { cooldownUntil = Number(sessionStorage.getItem(cooldownKey())) || 0; } catch (_) {}
    if (!Number.isFinite(cooldownUntil) || cooldownUntil > Date.now() + 86400000) cooldownUntil = 0;
    return load();
  }).catch(unavailable);
  window.addEventListener("pagehide", function () { clearTimeout(cooldownTimer); });
})();
