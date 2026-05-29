# Overview page audit

Date: 2026-05-29  
Scope: audit only for the Insight Hub internal analytics workspace frontend. No page redesign, backend schema change, SQL/RLS change, Edge Function change, or database contract change was made.

## Executive summary

The current Overview page is implemented as a compact operational workspace summary, not yet as an executive business dashboard. It already reads the production backend snapshot and several workspace-readiness views, so a future readiness card/section can be evolved safely if it remains read-only and uses the existing safe views. However, the page does not yet use the real business reporting views that power Sales, Conversions, and Campaigns, and it does not use the shared date filter/KPI/chart patterns already present elsewhere.

The future "top KPI cards + charts" direction is feasible with existing safe data sources, especially:

- Sales/revenue: `v_unified_sales_performance_daily` and `v_unified_sales_performance_summary`.
- Ad spend and ad efficiency: `v_unified_ads_performance_daily` and `v_unified_ads_performance_summary`.
- Placement/landing performance: `v_unified_placements_performance_daily` and `v_unified_placements_performance_summary`.
- Funnel/conversion counts: `v_unified_conversions_stage_events`, `v_unified_conversions_payment_records`, `v_unified_conversions_payment_lines`, and/or the lower-volume summary views `v_unified_funnel_stage_summary` and `v_unified_funnel_conversion_summary` where sufficient.
- Health/readiness: `v_production_backend_snapshot`, `v_import_health`, `v_import_error_summary`, `v_ads_connector_health`, `v_binding_health`, `v_mapping_review_queue`, and alert views.

The highest-risk areas before redesign are hardcoded workspace scoping, duplicated placeholder filtering, mixed loading/error treatment, broad `select("*")`, no date filter on Overview, and the possibility of exposing too much raw technical readiness language unless a PR intentionally maps backend statuses to human-readable product copy.

## A. Current Overview implementation

### Route and main component

- `src/App.tsx` imports `Overview` and mounts it at `/` behind `ProtectedRoute`.
- Main implementation: `src/pages/Overview.tsx`.
- Main component: default export `Overview()`.
- The page uses a module-local hardcoded `WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc"`.

### Child/shared components used by Overview

`Overview` directly uses:

- `DashboardLayout` for the page shell.
- `SectionCard` for all card-like page sections.
- `Button` and `Link` for next-step actions.
- `DeveloperDetails` and `FriendlyError` for debug/error disclosure.
- `useAuth` to gate queries on an authenticated session.
- `useQuery` from TanStack Query.
- `supabase` browser client.

### Local helper logic in Overview

`Overview.tsx` also defines local helpers:

- `PLACEHOLDER_PATTERNS`, `isPlaceholderRow()`, and `filterRows()` for filtering obvious demo/test rows.
- `shouldRetryWithoutWorkspace()` to detect views that may not have a `workspace_id` column.
- `countView()` for count-card source views.
- `countOpenAlerts()` for operational alert counting.

This overlaps with the shared `src/lib/demoFilters.ts` placeholder utilities and should be considered for a later safe cleanup, not this audit.

## B. Current data sources

### Current Overview queries

Overview runs three TanStack queries when `session` is present:

| Query key | Purpose | Source(s) | Type |
| --- | --- | --- | --- |
| `backend-readiness` | Backend/readiness snapshot | `v_production_backend_snapshot` filtered by `workspace_id`, `maybeSingle()` | Supabase view |
| `overview-counts` | Workspace setup counts and alert count | `v_clients`, `v_projects`, `v_funnels`, `v_source_entity_bindings`, `v_ad_account_bindings`, `v_mapping_review_queue`, `v_operational_alerts_recent` | Supabase views |
| `overview-activity` | Simple recent activity flags | `v_import_health`, `v_import_error_summary`, `v_ai_helper_health` | Supabase views |

No RPCs are called by the current Overview page. No direct Supabase tables are read by the current Overview page. No static KPI/demo dataset is imported into Overview, although the repository does contain static/mock KPI and chart data in `src/data/mock.ts` used or available elsewhere.

### Current query behavior

- Most reads are `select("*")`, then filtered/aggregated in the browser.
- Most reads are scoped by the hardcoded workspace ID.
- `countView()` retries without the workspace filter only for errors that look like a missing `workspace_id` column. This fallback may be useful for compatibility, but it can also broaden the browser read if a view is not workspace-scoped.
- `activity` stores per-view error messages but does not surface them in the visible Recent Activity section; they only appear in developer details.

## C. Current sections/cards/KPIs

### 1. Unauthenticated message

