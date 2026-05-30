begin;

create or replace function public.get_import_health_summary(p_workspace_id uuid)
returns table (
  workspace_id uuid,
  open_rejected_rows bigint,
  critical_rejected_rows bigint,
  rejected_rows_last_24h bigint,
  latest_rejected_row_at timestamptz,
  latest_sync_status text,
  latest_sync_rows_failed bigint,
  latest_sync_at timestamptz,
  import_health_status text
)
language sql
security definer
stable
set search_path = public
as $$
  with workspace_access as (
    select public.workspace_role_rank(public.get_current_user_workspace_role(p_workspace_id)) >= 1 as has_access
  )
  select
    ih.workspace_id::uuid,
    ih.open_rejected_rows::bigint,
    ih.critical_rejected_rows::bigint,
    ih.rejected_rows_last_24h::bigint,
    ih.latest_rejected_row_at::timestamptz,
    ih.latest_sync_status::text,
    ih.latest_sync_rows_failed::bigint,
    ih.latest_sync_at::timestamptz,
    ih.import_health_status::text
  from public.workspaces w
  cross join workspace_access access
  join public.v_import_health ih
    on ih.workspace_id = w.id
  where access.has_access
    and w.id = p_workspace_id
  limit 1;
$$;

revoke all on function public.get_import_health_summary(uuid) from public;
grant execute on function public.get_import_health_summary(uuid) to authenticated;

commit;
