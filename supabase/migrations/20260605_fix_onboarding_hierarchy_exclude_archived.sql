create or replace view public.v_onboarding_hierarchy as
select
  c.workspace_id,
  c.id as client_id,
  c.client_name,
  c.client_code,
  c.status as client_status,
  p.id as project_id,
  p.project_name,
  p.project_code,
  p.status as project_status,
  f.id as funnel_id,
  f.funnel_name,
  f.funnel_code,
  f.funnel_type,
  f.status as funnel_status,
  f.created_at as funnel_created_at
from public.clients c
left join public.projects p
  on p.client_id = c.id
  and p.status <> 'archived'
  and (
    p.workspace_id = c.workspace_id
    or p.workspace_id is null
  )
left join public.funnels f
  on f.project_id = p.id
  and f.status <> 'archived'
  and f.workspace_id = c.workspace_id
where c.status <> 'archived'
order by c.client_name, p.project_name, f.funnel_name;
