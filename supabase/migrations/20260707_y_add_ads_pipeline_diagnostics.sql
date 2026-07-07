begin;

create or replace function public.build_ads_pipeline_diagnostics(
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
  v_generated_at timestamptz := now();
  v_connections jsonb := '[]'::jsonb;
  v_accounts jsonb := '[]'::jsonb;
  v_active_bound_accounts jsonb := '[]'::jsonb;
  v_binding_counts jsonb := '[]'::jsonb;
  v_raw_insights jsonb := '[]'::jsonb;
  v_traffic_raw jsonb := jsonb_build_object('rows', 0, 'first_metric_date', null, 'last_metric_date', null, 'date_column', null);
  v_facts jsonb := '[]'::jsonb;
  v_ai_daily jsonb := jsonb_build_object('rows', 0, 'first_context_date', null, 'last_context_date', null);
  v_ai_anomalies jsonb := jsonb_build_object('rows', 0, 'first_context_date', null, 'last_context_date', null);
  v_sync_runs jsonb := '[]'::jsonb;
  v_latest_success jsonb := '[]'::jsonb;
  v_latest_failed jsonb := '[]'::jsonb;
  v_platform_blockers jsonb := '[]'::jsonb;
  v_first_blocker_code text := 'ready';
  v_first_blocker_message text := 'Ads pipeline has configured connections and AI-ready ads context.';
  v_has_connections boolean := false;
  v_has_accounts boolean := false;
  v_has_bindings boolean := false;
  v_has_raw boolean := false;
  v_has_facts boolean := false;
  v_has_ai_context boolean := false;
  v_has_fallback boolean := false;
  v_has_success_zero boolean := false;
  v_has_google_permission boolean := false;
  v_has_tiktok_range boolean := false;
  v_is_stale boolean := false;
  v_latest_metric_date date;
  v_sql text;
  v_ad_traffic_raw_date_column text;
begin
  if to_regclass('public.ad_platform_connections') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'active_connections', active_connections) order by platform), '[]'::jsonb)
      from (
        select platform::text, count(*)::bigint as active_connections
        from public.ad_platform_connections
        where workspace_id = $1 and coalesce(status::text, 'active') in ('active', 'connected', 'verified')
        group by platform::text
      ) c
    $q$ into v_connections using p_workspace_id;
    v_has_connections := jsonb_array_length(v_connections) > 0;
  end if;

  if to_regclass('public.ad_accounts') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'ad_accounts', ad_accounts) order by platform), '[]'::jsonb)
      from (
        select platform::text, count(*)::bigint as ad_accounts
        from public.ad_accounts
        where workspace_id = $1
        group by platform::text
      ) a
    $q$ into v_accounts using p_workspace_id;
    v_has_accounts := jsonb_array_length(v_accounts) > 0;
  end if;

  if to_regclass('public.ad_account_bindings') is not null and to_regclass('public.ad_accounts') is not null then
    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'active_bound_ad_accounts', active_bound_ad_accounts) order by platform), '[]'::jsonb)
      from (
        select aa.platform::text as platform, count(distinct b.ad_account_id)::bigint as active_bound_ad_accounts
        from public.ad_account_bindings b
        join public.ad_accounts aa on aa.id = b.ad_account_id
        where b.workspace_id = $1 and coalesce(b.binding_status::text, 'active') = 'active'
        group by aa.platform::text
      ) b
    $q$ into v_active_bound_accounts using p_workspace_id;

    execute $q$
      select coalesce(jsonb_agg(jsonb_build_object('platform', platform, 'bindings', bindings) order by platform), '[]'::jsonb)
      from (
        select aa.platform::text as platform, count(*)::bigint as bindings
        from public.ad_account_bindings b
        join public.ad_accounts aa on aa.id = b.ad_account_id
        where b.workspace_id = $1 and coalesce(b.binding_status::text, 'active') = 'active'
        group by aa.platform::text
      ) b
    $q$ into v_binding_counts using p_workspace_id;
    v_has_bindings := jsonb_array_length(v_binding_counts) > 0;
  end if;

  if to_regclass('public.ad_raw_insights') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(r) order by platform), '[]'::jsonb)
      from (
        select platform::text, count(*)::bigint as rows, min(insight_date)::date as first_metric_date, max(insight_date)::date as last_metric_date
        from public.ad_raw_insights
        where workspace_id = $1 and ($2 is null or insight_date >= $2) and ($3 is null or insight_date <= $3)
        group by platform::text
      ) r
    $q$ into v_raw_insights using p_workspace_id, p_date_from, p_date_to;
    v_has_raw := jsonb_array_length(v_raw_insights) > 0;
  end if;

  if to_regclass('public.ad_traffic_raw') is not null then
    select c.column_name
      into v_ad_traffic_raw_date_column
    from (values ('metric_date', 1), ('day', 2), ('insight_date', 3)) as c(column_name, priority)
    where exists (
      select 1
      from information_schema.columns isc
      where isc.table_schema = 'public'
        and isc.table_name = 'ad_traffic_raw'
        and isc.column_name = c.column_name
    )
    order by c.priority
    limit 1;

    if v_ad_traffic_raw_date_column is not null then
      v_sql := format(
        'select jsonb_build_object(''rows'', count(*)::bigint, ''first_metric_date'', min(%1$I)::date, ''last_metric_date'', max(%1$I)::date, ''date_column'', %2$L)
         from public.ad_traffic_raw
         where workspace_id = $1 and ($2 is null or %1$I >= $2) and ($3 is null or %1$I <= $3)',
        v_ad_traffic_raw_date_column,
        v_ad_traffic_raw_date_column
      );
      execute v_sql into v_traffic_raw using p_workspace_id, p_date_from, p_date_to;
    else
      execute $q$
        select jsonb_build_object('rows', count(*)::bigint, 'first_metric_date', null, 'last_metric_date', null, 'date_column', null)
        from public.ad_traffic_raw
        where workspace_id = $1
      $q$ into v_traffic_raw using p_workspace_id;
    end if;

    v_has_raw := v_has_raw or coalesce((v_traffic_raw->>'rows')::bigint, 0) > 0;
  end if;

  if to_regclass('public.facts_ads_daily') is not null then
    execute $q$
      select coalesce(jsonb_agg(to_jsonb(f) order by platform), '[]'::jsonb), max(last_fact_date)
      from (
        select platform::text, count(*)::bigint as rows, min(insight_date)::date as first_fact_date, max(insight_date)::date as last_fact_date
        from public.facts_ads_daily
        where workspace_id = $1 and ($2 is null or insight_date >= $2) and ($3 is null or insight_date <= $3)
        group by platform::text
      ) f
    $q$ into v_facts, v_latest_metric_date using p_workspace_id, p_date_from, p_date_to;
    v_has_facts := jsonb_array_length(v_facts) > 0;
  end if;

  if to_regclass('public.v_ai_ads_daily_context') is not null then
    execute $q$
      select jsonb_build_object('rows', count(*)::bigint, 'first_context_date', min(insight_date)::date, 'last_context_date', max(insight_date)::date)
      from public.v_ai_ads_daily_context
      where workspace_id = $1 and ($2 is null or insight_date >= $2) and ($3 is null or insight_date <= $3)
    $q$ into v_ai_daily using p_workspace_id, p_date_from, p_date_to;
    v_has_ai_context := coalesce((v_ai_daily->>'rows')::bigint, 0) > 0;
  end if;

  if to_regclass('public.v_ai_ads_anomaly_candidates') is not null then
    execute $q$
      select jsonb_build_object('rows', count(*)::bigint, 'first_context_date', min(insight_date)::date, 'last_context_date', max(insight_date)::date)
      from public.v_ai_ads_anomaly_candidates
      where workspace_id = $1 and ($2 is null or insight_date >= $2) and ($3 is null or insight_date <= $3)
    $q$ into v_ai_anomalies using p_workspace_id, p_date_from, p_date_to;
  end if;

  if to_regclass('public.v_unified_ads_performance_daily') is not null then
    execute 'select count(*) > 0, greatest($4::date, max(metric_date)::date) from public.v_unified_ads_performance_daily where workspace_id = $1 and ($2 is null or metric_date >= $2) and ($3 is null or metric_date <= $3)'
      into v_has_fallback, v_latest_metric_date
      using p_workspace_id, p_date_from, p_date_to, v_latest_metric_date;
  end if;

  if to_regclass('public.ad_sync_run_logs') is not null then
    execute $q$
      with runs as (
        select platform, status, date_from, date_to, rows_received, rows_inserted, rows_updated, rows_failed, error_message, row_number() over (partition by platform::text order by coalesce(finished_at, started_at, created_at) desc nulls last) as rn
        from public.ad_sync_run_logs
        where workspace_id = $1
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'platform', platform::text,
        'latest_status', status::text,
        'latest_date_from', date_from,
        'latest_date_to', date_to,
        'rows_received', rows_received,
        'rows_inserted', rows_inserted,
        'rows_updated', rows_updated,
        'rows_failed', rows_failed,
        'error_message', left(regexp_replace(coalesce(error_message, ''), '(access_token|refresh_token|client_secret|service_role|apikey|api_key|bearer)[^[:space:],}]*', '[redacted]', 'gi'), 240)
      ) order by platform::text), '[]'::jsonb)
      from runs where rn = 1
    $q$ into v_sync_runs using p_workspace_id;

    execute $q$
      with runs as (
        select platform, date_from, date_to, rows_received, rows_inserted, row_number() over (partition by platform::text order by coalesce(finished_at, started_at, created_at) desc nulls last) as rn
        from public.ad_sync_run_logs
        where workspace_id = $1 and status::text = 'success'
      )
      select coalesce(jsonb_agg(jsonb_build_object('platform', platform::text, 'date_from', date_from, 'date_to', date_to, 'rows_received', rows_received, 'rows_inserted', rows_inserted) order by platform::text), '[]'::jsonb)
      from runs where rn = 1
    $q$ into v_latest_success using p_workspace_id;

    execute $q$
      with runs as (
        select platform, date_from, date_to, error_message, row_number() over (partition by platform::text order by coalesce(finished_at, started_at, created_at) desc nulls last) as rn
        from public.ad_sync_run_logs
        where workspace_id = $1 and status::text in ('failed', 'error')
      )
      select coalesce(jsonb_agg(jsonb_build_object('platform', platform::text, 'date_from', date_from, 'date_to', date_to, 'error_message', left(regexp_replace(coalesce(error_message, ''), '(access_token|refresh_token|client_secret|service_role|apikey|api_key|bearer)[^[:space:],}]*', '[redacted]', 'gi'), 240)) order by platform::text), '[]'::jsonb)
      from runs where rn = 1
    $q$ into v_latest_failed using p_workspace_id;

    select exists (select 1 from jsonb_array_elements(v_sync_runs) r where (r->>'latest_status') = 'success' and coalesce((r->>'rows_received')::bigint, 0) = 0 and coalesce((r->>'rows_inserted')::bigint, 0) = 0)
      into v_has_success_zero;
    select exists (select 1 from jsonb_array_elements(v_sync_runs) r where (r->>'platform') ilike '%google%' and (r->>'error_message') ilike '%permission_denied%')
      into v_has_google_permission;
    select exists (select 1 from jsonb_array_elements(v_sync_runs) r where (r->>'platform') ilike '%tiktok%' and ((r->>'error_message') ilike '%30%' or (r->>'error_message') ilike '%date range%'))
      into v_has_tiktok_range;
  end if;

  v_is_stale := v_latest_metric_date is not null and v_latest_metric_date < current_date - 7;

  if not v_has_connections then
    v_first_blocker_code := 'no_active_connections';
    v_first_blocker_message := 'No active ad platform connections were found for this workspace.';
  elsif not v_has_accounts then
    v_first_blocker_code := 'no_ad_accounts';
    v_first_blocker_message := 'Ad platform connections exist, but no ad accounts were discovered for this workspace.';
  elsif not v_has_bindings then
    v_first_blocker_code := 'no_account_bindings';
    v_first_blocker_message := 'Ad accounts exist, but no active account bindings connect them to workspace analytics scopes.';
  elsif v_has_google_permission then
    v_first_blocker_code := 'google_ads_permission_denied';
    v_first_blocker_message := 'Google Ads sync is failing with permission denied, so fresh Google Ads rows cannot reach raw or fact layers.';
  elsif v_has_tiktok_range then
    v_first_blocker_code := 'tiktok_date_range_too_large';
    v_first_blocker_message := 'TikTok sync reported a date range limit error; split sync windows before expecting fresh raw rows.';
  elsif v_has_success_zero then
    v_first_blocker_code := 'platform_success_zero_rows';
    v_first_blocker_message := 'At least one platform sync completed successfully but returned or inserted zero rows.';
  elsif not v_has_raw and v_has_fallback then
    v_first_blocker_code := 'ready_with_fallback_only';
    v_first_blocker_message := 'Historical imported ads data is available through the unified fallback, but fresh raw API rows and facts are empty.';
  elsif not v_has_raw then
    v_first_blocker_code := 'no_raw_ads_rows';
    v_first_blocker_message := 'Connections, accounts, and bindings exist, but no raw ads rows are available in the selected date range.';
  elsif not v_has_facts then
    v_first_blocker_code := 'raw_rows_exist_but_facts_empty';
    v_first_blocker_message := 'Raw ads rows exist, but facts_ads_daily is empty; the raw-to-fact rebuild path is the first broken stage.';
  elsif not v_has_ai_context then
    v_first_blocker_code := 'ai_context_empty';
    v_first_blocker_message := 'Ads facts exist, but AI ads context views are empty.';
  elsif v_is_stale then
    v_first_blocker_code := 'stale_ads_data';
    v_first_blocker_message := 'Ads data exists but latest metric date is older than seven days.';
  end if;

  v_platform_blockers := jsonb_build_array(jsonb_build_object('code', v_first_blocker_code, 'message', v_first_blocker_message));

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'generated_at', v_generated_at,
    'date_from', p_date_from,
    'date_to', p_date_to,
    'connection_account_state', jsonb_build_object(
      'active_platform_connections_by_platform', v_connections,
      'ad_accounts_by_platform', v_accounts,
      'active_bound_ad_accounts_by_platform', v_active_bound_accounts,
      'account_binding_counts', v_binding_counts
    ),
    'raw_data_state', jsonb_build_object(
      'ad_raw_insights_by_platform', v_raw_insights,
      'ad_traffic_raw', v_traffic_raw
    ),
    'fact_context_state', jsonb_build_object(
      'facts_ads_daily_by_platform', v_facts,
      'v_ai_ads_daily_context', v_ai_daily,
      'v_ai_ads_anomaly_candidates', v_ai_anomalies
    ),
    'sync_state', jsonb_build_object(
      'latest_ad_sync_run_logs_by_platform', v_sync_runs,
      'latest_successful_run_by_platform', v_latest_success,
      'latest_failed_run_by_platform', v_latest_failed
    ),
    'blocker_diagnosis', jsonb_build_object(
      'first_blocker_code', v_first_blocker_code,
      'first_blocker_message', v_first_blocker_message,
      'platform_blockers', v_platform_blockers
    ),
    'first_blocker_code', v_first_blocker_code,
    'first_blocker_message', v_first_blocker_message,
    'platform_blockers', v_platform_blockers
  );
end;
$$;

grant execute on function public.build_ads_pipeline_diagnostics(uuid, date, date) to authenticated;

commit;
