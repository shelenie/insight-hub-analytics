begin;

-- Production hardening for Data Binding mutation RPCs.
-- Function and grant changes only: this migration does not backfill, archive,
-- update production rows, delete production rows, or modify raw advertising data during apply.

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
begin
  if v_role = 'service_role' then
    return null;
  end if;

  if v_actor_id is null then
    raise exception 'Authentication required for source and binding management' using errcode = '42501';
  end if;

  if not exists (select 1 from public.workspaces w where w.id = p_workspace_id) then
    raise exception 'Workspace not found' using errcode = '42501';
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
  p_is_primary boolean default null,
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
  v_actor_role text;
  v_account public.ad_accounts%rowtype;
  v_existing_binding_id uuid;
  v_binding_id uuid;
  v_funnel_project_id uuid;
  v_funnel_client_id uuid;
  v_replace_status text;
  v_mapping_status text := coalesce(nullif(btrim(p_mapping_status), ''), 'confirmed');
begin
  v_actor_id := public.require_source_manager(p_workspace_id);
  if v_actor_id is not null then
    v_actor_role := public.get_workspace_role(p_workspace_id, v_actor_id);
  else
    v_actor_role := 'service_role';
  end if;

  if v_mapping_status not in ('confirmed', 'pending_review', 'rejected') then
    raise exception 'Invalid mapping status' using errcode = '22023';
  end if;

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
    select f.project_id, f.client_id into v_funnel_project_id, v_funnel_client_id
    from public.funnels f
    where f.id = p_funnel_id
      and f.workspace_id = p_workspace_id
      and f.project_id = p_project_id
      and f.client_id = p_client_id
      and coalesce(f.status::text, 'active') not in ('archived', 'inactive', 'removed', 'deleted');

    if v_funnel_project_id is null or v_funnel_client_id is null then
      raise exception 'Funnel does not belong to selected client/project/workspace or is inactive' using errcode = '22023';
    end if;
  end if;

  if p_replace_binding_id is not null then
    select binding_status::text into v_replace_status
    from public.ad_account_bindings
    where id = p_replace_binding_id
      and workspace_id = p_workspace_id
      and ad_account_id = p_ad_account_id
    for update;

    if not found then
      raise exception 'Replacement binding not found for selected account/workspace' using errcode = '22023';
    end if;

    if coalesce(v_replace_status, '') <> 'active' then
      raise exception 'Replacement binding must be active' using errcode = '22023';
    end if;
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

  if coalesce(p_is_primary, false) then
    update public.ad_account_bindings
    set is_primary = false, updated_at = now()
    where workspace_id = p_workspace_id
      and ad_account_id = p_ad_account_id
      and binding_status = 'active'
      and coalesce(is_primary, false) = true
      and (v_existing_binding_id is null or id <> v_existing_binding_id)
      and (p_replace_binding_id is null or id <> p_replace_binding_id);
  end if;

  if p_replace_binding_id is not null and p_replace_binding_id is distinct from v_existing_binding_id then
    update public.ad_account_bindings
    set binding_status = 'archived', updated_at = now()
    where id = p_replace_binding_id
      and workspace_id = p_workspace_id
      and ad_account_id = p_ad_account_id
      and binding_status = 'active';
  end if;

  if v_existing_binding_id is not null then
    update public.ad_account_bindings
    set
      platform = v_account.platform,
      ad_platform_connection_id = v_account.ad_platform_connection_id,
      external_account_id = v_account.external_account_id,
      external_account_name = v_account.external_account_name,
      mapping_status = v_mapping_status,
      is_primary = case when p_is_primary is null then is_primary else p_is_primary end,
      notes = coalesce(nullif(btrim(p_notes), ''), notes),
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('updated_by', v_actor_id, 'updated_by_email', v_actor_email, 'updated_by_role', v_actor_role),
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
      v_mapping_status, 'active', 'manual', 1.0, coalesce(p_is_primary, false),
      p_notes, v_actor_id, v_actor_email, coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('created_by', v_actor_id, 'created_by_email', v_actor_email, 'created_by_role', v_actor_role), now(), now()
    )
    returning id into v_binding_id;
  end if;

  return v_binding_id;
