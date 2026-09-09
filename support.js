/* Durable support tickets shared by the creator portal and the admin console. */
const db = require("./db");

const CATEGORIES = new Set(["account", "billing", "export", "template", "report", "other"]);
const STATUSES = new Set(["open", "waiting_on_user", "in_progress", "resolved", "closed"]);
const PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const validId = (id) => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);

function isAdmin(user) {
  return Boolean(user && ["moderator", "admin", "super_admin"].includes(user.role));
}

function publicTicket(row) {
  return {
    id: row.id,
    userId: row.user_id || null,
    reference: "SC-" + String(row.id).split("-")[0].toUpperCase(),
    email: row.email,
    subject: row.subject,
    category: row.category,
    priority: row.priority,
    status: row.status,
    messageCount: Number(row.message_count) || undefined,
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function normaliseCategory(value, subject) {
  const category = String(value || "").toLowerCase();
  if (CATEGORIES.has(category)) return category;
  const text = String(subject || "").toLowerCase();
  if (text.includes("bill") || text.includes("plan") || text.includes("payment")) return "billing";
  if (text.includes("export") || text.includes("render") || text.includes("download")) return "export";
  if (text.includes("template")) return "template";
  if (text.includes("account") || text.includes("login") || text.includes("password")) return "account";
  if (text.includes("report") || text.includes("copyright") || text.includes("abuse")) return "report";
  return "other";
}

async function createTicket(user, data) {
  const email = String(user?.email || data?.email || "").trim().toLowerCase().slice(0, 160);
  const name = String(data?.name || user?.displayName || "").trim().slice(0, 80);
  const subject = String(data?.subject || "Support request").trim().slice(0, 140);
  const message = String(data?.message || "").trim().slice(0, 4000);
  const category = normaliseCategory(data?.category, subject);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) return { error: "Enter a valid email address.", status: 400 };
  if (subject.length < 3) return { error: "Add a short subject.", status: 400 };
  if (message.length < 10) return { error: "Please add at least one sentence of detail.", status: 400 };

  return db.tx(async (client) => {
    const created = await client.query(
      `insert into public.support_tickets (user_id, email, subject, category, priority, status)
       values ($1, $2, $3, $4, 'normal', 'open') returning *`,
      [user?.id || null, email, subject, category]
    );
    const ticket = created.rows[0];
    await client.query(
      `insert into public.support_messages (ticket_id, author_id, author_role, body)
       values ($1, $2, 'user', $3)`,
      [ticket.id, user?.id || null, name ? `${name}\n\n${message}` : message]
    );
    return { success: true, ticket: publicTicket(ticket) };
  });
}

async function listMine(user) {
  if (!user?.id) return { error: "Please log in first.", status: 401 };
  const { rows } = await db.query(
    `select st.*, count(sm.id)::int as message_count
       from public.support_tickets st
       left join public.support_messages sm on sm.ticket_id = st.id
      where st.user_id = $1
      group by st.id
      order by st.updated_at desc`,
    [user.id]
  );
  return { success: true, tickets: rows.map(publicTicket) };
}

async function getTicket(user, id) {
  if (!user?.id) return { error: "Please log in first.", status: 401 };
  if (!validId(id)) return { error: "Ticket not found.", status: 404 };
  const { rows } = await db.query(
    `select * from public.support_tickets where id = $1 and (user_id = $2 or $3::boolean)`,
    [id, user.id, isAdmin(user)]
  );
  if (!rows[0]) return { error: "Ticket not found.", status: 404 };
  const messages = await db.query(
    `select sm.id, sm.author_role, sm.body, sm.created_at,
            u.display_name as author_name, u.handle as author_handle
       from public.support_messages sm
       left join public.users u on u.id = sm.author_id
      where sm.ticket_id = $1 order by sm.created_at asc`,
    [id]
  );
  return {
    success: true,
    ticket: {
      ...publicTicket(rows[0]),
      messages: messages.rows.map((m) => ({
        id: m.id,
        role: m.author_role,
        body: m.body,
        authorName: m.author_name || (m.author_role === "admin" ? "ShortsCraft Support" : "Creator"),
        authorHandle: m.author_handle || "",
        createdAt: m.created_at
      }))
    }
  };
}

async function addMessage(user, id, body) {
  if (!user?.id) return { error: "Please log in first.", status: 401 };
  body = String(body || "").trim().slice(0, 4000);
  if (body.length < 2) return { error: "Write a reply first.", status: 400 };
  const ticket = await getTicket(user, id);
  if (ticket.error) return ticket;
  if (["closed"].includes(ticket.ticket.status)) return { error: "This ticket is closed.", status: 409 };
  const role = isAdmin(user) ? "admin" : "user";
  const result = await db.tx(async (client) => {
    // Lock the ticket so closing it and posting a reply cannot race.
    const locked = await client.query(
      `select status from public.support_tickets where id = $1 and (user_id = $2 or $3::boolean) for update`,
      [id, user.id, isAdmin(user)]
    );
    if (!locked.rows[0]) return { error: "Ticket not found.", status: 404 };
    if (locked.rows[0].status === "closed") return { error: "This ticket is closed.", status: 409 };
    await client.query(
      `insert into public.support_messages (ticket_id, author_id, author_role, body)
       values ($1, $2, $3, $4)`,
      [id, user.id, role, body]
    );
    await client.query(
      `update public.support_tickets
          set status = $2, updated_at = now()
        where id = $1`,
      [id, role === "admin" ? "waiting_on_user" : "open"]
    );
    if (role === "admin" && ticket.ticket.userId) {
      await client.query(
        `insert into public.notifications
           (user_id, actor_id, type, entity_type, entity_id, message)
         values ($1, $2, 'support_reply', 'support_ticket', $3, $4)`,
        [ticket.ticket.userId, user.id, id, `Support replied to ${ticket.ticket.reference}`]
      );
    }
  });
  if (result?.error) return result;
  return getTicket(user, id);
}

async function listAdmin(user, filters = {}) {
  if (!isAdmin(user)) return { error: "Admin access required.", status: 403 };
  const status = STATUSES.has(String(filters.status)) ? String(filters.status) : null;
  const { rows } = await db.query(
    `select st.*, count(sm.id)::int as message_count
       from public.support_tickets st
       left join public.support_messages sm on sm.ticket_id = st.id
      where ($1::text is null or st.status = $1)
      group by st.id
      order by case st.priority when 'urgent' then 0 when 'high' then 1 when 'normal' then 2 else 3 end,
               st.updated_at asc
      limit 200`,
    [status]
  );
  return { success: true, tickets: rows.map(publicTicket) };
}

async function updateAdmin(user, id, data) {
  if (!isAdmin(user)) return { error: "Admin access required.", status: 403 };
  if (!validId(id)) return { error: "Ticket not found.", status: 404 };
  const status = STATUSES.has(String(data?.status)) ? String(data.status) : null;
  const priority = PRIORITIES.has(String(data?.priority)) ? String(data.priority) : null;
  if (!status && !priority) return { error: "Choose a valid status or priority.", status: 400 };
  return db.tx(async (client) => {
  const before = await client.query(`select * from public.support_tickets where id = $1 for update`, [id]);
  if (!before.rows[0]) return { error: "Ticket not found.", status: 404 };
  const { rows } = await client.query(
    `update public.support_tickets
        set status = coalesce($2, status), priority = coalesce($3, priority),
            assigned_to = coalesce(assigned_to, $4), updated_at = now()
      where id = $1 returning *`,
    [id, status, priority, user.id]
  );
  await client.query(
    `insert into public.admin_audit_log
       (actor_id, action, entity_type, entity_id, before_data, after_data)
     values ($1, 'support_ticket_update', 'support_ticket', $2, $3::jsonb, $4::jsonb)`,
    [user.id, id, JSON.stringify(before.rows[0]), JSON.stringify(rows[0])]
  );
  return { success: true, ticket: publicTicket(rows[0]) };
  });
}

module.exports = { createTicket, listMine, getTicket, addMessage, listAdmin, updateAdmin, isAdmin };
