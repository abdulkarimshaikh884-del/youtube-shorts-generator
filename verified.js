/* Who shows a verified tick, as a SQL expression over a users row.

   The same rule as auth.isVerified: the owner-set verified column, the
   official @shortscraft account, or an active yearly plan. Several queries
   read only the column, so the official account's tick appeared on template
   cards but not on its tutorials, notifications or follower lists. Every
   query that returns a "verified" flag uses this instead. */
function sql(alias = "u") {
  return `(coalesce(${alias}.verified, false)
          or lower(replace(coalesce(${alias}.handle, ''), '@', '')) = 'shortscraft'
          or (coalesce(${alias}.plan, 'free') <> 'free' and ${alias}.billing_cycle = 'yearly'
              and (${alias}.plan_lifetime = true or ${alias}.plan_until > now()))
          or ((select count(*)::int from public.community_templates ct where ct.author_id = ${alias}.id and ct.status = 'published') >= 5
              and (select count(*)::int from public.user_follows uf where uf.followed_id = ${alias}.id) >= 100))`;
}

module.exports = { sql };