end;
$$;

create or replace function public.archive_binding(
  p_workspace_id uuid,
  p_binding_type text,
  p_binding_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_email text := nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), '');
  v_actor_role text;
  v_updated int := 0;
begin
  v_actor_id := public.require_source_manager(p_workspace_id);
  v_actor_role := case when v_actor_id is null then 'service_role' else public.get_workspace_role(p_workspace_id, v_actor_id) end;

  if p_binding_type = 'ad_account' then
    update public.ad_account_bindings
    set binding_status = 'archived', metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archived_by_role', v_actor_role), updated_at = now()
    where id = p_binding_id and workspace_id = p_workspace_id and binding_status <> 'archived';
    get diagnostics v_updated = row_count;
  elsif p_binding_type = 'source' then
    update public.source_entity_bindings
    set binding_status = 'archived', metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archived_by_role', v_actor_role), updated_at = now()
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
  p_new_mapping_status text,
  p_notes text default null,
  p_actor_user_id uuid default null,
  p_actor_email text default null,
  p_actor_role text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_email text;
  v_actor_role text;
  v_previous_mapping_status text;
  v_action_type text;
  v_updated int := 0;
begin
  v_actor_id := public.require_source_manager(p_workspace_id);
  v_actor_email := case when v_actor_id is null then p_actor_email else nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), '') end;
  v_actor_role := case when v_actor_id is null then coalesce(p_actor_role, 'service_role') else public.get_workspace_role(p_workspace_id, v_actor_id) end;

  if p_new_mapping_status not in ('confirmed', 'pending_review', 'rejected') then
    raise exception 'Invalid mapping status' using errcode = '22023';
  end if;

  if p_binding_type = 'ad_account' then
    select mapping_status::text into v_previous_mapping_status
    from public.ad_account_bindings
    where id = p_binding_id and workspace_id = p_workspace_id
    for update;

    if not found then return false; end if;

    update public.ad_account_bindings
    set mapping_status = p_new_mapping_status, updated_at = now()
    where id = p_binding_id and workspace_id = p_workspace_id;
    get diagnostics v_updated = row_count;
  elsif p_binding_type = 'source' then
    select mapping_status::text into v_previous_mapping_status
    from public.source_entity_bindings
    where id = p_binding_id and workspace_id = p_workspace_id
    for update;

    if not found then return false; end if;

    update public.source_entity_bindings
    set mapping_status = p_new_mapping_status, updated_at = now()
    where id = p_binding_id and workspace_id = p_workspace_id;
    get diagnostics v_updated = row_count;
  else
    raise exception 'Unsupported binding type' using errcode = '22023';
  end if;

  if v_updated = 0 then
    return false;
  end if;

  v_action_type := case p_new_mapping_status
    when 'confirmed' then 'approved'
    when 'rejected' then 'rejected'
    when 'pending_review' then 'marked_pending_review'
    else 'manual_update'
  end;

  insert into public.mapping_review_actions (
    workspace_id, binding_type, binding_id, action_type,
    previous_mapping_status, new_mapping_status,
    actor_user_id, actor_email, actor_role,
    notes, metadata, created_at
  ) values (
    p_workspace_id, p_binding_type, p_binding_id, v_action_type,
    v_previous_mapping_status, p_new_mapping_status,
    coalesce(v_actor_id, p_actor_user_id), v_actor_email, v_actor_role,
    p_notes, coalesce(p_metadata, '{}'::jsonb), now()
  );

  return true;
end;
$$;

