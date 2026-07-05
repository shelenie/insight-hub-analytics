-- Make manual ad account binding idempotent for repeated submissions of the same active target.
--
-- Production context:
-- - ad_account_bindings.binding_status allows active, paused, archived.
-- - Do not use inactive.
-- - This migration is additive/reversible and does not delete or archive production data.
-- - If duplicate active rows already exist for the natural active-binding key, the migration
--   fails before replacing the function or adding the unique guard so an operator can archive duplicates explicitly.
-- - The function is dropped without CASCADE before CREATE FUNCTION so environments with older
--   parameter defaults do not hit PostgreSQL parameter-default replacement errors.

do $$
begin
  if exists (
    select 1
    from public.ad_account_bindings
    where binding_status = 'active'
    group by workspace_id, ad_account_id, client_id, project_id, funnel_id
    having count(*) > 1
  ) then
    raise exception 'Duplicate active ad_account_bindings exist. Archive duplicate active rows before applying unique guard.';
  end if;
end $$;

drop function if exists public.bind_ad_account_to_scope(
  uuid,
  text,
  uuid,
  uuid,
  text,
  text,
  uuid,
  uuid,
  uuid,
  text,
  text,
  numeric,
  boolean,
  text,
  uuid,
  text,
  jsonb
);

create function public.bind_ad_account_to_scope(
  p_workspace_id uuid,
  p_platform text,
  p_ad_platform_connection_id uuid,
  p_ad_account_id uuid,
  p_external_account_id text,
  p_external_account_name text,
  p_client_id uuid default null,
  p_project_id uuid default null,
  p_funnel_id uuid default null,
  p_mapping_status text default 'confirmed',
  p_binding_method text default 'manual',
  p_confidence numeric default 1.0,
  p_is_primary boolean default null,
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
  v_binding_id uuid;
begin
  update public.ad_account_bindings
  set
    platform = p_platform,
    ad_platform_connection_id = p_ad_platform_connection_id,
    external_account_id = p_external_account_id,
    external_account_name = p_external_account_name,
    mapping_status = coalesce(p_mapping_status, mapping_status),
    binding_method = coalesce(p_binding_method, binding_method),
    confidence = coalesce(p_confidence, confidence),
    is_primary = coalesce(p_is_primary, is_primary),
    notes = coalesce(nullif(btrim(p_notes), ''), notes),
    metadata = case
      when p_metadata is not null and p_metadata <> '{}'::jsonb then p_metadata
      else metadata
    end,
    updated_at = now()
  where workspace_id = p_workspace_id
    and ad_account_id = p_ad_account_id
    and client_id is not distinct from p_client_id
    and project_id is not distinct from p_project_id
    and funnel_id is not distinct from p_funnel_id
    and binding_status = 'active'
  returning id into v_binding_id;

  if v_binding_id is not null then
    return v_binding_id;
  end if;

  insert into public.ad_account_bindings (
    workspace_id,
    platform,
    ad_platform_connection_id,
    ad_account_id,
    external_account_id,
    external_account_name,
    client_id,
    project_id,
    funnel_id,
    mapping_status,
    binding_status,
    binding_method,
    confidence,
    is_primary,
    notes,
    created_by,
    created_by_email,
    metadata,
    created_at,
    updated_at
  ) values (
    p_workspace_id,
    p_platform,
    p_ad_platform_connection_id,
    p_ad_account_id,
    p_external_account_id,
    p_external_account_name,
    p_client_id,
    p_project_id,
    p_funnel_id,
    coalesce(p_mapping_status, 'confirmed'),
    'active',
    coalesce(p_binding_method, 'manual'),
    coalesce(p_confidence, 1.0),
    coalesce(p_is_primary, false),
    p_notes,
    p_created_by,
    p_created_by_email,
    coalesce(p_metadata, '{}'::jsonb),
    now(),
    now()
  )
  returning id into v_binding_id;

  return v_binding_id;
end;
$$;

create unique index if not exists ad_account_bindings_one_active_per_scope_uidx
  on public.ad_account_bindings (workspace_id, ad_account_id, client_id, project_id, funnel_id) nulls not distinct
  where binding_status = 'active';


revoke execute on function public.bind_ad_account_to_scope(
  uuid, text, uuid, uuid, text, text, uuid, uuid, uuid, text, text, numeric, boolean, text, uuid, text, jsonb
) from public, anon, authenticated;

grant execute on function public.bind_ad_account_to_scope(
  uuid, text, uuid, uuid, text, text, uuid, uuid, uuid, text, text, numeric, boolean, text, uuid, text, jsonb
) to service_role;

notify pgrst, 'reload schema';
