## Verified Local Change — 2026-07-07 Ads Source Readiness Diagnostics

Ads Pipeline Diagnostics now returns a `source_readiness` object beside the existing blocker diagnosis so admins and AI context can distinguish technical blockers from expected test/empty ad account state. The readiness layer reports stable statuses for `not_connected`, `needs_real_ad_account`, `connected_no_production_data`, `connected_with_imported_fallback`, `platform_permission_or_access_blocked`, and `production_data_ready`, plus booleans for connections, accounts, bindings, API/raw rows, imported fallback rows, facts rows, freshness, likely test/empty accounts, and whether production validation is possible. `build_ai_ads_context` now exposes the same `source_readiness` without changing its signature or the `ai-helper-run` request/response contract. For this project, Google Ads, Meta Ads, and TikTok Ads connectors should be treated as test/empty/non-production until real ad accounts or real platform data with spend/leads are available; real platform sync fixes are intentionally deferred. Historical imported fallback data remains available for AI analysis. No frontend UI, OAuth flows, sync execution behavior, sync schedules, RLS, secrets/token storage, or Edge Function contract changed.

## Verified Local Change — 2026-07-07 Ads Pipeline Diagnostics Production Hotfix Mirror

The repository now mirrors the Supabase production hotfix for `build_ads_pipeline_diagnostics(uuid, date, date)`: diagnostics no longer assume `public.ad_traffic_raw.metric_date`, dynamically use `metric_date`, `day`, then `insight_date` when present, and count workspace rows without date filtering when no supported date column exists. The returned `raw_data_state.ad_traffic_raw` JSON includes `date_column`, so production diagnostics now works with the real `ad_traffic_raw.day` schema. `latest_failed_run_by_platform` was verified to emit valid JSON key/value pairs for `platform`, `date_from`, `date_to`, and sanitized `error_message`. First live blocker detected remains `google_ads_permission_denied`; secondary observed issues are Meta/TikTok latest successful syncs returning 0 rows, `facts_ads_daily` remaining empty, and AI answers relying on historical imported fallback data. No frontend UI, OAuth flows, sync execution behavior, RLS, Edge Function contracts, or `ai-helper-run` request/response contract changed.


## Verified Local Change — 2026-07-07 Ads Pipeline Diagnostics

Safe backend Ads Pipeline Diagnostics were added as an additive Supabase RPC, `build_ads_pipeline_diagnostics`, plus a `build_ai_ads_context` extension that returns `pipeline_diagnostics`, `first_blocker_code`, `first_blocker_message`, and `platform_blockers` without changing the existing function signature or the `ai-helper-run` request/response contract. The diagnostic payload can identify the first broken ads stage across active connections, ad accounts, account bindings, raw API rows, imported ads rows, facts, AI context views, and sync logs with sanitized/truncated error messages. Known current blockers are Google Ads permission denied, Meta/TikTok syncs succeeding with zero rows, empty `facts_ads_daily`, and historical imported data available only through the unified ads fallback. No OAuth credentials, access tokens, service role keys, RLS weakening, frontend UI, routes, sync schedule behavior, platform API credentials, or user permissions model behavior were changed.

# PROJECT_STATE.md

## Purpose

Current state of Internal Analytics Workspace.

New ChatGPT/Codex/Claude/Cursor sessions should read this file first.

---


## Verified Local Change — 2026-07-07 AI Helper Senior Performance Marketing Analyst Prompt

The `ai-helper-run` prompt and response framework was upgraded from a generic internal analytics assistant into a Senior Performance Marketing Analyst for a performance agency. The system prompt now combines CMO-style campaign diagnosis with CFO-style budget and unit-economics discipline, keeps Ukrainian as the default answer language, requires use of only the provided JSON context, forbids invented metrics/periods/campaigns/clients/revenue/ROAS/causes, and explicitly calls out stale, fallback/imported, missing, or incomplete data. Ads-context responses now have a structured data-status, performance-diagnosis, CMO lens, CFO lens, client-ready summary, and prioritized next-actions framework, while non-ads contexts remain safe and are not forced into ads/CPL sections. No database schema, RLS policies, database tables/views, RPC signatures, Edge Function name, `ai-helper-run` request/response contract, auth/workspace role checks, OAuth, sync logic, frontend UI, routes, or chat history/session architecture were changed.
---


