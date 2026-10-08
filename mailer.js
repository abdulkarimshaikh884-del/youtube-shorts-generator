/* ============================================================
   mailer.js — transactional account email through Resend.

   The browser never sees the API key. Production refuses to pretend a reset
   email was sent when delivery is not configured; development exposes a
   one-time preview URL from the route instead, so the full flow stays testable
   without weakening production.
   ============================================================ */
const crypto = require("crypto");

const RESEND_URL = "https://api.resend.com/emails";

function configured() {
  return Boolean(
    String(process.env.RESEND_API_KEY || "").trim() &&
    String(process.env.AUTH_FROM_EMAIL || "").trim()
  );
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function siteOrigin() {
  try {
    const url = new URL(process.env.PUBLIC_SITE_URL || "https://shortscraft.online");
    if (url.protocol === "https:" && !url.username && !url.password) return url.origin;
    if (process.env.NODE_ENV !== "production" && ["localhost", "127.0.0.1"].includes(url.hostname) && url.protocol === "http:") return url.origin;
  } catch {}
  return "https://shortscraft.online";
}

// Tables and inline styles also work when an email client strips the <head>.
// The wordmark remains visible if the recipient blocks remote images.
function accountHtml({ title, lines, link, action, footer }) {
  return '<!doctype html><html lang="en"><head><meta name="viewport" content="width=device-width,initial-scale=1"><meta charset="utf-8"><title>' + escapeHtml(title) + '</title></head>' +
    '<body style="margin:0;padding:0;background:#07070b;font-family:Arial,sans-serif;color:#ffffff"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#07070b"><tr><td align="center" style="padding:28px 12px">' +
    '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#101018;border:1px solid #292735;border-radius:18px"><tr><td style="padding:28px 24px">' +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td width="56"><img src="' + escapeHtml(siteOrigin() + '/favicon-192.png') + '" width="44" height="44" alt="ShortsCraft logo" style="display:block;border:0;border-radius:50%"></td><td style="color:#ffffff;font-size:22px;font-weight:bold">Shorts<span style="color:#a995ff">Craft</span></td></tr></table>' +
    '<p style="margin:26px 0 12px;color:#a995ff;font-size:11px;font-weight:bold;letter-spacing:2px">ACCOUNT NOTIFICATION</p>' +
    '<h1 style="margin:0 0 18px;font-size:28px;line-height:1.25;color:#ffffff;overflow-wrap:anywhere">' + escapeHtml(title) + '</h1>' +
    lines.map(line => '<p style="margin:0 0 18px;color:#c8c7d2;font-size:15px;line-height:1.65;overflow-wrap:anywhere">' + escapeHtml(line) + '</p>').join('') +
    '<table role="presentation" cellpadding="0" cellspacing="0"><tr><td style="background:#a995ff;border-radius:10px"><a href="' + escapeHtml(link) + '" style="display:inline-block;padding:14px 20px;color:#101018;font-size:14px;font-weight:bold;text-decoration:none">' + escapeHtml(action) + '</a></td></tr></table>' +
    '<p style="margin:26px 0 0;color:#aaa9b4;font-size:12px;line-height:1.65;overflow-wrap:anywhere">' + escapeHtml(footer) + '</p>' +
    '</td></tr></table><p style="margin:18px 0 0;color:#aaa9b4;font-size:11px">ShortsCraft · Create something that stands out.</p></td></tr></table></body></html>';
}

function passwordResetPayload({ to, resetUrl }) {
  return { from: process.env.AUTH_FROM_EMAIL, to: [to], subject: "Reset your ShortsCraft password",
    html: accountHtml({ title: "Reset your password", lines: ["Use the secure link below within 30 minutes. It works once and then expires."], link: resetUrl, action: "Choose a new password", footer: "If you did not request this, you can ignore the message. Your current password stays unchanged." }),
    text: `Reset your ShortsCraft password within 30 minutes: ${resetUrl}\n\nIf you did not request this, ignore this email.` };
}

function verificationPayload({ to, verificationUrl }) {
  return { from: process.env.AUTH_FROM_EMAIL, to: [to], subject: "Verify your ShortsCraft email",
    html: accountHtml({ title: "Verify your email", lines: ["Confirm your account email to qualify for referral credits after your first successful export."], link: verificationUrl, action: "Verify email", footer: "This link expires in 24 hours. If you did not request this, ignore it." }),
    text: `Verify your ShortsCraft email within 24 hours: ${verificationUrl}` };
}

async function sendPasswordReset({ to, resetUrl, tokenHash }) {
  if (!configured()) throw new Error("Password reset email is not configured.");

  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `shortscraft-reset-${String(tokenHash).slice(0, 32)}`,
    },
    body: JSON.stringify(passwordResetPayload({ to, resetUrl })),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    throw new Error(`Resend rejected the password email (${response.status}).`);
  }
  const data = await response.json();
  return { id: data.id || crypto.randomUUID() };
}

