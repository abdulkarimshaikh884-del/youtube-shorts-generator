"use strict";
const db = require("./db");
const validId = id => typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
// Only trusted internal SQL aliases are passed here, never request input.
function mutedSQL(alias) {
  if (!/^[nx]$/.test(alias)) throw Error("Invalid internal notification alias");
  return `exists (select 1 from public.notification_mutes m where m.user_id = ${alias}.user_id and m.type = ${alias}.type and m.entity_type = coalesce(${alias}.entity_type, ''))`;
}
async function remove(user, id) {
  if (!user?.id) return {error:"Please log in first.",status:401};
  if (!validId(id)) return {error:"Invalid notification.",status:400};
  const out = await db.query("delete from public.notifications where user_id = $1 and id = $2 returning id",[user.id,id]);
  return out.rowCount ? {success:true} : {error:"Notification not found.",status:404};
}
async function mute(user, id, active) {
  if (!user?.id) return {error:"Please log in first.",status:401};
  if (!validId(id) || typeof active !== "boolean") return {error:"Invalid notification preference.",status:400};
  return db.tx(async client => {
    const {rows} = await client.query("select type, coalesce(entity_type, '') as entity_type from public.notifications where user_id = $1 and id = $2 for update",[user.id,id]);
    if (!rows[0]) return {error:"Notification not found.",status:404};
    const params=[user.id,rows[0].type,rows[0].entity_type];
    if (active) {
      await client.query("insert into public.notification_mutes(user_id,type,entity_type) values($1,$2,$3) on conflict do nothing",params);
    } else await client.query("delete from public.notification_mutes where user_id = $1 and type = $2 and entity_type = $3",params);
    // Unmute resumes new alerts, not a burst of the previously silent backlog.
    await client.query("update public.notifications set read_at = coalesce(read_at, now()), pushed_at = coalesce(pushed_at, now()) where user_id = $1 and type = $2 and coalesce(entity_type, '') = $3",params);
    return {success:true,muted:active};
  });
}
module.exports={mutedSQL,remove,mute};
