-- Align repository migrations with the production hotfix named
-- allow_general_ai_helper_requests.
--
-- Production already received this constraint correction manually. This
-- migration is intentionally metadata-only: it updates CHECK constraints on
-- ai_helper_requests so future environments accept General Assistant requests
-- without touching rows, RLS, grants, or permissions.

alter table if exists public.ai_helper_requests
  drop constraint if exists ai_helper_requests_request_type_check;

alter table if exists public.ai_helper_requests
  drop constraint if exists ai_helper_requests_context_scope_check;

alter table if exists public.ai_helper_requests
  add constraint ai_helper_requests_request_type_check
  check (
    request_type in (
      'general_assistant',
      'data_quality_summary',
      'import_error_explanation',
      'import_health_summary',
      'ads_performance_summary',
      'ads_anomaly_explanation',
      'ads_health_summary',
      'production_readiness_summary',
      'onboarding_summary',
      'mapping_review_summary',
      'operational_alerts_summary',
      'full_production_summary'
    )
  );

alter table if exists public.ai_helper_requests
  add constraint ai_helper_requests_context_scope_check
  check (
    context_scope in (
      'general',
      'import_health',
      'import_errors',
      'data_quality',
      'ads_performance',
      'ads_anomalies',
      'ads_health',
      'production_readiness',
      'onboarding',
      'mapping_review',
      'operational_alerts',
      'full_production'
    )
  );
