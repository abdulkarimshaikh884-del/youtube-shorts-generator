/* ============================================================
   social.js — real per-account community state.

   Counts shown in the UI are derived from durable rows, never from a browser
   counter. Unique keys make every action idempotent and transactions keep the
   denormalised gallery counters in sync with the source ledger.
   ============================================================ */
const crypto = require("crypto");
const db = require("./db");
const { PLANS } = require("./credits");

const REACTIONS = new Set(["like", "save"]);
const EVENTS = new Set(["view", "open", "edit", "export", "share"]);

function monthKey() {
  return new Date().toISOString().slice(0, 7);
}

function publicActor(row) {
  if (!row) return null;
  const handle = row.handle || "";
  return {
    id: row.id,
    displayName: row.display_name || (handle ? handle.replace(/^@/, "") : "Creator"),
    handle,
    verified: row.verified === true,
    avatarUrl: row.avatar_bytes ? `/api/users/${encodeURIComponent(row.id)}/avatar` : ""
  };
}

async function setReaction(templateId, user, reaction, wanted) {
  if (!user || !user.id) return { error: "Please log in first.", status: 401 };
  templateId = String(templateId || "").trim().slice(0, 100);
  reaction = String(reaction || "").trim().toLowerCase();
  if (!templateId || !REACTIONS.has(reaction)) return { error: "Invalid reaction.", status: 400 };

  return db.tx(async (client) => {
    let active;
    if (wanted === false) {
      const out = await client.query(
        `delete from public.template_reactions
          where user_id = $1 and template_id = $2 and reaction = $3`,
        [user.id, templateId, reaction]
      );
      active = false;
      if (!out.rowCount) active = false;
    } else {
      await client.query(
        `insert into public.template_reactions (user_id, template_id, reaction)
         values ($1, $2, $3)
         on conflict (user_id, template_id, reaction) do nothing`,
        [user.id, templateId, reaction]
      );
      active = true;
    }

    const counted = await client.query(
      `select count(*)::int as n from public.template_reactions
        where template_id = $1 and reaction = $2`,
      [templateId, reaction]
    );
    const count = Number(counted.rows[0]?.n) || 0;

    if (reaction === "like") {
      const template = await client.query(
        `update public.community_templates set likes = $2, updated_at = now()
          where id = $1 returning author_id, title`,
        [templateId, count]
      );
      const owner = template.rows[0];
      if (active && owner?.author_id && owner.author_id !== user.id) {
        await client.query(
          `insert into public.notifications
             (user_id, actor_id, type, entity_type, entity_id, message)
           select $1, $2, 'like', 'template', $3, $4
           where not exists (
             select 1 from public.notifications
              where user_id = $1 and actor_id = $2 and type = 'like'
                and entity_type = 'template' and entity_id = $3
                and created_at > now() - interval '24 hours'
           )`,
          [owner.author_id, user.id, templateId, `liked ${String(owner.title || "your template").slice(0, 80)}`]
        );
      }
    }

    return { success: true, active, reaction, count };
  });
}

async function reactionState(user, templateIds) {
  const ids = Array.from(new Set((Array.isArray(templateIds) ? templateIds : [])
    .map((v) => String(v || "").slice(0, 100)).filter(Boolean))).slice(0, 100);
  if (!ids.length) return {};
  const [mine, counts] = await Promise.all([
    user?.id ? db.query(
      `select template_id, reaction from public.template_reactions
        where user_id = $1 and template_id = any($2::text[])`,
      [user.id, ids]
    ) : Promise.resolve({ rows: [] }),
    db.query(
      `select template_id, reaction, count(*)::int as n
         from public.template_reactions
        where template_id = any($1::text[])
        group by template_id, reaction`,
      [ids]
    )
  ]);
  const out = {};
  ids.forEach((id) => { out[id] = { like: false, save: false, likeCount: 0, saveCount: 0 }; });
  const rows = mine.rows;
  for (const row of rows) {
    out[row.template_id][row.reaction] = true;
  }
  for (const row of counts.rows) {
    if (!out[row.template_id]) continue;
    out[row.template_id][row.reaction + "Count"] = Number(row.n) || 0;
  }
  return out;
}

/* Public recommendation inputs. Every number comes from an action ledger.
   Repeated activity from the same signed-in user/browser is counted once in
   the rolling window, so refreshing a page cannot manufacture popularity. */
