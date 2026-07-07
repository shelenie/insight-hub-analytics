begin;

-- Optional idempotency guard for environments where facts_ads_daily already exists.
-- The guarded DO block is additive and no-ops when the table/schema is not present locally.
do $$
begin
  if to_regclass('public.facts_ads_daily') is not null
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'facts_ads_daily' and column_name = 'workspace_id')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'facts_ads_daily' and column_name = 'insight_date')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'facts_ads_daily' and column_name = 'platform')
     and exists (select 1 from information_schema.columns where table_schema = 'public' and table_name = 'facts_ads_daily' and column_name = 'campaign_name') then
    create unique index if not exists facts_ads_daily_imported_backfill_uniq
      on public.facts_ads_daily (workspace_id, insight_date, platform, campaign_name) nulls not distinct;
  end if;
end $$;

create or replace function public.rebuild_imported_ads_facts(
  p_workspace_id uuid,
  p_date_from date default null,
  p_date_to date default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_rows_read bigint := 0;
  v_rows_upserted bigint := 0;
  v_first_metric_date date;
  v_last_metric_date date;
  v_effective_date_from date;
  v_effective_date_to date;
  v_warnings jsonb := '[]'::jsonb;
  v_status text := 'ok';
  v_source_layer_used text := 'v_unified_ads_performance_daily';
  v_sql text;
  v_required_missing text[];
begin
  if p_workspace_id is null then
    raise exception 'p_workspace_id is required';
  end if;

  if to_regclass('public.v_unified_ads_performance_daily') is null then
    return jsonb_build_object(
      'rows_read', 0,
      'rows_inserted_or_upserted', 0,
      'date_from', p_date_from,
      'date_to', p_date_to,
      'first_metric_date', null,
      'last_metric_date', null,
      'source_layer_used', v_source_layer_used,
      'warnings', jsonb_build_array('Missing source view public.v_unified_ads_performance_daily.'),
      'status', 'source_missing'
    );
  end if;

  if to_regclass('public.facts_ads_daily') is null then
    return jsonb_build_object(
      'rows_read', 0,
      'rows_inserted_or_upserted', 0,
      'date_from', p_date_from,
      'date_to', p_date_to,
      'first_metric_date', null,
      'last_metric_date', null,
      'source_layer_used', v_source_layer_used,
      'warnings', jsonb_build_array('Missing target table public.facts_ads_daily.'),
      'status', 'target_missing'
    );
  end if;

  select array_agg(required_column order by required_column)
    into v_required_missing
  from unnest(array['workspace_id','insight_date','platform','campaign_name','spend','clicks','leads','reach']) as required_column
  where not exists (
    select 1
    from information_schema.columns c
    where c.table_schema = 'public'
      and c.table_name = 'facts_ads_daily'
      and c.column_name = required_column
  );

  if coalesce(array_length(v_required_missing, 1), 0) > 0 then
    return jsonb_build_object(
      'rows_read', 0,
      'rows_inserted_or_upserted', 0,
      'date_from', p_date_from,
      'date_to', p_date_to,
      'first_metric_date', null,
      'last_metric_date', null,
      'source_layer_used', v_source_layer_used,
      'warnings', jsonb_build_array('Target public.facts_ads_daily is missing required columns: ' || array_to_string(v_required_missing, ', ')),
      'status', 'target_schema_unsupported'
    );
  end if;

  execute $sql$
    create temporary table tmp_imported_ads_facts_backfill on commit drop as
    select
      workspace_id,
      metric_date::date as insight_date,
      'imported'::text as platform,
      campaign_name::text as campaign_name,
      sum(coalesce(spend, 0))::numeric as spend,
      sum(coalesce(clicks, 0))::numeric as clicks,
      sum(coalesce(leads, 0))::numeric as leads,
      sum(coalesce(reach, 0))::numeric as reach,
      sum(coalesce(source_rows_count, 0))::bigint as source_rows_count,
      min(metric_date)::date as first_metric_date,
      max(metric_date)::date as last_metric_date
    from public.v_unified_ads_performance_daily
    where workspace_id = $1
      and ($2 is null or metric_date >= $2)
      and ($3 is null or metric_date <= $3)
    group by workspace_id, metric_date::date, campaign_name::text
  $sql$ using p_workspace_id, p_date_from, p_date_to;

  select count(*), min(insight_date), max(insight_date)
    into v_rows_read, v_first_metric_date, v_last_metric_date
  from tmp_imported_ads_facts_backfill;

  v_effective_date_from := coalesce(p_date_from, v_first_metric_date);
  v_effective_date_to := coalesce(p_date_to, v_last_metric_date);

  if v_rows_read = 0 then
    return jsonb_build_object(
      'rows_read', 0,
      'rows_inserted_or_upserted', 0,
      'date_from', v_effective_date_from,
      'date_to', v_effective_date_to,
      'first_metric_date', null,
      'last_metric_date', null,
      'source_layer_used', v_source_layer_used,
      'warnings', jsonb_build_array('No imported ads performance rows found for workspace/date range.'),
      'status', 'no_source_rows'
    );
  end if;

  v_sql := $sql$
    insert into public.facts_ads_daily (
      workspace_id,
      insight_date,
      platform,
      campaign_name,
      spend,
      clicks,
      leads,
      reach,
      updated_at
    )
    select
      workspace_id,
      insight_date,
      platform,
      campaign_name,
      spend,
      clicks,
      leads,
      reach,
      now()
    from tmp_imported_ads_facts_backfill
    on conflict (workspace_id, insight_date, platform, campaign_name)
    do update set
      spend = excluded.spend,
      clicks = excluded.clicks,
      leads = excluded.leads,
      reach = excluded.reach,
      updated_at = now()
  $sql$;

  if not exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'facts_ads_daily' and column_name = 'updated_at'
  ) then
    v_sql := replace(v_sql, ',
      updated_at', '');
    v_sql := replace(v_sql, ',
      now()', '');
    v_sql := replace(v_sql, ',
      updated_at = now()', '');
  end if;

  execute v_sql;
  get diagnostics v_rows_upserted = row_count;

  return jsonb_build_object(
    'rows_read', v_rows_read,
    'rows_inserted_or_upserted', v_rows_upserted,
    'date_from', v_effective_date_from,
    'date_to', v_effective_date_to,
    'first_metric_date', v_first_metric_date,
    'last_metric_date', v_last_metric_date,
    'source_layer_used', v_source_layer_used,
    'warnings', v_warnings,
    'status', v_status
  );
end;
$$;

grant execute on function public.rebuild_imported_ads_facts(uuid, date, date) to authenticated;

commit;