async function sendEmailVerification({ to, verificationUrl, tokenHash }) {
  if (!configured()) throw new Error("Verification email is not configured.");
  const response = await fetch(RESEND_URL, {
    method: "POST", headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json", "Idempotency-Key": `shortscraft-verify-${tokenHash.slice(0, 32)}` },
    body: JSON.stringify(verificationPayload({ to, verificationUrl })),
    signal: AbortSignal.timeout(12_000)
  });
  if (!response.ok) throw new Error("Verification email delivery failed. Please retry later.");
  return response.json();
}
// No arbitrary HTML, URLs or recipients are accepted from the browser. These
// templates are built by the server from a committed business event.
function transactionalPayload({ to, kind, data = {} }) {
  const text = (v, limit = 120) => String(v || "").replace(/[\r\n\x00-\x1f]/g, " ").slice(0, limit);
  const reference = text(data.reference, 80);
  const amount = Number.isSafeInteger(data.amountPaise) && data.amountPaise >= 0
    ? `INR ${(data.amountPaise / 100).toFixed(2)}` : null;
  let subject, lines, path = "/account", action = "Open your account";
  switch (kind) {
    case "welcome":
      subject = "Welcome to ShortsCraft";
      lines = [`Hi ${text(data.displayName, 50) || "creator"}, your account is ready.`, "Choose a template, customise it and create your first export. If you did not create this account, contact us through our website."];
      break;
    case "new_device":
      subject = "New browser login to your ShortsCraft account";
      lines = [`A successful login was detected from ${text(data.browser, 80) || "a new browser"}${data.time ? " at " + text(data.time, 40) : ""}.`, "If this was you, no action is needed. Otherwise, reset your password immediately. Cookies being cleared or private browsing can also trigger this alert."];
      path = "/forgot-password"; action = "Secure your account"; break;
    case "password_changed":
      subject = "Your ShortsCraft password was changed";
      lines = ["Your password has been changed successfully. Previous sessions were signed out.", "If you did not make this change, reset your password and contact support."];
      path = "/forgot-password"; action = "Secure your account"; break;
    case "google_linked":
      subject = "Google sign-in connected to ShortsCraft";
      lines = ["Google sign-in was connected to your account.", "If you did not make this change, contact support through our website."]; break;
    case "referral_reward":
      if (data.credits !== 10) throw new Error("Invalid referral reward");
      subject = "Your ShortsCraft referral reward is ready";
      lines = ["10 bonus credits have been added to your account after a qualifying referral completed its first successful export."];
      path = "/account/referrals"; break;
    case "purchase_receipt":
      if (!amount || !reference) throw new Error("Invalid receipt");
      subject = "Your ShortsCraft purchase confirmation";
      lines = [`Your verified purchase of ${text(data.product, 80) || "ShortsCraft credits"} was completed.`, `Amount: ${amount}. Reference: ${reference}.`]; break;
    case "withdrawal_requested":
      if (!amount || !reference) throw new Error("Invalid withdrawal");
      subject = "ShortsCraft withdrawal request received";
      lines = [`We received your withdrawal request for ${amount}. Reference: ${reference}.`, "This confirms the request only, not a completed bank transfer."]; break;
    case "withdrawal_processed":
      if (!amount || !reference) throw new Error("Invalid withdrawal");
      subject = "ShortsCraft withdrawal request updated";
      lines = [`Your ${amount} withdrawal request was marked processed by our team. Reference: ${reference}.`, "Check your bank account for settlement. This status email is not independent confirmation of bank receipt."]; break;
    case "withdrawal_rejected":
      if (!reference) throw new Error("Invalid withdrawal");
      subject = "ShortsCraft withdrawal request not approved";
      lines = [`Your withdrawal request was not approved. Reference: ${reference}.`, "Open your account for the status and any balance adjustment. Contact support if you need help."]; break;
    case "support_reply":
      if (!reference) throw new Error("Invalid support reference");
      subject = "ShortsCraft support replied to your request";
      lines = ["There is a new reply to your support request. Sign in to read it privately."];
      path = "/contact?ticket=" + encodeURIComponent(reference) + "#supportHistory"; action = "Read support reply"; break;
    case "template_status":
      if (!["published", "rejected", "archived", "review", "pending"].includes(data.status)) throw new Error("Invalid template status");
      subject = "Your ShortsCraft creation status changed";
      lines = [`Your creation ${text(data.title) || "Untitled"} is now ${data.status}.`, "Open your account for details and any review notes."]; break;
    default: throw new Error("Unsupported email event");
  }
  const link = siteOrigin() + path;
  return { from: process.env.AUTH_FROM_EMAIL, to: [to], subject,
    text: lines.join("\n\n") + `\n\n${action}: ${link}`,
    html: accountHtml({ title: subject, lines, link, action, footer: "This is an account notification, not a promotional email. Never share passwords or verification codes." }) };
}

async function sendTransactional(payload, eventKey) {
  if (!configured()) throw new Error("Transactional email is not configured");
  const response = await fetch(RESEND_URL, { method: "POST",
    headers: { Authorization: `Bearer ${process.env.RESEND_API_KEY}`, "Content-Type": "application/json", "Idempotency-Key": `shortscraft-event-${eventKey}` },
    body: JSON.stringify(payload), signal: AbortSignal.timeout(12_000) });
  if (!response.ok) {
    // Provider bodies can contain recipient details: don't put them in logs.
    const err = new Error("Email provider rejected event");
    err.status = response.status;
    err.permanent = response.status >= 400 && response.status < 500 && ![409, 429].includes(response.status);
    throw err;
  }
  const result = await response.json();
  if (typeof result.id !== "string" || !result.id) throw new Error("Email provider response missing ID");
  return { id: result.id };
}
module.exports = { configured, sendPasswordReset, sendEmailVerification, transactionalPayload, sendTransactional, passwordResetPayload, verificationPayload };
