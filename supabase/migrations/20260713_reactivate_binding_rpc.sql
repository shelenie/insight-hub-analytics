-- Restore archived Data Binding rows without inserting duplicates.
-- Safe to run in production via migration tooling; does not mutate existing rows at apply time.

create or replace function public.reactivate_binding(
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
  v_now timestamptz := now();
  v_source public.source_entity_bindings%rowtype;
  v_ad public.ad_account_bindings%rowtype;
  v_has_primary boolean := false;
begin
  v_actor_id := public.require_source_manager(p_workspace_id);

  if p_binding_type not in ('source', 'ad_account') then
    raise exception 'Unsupported binding type' using errcode = '22023';
  end if;

  if p_binding_type = 'source' then
    select * into v_source
    from public.source_entity_bindings
    where id = p_binding_id and workspace_id = p_workspace_id
    for update;

    if not found then return false; end if;
    if coalesce(v_source.binding_status::text, 'active') <> 'archived' then
      raise exception 'Only archived source bindings can be restored' using errcode = '22023';
    end if;

    if not exists (select 1 from public.clients c where c.id = v_source.client_id and c.workspace_id = p_workspace_id and coalesce(c.status::text, 'active') not in ('archived','inactive','removed','deleted')) then
      raise exception 'Cannot restore: Client is archived or inactive' using errcode = '22023';
    end if;
    if not exists (select 1 from public.projects p where p.id = v_source.project_id and p.workspace_id = p_workspace_id and p.client_id = v_source.client_id and coalesce(p.status::text, 'active') not in ('archived','inactive','removed','deleted')) then
      raise exception 'Cannot restore: Project is archived, inactive, or no longer belongs to Client' using errcode = '22023';
    end if;
    if not exists (select 1 from public.funnels f where f.id = v_source.funnel_id and f.workspace_id = p_workspace_id and f.project_id = v_source.project_id and f.client_id = v_source.client_id and coalesce(f.status::text, 'active') not in ('archived','inactive','removed','deleted')) then
      raise exception 'Cannot restore: Funnel is archived, inactive, or no longer belongs to Project/Client' using errcode = '22023';
    end if;

    if v_source.source_kind = 'google_sheet_source' and not exists (select 1 from public.google_sheet_sources s where s.id = v_source.source_id and s.workspace_id = p_workspace_id and coalesce(s.status::text, 'active') not in ('archived','inactive','removed','deleted')) then
      raise exception 'Cannot restore: source is archived or inactive' using errcode = '22023';
    elsif v_source.source_kind = 'google_sheet_tab' and not exists (select 1 from public.google_sheet_tabs t join public.google_sheet_sources s on s.id = t.sheet_source_id and s.workspace_id = t.workspace_id where t.id = v_source.source_id and t.workspace_id = p_workspace_id and coalesce(t.status::text, 'active') not in ('archived','inactive','removed','deleted') and coalesce(s.status::text, 'active') not in ('archived','inactive','removed','deleted')) then
      raise exception 'Cannot restore: sheet tab or parent sheet is archived or inactive' using errcode = '22023';
    elsif v_source.source_kind = 'file_dataset' and not exists (select 1 from public.raw_external_datasets d where d.id = v_source.source_id and d.workspace_id = p_workspace_id and coalesce(d.status::text, 'active') not in ('archived','inactive','removed','deleted')) then
      raise exception 'Cannot restore: dataset is archived or inactive' using errcode = '22023';
    end if;

    if exists (
      select 1 from public.source_entity_bindings b
      where b.id <> v_source.id and b.workspace_id = p_workspace_id and b.source_kind = v_source.source_kind and b.source_id is not distinct from v_source.source_id
        and b.client_id is not distinct from v_source.client_id and b.project_id is not distinct from v_source.project_id and b.funnel_id is not distinct from v_source.funnel_id
        and coalesce(b.binding_status::text, 'active') = 'active'
    ) then
      raise exception 'Cannot restore: an active duplicate binding already exists' using errcode = '23505';
    end if;

    select exists (
      select 1 from public.source_entity_bindings b
      where b.id <> v_source.id and b.workspace_id = p_workspace_id and b.client_id is not distinct from v_source.client_id and b.project_id is not distinct from v_source.project_id and b.funnel_id is not distinct from v_source.funnel_id
        and coalesce(b.binding_status::text, 'active') = 'active' and coalesce(b.is_primary, false)
    ) into v_has_primary;

    update public.source_entity_bindings
    set binding_status = 'active',
        is_primary = case when v_has_primary then false else coalesce(is_primary, false) end,
        updated_at = v_now,
        metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('reactivated_from_archive', true, 'reactivated_by', v_actor_id, 'reactivated_by_email', v_actor_email, 'reactivated_at', v_now)
    where id = p_binding_id and workspace_id = p_workspace_id;
    return true;
  end if;

  select * into v_ad
  from public.ad_account_bindings
  where id = p_binding_id and workspace_id = p_workspace_id
  for update;

  if not found then return false; end if;
  if coalesce(v_ad.binding_status::text, 'active') <> 'archived' then
    raise exception 'Only archived ad account bindings can be restored' using errcode = '22023';
  end if;

  if not exists (select 1 from public.clients c where c.id = v_ad.client_id and c.workspace_id = p_workspace_id and coalesce(c.status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Cannot restore: Client is archived or inactive' using errcode = '22023'; end if;
  if not exists (select 1 from public.projects p where p.id = v_ad.project_id and p.workspace_id = p_workspace_id and p.client_id = v_ad.client_id and coalesce(p.status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Cannot restore: Project is archived, inactive, or no longer belongs to Client' using errcode = '22023'; end if;
  if not exists (select 1 from public.funnels f where f.id = v_ad.funnel_id and f.workspace_id = p_workspace_id and f.project_id = v_ad.project_id and f.client_id = v_ad.client_id and coalesce(f.status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Cannot restore: Funnel is archived, inactive, or no longer belongs to Project/Client' using errcode = '22023'; end if;
  if not exists (select 1 from public.ad_accounts a where a.id = v_ad.ad_account_id and a.workspace_id = p_workspace_id and coalesce(a.status::text, 'active') not in ('archived','inactive','removed','deleted')) then raise exception 'Cannot restore: ad account is archived or inactive' using errcode = '22023'; end if;

  if exists (select 1 from public.ad_account_bindings b where b.id <> v_ad.id and b.workspace_id = p_workspace_id and b.ad_account_id = v_ad.ad_account_id and b.client_id is not distinct from v_ad.client_id and b.project_id is not distinct from v_ad.project_id and b.funnel_id is not distinct from v_ad.funnel_id and coalesce(b.binding_status::text, 'active') = 'active') then
    raise exception 'Cannot restore: an active duplicate binding already exists' using errcode = '23505';
  end if;

  select exists (select 1 from public.ad_account_bindings b where b.id <> v_ad.id and b.workspace_id = p_workspace_id and b.client_id is not distinct from v_ad.client_id and b.project_id is not distinct from v_ad.project_id and b.funnel_id is not distinct from v_ad.funnel_id and coalesce(b.binding_status::text, 'active') = 'active' and coalesce(b.is_primary, false)) into v_has_primary;

  update public.ad_account_bindings
  set binding_status = 'active',
      is_primary = case when v_has_primary then false else coalesce(is_primary, false) end,
      updated_at = v_now,
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('reactivated_from_archive', true, 'reactivated_by', v_actor_id, 'reactivated_by_email', v_actor_email, 'reactivated_at', v_now)
  where id = p_binding_id and workspace_id = p_workspace_id;
  return true;
end;
$$;

revoke all on function public.reactivate_binding(uuid, text, uuid, jsonb) from public;
revoke all on function public.reactivate_binding(uuid, text, uuid, jsonb) from anon;
grant execute on function public.reactivate_binding(uuid, text, uuid, jsonb) to authenticated, service_role;