create or replace function public.upsert_client(
  p_workspace_id uuid,
  p_client_name text,
  p_client_code text default null,
  p_status text default null,
  p_default_currency text default null,
  p_default_timezone text default null,
  p_website_url text default null,
  p_owner_name text default null,
  p_owner_email text default null,
  p_notes text default null,
  p_created_by uuid default null,
  p_created_by_email text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_email text;
  v_client public.clients%rowtype;
  v_name text := nullif(btrim(p_client_name), '');
begin
  v_actor_id := public.require_source_manager(p_workspace_id);
  v_actor_email := case when v_actor_id is null then p_created_by_email else nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), '') end;
  if v_name is null then raise exception 'Client name is required' using errcode = '22023'; end if;

  insert into public.clients (workspace_id, name, client_name, client_code, status, default_currency, default_timezone, website_url, owner_name, owner_email, notes, created_by, created_by_email, metadata, created_at, updated_at)
  values (p_workspace_id, v_name, v_name, nullif(btrim(p_client_code), ''), coalesce(nullif(btrim(p_status), ''), 'active'), p_default_currency, p_default_timezone, p_website_url, p_owner_name, p_owner_email, p_notes, coalesce(v_actor_id, p_created_by), v_actor_email, coalesce(p_metadata, '{}'::jsonb), now(), now())
  on conflict (workspace_id, client_code) where client_code is not null do update set
    name = excluded.name,
    client_name = excluded.client_name,
    status = excluded.status,
    default_currency = excluded.default_currency,
    default_timezone = excluded.default_timezone,
    website_url = excluded.website_url,
    owner_name = excluded.owner_name,
    owner_email = excluded.owner_email,
    notes = excluded.notes,
    metadata = coalesce(public.clients.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning * into v_client;

  return v_client.id;
end;
$$;

create or replace function public.upsert_project(
  p_workspace_id uuid,
  p_client_id uuid,
  p_project_name text,
  p_project_code text default null,
  p_status text default null,
  p_business_model text default null,
  p_primary_offer text default null,
  p_default_currency text default null,
  p_default_timezone text default null,
  p_owner_name text default null,
  p_owner_email text default null,
  p_notes text default null,
  p_created_by uuid default null,
  p_created_by_email text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_email text;
  v_project public.projects%rowtype;
  v_name text := nullif(btrim(p_project_name), '');
begin
  v_actor_id := public.require_source_manager(p_workspace_id);
  v_actor_email := case when v_actor_id is null then p_created_by_email else nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), '') end;
  if v_name is null then raise exception 'Project name is required' using errcode = '22023'; end if;

  if not exists (select 1 from public.clients c where c.id = p_client_id and c.workspace_id = p_workspace_id and coalesce(c.status::text, 'active') not in ('archived','inactive','removed','deleted')) then
    raise exception 'Client not found or inactive in workspace' using errcode = '22023';
  end if;

  insert into public.projects (workspace_id, client_id, name, project_name, project_code, status, business_model, primary_offer, default_currency, default_timezone, owner_name, owner_email, notes, created_by, created_by_email, metadata, created_at, updated_at)
  values (p_workspace_id, p_client_id, v_name, v_name, nullif(btrim(p_project_code), ''), coalesce(nullif(btrim(p_status), ''), 'active'), p_business_model, p_primary_offer, p_default_currency, p_default_timezone, p_owner_name, p_owner_email, p_notes, coalesce(v_actor_id, p_created_by), v_actor_email, coalesce(p_metadata, '{}'::jsonb), now(), now())
  on conflict (workspace_id, project_code) where project_code is not null do update set
    client_id = excluded.client_id,
    name = excluded.name,
    project_name = excluded.project_name,
    status = excluded.status,
    business_model = excluded.business_model,
    primary_offer = excluded.primary_offer,
    default_currency = excluded.default_currency,
    default_timezone = excluded.default_timezone,
    owner_name = excluded.owner_name,
    owner_email = excluded.owner_email,
    notes = excluded.notes,
    metadata = coalesce(public.projects.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning * into v_project;

  return v_project.id;
end;
$$;

create or replace function public.upsert_funnel(
  p_workspace_id uuid,
  p_project_id uuid,
  p_funnel_name text,
  p_funnel_code text default null,
  p_funnel_type text default null,
  p_status text default null,
  p_traffic_source_notes text default null,
  p_offer_notes text default null,
  p_default_currency text default null,
  p_default_timezone text default null,
  p_starts_at timestamptz default null,
  p_ends_at timestamptz default null,
  p_notes text default null,
  p_created_by uuid default null,
  p_created_by_email text default null,
  p_metadata jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_email text;
  v_funnel public.funnels%rowtype;
  v_project public.projects%rowtype;
  v_name text := nullif(btrim(p_funnel_name), '');
begin
  v_actor_id := public.require_source_manager(p_workspace_id);
  v_actor_email := case when v_actor_id is null then p_created_by_email else nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), '') end;
  if v_name is null then raise exception 'Funnel name is required' using errcode = '22023'; end if;

  select * into v_project
  from public.projects p
  where p.id = p_project_id
    and p.workspace_id = p_workspace_id
    and coalesce(p.status::text, 'active') not in ('archived','inactive','removed','deleted');

  if not found then
    raise exception 'Project not found or inactive in workspace' using errcode = '22023';
  end if;

  if not exists (select 1 from public.clients c where c.id = v_project.client_id and c.workspace_id = p_workspace_id and coalesce(c.status::text, 'active') not in ('archived','inactive','removed','deleted')) then
    raise exception 'Project client not found or inactive in workspace' using errcode = '22023';
  end if;

  insert into public.funnels (workspace_id, client_id, project_id, funnel_name, name, funnel_code, funnel_type, status, traffic_source_notes, offer_notes, default_currency, default_timezone, starts_at, ends_at, notes, created_by, created_by_email, metadata, created_at, updated_at)
  values (p_workspace_id, v_project.client_id, p_project_id, v_name, v_name, nullif(btrim(p_funnel_code), ''), p_funnel_type, coalesce(nullif(btrim(p_status), ''), 'active'), p_traffic_source_notes, p_offer_notes, p_default_currency, p_default_timezone, p_starts_at, p_ends_at, p_notes, coalesce(v_actor_id, p_created_by), v_actor_email, coalesce(p_metadata, '{}'::jsonb), now(), now())
  on conflict (workspace_id, funnel_code) where funnel_code is not null do update set
    client_id = excluded.client_id,
    project_id = excluded.project_id,
    funnel_name = excluded.funnel_name,
    name = excluded.name,
    funnel_type = excluded.funnel_type,
    status = excluded.status,
    traffic_source_notes = excluded.traffic_source_notes,
    offer_notes = excluded.offer_notes,
    default_currency = excluded.default_currency,
    default_timezone = excluded.default_timezone,
    starts_at = excluded.starts_at,
    ends_at = excluded.ends_at,
    notes = excluded.notes,
    metadata = coalesce(public.funnels.metadata, '{}'::jsonb) || excluded.metadata,
    updated_at = now()
  returning * into v_funnel;

  return v_funnel.id;
