/* Administration queries. Every function checks its own permission through
   permissions.js; the routes in server.js add no checks of their own. */
const db = require("./db");
const permissions = require("./permissions");
const notify = require("./notify");
const credits = require("./credits");

const { can, isOwner } = permissions;
function denied() { return { error: "You do not have access to this part of the admin console.", status: 403 }; }
function ownerOnly() { return { error: "Only the owner can do this.", status: 403 }; }
const validId = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

// ── 1. Overview / Dashboard ──────────────────────────────────
async function dashboard(user) {
  if (!can(user, "overview.view")) return denied();
  const { rows } = await db.query(
    `select
       (select count(*)::int from public.users) as users,
       (select count(*)::int from public.users where created_at >= now() - interval '30 days') as new_users_30d,
       (select count(*)::int from public.users where plan in ('pro', 'promax') and (plan_lifetime or plan_until > now())) as pro_users,
       (select count(distinct author_id)::int from public.community_templates where status = 'published') as creators_count,
       (select count(*)::int from public.community_templates where status = 'published') as published_templates,
       (select count(*)::int from public.community_templates where status = 'scheduled') as scheduled_templates,
       (select count(*)::int from public.community_templates where status in ('pending', 'review')) as pending_templates,
       (select count(*)::int from public.support_tickets where status not in ('resolved','closed')) as open_tickets,
       (select count(*)::int from public.content_reports where status in ('open','reviewing')) as open_reports,
       (select count(*)::int from public.template_events where event_type = 'export' and created_at >= now() - interval '30 days') as exports_30d,
       (select count(*)::int from public.credit_transactions where kind like 'ai_%' and created_at >= now() - interval '30 days') as ai_generations_30d,
       (select count(*)::int from public.star_transactions where kind = 'admin_adjustment' and note like '%"type":"payout_request"%' and note like '%"status":"pending"%') as pending_withdrawals,
       (select count(*)::int from public.design_conversion_jobs) as ai_jobs_total,
       (select count(*)::int from public.design_conversion_jobs where created_at >= current_date) as ai_jobs_today,
       (select count(*)::int from public.design_conversion_jobs where status = 'failed' and created_at >= now() - interval '30 days') as ai_jobs_failed_30d,
       (select coalesce(sum(amount), 0)::int from public.star_transactions where kind in ('purchase', 'buy')) as stars_purchased_total,
       (select coalesce(sum(amount), 0)::int from public.star_transactions where receiver_id is not null and kind = 'donation') as stars_earned_total,
       (select coalesce(sum(amount), 0)::int from public.star_transactions where kind = 'admin_adjustment' and note like '%"type":"payout_request"%' and note like '%"status":"paid"%') as stars_paid_total`
  );

  const stats = rows[0] || {};
  // Derived financial approximations
  // A Star face value is not a payment receipt. Do not invent gross revenue.
  const starPackGrossINR = null;
  const creatorPayoutsINR = Number(((stats.stars_paid_total || 0) * 3.50).toFixed(2));
  const platformFeeINR = null; // Actual fees require gateway/settlement receipts.

  // Recent activity from audit log
  let recentActivity = [];
  try {
    const actRows = await db.query(
      `select a.id, a.action, a.entity_type, a.entity_id, a.created_at,
              u.display_name as actor_name, u.handle as actor_handle
         from public.admin_audit_log a
         left join public.users u on u.id = a.actor_id
        order by a.created_at desc limit 8`
    );
    recentActivity = actRows.rows || [];
  } catch (e) { console.warn("[admin activity]", e.message); }

  return {
    success: true,
    stats: {
      ...stats,
      starPackGrossINR,
      creatorPayoutsINR,
      platformFeeINR
    },
    recentActivity
  };
}

