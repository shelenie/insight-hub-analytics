-- Phase 1 user-management/access hardening.
-- Adds an additive workspace_members lifecycle status, makes the central
-- workspace role helper active-membership-only, hardens direct membership RLS,
-- hardens known permission/member views, and protects the last active superadmin.

begin;

alter table public.workspace_members
  add column if not exists status text not null default 'active',
  add column if not exists updated_at timestamptz not null default now();

update public.workspace_members
set status = 'active'
where status is null;

alter table public.workspace_members
  drop constraint if exists workspace_members_status_check;

alter table public.workspace_members
  add constraint workspace_members_status_check
  check (status in ('active', 'inactive', 'removed'));

create index if not exists workspace_members_active_lookup_idx
  on public.workspace_members (workspace_id, user_id)
  where status = 'active';

create or replace function public.set_workspace_members_updated_at()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_workspace_members_updated_at on public.workspace_members;
create trigger set_workspace_members_updated_at
before update on public.workspace_members
for each row
execute function public.set_workspace_members_updated_at();

create or replace function public.workspace_role_rank(p_role text)
returns integer
language sql
immutable
as $$
  select case lower(coalesce(p_role, ''))
    when 'superadmin' then 3
    when 'admin' then 2
    when 'member' then 1
    else 0
  end;
$$;

create or replace function public.get_current_user_workspace_role(p_workspace_id uuid)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_role text;
begin
  if auth.uid() is null or p_workspace_id is null then
    return null;
  end if;

  select wm.role
    into v_role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = auth.uid()
    and wm.status = 'active'
  order by public.workspace_role_rank(wm.role) desc
  limit 1;

  return lower(v_role);
end;
$$;

revoke all on function public.get_current_user_workspace_role(uuid) from public;
grant execute on function public.get_current_user_workspace_role(uuid) to authenticated;

create or replace function public.get_workspace_role(
  p_workspace_id uuid,
  p_user_id uuid default auth.uid()
)
returns text
language plpgsql
security definer
stable
set search_path = public
as $$
declare
  v_role text;
begin
  if p_workspace_id is null or p_user_id is null then
    return null;
  end if;

  select wm.role
    into v_role
  from public.workspace_members wm
  where wm.workspace_id = p_workspace_id
    and wm.user_id = p_user_id
    and wm.status = 'active'
  order by public.workspace_role_rank(wm.role) desc
  limit 1;

  return lower(v_role);
end;
$$;

revoke all on function public.get_workspace_role(uuid, uuid) from public;
grant execute on function public.get_workspace_role(uuid, uuid) to authenticated;

-- Preserve and harden a separate one-argument overload only if the remote schema already has it.
do $$
begin
  if to_regprocedure('public.get_workspace_role(uuid)') is not null then
    execute $function$
      create or replace function public.get_workspace_role(p_workspace_id uuid)
      returns text
      language sql
      security definer
      stable
      set search_path = public
      as $sql$
        select public.get_workspace_role(p_workspace_id, auth.uid())
      $sql$;
    $function$;

    execute 'revoke all on function public.get_workspace_role(uuid) from public';
    execute 'grant execute on function public.get_workspace_role(uuid) to authenticated';
  end if;
end $$;

