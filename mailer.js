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

async function sendPasswordReset({ to, resetUrl, tokenHash }) {
  if (!configured()) throw new Error("Password reset email is not configured.");

  const safeUrl = escapeHtml(resetUrl);
  const response = await fetch(RESEND_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      "Content-Type": "application/json",
      "Idempotency-Key": `shortscraft-reset-${String(tokenHash).slice(0, 32)}`,
    },
    body: JSON.stringify({
      from: process.env.AUTH_FROM_EMAIL,
      to: [to],
      subject: "Reset your ShortsCraft password",
      html:
        '<div style="margin:0;background:#07070b;padding:34px 18px;font-family:Inter,Arial,sans-serif;color:#fff">' +
          '<div style="max-width:540px;margin:auto;border:1px solid #292735;border-radius:20px;background:#101018;padding:32px">' +
            '<p style="margin:0 0 18px;color:#a995ff;font-size:11px;font-weight:700;letter-spacing:.16em;text-transform:uppercase">ShortsCraft account</p>' +
            '<h1 style="margin:0 0 14px;font-size:28px;line-height:1.1">Reset your password</h1>' +
            '<p style="margin:0 0 24px;color:#aaa9b4;font-size:15px;line-height:1.6">Use the secure link below within 30 minutes. It works once and then expires.</p>' +
            `<a href="${safeUrl}" style="display:inline-block;border-radius:12px;background:#fff;color:#000;padding:14px 22px;font-weight:700;text-decoration:none">Choose a new password</a>` +
            '<p style="margin:24px 0 0;color:#6f6e79;font-size:12px;line-height:1.55">If you did not request this, you can ignore the message. Your current password stays unchanged.</p>' +
          '</div>' +
        '</div>',
      text: `Reset your ShortsCraft password within 30 minutes: ${resetUrl}\n\nIf you did not request this, ignore this email.`,
    }),
    signal: AbortSignal.timeout(12_000),
  });

  if (!response.ok) {
    const body = await response.text().catch(() => "");
    throw new Error(`Resend rejected the password email (${response.status}): ${body.slice(0, 180)}`);
  }
  const data = await response.json();
  return { id: data.id || crypto.randomUUID() };
}

module.exports = { configured, sendPasswordReset };
