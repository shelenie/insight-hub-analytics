begin;

-- Production hardening for Data Binding mutation RPCs.
-- This migration changes function bodies and EXECUTE grants only; it does not backfill,
-- archive, delete, or otherwise modify existing production rows during migration apply.

create or replace function public.require_source_manager(p_workspace_id uuid)
returns uuid
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_actor_id uuid := auth.uid();
  v_role text := auth.role();
  v_workspace_active boolean := true;
begin
  if v_role = 'service_role' then
    return null;
  end if;

  if v_actor_id is null then
    raise exception 'Authentication required for source and binding management' using errcode = '42501';
  end if;

  if to_regclass('public.workspaces') is not null then
    execute 'select exists (select 1 from public.workspaces where id = $1 and coalesce(status::text, ''active'') not in (''archived'', ''inactive'', ''removed'', ''deleted''))'
      into v_workspace_active
      using p_workspace_id;
  end if;

  if not coalesce(v_workspace_active, false) then
    raise exception 'Workspace is not active or accessible' using errcode = '42501';
  end if;

  if not coalesce(public.can_manage_sources(p_workspace_id, v_actor_id), false) then
    raise exception 'Admin or superadmin role is required for source and binding management' using errcode = '42501';
  end if;

  return v_actor_id;
end;
$$;

create or replace function public.manage_ad_account_binding(
  p_workspace_id uuid,
  p_ad_account_id uuid,
  p_client_id uuid,
  p_project_id uuid,
  p_funnel_id uuid default null,
  p_mapping_status text default 'confirmed',
  p_is_primary boolean default false,
  p_notes text default null,
  p_replace_binding_id uuid default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_email text := nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), '');
  v_account public.ad_accounts%rowtype;
  v_existing_binding_id uuid;
  v_binding_id uuid;
  v_replace_current_status text;
  v_funnel_project_id uuid;
begin
  v_actor_id := public.require_source_manager(p_workspace_id);

  select * into v_account
  from public.ad_accounts
  where id = p_ad_account_id
    and workspace_id = p_workspace_id;

  if not found then
    raise exception 'Ad account not found in workspace' using errcode = '22023';
  end if;

  if coalesce(v_account.status::text, 'active') not in ('active', 'enabled', 'connected', 'verified') then
    raise exception 'Inactive ad account cannot be bound' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.clients c
    where c.id = p_client_id
      and c.workspace_id = p_workspace_id
      and coalesce(c.status::text, 'active') not in ('archived', 'inactive', 'removed', 'deleted')
  ) then
    raise exception 'Client not found, inactive, or outside workspace' using errcode = '22023';
  end if;

  if not exists (
    select 1 from public.projects p
    where p.id = p_project_id
      and p.workspace_id = p_workspace_id
      and p.client_id = p_client_id
      and coalesce(p.status::text, 'active') not in ('archived', 'inactive', 'removed', 'deleted')
  ) then
    raise exception 'Project does not belong to selected client/workspace or is inactive' using errcode = '22023';
  end if;

  if p_funnel_id is not null then
    select f.project_id into v_funnel_project_id
    from public.funnels f
    where f.id = p_funnel_id
      and f.workspace_id = p_workspace_id
      and f.project_id = p_project_id
      and coalesce(f.status::text, 'active') not in ('archived', 'inactive', 'removed', 'deleted');

    if v_funnel_project_id is null then
      raise exception 'Funnel does not belong to selected project/client/workspace or is inactive' using errcode = '22023';
    end if;
  end if;

  if p_replace_binding_id is not null then
    select binding_status::text into v_replace_current_status
    from public.ad_account_bindings
    where id = p_replace_binding_id
      and workspace_id = p_workspace_id
      and ad_account_id = p_ad_account_id
    for update;

    if not found then
      raise exception 'Replacement binding not found for selected account/workspace' using errcode = '22023';
    end if;
  end if;

  if coalesce(p_is_primary, false) then
    update public.ad_account_bindings
    set is_primary = false, updated_at = now()
    where workspace_id = p_workspace_id
      and ad_account_id = p_ad_account_id
      and binding_status = 'active'
      and coalesce(is_primary, false) = true
      and (p_replace_binding_id is null or id <> p_replace_binding_id);
  end if;

  select id into v_existing_binding_id
  from public.ad_account_bindings
  where workspace_id = p_workspace_id
    and ad_account_id = p_ad_account_id
    and client_id is not distinct from p_client_id
    and project_id is not distinct from p_project_id
    and funnel_id is not distinct from p_funnel_id
    and binding_status = 'active'
  order by created_at asc
  limit 1
  for update;

  if p_replace_binding_id is not null and p_replace_binding_id is distinct from v_existing_binding_id then
    update public.ad_account_bindings
    set binding_status = 'archived', updated_at = now()
    where id = p_replace_binding_id
      and workspace_id = p_workspace_id
      and ad_account_id = p_ad_account_id;
  end if;

  if v_existing_binding_id is not null then
    update public.ad_account_bindings
    set
      platform = v_account.platform,
      ad_platform_connection_id = v_account.ad_platform_connection_id,
      external_account_id = v_account.external_account_id,
      external_account_name = v_account.external_account_name,
      mapping_status = coalesce(nullif(btrim(p_mapping_status), ''), mapping_status),
      is_primary = coalesce(p_is_primary, is_primary),
      notes = coalesce(nullif(btrim(p_notes), ''), notes),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('updated_by', v_actor_id, 'updated_by_email', v_actor_email),
      updated_at = now()
    where id = v_existing_binding_id
    returning id into v_binding_id;
  else
    insert into public.ad_account_bindings (
      workspace_id, platform, ad_platform_connection_id, ad_account_id,
      external_account_id, external_account_name, client_id, project_id, funnel_id,
      mapping_status, binding_status, binding_method, confidence, is_primary,
      notes, created_by, created_by_email, metadata, created_at, updated_at
    ) values (
      p_workspace_id, v_account.platform, v_account.ad_platform_connection_id, v_account.id,
      v_account.external_account_id, v_account.external_account_name, p_client_id, p_project_id, p_funnel_id,
      coalesce(nullif(btrim(p_mapping_status), ''), 'confirmed'), 'active', 'manual', 1.0, coalesce(p_is_primary, false),
      p_notes, v_actor_id, v_actor_email, coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('created_by', v_actor_id, 'created_by_email', v_actor_email), now(), now()
    )
    returning id into v_binding_id;
  end if;

  return v_binding_id;
