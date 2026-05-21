begin;

create or replace view public.v_unified_ads_performance_daily as
select
  atr.workspace_id,
  atr.day as metric_date,
  atr.campaign_name,
  sum(coalesce(atr.amount_spent, 0))::numeric as spend,
  sum(coalesce(atr.link_clicks, 0))::numeric as clicks,
  sum(coalesce(atr.leads, 0))::numeric as leads,
  sum(coalesce(atr.reach, 0))::numeric as reach,
  case
    when sum(coalesce(atr.link_clicks, 0)) = 0 then 0::numeric
    else sum(coalesce(atr.amount_spent, 0))::numeric / nullif(sum(coalesce(atr.link_clicks, 0))::numeric, 0)
  end as cpc,
  case
    when sum(coalesce(atr.leads, 0)) = 0 then 0::numeric
    else sum(coalesce(atr.amount_spent, 0))::numeric / nullif(sum(coalesce(atr.leads, 0))::numeric, 0)
  end as cpl,
  case
    when sum(coalesce(atr.link_clicks, 0)) = 0 then 0::numeric
    else (sum(coalesce(atr.leads, 0))::numeric / nullif(sum(coalesce(atr.link_clicks, 0))::numeric, 0)) * 100
  end as lead_rate_from_clicks,
  count(*)::bigint as source_rows_count,
  'ad_traffic_raw'::text as source_layer
from public.ad_traffic_raw atr
where public.workspace_role_rank(public.get_current_user_workspace_role(atr.workspace_id)) >= 1
  and coalesce(lower(atr.campaign_name), '') not like 'dev%'
  and coalesce(lower(atr.campaign_name), '') not like '%placeholder%'
group by atr.workspace_id, atr.day, atr.campaign_name;

alter view public.v_unified_ads_performance_daily set (security_invoker = false);
grant select on public.v_unified_ads_performance_daily to authenticated;

create or replace view public.v_unified_ads_performance_summary as
select
  d.workspace_id,
  d.campaign_name,
  min(d.metric_date) as first_date,
  max(d.metric_date) as last_date,
  sum(coalesce(d.spend, 0))::numeric as spend,
  sum(coalesce(d.clicks, 0))::numeric as clicks,
  sum(coalesce(d.leads, 0))::numeric as leads,
  sum(coalesce(d.reach, 0))::numeric as reach,
  case
    when sum(coalesce(d.clicks, 0)) = 0 then 0::numeric
    else sum(coalesce(d.spend, 0))::numeric / nullif(sum(coalesce(d.clicks, 0))::numeric, 0)
  end as cpc,
  case
    when sum(coalesce(d.leads, 0)) = 0 then 0::numeric
    else sum(coalesce(d.spend, 0))::numeric / nullif(sum(coalesce(d.leads, 0))::numeric, 0)
  end as cpl,
  case
    when sum(coalesce(d.clicks, 0)) = 0 then 0::numeric
    else (sum(coalesce(d.leads, 0))::numeric / nullif(sum(coalesce(d.clicks, 0))::numeric, 0)) * 100
  end as lead_rate_from_clicks,
  sum(coalesce(d.source_rows_count, 0))::bigint as source_rows_count,
  max(d.source_layer)::text as source_layer
from public.v_unified_ads_performance_daily d
group by d.workspace_id, d.campaign_name;

alter view public.v_unified_ads_performance_summary set (security_invoker = false);
grant select on public.v_unified_ads_performance_summary to authenticated;

create or replace view public.v_unified_sales_performance_daily as
select
  rs.workspace_id,
  rs.first_payment_date as sale_date,
  rs.campaign as campaign_name,
  count(*)::bigint as sales_count,
  sum(coalesce(rs.first_payment_usd, 0))::numeric as first_payment_usd,
  sum(coalesce(rs.first_payment_uah, 0))::numeric as first_payment_uah,
  sum(coalesce(rs.second_payment_usd, 0))::numeric as second_payment_usd,
  sum(coalesce(rs.second_payment_uah, 0))::numeric as second_payment_uah,
  (sum(coalesce(rs.first_payment_usd, 0)) + sum(coalesce(rs.second_payment_usd, 0)))::numeric as total_payment_usd,
  (sum(coalesce(rs.first_payment_uah, 0)) + sum(coalesce(rs.second_payment_uah, 0)))::numeric as total_payment_uah,
  'raw_sales'::text as source_layer
