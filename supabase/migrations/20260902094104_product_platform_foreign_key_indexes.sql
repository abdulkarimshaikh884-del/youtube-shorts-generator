-- Cover every foreign key introduced by the product-platform foundation.
-- PostgreSQL does not create indexes for referencing columns automatically;
-- without these, deleting a user or ticket can scan an entire child table.
create index if not exists credit_transactions_user_idx
  on public.credit_transactions(user_id);
create index if not exists template_events_user_idx
  on public.template_events(user_id);
create index if not exists template_comments_author_idx
  on public.template_comments(author_id);
create index if not exists template_comments_parent_idx
  on public.template_comments(parent_id);
create index if not exists notifications_actor_idx
  on public.notifications(actor_id);
create index if not exists support_tickets_user_idx
  on public.support_tickets(user_id);
create index if not exists support_tickets_assigned_idx
  on public.support_tickets(assigned_to);
create index if not exists support_messages_author_idx
  on public.support_messages(author_id);
create index if not exists content_reports_reporter_idx
  on public.content_reports(reporter_id);
create index if not exists content_reports_resolver_idx
  on public.content_reports(resolved_by);
create index if not exists feature_flags_updated_by_idx
  on public.feature_flags(updated_by);
create index if not exists admin_audit_log_actor_idx
  on public.admin_audit_log(actor_id);
create index if not exists community_templates_author_idx
  on public.community_templates(author_id);
