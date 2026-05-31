begin;

create or replace function public.disconnect_ad_platform_connection(
  p_workspace_id uuid,
  p_connection_id uuid,
  p_reason text default null
)
returns table (
  id uuid,
  workspace_id uuid,
  platform text,
  status text,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_has_metadata boolean;
  v_has_updated_by boolean;
  v_sql text;
begin
  if auth.uid() is null then
    raise exception 'Unauthenticated' using errcode = '28000';
  end if;

  if p_workspace_id is null or p_connection_id is null then
    raise exception 'workspace_id and connection_id are required' using errcode = '22023';
  end if;

  if public.workspace_role_rank(public.get_current_user_workspace_role(p_workspace_id)) < 2 then
    raise exception 'Insufficient role' using errcode = '42501';
  end if;

  if to_regclass('public.ad_platform_connections') is null then
    raise exception 'ad_platform_connections table is not available' using errcode = '42P01';
  end if;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ad_platform_connections'
      and column_name = 'metadata'
      and data_type = 'jsonb'
  ) into v_has_metadata;

  select exists (
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'ad_platform_connections'
      and column_name = 'updated_by'
  ) into v_has_updated_by;

  v_sql := 'update public.ad_platform_connections set status = $1, updated_at = now()';

  if v_has_updated_by then
    v_sql := v_sql || ', updated_by = auth.uid()';
  end if;

  if v_has_metadata then
    v_sql := v_sql || ', metadata = coalesce(metadata, ''{}''::jsonb) || jsonb_build_object(' ||
      quote_literal('disconnected_at') || ', now(), ' ||
      quote_literal('disconnect_reason') || ', $4, ' ||
      quote_literal('disconnected_by_user_id') || ', auth.uid())';
  end if;

  v_sql := v_sql || ' where id = $2 and workspace_id = $3 and lower(coalesce(status, '''')) = ''active'' returning id, workspace_id, platform::text, status::text, updated_at';

  return query execute v_sql using 'disconnected', p_connection_id, p_workspace_id, p_reason;

  if not found then
    raise exception 'Active connection was not found' using errcode = 'P0002';
  end if;
end;
$$;

revoke all on function public.disconnect_ad_platform_connection(uuid, uuid, text) from public;
grant execute on function public.disconnect_ad_platform_connection(uuid, uuid, text) to authenticated;

commit;
