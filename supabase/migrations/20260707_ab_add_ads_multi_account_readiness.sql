begin;

create or replace function public.build_ads_multi_account_readiness(
  p_workspace_id uuid
)
returns jsonb
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_generated_at timestamptz := now();
  v_total_connections bigint := 0;
  v_total_accounts bigint := 0;
  v_active_accounts bigint := 0;
  v_bound_accounts bigint := 0;
  v_unbound_accounts bigint := 0;
  v_platforms_count bigint := 0;
  v_has_multiple_accounts_same_platform boolean := false;
  v_production_ready_account_count bigint := 0;
  v_needs_attention_count bigint := 0;
  v_platforms jsonb := '[]'::jsonb;
  v_accounts jsonb := '[]'::jsonb;
  v_binding_gaps jsonb := '[]'::jsonb;
  v_overall_status text := 'no_connections';
  v_has_ambiguous_bindings boolean := false;
  v_has_mapping_review_gap boolean := false;
begin
  if to_regclass('public.ad_platform_connections') is not null then
    execute $q$
      select count(*)::bigint
      from public.ad_platform_connections
      where workspace_id = $1
        and coalesce(status::text, 'active') in ('active', 'connected', 'verified')
    $q$ into v_total_connections using p_workspace_id;
  end if;

  if to_regclass('public.ad_accounts') is not null then
    execute $q$
      select
        count(*)::bigint,
        count(*) filter (where coalesce(status::text, 'active') in ('active', 'enabled', 'connected', 'verified'))::bigint,
        count(distinct platform::text)::bigint,
        coalesce(bool_or(platform_accounts > 1), false)
      from (
        select aa.platform, aa.status, count(*) over (partition by platform::text) as platform_accounts
        from public.ad_accounts aa
        where aa.workspace_id = $1
      ) a
    $q$ into v_total_accounts, v_active_accounts, v_platforms_count, v_has_multiple_accounts_same_platform using p_workspace_id;
  end if;

  if to_regclass('public.ad_accounts') is not null and to_regclass('public.ad_account_bindings') is not null then
    execute $q$
      with account_binding_rollup as (
        select
          aa.id,
          aa.platform::text as platform,
          aa.external_account_id::text as external_account_id,
          aa.external_account_name::text as external_account_name,
          coalesce(aa.status::text, 'active') as status,
          coalesce(aa.status::text, 'active') in ('active', 'enabled', 'connected', 'verified') as is_active,
          count(b.id) filter (where coalesce(b.binding_status::text, 'active') = 'active')::bigint as binding_count,
          bool_or(coalesce(b.is_primary, false)) filter (where coalesce(b.binding_status::text, 'active') = 'active') as is_primary_somewhere,
          coalesce(jsonb_agg(distinct b.client_id) filter (where b.client_id is not null and coalesce(b.binding_status::text, 'active') = 'active'), '[]'::jsonb) as bound_client_ids,
          coalesce(jsonb_agg(distinct b.project_id) filter (where b.project_id is not null and coalesce(b.binding_status::text, 'active') = 'active'), '[]'::jsonb) as bound_project_ids,
          coalesce(jsonb_agg(distinct b.funnel_id) filter (where b.funnel_id is not null and coalesce(b.binding_status::text, 'active') = 'active'), '[]'::jsonb) as bound_funnel_ids
        from public.ad_accounts aa
        left join public.ad_account_bindings b on b.ad_account_id = aa.id and b.workspace_id = aa.workspace_id
        where aa.workspace_id = $1
        group by aa.id, aa.platform, aa.external_account_id, aa.external_account_name, aa.status
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'platform', platform,
        'ad_account_id', id,
        'external_account_id', external_account_id,
        'external_account_name', external_account_name,
        'status', status,
        'is_active', is_active,
        'binding_count', binding_count,
        'is_bound', binding_count > 0,
        'is_primary_somewhere', coalesce(is_primary_somewhere, false),
        'bound_client_ids', bound_client_ids,
        'bound_project_ids', bound_project_ids,
        'bound_funnel_ids', bound_funnel_ids,
        'readiness_status', case
          when not is_active then 'needs_mapping_review'
          when binding_count = 0 then 'partially_bound'
          else 'ready'
        end,
        'next_action', case
          when not is_active then 'Review whether this inactive ad account should keep any active binding.'
          when binding_count = 0 then 'Bind this active ad account to the correct client, project, or funnel before treating it as production-ready.'
          else 'No binding action required for this account.'
        end
      ) order by platform, external_account_name, external_account_id), '[]'::jsonb)
      from account_binding_rollup
    $q$ into v_accounts using p_workspace_id;

    execute $q$
      with account_binding_rollup as (
        select
          aa.id,
          coalesce(aa.status::text, 'active') in ('active', 'enabled', 'connected', 'verified') as is_active,
          count(b.id) filter (where coalesce(b.binding_status::text, 'active') = 'active')::bigint as binding_count
        from public.ad_accounts aa
        left join public.ad_account_bindings b on b.ad_account_id = aa.id and b.workspace_id = aa.workspace_id
        where aa.workspace_id = $1
        group by aa.id, aa.status
      )
      select
        count(*) filter (where binding_count > 0)::bigint,
        count(*) filter (where is_active and binding_count = 0)::bigint,
        count(*) filter (where is_active and binding_count > 0)::bigint
      from account_binding_rollup
    $q$ into v_bound_accounts, v_unbound_accounts, v_production_ready_account_count using p_workspace_id;
  else
    v_unbound_accounts := v_active_accounts;
  end if;

  if to_regclass('public.ad_accounts') is not null then
    execute $q$
      with accounts_by_platform as (
        select platform::text as platform,
          count(*)::bigint as accounts_count,
          count(*) filter (where coalesce(status::text, 'active') in ('active', 'enabled', 'connected', 'verified'))::bigint as active_accounts_count
        from public.ad_accounts
        where workspace_id = $1
        group by platform::text
      ), bindings_by_platform as (
        select aa.platform::text as platform,
          count(distinct b.ad_account_id) filter (where coalesce(b.binding_status::text, 'active') = 'active')::bigint as bound_accounts_count
        from public.ad_accounts aa
        left join public.ad_account_bindings b on b.ad_account_id = aa.id and b.workspace_id = aa.workspace_id
        where aa.workspace_id = $1
        group by aa.platform::text
      ), connections_by_platform as (
        select platform::text as platform, count(*)::bigint as connections_count
        from public.ad_platform_connections
        where workspace_id = $1 and coalesce(status::text, 'active') in ('active', 'connected', 'verified')
        group by platform::text
      ), all_platforms as (
        select platform from accounts_by_platform
        union
        select platform from connections_by_platform
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'platform', p.platform,
        'connections_count', coalesce(c.connections_count, 0),
        'accounts_count', coalesce(a.accounts_count, 0),
        'active_accounts_count', coalesce(a.active_accounts_count, 0),
        'bound_accounts_count', coalesce(b.bound_accounts_count, 0),
        'unbound_accounts_count', greatest(coalesce(a.active_accounts_count, 0) - coalesce(b.bound_accounts_count, 0), 0),
        'has_multiple_accounts', coalesce(a.accounts_count, 0) > 1,
        'readiness_status', case
          when coalesce(a.accounts_count, 0) = 0 then 'needs_mapping_review'
          when coalesce(a.active_accounts_count, 0) > 0 and coalesce(b.bound_accounts_count, 0) = 0 then 'accounts_discovered_no_bindings'
          when coalesce(a.active_accounts_count, 0) > coalesce(b.bound_accounts_count, 0) then 'partially_bound'
          else 'ready'
        end,
        'message', case
          when coalesce(a.accounts_count, 0) = 0 then 'Connection exists, but no ad accounts have been discovered for this platform.'
          when coalesce(a.active_accounts_count, 0) > 0 and coalesce(b.bound_accounts_count, 0) = 0 then 'Ad accounts are discovered, but none are bound to client/project/funnel scopes.'
          when coalesce(a.active_accounts_count, 0) > coalesce(b.bound_accounts_count, 0) then 'Some active ad accounts are not bound yet.'
          else 'Discovered active ad accounts have active bindings.'
        end,
        'next_action', case
          when coalesce(a.accounts_count, 0) = 0 then 'Run account discovery when real production platform access is available.'
          when coalesce(a.active_accounts_count, 0) > coalesce(b.bound_accounts_count, 0) then 'Review and bind each active ad account to the correct agency scope.'
          else 'No platform binding action required.'
        end
      ) order by p.platform), '[]'::jsonb)
      from all_platforms p
      left join accounts_by_platform a on a.platform = p.platform
      left join bindings_by_platform b on b.platform = p.platform
      left join connections_by_platform c on c.platform = p.platform
    $q$ into v_platforms using p_workspace_id;
  end if;

  if to_regclass('public.ad_accounts') is not null and to_regclass('public.ad_account_bindings') is not null then
    execute $q$
      with active_unbound_accounts as (
        select 'active_account_without_binding' as gap_type, aa.platform::text as platform, aa.id as ad_account_id,
          aa.external_account_id::text as external_account_id, aa.external_account_name::text as external_account_name,
          null::uuid as binding_id,
          'Active ad account has no active binding.' as message,
          'Bind the account to the correct client, project, or funnel.' as next_action
        from public.ad_accounts aa
        left join public.ad_account_bindings b on b.ad_account_id = aa.id and b.workspace_id = aa.workspace_id and coalesce(b.binding_status::text, 'active') = 'active'
        where aa.workspace_id = $1
          and coalesce(aa.status::text, 'active') in ('active', 'enabled', 'connected', 'verified')
          and b.id is null
      ), ambiguous_primary as (
        select 'account_primary_binding_conflict' as gap_type, aa.platform::text as platform, aa.id as ad_account_id,
          aa.external_account_id::text as external_account_id, aa.external_account_name::text as external_account_name,
          null::uuid as binding_id,
          'Ad account is primary in multiple active binding scopes.' as message,
          'Review primary binding ownership and keep only the intended primary scope.' as next_action
        from public.ad_accounts aa
        join public.ad_account_bindings b on b.ad_account_id = aa.id and b.workspace_id = aa.workspace_id
        where aa.workspace_id = $1 and coalesce(b.binding_status::text, 'active') = 'active' and coalesce(b.is_primary, false)
        group by aa.platform, aa.id, aa.external_account_id, aa.external_account_name
        having count(*) > 1 and count(distinct concat_ws(':', coalesce(b.client_id::text, 'none'), coalesce(b.project_id::text, 'none'), coalesce(b.funnel_id::text, 'none'))) > 1
      ), binding_without_scope as (
        select 'binding_without_client_project_funnel' as gap_type, coalesce(b.platform::text, aa.platform::text) as platform, b.ad_account_id,
          coalesce(b.external_account_id::text, aa.external_account_id::text) as external_account_id,
          coalesce(b.external_account_name::text, aa.external_account_name::text) as external_account_name,
          b.id as binding_id,
          'Active binding has no client, project, or funnel scope.' as message,
          'Map this binding to at least one agency scope or archive it if it is not needed.' as next_action
        from public.ad_account_bindings b
        left join public.ad_accounts aa on aa.id = b.ad_account_id and aa.workspace_id = b.workspace_id
        where b.workspace_id = $1 and coalesce(b.binding_status::text, 'active') = 'active'
          and b.client_id is null and b.project_id is null and b.funnel_id is null
      ), inactive_with_active_binding as (
        select 'inactive_account_with_active_binding' as gap_type, aa.platform::text as platform, aa.id as ad_account_id,
          aa.external_account_id::text as external_account_id, aa.external_account_name::text as external_account_name,
          b.id as binding_id,
          'Inactive ad account still has an active binding.' as message,
          'Review whether to reactivate the account or archive/pause the binding.' as next_action
        from public.ad_accounts aa
        join public.ad_account_bindings b on b.ad_account_id = aa.id and b.workspace_id = aa.workspace_id
        where aa.workspace_id = $1
          and coalesce(aa.status::text, 'active') not in ('active', 'enabled', 'connected', 'verified')
          and coalesce(b.binding_status::text, 'active') = 'active'
      ), connection_without_accounts as (
        select 'platform_connection_without_accounts' as gap_type, c.platform::text as platform, null::uuid as ad_account_id,
          null::text as external_account_id, null::text as external_account_name, null::uuid as binding_id,
          'Platform connection has no discovered ad accounts.' as message,
          'Run account discovery after real production account access is available.' as next_action
        from public.ad_platform_connections c
        left join public.ad_accounts aa on aa.workspace_id = c.workspace_id and aa.platform::text = c.platform::text
        where c.workspace_id = $1 and coalesce(c.status::text, 'active') in ('active', 'connected', 'verified')
        group by c.platform
        having count(aa.id) = 0
      ), gaps as (
        select gap_type, platform, ad_account_id, external_account_id, external_account_name, binding_id, message, next_action from active_unbound_accounts
        union all select gap_type, platform, ad_account_id, external_account_id, external_account_name, binding_id, message, next_action from ambiguous_primary
        union all select gap_type, platform, ad_account_id, external_account_id, external_account_name, binding_id, message, next_action from binding_without_scope
        union all select gap_type, platform, ad_account_id, external_account_id, external_account_name, binding_id, message, next_action from inactive_with_active_binding
        union all select gap_type, platform, ad_account_id, external_account_id, external_account_name, binding_id, message, next_action from connection_without_accounts
      )
      select coalesce(jsonb_agg(jsonb_build_object(
        'gap_type', gap_type,
        'platform', platform,
        'ad_account_id', ad_account_id,
        'external_account_id', external_account_id,
        'external_account_name', external_account_name,
        'binding_id', binding_id,
        'message', message,
        'next_action', next_action
      ) order by platform, gap_type, external_account_id), '[]'::jsonb)
      from gaps
    $q$ into v_binding_gaps using p_workspace_id;
  end if;

  v_needs_attention_count := jsonb_array_length(v_binding_gaps);
  select exists (select 1 from jsonb_array_elements(v_binding_gaps) g where g->>'gap_type' = 'account_primary_binding_conflict') into v_has_ambiguous_bindings;
  select exists (select 1 from jsonb_array_elements(v_binding_gaps) g where g->>'gap_type' in ('binding_without_client_project_funnel', 'inactive_account_with_active_binding', 'platform_connection_without_accounts')) into v_has_mapping_review_gap;

  if v_total_connections = 0 then
    v_overall_status := 'no_connections';
  elsif v_total_accounts > 0 and v_bound_accounts = 0 then
    v_overall_status := 'accounts_discovered_no_bindings';
  elsif v_has_ambiguous_bindings then
    v_overall_status := 'ambiguous_bindings';
  elsif v_has_mapping_review_gap then
    v_overall_status := 'needs_mapping_review';
  elsif v_unbound_accounts > 0 then
    v_overall_status := 'partially_bound';
  else
    v_overall_status := 'ready';
  end if;

  return jsonb_build_object(
    'workspace_id', p_workspace_id,
    'generated_at', v_generated_at,
    'overall_status', v_overall_status,
    'summary', jsonb_build_object(
      'total_connections', v_total_connections,
      'total_accounts', v_total_accounts,
      'active_accounts', v_active_accounts,
      'bound_accounts', v_bound_accounts,
      'unbound_accounts', v_unbound_accounts,
      'platforms_count', v_platforms_count,
      'has_multiple_accounts_same_platform', v_has_multiple_accounts_same_platform,
      'production_ready_account_count', v_production_ready_account_count,
      'needs_attention_count', v_needs_attention_count
    ),
    'platforms', v_platforms,
    'accounts', v_accounts,
    'binding_gaps', v_binding_gaps
  );
end;
$$;

grant execute on function public.build_ads_multi_account_readiness(uuid) to authenticated;

commit;
