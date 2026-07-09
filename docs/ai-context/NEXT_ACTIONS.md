## Updated — 2026-07-09 AdsConnectors Shared Operational Notice Completion

1. Verify `/ads-connectors` warning/info/success/muted operational notices and badges still match the previous visible behavior after deployment.
2. Reuse shared operational status components for warning, info, success, and muted states instead of creating page-local status/notice helpers.
3. Keep backend contracts unchanged; this follow-up did not change Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, data fetching, or write actions.

## Updated — 2026-07-09 Shared Operational UI Styles

1. Verify `/ads-connectors` and `/bindings` in Ukrainian and English after deployment to confirm shared operational badges, warning surfaces, compact summaries, and subnav triggers match the previous UI behavior.
2. Reuse shared status badge/surface and operational subnav helpers for future operational UI work instead of defining local Tailwind status classes in page files.
3. Keep backend contracts unchanged; this refactor intentionally did not change Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, data fetching, or write actions.

## Updated — 2026-07-09 Bindings Needs-Binding Warning State

1. Re-check `/bindings` in Ukrainian and English to confirm needs-binding states read visually as amber action-needed warnings, not neutral statuses.
2. Keep the direct gap-card binding drawer flow unchanged and continue treating AdsConnectors as the operational status surface.
3. Keep backend contracts unchanged unless a separately approved follow-up designs additional write automation.

## Updated — 2026-07-09 Bindings Gap Card Direct Binding Action

1. Verify `/bindings?tab=ad-account` against production readiness output to confirm account-gap cards can open the existing create binding drawer with the matched ad account preselected.
2. Confirm admins still choose client, project, and funnel manually, and unmatched diagnostic gaps show the safe refresh/check-Ads-Connectors helper instead of submitting fake IDs.
3. Keep AdsConnectors as the operational source/account/sync status page and Bindings as the remediation/action page.
4. Keep backend contracts unchanged; any future write automation beyond the existing binding-create-or-update flow requires a separate approved design.

## Updated — 2026-07-08 Bindings Ads Readiness UX Separation

- Verify `/bindings` in Ukrainian and English against production `build_ads_multi_account_readiness` output to confirm Overview shows only the compact actionable Ad accounts summary and Ad accounts shows friendly cards above the existing binding workflow.
- Keep AdsConnectors as the source/account/sync diagnostics area and Bindings / Mapping as the action area for fixing source/account/client/project/funnel mappings.
- Keep backend contracts unchanged; any future one-click binding/fix action needs a separate real write-action design and backend/RLS contract review.

## Next Actions — 2026-07-08 AdsConnectors Real Account Visibility Semantics

- Verify `/ads-connectors?tab=ad-accounts` against production readiness data to confirm Google Ads and Meta Ads bound accounts plus unbound Meta Ads / Olena Shepel and TikTok Ads / Insight Hub Test Advertiser all appear in Real accounts.
- Keep binding gaps read-only diagnostics in AdsConnectors; actual binding changes remain in Bindings / future explicitly designed write actions.
- Keep backend contracts unchanged unless a separate approved task changes Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, or sync behavior.

## Next Actions — 2026-07-07 AdsConnectors Status Filter Dropdown Alignment

- Verify `/ads-connectors?tab=ad-accounts` against the Bindings / Mapping → Ad accounts status filter pattern to confirm the dropdown alignment and mobile stacking match expectations.

## Next Actions — 2026-07-07 AdsConnectors Ad Accounts Polish

- Verify `/ads-connectors?tab=ad-accounts` in a browser after deployment to confirm the compact status toolbar fits on desktop and stacks compactly on mobile.
- Confirm expanded readiness details are readable cards/lists in Ukrainian and English and no longer look like raw/debug tables.
- Keep backend contracts unchanged; any actual binding fixes should remain in Bindings / future write-action work.

## 2026-07-07 AdsConnectors Ad Accounts Readiness UX Polish

