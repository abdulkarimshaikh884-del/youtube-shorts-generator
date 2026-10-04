"use strict";
const crypto = require("node:crypto");
const db = require("./db");
const { STAR_PACKS } = require("./credits");

// The browser supplies a gateway receipt, never the pack or the grant amount.
async function verifyAndDeliver(user, receipt, fetchImpl = fetch) {
  const { razorpay_order_id: orderId, razorpay_payment_id: paymentId, razorpay_signature: signature } = receipt || {};
  const keyId = process.env.RAZORPAY_KEY_ID;
  const secret = process.env.RAZORPAY_KEY_SECRET;
  const fail = (status, error) => ({ status, error });
  if (!user) return fail(401, "Please log in first.");
  if (!keyId || !secret) return fail(503, "Payments are not configured.");
  if (![orderId, paymentId].every(v => typeof v === "string" && /^[a-zA-Z0-9_]{5,100}$/.test(v)) || typeof signature !== "string" || !/^[0-9a-f]{64}$/.test(signature)) return fail(400, "Invalid payment details.");
  const expected = crypto.createHmac("sha256", secret).update(`${orderId}|${paymentId}`).digest("hex");
  if (signature.length !== expected.length || !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))) return fail(400, "Invalid payment signature.");
  const headers = { Authorization: "Basic " + Buffer.from(keyId + ":" + secret).toString("base64") };
  const read = async (resource, id) => {
    const response = await fetchImpl(`https://api.razorpay.com/v1/${resource}/${encodeURIComponent(id)}`, { headers, signal: AbortSignal.timeout(10_000) });
    if (!response.ok) throw new Error("Payment gateway could not verify this receipt.");
    return response.json();
  };
  const [order, payment] = await Promise.all([read("orders", orderId), read("payments", paymentId)]);
  const notes = order.notes || {};
  const pack = STAR_PACKS.find(p => p.id === notes.packId);
  if (!pack || notes.type !== "stars_purchase" || String(notes.userId) !== String(user.id) ||
      order.id !== orderId || order.status !== "paid" || order.currency !== "INR" ||
      Number(order.amount) !== pack.price * 100 || Number(order.amount_paid) < Number(order.amount) ||
      Number(notes.stars) !== pack.stars || payment.id !== paymentId || payment.order_id !== orderId ||
      payment.status !== "captured" || payment.currency !== "INR" || Number(payment.amount) !== Number(order.amount)) {
    return fail(409, "This captured payment does not match your account and Star pack. Contact support if money was deducted.");
  }
  return db.tx(async client => {
    // One order is deliverable once even if callbacks race or payment ids differ.
    await client.query("select pg_advisory_xact_lock(hashtext($1))", ["star-order:" + orderId]);
    const idem = `star-purchase:${orderId}`;
    const prior = await client.query(
      "select receiver_id, note from public.star_transactions where idempotency_key = $1 or idempotency_key = $2",
      [idem, `star-purchase:${orderId}:${paymentId}`]
    );
    if (prior.rows.length) {
      if (prior.rows.some(r => String(r.receiver_id) !== String(user.id))) return fail(409, "This payment was already delivered to another account.");
      return { success: true, alreadyProcessed: true, starsGranted: 0, orderId, paymentId };
    }
    for (let offset = 0; offset < pack.stars; offset += 100) {
      const amount = Math.min(100, pack.stars - offset);
      await client.query(
        `insert into public.star_transactions (sender_id, receiver_id, amount, kind, idempotency_key, note)
         values (null, $1, $2, 'admin_adjustment', $3, $4)`,
        [user.id, amount, offset ? `${idem}:${offset}` : idem,
          JSON.stringify({ type: "purchase", packId: pack.id, stars: amount, orderId, paymentId,
            amountPaise: offset === 0 ? Number(payment.amount) : 0, captured: true })]
      );
    }
    return { success: true, alreadyProcessed: false, starsGranted: pack.stars, orderId, paymentId };
  });
}
module.exports = { verifyAndDeliver };