## Verified Local Change — 2026-07-07 AI Assistant Chat Mode Alignment

The AI Assistant chat mode was aligned around one centered frontend-only chat column shared by message rows, assistant full-width answer cards, assistant loading/error states, the compact composer, starter prompts, and the safety note. Composer focus styling now lives on the outer rounded container so the textarea no longer shows a separate inner focus border/ring. A subtle in-page New chat / Новий чат action now clears only the current in-memory messages, prompt, and visible error state to return to the clean starter screen while preserving the selected analysis mode. Persistent chat history was not implemented. No backend logic, RPC calls, Supabase schema, RLS policies, routes, permission logic, database tables/views, existing analysis mode backend mappings, Edge Function name, or `ai-helper-run` request/response contract were changed.
## Verified Local Change — 2026-07-07 AI Ads Context Fallback

AI Ads backend context now keeps the existing frontend request-type/context-scope contract while fixing the `ai-helper-run` RPC payload sent to `build_ai_ads_context`: the Edge Function now passes only `p_workspace_id`, `p_date_from`, `p_date_to`, and `p_platform`, matching the current database function signature. A new reversible Supabase migration updates `build_ai_ads_context` so facts-based ads context remains primary, but when `facts_ads_daily`/AI ads facts are empty it falls back to `v_unified_ads_performance_daily` and `v_unified_ads_performance_summary` imported data. The returned context includes `source_layer_used`, data freshness metadata, health, summaries/top campaigns, anomaly candidates when available, and notes warning when the latest metric date is older than seven days. Follow-up correction aligned date columns with the real Supabase schema: facts/AI daily context use `insight_date`, while unified imported ads data uses `metric_date`. No RLS policies, auth/workspace role checks, Supabase secrets, OAuth flows, real API sync behavior, frontend UI, routes, unsupported AI action behavior, or chat history/session architecture were changed.

## Verified Local Change — 2026-07-07 AI Assistant ChatGPT-Style Start Screen

The AI Assistant empty state was refined further toward a modern ChatGPT/Claude-style start screen. The heavy dashboard-card frame was removed from the primary empty canvas, the welcome block and suggested marketing prompts were tightened to fit the first screen in one normal laptop viewport, the composer is now a compact floating chat input that auto-expands only for longer multiline prompts, and starter prompts now sit under the composer and disappear after the first interaction. Response history remains hidden from the primary UI. No backend logic, RPC calls, Supabase schema, RLS policies, routes, permission logic, database tables/views, analysis mode backend mappings, Edge Function name, or `ai-helper-run` request/response contract were changed.



## Verified Local Audit — 2026-07-07 AI Marketing Analyst Backend Path

A read-only audit documented why the AI Assistant currently has no real ads performance data for workspace `5ebbe435-fd79-44c3-834e-642e8fba00dc` despite existing connector/account/binding records. The observed blocker is that `facts_ads_daily`, `v_ai_ads_daily_context`, and `v_ai_ads_anomaly_candidates` all have zero rows, so ads-scoped `ai-helper-run` requests cannot answer marketing performance questions from real metrics. The repo contains reusable Edge Function foundations for Meta, Google Ads, TikTok, scheduled sync orchestration, fact rebuild calls, and AI ads context delegation, but the local migration set does not define the raw ads tables/RPCs, `facts_ads_daily`, AI context views, `rebuild_ads_daily_facts`, or `build_ai_ads_context`. No production code, migrations, RLS policies, or Edge Function contracts were changed. See `docs/audits/ai-marketing-analyst-backend-path-audit.md`.

## Project

Name: Internal Analytics Workspace
Status: active / in progress
Approval: awaiting client approval
Current stack: Codex + Supabase + GitHub
Source of truth for code: GitHub
Backend/data layer: Supabase
Last updated: 2026-07-06
Confidence: high for Phase 1 user-access hardening after manual remote Supabase verification; medium-high for broader repo facts

---

## Goal