- Verify `/ads-connectors?tab=ad-accounts` against production `build_ads_multi_account_readiness` output to confirm the compact summary appears above Real accounts cards and detailed readiness/gaps stay collapsed by default.
- Keep Bindings as the remediation surface for binding gaps; AdsConnectors remains read-only guidance for account/source/sync readiness.
- Keep non-production-safe “Operational readiness” wording while preserving “Real accounts” for real platform accounts; Bindings remains the place to actually fix binding gaps.

## Updated — 2026-07-07 Bindings Ads Binding Gap Readiness

- Verify `/bindings` against production `build_ads_multi_account_readiness` output to confirm Overview counters read from nested `summary` and Ad accounts renders `binding_gaps` rows next to the existing binding workflow.
- Keep AdsConnectors focused on source/account/sync readiness and Bindings focused on actual binding management plus read-only gap guidance.
- Design one-click binding fix actions separately before adding any backend write action; current gap guidance is read-only.
- Real Google/Meta/TikTok platform sync fixes remain deferred until real ad accounts/data are available.

## Updated — 2026-07-07 AdsConnectors Readiness Summary Shape

- Re-test `/ads-connectors` against production `build_ads_multi_account_readiness` to confirm nested `summary` counters render correctly.
- Keep actual binding-gap write workflows deferred to a future explicit design in `/bindings`.

## Updated — 2026-07-07 AdsConnectors Multi-Account Readiness

- Verify the existing `/ads-connectors` Overview, Ad accounts, and Diagnostics tabs against production `build_ads_multi_account_readiness` output.
- Keep actual binding management in `/bindings`; do not add AdsConnectors write actions until the write workflow is explicitly designed.
- Defer real Google/Meta/TikTok sync fixes until real ad accounts/data are available.

## Updated — 2026-07-07 Imported Ads Facts Production Hotfix Mirror

1. Treat the imported ads facts backfill as deployed and production-verified for the historical imported range: 240 rows were read and 240 rows were inserted/upserted into `facts_ads_daily` for 2026-04-01 through 2026-05-05.
2. Remember that imported historical facts use `platform = other` due to the production `facts_ads_daily_platform_check`; use the deterministic `fact_key` prefix `imported:` to identify imported-backfill facts.
3. Use `facts_ads_daily` as the primary AI ads context source for this historical imported window because production now reports `source_layer_used = facts_ads_daily` and `fallback_used = false`.
4. Keep real Google/Meta/TikTok live platform sync fixes deferred until real platform accounts/data are available; do not change frontend UI, OAuth, live sync, RLS, Edge Function contracts, `build_ai_ads_context` signature, or `ai-helper-run` contracts for this follow-up.

## 2026-07-07 — Imported Ads Facts Backfill Follow-up

1. Deploy the `rebuild_imported_ads_facts(uuid, date, date)` migration to Supabase and run it for the target workspace/date range containing historical imported ads data.
2. Verify `facts_ads_daily` receives imported historical rows with deterministic `fact_key`, explicit `level = campaign`, and imported reach mapped to `impressions` and that `build_ai_ads_context.source_layer_used` switches to `facts_ads_daily` once facts are populated.
3. Keep real Google/Meta/TikTok sync fixes deferred until real production ad accounts/data are available; this imported backfill path does not validate live platform sync.
4. Continue avoiding frontend UI, OAuth, live sync behavior, RLS, secrets/token storage, and `ai-helper-run` contract changes unless separately approved.

## 2026-07-07 — Ads Source Readiness Follow-up

1. Deploy and verify the `source_readiness` diagnostics with the current workspace, confirming test/empty Google Ads, Meta Ads, and TikTok Ads accounts report `connected_no_production_data`, `connected_with_imported_fallback`, `needs_real_ad_account`, or `platform_permission_or_access_blocked` as appropriate rather than being treated only as broken production sync.
2. Continue using historical imported fallback ads data for AI analysis until real platform data exists.
3. Defer real Google/Meta/TikTok sync behavior fixes until real ad accounts or imported current platform data with spend/leads are available for validation.
4. Keep frontend UI, OAuth flows, sync schedules, RLS, secrets/token storage, and `ai-helper-run` request/response contract unchanged unless a separate approved task requires them.