async function discoveryMetrics(templateIds) {
  const ids = Array.from(new Set((Array.isArray(templateIds) ? templateIds : [])
    .map((v) => String(v || "").slice(0, 100)).filter(Boolean))).slice(0, 100);
  if (!ids.length) return {};

  const [reactions, events, comments] = await Promise.all([
    db.query(
      `select template_id,
              count(*) filter (where reaction = 'like')::int as likes,
              count(*) filter (where reaction = 'save')::int as saves
         from public.template_reactions
        where template_id = any($1::text[])
        group by template_id`,
      [ids]
    ),
    db.query(
      `select template_id,
              count(distinct coalesce(user_id::text, session_hash))
                filter (where event_type in ('view','open'))::int as opens,
              count(distinct coalesce(user_id::text, session_hash))
                filter (where event_type = 'edit')::int as edits,
              count(distinct coalesce(user_id::text, session_hash))
                filter (where event_type = 'share')::int as shares,
              count(*) filter (where event_type = 'export')::int as exports
         from public.template_events
        where template_id = any($1::text[])
          and created_at >= now() - interval '30 days'
        group by template_id`,
      [ids]
    ),
    db.query(
      `select tpl_id as template_id, count(*)::int as comments
         from public.template_comments
        where tpl_id = any($1::text[]) and coalesce(status, 'visible') = 'visible'
        group by tpl_id`,
      [ids]
    )
  ]);

  const out = {};
  ids.forEach((id) => {
    out[id] = { likes: 0, saves: 0, opens: 0, edits: 0, shares: 0, exports: 0, comments: 0, score: 0 };
  });
  [...reactions.rows, ...events.rows, ...comments.rows].forEach((row) => {
    if (!out[row.template_id]) return;
    Object.keys(out[row.template_id]).forEach((key) => {
      if (key !== "score" && row[key] !== undefined) out[row.template_id][key] = Number(row[key]) || 0;
    });
  });
  Object.values(out).forEach((m) => {
    // Strong intent signals matter most; a simple open is deliberately weak.
    m.score = m.likes * 6 + m.saves * 5 + m.comments * 4 + m.shares * 8
      + m.edits * 5 + m.exports * 12 + m.opens;
  });
  return out;
}

async function recordEvent(templateId, user, eventType, sessionHash, idempotencyKey) {
  templateId = String(templateId || "").trim().slice(0, 100);
  eventType = String(eventType || "").trim().toLowerCase();
  if (!templateId || !EVENTS.has(eventType)) return { error: "Invalid template event.", status: 400 };
  const idem = String(idempotencyKey || "").trim().slice(0, 160) || null;
  const session = String(sessionHash || "").trim().slice(0, 100) || null;
  try {
    await db.query(
      `insert into public.template_events
         (template_id, user_id, event_type, session_hash, idempotency_key)
       values ($1, $2, $3, $4, $5)
       on conflict (idempotency_key) where idempotency_key is not null do nothing`,
      [templateId, user?.id || null, eventType, session, idem]
    );
  } catch (err) {
    if (err.code !== "23505") throw err;
  }
  return { success: true };
}

async function resolveUser(target) {
  const raw = String(target || "").trim();
  if (!raw) return null;
  const handle = raw.replace(/^@/, "").toLowerCase();
  const { rows } = await db.query(
    `select * from public.users
      where id::text = $1 or lower(handle) in ($2, $3)
      limit 1`,
    [raw, handle, "@" + handle]
  );
  return rows[0] || null;
}

async function setFollow(user, target, wanted) {
  if (!user || !user.id) return { error: "Please log in first.", status: 401 };
  const followed = await resolveUser(target);
  if (!followed) return { error: "Creator not found.", status: 404 };
  if (followed.id === user.id) return { error: "You cannot follow your own account.", status: 400 };

  return db.tx(async (client) => {
    let active;
    if (wanted === false) {
      await client.query(
        `delete from public.user_follows where follower_id = $1 and followed_id = $2`,
        [user.id, followed.id]
      );
      active = false;
    } else {
      const inserted = await client.query(
        `insert into public.user_follows (follower_id, followed_id)
         values ($1, $2) on conflict do nothing returning followed_id`,
        [user.id, followed.id]
      );
      active = true;
      if (inserted.rowCount) {
        /* actor_id is uuid and entity_id is text, so reusing one placeholder
           for both left Postgres unable to deduce a type for it: every
           follow raised "inconsistent types deduced for parameter $2",
           aborted the transaction, and rolled the follow itself back. The
           same value is passed twice instead. */
        await client.query(
          `insert into public.notifications
             (user_id, actor_id, type, entity_type, entity_id, message)
           values ($1, $2, 'follow', 'creator', $3, 'started following you')`,
          [followed.id, user.id, String(user.id)]
        );
      }
    }
    const counts = await client.query(
      `select
         (select count(*)::int from public.user_follows where followed_id = $1) as followers,
         (select count(*)::int from public.user_follows where follower_id = $1) as following`,
      [followed.id]
    );
    return { success: true, active, creator: publicActor(followed), ...counts.rows[0] };
  });
}

