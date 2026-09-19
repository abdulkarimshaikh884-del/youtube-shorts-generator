/* report.js — the "Report" dialog, shared by every page that shows content
   someone might need to flag: templates, tutorials, creator profiles and
   comments. Usage: SC_REPORT.open({ type: "template", id: "comm_x", name: "Title" }). */
(function () {
  var REASONS = [
    ["copyright", "Copyright or stolen work", "Someone else's template, video or design"],
    ["inappropriate", "Inappropriate content", "Offensive, explicit or hateful"],
    ["spam", "Spam or misleading", "Ads, scams or clickbait"],
    ["impersonation", "Pretending to be someone else", "Uses another creator's name or brand"],
    ["broken", "Broken or not working", "Blank preview, wrong text or export fails"],
    ["other", "Something else", "Tell us below"]
  ];
  var NOUN = { template: "template", tutorial: "tutorial", creator: "creator", comment: "comment" };
  var box = null, lastFocus = null, current = null;

  function build() {
    box = document.createElement("div");
    box.className = "sc-report-overlay";
    box.hidden = true;
    box.innerHTML =
      '<form class="sc-report-card" role="dialog" aria-modal="true" aria-labelledby="scReportTitle" novalidate>' +
      '  <h2 id="scReportTitle">Report</h2>' +
      '  <p class="sc-report-sub" id="scReportSub"></p>' +
      '  <fieldset class="sc-report-reasons"><legend class="sc-report-sr">Reason</legend></fieldset>' +
      '  <label class="sc-report-field"><span>Details <small id="scReportOpt">(optional)</small></span>' +
      '    <textarea id="scReportDetails" rows="3" maxlength="1000" placeholder="Links or anything that helps us check"></textarea></label>' +
      '  <p class="sc-report-msg" id="scReportMsg" role="status" aria-live="polite"></p>' +
      '  <div class="sc-report-actions">' +
      '    <button type="button" class="sc-report-cancel" id="scReportCancel">Cancel</button>' +
      '    <button type="submit" class="sc-report-send" id="scReportSend">Send report</button>' +
      '  </div>' +
      '</form>';
    var fs = box.querySelector("fieldset");
    REASONS.forEach(function (r) {
      var label = document.createElement("label");
      label.className = "sc-report-reason";
      label.innerHTML = '<input type="radio" name="scReportReason" value="' + r[0] + '"><span><b></b><small></small></span>';
      label.querySelector("b").textContent = r[1];
      label.querySelector("small").textContent = r[2];
      fs.appendChild(label);
    });
    document.body.appendChild(box);

    box.addEventListener("click", function (ev) { if (ev.target === box) close(); });
    box.querySelector("#scReportCancel").addEventListener("click", close);
    document.addEventListener("keydown", function (ev) { if (ev.key === "Escape" && !box.hidden) close(); });
    fs.addEventListener("change", function () {
      var other = (box.querySelector("input[name=scReportReason]:checked") || {}).value === "other";
      box.querySelector("#scReportOpt").textContent = other ? "(required)" : "(optional)";
    });
    box.querySelector("form").addEventListener("submit", send);
  }

  function msg(text, bad) {
    var el = box.querySelector("#scReportMsg");
    el.textContent = text || "";
    el.classList.toggle("bad", !!bad);
  }

  function open(target) {
    if (!box) build();
    current = target;
    lastFocus = document.activeElement;
    box.querySelector("#scReportTitle").textContent = "Report this " + (NOUN[target.type] || "item");
    box.querySelector("#scReportSub").textContent = target.name
      ? "“" + target.name + "”. Reports go to the ShortsCraft team, not to the creator."
      : "Reports go to the ShortsCraft team, not to the creator.";
    Array.prototype.forEach.call(box.querySelectorAll("input[name=scReportReason]"), function (i) { i.checked = false; });
    box.querySelector("#scReportDetails").value = "";
    box.querySelector("#scReportOpt").textContent = "(optional)";
    box.querySelector("#scReportSend").disabled = false;
    box.querySelector("#scReportSend").hidden = false;
    box.querySelector("#scReportCancel").textContent = "Cancel";
    box.querySelector("fieldset").disabled = false;
    msg("");
    box.hidden = false;
    document.documentElement.classList.add("sc-report-open");
    var first = box.querySelector("input[name=scReportReason]");
    if (first) first.focus();
  }

  function close() {
    if (!box) return;
    box.hidden = true;
    document.documentElement.classList.remove("sc-report-open");
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }

  function send(ev) {
    ev.preventDefault();
    var picked = box.querySelector("input[name=scReportReason]:checked");
    var details = box.querySelector("#scReportDetails").value.trim();
    if (!picked) { msg("Choose a reason.", true); return; }
    if (picked.value === "other" && details.length < 5) { msg("Tell us a little about the problem.", true); return; }
    var btn = box.querySelector("#scReportSend");
    btn.disabled = true;
    msg("Sending…");
    fetch("/api/reports", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetType: current.type, targetId: current.id, reason: picked.value, details: details })
    }).then(function (r) {
      return r.json().then(function (j) {
        if (!r.ok || !j.success) throw new Error(j.error || "Could not send the report. Please try again.");
        return j;
      });
    }).then(function (j) {
      msg(j.already ? "You already reported this. We're looking at it." : "Thanks. The team will review it.");
      btn.hidden = true;
      box.querySelector("fieldset").disabled = true;
      box.querySelector("#scReportCancel").textContent = "Close";
    }).catch(function (err) {
      msg(err.message, true);
      btn.disabled = false;
    });
  }

  window.SC_REPORT = { open: open, close: close };
})();