// ── 2. Users Management ──────────────────────────────────────
async function listUsers(user, options = {}) {
  if (!can(user, "users.view")) return denied();
  const owner = isOwner(user);
  const q = String(options.q || "").trim().toLowerCase();
  const roleFilter = String(options.role || "").trim();
  const planFilter = String(options.plan || "").trim();

  let sql = `
    select u.id, u.email, u.display_name, u.handle, u.plan, u.plan_until, u.billing_cycle,
           u.verified, u.role, u.staff_permissions, u.created_at,
           cr.left_credits + ${process.env.REFERRALS_ENABLED === "true" ? "coalesce(cr.bonus_credits, 0)" : "0"} as credits_balance,
           (select count(*)::int from public.community_templates ct where ct.author_id = u.id) as comm_templates,
           (select count(*)::int from public.design_templates dt where dt.author_id = u.id) as design_templates,
           (select coalesce(sum(st.amount), 0)::int from public.star_transactions st where st.receiver_id = u.id and st.kind = 'donation') as stars_earned,
           (select coalesce(sum(st.amount), 0)::int from public.star_transactions st where st.receiver_id = u.id and st.kind in ('purchase', 'buy')) as stars_purchased,
           (select coalesce(sum(st.amount), 0)::int from public.star_transactions st where st.sender_id = u.id and st.kind = 'admin_adjustment' and st.note like '%"type":"payout_request"%') as stars_withdrawn
      from public.users u
      left join public.credits cr on cr.key = ('u:' || u.id::text)
     where 1=1
  `;
  const params = [];
  if (q) {
    params.push(`%${q}%`);
    sql += ` and (lower(u.handle) like $${params.length} or lower(u.display_name) like $${params.length} or (u.email is not null and lower(u.email) like $${params.length}))`;
  }
  if (roleFilter && roleFilter !== "all") {
    params.push(roleFilter);
    sql += ` and u.role = $${params.length}`;
  }
  if (planFilter && planFilter !== "all") {
    params.push(planFilter);
    sql += ` and u.plan = $${params.length}`;
  }
  sql += ` order by u.created_at desc limit 250`;

  const { rows } = await db.query(sql, params);
  return {
    success: true,
    canManageStaff: owner,
    canManageUsers: can(user, "users.manage"),
    canAdjustBalance: can(user, "users.balance_adjust"),
    users: rows.map((r) => {
      const earned = Number(r.stars_earned) || 0;
      const withdrawn = Number(r.stars_withdrawn) || 0;
      const purchased = Number(r.stars_purchased) || 0;
      const withdrawable = Math.max(0, earned - withdrawn);
      const rawHandle = (r.handle || "").replace(/^@+/, "");
      const emailPrefix = r.email ? r.email.split("@")[0] : "";
      const safeHandle = rawHandle ? `@${rawHandle}` : (emailPrefix ? `@${emailPrefix}` : `@user_${r.id.slice(0, 6)}`);
      const safeDisplayName = r.display_name || rawHandle || emailPrefix || `User #${r.id.slice(0, 6)}`;
      return {
        id: r.id,
        email: owner ? (r.email || "") : "",
        displayName: safeDisplayName,
        handle: safeHandle,
        plan: r.plan || "free",
        planUntil: r.plan_until,
        billingCycle: r.billing_cycle,
        verified: r.verified === true,
        role: r.role || "user",
        createdAt: r.created_at,
        permissions: permissions.permissionsOf(r),
        credits: r.credits_balance == null ? null : Number(r.credits_balance),
        templateCount: (Number(r.comm_templates) || 0) + (Number(r.design_templates) || 0),
        purchasedStars: purchased,
        earnedStars: earned,
        withdrawableStars: withdrawable,
        withdrawnStars: withdrawn,
        totalStars: purchased + withdrawable,
        totalEarningsINR: Number((earned * 3.50).toFixed(2))
      };
    })
  };
}

async function moderateUser(actor, targetId, action, params = {}) {
  const verificationAction = ["verify", "verify_creator", "unverify_creator"].includes(action);
  if (!can(actor, verificationAction ? "creators.verify" : "users.manage")) return denied();
  if (!validId(targetId)) return { error: "Target user not found.", status: 404 };

  const targetRes = await db.query(`select id, email, display_name, handle, role, verified from public.users where id = $1`, [targetId]);
  const target = targetRes.rows[0];
  if (!target) return { error: "Target user not found.", status: 404 };
  if (target.role === "super_admin") return { error: "Owner account cannot be modified.", status: 403 };

  const reason = String(params?.reason || "").trim();
  if (!reason && (action === "ban" || action === "suspend" || action === "warn")) {
    return { error: "Reason is mandatory for moderation action.", status: 400 };
  }

  if (action === "warn") {
    await db.query(
      `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
       values ($1, $2, 'system', 'moderation', 'warning', $3)`,
      [targetId, actor.id, `⚠️ Account Warning: ${reason}`]
    );
    await audit(actor, "user_warned", "user", targetId, null, { reason });
    return { success: true, message: `Warning issued to @${target.handle}.` };
  }

  if (action === "ban") {
    await db.query(`update public.users set role = 'banned', updated_at = now() where id = $1`, [targetId]);
    await db.query(`delete from public.sessions where user_id = $1`, [targetId]);
    await audit(actor, "user_banned", "user", targetId, { role: target.role }, { role: "banned", reason });
    return { success: true, message: `Account @${target.handle} has been banned.` };
  }

  if (action === "unban") {
    await db.query(`update public.users set role = 'user', updated_at = now() where id = $1`, [targetId]);
    await audit(actor, "user_unbanned", "user", targetId, { role: "banned" }, { role: "user", reason });
    return { success: true, message: `Account @${target.handle} has been unbanned.` };
  }

  if (action === "verify" || action === "verify_creator" || action === "unverify_creator") {
    let verifiedState = true;
    if (action === "unverify_creator") verifiedState = false;
    else if (action === "verify" && params.verified !== undefined) verifiedState = Boolean(params.verified);
    await db.query(`update public.users set verified = $2, updated_at = now() where id = $1`, [targetId, verifiedState]);
    await audit(actor, "user_verify_toggle", "user", targetId, { verified: target.verified }, { verified: verifiedState });
    return { success: true, message: `Creator verification set to ${verifiedState} for @${target.handle || "user"}.` };
  }

  if (action === "change_role" || action === "set_role") {
    if (!isOwner(actor)) return { error: "Only the Owner can change user roles.", status: 403 };
    const newRole = String(params.role || "").trim().toLowerCase();
    const validRoles = ["user", "moderator", "sub_admin", "admin"];
    if (!validRoles.includes(newRole)) return { error: "Invalid role specified.", status: 400 };
    const granted = newRole === "user" ? [] : permissions.normalise(permissions.ROLE_PRESETS[newRole === "admin" ? "sub_admin" : newRole] || []);
    await db.query(`update public.users set role = $2, staff_permissions = $3::text[], updated_at = now() where id = $1`, [targetId, newRole, granted]);
    await audit(actor, "user_role_changed", "user", targetId, { role: target.role }, { role: newRole, reason });
    return { success: true, message: `Role changed to ${newRole} for @${target.handle || "user"}.` };
  }

  return { error: "Unsupported moderation action.", status: 400 };
}