async function followSummary(targetUserId, viewer) {
  const { rows } = await db.query(
    `select
       (select count(*)::int from public.user_follows where followed_id = $1) as followers,
       (select count(*)::int from public.user_follows where follower_id = $1) as following,
       exists(select 1 from public.user_follows where follower_id = $2 and followed_id = $1) as followed_by_me`,
    [targetUserId, viewer?.id || null]
  );
  return rows[0] || { followers: 0, following: 0, followed_by_me: false };
}

/* The counts existed; the lists never did, so "1,248 followers" was a number
   you could not open. The plan asks for real follower and following lists,
   and a profile that shows a count with nothing behind it is the kind of
   figure this product is not supposed to print.

   `viewer` is used only to mark which of these people the viewer already
   follows, so the list can offer Follow / Following inline. */
async function listFollows(targetUserId, kind, viewer, limit = 100) {
  if (!targetUserId) return { people: [] };
  const following = kind === "following";
  const { rows } = await db.query(
    `select u.id, u.display_name, u.handle, u.verified, u.avatar_bytes,
            (select count(*)::int from public.community_templates ct
              where ct.author_id = u.id and ct.status = 'published') as published,
            exists(
              select 1 from public.user_follows vf
               where vf.follower_id = $2 and vf.followed_id = u.id
            ) as followed_by_viewer
       from public.user_follows f
       join public.users u
         on u.id = ${following ? "f.followed_id" : "f.follower_id"}
      where ${following ? "f.follower_id" : "f.followed_id"} = $1
      order by f.created_at desc
      limit $3`,
    [targetUserId, viewer?.id || null, Math.min(Number(limit) || 100, 200)]
  );
  return {
    people: rows.map((r) => ({
      ...publicActor(r),
      published: Number(r.published) || 0,
      followedByViewer: r.followed_by_viewer === true,
      isViewer: !!(viewer && viewer.id === r.id)
    }))
  };
}

async function ensureStarGrant(user) {
  if (!user || !user.id) return null;
  const plan = PLANS[user.plan] || PLANS.free;
  const period = monthKey();
  return db.tx(async (client) => {
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`stars:${user.id}:${period}`]);
    const existing = await client.query(
      `select coalesce(sum(amount), 0)::int as n from public.star_transactions
        where receiver_id = $1 and kind = 'monthly_grant' and period_key = $2`,
      [user.id, period]
    );
    const missing = Math.max(0, plan.starsPerMonth - (Number(existing.rows[0]?.n) || 0));
    if (missing) {
      await client.query(
        `insert into public.star_transactions
           (receiver_id, amount, kind, period_key, idempotency_key, note)
         values ($1, $2, 'monthly_grant', $3, $4, $5)
         on conflict (idempotency_key) where idempotency_key is not null do nothing`,
        [user.id, missing, period, `star-grant:${user.id}:${period}:${plan.id}`, `${plan.label} monthly Stars`]
      );
    }
    return { allowance: plan.starsPerMonth, period };
  });
}

async function starSummary(user) {
  if (!user || !user.id) return { balance: 0, received: 0, sent: 0, allowance: 0, period: monthKey() };
  const grant = await ensureStarGrant(user);
  const { rows } = await db.query(
    `select
       coalesce(sum(amount) filter (where receiver_id = $1 and kind in ('monthly_grant','refund','admin_adjustment')), 0)::int as granted,
       coalesce(sum(amount) filter (where sender_id = $1 and kind = 'donation'), 0)::int as sent,
       coalesce(sum(amount) filter (where receiver_id = $1 and kind = 'donation'), 0)::int as received
     from public.star_transactions`,
    [user.id]
  );
  const row = rows[0] || {};
  const sent = Number(row.sent) || 0;
  const granted = Number(row.granted) || 0;
  return {
    balance: Math.max(0, granted - sent),
    received: Number(row.received) || 0,
    sent,
    allowance: grant.allowance,
    period: grant.period
  };
}