## Updated — 2026-07-07 Ads Pipeline Diagnostics Production Hotfix Mirror

1. Deploy/confirm the GitHub migration mirror matches the already-applied Supabase production hotfix for `build_ads_pipeline_diagnostics(uuid, date, date)`, especially `ad_traffic_raw.day` date-column detection and the returned `raw_data_state.ad_traffic_raw.date_column`.
2. Resolve the first live blocker detected by diagnostics: Google Ads `google_ads_permission_denied`.
3. Investigate secondary observed ads pipeline issues: Meta/TikTok latest successful syncs returned 0 rows, `facts_ads_daily` remains empty, and AI currently uses historical imported fallback data until fresh API facts are available.
4. Keep this follow-up limited to the diagnostics migration/source and docs/tests; do not change frontend UI, OAuth flows, sync execution behavior, RLS, Edge Function contracts, or the `ai-helper-run` request/response contract.

---


## 2026-07-07 — Ads Multi-Account Readiness Diagnostics Follow-Up

1. Deploy/verify `build_ads_multi_account_readiness(uuid)` in Supabase and confirm it reports the observed production shape: Meta has multiple discovered accounts with one binding, Google Ads has one discovered account with multiple bindings, and TikTok has a discovered account with no binding.
2. Add an admin/source-management UI surface that displays `multi_account_readiness` platform/account rows and binding gaps so operators can bind each real ad account to the correct client/project/funnel.
3. Keep real Google/Meta/TikTok live platform sync fixes deferred until real production accounts/data are available.
4. Keep frontend UI, OAuth, live sync behavior, RLS, secrets/token storage, `build_ai_ads_context` signature, and `ai-helper-run` contract unchanged unless separately approved.

# NEXT_ACTIONS.md

## Purpose

Current next actions for Internal Analytics Workspace.

---


## Updated — 2026-07-07 AI Helper Senior Performance Marketing Analyst Prompt

1. Review the upgraded `ai-helper-run` Senior Performance Marketing Analyst prompt in staging with ads contexts that use both primary `facts_ads_daily` data and fallback/imported unified ads data.
2. Verify assistant answers clearly separate known data from hypotheses, mention stale/fallback/imported data when present, and avoid last-7-days conclusions when freshness is false.
3. Keep future improvements prompt/playbook-only unless a separate approved PR changes backend contracts; this PR made no database schema, RLS, RPC signature, frontend UI, route, OAuth, sync logic, or chat history changes.
---


## Updated — 2026-07-07 AI Ads Context Fallback

1. Deploy and verify the new ads pipeline diagnostics migrations in Supabase against workspace `5ebbe435-fd79-44c3-834e-642e8fba00dc`, confirming `build_ads_pipeline_diagnostics` and `build_ai_ads_context.pipeline_diagnostics` identify the first broken stage across connection/account/binding/raw/fact/AI context layers.
2. Fix the known current ads pipeline blockers before judging AI answer quality: Google Ads `PERMISSION_DENIED`, Meta/TikTok successful zero-row syncs, empty `facts_ads_daily`, and fallback-only historical imported ads data; OAuth credentials, frontend UI, routes, and sync schedules were not changed here.
3. Once fresh API facts are available, verify `build_ai_ads_context` returns to the primary `facts_ads_daily` source without fallback.

2026-07-07 update: AI Assistant empty-state refinement is complete. The page now feels closer to a ChatGPT/Claude-style start screen with a lighter centered canvas, compact floating composer that expands only for longer input, tighter suggested prompt chips under the composer that disappear after first interaction, and first-screen spacing designed to fit a normal laptop viewport. Response history remains hidden from the primary UI. No backend/RPC/RLS/schema/route/permission/Edge Function contract changes were made. Next step remains Imports / Data Health micro-polish only if needed, then backend AI-assisted mapping audit.