async function adjustUserBalance(actor, targetId, params = {}) {
  if (!can(actor, "users.balance_adjust")) return denied();
  if (!validId(targetId)) return { error: "Target user not found.", status: 404 };
  const reason = String(params.reason || "").trim();
  const raw = params.delta ?? params.deltaStars ?? params.deltaCredits;
  const delta = typeof raw === "number" ? raw : (/^-?\d+$/.test(String(raw)) ? Number(raw) : NaN);
  const type = String(params.type || "stars").toLowerCase();
  if (!reason) return { error: "Reason is compulsory for balance adjustments.", status: 400 };
  if (!Number.isSafeInteger(delta) || !delta || Math.abs(delta) > 10000) return { error: "Enter a non-zero whole amount up to 10,000.", status: 400 };
  if (!["credits", "stars"].includes(type)) return { error: "Unsupported adjustment type.", status: 400 };
  if (type === "credits" && process.env.REFERRALS_ENABLED !== "true") return { error: "Bonus credit adjustments require the verified bonus-balance migration. Daily allowance has not been changed.", status: 503 };
  // Spendable Stars and creator earnings are separate ledgers. Never manufacture a donation.
  if (type === "stars" && delta < 0) return { error: "Star debits require a dedicated debit ledger. No balance was changed.", status: 409 };
  return db.tx(async client => {
    const found = await client.query("select id, handle, plan, plan_until, plan_lifetime from public.users where id = $1", [targetId]);
    const target = found.rows[0];
    if (!target) return { error: "User not found.", status: 404 };
    let balanceAfter = null;
    if (type === "credits") {
      const key = "u:" + targetId;
      const plan = target.plan_lifetime || !target.plan_until || new Date(target.plan_until) > new Date() ? target.plan : "free";
      const rec = await credits.ensureRecord(key, plan, client);
      const bonus = Number(rec.bonus_credits) || 0;
      if (bonus + delta < 0) return { error: "Only bonus credits can be deducted. This account has insufficient bonus credits.", status: 409 };
      const changed = await client.query("update public.credits set bonus_credits = bonus_credits + $2 where key = $1 returning left_credits, bonus_credits", [key, delta]);
      balanceAfter = Number(changed.rows[0].left_credits) + Number(changed.rows[0].bonus_credits);
      await client.query(
        "insert into public.credit_transactions (credit_key, user_id, kind, amount, balance_after, metadata) values ($1, $2, 'admin_adjustment', $3, $4, $5::jsonb)",
        [key, targetId, delta, balanceAfter, JSON.stringify({ type: "bonus_adjustment", reason, actorId: actor.id })]);
    } else {
      await client.query("select pg_advisory_xact_lock(hashtext($1))", ["stars:" + targetId]);
      const adjustment = require("node:crypto").randomUUID();
      for (let offset = 0; offset < delta; offset += 100) {
        await client.query(
          "insert into public.star_transactions (sender_id, receiver_id, amount, kind, idempotency_key, note) values (null, $1, $2, 'admin_adjustment', $3, $4)",
          [targetId, Math.min(100, delta - offset), "admin-grant:" + adjustment + ":" + offset,
            JSON.stringify({ type: "admin_grant", reason, actorId: actor.id })]);
      }
    }
    // Audit failure rolls the balance back; never return an unaudited financial success.
    await client.query(
      "insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, before_data, after_data) values ($1, $2, 'user', $3, null, $4::jsonb)",
      [actor.id, type + "_balance_adjusted", targetId, JSON.stringify({ delta, reason, balance_after: balanceAfter })]);
    await client.query(
      "insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message) values ($1, $2, 'system', 'wallet', 'adjustment', $3)",
      [targetId, actor.id, type === "credits" ? "Bonus credits adjusted by " + delta + ". Reason: " + reason : delta + " spendable Stars added (not creator earnings). Reason: " + reason]);
    return { success: true, message: "Adjusted " + delta + " " + (type === "credits" ? "bonus credits" : "spendable Stars") + " for @" + target.handle + "." };
  });
}