async function donateStars(sender, target, amount, note, idempotencyKey) {
  if (!sender || !sender.id) return { error: "Please log in first.", status: 401 };
  const receiver = await resolveUser(target);
  if (!receiver) return { error: "Creator not found.", status: 404 };
  if (receiver.id === sender.id) return { error: "You cannot send Stars to yourself.", status: 400 };
  amount = Number(amount);
  if (!Number.isInteger(amount) || amount < 1 || amount > 20) {
    return { error: "Send between 1 and 20 Stars at a time.", status: 400 };
  }
  await ensureStarGrant(sender);
  const idem = String(idempotencyKey || "").trim().slice(0, 160) || crypto.randomUUID();
  const cleanNote = String(note || "").trim().slice(0, 120);

  return db.tx(async (client) => {
    await client.query(`select pg_advisory_xact_lock(hashtext($1))`, [`stars:${sender.id}`]);
    const totals = await client.query(
      `select
         coalesce(sum(amount) filter (where receiver_id = $1 and kind in ('monthly_grant','refund','admin_adjustment')), 0)::int as granted,
         coalesce(sum(amount) filter (where sender_id = $1 and kind = 'donation'), 0)::int as sent
       from public.star_transactions`,
      [sender.id]
    );
    const balance = (Number(totals.rows[0]?.granted) || 0) - (Number(totals.rows[0]?.sent) || 0);
    if (balance < amount) return { error: `You have ${Math.max(0, balance)} Stars available.`, status: 402 };

    const inserted = await client.query(
      `insert into public.star_transactions
         (sender_id, receiver_id, amount, kind, idempotency_key, note)
       values ($1, $2, $3, 'donation', $4, $5)
       on conflict (idempotency_key) where idempotency_key is not null do nothing
       returning id`,
      [sender.id, receiver.id, amount, idem, cleanNote]
    );
    if (inserted.rowCount) {
      // Same placeholder-type clash as the follow notification above.
      await client.query(
        `insert into public.notifications
           (user_id, actor_id, type, entity_type, entity_id, message)
         values ($1, $2, 'star', 'creator', $3, $4)`,
        [receiver.id, sender.id, String(sender.id),
         `sent you ${amount} Star${amount === 1 ? "" : "s"}`]
      );
    }
    return {
      success: true,
      duplicate: inserted.rowCount === 0,
      balance: inserted.rowCount ? balance - amount : balance,
      receiver: publicActor(receiver)
    };
  });
}

async function listNotifications(user, limit = 30) {
  if (!user || !user.id) return { error: "Please log in first.", status: 401 };
  const safeLimit = Math.min(Math.max(Number(limit) || 30, 1), 50);
  const { rows } = await db.query(
    `select n.*, u.display_name as actor_name, u.handle as actor_handle,
            u.verified as actor_verified, (u.avatar_bytes is not null) as actor_has_avatar
       from public.notifications n
       left join public.users u on u.id = n.actor_id
      where n.user_id = $1
      order by n.created_at desc limit $2`,
    [user.id, safeLimit]
  );
  // Counted over the whole table, not over the page that was just fetched.
  // Deriving the badge from `rows` meant a panel showing ten of thirty unread
  // reported ten, and "show more" had no way to know whether more existed.
  const { rows: totals } = await db.query(
    `select count(*)::int as total,
            count(*) filter (where read_at is null)::int as unread
       from public.notifications where user_id = $1`,
    [user.id]
  );
  return {
    success: true,
    unread: totals[0].unread,
    total: totals[0].total,
    notifications: rows.map((row) => ({
      id: row.id,
      type: row.type,
      entityType: row.entity_type,
      entityId: row.entity_id,
      message: row.message,
      read: Boolean(row.read_at),
      createdAt: row.created_at,
      actor: row.actor_id ? {
        id: row.actor_id,
        displayName: row.actor_name || "Creator",
        handle: row.actor_handle || "",
        verified: row.actor_verified === true,
        avatarUrl: row.actor_has_avatar ? `/api/users/${encodeURIComponent(row.actor_id)}/avatar` : ""
      } : null
    }))
  };
}

async function markNotificationsRead(user, ids) {
  if (!user || !user.id) return { error: "Please log in first.", status: 401 };
  const list = Array.from(new Set((Array.isArray(ids) ? ids : [])
    .map((id) => String(id || "")).filter((id) => /^[0-9a-f-]{36}$/i.test(id)))).slice(0, 50);
  if (list.length) {
    await db.query(
      `update public.notifications set read_at = coalesce(read_at, now())
        where user_id = $1 and id = any($2::uuid[])`,
      [user.id, list]
    );
  } else {
    await db.query(
      `update public.notifications set read_at = coalesce(read_at, now()) where user_id = $1`,
      [user.id]
    );
  }
  return { success: true };
}

async function notifyTemplateComment(templateId, actor, commentText) {
  if (!actor?.id) return;
  await db.query(
    `insert into public.notifications
       (user_id, actor_id, type, entity_type, entity_id, message)
     select author_id, $2, 'comment', 'template', id, $3
       from public.community_templates
      where id = $1 and author_id is not null and author_id <> $2`,
    [templateId, actor.id, `commented: ${String(commentText || "").slice(0, 80)}`]
  );
}

module.exports = {
  setReaction, reactionState, discoveryMetrics, recordEvent,
  setFollow, followSummary,
  starSummary, donateStars,
  listNotifications, markNotificationsRead,
  notifyTemplateComment, resolveUser, listFollows
};
