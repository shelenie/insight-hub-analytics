begin;

drop function if exists public.complete_tiktok_ads_oauth_connection(
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb
);

create or replace function public.complete_tiktok_ads_oauth_connection(
  p_state_token text,
  p_provider_account_id text default null,
  p_provider_account_email text default null,
  p_advertiser_id text default null,
  p_advertiser_name text default null,
  p_scopes jsonb default '[]'::jsonb,
  p_access_token text default null,
  p_refresh_token text default null,
  p_token_expires_at timestamptz default null,
  p_refresh_token_expires_at timestamptz default null,
  p_token_metadata jsonb default '{}'::jsonb
)
returns table (
  ad_platform_connection_id uuid,
  workspace_id uuid,
  platform text,
  status text,
  vault_secret_name text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_state_table regclass;
  v_state_row jsonb;
  v_workspace_id uuid;
  v_actor_user_id uuid;
  v_connection_id uuid;
  v_vault_secret_name text;
  v_vault_payload jsonb;
  v_refresh_token text;
  v_has_refresh_token boolean;
  v_token_mode text;
  v_connection_metadata jsonb;
  v_state_table_text text;
  v_state_provider text;
  v_state_expires_at timestamptz;
  v_state_used_at timestamptz;
begin
  if nullif(trim(coalesce(p_state_token, '')), '') is null then
    raise exception 'state_token is required' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_access_token, '')), '') is null then
    raise exception 'TikTok access token is required' using errcode = '22023';
  end if;

  v_refresh_token := nullif(trim(coalesce(p_refresh_token, '')), '');
  v_has_refresh_token := v_refresh_token is not null;
  v_token_mode := case
    when v_has_refresh_token then 'access_and_refresh_token'
    else 'access_token_only'
  end;

  select to_regclass(c.table_name)
    into v_state_table
  from (
    values
      ('public.oauth_states'),
      ('public.ad_oauth_states'),
      ('public.ad_platform_oauth_states'),
      ('public.oauth_state_tokens'),
      ('public.ad_connection_oauth_states')
  ) as c(table_name)
  where to_regclass(c.table_name) is not null
    and exists (
      select 1
      from information_schema.columns
      where table_schema = 'public'
        and table_name = split_part(c.table_name, '.', 2)
        and column_name = 'state_token'
    )
  limit 1;

  if v_state_table is null then
    raise exception 'OAuth state table was not found' using errcode = '42P01';
  end if;

  v_state_table_text := v_state_table::text;

  execute format(
    'select to_jsonb(s) from %s s where s.state_token = $1 order by coalesce((to_jsonb(s)->>''created_at'')::timestamptz, now()) desc limit 1',
    v_state_table_text
  )
    into v_state_row
    using p_state_token;

  if v_state_row is null then
    raise exception 'OAuth state was not found' using errcode = 'P0002';
  end if;

  v_state_provider := lower(coalesce(
    v_state_row->>'platform',
    v_state_row->>'provider',
    v_state_row->>'connector',
    'tiktok_ads'
  ));

  if v_state_provider not in ('tiktok_ads', 'tiktok', 'tiktok ads') then
    raise exception 'OAuth state does not belong to TikTok Ads' using errcode = '42501';
  end if;

  v_workspace_id := nullif(v_state_row->>'workspace_id', '')::uuid;
  if v_workspace_id is null then
    raise exception 'OAuth state is missing workspace_id' using errcode = '22023';
  end if;

  v_actor_user_id := nullif(coalesce(
    v_state_row->>'actor_user_id',
    v_state_row->>'created_by',
    v_state_row->>'created_by_user_id',
    v_state_row->>'user_id'
  ), '')::uuid;

  v_state_expires_at := nullif(coalesce(
    v_state_row->>'expires_at',
    v_state_row->>'expires_at_utc'
  ), '')::timestamptz;

  if v_state_expires_at is not null and v_state_expires_at < now() then
    raise exception 'OAuth state expired' using errcode = '42501';
  end if;

  v_state_used_at := nullif(coalesce(
    v_state_row->>'used_at',
    v_state_row->>'consumed_at',
    v_state_row->>'completed_at'
  ), '')::timestamptz;

  if v_state_used_at is not null then
    raise exception 'OAuth state has already been used' using errcode = '42501';
  end if;

  v_vault_secret_name := 'tiktok_ads_oauth_' || replace(v_workspace_id::text, '-', '_') || '_' || substr(md5(p_state_token), 1, 12);

  v_vault_payload := jsonb_build_object(
    'provider', 'tiktok_ads',
    'workspace_id', v_workspace_id,
    'provider_account_id', p_provider_account_id,
    'provider_account_email', p_provider_account_email,
    'advertiser_id', p_advertiser_id,
    'advertiser_name', p_advertiser_name,
    'scopes', coalesce(p_scopes, '[]'::jsonb),
    'access_token', trim(p_access_token),
    'refresh_token', v_refresh_token,
    'token_expires_at', p_token_expires_at,
    'refresh_token_expires_at', case when v_has_refresh_token then p_refresh_token_expires_at else null end,
    'token_mode', v_token_mode,
    'refresh_token_returned', v_has_refresh_token,
    'metadata', coalesce(p_token_metadata, '{}'::jsonb) || jsonb_build_object(
      'token_mode', v_token_mode,
      'refresh_token_returned', v_has_refresh_token
    )
  );

  perform vault.create_secret(
    v_vault_payload::text,
    v_vault_secret_name,
    'TikTok Ads OAuth token payload for workspace ' || v_workspace_id::text
  );

  v_connection_metadata := coalesce(p_token_metadata, '{}'::jsonb) || jsonb_build_object(
    'advertiser_id', p_advertiser_id,
    'advertiser_name', p_advertiser_name,
    'token_mode', v_token_mode,
    'refresh_token_returned', v_has_refresh_token,
    'token_saved_at', now()
  );

  select c.id
    into v_connection_id
  from public.ad_platform_connections c
  where c.workspace_id = v_workspace_id
    and lower(c.platform::text) = 'tiktok_ads'
    and lower(coalesce(c.status::text, '')) = 'active'
  order by c.last_connected_at desc nulls last
  limit 1;

  if v_connection_id is null then
    insert into public.ad_platform_connections (
      workspace_id,
      platform,
      connection_name,
      status,
      provider_account_id,
      provider_account_email,
      provider_business_id,
      provider_business_name,
      vault_secret_name,
      scopes,
      token_expires_at,
      last_connected_at,
      metadata
    ) values (
      v_workspace_id,
      'tiktok_ads',
      coalesce(p_advertiser_name, p_advertiser_id, p_provider_account_id, 'TikTok Ads'),
      'active',
      p_provider_account_id,
      p_provider_account_email,
      p_advertiser_id,
      p_advertiser_name,
      v_vault_secret_name,
      coalesce(p_scopes, '[]'::jsonb),
      p_token_expires_at,
      now(),
      v_connection_metadata
    )
    returning id into v_connection_id;
  else
    update public.ad_platform_connections
      set connection_name = coalesce(p_advertiser_name, p_advertiser_id, p_provider_account_id, connection_name),
          status = 'active',
          provider_account_id = p_provider_account_id,
          provider_account_email = p_provider_account_email,
          provider_business_id = p_advertiser_id,
          provider_business_name = p_advertiser_name,
          vault_secret_name = v_vault_secret_name,
          scopes = coalesce(p_scopes, '[]'::jsonb),
          token_expires_at = p_token_expires_at,
          last_connected_at = now(),
          metadata = coalesce(metadata, '{}'::jsonb) || v_connection_metadata,
          updated_at = now()
    where id = v_connection_id;
  end if;

  if exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = split_part(v_state_table_text, '.', 2)
      and column_name = 'used_at'
  ) then
    execute format('update %s set used_at = now() where state_token = $1', v_state_table_text)
      using p_state_token;
  elsif exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = split_part(v_state_table_text, '.', 2)
      and column_name = 'consumed_at'
  ) then
    execute format('update %s set consumed_at = now() where state_token = $1', v_state_table_text)
      using p_state_token;
  end if;

  insert into public.audit_logs (
    workspace_id,
    actor_user_id,
    actor_role,
    action,
    entity_type,
    entity_id,
    severity,
    metadata
  ) values (
    v_workspace_id,
    v_actor_user_id,
    null,
    'tiktok_ads_oauth_connection_completed',
    'ad_platform_connection',
    v_connection_id::text,
    'info',
    jsonb_build_object(
      'provider', 'tiktok_ads',
      'advertiser_id', p_advertiser_id,
      'advertiser_name', p_advertiser_name,
      'vault_secret_name', v_vault_secret_name,
      'token_mode', v_token_mode,
      'refresh_token_returned', v_has_refresh_token,
      'has_access_token', true,
      'has_refresh_token', v_has_refresh_token
    )
  );

  return query
  select
    c.id as ad_platform_connection_id,
    c.workspace_id,
    c.platform::text,
    c.status::text,
    c.vault_secret_name::text
  from public.ad_platform_connections c
  where c.id = v_connection_id;
end;
$$;

revoke all on function public.complete_tiktok_ads_oauth_connection(
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb
) from public;

grant execute on function public.complete_tiktok_ads_oauth_connection(
  text,
  text,
  text,
  text,
  text,
  jsonb,
  text,
  text,
  timestamptz,
  timestamptz,
  jsonb
) to service_role;

commit;
