begin;

create or replace function public.build_ai_ads_context(
  p_workspace_id uuid,
  p_date_from date default null,
  p_date_to date default null,
  p_platform text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_generated_at timestamptz := now();
  v_fact_rows bigint := 0;
  v_unified_rows bigint := 0;
  v_first_available date;
  v_last_available date;
  v_latest_ads_sync_at timestamptz;
  v_is_fresh boolean := false;
  v_warning text;
  v_source_layer_used text := 'facts_ads_daily';
  v_health jsonb := '{}'::jsonb;
  v_summary jsonb := '[]'::jsonb;
  v_top_campaigns jsonb := '[]'::jsonb;
  v_anomaly_candidates jsonb := '[]'::jsonb;
  v_notes jsonb := '[]'::jsonb;
  v_platform_clause text := '';
  v_daily_source regclass;
  v_daily_date_column text;
  v_summary_source regclass;
  v_anomaly_source regclass;
  v_sql text;
  v_sync_timestamp_expr text;
  v_pipeline_diagnostics jsonb := '{}'::jsonb;
begin
  if p_platform is not null and btrim(p_platform) <> '' then
    v_platform_clause := ' and platform = $4';
  end if;

  if to_regclass('public.facts_ads_daily') is not null then
    execute 'select count(*), min(insight_date), max(insight_date)
             from public.facts_ads_daily
             where workspace_id = $1
               and ($2 is null or insight_date >= $2)
               and ($3 is null or insight_date <= $3)' || v_platform_clause
      into v_fact_rows, v_first_available, v_last_available
      using p_workspace_id, p_date_from, p_date_to, p_platform;
  end if;

  if to_regclass('public.v_unified_ads_performance_daily') is not null then
    execute 'select count(*), min(metric_date), max(metric_date)
             from public.v_unified_ads_performance_daily
             where workspace_id = $1
               and ($2 is null or metric_date >= $2)
               and ($3 is null or metric_date <= $3)'
      into v_unified_rows,
           v_first_available,
           v_last_available
      using p_workspace_id, p_date_from, p_date_to;
  end if;

  if v_fact_rows > 0 then
    v_source_layer_used := 'facts_ads_daily';
    v_daily_source := coalesce(to_regclass('public.v_ai_ads_daily_context'), to_regclass('public.facts_ads_daily'));
    v_daily_date_column := 'insight_date';
    v_summary_source := to_regclass('public.v_ai_ads_summary_context');
    v_anomaly_source := to_regclass('public.v_ai_ads_anomaly_candidates');

    execute 'select min(insight_date), max(insight_date) from ' || v_daily_source ||
            ' where workspace_id = $1 and ($2 is null or insight_date >= $2) and ($3 is null or insight_date <= $3)' || v_platform_clause
      into v_first_available, v_last_available
      using p_workspace_id, p_date_from, p_date_to, p_platform;
  else
    v_source_layer_used := 'v_unified_ads_performance_daily';
    v_daily_source := to_regclass('public.v_unified_ads_performance_daily');
    v_daily_date_column := 'metric_date';
    v_summary_source := to_regclass('public.v_unified_ads_performance_summary');
    v_notes := v_notes || jsonb_build_array('Facts-based ads context is empty; using unified imported ads performance data as fallback.');
  end if;

  if to_regclass('public.ad_sync_run_logs') is not null then
    select string_agg(format('l.%I', column_name), ', ' order by ordinal_position)
      into v_sync_timestamp_expr
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ad_sync_run_logs'
      and column_name in ('finished_at', 'completed_at', 'started_at', 'created_at', 'updated_at');

    if v_sync_timestamp_expr is not null then
      execute 'select max(coalesce(' || v_sync_timestamp_expr || ')) from public.ad_sync_run_logs l where l.workspace_id = $1'
        into v_latest_ads_sync_at
        using p_workspace_id;
    end if;
  end if;

  v_is_fresh := v_last_available is not null and v_last_available >= (current_date - 7);
  if not coalesce(v_is_fresh, false) then
    v_warning := 'Latest available ads metric date is older than 7 days from current_date. AI can analyze only historical/imported data, not current last-7-days drops, until fresh sync/import data is available.';
    v_notes := v_notes || jsonb_build_array('Current last-7-days analysis is not possible unless fresh API facts or imported ads data are available.');
  end if;

  v_health := jsonb_build_object(
    'facts_status', case when v_fact_rows > 0 then 'ads_facts_available' else 'no_ads_facts_yet' end,
    'production_ads_status', case when v_is_fresh then 'ready' else 'needs_attention' end,
    'fallback_used', v_source_layer_used = 'v_unified_ads_performance_daily'
  );

  if v_summary_source is not null then
    v_sql := 'select coalesce(jsonb_agg(to_jsonb(s) order by coalesce((to_jsonb(s)->>''spend'')::numeric, 0) desc), ''[]''::jsonb)
              from (select * from ' || v_summary_source || ' where workspace_id = $1 limit 25) s';
    execute v_sql into v_summary using p_workspace_id;
  end if;

  if v_daily_source is not null and v_daily_date_column is not null then
    v_sql := format('select coalesce(jsonb_agg(to_jsonb(c) order by coalesce(c.spend, 0) desc), ''[]''::jsonb)
              from (
                select campaign_name,
                       min(%1$I) as first_date,
                       max(%1$I) as last_date,
                       sum(coalesce(spend, 0))::numeric as spend,
                       sum(coalesce(clicks, 0))::numeric as clicks,
                       sum(coalesce(leads, 0))::numeric as leads,
                       case when sum(coalesce(leads, 0)) = 0 then null else sum(coalesce(spend, 0)) / nullif(sum(coalesce(leads, 0)), 0) end as cpl
                from %2$s
                where workspace_id = $1 and ($2 is null or %1$I >= $2) and ($3 is null or %1$I <= $3)
                group by campaign_name
                order by spend desc
                limit 10
              ) c', v_daily_date_column, v_daily_source);
    execute v_sql into v_top_campaigns using p_workspace_id, p_date_from, p_date_to;
  end if;

  if v_anomaly_source is not null then
    execute 'select coalesce(jsonb_agg(to_jsonb(a)), ''[]''::jsonb) from (select * from ' || v_anomaly_source || ' where workspace_id = $1 limit 25) a'
      into v_anomaly_candidates
      using p_workspace_id;
  end if;

  v_pipeline_diagnostics := public.build_ads_pipeline_diagnostics(p_workspace_id, p_date_from, p_date_to);

  return jsonb_build_object(
    'context_type', 'ads_context',
    'workspace_id', p_workspace_id,
    'date_from', p_date_from,
    'date_to', p_date_to,
    'platform_filter', p_platform,
    'generated_at', v_generated_at,
    'source_layer_used', v_source_layer_used,
    'data_freshness', jsonb_build_object(
      'first_available_date', v_first_available,
      'last_available_date', v_last_available,
      'latest_ads_sync_at', v_latest_ads_sync_at,
      'fact_ads_rows', v_fact_rows,
      'unified_ads_rows', v_unified_rows,
      'is_fresh', v_is_fresh,
      'warning', v_warning
    ),
    'health', v_health,
    'pipeline_diagnostics', v_pipeline_diagnostics,
    'source_readiness', coalesce(v_pipeline_diagnostics->'source_readiness', '{}'::jsonb),
    'first_blocker_code', v_pipeline_diagnostics->>'first_blocker_code',
    'first_blocker_message', v_pipeline_diagnostics->>'first_blocker_message',
    'platform_blockers', coalesce(v_pipeline_diagnostics->'platform_blockers', '[]'::jsonb),
    'summary_by_platform', v_summary,
    'summary', v_summary,
    'top_campaigns_by_spend', v_top_campaigns,
    'anomaly_candidates', v_anomaly_candidates,
    'notes', v_notes
  );
end;
$$;

grant execute on function public.build_ai_ads_context(uuid, date, date, text) to authenticated;


commit;