end;
$$;

create or replace function public.archive_binding(
  p_workspace_id uuid,
  p_binding_type text,
  p_binding_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_updated int := 0;
begin
  v_actor_id := public.require_source_manager(p_workspace_id);

  if p_binding_type = 'ad_account' then
    update public.ad_account_bindings
    set binding_status = 'archived', updated_at = now()
    where id = p_binding_id and workspace_id = p_workspace_id and binding_status <> 'archived';
    get diagnostics v_updated = row_count;
  elsif p_binding_type = 'source' then
    update public.source_entity_bindings
    set binding_status = 'archived', updated_at = now()
    where id = p_binding_id and workspace_id = p_workspace_id and binding_status <> 'archived';
    get diagnostics v_updated = row_count;
  else
    raise exception 'Unsupported binding type' using errcode = '22023';
  end if;

  if v_updated = 0 then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.update_binding_mapping_status(
  p_workspace_id uuid,
  p_binding_type text,
  p_binding_id uuid,
  p_mapping_status text,
  p_action_note text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_updated int := 0;
begin
  v_actor_id := public.require_source_manager(p_workspace_id);

  if p_binding_type = 'ad_account' then
    update public.ad_account_bindings
    set mapping_status = p_mapping_status, updated_at = now()
    where id = p_binding_id and workspace_id = p_workspace_id;
    get diagnostics v_updated = row_count;
  elsif p_binding_type = 'source' then
    update public.source_entity_bindings
    set mapping_status = p_mapping_status, updated_at = now()
    where id = p_binding_id and workspace_id = p_workspace_id;
    get diagnostics v_updated = row_count;
  else
    raise exception 'Unsupported binding type' using errcode = '22023';
  end if;

  if v_updated = 0 then
    return false;
  end if;

  if to_regclass('public.mapping_review_actions') is not null then
    insert into public.mapping_review_actions (workspace_id, binding_type, binding_id, action, action_note, actor_id, actor_email, created_at)
    values (p_workspace_id, p_binding_type, p_binding_id, p_mapping_status, p_action_note, v_actor_id, nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), ''), now());
  end if;

  return true;
end;
$$;

