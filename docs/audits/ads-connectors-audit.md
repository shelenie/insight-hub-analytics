# Ads Connectors audit

Date: 2026-05-30

## Scope and constraints

This is an audit-only report for the existing Ads Connectors page. No production UI, Supabase schema, migrations, RLS policies, Edge Functions, RPCs, OAuth flow, sync behavior, connect buttons, or safety checks were changed.

## Executive summary

- The Ads Connectors implementation is concentrated in a single page component: `src/pages/AdsConnectors.tsx`.
- The route is `/ads-connectors`, protected by `ProtectedRoute` in `src/App.tsx`.
- The page currently reads only Supabase views from the browser, not raw tables, but it does so with broad `select("*")`, a hardcoded workspace id, a universal `.eq("workspace_id", WORKSPACE_ID)`, and a `limit(200)`.
- The page invokes secure Supabase Edge Functions for OAuth start and scheduled sync actions, but those function implementations are not present in this repository snapshot. They should be treated as deployed backend contracts that need confirmation before UI polish.
- The page mixes several states that should remain distinct in future PRs: backend foundation ready, OAuth start/callback implemented, mock sync passed, real OAuth connection active, real ad account connected, and real sync data available.
- The UI is largely operational/debug-like: raw statuses, raw object serialization, generic tables, English/Ukrainian mixed copy, and an Issues tab that exposes optional-view failure strings.
- Placeholder/test-looking account values reported from production most likely come from `v_ad_account_bindings` rows and are not filtered on this page, even though a shared placeholder helper exists elsewhere.
- The `readiness: canceling statement due to statement timeout` item is most likely the `readOptionalView("v_production_backend_readiness")` call failing and then being surfaced by `collectUnavailableViews()` as a partial availability issue. This should not be papered over in frontend copy until the backend source is confirmed; a safe summary view/RPC may be needed.

## Files inspected

### Primary implementation

| Area | File | Notes |
|---|---|---|
| Main page/component | `src/pages/AdsConnectors.tsx` | Single component contains data loading, tabs, OAuth-start actions, scheduled-sync action, generic table rendering, and issue collection. |
| Routing entry | `src/App.tsx` | `/ads-connectors` route renders `AdsConnectors` inside `ProtectedRoute`. |
| Sidebar navigation | `src/components/layout/AppSidebar.tsx` | Adds Ads Connectors item under Operations. |
| Command/search navigation | `src/components/layout/DashboardLayout.tsx` | Adds searchable route label for Ads Connectors. |
| Navigation translation key | `src/i18n/translations.ts` | `navAdsConnectors` only. Page/tab/body copy is hardcoded in `AdsConnectors.tsx`. |
| Role/capability hook | `src/hooks/useWorkspaceRole.ts` | Calls `workspace-role-info` Edge Function and exposes `can_manage_bindings` and `can_run_ads_scheduled_sync`. |
| Supabase client | `src/integrations/supabase/client.ts` | Browser client uses anon/publishable key and persisted auth session. |
| Supabase generated types | `src/integrations/supabase/types.ts` | Does not define the views/functions used by this page; page relies on dynamic string access. |
| Workspace role Edge Function | `supabase/functions/workspace-role-info/index.ts` | Present locally; requires bearer token, validates user, uses service role to call `check_edge_function_access_by_email`, and returns capabilities. |
| Local migrations | `supabase/migrations/*` | Current local migrations do not define the Ads Connectors views or OAuth/sync RPCs used by the page. |
| Placeholder helpers | `src/lib/demoFilters.ts` | Shared helper can detect `Northstar Digital Clinic`, `Placeholder`, `mock`, `demo`, `backend_test`, etc.; Ads Connectors does not use it. |
| Related docs | `docs/overview-audit.md`, `docs/imports-data-health-audit.md` | Prior audits mention some overlapping readiness/import/ads views and note that several backend contracts are not represented by local migrations. |

## Current page structure

`src/pages/AdsConnectors.tsx` defines these subtabs:

1. Overview (`value="overview"`)
2. Connections (`value="connections"`)
3. Ad accounts (`value="ad-accounts"`)
4. Scheduled sync (`value="scheduled-sync"`)
5. Facebook Lead Ads (`value="facebook-lead-ads"`)
6. Ads health (`value="ads-health"`)
7. Issues (`value="recent-issues"`)