end;
$$;

create or replace function public.bind_source_entity_to_scope(
  p_workspace_id uuid,
  p_source_kind text,
  p_source_table text default null,
  p_source_id uuid default null,
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
  p_created_by uuid default null,
  p_created_by_email text default null,
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
  v_binding_id uuid;
  v_mapping_status text := coalesce(nullif(btrim(p_mapping_status), ''), 'confirmed');
begin
  v_actor_id := public.require_source_manager(p_workspace_id);

  if v_mapping_status not in ('confirmed', 'pending_review', 'rejected') then raise exception 'Invalid mapping status' using errcode = '22023'; end if;
  if p_client_id is not null and not exists (select 1 from public.clients where id = p_client_id and workspace_id = p_workspace_id and coalesce(status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Client not found or inactive in workspace' using errcode = '22023'; end if;
  if p_project_id is not null and not exists (select 1 from public.projects where id = p_project_id and workspace_id = p_workspace_id and (p_client_id is null or client_id = p_client_id) and coalesce(status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Project mismatch or inactive in workspace' using errcode = '22023'; end if;
  if p_funnel_id is not null and not exists (select 1 from public.funnels where id = p_funnel_id and workspace_id = p_workspace_id and (p_project_id is null or project_id = p_project_id) and (p_client_id is null or client_id = p_client_id) and coalesce(status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Funnel mismatch or inactive in workspace' using errcode = '22023'; end if;

  update public.source_entity_bindings
  set mapping_status = v_mapping_status, binding_method = coalesce(p_binding_method, binding_method), confidence = coalesce(p_confidence, confidence), is_primary = coalesce(p_is_primary, is_primary), notes = coalesce(nullif(btrim(p_notes), ''), notes), metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('updated_by', v_actor_id, 'updated_by_email', v_actor_email), updated_at = now()
  where workspace_id = p_workspace_id and source_kind = p_source_kind and source_id = p_source_id and client_id is not distinct from p_client_id and project_id is not distinct from p_project_id and funnel_id is not distinct from p_funnel_id and binding_status = 'active'
  returning id into v_binding_id;

  if v_binding_id is null then
    insert into public.source_entity_bindings (workspace_id, source_kind, source_table, source_id, source_external_id, source_name, client_id, project_id, funnel_id, mapping_status, binding_status, binding_method, confidence, is_primary, notes, created_by, created_by_email, metadata, created_at, updated_at)
    values (p_workspace_id, p_source_kind, p_source_table, p_source_id, p_source_external_id, p_source_name, p_client_id, p_project_id, p_funnel_id, v_mapping_status, 'active', coalesce(p_binding_method, 'manual'), coalesce(p_confidence, 1.0), coalesce(p_is_primary, false), p_notes, v_actor_id, v_actor_email, coalesce(p_metadata, '{}'::jsonb), now(), now())
    returning id into v_binding_id;
  end if;
  return v_binding_id;
end;
$$;

-- Remove unsafe PUBLIC/anon EXECUTE from every overload of sensitive mutation RPCs.
do $$
declare
  v_function oid;
begin
  for v_function in
    select p.oid
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('archive_binding', 'bind_source_entity_to_scope', 'update_binding_mapping_status', 'upsert_client', 'upsert_project', 'upsert_funnel', 'manage_ad_account_binding', 'bind_ad_account_to_scope')
  loop
    execute format('revoke execute on function %s from public, anon', v_function::regprocedure);
  end loop;
end $$;

revoke execute on function public.require_source_manager(uuid) from public, anon;
grant execute on function public.require_source_manager(uuid) to authenticated, service_role;
grant execute on function public.manage_ad_account_binding(uuid, uuid, uuid, uuid, uuid, text, boolean, text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.archive_binding(uuid, text, uuid, jsonb) to authenticated, service_role;
grant execute on function public.update_binding_mapping_status(uuid, text, uuid, text, text, uuid, text, text, jsonb) to authenticated, service_role;
grant execute on function public.upsert_client(uuid, text, text, text, text, text, text, text, text, text, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.upsert_project(uuid, uuid, text, text, text, text, text, text, text, text, text, text, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.upsert_funnel(uuid, uuid, text, text, text, text, text, text, text, text, timestamptz, timestamptz, text, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.bind_source_entity_to_scope(uuid, text, text, uuid, text, text, uuid, uuid, uuid, text, text, numeric, boolean, text, uuid, text, jsonb) to authenticated, service_role;

revoke execute on function public.bind_ad_account_to_scope(uuid, text, uuid, uuid, text, text, uuid, uuid, uuid, text, text, numeric, boolean, text, uuid, text, jsonb) from public, anon, authenticated;
grant execute on function public.bind_ad_account_to_scope(uuid, text, uuid, uuid, text, text, uuid, uuid, uuid, text, text, numeric, boolean, text, uuid, text, jsonb) to service_role;

-- Defensive fail-fast audit: no sensitive overload may remain executable by PUBLIC/anon.
do $$
begin
  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in ('archive_binding', 'bind_source_entity_to_scope', 'update_binding_mapping_status', 'upsert_client', 'upsert_project', 'upsert_funnel', 'manage_ad_account_binding', 'bind_ad_account_to_scope')
      and (has_function_privilege('public', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
  ) then
    raise exception 'Sensitive mutation RPC overload remains executable by PUBLIC or anon';
  end if;
end $$;

notify pgrst, 'reload schema';
commit;