Build an internal analytics workspace for a performance/marketing agency.

The workspace should help organize and analyze:

- clients
- projects
- funnels
- traffic sources
- ad accounts
- imports
- mappings
- leads
- sales
- campaigns
- data quality
- dashboards
- AI-assisted analytics

The goal is not just visual dashboards.

The goal is structured, reliable analytics from messy business data.

---

## Known Context

Agency context may include:

- many client projects
- multiple funnels per project
- multiple traffic sources
- many Google Sheets / exports / imports
- ad data
- lead data
- sales data
- inconsistent naming
- messy source files

Do not assume data is clean.

---

## Current Stack

- GitHub = source of truth for code/repo docs
- Supabase = backend/data layer
- Codex = implementation assistant

Do not add unrelated tools unless Olena explicitly confirms them.

---


## Verified Local Change — 2026-07-06 AI Assistant Simplified Chat Surface

The AI Assistant main screen has been simplified into one clean ChatGPT/Claude-style chat surface. The visible primary UI now focuses on the DashboardLayout page title/subtitle, centered welcome state, suggested prompt cards, bottom composer, one compact analysis mode selector, and one muted safety note. Response history is hidden from the primary UI until a proper chat/session history UX is designed. The existing suggested marketing prompts and analysis mode backend mappings remain in place, Full overview remains the default, and no visible Auto context was added. No backend logic, RPC calls, Supabase schema, RLS policies, routes, permission logic, database tables/views, Edge Function name, or `ai-helper-run` request/response contract were changed.

---


## Verified Local Change — 2026-07-06 AI Assistant Visual Micro-Polish

Small frontend-only AI Assistant visual polish after the chat-first layout is complete. The response history trigger now lives inside the chat card header as a secondary compact control, and the opened history dropdown remains attached to that trigger with a compact max-height scroll area, at most three latest items, and technical details still collapsed. The empty welcome state uses tighter vertical spacing so prompts and composer feel closer on the first screen, and the Ukrainian/English assistant subtitle now uses the approved performance-marketing wording. No suggested prompts, analysis mode backend mappings, backend logic, RPC calls, Supabase schema, RLS policies, routes, permission logic, database tables/views, Edge Function name, or `ai-helper-run` request/response contract were changed.

---




## Verified Local Change — 2026-07-06 AI Assistant Final Layout Polish

Final frontend polish for the AI Assistant page is complete. The chat card is now the clear primary surface, while response history is available through a compact collapsed History panel by default and still shows at most three latest items with technical details collapsed. The safety note is visually lighter near the welcome/composer area, the welcome copy is performance-marketing specific, and visible analysis modes are ordered around marketing workflows: full overview, ads performance, drops/anomalies, data quality, imports, mapping, alerts, clients/funnels, ads connection health, and system readiness. No backend logic, RPC calls, Supabase schema, RLS policies, routes, permission logic, database tables/views, Edge Function name, or `ai-helper-run` request/response contract were changed.

## Verified Local Change — 2026-07-06 Sidebar Navigation Structure

The sidebar navigation structure was corrected as a frontend-only change. Overview now appears under the Workspace section, the Analytics section starts with Conversions and contains Campaigns, Sales / Revenue, and Imports / Data Health, and the Admin group remains collapsible with active Admin routes auto-opening the group. Icon-collapsed sidebar behavior remains unchanged. No backend logic, routes, permissions, RLS policies, Supabase schema/objects, or new pages were changed. Users & Access remains deferred as a future security-sensitive feature; role-aware sidebar filtering should wait for a safe capability/read contract if needed.

## Verified Local Change — 2026-07-06 AI Assistant Performance Marketing Defaults

The AI Assistant frontend was refined for performance marketing analytics. The visible Auto context option was removed, Full overview is now the default context, subtitle and welcome copy now focus on ads, CPL, campaign attention, data quality, and client-ready explanations, suggested prompts were replaced with Ukrainian/English performance-marketing questions, and response history is secondary/collapsed by default with at most three visible items. The existing `ai-helper-run` Edge Function request body contract remains unchanged, and no backend logic, RPCs, RLS policies, schema, routes, or permissions were changed.