There are no split subtab components. Helper components/functions are local to the same file: `ReadinessField`, `ConnectorCard`, `OptionalViewCard`, `OptionalKnownColumns`, `GenericTable`, `GenericDataTable`, `friendlyLabel`, `formatValue`, `toObject`, `readString`, and `collectUnavailableViews`.

## Data-loading model

### Common frontend query

The page uses one React Query key, `['ads-connectors-workspace', WORKSPACE_ID]`, enabled only when a session exists. The query runs all reads in one `Promise.all()`.

All reads go through:

```ts
supabase.from(viewName).select("*").eq("workspace_id", WORKSPACE_ID).limit(200)
```

If a view returns an error, the page stores the error string as `unavailableReason` instead of throwing. This means one failed optional view does not break the whole page, but the Issues tab may display backend error text directly.

### Common risk notes

- Browser data reads are view reads, not direct raw table reads in this component.
- Because local Supabase types define no views/functions, the compiler cannot validate these backend contracts.
- Because local migrations do not define these Ads Connectors views, this repo cannot prove whether each view is `security_invoker`, `security_definer`, RLS-safe, or already filtered by workspace membership.
- The frontend applies a hardcoded workspace id and an `.eq("workspace_id", ...)` to every view. This is safe only if every view exposes `workspace_id`; otherwise the view will fail and appear in Issues.
- The broad `select("*")` makes the UI dependent on every field exposed by the views and can expose overly technical columns in generic tables.
- The `limit(200)` caps returned rows but does not prevent a view definition from doing expensive work before applying the filter/limit.

## Data sources by subtab

### 1. Overview

| Data source | Type | Frontend use | Safe view/RPC or direct table read? | RLS/permission risk | Timeout risk |
|---|---|---|---|---|---|
| `v_production_backend_readiness` | Supabase view | Fallback for `production_backend_status`. Errors appear as `readiness: ...` in Issues. | View read; no direct table read. | Unknown; not defined in local migrations/types. Likely depends on remote view permissions. | High enough to document: production shows `readiness: canceling statement due to statement timeout`. |
| `v_production_backend_snapshot` | Supabase view | `ads_connector_status`, primary `production_backend_status`. | View read; no direct table read. | Unknown locally. Prior docs treat it as existing frontend readiness view. | Possible but not currently reported in the supplied issue. |
| `v_ai_ads_summary_context` | Supabase view | First row is serialized via `formatValue(overview.adsHealth)` if present. | View read; no direct table read. | Unknown locally. | Possible if view aggregates performance context. |
| `v_ai_ads_anomaly_candidates` | Supabase view | Fallback first row for `latest_ads_health`. | View read; no direct table read. | Unknown locally. | Possible if anomaly view is expensive. |

Current UI state:

- Displays three readiness fields: connector status, production status, and `latest_ads_health`.
- Raw/debug-like: `latest_ads_health` label is raw; object values become JSON strings; status values such as `ads_setup_required`, `no_active_connections`, or backend enum values are shown directly.
- User-friendly: only one sentence appears when `ads_connector_status === "no_active_connections"`.
- Empty/data-missing: if the backend rows are absent, the fields show `Unavailable`, which does not distinguish loading, missing source, permission error, or empty data.
- Needs better copy: map backend states to human-readable states, keep raw status only in developer/debug details, and separate backend readiness from real ads data availability.

### 2. Connections

| Data source/action | Type | Frontend use | Safe view/RPC or direct table read? | RLS/permission risk | Timeout risk |
|---|---|---|---|---|---|
| `workspace-role-info` | Edge Function via `useWorkspaceRole` | Determines `can_manage_bindings` and `can_run_ads_scheduled_sync`. | Secure Edge Function; present locally. | Function validates bearer token and calls access RPC server-side. | Low from frontend perspective. |
| `meta-oauth-start` | Edge Function | Invoked by Meta Ads connect button. | Secure Edge Function invocation; implementation not in repo snapshot. | Requires user JWT through Supabase function invoke. Backend behavior must be confirmed remotely. | Low/unknown. |
| `google-ads-oauth-start` | Edge Function | Invoked by Google Ads connect button. | Secure Edge Function invocation; implementation not in repo snapshot. | Requires user JWT through Supabase function invoke. Backend behavior must be confirmed remotely. | Low/unknown. |
| `tiktok-oauth-start` | Edge Function | Invoked by TikTok Ads connect button. | Secure Edge Function invocation; implementation not in repo snapshot. | Requires user JWT through Supabase function invoke. Backend behavior must be confirmed remotely. | Low/unknown. |

