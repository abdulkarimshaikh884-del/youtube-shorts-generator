"use strict";
const db = require("./db");
async function list(user, offset = 0) {
  if (!user?.id) return {error:"Please log in first.",status:401};
  offset = Number(offset);
  if (!Number.isSafeInteger(offset) || offset < 0 || offset > 10000) return {error:"Invalid history page.",status:400};
  // Ownership comes only from the authenticated session, never a client user ID.
  const {rows} = await db.query(`select * from (
    select 'credit:' || id::text as id, kind, amount::numeric as amount, 'credits' as unit, 'recorded' as status, created_at
      from public.credit_transactions where user_id = $1 or credit_key = $2
    union all
    select 'star:' || id::text, kind, (case when receiver_id = $1 then amount else -amount end)::numeric, 'stars', 'recorded', created_at
      from public.star_transactions where sender_id = $1 or receiver_id = $1
    union all
    select 'payment:' || payment_id, 'purchase_' || plan, -amount_paise::numeric / 100, 'INR', 'paid', created_at
      from public.processed_payments where user_id = $1
  ) ledger order by created_at desc, id desc limit 26 offset $3`, [user.id, "u:" + user.id, offset]);
  return {success:true,transactions:rows.slice(0,25).map(r=>({id:r.id,kind:r.kind,amount:Number(r.amount),unit:r.unit,status:r.status,createdAt:r.created_at})),hasMore:rows.length>25,nextOffset:offset+25};
}
module.exports = {list};