create or replace function public.is_workspace_member(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role_rank(public.get_workspace_role(p_workspace_id, auth.uid())) >= 1;
$$;

create or replace function public.is_workspace_member(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role_rank(public.get_workspace_role(p_workspace_id, p_user_id)) >= 1;
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role_rank(public.get_workspace_role(p_workspace_id, auth.uid())) >= 2;
$$;

create or replace function public.is_workspace_admin(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role_rank(public.get_workspace_role(p_workspace_id, p_user_id)) >= 2;
$$;

create or replace function public.is_workspace_admin_or_superadmin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role_rank(public.get_workspace_role(p_workspace_id, auth.uid())) >= 2;
$$;

create or replace function public.is_workspace_superadmin(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role_rank(public.get_workspace_role(p_workspace_id, auth.uid())) >= 3;
$$;

create or replace function public.is_workspace_superadmin(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role_rank(public.get_workspace_role(p_workspace_id, p_user_id)) >= 3;
$$;

create or replace function public.can_view_workspace_data(p_workspace_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role_rank(public.get_workspace_role(p_workspace_id, auth.uid())) >= 1;
$$;

create or replace function public.can_view_workspace_data(p_workspace_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select public.workspace_role_rank(public.get_workspace_role(p_workspace_id, p_user_id)) >= 1;
$$;

revoke all on function public.is_workspace_member(uuid) from public;
revoke all on function public.is_workspace_member(uuid, uuid) from public;
revoke all on function public.is_workspace_admin(uuid) from public;
revoke all on function public.is_workspace_admin(uuid, uuid) from public;
revoke all on function public.is_workspace_admin_or_superadmin(uuid) from public;
revoke all on function public.is_workspace_superadmin(uuid) from public;
revoke all on function public.is_workspace_superadmin(uuid, uuid) from public;
revoke all on function public.can_view_workspace_data(uuid) from public;
revoke all on function public.can_view_workspace_data(uuid, uuid) from public;
grant execute on function public.is_workspace_member(uuid) to authenticated;
grant execute on function public.is_workspace_member(uuid, uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid) to authenticated;
grant execute on function public.is_workspace_admin(uuid, uuid) to authenticated;
grant execute on function public.is_workspace_admin_or_superadmin(uuid) to authenticated;
grant execute on function public.is_workspace_superadmin(uuid) to authenticated;
grant execute on function public.is_workspace_superadmin(uuid, uuid) to authenticated;
grant execute on function public.can_view_workspace_data(uuid) to authenticated;
grant execute on function public.can_view_workspace_data(uuid, uuid) to authenticated;

-- Recreate workspace_members policies so every admin check depends on an active membership.
drop policy if exists workspace_members_select_access on public.workspace_members;
create policy workspace_members_select_access
on public.workspace_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 2
);

drop policy if exists workspace_members_insert_admin on public.workspace_members;
create policy workspace_members_insert_admin
on public.workspace_members
for insert
to authenticated
with check (
  status = 'active'
  and (
    (
      lower(role) in ('member', 'admin')
      and public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 2
    )
    or (
      lower(role) = 'superadmin'
      and public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 3
    )
  )
);

drop policy if exists workspace_members_update_admin on public.workspace_members;
create policy workspace_members_update_admin
on public.workspace_members
for update
to authenticated
using (
  public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 2
)
with check (
  public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 2
);

drop policy if exists workspace_members_delete_superadmin on public.workspace_members;
create policy workspace_members_delete_superadmin
on public.workspace_members
for delete
to authenticated
using (
  public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 3
);

alter table public.workspace_members enable row level security;

create or replace function public.enforce_workspace_member_management_rules()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_actor_old_rank integer;
  v_actor_new_rank integer;
  v_new_role text;
  v_old_role text;
begin
  -- Allow service-role/maintenance contexts without an end-user JWT; RLS still
  -- governs authenticated client access and service_role bypasses RLS by design.
  if auth.uid() is null then
    return new;
  end if;

  v_new_role := lower(coalesce(new.role, ''));

  if tg_op = 'INSERT' then
    v_actor_new_rank := public.workspace_role_rank(public.get_current_user_workspace_role(new.workspace_id));

    if v_new_role in ('member', 'admin') and v_actor_new_rank >= 2 then
      return new;
    end if;

    if v_new_role = 'superadmin' and v_actor_new_rank >= 3 then
      return new;
    end if;

    raise exception 'Insufficient workspace role to insert workspace membership with role %', new.role;
  end if;

  v_old_role := lower(coalesce(old.role, ''));

  if old.user_id is distinct from new.user_id
     or old.workspace_id is distinct from new.workspace_id
     or v_old_role is distinct from v_new_role
     or v_old_role = 'superadmin'
     or v_new_role = 'superadmin' then
    v_actor_old_rank := public.workspace_role_rank(public.get_current_user_workspace_role(old.workspace_id));
    v_actor_new_rank := public.workspace_role_rank(public.get_current_user_workspace_role(new.workspace_id));

    if v_actor_old_rank < 3 or v_actor_new_rank < 3 then
      raise exception 'Only an active superadmin can change membership identity, workspace, role, or superadmin status';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists enforce_workspace_member_management_rules on public.workspace_members;
create trigger enforce_workspace_member_management_rules
before insert or update on public.workspace_members
for each row
execute function public.enforce_workspace_member_management_rules();

create or replace function public.prevent_last_active_superadmin_change()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_remaining integer;
begin
  if tg_op = 'DELETE' then
    if old.role = 'superadmin' and old.status = 'active' then
      select count(*)
        into v_remaining
      from public.workspace_members wm
      where wm.workspace_id = old.workspace_id
        and wm.role = 'superadmin'
        and wm.status = 'active'
        and wm.id <> old.id;

      if v_remaining = 0 then
        raise exception 'Cannot delete the last active superadmin membership';
      end if;
    end if;

    return old;
  end if;

  if old.role = 'superadmin'
     and old.status = 'active'
     and (new.role <> 'superadmin' or new.status <> 'active' or new.workspace_id <> old.workspace_id) then
    select count(*)
      into v_remaining
    from public.workspace_members wm
    where wm.workspace_id = old.workspace_id
      and wm.role = 'superadmin'
      and wm.status = 'active'
      and wm.id <> old.id;

    if v_remaining = 0 then
      raise exception 'Cannot demote, deactivate, remove, or move the last active superadmin membership';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists prevent_last_active_superadmin_change on public.workspace_members;
create trigger prevent_last_active_superadmin_change
before update or delete on public.workspace_members
for each row
execute function public.prevent_last_active_superadmin_change();

-- Recreate the known current-user permissions view explicitly so inactive/removed
-- memberships cannot appear through the user's own workspace_members SELECT policy.
create or replace view public.v_current_user_permissions as
select
  wm.workspace_id,
  w.name as workspace_name,
  lower(wm.role) as role,
  true as can_view_dashboard,
  true as can_view_sales,
  true as can_view_campaigns,
  true as can_view_imports,
  lower(wm.role) in ('admin', 'superadmin') as can_upload_files,
  lower(wm.role) in ('admin', 'superadmin') as can_manage_imports,
  lower(wm.role) in ('admin', 'superadmin') as can_manage_mappings,
  true as can_request_data_corrections,
  lower(wm.role) in ('admin', 'superadmin') as can_approve_data_corrections,
  lower(wm.role) in ('admin', 'superadmin') as can_edit_data_without_approval,
  lower(wm.role) = 'superadmin' as can_manage_users,
  lower(wm.role) = 'superadmin' as can_manage_roles,
  lower(wm.role) = 'superadmin' as can_manage_source_connections,
  lower(wm.role) = 'superadmin' as can_run_rebuild_facts,
  lower(wm.role) = 'superadmin' as can_backup_restore,
  lower(wm.role) = 'superadmin' as can_access_dev_tools,
  lower(wm.role) = 'superadmin' as can_run_sql_tools
from public.workspace_members wm
join public.workspaces w on w.id = wm.workspace_id
where wm.user_id = auth.uid()
  and wm.status = 'active';

alter view public.v_current_user_permissions set (security_invoker = true);

-- Harden the admin/member listing view when present.
do $$
begin
  if to_regclass('public.v_workspace_members_with_permissions') is not null then
    execute 'alter view public.v_workspace_members_with_permissions set (security_invoker = true)';
    execute 'revoke all on public.v_workspace_members_with_permissions from anon, authenticated';
  end if;
end $$;

commit;
