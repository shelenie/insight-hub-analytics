begin;

create table if not exists public.placement_performance_raw (
  id uuid primary key default gen_random_uuid(),
  workspace_id uuid not null references public.workspaces(id) on delete cascade,
  source_file text,
  source_sheet text,
  metric_date date not null,
  placement_name text not null,
  landing_url text,
  spend numeric default 0,
  reach numeric default 0,
  cpm numeric,
  clicks numeric default 0,
  cpc numeric,
  registrations numeric default 0,
  cpl numeric,
  landing_conversion numeric,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_placement_performance_raw_workspace_date
  on public.placement_performance_raw (workspace_id, metric_date);

create index if not exists idx_placement_performance_raw_workspace_placement
  on public.placement_performance_raw (workspace_id, placement_name);

create index if not exists idx_placement_performance_raw_workspace_sheet
  on public.placement_performance_raw (workspace_id, source_sheet);

alter table public.placement_performance_raw enable row level security;

drop policy if exists placement_performance_raw_select_policy on public.placement_performance_raw;
create policy placement_performance_raw_select_policy
  on public.placement_performance_raw
  for select
  to authenticated
  using (public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 1);

drop policy if exists placement_performance_raw_insert_policy on public.placement_performance_raw;
create policy placement_performance_raw_insert_policy
  on public.placement_performance_raw
  for insert
  to authenticated
  with check (public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 2);

drop policy if exists placement_performance_raw_update_policy on public.placement_performance_raw;
create policy placement_performance_raw_update_policy
  on public.placement_performance_raw
  for update
  to authenticated
  using (public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 2)
  with check (public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 2);

drop policy if exists placement_performance_raw_delete_policy on public.placement_performance_raw;
create policy placement_performance_raw_delete_policy
  on public.placement_performance_raw
  for delete
  to authenticated
  using (public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 3);

create or replace view public.v_unified_placements_performance_daily as
select
  p.workspace_id,
  p.metric_date,
  p.placement_name,
  p.landing_url,
  p.source_sheet,
  sum(coalesce(p.spend, 0))::numeric as spend,
  sum(coalesce(p.reach, 0))::numeric as reach,
  case
    when sum(coalesce(p.reach, 0)) > 0
      then (sum(coalesce(p.spend, 0))::numeric / nullif(sum(coalesce(p.reach, 0))::numeric, 0)) * 1000
    else null::numeric
  end as cpm,
  sum(coalesce(p.clicks, 0))::numeric as clicks,
  case
    when sum(coalesce(p.clicks, 0)) > 0
      then sum(coalesce(p.spend, 0))::numeric / nullif(sum(coalesce(p.clicks, 0))::numeric, 0)
    else null::numeric
  end as cpc,
  sum(coalesce(p.registrations, 0))::numeric as registrations,
  case
    when sum(coalesce(p.registrations, 0)) > 0
      then sum(coalesce(p.spend, 0))::numeric / nullif(sum(coalesce(p.registrations, 0))::numeric, 0)
    else null::numeric
  end as cpl,
  case
    when sum(coalesce(p.clicks, 0)) > 0
      then sum(coalesce(p.registrations, 0))::numeric / nullif(sum(coalesce(p.clicks, 0))::numeric, 0)
    else null::numeric
  end as landing_conversion,
  count(*)::bigint as source_rows_count,
  'placement_performance_raw'::text as source_layer
from public.placement_performance_raw p
where public.workspace_role_rank(public.get_current_user_workspace_role(p.workspace_id)) >= 1
group by p.workspace_id, p.metric_date, p.placement_name, p.landing_url, p.source_sheet;

alter view public.v_unified_placements_performance_daily set (security_invoker = false);

create or replace view public.v_unified_placements_performance_summary as
select
  d.workspace_id,
  d.placement_name,
  d.landing_url,
  d.source_sheet,
  min(d.metric_date) as first_date,
  max(d.metric_date) as last_date,
  sum(coalesce(d.spend, 0))::numeric as spend,
  sum(coalesce(d.reach, 0))::numeric as reach,
  case
    when sum(coalesce(d.reach, 0)) > 0
      then (sum(coalesce(d.spend, 0))::numeric / nullif(sum(coalesce(d.reach, 0))::numeric, 0)) * 1000
    else null::numeric
  end as cpm,
  sum(coalesce(d.clicks, 0))::numeric as clicks,
  case
    when sum(coalesce(d.clicks, 0)) > 0
      then sum(coalesce(d.spend, 0))::numeric / nullif(sum(coalesce(d.clicks, 0))::numeric, 0)
    else null::numeric
  end as cpc,
  sum(coalesce(d.registrations, 0))::numeric as registrations,
  case
    when sum(coalesce(d.registrations, 0)) > 0
      then sum(coalesce(d.spend, 0))::numeric / nullif(sum(coalesce(d.registrations, 0))::numeric, 0)
    else null::numeric
  end as cpl,
  case
    when sum(coalesce(d.clicks, 0)) > 0
      then sum(coalesce(d.registrations, 0))::numeric / nullif(sum(coalesce(d.clicks, 0))::numeric, 0)
    else null::numeric
  end as landing_conversion,
  sum(coalesce(d.source_rows_count, 0))::bigint as source_rows_count,
  max(d.source_layer)::text as source_layer
from public.v_unified_placements_performance_daily d
group by d.workspace_id, d.placement_name, d.landing_url, d.source_sheet;

alter view public.v_unified_placements_performance_summary set (security_invoker = false);

grant select on public.v_unified_placements_performance_daily to authenticated;
grant select on public.v_unified_placements_performance_summary to authenticated;
grant select, insert, update, delete on public.placement_performance_raw to authenticated;

commit;