- **UI label/title:** `Огляд`.
- **Data source:** `useAuth().session` only.
- **Real/static/placeholder:** Real auth state.
- **Usefulness:** Useful fallback, although the route is already protected.
- **Duplicates Sales/Conversions/Campaigns:** No.
- **Loading/error/empty:** Handles no-session with a short message.

### 2. Backend readiness error

- **UI label/title:** `FriendlyError` with message `Потрібне оновлення backend для цього розділу.`.
- **Data source:** Error from `v_production_backend_snapshot` query.
- **Real/static/placeholder:** Real backend error state.
- **Usefulness:** Useful for operators/developers, but too technical for an executive top dashboard.
- **Duplicates Sales/Conversions/Campaigns:** No.
- **Loading/error/empty:** Error is handled. Loading is not explicitly represented for the readiness card; before data arrives, default fallback statuses may render.

### 3. Workspace status / readiness grid

- **UI label/title:** `Стан робочого простору`.
- **Cards inside:**
  - `Стан системи`
  - `Підключення даних`
  - `Клієнти / проєкти / воронки`
  - `Рекламні дані`
  - `AI-асистент`
  - `Сповіщення`
- **Data source:** `v_production_backend_snapshot` fields including `technical_status`, `failed_checks`, `onboarding_status`, `production_backend_status`, `snapshot_status`, `ai_helper_status`, and `operational_alerts_status`.
- **Real/static/placeholder:** Real backend readiness snapshot, but with static label/copy mapping in the component.
- **Usefulness:** Useful as a readiness summary. It is currently operational/readiness-focused, not an executive KPI block.
- **Duplicates Sales/Conversions/Campaigns:** No, but it duplicates conceptual status summaries found on Ads Connectors/Imports/Bindings pages.
- **Loading/error/empty:** Error is handled by `FriendlyError`. Loading/empty is weak: with no data yet, `r = {}` and several cards render fallback text such as `Триває перевірка` or `Потрібна увага`, which can look like a real status before the query has completed.

### 4. Workspace setup count grid

- **UI label/title:** `Налаштування робочого простору`.
- **Cards inside:**
  - `Клієнти`
  - `Проєкти`
  - `Воронки`
  - `Джерела даних`
  - `Рекламні акаунти`
  - `Мапінг на перевірку`
  - `Відкриті сповіщення` or `Останні сповіщення`
- **Data source:** `overview-counts` query reading `v_clients`, `v_projects`, `v_funnels`, `v_source_entity_bindings`, `v_ad_account_bindings`, `v_mapping_review_queue`, and `v_operational_alerts_recent`.
- **Real/static/placeholder:** Real backend view rows, with local demo/test filtering.
- **Usefulness:** Useful for workspace setup readiness and admin triage. It is not enough for the future executive dashboard because it does not show revenue, conversions, ad spend, trend, efficiency, or date context.
- **Duplicates Sales/Conversions/Campaigns:** Minimal direct duplication. `Рекламні акаунти` and mapping counts overlap with Ads Connectors/Bindings, but they are appropriate as quick health signals.
- **Loading/error/empty:** Loading displays `—` because there is no dedicated loading state. Per-card source errors display `Дані поки недоступні`, but the section itself does not clearly distinguish loading vs. no data vs. permission error.

### 5. Next steps

- **UI label/title:** `Наступні кроки`.
- **Cards/actions:**
  - Ads connector action when `production_backend_status` or `snapshot_status` is `ads_setup_required`.
  - Onboarding action when clients/projects/funnels count is zero.
  - Bindings action when mapping review count is greater than zero.
  - Alerts action when alert count is greater than zero.
  - Fallback `Основні налаштування виглядають готовими.` with href `/`.
- **Data source:** Derived from `v_production_backend_snapshot` and count views.
- **Real/static/placeholder:** Real derived conditions with static copy/actions.
- **Usefulness:** Useful and should be retained in a future overview, likely lower on the page as action cards/quick links.
- **Duplicates Sales/Conversions/Campaigns:** No.
- **Loading/error/empty:** There is no explicit loading handling. Before count data loads, conditions may default to zeros, so the section can temporarily show the "ready" fallback.

### 6. Recent activity

- **UI label/title:** `Остання активність`.
- **Items:**
  - Imports updating vs. no imports.
  - Import errors vs. no import errors.
  - Open alerts vs. no critical alerts.
  - AI temporarily unavailable vs. AI works.
