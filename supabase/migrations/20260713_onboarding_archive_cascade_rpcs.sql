-- Safe, idempotent onboarding archive cascades for production QA.

create or replace function public.archive_onboarding_client_cascade(
  p_workspace_id uuid,
  p_client_id uuid,
  p_status text default 'archived',
  p_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid;
  v_actor_email text;
  v_status text := coalesce(nullif(btrim(p_status), ''), 'archived');
  v_projects integer := 0;
  v_funnels integer := 0;
  v_ad_bindings integer := 0;
  v_source_bindings integer := 0;
begin
  if v_status not in ('archived','inactive','removed','deleted','disabled') then
    raise exception 'Archive cascade requires an inactive status' using errcode = '22023';
  end if;

  v_actor_id := public.require_source_manager(p_workspace_id);
  v_actor_email := nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), '');

  if not exists (select 1 from public.clients where id = p_client_id and workspace_id = p_workspace_id) then
    raise exception 'Client not found in workspace' using errcode = 'P0002';
  end if;

  update public.clients
  set status = v_status,
      metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'client'),
      updated_at = now()
  where id = p_client_id and workspace_id = p_workspace_id;

  update public.projects
  set status = v_status,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'client'),
      updated_at = now()
  where workspace_id = p_workspace_id and client_id = p_client_id and coalesce(status::text, 'active') not in ('archived','inactive','removed','deleted','disabled');
  get diagnostics v_projects = row_count;

  update public.funnels
  set status = v_status,
      metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'client'),
      updated_at = now()
  where workspace_id = p_workspace_id and client_id = p_client_id and coalesce(status::text, 'active') not in ('archived','inactive','removed','deleted','disabled');
  get diagnostics v_funnels = row_count;

  update public.ad_account_bindings
  set binding_status = 'archived', metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'client'), updated_at = now()
  where workspace_id = p_workspace_id and client_id = p_client_id and coalesce(binding_status::text, 'active') = 'active';
  get diagnostics v_ad_bindings = row_count;

  update public.source_entity_bindings
  set binding_status = 'archived', metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'client'), updated_at = now()
  where workspace_id = p_workspace_id and client_id = p_client_id and coalesce(binding_status::text, 'active') = 'active';
  get diagnostics v_source_bindings = row_count;

  return jsonb_build_object('client_id', p_client_id, 'status', v_status, 'projects_archived', v_projects, 'funnels_archived', v_funnels, 'ad_bindings_archived', v_ad_bindings, 'source_bindings_archived', v_source_bindings);
end;
$$;

create or replace function public.archive_onboarding_project_cascade(p_workspace_id uuid, p_project_id uuid, p_status text default 'archived', p_metadata jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid; v_actor_email text; v_status text := coalesce(nullif(btrim(p_status), ''), 'archived'); v_project public.projects%rowtype; v_funnels integer := 0; v_ad_bindings integer := 0; v_source_bindings integer := 0;
begin
  if v_status not in ('archived','inactive','removed','deleted','disabled') then raise exception 'Archive cascade requires an inactive status' using errcode = '22023'; end if;
  v_actor_id := public.require_source_manager(p_workspace_id); v_actor_email := nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), '');
  select * into v_project from public.projects where id = p_project_id and workspace_id = p_workspace_id;
  if not found then raise exception 'Project not found in workspace' using errcode = 'P0002'; end if;
  update public.projects set status = v_status, metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'project'), updated_at = now() where id = p_project_id and workspace_id = p_workspace_id;
  update public.funnels set status = v_status, metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'project'), updated_at = now() where workspace_id = p_workspace_id and project_id = p_project_id and coalesce(status::text, 'active') not in ('archived','inactive','removed','deleted','disabled'); get diagnostics v_funnels = row_count;
  update public.ad_account_bindings set binding_status = 'archived', metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'project'), updated_at = now() where workspace_id = p_workspace_id and project_id = p_project_id and coalesce(binding_status::text, 'active') = 'active'; get diagnostics v_ad_bindings = row_count;
  update public.source_entity_bindings set binding_status = 'archived', metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'project'), updated_at = now() where workspace_id = p_workspace_id and project_id = p_project_id and coalesce(binding_status::text, 'active') = 'active'; get diagnostics v_source_bindings = row_count;
  return jsonb_build_object('project_id', p_project_id, 'client_id', v_project.client_id, 'status', v_status, 'funnels_archived', v_funnels, 'ad_bindings_archived', v_ad_bindings, 'source_bindings_archived', v_source_bindings);
end;
$$;

create or replace function public.archive_onboarding_funnel_cascade(p_workspace_id uuid, p_funnel_id uuid, p_status text default 'archived', p_metadata jsonb default '{}'::jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_id uuid; v_actor_email text; v_status text := coalesce(nullif(btrim(p_status), ''), 'archived'); v_funnel public.funnels%rowtype; v_ad_bindings integer := 0; v_source_bindings integer := 0;
begin
  if v_status not in ('archived','inactive','removed','deleted','disabled') then raise exception 'Archive cascade requires an inactive status' using errcode = '22023'; end if;
  v_actor_id := public.require_source_manager(p_workspace_id); v_actor_email := nullif(coalesce(auth.jwt() ->> 'email', auth.jwt() -> 'user_metadata' ->> 'email'), '');
  select * into v_funnel from public.funnels where id = p_funnel_id and workspace_id = p_workspace_id;
  if not found then raise exception 'Funnel not found in workspace' using errcode = 'P0002'; end if;
  update public.funnels set status = v_status, metadata = coalesce(metadata, '{}'::jsonb) || coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'funnel'), updated_at = now() where id = p_funnel_id and workspace_id = p_workspace_id;
  update public.ad_account_bindings set binding_status = 'archived', metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'funnel'), updated_at = now() where workspace_id = p_workspace_id and funnel_id = p_funnel_id and coalesce(binding_status::text, 'active') = 'active'; get diagnostics v_ad_bindings = row_count;
  update public.source_entity_bindings set binding_status = 'archived', metadata = coalesce(metadata, '{}'::jsonb) || jsonb_build_object('archived_by', v_actor_id, 'archived_by_email', v_actor_email, 'archive_cascade', 'funnel'), updated_at = now() where workspace_id = p_workspace_id and funnel_id = p_funnel_id and coalesce(binding_status::text, 'active') = 'active'; get diagnostics v_source_bindings = row_count;
  return jsonb_build_object('funnel_id', p_funnel_id, 'project_id', v_funnel.project_id, 'client_id', v_funnel.client_id, 'status', v_status, 'ad_bindings_archived', v_ad_bindings, 'source_bindings_archived', v_source_bindings);
end;
$$;

revoke all on function public.archive_onboarding_client_cascade(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.archive_onboarding_project_cascade(uuid, uuid, text, jsonb) from public, anon;
revoke all on function public.archive_onboarding_funnel_cascade(uuid, uuid, text, jsonb) from public, anon;
grant execute on function public.archive_onboarding_client_cascade(uuid, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.archive_onboarding_project_cascade(uuid, uuid, text, jsonb) to authenticated, service_role;
grant execute on function public.archive_onboarding_funnel_cascade(uuid, uuid, text, jsonb) to authenticated, service_role;