## Verified Local Change — 2026-07-06 AI Assistant Chat UI

The AI Assistant page frontend was redesigned into a chat-style assistant surface. It now presents a central conversation area with a prepared-data welcome state, suggested prompt cards, compact context selection, bottom composer, user/assistant bubbles, thinking/error/no-access states, and secondary response history with technical diagnostics hidden under localized technical details. The assistant copy explicitly states that it explains prepared workspace data across ads, imports, data quality, bindings, alerts, anomalies, and overall workspace status, and that AI does not directly modify data. No backend logic, RPC calls, RLS policies, Supabase schema, routes, permissions logic, database objects, Edge Function name, or `ai-helper-run` request/response contract were changed.




## Verified Local Change — 2026-07-06 Onboarding Frontend Polish

The Onboarding page frontend was clarified before backend AI-assisted mapping work. The page now uses existing Ukrainian/English i18n for visible admin-facing copy, explains that admins prepare the analytics hierarchy of clients, projects, and funnels before connecting sources/ad accounts, improves loading/error/no-access/empty/action-disabled language, and keeps workspace/client/project/funnel IDs plus view diagnostics inside collapsed technical details. Existing onboarding read views and onboarding upsert Edge Function calls remain unchanged. Onboarding unexpected-response fallback errors are localized so raw developer fallback strings are not primary admin-facing copy. No backend logic, RPC signatures, RLS policies, Supabase schema, routes, or permission logic were changed.

## Verified Local Audit — 2026-07-06 Remaining Admin / Control-Center Frontend

A local frontend audit inspected Onboarding, Ads Connectors, AI Assistant, Imports / Data Health, Overview touchpoints, the current Admin sidebar, and existing Users & Access foundations before backend AI-assisted mapping work. No backend logic, RPC signatures, RLS policies, Supabase schema, or application behavior were changed.

Audit conclusions:

- Admin sidebar is safe to keep: the Admin group currently contains Onboarding, Data Bindings / Mapping, Telegram / Alerts, and Ads Connectors, while AI Assistant remains in the AI section.
- Overview is safe to keep as an executive/operational entry point and links admins toward Imports, Data Bindings, Alerts, and Ads Connectors when relevant.
- Ads Connectors is safe to keep before backend mapping work and already has Ukrainian/English local page copy, verified/pending connector states, disabled management actions when capabilities are missing, and technical diagnostics secondary. Do not add fake connector actions beyond verified OAuth/sync contracts.
- Onboarding is safe to keep because it uses existing read views and existing onboarding upsert Edge Functions with role/capability gating, but it still needs frontend polish: UK/EN i18n, clearer non-technical page purpose, improved empty/loading/error/no-access language, and keeping technical IDs/details secondary.
- AI Assistant is safe to keep only as a prepared-data assistant surface using the existing `ai-helper-run` Edge Function, but it needs frontend polish: UK/EN i18n, clearer safe-disabled states, clearer explanation that answers depend on prepared fact/health data, and debug details kept secondary.
- Imports / Data Health is safe to keep and already links to Data Bindings, Telegram / Alerts, and Ads Connectors for operational follow-up; any remaining work should be copy/empty-state polish only, with no query/action/backend changes.
- Users & Access must not be added yet. Verified foundations exist for active-aware membership status and role/capability checks, but invitation/action RPCs, user-management audit events, first-superadmin/bootstrap contract, and safe frontend read/write contracts are still deferred.

Final frontend polish plan before backend AI-assisted mapping work: polish Onboarding first, then AI Assistant, then small Imports / Data Health copy refinements if live review still finds unclear states. Users & Access should wait for a backend/RLS/RPC/audit contract PR and should not be faked in the UI.

## Verified Local Change — 2026-07-06 Admin Sidebar Clarification

The left sidebar admin/control-center section has been clarified from Operations to Admin in Ukrainian and English. The existing admin items remain unchanged: Onboarding, Data Bindings / Mapping, Telegram / Alerts, and Ads Connectors. The Admin group uses the existing Radix/shadcn collapsible UI pattern in the expanded desktop sidebar, auto-opens when one of its routes is active, and keeps icon-collapsed sidebar behavior unchanged. No backend logic, routes, permissions, RLS policies, Supabase objects, or new pages were changed. Users & Access / Користувачі й доступи remains planned as a separate security-sensitive admin feature.