Current UI state:

- Shows cards for Meta Ads, Google Ads, TikTok Ads, and Facebook Lead Ads.
- Meta/Google/TikTok cards call secure OAuth start Edge Functions and redirect `window.location.href` to an authorization URL returned by the function.
- Facebook Lead Ads is disabled and says it is managed through Meta Ads connection.
- Raw/debug-like: descriptions mention implementation details (“secure OAuth start function”) rather than user outcomes; errors from invoke are rendered directly under cards.
- User-friendly: connect buttons are disabled when the user lacks management capabilities.
- Needs safer explanation: clarify that clicking can create real OAuth state/redirect through deployed backend if the function is configured. It does not itself prove that a real account is connected or sync data exists.

### 3. Ad accounts

| Data source | Type | Frontend use | Safe view/RPC or direct table read? | RLS/permission risk | Timeout risk |
|---|---|---|---|---|---|
| `v_ad_account_bindings` | Supabase view | Renders selected known columns for connected/mapped ad accounts. | View read; no direct table read. | Unknown locally; used elsewhere as frontend view. | Medium if view joins mapping/client/project/funnel data. |

Current UI state:

- Displays `platform`, `ad_account_name`, `external_account_id`, `client_name`, `project_name`, `funnel_name`, `mapping_status`, `binding_status`, `confidence`, `created_at`, and `updated_at` when present.
- Raw/debug-like: account ids and mapping/binding enum states are shown directly.
- Placeholder/test data: reported production values such as `act_placeholder_northstar_meta`, `google_ads_placeholder_northstar`, and `tiktok_ads_placeholder_northstar` most likely come from this view, because this is the only Ad accounts subtab data source.
- The page does not apply `filterPlaceholderRows()` from `src/lib/demoFilters.ts`, even though placeholder filtering exists in other areas.
- Needs later decision: hide, label, or replace placeholder/test rows. Do not silently hide them in this audit PR because that would change production UI and could mask real backend state.

### 4. Scheduled sync

| Data source/action | Type | Frontend use | Safe view/RPC or direct table read? | RLS/permission risk | Timeout risk |
|---|---|---|---|---|---|
| `v_ads_scheduled_sync_rules` | Supabase view | Renders rule columns: platform/cadence/schedule/status/last/next/updated. | View read; no direct table read. | Unknown locally. | Medium if view computes next run state. |
| `v_ads_scheduled_sync_due` | Supabase view | Renders due-state columns: platform/status/last/next/due/is_due. | View read; no direct table read. | Unknown locally. | Medium if view computes due eligibility. |
| `ads-scheduled-sync-run` | Edge Function | Invoked by “Запустити синхронізацію”. | Secure Edge Function invocation; implementation not in repo snapshot. | Requires user JWT and frontend capability `can_run_ads_scheduled_sync`; backend checks must be confirmed remotely. | Backend-dependent. |

Current UI state:

- Shows scheduled rules and due rows if available.
- Shows a run sync button.
- Button disabled unless there is a session, `canManage` is true, `capabilities.can_run_ads_scheduled_sync` is true, and no sync is currently loading.
- Raw/debug-like: “Scheduled sync is checked securely on submit” is implementation-oriented; success/error messages are generic; full response details are available only inside `DeveloperDetails`.
- Risk: this can trigger a real deployed sync Edge Function if backend access allows it. It is not just a UI mock button.
- Needs later clarity: distinguish no rule configured, rule configured but not due, backend dry/mock run, submitted real run, completed run, and failed run.

### 5. Facebook Lead Ads

| Data source | Type | Frontend use | Safe view/RPC or direct table read? | RLS/permission risk | Timeout risk |
|---|---|---|---|---|---|
| `v_facebook_lead_ads_health` | Supabase view | Generic table in Lead Ads Health card. | View read; no direct table read. | Unknown locally; prior docs treat as existing frontend view. | Medium if it aggregates health. |
| `v_facebook_lead_forms` | Supabase view | Generic table in Lead Forms card. | View read; no direct table read. | Unknown locally. | Low/medium depending on joins. |
| `v_facebook_leads_recent` | Supabase view | Generic table in Recent Leads card. | View read; no direct table read. | Potential PII/business sensitivity even through a view; confirm columns before widening UI. | Medium if not indexed or if it scans recent leads. |
| `v_facebook_lead_sync_runs_recent` | Supabase view | Generic table in recent sync runs card. | View read; no direct table read. | Unknown locally; prior docs treat as existing frontend view. | Low/medium. |

