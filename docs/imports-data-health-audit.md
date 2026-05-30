# Imports / Data Health Audit

## 1. Current page summary

The current Imports / Data Health page is implemented as a simple operational readout, not yet as a production operations dashboard. The live UI currently has four basic cards:

- **Import status** / **Стан імпортів**
- **Import errors** / **Помилки імпортів**
- **Mapping status** / **Стан мапінгу**
- **Recent alerts** / **Останні сповіщення**

Today the page mostly renders generic table wrappers over several Supabase views and falls back to empty messages when those views return no rows. It does not summarize overall health, does not group issues by severity, and does not provide guided remediation links.

Current visible behavior:

- Page title/subtitle come from shared i18n keys: `importsTitle` and `importsSubtitle`.
- Four visible cards render fixed Ukrainian section titles/descriptions.
- The cards show up to 100 rows for a fixed list of raw column names.
- The page has a sign-in message, a loading message, generic empty states, and a single generic “imports data temporarily unavailable” message when key reads are unavailable.
- There is no top KPI/health summary, no explicit refresh button, no shared date filter, no freshness pill, and no action links to related setup pages.

## 2. Files inspected

Application/page files:

- `src/pages/Imports.tsx`
- `src/App.tsx`
- `src/pages/Overview.tsx`
- `src/pages/Bindings.tsx`
- `src/pages/Alerts.tsx`
- `src/pages/AdsConnectors.tsx`
- `src/pages/Assistant.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/Campaigns.tsx`
- `src/pages/Conversions.tsx`
- `src/pages/Sales.tsx`

Shared dashboard/layout files:

- `src/components/layout/DashboardLayout.tsx`
- `src/components/layout/AppSidebar.tsx`
- `src/components/dashboard/SectionCard.tsx`
- `src/components/dashboard/EmptyState.tsx`
- `src/components/dashboard/DateFilter.tsx`
- `src/components/dashboard/FilterBar.tsx`
- `src/components/dashboard/KpiCard.tsx`
- `src/components/dashboard/StatusBadge.tsx`
- `src/components/dashboard/CompareControl.tsx`
- `src/components/dashboard/SavedViewsMenu.tsx`

Data/auth/integration files:

- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`
- `src/auth/AuthProvider.tsx`
- `src/auth/ProtectedRoute.tsx`
- `src/hooks/useWorkspaceRole.ts`
- `src/data/mock.ts`

I18n/filter/preference files:

- `src/i18n/I18nProvider.tsx`
- `src/i18n/translations.ts`
- `src/filters/DateContext.tsx`
- `src/preferences/PreferencesProvider.tsx`
- `src/preferences/SavedViewsProvider.tsx`

Backend/function/migration inventory reviewed for references only; no backend files were changed:

- `supabase/functions/mapping-review-approve/index.ts`
- `supabase/functions/mapping-review-reject/index.ts`
- `supabase/functions/mapping-review-send-telegram/index.ts`
- `supabase/functions/operational-alert-resolve/index.ts`
- `supabase/functions/telegram-outbox-retry/index.ts`
- `supabase/functions/binding-create-or-update/index.ts`
- `supabase/functions/binding-archive/index.ts`
- `supabase/functions/workspace-role-info/index.ts`
- `supabase/functions/onboarding-client-upsert/index.ts`
- `supabase/functions/onboarding-project-upsert/index.ts`
- `supabase/functions/onboarding-funnel-upsert/index.ts`
- `supabase/migrations/20260520_task19_fix_workspace_members_rls_recursion.sql`
- `supabase/migrations/20260521_add_unified_reporting_views.sql`
- `supabase/migrations/20260521_add_placement_performance_layer.sql`
- `supabase/migrations/20260529_add_campaign_source_diagnostics_rpc.sql`

Existing docs reviewed:

- `docs/overview-audit.md`
- `README.md`

## 3. Current frontend data flow

### Imports page implementation

`src/pages/Imports.tsx` implements the `/imports` route. The route is registered in `src/App.tsx` as a protected route, so authenticated users reach the Imports page through `ProtectedRoute`.

### Supabase access

`Imports.tsx` **does read Supabase**. It uses React Query with key `['imports-page', WORKSPACE_ID]`, gated by `Boolean(session)`, and calls a local `read(view)` helper for each view.

The helper performs:

```ts
supabase.from(view).select("*").eq("workspace_id", WORKSPACE_ID).limit(200)
```

The page currently queries these Supabase objects:

| Object | Queried by Imports? | Rendered visibly? | Current purpose |
| --- | --- | --- | --- |
| `v_import_health` | Yes | Yes | “Стан імпортів” table with `source_name`, `source_type`, `status`, `last_sync_at`, `rows_received`, `rows_inserted`, `rows_failed`. |
| `v_import_error_summary` | Yes | Yes | “Помилки імпортів” table with `source_name`, `error_type`, `error_count`, `last_error_at`. |
| `v_file_import_mappings` | Yes | Yes | “Стан мапінгу” table with `source_name`, `mapping_status`, `updated_at`. |
| `v_file_import_mapping_fields` | Yes | No | Fetched but not rendered by the current page. |
| `v_source_action_requests_recent` | Yes | No | Fetched and considered in `fullyUnavailable`, but not rendered. |
| `v_google_sheet_source_management` | Yes | No | Fetched but not rendered. |
| `v_scheduled_sync_rules` | Yes | No | Fetched but not rendered. |
| `v_alert_events_recent` | Yes | Yes | “Останні сповіщення” table with `severity`, `title`, `status`, `created_at`. |

### Static text vs. backend data

The page is a mix of real backend reads and hardcoded presentation:

- **Real backend reads:** all four visible cards are backed by Supabase view reads, not mock data.
- **Hardcoded static text:** section titles, descriptions, column names, sign-in/loading/unavailable/empty messages, and the mapping warning are hardcoded in Ukrainian inside `Imports.tsx`.
- **No imported demo data:** the page does not import from `src/data/mock.ts`.
- **No typed data model:** rows are represented as `Record<string, string | number | boolean | null>`, and columns are rendered by raw backend column names.
- **No app-level transformation:** there is no severity mapping, freshness calculation, action recommendation model, or UK/EN text mapping for rows/columns.

## 4. Current UI coverage

- [ ] **Health summary:** no. There is no top summary of data health status, failed imports, rejected rows, stale sources, or open alerts.
- [ ] **Latest import/sync runs:** partial. `v_import_health` can show source-level last sync fields, but the page does not show a dedicated recent run history. Ads Connectors separately reads `v_facebook_lead_sync_runs_recent`.
- [ ] **Failed imports:** partial. `v_import_error_summary` exposes summarized error counts, but there is no failed-runs table or severity triage.
- [ ] **Rejected rows:** no. No rejected-row view or rejected-row section was found in the Imports page.
- [ ] **Stale sources:** partial. `v_import_health`, `v_google_sheet_source_management`, `v_scheduled_sync_rules`, and connector health views may contain enough freshness/status fields, but the Imports page does not derive or display stale source cards.
- [ ] **Mapping issues:** partial. `v_file_import_mappings` is displayed and `v_mapping_review_queue` exists on the Bindings and Overview pages, but Imports does not show the mapping review queue or field-level mapping problems.
- [ ] **Operational alerts:** partial. Imports reads `v_alert_events_recent`; Alerts and Overview use `v_operational_alerts_recent`. There is no consistent “active/open operational alerts” model on Imports.
- [ ] **Data freshness:** partial. `last_sync_at` is shown as a raw table column when rows exist, but there is no freshness pill, status rollup, stale threshold, or last successful sync summary.
- [ ] **Refresh:** no. Imports relies on React Query lifecycle only. It does not render the shared `FilterBar` refresh control or a page-specific refresh button.
- [ ] **Date filter:** no. The app provides `DateFilterProvider` globally, and pages such as Overview use `FilterBar`, but Imports does not call `useDateFilter` or render `DateFilter`/`FilterBar`.
- [ ] **UK/EN:** partial. The page title/subtitle use i18n keys, but the card titles, descriptions, empty states, loading/sign-in/unavailable messages, warning text, and table column labels are hardcoded Ukrainian/raw backend names.
- [x] **Loading states:** yes, basic. A single loading message is shown while the React Query is loading.
- [x] **Empty states:** yes, basic. Each visible card has an empty message when its rendered row array is empty.
- [ ] **Error states:** partial. Individual read errors are swallowed into `unavailableReason`; a generic page-level unavailable message appears only when selected key reads are unavailable. There is no per-card technical/friendly error state.
- [ ] **Action links:** no. Imports does not link to Data Connections / Bindings, Telegram / Alerts, Ads Connectors, or Onboarding.

## 5. Data access risks

Current state: **safe but too shallow**.

Risk review:

- **Direct table reads from browser:** none found in `Imports.tsx`; it reads only `v_*` objects through the Supabase client.
- **Raw/backend-sensitive table reads from browser:** none found in the Imports page. The page does not read fact/raw tables directly and does not import mock data as real data.
- **RLS/permission-denied risks:** lower than direct table reads because the page targets view contracts, but not zero. The queried view names are not represented in the local generated Supabase types or local migrations in this repository snapshot, so the frontend depends on remote database contracts that may be absent or permission-restricted in some environments. The current implementation suppresses per-view errors, which avoids crashing but can hide permission/configuration problems behind empty-looking cards.
- **Missing safe views/RPCs:** rejected rows, stale-source rollups, failed run history, and a normalized import-health summary are not currently exposed through an Imports-specific typed frontend contract in this repository. If they exist remotely, they are not discoverable from local migrations/types.
- **RPC usage:** `Imports.tsx` does not call RPCs. Related pages use RPCs/Edge Functions for actions, but the Imports page is read-only.

## 6. Safe data sources found

The following existing frontend-accessed objects appear suitable for a read-only Imports / Data Health page if their remote permissions are confirmed. “Safe” here means they are already consumed from browser code as views or via protected Edge Functions/RPCs, not raw/fact table reads.

| Data source | Where found | What it can support on Imports | Frontend-safety assessment |
| --- | --- | --- | --- |
| `v_import_health` | `src/pages/Imports.tsx`, `src/pages/Overview.tsx`, `docs/overview-audit.md` | Source-level import status, last sync, rows received/inserted/failed, health summary inputs. | Appears safe for frontend read usage because existing pages already query it as a view filtered by `workspace_id`; permissions still need remote confirmation. |
| `v_import_error_summary` | `src/pages/Imports.tsx`, `src/pages/Overview.tsx`, `docs/overview-audit.md` | Failed import/error summary cards and failed-import issue counts. | Appears safe for frontend read usage as a view; should be kept summarized rather than exposing raw payloads. |
| `v_file_import_mappings` | `src/pages/Imports.tsx` | Current mapping status table and future mapping-health summary. | Appears safe as a frontend view, but column contract is not typed locally. |
| `v_file_import_mapping_fields` | `src/pages/Imports.tsx` | Field-level mapping details or a “fields needing mapping” section. | Appears safe as a frontend view, but currently fetched and unused; use only if it does not expose raw sensitive values. |
| `v_source_action_requests_recent` | `src/pages/Imports.tsx` | Suggested actions / recent source-management requests. | Appears safe as an existing view; currently fetched and unused. Confirm action contents are safe to display. |
| `v_google_sheet_source_management` | `src/pages/Imports.tsx` | Google Sheet source setup/freshness indicators and source-management action links. | Appears safe as an existing frontend view; currently fetched and unused. |
| `v_scheduled_sync_rules` | `src/pages/Imports.tsx` | Scheduled sync status, disabled/stale schedules, next-run/last-run context if fields exist. | Appears safe as an existing frontend view; currently fetched and unused. |
| `v_alert_events_recent` | `src/pages/Imports.tsx` | Recent import/data-health alert feed. | Appears safe as a view, but should be reconciled with `v_operational_alerts_recent` for a consistent open-alert model. |
| `v_operational_alerts_recent` | `src/pages/Overview.tsx`, `src/pages/Alerts.tsx`, `docs/overview-audit.md` | Open/recent operational alert counts and links to alert management. | Appears safe for frontend read usage because Overview and Alerts already query it. Prefer for “open operational alerts” if status semantics are confirmed. |
| `v_operational_alerts_health` | `src/pages/Alerts.tsx` | Alert system health/status for data-health summary. | Appears safe for frontend read usage on Alerts. Could support Imports health context if relevant. |
| `v_mapping_review_queue` | `src/pages/Overview.tsx`, `src/pages/Bindings.tsx`, `docs/overview-audit.md` | Mapping review problems, unmapped values count, links to Data Bindings. | Appears safe for frontend read usage as an existing view. Imports does not currently query it. |
| `v_binding_health` | `src/pages/Bindings.tsx`, `docs/overview-audit.md` | Source binding health and broken/unmapped binding indicators. | Appears safe for frontend read usage as an existing view. Imports does not currently query it. |
| `v_source_entity_bindings` | `src/pages/Overview.tsx`, `src/pages/Bindings.tsx`, `docs/overview-audit.md` | Data Connections / Bindings action links and binding counts. | Appears safe as an existing view, but should remain summarized on Imports. |
| `v_ad_account_bindings` | `src/pages/Overview.tsx`, `src/pages/Bindings.tsx`, `docs/overview-audit.md` | Ads binding counts and setup action links. | Appears safe as an existing view, but should remain summarized on Imports. |
| `v_production_backend_snapshot` | `src/pages/Overview.tsx`, `src/pages/AdsConnectors.tsx`, `docs/overview-audit.md` | High-level production readiness/data setup health. | Appears safe for read-only readiness display; local migrations do not define it, so contract should be confirmed before relying on extra fields. |
| `v_ads_connector_health` | `src/pages/Overview.tsx`, `docs/overview-audit.md` | Connector health status contributing to stale/failed source rollups. | Appears safe as an existing health view referenced by docs/Overview. |
| `v_facebook_lead_sync_runs_recent` | `src/pages/AdsConnectors.tsx` | Recent sync-runs table for Facebook Lead Ads. | Appears safe for frontend use on Ads Connectors. Imports could link to Ads Connectors or reuse for connector-specific sync runs if the broader import model is not available. |
| `v_facebook_lead_ads_health` | `src/pages/AdsConnectors.tsx` | Connector-specific source health. | Appears safe for frontend use on Ads Connectors. Useful for source-health details or action links. |
| `workspace-role-info` Edge Function / `useWorkspaceRole` | `src/hooks/useWorkspaceRole.ts`, action pages | Capability gating for management actions. | Safe for action gating; not needed for read-only audit dashboard unless action buttons are added. |

No frontend usage of a clearly named rejected-rows view, stale-source rollup view, general import-runs view, general sync-runs view, production readiness snapshot specific to Imports, or import-health RPC was found in local application code.

## 7. Production-ready target for Imports / Data Health

A production-ready Imports / Data Health page should stay read-only by default and use safe views/RPCs only. It should explain operational health at a glance, then let users drill into the exact issues and safe remediation paths.

### Top health summary

Recommended top summary cards:

- **Data health status**: healthy / warning / critical based on import errors, rejected rows, stale sources, mapping queue, and open alerts.
- **Last import/sync**: latest successful import/sync timestamp across sources.
- **Failed imports**: count of current failed sources or recent failed runs.
- **Rejected rows**: count of rejected/unprocessed rows, if a safe aggregate exists.
- **Stale sources**: count of sources beyond the freshness threshold.
- **Open alerts**: count of active operational alerts related to imports/data quality.

### Main sections

Recommended main sections:

- **Recent import/sync runs**: latest runs with source, status, started/finished time, row counts, and safe error summary.
- **Failed/rejected rows**: summarized failed imports and rejected-row categories without exposing raw payloads.
- **Stale sources**: sources with stale last sync, disabled schedule, or connector issue.
- **Mapping issues**: mapping review queue, unmapped fields, and binding-health problems with links to Data Bindings.
- **Operational alerts**: active/recent alerts with severity, status, created time, and link to Alerts.
- **Suggested actions**: safe navigation cards to Data Connections / Bindings, Telegram / Alerts, Ads Connectors, and Onboarding.

## 8. Recommended follow-up PR plan

### PR 1: Layout + health summary using existing safe data only

- Keep the current views read-only.
- Add a top health summary using `v_import_health`, `v_import_error_summary`, `v_operational_alerts_recent` or `v_alert_events_recent`, and `v_mapping_review_queue` if confirmed safe.
- Do not introduce new SQL/RPCs.
- Add clear unavailable/error handling per source.
- Add UK/EN text for all new labels.

### PR 2: Recent import/sync runs table

- Add a dedicated recent runs section.
- Prefer a general safe import/sync runs view if one exists remotely.
- If no general run view exists, use existing source-level health fields and connector-specific safe views such as `v_facebook_lead_sync_runs_recent` only where appropriate.
- Keep raw backend/fact tables out of browser code.

### PR 3: Rejected rows / failed rows section

- If a safe aggregate rejected-rows view exists remotely, render summarized counts/categories only.
- If no safe view exists, document the backend contract needed before implementation.
- Avoid raw rejected payloads or sensitive import data in browser responses.

### PR 4: Stale sources + action links

- Add stale-source cards from existing safe health/source-management views where possible.
- Link to:
  - Data Connections / Bindings (`/bindings`)
  - Telegram / Alerts (`/alerts`)
  - Ads Connectors (`/ads-connectors`)
  - Onboarding (`/onboarding`)
- Keep links contextual and avoid navigation redesign.

### PR 5: Final polish

- Loading states
- Empty states
- Error states
- UK/EN coverage
- Refresh behavior
- Mobile sanity
- Consistent column labels and friendly formatting
- Optional data freshness pill in the page header or shared `FilterBar`

## 9. Suggested first implementation PR after audit

The next PR should implement **only the Imports health summary and action-oriented layout shell using existing safe frontend data sources**.

Recommended exact scope:

1. Keep the existing four sections recognizable; do not remove current data visibility.
2. Add a read-only top summary with:
   - data health status,
   - latest `last_sync_at` from `v_import_health`,
   - failed import count/summary from `v_import_error_summary` and/or `rows_failed`,
   - open/recent alert count from one consistent alert view,
   - mapping issue count from `v_mapping_review_queue` or existing mapping rows if confirmed.
3. Add a shared refresh control with React Query `refetch()`.
4. Add per-card unavailable states instead of only a page-level generic unavailable message.
5. Add UK/EN strings for all user-facing labels introduced in the PR.
6. Do **not** add migrations, RLS changes, Edge Functions, RPCs, mock data, or raw table reads.

If rejected-row or general sync-run data is needed for the redesign and no safe frontend view exists, that should be handled in a later backend-contract PR rather than in the first implementation PR.