2026-07-07 update: AI Assistant chat-mode alignment and reset polish is complete. Messages, full-width assistant answer cards, loading/error states, composer, starter prompts, and the safety note now share one centered chat column; composer focus styling is handled by the outer rounded container; and an explicit New chat / Новий чат action resets the current in-memory chat back to the starter screen. Persistent chat history remains deferred and no backend/RPC/RLS/schema/route/permission/Edge Function contract changes were made.

## Current Priority



2026-07-06 update: AI Assistant main screen simplification is complete. The page now presents one clean chat surface with a centered welcome state, suggested marketing prompt cards, a bottom composer, compact analysis mode selector, and one muted safety note. Response history is hidden from the primary UI until a proper chat/session history UX is designed. No backend/RPC/RLS/schema/route/permission/Edge Function contract changes were made. Next step remains Imports / Data Health micro-polish only if needed, then backend AI-assisted mapping audit.

2026-07-06 update: Final AI Assistant layout polish is complete. Chat is the primary surface, History is secondary/collapsed by default with at most three latest items shown when opened, the safety note is lighter near the welcome/composer, and analysis modes are marketing-oriented. No backend/RPC/RLS/schema/route/permission/Edge Function contract changes were made. Next step remains Imports / Data Health micro-polish only if needed, then backend AI-assisted mapping audit.

Continue verification of user management, Supabase security, and dashboard metric definitions before feature expansion.

2026-07-06 sidebar structure update: Overview has been moved from Analytics into Workspace in the frontend sidebar. Admin remains collapsible and auto-opens for active Admin routes. This PR intentionally makes no backend, route, permission, RLS, Supabase schema/object, or new-page changes. Users & Access remains deferred as a security-sensitive feature, and role-aware sidebar filtering should wait for a safe role/capability sidebar contract if needed.

2026-07-05 update: Data Bindings manual/admin UX copy has been clarified and the visible page/ad-account workflow text has been routed through existing Ukrainian/English i18n before AI-assisted mapping/autobinding work. Final copy polish aligned Overview, project bindings, mapping status, and technical-mode labels without changing backend behavior; next mapping/autobinding work should still define backend/RLS/RPC contracts before implementation.


2026-07-06 update: AI Assistant frontend polish is complete. The page is now a chat-style prepared-data assistant with suggested prompts, compact context selection, secondary response history, and hidden technical details. The assistant is explicitly read/explain-only and does not directly modify data. No backend, RPC, RLS, schema, route, Edge Function contract, or permission behavior changed. Next step remains Imports / Data Health micro-polish only if needed, then backend AI-assisted mapping audit.

---

2026-07-06 update: Telegram / Alerts UI was clarified before AI-assisted mapping/autobinding work. Copy, i18n, empty states, technical-details placement, and safe UI action visibility were polished without backend, RPC, RLS, Edge Function contract, or schema changes. Telegram remains the HITL confirmation surface for future mapping review flows.

2026-07-06 update: The sidebar admin/control-center group was clarified from Operations to Admin and made collapsible using the existing sidebar/collapsible UI pattern, with active admin routes auto-opening the group. No backend, RLS, permission, route, or page changes were made.


2026-07-06 audit update: Remaining frontend admin/control-center pages were inspected before backend AI-assisted mapping work. Frontend-ready as-is: Admin sidebar structure, Telegram / Alerts, Data Bindings / Mapping, and Overview as a high-level operational entry point. Needs frontend polish before backend mapping work: Onboarding should get bilingual i18n and friendlier admin copy around hierarchy/health/editing states; AI Assistant should use existing i18n, clearer safe-disabled/no-access/loading states, and less prominent debug details; Imports / Data Health may need small copy/empty-state polish only after reviewing live data-health wording in UX. Ads Connectors is safe to keep and mostly polished, but should not add fake Google/TikTok actions beyond verified OAuth/sync contracts. Users & Access must remain deferred: local/verified backend foundations include active-aware membership status, role/capability helpers, and permission/member views, but direct member view grants are revoked and invitation/action RPC/audit/bootstrap contracts are still missing. Do not add a Users & Access page until safe read RPC/view access and write RPC/audit/RLS contracts are verified.