Current UI state:

- Displays four generic cards/tables.
- Raw/debug-like: table headings are generated from column names and only a small set of labels are translated; workspace ids and technical health fields can be displayed directly.
- Empty because no data: forms/leads/sync runs can legitimately be empty if no real Meta/Facebook Lead Ads connection or forms exist.
- Empty because data source missing/permission denied: the card shows “Цей розділ поки недоступний” if the view errors, but the technical error only appears in Issues.
- Needs safer explanation: the tab should clearly state whether the Meta connection exists, whether Lead Ads integration is enabled, whether any forms were discovered, and whether no leads is expected.

### 6. Ads health

| Data source | Type | Frontend use | Safe view/RPC or direct table read? | RLS/permission risk | Timeout risk |
|---|---|---|---|---|---|
| `v_ai_ads_summary_context` | Supabase view | Generic table for ads summary context. | View read; no direct table read. | Unknown locally. | Medium/high if it summarizes ad performance broadly. |
| `v_ai_ads_daily_context` | Supabase view | Generic table for daily ads context. | View read; no direct table read. | Unknown locally. | Medium/high if it scans daily performance. |
| `v_ai_ads_anomaly_candidates` | Supabase view | Generic table for anomaly candidates. | View read; no direct table read. | Unknown locally. | Medium/high if anomaly candidate view is expensive. |

Current UI state:

- Displays three optional generic tables.
- Raw/debug-like: names expose AI/internal context concepts and raw columns; no user-oriented explanation of “healthy”, “missing data”, or “insufficient history”.
- Empty because no data: empty tables may mean no real ad performance data exists yet.
- Empty because missing data source: view errors are not displayed in the cards, only in Issues.
- Needs safer explanation: distinguish “no connected ad account”, “connected but no sync data”, “insufficient data for anomaly detection”, and “backend view unavailable”.

### 7. Issues

| Data source | Type | Frontend use | Safe view/RPC or direct table read? | RLS/permission risk | Timeout risk |
|---|---|---|---|---|---|
| `collectUnavailableViews(query.data)` | Frontend helper | Lists every optional view whose read returned an error string. | Frontend aggregation of view errors. | Depends on source view errors. | Exposes timeouts/errors directly. |
| `connectorState` | Frontend state | Lists OAuth-start invoke errors after button clicks. | Frontend state only. | Could expose backend error messages. | N/A. |

Current UI state:

- Displays “No unavailable optional views detected” or `key: error message` entries.
- Raw/debug-like: it directly exposes labels like `readiness` and backend errors such as `canceling statement due to statement timeout`.
- User-friendly: useful for admin triage, but not understandable as customer-facing product copy.
- Needs safer explanation: classify errors as backend unavailable, permission issue, timeout, or not configured, while keeping exact backend details in developer details.

## Actions/buttons audit

| Action/button | Location | Calls | Auth/JWT | Can create OAuth state? | Can trigger real sync? | Current visibility/enabled behavior | Audit recommendation |
|---|---|---|---|---|---|---|---|
| Connect Meta Ads | Connections | `supabase.functions.invoke("meta-oauth-start", { body: { workspace_id } })`; redirects to returned URL. | Yes, Supabase client includes session JWT when logged in. | Yes, if deployed Edge Function is configured to create OAuth state and return authorization URL. | No. | Visible to all authenticated users; disabled when `!canManage` or loading. | Keep safety checks. Later copy should say this starts OAuth and does not mean account is connected until callback/account binding succeeds. |
| Connect Google Ads | Connections | `google-ads-oauth-start`; redirects to returned URL. | Yes. | Yes, if deployed backend is configured. | No. | Visible to all authenticated users; disabled when `!canManage` or loading. | Same as above; distinguish backend-ready from connected. |
| Connect TikTok Ads | Connections | `tiktok-oauth-start`; redirects to returned URL. | Yes. | Yes, if deployed backend is configured. | No. | Visible to all authenticated users; disabled when `!canManage` or loading. | Same as above. |
| Facebook Lead Ads disabled button | Connections | No call. | N/A. | No direct action. | No. | Always disabled. | Keep disabled unless/until product supports a separate Lead Ads setup action. Clarify dependency on Meta connection. |
| Run scheduled sync | Scheduled sync | `supabase.functions.invoke("ads-scheduled-sync-run", { body: { workspace_id } })`; invalidates/refetches queries. | Yes. | No. | Yes, if deployed backend permits/implements real sync. | Disabled when no session, no manage capability, no `can_run_ads_scheduled_sync`, or loading. | Keep disabled rules. Later copy should warn/clarify what will run and show result status from backend. |
| Refresh/refetch after sync | Scheduled sync success path | `query.refetch()` and invalidates `ads-connectors-workspace`, `ads-health`, `scheduled-sync`, `ads-readiness`. | Existing session. | No. | No by itself. | Internal after successful Edge Function response. | Safe. Verify query keys align with other pages before expanding. |