// ── 3. Creators ──────────────────────────────────────────────
async function listCreators(user, options = {}) {
  if (!can(user, "users.view")) return denied();
  const { rows } = await db.query(
    `select u.id, u.display_name, u.handle, u.verified, u.created_at, u.email,
            (select count(*)::int from public.community_templates ct where ct.author_id = u.id and ct.status = 'published') as pub_templates,
            (select count(*)::int from public.design_templates dt where dt.author_id = u.id and dt.status = 'published') as pub_designs,
            (select coalesce(sum(st.amount), 0)::int from public.star_transactions st where st.receiver_id = u.id and st.kind = 'donation') as stars_earned,
            (select coalesce(sum(st.amount), 0)::int from public.star_transactions st where st.sender_id = u.id and st.kind = 'admin_adjustment' and st.note like '%"type":"payout_request"%') as stars_withdrawn
       from public.users u
      where (select count(*)::int from public.community_templates ct where ct.author_id = u.id) > 0
         or (select count(*)::int from public.design_templates dt where dt.author_id = u.id) > 0
         or (select count(*)::int from public.star_transactions st where st.receiver_id = u.id and st.kind = 'donation') > 0
      order by stars_earned desc, created_at desc limit 200`
  );

  return {
    success: true,
    creators: rows.map(r => {
      const earned = Number(r.stars_earned) || 0;
      const withdrawn = Number(r.stars_withdrawn) || 0;
      const templates = (Number(r.pub_templates) || 0) + (Number(r.pub_designs) || 0);
      const rawHandle = (r.handle || "").replace(/^@+/, "");
      const emailPrefix = r.email ? r.email.split("@")[0] : "";
      const safeHandle = rawHandle ? `@${rawHandle}` : (emailPrefix ? `@${emailPrefix}` : `@creator_${r.id.slice(0, 6)}`);
      const safeDisplayName = r.display_name || rawHandle || emailPrefix || `Creator #${r.id.slice(0, 6)}`;
      return {
        id: r.id,
        displayName: safeDisplayName,
        handle: safeHandle,
        verified: r.verified === true,
        createdAt: r.created_at,
        templatesCount: templates,
        starsEarned: earned,
        withdrawableStars: Math.max(0, earned - withdrawn),
        withdrawnStars: withdrawn,
        totalEarningsINR: Number((earned * 3.50).toFixed(2))
      };
    })
  };
}

// ── 4. Withdrawals Management ────────────────────────────────
async function listWithdrawals(user, statusFilter = "all") {
  if (!can(user, "withdrawals.manage")) return denied();

  const { rows } = await db.query(
    `select st.id, st.sender_id as user_id, st.amount as stars_amount, st.note, st.created_at,
            u.display_name, u.handle, u.email
       from public.star_transactions st
       join public.users u on u.id = st.sender_id
      where st.kind = 'admin_adjustment'
        and st.note like '%"type":"payout_request"%'
      order by st.created_at desc limit 300`
  );

  const parsed = rows.map(r => {
    let meta = {};
    try { meta = JSON.parse(r.note || "{}"); } catch (e) {}
    const stars = Number(r.stars_amount) || 0;
    const grossINR = stars * 5.00;
    const feeINR = Number((grossINR * 0.30).toFixed(2));
    const payoutINR = meta.inrAmount || Number((stars * 3.50).toFixed(2));
    const creatorFallback = r.display_name || r.handle || (r.email ? r.email.split("@")[0] : ("User #" + String(r.user_id).slice(0, 6)));
    const cleanHandle = String(r.handle || "").replace(/^@+/, "");
    return {
      id: r.id,
      txId: r.id,
      userId: r.user_id,
      creatorName: creatorFallback,
      creatorHandle: cleanHandle,
      creatorEmail: isOwner(user) ? (r.email || "") : "",
      stars,
      starAmount: stars,
      grossINR,
      grossAmountINR: grossINR,
      feeINR,
      payoutINR,
      netAmountINR: payoutINR,
      upiId: meta.upiId || "",
      accountDetails: meta.upiId || "",
      status: meta.status || "pending",
      utr: meta.utr || "",
      rejectionReason: meta.reason || "",
      requestedAt: meta.requestedAt || r.created_at,
      paidAt: meta.paidAt || null
    };
  });

  const filtered = statusFilter && statusFilter !== "all"
    ? parsed.filter(w => w.status.toLowerCase() === statusFilter.toLowerCase())
    : parsed;

  return { success: true, withdrawals: filtered };
}

async function processWithdrawal(actor, txId, action, data = {}) {
  if (!can(actor, "withdrawals.manage")) return denied();
  if (!txId) return { error: "Withdrawal ID required.", status: 400 };

  const txRes = await db.query(`select * from public.star_transactions where id = $1`, [txId]);
  const tx = txRes.rows[0];
  if (!tx) return { error: "Withdrawal record not found.", status: 404 };

  let meta = {};
  try { meta = JSON.parse(tx.note || "{}"); } catch (e) {}

  if (meta.type !== "payout_request") return { error: "Not a payout request.", status: 400 };

  if (action === "approve") {
    meta.status = "approved";
    meta.approvedAt = new Date().toISOString();
    meta.approvedBy = actor.id;
    await db.query(`update public.star_transactions set note = $2 where id = $1`, [txId, JSON.stringify(meta)]);
    await audit(actor, "withdrawal_approved", "withdrawal", txId, null, meta);
    return { success: true, withdrawal: { id: txId, status: "approved" } };
  }

  if (action === "mark_paid") {
    const utr = String(data?.utr || "").trim();
    if (!utr) return { error: "UTR / Transaction reference is required.", status: 400 };

    meta.status = "paid";
    meta.utr = utr;
    meta.paidAt = new Date().toISOString();
    meta.paidBy = actor.id;
    await db.query(`update public.star_transactions set note = $2 where id = $1`, [txId, JSON.stringify(meta)]);

    // Notify creator
    await db.query(
      `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
       values ($1, $2, 'system', 'payout', $3, $4)`,
      [tx.sender_id, actor.id, String(txId), `🎉 Payout Processed! ₹${meta.inrAmount} has been sent via UPI to ${meta.upiId}. Ref/UTR: ${utr}`]
    );

    await audit(actor, "withdrawal_paid", "withdrawal", txId, null, { utr, inrAmount: meta.inrAmount, upiId: meta.upiId });
    await require("./email-events").enqueueSafe({userId:tx.sender_id,kind:"withdrawal_processed",eventKey:txId,data:{reference:String(txId),amountPaise:Math.round(Number(meta.inrAmount)*100)}});
    return { success: true, withdrawal: { id: txId, status: "paid", utr } };
  }

  if (action === "reject") {
    const reason = String(data?.reason || "").trim();
    if (!reason) return { error: "Rejection reason is mandatory.", status: 400 };

    meta.status = "rejected";
    meta.reason = reason;
    meta.rejectedAt = new Date().toISOString();
    meta.rejectedBy = actor.id;
    await db.query(`update public.star_transactions set note = $2 where id = $1`, [txId, JSON.stringify(meta)]);

    // Refund stars back to creator
    await db.query(
      `insert into public.star_transactions (sender_id, receiver_id, amount, kind, idempotency_key, note)
       values ($1, $2, $3, 'donation', $4, $5)`,
      [actor.id, tx.sender_id, tx.amount, `refund:wd:${txId}`, JSON.stringify({ type: "payout_refund", originalTxId: txId, reason })]
    );

    // Notify creator
    await db.query(
      `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
       values ($1, $2, 'system', 'payout', $3, $4)`,
      [tx.sender_id, actor.id, String(txId), `⚠️ Payout Request Rejected: ₹${meta.inrAmount} (${tx.amount} Stars). Reason: ${reason}. Stars have been refunded to your wallet.`]
    );

    await audit(actor, "withdrawal_rejected", "withdrawal", txId, null, { reason });
    await require("./email-events").enqueueSafe({userId:tx.sender_id,kind:"withdrawal_rejected",eventKey:txId,data:{reference:String(txId)}});
    return { success: true, withdrawal: { id: txId, status: "rejected", reason } };
  }

  return { error: "Unsupported withdrawal action.", status: 400 };
}

