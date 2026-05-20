-- Task 19: Repair workspace_members RLS recursion without touching imported/demo data.
-- This migration only updates helper functions and RLS policies.

begin;

-- 1) Safe role rank helper (idempotent).
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

-- 2) Security definer helper that can read membership safely without RLS recursion.
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
  order by public.workspace_role_rank(wm.role) desc
  limit 1;

  return lower(v_role);
end;
$$;

revoke all on function public.get_current_user_workspace_role(uuid) from public;
grant execute on function public.get_current_user_workspace_role(uuid) to authenticated;

-- 3) Replace recursive policies for workspace_members only.
do $$
declare
  p record;
begin
  for p in
    select policyname
    from pg_policies
    where schemaname = 'public'
      and tablename = 'workspace_members'
      and (
        coalesce(qual, '') ilike '%workspace_members%'
        or coalesce(with_check, '') ilike '%workspace_members%'
      )
  loop
    execute format('drop policy if exists %I on public.workspace_members', p.policyname);
  end loop;
end $$;

-- Read policy: user can read own membership row OR admin/superadmin can read members in same workspace.
drop policy if exists workspace_members_select_access on public.workspace_members;
create policy workspace_members_select_access
on public.workspace_members
for select
to authenticated
using (
  user_id = auth.uid()
  or public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 2
);

-- Insert policy: only admin/superadmin in same workspace may add members.
drop policy if exists workspace_members_insert_admin on public.workspace_members;
create policy workspace_members_insert_admin
on public.workspace_members
for insert
to authenticated
with check (
  public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 2
);

-- Update policy: only admin/superadmin in same workspace may update members.
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

-- Delete policy: only superadmin in same workspace may delete members.
drop policy if exists workspace_members_delete_superadmin on public.workspace_members;
create policy workspace_members_delete_superadmin
on public.workspace_members
for delete
to authenticated
using (
  public.workspace_role_rank(public.get_current_user_workspace_role(workspace_id)) >= 3
);

alter table public.workspace_members enable row level security;

commit;