2026-07-06 update: Onboarding frontend polish was completed before backend AI-assisted mapping work. Visible page copy now uses Ukrainian/English i18n, explains the client → project → funnel analytics hierarchy in admin-facing language, improves empty/loading/error/no-access states, and keeps technical IDs/details collapsed. Follow-up cleanup localized unexpected backend response fallback errors for onboarding saves. No backend, RPC, RLS, schema, route, Edge Function contract, or permission changes were made.

Recommended remaining PR order before backend AI-assisted mapping work:

1. AI Marketing Analyst backend path follow-up: deploy/verify ads pipeline diagnostics, then add or document source-of-truth DDL for raw ads tables/RPCs, `facts_ads_daily`, `rebuild_ads_daily_facts`, AI ads context views, and `build_ai_ads_context`.
2. AI Assistant frontend polish only: route visible copy through UK/EN i18n, clarify that it uses prepared/verified data, improve no-access/loading/error states, and keep existing `ai-helper-run` contract unchanged.
3. Imports / Data Health micro-polish if needed: refine labels/empty states for rejected rows, mapping review, alerts, and safe links to Data Bindings / Telegram / Ads Connectors without changing queries or actions.
4. Users & Access backend-contract PR: verify/create safe read model, invitations, member lifecycle action RPCs, audit events, first-superadmin/bootstrap rules, and deployed RLS before any management UI.
5. Users & Access frontend PR only after step 4: read-only member list first, then invite/deactivate/role-change UI only through verified backend contracts.

Future admin page: Users & Access / Користувачі й доступи. Purpose: invite users by email, assign workspace roles, deactivate access, and audit changes. Treat this as a separate security-sensitive admin feature that requires backend/RLS/RPC/audit contract verification before UI implementation.

## Task: Add Project Context Files

Priority: high
Status: completed from local repo inspection on 2026-06-25

2026-06-25 update: required context files are present and readable in the local repository.

Add:

```text
AGENTS.md
docs/ai-context/PROJECT_STATE.md
docs/ai-context/DECISIONS.md
docs/ai-context/NEXT_ACTIONS.md
docs/ai-context/CHANGELOG.md
docs/ai-context/CONTEXT_UPDATE_PROTOCOL.md
docs/ai-context/USER_MANAGEMENT.md
docs/ai-context/GLOSSARY.md
```

Acceptance criteria:

- files exist
- no secrets
- project stack is Codex + Supabase + GitHub
- client approval marked not final
- USER_MANAGEMENT included in routing

---

## Task: Inspect Current Repo State

Priority: high
Status: completed from local repo inspection on 2026-06-25

Codex should inspect:

- repo structure
- package manager
- frontend framework
- Supabase structure
- migrations
- RLS policies
- Edge Functions
- env examples
- dashboard pages
- auth/user logic
- build/test scripts

Then update `PROJECT_STATE.md`.

2026-06-25 update: local repo structure, frontend stack, Supabase folders, auth files, dashboard/import files, and package scripts were inspected and recorded in `PROJECT_STATE.md`. Remote Supabase production state and package-manager choice still need verification.

---

## Task: Verify Package Manager

Priority: medium
Status: upcoming

The repository contains both `package-lock.json` and `bun.lockb`.

Verify which package manager is canonical before changing dependencies or documenting install commands.

---

## Task: Verify Remote Supabase Contracts

Priority: high
Status: partially completed for Phase 1 user-access hardening on 2026-06-26; broader remote contract verification still upcoming

Compare local migrations/types with remote Supabase objects used by the frontend, especially views and RPCs referenced by dashboard/import pages.

Do not assume remote objects exist only because frontend code references them.


---

## Task: Verify and Define User Management Model

Priority: high
Status: Phase 1 backend/RLS hardening applied and verified on 2026-06-26

2026-06-26 update: Phase 1 active-membership backend/RLS hardening was merged, manually applied to remote Supabase, and verified.

Still needs definition/implementation in later phases:

- invitation model and flow
- `profiles` lifecycle details beyond the base model
- `audit_logs` schema and user-management audit coverage
- first superadmin setup/bootstrap contract
- user-management RPCs for invite, accept, revoke, deactivate, reactivate, remove, and role change

---


## Task: Verify Remote Supabase Schema and RLS for User Management

Priority: high
Status: partially completed for Phase 1 user-access hardening on 2026-06-26; broader remote contract verification still upcoming

Compare local repository expectations with remote Supabase objects for:

- `profiles`
- `workspace_members`
- any invitation table/model if present
- `audit_logs`
- access helper functions and RPCs
- permission views such as current-user permissions if present
- RLS policies affecting user access and workspace data
- deployed Edge Function configuration for user/workspace access

Acceptance criteria:

- actual table names, columns, constraints, and indexes are documented
- RLS policies are inventoried without weakening them
- inactive/removed/pending access behavior is confirmed or marked missing
- first superadmin setup is confirmed or marked missing
- no secrets are read or exposed

---

## Task: Deploy and Verify Phase 1 User Access Hardening

Priority: high
Status: completed on 2026-06-26

`supabase/migrations/20260626_phase1_active_membership_access_hardening.sql` was merged, manually applied to remote Supabase, and verified.

Verified:

- existing `workspace_members` rows are `active`
- central role/access helpers are active-only through `workspace_members.status = 'active'`
- direct `workspace_members` INSERT/UPDATE/DELETE policies are superadmin-only
- `enforce_workspace_member_management_rules` trigger exists for INSERT/UPDATE
- `prevent_last_active_superadmin_change` trigger exists for UPDATE/DELETE
- `set_workspace_members_updated_at` trigger exists for UPDATE
- `v_current_user_permissions` is active-aware and `security_invoker=true`
- `v_workspace_members_with_permissions` is active-aware and `security_invoker=true`
- `v_workspace_members_with_permissions` has no direct `SELECT` grant for `anon` or `authenticated`

Remaining follow-up:

- verify Edge Function access behavior for inactive/removed memberships when test users/fixtures are available
- define invitation/user-management RPC contract before UI work

---

## Task: Define Target Invitation / Status / User-Management Contract

Priority: high
Status: later / blocked by remote schema and RLS verification

Before any user-management UI implementation, define the approved target contract for:

- profile lifecycle
- workspace membership lifecycle
- invitation creation/acceptance/revocation
- allowed member statuses
- role assignment and role-change rules
- inactive/removed access denial
- first superadmin setup
- user-management audit events
- backend/RLS enforcement points

Do not add frontend user-management screens until backend/RLS access behavior is explicit and reviewable.

---

## Task: Verify Source Binding Idempotency

Priority: medium
Status: upcoming

Manual ad account binding idempotency is addressed locally by migration `20260704_make_ad_account_binding_idempotent.sql`. Local repository inspection did not find the existing `public.bind_source_entity_to_scope` SQL definition, so verify the deployed remote source-binding function and any source binding table constraints/indexes for the same duplicate-active-row risk.

Acceptance criteria:

- confirm the remote `public.bind_source_entity_to_scope` implementation
- confirm source binding natural key and active/archived status values
- add idempotent update-before-insert behavior and an active-only DB guard if the deployed source binding path has the same duplicate risk
- do not weaken RLS or delete production data


## Task: Define Dashboard Metrics

Priority: high
Status: upcoming

For each metric define:

- name
- business meaning
- source table/view/file
- source fields
- formula
- date logic
- filters
- exclusions
- limitations

Do not build UI before metric logic is clear.

---

## Task: Review Supabase Security State

Priority: high
Status: upcoming

Review:

- RLS
- anon/service role usage
- Edge Function auth
- storage policies
- role checks
- frontend env exposure

Do not weaken security.

---

## Ongoing Rule: Update Context After Meaningful Work

After meaningful work, update:

- PROJECT_STATE.md
- DECISIONS.md
- NEXT_ACTIONS.md
- CHANGELOG.md
- USER_MANAGEMENT.md if users/access changed
- GLOSSARY.md if terms changed