## Verified Local Change — 2026-07-06 Telegram / Alerts UI Clarification

Final polish after PR #192 removes the default visible security/status note from happy-path page load, renames notification routes to admin-facing rules, shows friendly event labels as the primary rule names with technical route values as muted secondary text, localizes common technical health headers, and keeps open operational alerts primary while moving resolved recent alerts into collapsed history. Backend logic, RPC signatures, RLS policies, Edge Function contracts, database schema, and action behavior remain unchanged.

## Verified Local Change — 2026-07-06 Telegram / Alerts UI Clarification

The Telegram / Alerts page has been clarified before AI-assisted mapping/autobinding work. The page now uses existing Ukrainian/English i18n keys for visible admin copy, friendlier overview and health summaries, improved queue/confirmation/alert empty states, localized table headers and status values, friendly action-failure toasts, and collapsed technical detail sections for raw diagnostics. Already resolved operational alerts no longer show the close-alert action and instead show an already-resolved badge. No backend logic, RPC signatures, RLS policies, Edge Function contracts, or database schema were changed. Telegram remains the HITL confirmation surface for future mapping review flows.

## Verified Local Change — 2026-07-05 Data Bindings Bilingual Copy

Final copy polish for the Data Bindings / Bindings Mapping page keeps behavior and data access unchanged while aligning the Overview helper block, project bindings labels, mapping status tab label, ad-account wording, and advanced technical-mode label in Ukrainian and English.

Follow-up copy polish simplified the Data Bindings Overview helper text for admins in both Ukrainian and English, keeping KPI cards, overview counts, backend logic, RPC signatures, RLS, and data queries unchanged. The Data Bindings health tab label is now “Стан мапінгу” / “Mapping status” as a copy-only rename.

The Data Bindings manual/admin UX copy from PR #190 now uses the existing app i18n system instead of hardcoded Ukrainian for updated tab labels, section descriptions, KPI helper text, empty states, page state messages, ad-account workflow copy, technical feedback, table labels, and mapping/Telegram health helper text. English translations were added without backend logic, RPC signature, RLS, query, drawer, filter, or table behavior changes.

## Verified Local Change — 2026-07-05 Data Bindings Manual/Admin UX Clarification

The Data Bindings page copy now distinguishes non-ad-account file/table sources from ad account bindings, explains overview counts and pending mapping-review confirmations, labels the project bindings tab as a consolidated read-only project-context view, and clarifies that the health tab covers mapping queue, Telegram confirmations, and errors rather than generic Ads connector status. Empty states now prepare admins for future AI-assisted mapping/autobinding without adding backend logic, changing RPC signatures, weakening RLS, or changing existing data queries and table behavior.

## Verified Local Change — 2026-07-05 Ad Account Binding Admin UX

Follow-up header polish merges the Data Bindings “Рекламні акаунти” title, description, inline status filter, and primary bind button into one compact admin header. The separate helper toolbar card is removed, the automatic-ID note is part of the description, and the status select keeps a fixed width sized for “Архівні/призупинені” so changing filter values does not move the button.

Follow-up polish after the drawer migration separates normal drawer form and feedback state from the advanced UUID technical form and feedback state, so normal name-based saves no longer fill technical ID inputs or write success/error feedback into the advanced block. The drawer now distinguishes create and edit titles, detects whether the submitted active binding already existed before saving, and shows a clearer styled success toast for created vs updated bindings. The helper text above the ad account table is shortened for admin users while technical details remain confined to the collapsed advanced mode.

The Data Bindings “Рекламні акаунти” tab now presents a production-style admin workflow for normal admins. The active-only default remains, but the status filter is a compact “Статус” dropdown. Admins can open “+ Привʼязати рекламний акаунт” in a right-side Sheet drawer and search/select ad account, client, project, and funnel by readable labels instead of copying UUIDs; project and funnel choices are filtered by the selected parent. The same drawer opens from “Перепривʼязати” without pushing the table down. After a normal save, the drawer closes, the form clears, the table refreshes, and a short auto-dismissing toast success notification appears. The existing UUID-based technical setup remains available below the table as a collapsed smaller advanced block. Saving still calls the existing `binding-create-or-update` Edge Function, preserving backend idempotency/RLS behavior.