// ── 5. Star Transactions & Ledger ────────────────────────────
async function listStarLedger(user, options = {}) {
  if (!can(user, "stars.view")) return denied();

  const { rows } = await db.query(
    `select st.id, st.sender_id, st.receiver_id, st.amount, st.kind, st.note, st.created_at,
            su.handle as sender_handle, su.display_name as sender_name,
            ru.handle as receiver_handle, ru.display_name as receiver_name
       from public.star_transactions st
       left join public.users su on su.id = st.sender_id
       left join public.users ru on ru.id = st.receiver_id
      order by st.created_at desc limit 250`
  );

  const mapped = rows.map(r => {
    const sH = String(r.sender_handle || "").replace(/^@+/, "");
    const rH = String(r.receiver_handle || "").replace(/^@+/, "");
    return {
      id: r.id,
      amount: r.amount,
      kind: r.kind,
      note: r.note || "",
      createdAt: r.created_at,
      sender: sH ? `@${sH}` : (r.sender_id ? "System" : "Platform"),
      senderHandle: sH,
      senderName: r.sender_name || "",
      receiver: rH ? `@${rH}` : (r.receiver_id ? "System" : "Platform"),
      receiverHandle: rH,
      receiverName: r.receiver_name || ""
    };
  });

  return {
    success: true,
    ledger: mapped,
    transactions: mapped
  };
}

async function reverseStarTransaction(actor, txId, params = {}) {
  if (!can(actor, "stars.manage")) return denied();
  const reason = String(params?.reason || "").trim();
  if (!reason) return { error: "Reversal reason is mandatory.", status: 400 };

  const txRes = await db.query(`select * from public.star_transactions where id = $1`, [txId]);
  const orig = txRes.rows[0];
  if (!orig) return { error: "Transaction not found.", status: 404 };

  const revNote = JSON.stringify({
    type: "reversal",
    originalTxId: txId,
    reason,
    reversedBy: actor.id,
    reversedAt: new Date().toISOString()
  });

  // Calculate compensating sender and receiver (satisfying receiver_id NOT NULL and sender <> receiver)
  const compSender = orig.receiver_id;
  let compReceiver = orig.sender_id;
  if (!compReceiver || compReceiver === compSender) {
    compReceiver = actor.id;
  }
  if (compSender === compReceiver) {
    // If admin is also sender, select any other admin/owner to avoid self-reference check violation
    const ownerRes = await db.query(`select id from public.users where role = 'super_admin' and id <> $1 limit 1`, [compSender]);
    if (ownerRes.rows[0]) compReceiver = ownerRes.rows[0].id;
  }

  await db.query(
    `insert into public.star_transactions (sender_id, receiver_id, amount, kind, idempotency_key, note)
     values ($1, $2, $3, 'admin_adjustment', $4, $5)`,
    [compSender, compReceiver, orig.amount, `rev:${txId}:${Date.now()}`, revNote]
  );

  await audit(actor, "star_transaction_reversed", "star_transaction", txId, orig, { reason });
  return { success: true, message: `Transaction #${txId} reversed successfully.` };
}

// ── 6. Star Packs Configuration ──────────────────────────────
async function listStarPacks(user) {
  if (!isOwner(user) && !can(user, "star_packs.manage") && !can(user, "stars.view")) return denied();
  try {
    const flagRes = await db.query(`select description from public.feature_flags where key = 'star_packs_config'`);
    if (flagRes.rows[0]?.description) {
      const parsed = JSON.parse(flagRes.rows[0].description);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return { success: true, packs: parsed };
      }
    }
  } catch (e) { console.warn("[admin list]", e.message); }
  return { success: true, packs: credits.STAR_PACKS };
}