create or replace function public.upsert_client(
  p_workspace_id uuid,
  p_client_id uuid default null,
  p_name text default null,
  p_code text default null,
  p_status text default null,
  p_metadata jsonb default null
)
returns public.clients
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_row public.clients%rowtype;
begin
  v_actor_id := public.require_source_manager(p_workspace_id);
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'Client name is required' using errcode = '22023'; end if;

  if p_client_id is not null then
    update public.clients set name = btrim(p_name), client_code = nullif(btrim(p_code), ''), status = coalesce(nullif(btrim(p_status), ''), status), metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb), updated_at = now()
    where id = p_client_id and workspace_id = p_workspace_id returning * into v_row;
    if not found then raise exception 'Client not found in workspace' using errcode = '22023'; end if;
  else
    insert into public.clients (workspace_id, name, client_code, status, metadata, created_at, updated_at)
    values (p_workspace_id, btrim(p_name), nullif(btrim(p_code), ''), coalesce(nullif(btrim(p_status), ''), 'active'), coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('created_by', v_actor_id), now(), now()) returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.upsert_project(
  p_workspace_id uuid,
  p_project_id uuid default null,
  p_client_id uuid default null,
  p_name text default null,
  p_code text default null,
  p_status text default null,
  p_metadata jsonb default null
)
returns public.projects
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_row public.projects%rowtype;
begin
  v_actor_id := public.require_source_manager(p_workspace_id);
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'Project name is required' using errcode = '22023'; end if;
  if not exists (select 1 from public.clients where id = p_client_id and workspace_id = p_workspace_id and coalesce(status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Client not found or inactive in workspace' using errcode = '22023'; end if;

  if p_project_id is not null then
    update public.projects set client_id = p_client_id, name = btrim(p_name), project_code = nullif(btrim(p_code), ''), status = coalesce(nullif(btrim(p_status), ''), status), metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb), updated_at = now()
    where id = p_project_id and workspace_id = p_workspace_id returning * into v_row;
    if not found then raise exception 'Project not found in workspace' using errcode = '22023'; end if;
  else
    insert into public.projects (workspace_id, client_id, name, project_code, status, metadata, created_at, updated_at)
    values (p_workspace_id, p_client_id, btrim(p_name), nullif(btrim(p_code), ''), coalesce(nullif(btrim(p_status), ''), 'active'), coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('created_by', v_actor_id), now(), now()) returning * into v_row;
  end if;
  return v_row;
end;
$$;

create or replace function public.upsert_funnel(
  p_workspace_id uuid,
  p_funnel_id uuid default null,
  p_project_id uuid default null,
  p_name text default null,
  p_code text default null,
  p_status text default null,
  p_metadata jsonb default null
)
returns public.funnels
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_row public.funnels%rowtype;
begin
  v_actor_id := public.require_source_manager(p_workspace_id);
  if nullif(btrim(coalesce(p_name, '')), '') is null then raise exception 'Funnel name is required' using errcode = '22023'; end if;
  if not exists (select 1 from public.projects p join public.clients c on c.id = p.client_id and c.workspace_id = p.workspace_id where p.id = p_project_id and p.workspace_id = p_workspace_id and coalesce(p.status::text, 'active') not in ('archived','inactive','removed','deleted') and coalesce(c.status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Project not found or inactive in workspace' using errcode = '22023'; end if;

  if p_funnel_id is not null then
    update public.funnels set project_id = p_project_id, name = btrim(p_name), funnel_code = nullif(btrim(p_code), ''), status = coalesce(nullif(btrim(p_status), ''), status), metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb), updated_at = now()
    where id = p_funnel_id and workspace_id = p_workspace_id returning * into v_row;
    if not found then raise exception 'Funnel not found in workspace' using errcode = '22023'; end if;
  else
    insert into public.funnels (workspace_id, project_id, name, funnel_code, status, metadata, created_at, updated_at)
    values (p_workspace_id, p_project_id, btrim(p_name), nullif(btrim(p_code), ''), coalesce(nullif(btrim(p_status), ''), 'active'), coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('created_by', v_actor_id), now(), now()) returning * into v_row;
  end if;
  return v_row;
end;
$$;

-- Existing source binding RPC signature used by binding-create-or-update. Replaced to add
-- in-function admin/superadmin authorization and remove caller-trusted actor identity.
create or replace function public.bind_source_entity_to_scope(
  p_workspace_id uuid,
  p_source_kind text,
  p_source_table text,
  p_source_id uuid,
  p_source_external_id text default null,
  p_source_name text default null,
  p_client_id uuid default null,
  p_project_id uuid default null,
  p_funnel_id uuid default null,
  p_mapping_status text default 'confirmed',
  p_binding_method text default 'manual',
  p_confidence numeric default 1.0,
  p_is_primary boolean default false,
  p_notes text default null,
  p_created_by uuid default auth.uid(),
  p_created_by_email text default null,
  p_metadata jsonb default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_email text := nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), '');
  v_binding_id uuid;
begin
  v_actor_id := public.require_source_manager(p_workspace_id);

  if p_client_id is not null and not exists (select 1 from public.clients where id = p_client_id and workspace_id = p_workspace_id and coalesce(status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Client not found or inactive in workspace' using errcode = '22023'; end if;
  if p_project_id is not null and not exists (select 1 from public.projects where id = p_project_id and workspace_id = p_workspace_id and (p_client_id is null or client_id = p_client_id) and coalesce(status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Project mismatch or inactive in workspace' using errcode = '22023'; end if;
  if p_funnel_id is not null and not exists (select 1 from public.funnels where id = p_funnel_id and workspace_id = p_workspace_id and (p_project_id is null or project_id = p_project_id) and coalesce(status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Funnel mismatch or inactive in workspace' using errcode = '22023'; end if;

  update public.source_entity_bindings
  set mapping_status = coalesce(p_mapping_status, mapping_status), binding_method = coalesce(p_binding_method, binding_method), confidence = coalesce(p_confidence, confidence), is_primary = coalesce(p_is_primary, is_primary), notes = coalesce(nullif(btrim(p_notes), ''), notes), metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('updated_by', v_actor_id, 'updated_by_email', v_actor_email), updated_at = now()
  where workspace_id = p_workspace_id and source_kind = p_source_kind and source_id = p_source_id and client_id is not distinct from p_client_id and project_id is not distinct from p_project_id and funnel_id is not distinct from p_funnel_id and binding_status = 'active'
  returning id into v_binding_id;

  if v_binding_id is null then
    insert into public.source_entity_bindings (workspace_id, source_kind, source_table, source_id, source_external_id, source_name, client_id, project_id, funnel_id, mapping_status, binding_status, binding_method, confidence, is_primary, notes, created_by, created_by_email, metadata, created_at, updated_at)
    values (p_workspace_id, p_source_kind, p_source_table, p_source_id, p_source_external_id, p_source_name, p_client_id, p_project_id, p_funnel_id, coalesce(p_mapping_status, 'confirmed'), 'active', coalesce(p_binding_method, 'manual'), coalesce(p_confidence, 1.0), coalesce(p_is_primary, false), p_notes, v_actor_id, v_actor_email, coalesce(p_metadata, '{}'::jsonb), now(), now())
    returning id into v_binding_id;
  end if;
  return v_binding_id;
end;
$$;

-- Exact grant audit for sensitive mutation functions. Anonymous/PUBLIC cannot execute.
revoke execute on function public.require_source_manager(uuid) from public, anon;
grant execute on function public.require_source_manager(uuid) to authenticated, service_role;

revoke execute on function public.manage_ad_account_binding(uuid, uuid, uuid, uuid, uuid, text, boolean, text, uuid, jsonb) from public, anon;
grant execute on function public.manage_ad_account_binding(uuid, uuid, uuid, uuid, uuid, text, boolean, text, uuid, jsonb) to authenticated, service_role;

revoke execute on function public.archive_binding(uuid, text, uuid) from public, anon;
grant execute on function public.archive_binding(uuid, text, uuid) to authenticated, service_role;

revoke execute on function public.update_binding_mapping_status(uuid, text, uuid, text, text) from public, anon;
grant execute on function public.update_binding_mapping_status(uuid, text, uuid, text, text) to authenticated, service_role;

revoke execute on function public.upsert_client(uuid, uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.upsert_client(uuid, uuid, text, text, text, jsonb) to authenticated, service_role;

revoke execute on function public.upsert_project(uuid, uuid, uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.upsert_project(uuid, uuid, uuid, text, text, text, jsonb) to authenticated, service_role;

revoke execute on function public.upsert_funnel(uuid, uuid, uuid, text, text, text, jsonb) from public, anon;
grant execute on function public.upsert_funnel(uuid, uuid, uuid, text, text, text, jsonb) to authenticated, service_role;

revoke execute on function public.bind_source_entity_to_scope(uuid, text, text, uuid, text, text, uuid, uuid, uuid, text, text, numeric, boolean, text, uuid, text, jsonb) from public, anon;
grant execute on function public.bind_source_entity_to_scope(uuid, text, text, uuid, text, text, uuid, uuid, uuid, text, text, numeric, boolean, text, uuid, text, jsonb) to authenticated, service_role;

revoke execute on function public.bind_ad_account_to_scope(uuid, text, uuid, uuid, text, text, uuid, uuid, uuid, text, text, numeric, boolean, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.bind_ad_account_to_scope(uuid, text, uuid, uuid, text, text, uuid, uuid, uuid, text, text, numeric, boolean, text, uuid, text, jsonb) to service_role;

notify pgrst, 'reload schema';
commit;