## Verified Local Change — 2026-07-04 Manual Binding Save Feedback

The Data Bindings technical setup forms now show visible Ukrainian status feedback next to the manual source/ad account binding form after save attempts. Successful ad account saves explain that an existing active binding may have been updated without creating a duplicate; source saves show a concise saved message. Feedback keeps submitted form values visible and persists until the next save, refresh, tab change, or form edit. Compact technical response details are kept inside a collapsed details block. The ad account idempotency migration now avoids PostgreSQL parameter-default replacement errors in future environments by preflighting duplicates, dropping the target function without `CASCADE`, recreating it, restoring service-role-only execution, and notifying PostgREST to reload its schema cache.


## Verified Local Change — 2026-07-04

Manual ad account binding duplicate prevention was added locally for review. Migration `20260704_make_ad_account_binding_idempotent.sql` replaces `public.bind_ad_account_to_scope` with update-before-insert behavior for the active natural key: `workspace_id`, `ad_account_id`, `client_id`, `project_id`, `funnel_id`, and `binding_status = 'active'`. The migration also adds a non-destructive preflight check and a partial unique index using `where binding_status = 'active'`. The Data Bindings Ad Accounts tab and Ads connectors ad account list now default to active bindings only and expose explicit Active / Archived-paused / All status filters for historical rows. Repeated manual saves preserve existing ad account binding `notes`, `metadata`, and `is_primary` unless replacement values are intentionally provided.

Local inspection confirmed `supabase/functions/binding-create-or-update/index.ts` calls `public.bind_ad_account_to_scope` for manual ad account bindings and `public.bind_source_entity_to_scope` for source bindings. Local migrations do not contain the existing source-binding SQL function definition, so source binding idempotency remains a remote-contract verification item.


## Verified Remote Supabase State — 2026-06-26

Phase 1 user-access hardening was manually applied and verified against remote Supabase.

Verified:

- `workspace_members.status` and `workspace_members.updated_at` exist.
- Existing `workspace_members` rows are `active`.
- `get_current_user_workspace_role` and `get_workspace_role` enforce `wm.status = 'active'`.
- Workspace helper functions route through active-only role checks.
- Direct `workspace_members` INSERT, UPDATE, and DELETE policies require active `superadmin` rank.
- Triggers exist for `updated_at`, workspace member management enforcement, and last active `superadmin` protection.
- `v_current_user_permissions` filters by `auth.uid()` and `wm.status = 'active'`.
- `v_workspace_members_with_permissions` is active-aware.
- Both permission/member views use `security_invoker=true`.
- `v_workspace_members_with_permissions` has no direct `SELECT` grant for `anon` or `authenticated`.

Still not completed:

- invitation model/RPCs
- user-management action RPCs
- user-management-specific audit events
- first-superadmin bootstrap contract
- frontend user-management UI

---

## Approval State

Client approval is not final.

Rules:

- do not treat all plans as approved
- keep changes reversible
- mark assumptions
- avoid irreversible production decisions
- update context when approval changes

---

## Known Rules

- GitHub is source of truth.
- Do not rely on old chat memory.
- Do not weaken RLS.
- Do not expose secrets.
- Do not delete valuable assets by default.
- Preserve raw data where practical.
- Dashboard metrics must be defined before UI polish.
- Data quality issues should be visible.
- User management must distinguish auth user from workspace access.

---

## Areas To Verify In Repo

- frontend framework
- package manager
- Supabase folder structure
- migrations
- RLS policies
- Edge Functions
- auth/roles
- user/profile/workspace membership tables
- dashboard pages
- import/data pipeline
- AI helper layer
- current env examples
- tests/build scripts

---

## Current Next Safe Action