async function saveStarPack(actor, packData) {
  if (!can(actor, "star_packs.manage") && !isOwner(actor)) return denied();
  if (!packData || !Array.isArray(packData.packs)) return { error: "Invalid packs payload.", status: 400 };

  const serialized = JSON.stringify(packData.packs);
  await db.query(
    `insert into public.feature_flags (key, enabled, description, updated_by, updated_at)
     values ('star_packs_config', true, $1, $2, now())
     on conflict (key) do update set description = $1, updated_by = $2, updated_at = now()`,
    [serialized, actor.id]
  );

  await audit(actor, "star_packs_updated", "feature_flag", "star_packs_config", null, packData.packs);
  return { success: true, packs: packData.packs };
}

// ── 7. AI & Convert-to-Editable Jobs ─────────────────────────
async function listAiJobs(user, options = {}) {
  if (!can(user, "ai_jobs.view")) return denied();

  let jobs = [];
  try {
    const { rows } = await db.query(
      `select j.id, j.user_id, j.status, j.progress, j.design_type, j.source_image_name,
              j.error_message, j.created_at, j.completed_at,
              u.display_name, u.handle
         from public.design_conversion_jobs j
         left join public.users u on u.id = j.user_id
        order by j.created_at desc limit 150`
    );
    jobs = rows.map(r => {
      const uH = String(r.handle || "").replace(/^@+/, "");
      const dur = r.completed_at ? Math.max(1, Math.round((new Date(r.completed_at) - new Date(r.created_at)) / 1000)) : null;
      return {
        id: r.id,
        userId: r.user_id,
        user: uH ? `@${uH}` : (r.display_name || "Guest"),
        userHandle: uH,
        userName: r.display_name || "",
        status: r.status,
        progress: r.progress,
        designType: r.design_type,
        imageName: r.source_image_name,
        originalImage: r.source_image_name,
        errorMessage: r.error_message || "",
        createdAt: r.created_at,
        completedAt: r.completed_at,
        durationSec: dur,
        duration: dur
      };
    });
  } catch (e) {
    console.error("[admin AI jobs]", e.message);
    return { error: "AI job data is unavailable. Check the database connection and Designs migration.", status: 503 };
  }

  return { success: true, jobs };
}

async function retryAiJob(actor, jobId) {
  if (!can(actor, "ai_jobs.retry")) return denied();
  return { error: "Background job retry is not available. The creator must retry from Designs; no job status or credits were changed.", status: 409 };
}

// ── 8. Broadcast Notifications ───────────────────────────────
async function broadcastNotification(actor, data = {}) {
  if (!can(actor, "notifications.broadcast")) return denied();
  const rawMsg = String(data?.message || "").trim();
  if (!rawMsg) return { error: "Broadcast message cannot be empty.", status: 400 };

  const title = String(data?.title || "").trim();
  const link = String(data?.link || "").trim();
  const fullMessage = (title ? `📢 ${title}\n\n` : "") + rawMsg + (link ? `\n\n🔗 ${link}` : "");

  let audience = String(data?.audience || data?.target || "all").toLowerCase();
  if (audience === "handle" && data?.targetHandle) {
    let h = String(data.targetHandle).trim().replace(/^@+/, "");
    audience = `@${h}`;
  }

  if (audience === "creators") {
    await db.query(
      `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
       select distinct author_id, $1, 'system', 'broadcast', 'creator', $2
         from public.community_templates where status = 'published'`,
      [actor.id, fullMessage]
    );
  } else if (audience === "pro") {
    await db.query(
      `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
       select id, $1, 'system', 'broadcast', 'pro', $2
         from public.users where plan in ('pro', 'promax') and (plan_lifetime or plan_until > now())`,
      [actor.id, fullMessage]
    );
  } else if (audience === "free") {
    await db.query(
      `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
       select id, $1, 'system', 'broadcast', 'free', $2
         from public.users where coalesce(plan, 'free') = 'free'`,
      [actor.id, fullMessage]
    );
  } else if (audience === "all") {
    await db.query(
      `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
       select id, $1, 'system', 'broadcast', 'all', $2
         from public.users`,
      [actor.id, fullMessage]
    );
  } else if (audience.startsWith("@")) {
    const handle = audience.replace(/^@+/, "");
    const uRes = await db.query(`select id from public.users where lower(handle) = lower($1)`, [handle]);
    if (!uRes.rows[0]) return { error: `User @${handle} not found.`, status: 404 };
    await db.query(
      `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
       values ($1, $2, 'system', 'broadcast', 'targeted', $3)`,
      [uRes.rows[0].id, actor.id, fullMessage]
    );
  }

  await audit(actor, "broadcast_sent", "notification", audience, null, { message: fullMessage, audience });
  return { success: true, message: `Notification broadcast sent to [${audience}].` };
}

// ── 9. Audit Logs ────────────────────────────────────────────
async function listAuditLogs(user, options = {}) {
  if (!can(user, "audit.view")) return denied();

  const { rows } = await db.query(
    `select a.id, a.actor_id, a.action, a.entity_type, a.entity_id, a.before_data, a.after_data, a.created_at,
            u.display_name as actor_name, u.handle as actor_handle
       from public.admin_audit_log a
       left join public.users u on u.id = a.actor_id
      order by a.created_at desc limit 250`
  );

  return { success: true, logs: rows };
}