- **Data source:** `v_import_health`, `v_import_error_summary`, `v_ai_helper_health`, and alert count.
- **Real/static/placeholder:** Real existence checks, but not a true activity feed; it uses boolean flags from recent/health views.
- **Usefulness:** Moderately useful for operational triage, but it is not enough for business "what is happening now" summary.
- **Duplicates Sales/Conversions/Campaigns:** No.
- **Loading/error/empty:** Loading is not explicit. Import/AI view errors are only stored under `activity.data.errors` and visible in `DeveloperDetails`, so the visible section can say imports/AI are fine when a source was unavailable.

### 7. Developer details

- **UI label/title:** inside `DeveloperDetails`.
- **Data source:** JSON dump of readiness, counts, activity, and activity errors.
- **Real/static/placeholder:** Real debug information.
- **Usefulness:** Useful during rollout, not an executive-dashboard element.
- **Duplicates Sales/Conversions/Campaigns:** No.
- **Loading/error/empty:** Displays whatever query data exists; not intended as end-user state.

## D. Backend readiness status on Overview

Overview currently does have a readiness-related section. It reads `v_production_backend_snapshot` and uses these fields or fallback names:

- `technical_status`
- `failed_checks`
- `onboarding_status`
- `production_backend_status`
- `snapshot_status`
- `ai_helper_status`
- `operational_alerts_status`

The audit request also asked about specific status concepts:

| Concept | Current Overview usage | Notes |
| --- | --- | --- |
| `v_production_backend_snapshot` | Yes | Read directly in `backend-readiness` query. |
| Production/backend readiness fields | Partial | Uses `production_backend_status`, `snapshot_status`, `technical_status`, `failed_checks`. |
| `technical_status` | Yes | Maps `PASS` to `Система працює`; otherwise `Триває перевірка`. |
| `production_backend_status` | Yes | Used for ad setup messaging and next step. |
| `onboarding_status` | Yes | Used to say whether client/project/funnel data is ready. |
| `binding_status` | No direct usage found in Overview | Binding health is represented indirectly through binding/mapping counts. |
| `ads_connector_status` | No direct usage found in Overview | Campaigns/Ads Connectors use ads connector health/status elsewhere; Overview currently uses `production_backend_status`/`snapshot_status` for ad readiness. |
| Import health/data health fields | Partial | Overview reads `v_import_health` and `v_import_error_summary` as boolean recent-activity flags, but does not surface a dedicated import/data health strip or detailed import freshness metrics. |

Product concern: readiness copy is currently embedded in the page and sometimes exposes raw concepts indirectly. PR 3 should map backend fields to friendly user-facing states and keep raw technical details behind `DeveloperDetails`.

## E. Supabase safety / RLS risk

### Current Overview access pattern

- Current Overview browser reads are from views only.
- Current Overview does not call any RPCs.
- Current Overview does not read direct tables.
- Current Overview does not use Edge Functions.

This is generally the safest direction for this page.

### Safe/known-good view evidence

The unified reporting views added in migrations explicitly grant `select` to `authenticated` and include workspace role checks in their view definitions. Examples include `v_unified_ads_performance_daily`, `v_unified_ads_performance_summary`, `v_unified_sales_performance_daily`, `v_unified_sales_performance_summary`, `v_unified_funnel_stage_summary`, and `v_unified_funnel_conversion_summary`.

### Risks to watch

- `src/integrations/supabase/types.ts` currently has no concrete table/view/function types, so the app uses string view names without generated type safety.
- `countView()` can retry a read without `workspace_id` if a view lacks that column. This is a compatibility feature, but it weakens the confidence that every Overview source is workspace-scoped from the browser call itself.
- Broad `select("*")` increases exposure and coupling to view schema changes. Future Overview PRs should select only required columns where practical.
- Unknown/older views such as `v_production_backend_snapshot`, `v_import_health`, `v_import_error_summary`, and readiness/binding/onboarding views are not defined in the migrations present in this repository snapshot, so the frontend relies on existing remote database contracts not fully represented locally.
- If the future dashboard uses RPCs, it should prefer already-granted, security-definer read RPCs with explicit workspace access checks. The existing `get_campaign_source_diagnostics` RPC follows that pattern for Campaigns, but it is diagnostics-oriented rather than a top executive KPI source.

## F. What data already exists for future top KPI cards and charts

### Recommended future top KPI/card sources

