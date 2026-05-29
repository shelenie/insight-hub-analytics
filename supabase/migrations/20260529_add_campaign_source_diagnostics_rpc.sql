begin;

create or replace function public.get_campaign_source_diagnostics(p_workspace_id uuid)
returns table (
  fact_count integer,
  performance_count integer,
  missing_count integer,
  missing_sources text[]
)
language sql
security definer
stable
set search_path = public
as $$
  with workspace_access as (
    select public.workspace_role_rank(public.get_current_user_workspace_role(p_workspace_id)) >= 1 as has_access
  ),
  fact_sources as (
    select distinct btrim(fp.placement_name) as placement_name
    from public.fact_placements fp
    cross join workspace_access access
    where access.has_access
      and fp.workspace_id = p_workspace_id
      and nullif(btrim(fp.placement_name), '') is not null
  ),
  performance_sources as (
    select distinct btrim(ppr.placement_name) as placement_name
    from public.placement_performance_raw ppr
    cross join workspace_access access
    where access.has_access
      and ppr.workspace_id = p_workspace_id
      and nullif(btrim(ppr.placement_name), '') is not null
  ),
  missing_sources as (
    select fs.placement_name
    from fact_sources fs
    where not exists (
      select 1
      from performance_sources ps
      where ps.placement_name = fs.placement_name
    )
  )
  select
    (select count(*)::integer from fact_sources) as fact_count,
    (select count(*)::integer from performance_sources) as performance_count,
    (select count(*)::integer from missing_sources) as missing_count,
    coalesce(
      (select array_agg(ms.placement_name order by ms.placement_name) from missing_sources ms),
      array[]::text[]
    ) as missing_sources
  from workspace_access access
  where access.has_access;
$$;

revoke all on function public.get_campaign_source_diagnostics(uuid) from public;
grant execute on function public.get_campaign_source_diagnostics(uuid) to authenticated;

commit;
