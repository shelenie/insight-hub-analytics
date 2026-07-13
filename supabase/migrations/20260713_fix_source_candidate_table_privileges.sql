-- Fix frontend source-candidate loading for authenticated binding managers.
-- RLS remains enabled and policy predicates are unchanged; this migration only
-- corrects direct table privileges required for PostgREST SELECT calls.

REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.google_sheet_sources FROM authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.google_sheet_tabs FROM authenticated;
REVOKE MAINTAIN, REFERENCES, TRIGGER, TRUNCATE ON TABLE public.raw_external_datasets FROM authenticated;

GRANT SELECT ON TABLE public.google_sheet_sources TO authenticated;
GRANT SELECT ON TABLE public.google_sheet_tabs TO authenticated;
GRANT SELECT ON TABLE public.raw_external_datasets TO authenticated;