| Future metric/block | Recommended source | Browser safety | Good enough now? | Missing / caveats |
| --- | --- | --- | --- | --- |
| Revenue, total sales, first/second payment totals | `v_unified_sales_performance_daily` for trends, `v_unified_sales_performance_summary` for aggregation | Safe candidate: views are granted to authenticated and include workspace role checks | Yes for real sales/revenue cards and time-series charts | Needs date filter alignment; current Sales page aggregates in frontend and has USD/UAH decisions to preserve. |
| Sales count trend | `v_unified_sales_performance_daily` | Safe candidate | Yes | Needs chart aggregation across campaigns by sale date. |
| Ad spend | `v_unified_ads_performance_daily` or `v_unified_ads_performance_summary` | Safe candidate | Yes | Should align date range with Campaigns; avoid using mock `overviewKpis`. |
| Clicks/leads/reach | `v_unified_ads_performance_daily` | Safe candidate | Yes | Must avoid overloading Overview with full Campaigns detail. Use high-level totals only. |
| CPL/CPC/lead rate | `v_unified_ads_performance_daily`/summary | Safe candidate | Yes | Efficiency metrics need clear labels and null/zero handling. |
| Placement/landing performance summary | `v_unified_placements_performance_daily`/summary | Safe candidate | Maybe | Good for secondary insight cards; probably too detailed for the very top row unless product wants top landing/source health. |
| Funnel stage counts | `v_unified_conversions_stage_events` or `v_unified_funnel_stage_summary` | Candidate safe if view permissions match existing page use; summary views in migrations are granted | Yes for high-level counts | `v_unified_conversions_stage_events` can be high-volume; use summary/aggregation for top cards if possible. |
| Funnel conversion rates | `v_unified_funnel_conversion_summary` or frontend aggregation from Conversions sources | Safe candidate for summary view | Good for snapshot rates | Summary migration view does not appear date-filtered; if top Overview needs date range, use Conversions page sources or add backend support later, not in PR 2. |
| Payment records / conversion revenue | `v_unified_conversions_payment_records` and `v_unified_conversions_payment_lines` | Used by Conversions page; likely browser-safe in current app | Yes for counts/payment classification; Sales views are cleaner for revenue | High-volume paged reads; Overview should not copy full detail reads unless needed. |
| Data/import health | `v_import_health`, `v_import_error_summary` | Currently used by Overview and Imports | Partial | Need friendly freshness/severity fields confirmed; current Overview only uses row existence. |
| Open alerts / issues | `v_operational_alerts_recent` or `v_alert_events_recent` depending desired scope | Currently used by Overview/Imports/Alerts | Yes for issue count/strip | Need consistent definition of "open" vs. "recent"; current status/resolved fallback is fragile. |
| Backend readiness/data setup health | `v_production_backend_snapshot`, `v_ads_connector_health`, `v_binding_health`, `v_onboarding_health`, `v_mapping_review_queue` | Currently used by Overview and other pages | Yes for health/readiness blocks | Should map raw statuses to human-readable severity and actions. |
| Source coverage / campaign diagnostics | `get_campaign_source_diagnostics` RPC | RPC grants execute to authenticated and checks workspace access | Useful for diagnostics, not top executive KPI | Keep as secondary technical insight; avoid in top row unless reframed as data coverage. |
| AI/helper health | `v_ai_helper_health` and `v_ai_helper_requests_recent` | Currently used by Overview/Assistant | Partial | Good for AI block availability, not business performance. |

### Feasible top block shape for PR 2 without backend changes

A safe PR 2 could start Overview with:

1. **KPI row:** revenue, sales count, ad spend, leads/conversions, CPL/CPC, open alerts/data health.
2. **Trend chart:** revenue vs. spend over the active date range using Sales daily + Ads daily views.
3. **Business summary:** short text summary derived from real totals, with no AI claims.
4. **Data health strip:** import errors, connector status, mapping review count, open alerts.
5. **Quick links/action cards:** reuse existing next-step logic lower on the page.

Avoid adding fake revenue/conversion values. The existing `src/data/mock.ts` `overviewKpis` and `revenueVsSpend` data should not be used as if it is production data.

## G. What should NOT be changed yet

For the next Overview work, do not change yet:

- Supabase schema, migrations, RLS policies, Edge Functions, or RPC/database contracts.
- Navigation structure.
- Sales, Conversions, or Campaigns behavior except as reference patterns.
- Direct table reads from the browser.
- Fake/static KPI values presented as real data.
- Full AI assistant functionality.
- Backend readiness field names or contracts.
- Existing setup/next-step/recent-activity functionality until replacement sections are proven with real data.
- Low-level technical status wording in the top executive dashboard; keep detailed raw statuses in developer/debug areas.

## H. Recommended next PR plan

### Overview PR 2: layout + content structure

**Goal:** reshape the page structure without risky backend changes.

Recommended scope:

- Introduce a top executive summary block using only existing safe read-only views.
- Add top KPI cards sourced from real data:
  - Revenue/sales from `v_unified_sales_performance_daily` or summary.
  - Ad spend/clicks/leads/CPL from `v_unified_ads_performance_daily`.
  - One health KPI from existing alert/import/mapping counts.