from public.raw_sales rs
where public.workspace_role_rank(public.get_current_user_workspace_role(rs.workspace_id)) >= 1
  and coalesce(lower(rs.campaign), '') not like 'dev%'
  and coalesce(lower(rs.campaign), '') not like '%placeholder%'
  and coalesce(lower(rs.customer_name), '') not like 'test%'
group by rs.workspace_id, rs.first_payment_date, rs.campaign;

alter view public.v_unified_sales_performance_daily set (security_invoker = false);
grant select on public.v_unified_sales_performance_daily to authenticated;

create or replace view public.v_unified_sales_performance_summary as
select
  d.workspace_id,
  d.campaign_name,
  min(d.sale_date) as first_date,
  max(d.sale_date) as last_date,
  sum(coalesce(d.sales_count, 0))::bigint as sales_count,
  sum(coalesce(d.first_payment_usd, 0))::numeric as first_payment_usd,
  sum(coalesce(d.first_payment_uah, 0))::numeric as first_payment_uah,
  sum(coalesce(d.second_payment_usd, 0))::numeric as second_payment_usd,
  sum(coalesce(d.second_payment_uah, 0))::numeric as second_payment_uah,
  sum(coalesce(d.total_payment_usd, 0))::numeric as total_payment_usd,
  sum(coalesce(d.total_payment_uah, 0))::numeric as total_payment_uah,
  max(d.source_layer)::text as source_layer
from public.v_unified_sales_performance_daily d
group by d.workspace_id, d.campaign_name;

alter view public.v_unified_sales_performance_summary set (security_invoker = false);
grant select on public.v_unified_sales_performance_summary to authenticated;

create or replace view public.v_unified_funnel_stage_summary as
select
  fe.workspace_id,
  fe.event_type as stage,
  case
    when fe.event_type = 'registration' then 'Реєстрації'
    when fe.event_type = 'questionnaire' then 'Анкети'
    when fe.event_type = 'application' then 'Заявки'
    when fe.event_type = 'booking' then 'Бронювання'
    else fe.event_type
  end as stage_label,
  count(*)::bigint as events_count,
  count(distinct fe.phone)::bigint as unique_contacts,
  min(fe.event_date) as first_date,
  max(fe.event_date) as last_date
from public.v_funnel_events fe
where public.workspace_role_rank(public.get_current_user_workspace_role(fe.workspace_id)) >= 1
  and coalesce(lower(fe.campaign), '') not like 'dev%'
  and coalesce(lower(fe.campaign), '') not like '%placeholder%'
group by fe.workspace_id, fe.event_type;

alter view public.v_unified_funnel_stage_summary set (security_invoker = false);
grant select on public.v_unified_funnel_stage_summary to authenticated;

create or replace view public.v_unified_funnel_conversion_summary as
with per_workspace as (
  select
    s.workspace_id,
    sum(case when s.stage = 'registration' then s.unique_contacts else 0 end)::numeric as registrations,
    sum(case when s.stage = 'questionnaire' then s.unique_contacts else 0 end)::numeric as questionnaires,
    sum(case when s.stage = 'application' then s.unique_contacts else 0 end)::numeric as applications,
    sum(case when s.stage = 'booking' then s.unique_contacts else 0 end)::numeric as bookings
  from public.v_unified_funnel_stage_summary s
  group by s.workspace_id
)
select
  p.workspace_id,
  p.registrations,
  p.questionnaires,
  p.applications,
  p.bookings,
  case when p.registrations = 0 then 0::numeric else (p.questionnaires / nullif(p.registrations, 0)) * 100 end as registration_to_questionnaire_pct,
  case when p.questionnaires = 0 then 0::numeric else (p.applications / nullif(p.questionnaires, 0)) * 100 end as questionnaire_to_application_pct,
  case when p.applications = 0 then 0::numeric else (p.bookings / nullif(p.applications, 0)) * 100 end as application_to_booking_pct,
  case when p.registrations = 0 then 0::numeric else (p.bookings / nullif(p.registrations, 0)) * 100 end as registration_to_booking_pct
from per_workspace p;

alter view public.v_unified_funnel_conversion_summary set (security_invoker = false);
grant select on public.v_unified_funnel_conversion_summary to authenticated;

commit;