1. Add/verify repo context files under `docs/ai-context/`.
2. Add/verify root `AGENTS.md`.
3. Ask Codex to inspect repo state.
4. Update this file with verified facts.
5. Then continue implementation.

---

## Verified Repo Facts — 2026-06-25

Inspection only. No application code was changed.

### Repository Structure

Verified top-level repo areas include:

- `src/` frontend application code
- `supabase/` Supabase config, migrations, and Edge Functions
- `docs/` project docs and audits
- `docs/ai-context/` durable AI context files
- `.github/workflows/` GitHub Actions workflows
- `public/` static assets

Verified root config/files include:

- `package.json`
- `package-lock.json`
- `bun.lockb`
- `vite.config.ts`
- `vitest.config.ts`
- `tailwind.config.ts`
- `tsconfig.json`
- `tsconfig.app.json`
- `tsconfig.node.json`
- `eslint.config.js`
- `.env.example`

Package manager is needs verification because both `package-lock.json` and `bun.lockb` exist.

### Frontend

Verified frontend stack from repo files:

- Vite
- React
- TypeScript
- React Router
- TanStack Query
- Tailwind CSS / shadcn-style component structure
- Supabase JS client
- Vitest

Main app routing is in `src/App.tsx`.

Verified protected page routes include:

- `/` Overview
- `/conversions`
- `/campaigns`
- `/sales`
- `/imports`
- `/assistant`
- `/onboarding`
- `/bindings`
- `/alerts`
- `/ads-connectors`

### Supabase

Verified Supabase repo structure:

- `supabase/config.toml`
- `supabase/migrations/`
- `supabase/functions/`

Verified local migrations include workspace membership RLS repair, unified reporting views, placement performance, import health summary RPC, campaign diagnostics RPC, disconnect ad platform connection RPC, timezone preferences, TikTok OAuth/token changes, onboarding hierarchy fix, and binding Edge Function registration.

Verified Edge Function source folders include:

- ads scheduled sync
- AI helper
- backup export / restore backup
- binding create/update/archive
- Facebook lead ads sync and webhook
- file upload parser
- Google OAuth / Ads OAuth / Sheets sync flows
- health check
- mapping review actions
- Meta OAuth / ads sync
- onboarding client/project/funnel upserts
- operational alert resolve
- Telegram dispatch/outbox/webhook helpers
- TikTok OAuth / ads sync
- `whoami`
- `workspace-role-info`

Remote Supabase deployment state is needs verification.

### Auth and User Access

Verified frontend auth/access files include:

- `src/auth/AuthProvider.tsx`
- `src/auth/ProtectedRoute.tsx`
- `src/hooks/useWorkspaceRole.ts`
- `src/integrations/supabase/client.ts`

Verified current behavior from repo files:

- Supabase client uses `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` or `VITE_SUPABASE_PUBLISHABLE_KEY`.
- Auth provider handles Supabase sessions and magic-link sign-in.
- Magic-link sign-in sets `shouldCreateUser: false`.
- `ProtectedRoute` checks for an authenticated session before rendering protected routes.
- Workspace role/capability lookup is handled separately through `workspace-role-info`.
- Locally visible role union is `member | admin | superadmin`.

Needs verification:

- profile table
- complete workspace membership table contract
- invitations model
- audit-log coverage
- first superadmin setup
- inactive/removed member behavior
- complete permissions model
- full RLS behavior in remote Supabase


### Verified User Management / Access — 2026-06-25

Inspection only. No application code, Supabase migrations, RLS policies, package files, or workflows were changed.

Verified local evidence confirms:

- Supabase Auth is the current auth provider used by the frontend.
- `src/auth/AuthProvider.tsx` manages Supabase session state, redirect session exchange, sign-out, and magic-link sign-in.
- Magic-link sign-in is configured with `shouldCreateUser: false`, so local frontend email-link flow is invite-only at the Auth-user creation level.
- `src/pages/Login.tsx` also supports Google OAuth sign-in; whether Google OAuth can create new Auth users still needs remote Supabase Auth configuration verification.
- `src/auth/ProtectedRoute.tsx` currently checks only for an authenticated Supabase session before rendering protected routes.
- `src/hooks/useWorkspaceRole.ts` calls the `workspace-role-info` Edge Function to resolve workspace role/capabilities separately from route authentication.
- The local verified role values are `member`, `admin`, and `superadmin`.
- `supabase/functions/workspace-role-info/index.ts` validates a bearer token, resolves the authenticated user, calls backend access RPC logic with service role server-side, and maps roles to capabilities.
- `supabase/migrations/20260520_task19_fix_workspace_members_rls_recursion.sql` defines local role ranking for `member`, `admin`, and `superadmin`, plus RLS policies for `workspace_members`.