- Add a simple top trend chart, likely revenue vs. spend by date, using existing Recharts dependency and existing chart/KPI visual patterns.
- Add a business summary block with deterministic copy from real totals, not AI-generated text.
- Keep existing workspace setup, next steps, and recent activity lower on the page.
- Use the shared date filter and comparison conventions where appropriate, matching Sales/Campaigns patterns.
- Use real empty/loading/error states before rendering readiness/default copy.

Do not change backend contracts in PR 2.

### Overview PR 3: data quality / production readiness cards

**Goal:** surface readiness and health in a human-readable way.

Recommended scope:

- Build a dedicated readiness/health section from `v_production_backend_snapshot` and existing health views.
- Translate raw statuses into friendly states:
  - Technical status.
  - Production backend status.
  - Onboarding status.
  - Binding/mapping status.
  - Ads connector status.
  - Import/data health.
- Prefer labels like "Ready", "Needs setup", "Needs review", "No recent imports", "Connector attention needed" over raw database enum/status values.
- Keep raw readiness payloads in `DeveloperDetails` only.
- Do not add or rename readiness fields in the database.

### Overview PR 4: AI summary / insight placeholder

**Goal:** add a lightweight "AI summary / what to check" block.

Recommended scope:

- Add a small placeholder/preview block that summarizes deterministic signals and makes clear it is not a full AI assistant.
- Optionally link to the existing Assistant page.
- Do not build a full AI assistant or new AI backend flow in this PR.
- Do not invent insights from missing data; use only real available metrics and health flags.

## Detailed risk register

| Risk | Why it matters | Recommendation |
| --- | --- | --- |
| Hardcoded workspace ID in Overview and other pages | Blocks multi-workspace support and makes previews/tests depend on one workspace | Keep for now if it is the current app pattern; future dedicated workspace-scope PR should centralize it. |
| Loading state defaults can look like real statuses | Empty `readiness.data` maps to status text before query completion | Add explicit skeleton/loading/unknown states before PR 2 top cards. |
| `select("*")` from many views | Increases coupling and may expose unneeded columns | Select only fields required for top KPIs/charts in new Overview queries. |
| Retry without workspace scope | May broaden data reads if a view lacks `workspace_id` | Avoid this pattern in new executive KPI queries; prefer sources with confirmed workspace columns. |
| Placeholder filtering duplicated locally | Overview has its own placeholder filter while `src/lib/demoFilters.ts` exists | Later small cleanup can reuse the shared filter, but avoid unrelated refactor in PR 2. |
| Mixed source errors hidden from users | Recent Activity can claim "no errors" when a view itself errored | Surface source-unavailable states in health cards. |
| No Overview date filtering | Top KPI cards/charts need date context | Reuse `useDateFilter` and data-bound patterns from Sales/Campaigns. |
| High-volume conversion reads | Conversions page uses paged reads up to 50k rows | Prefer summary views/aggregations for Overview; do not copy detailed tables into top dashboard unless necessary. |
| Mock KPI/chart data exists in repo | Easy to accidentally make fake dashboard look real | Do not import `overviewKpis` or `revenueVsSpend` into production Overview. |
| Raw readiness jargon | Executive Overview should be understandable | Map raw fields to human-readable product copy in PR 3. |

## Files inspected for this audit

Primary Overview files:

- `src/pages/Overview.tsx`
- `src/App.tsx`
- `src/components/dashboard/SectionCard.tsx`
- `src/components/dashboard/KpiCard.tsx`
- `src/lib/demoFilters.ts`
- `src/integrations/supabase/client.ts`
- `src/integrations/supabase/types.ts`

Related page patterns/data sources:

- `src/pages/Sales.tsx`
- `src/pages/Conversions.tsx`
- `src/pages/Campaigns.tsx`
- `src/pages/AdsConnectors.tsx`
- `src/pages/Onboarding.tsx`
- `src/pages/Bindings.tsx`
- `src/pages/Imports.tsx`
- `src/pages/Alerts.tsx`
- `src/pages/Assistant.tsx`

Shared app patterns:

- `src/i18n/I18nProvider.tsx`
- `src/i18n/translations.ts`
- `src/theme/ThemeProvider.tsx`
- `src/filters/DateContext.tsx`
- `src/data/mock.ts`

Database/migration references available in this repository snapshot:

- `supabase/migrations/20260521_add_unified_reporting_views.sql`
- `supabase/migrations/20260521_add_placement_performance_layer.sql`
- `supabase/migrations/20260529_add_campaign_source_diagnostics_rpc.sql`
