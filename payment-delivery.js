"use strict";

const db = require("./db");
const auth = require("./auth");
const credits = require("./credits");

// Called only after gateway signature, ownership, amount and paid-state checks.
// Receipt and benefits commit together, so a failed delivery can be retried.
async function deliver(req, payment) {
  const { paymentId, orderId, planId, term, amount } = payment;
  if (!req.user?.id || !req.credits?.key) throw new Error("Missing payment recipient");
  return db.tx(async client => {
    // Serialize one order, including retries with a different payment ID.
    await client.query("select pg_advisory_xact_lock(hashtext($1))", ["payment:" + orderId]);
    const existing = await client.query(
      "select * from public.processed_payments where payment_id = $1 or order_id = $2",
      [paymentId, orderId]
    );
    if (existing.rows.length) {
      if (existing.rows.some(row => row.user_id !== req.user.id || row.order_id !== orderId ||
          row.plan !== planId || row.term !== term || Number(row.amount_paise) !== amount)) {
        throw new Error("Payment receipt does not match recipient or order");
      }
      return { alreadyProcessed: true };
    }
    await client.query(
      `insert into public.processed_payments
        (payment_id, order_id, user_id, plan, term, amount_paise)
       values ($1, $2, $3, $4, $5, $6)`,
      [paymentId, orderId, req.user.id, planId, term, amount]
    );
    if (!await auth.changePlan(req.user.id, planId, term, client)) {
      throw new Error("Payment account no longer exists");
    }
    if (!await credits.setPlan(req, planId, client)) throw new Error("Invalid payment plan");
    return { alreadyProcessed: false };
  });
}

module.exports = { deliver };