Needs verification before user-management implementation:

- `profiles` base table/model, columns, lifecycle, and RLS.
- `workspace_members` base DDL, full column contract, constraints, indexes, and remote policies.
- Invitation model and invitation flow.
- `audit_logs` base schema, RLS, and user-management audit coverage.
- Inactive/removed member behavior and whether access helpers filter only active memberships.
- First superadmin setup/bootstrap process.
- Complete permissions/capabilities contract, including remote definitions for access RPCs/views.
- Remote Supabase schema, deployed Edge Functions, and actual RLS/backend enforcement state.

Risk to preserve in future work:

- `ProtectedRoute` is currently session-only. Until a stronger app-level access contract is defined, workspace access enforcement must rely on backend/RLS/views/RPC/Edge Functions. Do not treat an Auth session as workspace access.

### Dashboard, Imports, and Data

Verified app pages include Overview, Conversions, Campaigns, Sales, Imports, Assistant, Onboarding, Bindings, Alerts, Ads Connectors, Login, and Not Found.

Verified data/dashboard-related files include:

- `src/pages/Overview.tsx`
- `src/pages/Conversions.tsx`
- `src/pages/Campaigns.tsx`
- `src/pages/Sales.tsx`
- `src/pages/Imports.tsx`
- `src/pages/Assistant.tsx`
- `src/pages/Bindings.tsx`
- `src/pages/Alerts.tsx`
- `src/pages/AdsConnectors.tsx`
- `src/data/mock.ts`
- `src/filters/DateContext.tsx`
- `src/preferences/PreferencesProvider.tsx`
- `src/preferences/SavedViewsProvider.tsx`

Existing audits include:

- `docs/overview-audit.md`
- `docs/imports-data-health-audit.md`
- `docs/audits/ads-connectors-audit.md`
- `docs/audits/ads-connectors-production-status.md`
- `docs/audits/missing-supabase-functions-source-report.md`
- `docs/audits/supabase-edge-functions-source-migration.md`

Dashboard metric definitions still need verification before dashboard expansion or UI polish.

### Repo-defined Commands

Verified package scripts:

- `npm run dev` / package-manager equivalent: `vite`
- `npm run build`: `vite build`
- `npm run build:dev`: `vite build --mode development`
- `npm run lint`: `eslint .`
- `npm run preview`: `vite preview`
- `npm run test`: `vitest run`
- `npm run test:watch`: `vitest`
- `npm run typecheck`: `tsc --noEmit`

Use repo-defined scripts for checks. Package manager choice remains needs verification.

---

## Blockers / Unknowns

- client approval not final
- current repo state needs verification
- current Supabase schema needs verification
- current dashboard metrics need definition/verification
- user management model needs verification

---

## Startup Instruction

At the start of a new session:

1. Read this file.
2. Read `DECISIONS.md`.
3. Read `NEXT_ACTIONS.md`.
4. Read `CHANGELOG.md`.
5. Read `USER_MANAGEMENT.md` if access/users are involved.
6. Inspect repo files.
7. Mark unknowns as `needs verification`.

## User Management Phase 1 Patch — 2026-06-26

A local Supabase migration was added for the first safe backend/RLS patch. It adds active/inactive/removed membership lifecycle status, backfills existing memberships as active, hardens role/access helper functions to require active membership, updates direct `workspace_members` RLS policies to use the hardened helper, hardens known permission/member views when present, and adds trigger protection for the last active `superadmin`.

Deferred items remain: invitations, user-management RPCs, first-superadmin bootstrap, user-management audit events, and remote deployment verification.