// ── 10. Content Moderation (Templates) ───────────────────────
async function listContent(user) {
  if (!can(user, "templates.moderate")) return denied();
  const { rows: commRows } = await db.query(
    `select ct.id, ct.title, ct.tpl, ct.category, ct.status, ct.source_format,
            ct.review_note, ct.scheduled_at, ct.published_at, ct.created_at,
            u.display_name as author_name, u.handle as author_handle, u.email as author_email,
            (select count(*)::int from public.template_reactions tr where tr.template_id = ct.id and tr.reaction = 'like') as likes,
            (select count(*)::int from public.template_comments tc where tc.tpl_id = ct.id and coalesce(tc.status, 'visible') = 'visible') as comments,
            (select count(*)::int from public.template_events te where te.template_id = ct.id and te.event_type = 'export') as exports
       from public.community_templates ct
       left join public.users u on u.id = ct.author_id
      order by coalesce(ct.updated_at, ct.created_at) desc limit 250`
  );

  let designRows = [];
  try {
    const dsRes = await db.query(
      `select dt.id, dt.title, dt.design_type as tpl, dt.category, dt.status, 'design_template' as source_format,
              coalesce((select a.after_data->>'reviewNote'
                from public.admin_audit_log a
                where a.action = 'design_template_moderation' and a.entity_type = 'design_template'
                  and a.entity_id = dt.id order by a.created_at desc, a.id desc limit 1), '') as review_note,
              null as scheduled_at, dt.created_at as published_at, dt.created_at,
              coalesce(u.display_name, dt.author_name) as author_name,
              coalesce(u.handle, dt.author_handle) as author_handle,
              u.email as author_email,
              coalesce(dt.likes, 0) as likes, 0 as comments, coalesce(dt.uses, 0) as exports
         from public.design_templates dt
         left join public.users u on u.id = dt.author_id
        order by dt.created_at desc limit 150`
    );
    designRows = dsRes.rows || [];
  } catch (e) {
    console.error("[admin design templates]", e.message);
    return { error: "Design templates could not be loaded. Check the database connection and migration.", status: 503 };
  }

  const allRows = [...commRows, ...designRows].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

  return {
    success: true,
    templates: allRows.map((r) => {
      const rawHandle = (r.author_handle || "").replace(/^@+/, "");
      const emailPrefix = r.author_email ? r.author_email.split("@")[0] : "";
      const safeHandle = rawHandle ? `@${rawHandle}` : (emailPrefix ? `@${emailPrefix}` : "");
      const safeName = r.author_name || rawHandle || emailPrefix || "Creator";
      return {
        id: r.id, title: r.title, templateId: r.tpl, category: r.category,
        status: r.status, sourceFormat: r.source_format, reviewNote: r.review_note || "",
        scheduledAt: r.scheduled_at, publishedAt: r.published_at, createdAt: r.created_at,
        authorName: safeName, authorHandle: safeHandle,
        likes: Number(r.likes) || 0, comments: Number(r.comments) || 0, exports: Number(r.exports) || 0
      };
    })
  };
}