## State distinctions that must remain separate

Future implementation PRs should avoid combining these into one “connected/ready” status:

1. **Backend foundation ready**: views/functions/migrations exist and respond without timeout.
2. **OAuth start implemented**: `*-oauth-start` Edge Function returns an authorization URL.
3. **OAuth callback implemented**: provider callback persists credentials/state safely; not visible from this page’s current code.
4. **Mock sync passed**: backend test/mock sync completed; not proof of real credentials or real account data.
5. **Real OAuth connection active**: provider token/connection exists and is valid.
6. **Real ad account connected/bound**: account appears in `v_ad_account_bindings` and is mapped to client/project/funnel as appropriate.
7. **Real sync data available**: ads performance/leads/sync runs are present in the context/recent views.

## Placeholder/test data findings

| Placeholder-looking value | Likely source | Evidence | Expected/demo/test? | Later handling recommendation |
|---|---|---|---|---|
| `act_placeholder_northstar_meta` | `v_ad_account_bindings` | The Ad accounts tab renders only `query.data?.adBindings`, which is populated from `v_ad_account_bindings`. | Likely placeholder/test/demo data based on `placeholder` and `northstar`. Need backend confirmation. | Do not delete in UI. Later PR should label as test/demo or filter only after product decision. |
| `google_ads_placeholder_northstar` | `v_ad_account_bindings` | Same as above. | Likely placeholder/test/demo. | Same as above. |
| `tiktok_ads_placeholder_northstar` | `v_ad_account_bindings` | Same as above. | Likely placeholder/test/demo. | Same as above. |
| `Northstar Digital Clinic`, `Evergreen Growth Program`, `Main Webinar Funnel`, `Placeholder`, `mock`, `demo`, `backend_test`, `test_upload` | Any view row that includes these strings | Shared helper `src/lib/demoFilters.ts` treats these as placeholder patterns, but Ads Connectors does not use it. | Existing app convention treats these as placeholder/demo/test indicators. | Later PR can reuse helper to label/filter, but must avoid hiding real backend errors or real rows unexpectedly. |

## Timeout issue: `readiness: canceling statement due to statement timeout`

### Most likely source

The Issues tab label `readiness` maps to the `readiness` property returned by the main query. That property is populated by `readOptionalView("v_production_backend_readiness")`. Therefore the reported item is most likely an error returned from:

```ts
supabase
  .from("v_production_backend_readiness")
  .select("*")
  .eq("workspace_id", WORKSPACE_ID)
  .limit(200)
```

The error is not thrown. It is stored as `readiness.unavailableReason` and later rendered by `collectUnavailableViews()` as `readiness: canceling statement due to statement timeout`.

### Classification

- Source category: frontend query to a Supabase view.
- Underlying cause: likely remote view/query complexity or lock/contention; local migrations do not define the view, so exact SQL cannot be audited in this repo snapshot.
- Frontend-only fix safety: not enough. The frontend can improve classification/copy, but it cannot make the view faster or prove correctness. Hiding the message would risk masking a real backend problem.
- Likely backend follow-up: add or confirm a safe, fast summary view/RPC for readiness, or optimize `v_production_backend_readiness` so it filters by workspace early and avoids expensive full scans. If SQL/RPC is needed, it should be a separate backend PR with deploy verification.
- Low-risk frontend follow-up: classify the issue as “Backend readiness summary timed out” and keep exact details behind developer details.

## Backend/SQL/RLS/RPC touched in this PR

None.

This audit did not change:

- Supabase schema
- migrations
- RLS policies
- Edge Functions
- RPC functions
- OAuth behavior
- scheduled sync behavior
- browser data sources
- UI behavior

## Recommended next PR sequence

### PR 2: Make Ads Connectors Overview human-readable

- **Goal:** Replace raw Overview labels/statuses with human-readable state mapping while preserving backend details for developer/admin diagnostics.
- **Likely files touched:** `src/pages/AdsConnectors.tsx`; possibly translation files if moving copy out of literals.
- **Backend risk:** Low if display-only.
- **SQL/RPC needed:** No, unless `v_production_backend_readiness` timeout blocks required state.
- **Verify after deploy:** Overview distinguishes backend readiness, OAuth readiness, active connections, connected accounts, and real data availability; raw `latest_ads_health`/`ads_setup_required` not shown as primary copy.

### PR 3: Polish Connections tab

- **Goal:** Clarify that buttons start OAuth via secure Edge Functions and that OAuth start is not the same as connected account/data. Keep existing disabled/access behavior.
- **Likely files touched:** `src/pages/AdsConnectors.tsx`; possibly translations.
- **Backend risk:** Low if copy/state only.
- **SQL/RPC needed:** No.
- **Verify after deploy:** Buttons remain disabled for users without `can_manage_bindings`; OAuth start still redirects only through existing functions; errors are classified without hiding exact diagnostics from admins.

### PR 4: Polish Ad accounts tab and placeholder handling

- **Goal:** Show ad account rows with safer labels and identify placeholder/test rows without silently deleting real data.
- **Likely files touched:** `src/pages/AdsConnectors.tsx`, possibly `src/lib/demoFilters.ts` only if extending existing helper in a backward-compatible way.
- **Backend risk:** Low for label-only; medium if filtering changes what users see.
- **SQL/RPC needed:** Probably no. If the view cannot distinguish demo/test rows reliably, a backend flag/field may be needed later.
- **Verify after deploy:** Placeholder-looking values are labeled or handled per product decision; real connected accounts remain visible; mapping/binding state is understandable.

### PR 5: Scheduled sync UI safety and status clarity

- **Goal:** Explain what the run sync button does, what permissions are required, and whether the backend submitted, skipped, dry-ran, or failed a sync.
- **Likely files touched:** `src/pages/AdsConnectors.tsx`.
- **Backend risk:** Low if no behavior changes; medium if depending on richer response fields.
- **SQL/RPC needed:** No for copy; maybe later if backend does not return enough safe status information.
- **Verify after deploy:** Button remains gated by session, `can_manage_bindings`, and `can_run_ads_scheduled_sync`; no additional sync capability is added; success/error states are understandable.

### PR 6: Facebook Lead Ads UI polish

- **Goal:** Replace raw generic tables with user-oriented summaries for health, forms, recent leads, and sync runs while preserving diagnostic details.
- **Likely files touched:** `src/pages/AdsConnectors.tsx`; maybe a new small presentational component if the file gets too large.
- **Backend risk:** Low if view columns are only displayed more safely; medium if new fields are required.
- **SQL/RPC needed:** Not initially. Consider a safe summary view/RPC later if current views expose too much detail or PII for the browser.
- **Verify after deploy:** Empty forms/leads/sync runs states distinguish “not connected”, “no forms found”, “no leads yet”, and “view unavailable”.

### PR 7: Ads health / issues timeout fix

- **Goal:** Classify Issues tab failures safely and resolve the readiness timeout through backend optimization or a safe summary contract if needed.
- **Likely files touched:** Frontend: `src/pages/AdsConnectors.tsx`. Backend if required: Supabase migration for optimized view/RPC, plus generated types if used.
- **Backend risk:** Low for frontend classification only; medium/high for SQL/RPC changes depending on production data size and RLS/security-definer design.
- **SQL/RPC needed:** Maybe. The timeout likely needs backend investigation because it originates from a Supabase readiness view.
- **Verify after deploy:** `v_production_backend_readiness` or replacement source returns within acceptable time; Issues tab no longer exposes raw timeout as primary copy; exact backend error remains available to admins/developers.

## Checks run

- `npm run lint` — passed with existing warnings.
- `npm run build` — passed; Vite reported the existing large chunk warning and stale Browserslist data notice.
- `npx tsc --noEmit` — passed.
- `npm run typecheck --if-present` — passed; no `typecheck` script is currently defined, so npm exited successfully without running an additional project script.
