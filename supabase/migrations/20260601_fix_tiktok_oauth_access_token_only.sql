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
  workspace_id uuid,
  ad_platform_connection_id uuid,
  vault_secret_name text,
  provider_account_email text,
  advertiser_id text,
  advertiser_name text
)
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_state public.ad_oauth_states%rowtype;
  v_connection_id uuid;
  v_vault_secret_name text;
  v_vault_payload jsonb;
  v_refresh_token text;
  v_has_refresh_token boolean;
  v_token_mode text;
  v_connection_metadata jsonb;
begin
  if nullif(trim(coalesce(p_state_token, '')), '') is null then
    raise exception 'state_token is required' using errcode = '22023';
  end if;

  if nullif(trim(coalesce(p_access_token, '')), '') is null then
    raise exception 'TikTok access token is required' using errcode = '22023';
  end if;

  select *
    into v_state
  from public.ad_oauth_states
  where state_token = p_state_token
    and platform = 'tiktok_ads'
  limit 1;

  if not found then
    raise exception 'OAuth state was not found' using errcode = 'P0002';
  end if;

  if v_state.status <> 'pending' then
    raise exception 'OAuth state is not pending' using errcode = '42501';
  end if;

  if v_state.expires_at <= now() then
    update public.ad_oauth_states
      set status = 'expired'
    where state_token = p_state_token
      and platform = 'tiktok_ads'
      and status = 'pending';

    raise exception 'OAuth state expired' using errcode = '42501';
  end if;

  v_refresh_token := nullif(trim(coalesce(p_refresh_token, '')), '');
  v_has_refresh_token := v_refresh_token is not null;
  v_token_mode := case
    when v_has_refresh_token then 'access_and_refresh_token'
    else 'access_token_only'
  end;

  v_vault_secret_name := 'tiktok_ads_oauth_' || replace(v_state.workspace_id::text, '-', '_') || '_' || substr(md5(p_state_token), 1, 12);

  v_vault_payload := jsonb_build_object(
    'provider', 'tiktok_ads',
    'workspace_id', v_state.workspace_id,
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
    'TikTok Ads OAuth token payload for workspace ' || v_state.workspace_id::text
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
  where c.workspace_id = v_state.workspace_id
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
      v_state.workspace_id,
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

  update public.ad_oauth_states
    set status = 'consumed',
        consumed_at = now()
  where state_token = p_state_token
    and platform = 'tiktok_ads'
    and status = 'pending';

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
    v_state.workspace_id,
    null,
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
    c.workspace_id,
    c.id as ad_platform_connection_id,
    c.vault_secret_name::text,
    c.provider_account_email::text,
    c.provider_business_id::text as advertiser_id,
    c.provider_business_name::text as advertiser_name
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