async function updateContent(user, id, data) {
  if (!can(user, "templates.moderate")) return denied();
  const allowed = new Set(["review", "published", "rejected", "archived"]);
  const status = String(data?.status || "");
  if (!allowed.has(status)) return { error: "Choose a valid moderation status.", status: 400 };
  const note = String(data?.reviewNote || "").trim().slice(0, 1000);

  if (status === "rejected" && !note) {
    return { error: "Rejection reason / review note is mandatory.", status: 400 };
  }

  if (String(id).startsWith("dt_")) {
    // Store private review details in the existing private audit ledger, never
    // inside a public canvas or description. Status and reason commit together.
    return db.tx(async client => {
      const before = await client.query(`select * from public.design_templates where id = $1 for update`, [id]);
      if (!before.rows[0]) return { error: "Design template not found.", status: 404 };
      const { rows } = await client.query(
        `update public.design_templates set status = $2, updated_at = now() where id = $1 returning *`,
        [id, status]
      );
      const reviewNote = status === "published" ? "" : note;
      await client.query(
        `insert into public.admin_audit_log
           (actor_id, action, entity_type, entity_id, before_data, after_data)
         values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
        [user.id, "design_template_moderation", "design_template", String(id),
          JSON.stringify(before.rows[0]), JSON.stringify({ ...rows[0], reviewNote })]
      );
      return { success: true, template: { id, status, reviewNote } };
    });
  }

  const before = await db.query(`select * from public.community_templates where id = $1`, [id]);
  if (!before.rows[0]) return { error: "Template not found.", status: 404 };
  const { rows } = await db.query(
    `update public.community_templates
        set status = $2, review_note = $3,
            published_at = case when $2 = 'published' then coalesce(published_at, now()) else published_at end,
            updated_at = now()
      where id = $1 returning *`,
    [id, status, note]
  );
  await audit(user, "template_moderation", "template", id, before.rows[0], rows[0]);
  await notify.templateModerated(user, before.rows[0], rows[0]);
  return { success: true, template: { id, status, reviewNote: note } };
}

// ── 11. Feature Flags ────────────────────────────────────────
async function listFlags(user) {
  if (!isOwner(user) && !can(user, "flags.manage")) return denied();
  const { rows } = await db.query(
    `select key, enabled, description, updated_at from public.feature_flags order by key`
  );
  return { success: true, flags: rows.map((r) => ({ key: r.key, enabled: r.enabled, description: r.description, updatedAt: r.updated_at })) };
}

async function setFlag(user, key, enabled) {
  if (!isOwner(user) && !can(user, "flags.manage")) return denied();
  const before = await db.query(`select * from public.feature_flags where key = $1`, [key]);
  if (!before.rows[0]) return { error: "Feature flag not found.", status: 404 };
  const { rows } = await db.query(
    `update public.feature_flags set enabled = $2, updated_by = $3, updated_at = now()
      where key = $1 returning *`,
    [key, enabled === true, user.id]
  );
  await audit(user, "feature_flag_update", "feature_flag", key, before.rows[0], rows[0]);
  return { success: true, flag: { key, enabled: rows[0].enabled, description: rows[0].description } };
}

// ── 12. Staff & Roles Management (Owner Only) ─────────────────
async function listStaff(user) {
  if (!isOwner(user) && !can(user, "team.manage")) return ownerOnly();
  const { rows } = await db.query(
    `select id, email, display_name, handle, role, staff_permissions, created_at
       from public.users
      where role = 'super_admin' or (role in ('moderator', 'admin', 'sub_admin') and cardinality(staff_permissions) > 0)
      order by (role = 'super_admin') desc, created_at asc`
  );
  return {
    success: true,
    permissions: permissions.PERMISSIONS,
    presets: permissions.ROLE_PRESETS,
    staff: rows.map((r) => ({
      id: r.id, email: r.email, displayName: r.display_name || "", handle: r.handle || "",
      role: r.role, owner: r.role === "super_admin", permissions: permissions.permissionsOf(r)
    }))
  };
}

async function setStaff(user, targetId, data) {
  // Managing staff permissions can grant owner-level capabilities. Keep it owner-only.
  if (!isOwner(user)) return ownerOnly();
  if (!validId(targetId)) return { error: "Account not found.", status: 404 };
  if (targetId === user.id) return { error: "Your own access cannot be changed here.", status: 400 };

  const granted = permissions.normalise(data?.permissions);
  const targetRole = String(data?.role || "").trim().toLowerCase();

  return db.tx(async (client) => {
    const found = await client.query(
      `select id, role, staff_permissions, display_name, handle from public.users where id = $1 for update`,
      [targetId]
    );
    const target = found.rows[0];
    if (!target) return { error: "Account not found.", status: 404 };
    if (target.role === "super_admin") return { error: "The owner's access cannot be changed.", status: 400 };

    let nextRole = "user";
    if (granted.length > 0) {
      if (targetRole === "sub_admin" || targetRole === "admin") {
        nextRole = "sub_admin";
      } else {
        nextRole = "moderator";
      }
    }

    const { rows } = await client.query(
      `update public.users set role = $2, staff_permissions = $3::text[], updated_at = now()
        where id = $1 returning id, role, staff_permissions`,
      [targetId, nextRole, granted]
    );
    await client.query(
      `insert into public.admin_audit_log (actor_id, action, entity_type, entity_id, before_data, after_data)
       values ($1, 'staff_update', 'user', $2, $3::jsonb, $4::jsonb)`,
      [user.id, targetId,
       JSON.stringify({ role: target.role, permissions: target.staff_permissions || [] }),
       JSON.stringify({ role: rows[0].role, permissions: rows[0].staff_permissions })]
    );

    const labels = permissions.PERMISSIONS.filter((p) => granted.includes(p.key)).map((p) => p.label.toLowerCase());
    const hadAccess = (target.staff_permissions || []).length > 0 && target.role !== "user";
    const message = granted.length
      ? `You now have admin access as ${nextRole === "sub_admin" ? "Sub Admin" : "Moderator"} with permissions: ${labels.join(", ")}. Open the Admin Console from your settings menu.`
      : hadAccess ? "Your admin access was removed." : "";
    if (message) {
      await client.query(
        `insert into public.notifications (user_id, actor_id, type, entity_type, entity_id, message)
         values ($1, $2, 'system', 'admin', 'access', $3)`,
        [targetId, user.id, message]
      );
    }
    return {
      success: true,
      user: {
        id: rows[0].id, role: rows[0].role, permissions: rows[0].staff_permissions,
        displayName: target.display_name || "", handle: target.handle || ""
      }
    };
  });
}

async function audit(user, action, entityType, entityId, before, after) {
  try {
    await db.query(
      `insert into public.admin_audit_log
         (actor_id, action, entity_type, entity_id, before_data, after_data)
       values ($1, $2, $3, $4, $5::jsonb, $6::jsonb)`,
      [user.id, action, entityType, String(entityId || ""), JSON.stringify(before || null), JSON.stringify(after || null)]
    );
  } catch (e) {
    console.error("[admin.audit error]", e.message);
  }
}

module.exports = {
  dashboard,
  listUsers,
  moderateUser,
  adjustUserBalance,
  listCreators,
  listContent,
  updateContent,
  listFlags,
  setFlag,
  listStaff,
  setStaff,
  listWithdrawals,
  processWithdrawal,
  listStarLedger,
  reverseStarTransaction,
  listStarPacks,
  saveStarPack,
  listAiJobs,
  retryAiJob,
  broadcastNotification,
  listAuditLogs,
  isAdmin: permissions.isStaff,
  isSuperAdmin: isOwner
};
