## 2026-07-07 — Imported Ads Facts Backfill

### Added

- Added additive Supabase RPC `rebuild_imported_ads_facts(uuid, date, date)` to rebuild historical imported ads performance from `v_unified_ads_performance_daily` into `facts_ads_daily` without requiring live Google/Meta/TikTok production accounts.
- Added an idempotency guard for the imported facts grain so repeated workspace/date backfills upsert instead of duplicating facts.
- Added source-level tests for the imported source read path, `facts_ads_daily` upsert path, workspace/date scoping, JSON summary fields, unchanged `build_ai_ads_context` signature, unchanged `ai-helper-run` contract, and no truncate/delete/global destructive cleanup.

### Notes

- AI context already prefers `facts_ads_daily` when facts exist, so no `build_ai_ads_context` signature or Edge Function contract change was needed.
- This path is for historical imported ads data and does not change OAuth, live sync behavior, tokens/secrets, frontend routes, or RLS.
- Real Google/Meta/TikTok sync fixes remain deferred until real production accounts/data are available.

## 2026-07-07 — Ads Source Readiness Diagnostics

### Added

- Added `source_readiness` to `build_ads_pipeline_diagnostics` beside the existing blocker diagnosis so empty/test ad account states are not confused with broken production sync.
- Added stable source readiness statuses: `not_connected`, `needs_real_ad_account`, `connected_no_production_data`, `connected_with_imported_fallback`, `platform_permission_or_access_blocked`, and `production_data_ready`.
- Extended `build_ai_ads_context` to include `source_readiness` from pipeline diagnostics without changing the function signature or `ai-helper-run` request/response contract.
- Added source-level tests for readiness fields/codes, AI context inclusion, unchanged contracts/signatures, and no token/secret field exposure.

### Notes

- Google Ads, Meta Ads, and TikTok Ads connectors in this project are currently test/empty/non-production or not validated with real spend/leads.
- Real Google/Meta/TikTok platform sync fixes are intentionally deferred until real ad accounts or real platform data are available for validation.
- Historical imported fallback data remains available for AI analysis even when current API facts are empty.
- No frontend UI, OAuth flows, sync behavior/schedules, RLS, or secrets/token storage changed.

## 2026-07-07 — Ads Pipeline Diagnostics Production Hotfix Mirror

### Changed

- Mirrored the production hotfix for `build_ads_pipeline_diagnostics(uuid, date, date)` so `ad_traffic_raw` diagnostics dynamically detect the date column in priority order: `metric_date`, `day`, then `insight_date`.
- Added `date_column` to the returned `raw_data_state.ad_traffic_raw` JSON and kept a no-date-column fallback that counts workspace rows without date filtering.
- Verified `latest_failed_run_by_platform` JSON includes valid key/value pairs for `platform`, `date_from`, `date_to`, and sanitized `error_message`.
- Added source-level tests for the production `ad_traffic_raw.day` schema support, no hardcoded date filter dependency on `metric_date`, `date_column`, and failed-run JSON fields.

### Notes

- Production diagnostics now works with the real `ad_traffic_raw.day` schema.
- First live blocker detected: `google_ads_permission_denied`.
- Secondary observed issues: Meta/TikTok latest successful syncs returned 0 rows, `facts_ads_daily` remains empty, and AI uses historical imported fallback data.
- No frontend UI, OAuth flows, sync execution behavior, RLS, Edge Function contracts, or `ai-helper-run` request/response contract changed.


## 2026-07-07

### Added

- Added safe backend Ads Pipeline Diagnostics through a read-only Supabase RPC, `build_ads_pipeline_diagnostics`, summarizing connection/account/binding state, raw ads rows, imported ads rows, facts, AI context views, latest sync runs, sanitized sync errors, first blocker code/message, and platform blockers.
- Extended `build_ai_ads_context` to include `pipeline_diagnostics`, `first_blocker_code`, `first_blocker_message`, and `platform_blockers` without changing the existing function signature or the `ai-helper-run` request/response contract.
- Added source-level tests proving the diagnostics migration exists, avoids token/secret fields, includes blocker codes, preserves the ads context RPC signature, and keeps the AI helper contract unchanged.

### Notes

- Known current ads pipeline blockers remain Google Ads `PERMISSION_DENIED`, Meta/TikTok successful zero-row syncs, empty `facts_ads_daily`, and fallback-only historical imported data through unified ads performance views.
- No OAuth credentials, access tokens, service role keys, RLS weakening, frontend UI, routes, sync schedules, platform API credentials, or user permission model behavior were changed.

# CHANGELOG.md

## Purpose

Meaningful changes for Internal Analytics Workspace.

---


## 2026-07-07 — AI Helper Senior Performance Marketing Analyst Prompt

### Changed

- Upgraded `ai-helper-run` from a generic internal analytics assistant prompt to a Senior Performance Marketing Analyst framework for a performance agency.
- Added CMO-style campaign diagnosis guidance and CFO-style budget/unit-economics guidance for ads-context answers.
- Added explicit response rules for stale, fallback/imported, missing, or incomplete data, including avoiding last-7-days trend claims when context freshness does not support them.
- Extended OpenAI `response_requirements` with the marketing analyst role, CMO/CFO/data-quality lenses, Ukrainian section guidance, and constraints against invented revenue, ROAS, client/funnel attribution, or unsupported actions.
- Added source-text tests for the prompt framework, response requirements, RPC payload shape, and unchanged `ai-helper-run` request/response contract.

### Notes

- No database schema, RLS policies, database tables/views, RPC signatures, Edge Function name, `ai-helper-run` request/response contract, auth/workspace role checks, OAuth, sync logic, frontend UI, routes, or chat history/session architecture were changed.
---


## 2026-07-07 — AI Assistant Chat Mode Alignment

### Changed

- Fixed AI Assistant chat-mode alignment so user messages, full-width assistant response cards, loading/error states, composer, starter prompts, and the safety note share one centered chat column.
- Cleaned composer focus styling by removing the textarea's separate visible border/focus ring and applying focus treatment to the outer rounded composer container.
- Added explicit localized New chat / Новий чат action that clears current in-memory messages, prompt, and visible error state, returning to the starter screen while preserving the selected analysis mode.

### Notes

- Persistent chat history was not implemented yet.
- Frontend-only change. No backend logic, RPC calls, Supabase schema, RLS policies, routes, permission logic, database tables/views, existing analysis mode backend mappings, Edge Function name, or `ai-helper-run` request/response contract were changed.
## 2026-07-07 — AI Ads Context Fallback and RPC Contract Fix

### Changed

- Fixed the `ai-helper-run` to `build_ai_ads_context` RPC contract mismatch by removing unsupported `p_context_scope` from the database payload while keeping frontend request types and context scopes unchanged.
- Added a Supabase migration for `build_ai_ads_context` that keeps facts-based ads context primary and safely falls back to `v_unified_ads_performance_daily` / `v_unified_ads_performance_summary` when `facts_ads_daily` is empty.
- Added AI ads context freshness metadata, including available date range, latest sync timestamp when available, fact/unified row counts, freshness status, warning text, source layer used, health, summaries/top campaigns, anomaly candidates when available, and notes.
- Added tests covering the RPC payload contract, migration fallback/freshness fields, and the facts-vs-unified date-column contract (`insight_date` for facts/AI daily context, `metric_date` for unified imported ads data).

### Notes

- The AI Assistant can now explain that fresh API facts are missing while historical imported ads data is available for analysis.
- No RLS/auth/OAuth/real sync/chat-history changes were made. No fake ads facts, visible Auto context, unsupported action buttons, frontend UI changes, or route changes were added.

## 2026-07-07 — AI Marketing Analyst Backend Path Audit

### Added

- Added a read-only AI Marketing Analyst backend path audit covering ads sync functions, scheduled sync orchestration, raw-to-fact expectations, AI ads context views, `ai-helper-run` ads scopes, why the current workspace has zero AI-ready ads metrics, required backend fixes, proposed context architecture, recommended next PRs, and risks.

### Notes

- Documentation-only change. No production code, migrations, RLS policies, Edge Function contracts, Supabase schema objects, or frontend behavior were changed.

## 2026-07-07 — AI Assistant ChatGPT-Style Start Screen

### Changed

- Refined the AI Assistant empty state toward a clean ChatGPT/Claude-style start screen with a lightweight centered chat canvas instead of a heavy dashboard-card frame.
- Tightened first-screen spacing so the page title/subtitle, welcome icon/title/body, suggested prompts, compact composer, and one safety note are designed to fit in one normal laptop viewport.
- Changed the composer into a compact floating chat input that starts around one line tall, auto-expands only for longer multiline input, caps height around 176px, and scrolls internally beyond that.
- Moved suggested marketing prompts under the composer, made them visually lighter and compact, preserved the existing prompt texts, and hide them after the first prompt/message interaction.
- Kept response history hidden from the primary UI.

### Notes

- Frontend-only change. No backend logic, RPC calls, Supabase schema, RLS policies, routes, permission logic, database tables/views, existing analysis mode backend mappings, Edge Function name, or `ai-helper-run` request/response contract were changed.


## 2026-07-06 — AI Assistant Simplified Chat Surface

Changed:

- Simplified the AI Assistant main screen into one clean ChatGPT/Claude-style chat surface with a centered welcome state, suggested prompt cards, bottom composer, and compact analysis mode selector.
- Hid response history from the primary AI Assistant UI until a proper chat/session history UX is designed.
- Updated the Ukrainian and English welcome copy and safety note to the approved simplified wording.
- Kept the existing marketing suggested prompts and analysis mode backend mappings, with Full overview as the default and no visible Auto context.
- Updated assistant UI tests for hidden history UI, approved UK/EN copy, suggested prompts, unsupported action labels, and the unchanged `ai-helper-run` request body mapping.

Safety / scope:

- Frontend-only change. No backend logic, RPC calls, Supabase schema, RLS policies, routes, permission logic, database tables/views, Edge Function name, or `ai-helper-run` request/response contract were changed.

## 2026-07-06 — AI Assistant Visual Micro-Polish

Changed:

- Moved the AI Assistant history trigger into the chat card header as a secondary compact control instead of a detached control above the chat.
- Kept the opened history dropdown attached to the trigger, compact, scrollable with max height, limited to three latest items, and with technical details still collapsed.
- Reduced vertical spacing in the empty welcome state so prompts and composer are visible with less blank space on large screens.
- Updated the Ukrainian and English assistant subtitle copy to the approved performance-marketing wording.

Safety / scope:

- No backend logic, RPC calls, Supabase schema, RLS policies, routes, permissions logic, database tables/views, Edge Function name, `ai-helper-run` request/response contract, suggested prompts, or analysis mode backend mappings were changed.


## 2026-07-06 — AI Assistant Final Layout Polish

Changed:

- Completed final frontend-only AI Assistant layout polish after the chat-style redesign.
- Made chat the clear primary surface and replaced the large always-visible right history column with a compact collapsed History panel.
- Kept history data reading behavior intact while showing a maximum of three latest items when opened and keeping technical details collapsed under Technical details / Технічні деталі.
- Moved the safety note into lighter helper text near the welcome/composer area.
- Updated welcome copy and analysis modes for performance-marketing agency workflows, with Full overview as the default and no visible Auto context.

Safety / scope:

- No backend logic, RPC calls, Supabase schema, RLS policies, routes, permissions logic, database tables/views, Edge Function name, or `ai-helper-run` request/response contract were changed.



## 2026-07-06

### Changed

- Corrected the frontend-only sidebar navigation structure so Overview is listed under Workspace, while Analytics now starts with Conversions and keeps Campaigns, Sales / Revenue, and Imports / Data Health.
- Kept the Admin group collapsible, expanded by default, and auto-opened for active Admin routes, without changing icon-collapsed sidebar behavior.

### Notes

- No backend logic, routes, permissions, RLS policies, Supabase schema/objects, or new pages were changed.
- Users & Access was not added; it remains a future security-sensitive feature. Role-aware sidebar filtering remains deferred until safe role/capability data is intentionally wired into the sidebar.


### Changed

- Refined AI Assistant frontend positioning for performance marketing analytics: removed the visible Auto context option, made Full overview the default context, updated assistant subtitle/welcome copy, replaced suggested prompt cards with Ukrainian/English performance-marketing prompts, and made response history secondary with a collapsed three-item maximum.

### Notes

- Kept the existing `ai-helper-run` request/response contract unchanged. No backend/RPC/RLS/schema/routes/permissions changes were made.



### Changed

- Redesigned the AI Assistant frontend into a chat-style assistant surface with a central conversation area, welcome message, suggested prompt cards, compact context selector, bottom composer, user/assistant bubbles, thinking/error/no-access states, and secondary previous-response history.
- Added Ukrainian/English i18n copy for the AI Assistant title, subtitle, safety note, composer, context labels, suggested prompts, history labels, empty/loading/error states, and technical details.
- Kept raw IDs, request scopes, payloads, response metadata, role diagnostics, and saved-response debug data hidden behind localized technical-details blocks.

### Notes

- The assistant explains prepared workspace data and does not directly modify data.
- No backend logic, RPC calls, RLS policies, Supabase schema, routes, permission logic, database tables/views, Edge Function name, or `ai-helper-run` request/response contract were changed.
- Next step remains Imports / Data Health micro-polish only if needed, then backend AI-assisted mapping audit.


### Audited

- Audited remaining frontend admin/control-center surfaces before backend AI-assisted mapping work: Onboarding, Ads Connectors, AI Assistant, Imports / Data Health, Overview touchpoints, the Admin sidebar, and possible Users & Access foundations.
- Confirmed the audit is documentation/planning only: no backend logic, RPC signatures, RLS policies, Supabase schema, or frontend behavior were changed.

### Findings

- Admin sidebar, Data Bindings / Mapping, Telegram / Alerts, Ads Connectors, and Overview are safe to keep before backend mapping work.
- Onboarding needs frontend polish around Ukrainian/English i18n, non-technical purpose, empty states, loading/error/no-access copy, and secondary placement of technical details.
- AI Assistant needs frontend polish around Ukrainian/English i18n, prepared-data boundaries, safe disabled/no-access/loading/error states, and less prominent debug details.
- Imports / Data Health may need only small copy/empty-state refinements after live UX review; it should continue linking operational follow-up to Data Bindings, Telegram / Alerts, and Ads Connectors without backend changes.
- Users & Access has partial backend foundations for active memberships and capabilities, but no complete safe frontend read/write contract for invitations, role changes, deactivation/reactivation/removal, audit events, or bootstrap. It remains deferred.

### Recommended PR order

1. Onboarding frontend polish only.
2. AI Assistant frontend polish only.
3. Imports / Data Health micro-polish only if needed.
4. Users & Access backend/RLS/RPC/audit contract verification/implementation.
5. Users & Access frontend, starting read-only and adding writes only through verified contracts.

### Must not fake

- Do not show invite, role-change, deactivate/remove/reactivate, connector, mapping approval, or AI actions as working unless the corresponding backend/RLS/RPC/Edge Function contract is verified.


### Changed

- Clarified the Onboarding page frontend before backend AI-assisted mapping work. Visible admin copy now explains that admins prepare the analytics hierarchy of clients, projects, and funnels before linking data sources and ad accounts to the right level.
- Routed Onboarding page titles, descriptions, labels, buttons, empty/loading/error/no-access states, toasts, status labels, and technical-detail labels through the existing Ukrainian/English i18n dictionary.
- Kept workspace/client/project/funnel IDs, view field lists, health counters, and unnamed-record diagnostics secondary inside collapsed technical details.
- Added frontend tests that verify key Onboarding copy is bilingual, technical IDs remain secondary, and no fake invite/member/access actions were added.
- Localized the Onboarding Edge Function unexpected-response fallback errors so raw developer strings such as `Client upsert failed`, `Project upsert failed`, and `Funnel upsert failed` are not shown as primary admin-facing form/toast copy.

### Notes

- No backend logic, Edge Function names or payload shapes, RPC signatures, RLS policies, Supabase schema, routes, or permission logic were changed.


## 2026-07-06

### Changed

- Clarified the left sidebar admin/control-center section by renaming Operations to Admin in Ukrainian and English, keeping the existing Onboarding, Data Bindings / Mapping, Telegram / Alerts, and Ads Connectors items under it.
- Made the Admin sidebar group collapsible in the expanded desktop sidebar using the existing collapsible UI pattern; active admin routes auto-open the group and icon-collapsed sidebar behavior remains unchanged.

### Notes

- No backend logic, RLS policies, permissions, routes, Supabase objects, or new pages were changed.
- Users & Access / Користувачі й доступи remains planned as a separate security-sensitive admin feature for email invitations, workspace role assignment, access deactivation, and audit history.

### Changed

- Applied final Telegram / Alerts plain-language polish after PR #192: removed the default visible security/status note from normal page load, renamed routes to notification rules, showed friendly rule/event labels before technical route values, translated common technical health headers, and moved resolved operational alerts into collapsed recent history when no open alerts are present.

### Notes

- No backend logic, RPC signatures, RLS policies, Edge Function contracts, database schema, or action behavior were changed.


### Changed

- Clarified the Telegram / Alerts page before AI-assisted mapping/autobinding work with bilingual Ukrainian/English copy, friendlier overview/health summaries, improved empty states, localized table/value labels, and collapsed technical details for raw health/error payloads.
- Adjusted UI-only button guards so empty queues do not show an active send action, empty confirmation requests do not show an open action, and already resolved operational alerts show an “Already resolved” badge instead of a close button.

### Notes

- No backend logic, database schema, RPC signatures, RLS policies, or Edge Function contracts were changed.
- Telegram remains the HITL confirmation surface for future mapping review flows.

## 2026-07-05

### Changed

- Finished Data Bindings / Bindings Mapping copy polish: moved the Overview intro into the helper block, removed mixed English from Ukrainian ad-account copy, aligned project binding tab and section labels, kept the mapping status tab label distinct from Ads Connectors, and localized the advanced technical-mode label.
- Polished Data Bindings Overview helper copy in Ukrainian and English to use clearer admin-facing language for files/tables, ad-account bindings, automatic review items, and the no-manual-review state. Renamed the Data Bindings health tab to “Стан мапінгу” / “Mapping status” as a copy-only change.
- Completed the Data Bindings bilingual i18n pass by moving the remaining visible page states, ad-account workflow copy, technical-flow feedback, table labels, and mapping/Telegram health helper text into existing Ukrainian/English translations.
- Clarified the Data Bindings manual/admin UX before AI-assisted mapping/autobinding: polished overview/source/project/mapping-review/health tab titles, descriptions, and empty states without backend, RPC, or RLS changes.
- Polished the Data Bindings “Рекламні акаунти” section header by merging the title, description, status filter, and primary action into one compact admin header with a fixed-width status select.
- Finished separating Data Bindings ad-account drawer and technical UUID feedback: normal drawer errors now stay inside the drawer and successful normal saves use toast only, while technical UUID success/error feedback stays inside the collapsed advanced block.
- Polished the Data Bindings “Рекламні акаунти” drawer UX: separated normal drawer state from the advanced UUID form state, added create-vs-update success toast copy, made success toasts more visually distinct, switched the drawer title between create/edit modes, and shortened the table helper text.
- Moved the normal Data Bindings ad-account binding form from inline page expansion into a right-side Sheet drawer so opening “+ Привʼязати рекламний акаунт” or “Перепривʼязати” no longer pushes the table down; kept the technical UUID mode collapsed below the table as a smaller advanced workflow.
- Replaced the normal Data Bindings ad-account success block with the existing app toast notification after successful save, while preserving form close/clear and table refresh behavior.
- Improved the Data Bindings “Рекламні акаунти” tab into a production-oriented admin workflow with a compact status dropdown, business-focused table, primary “+ Привʼязати рекламний акаунт” action, and searchable name-based comboboxes for ad account/client/project/funnel selection, plus short normal-flow success feedback that closes and clears the form after save.
- Kept the manual UUID-based ad account binding setup available as a collapsed secondary “Технічне налаштування через ID” block.

### Notes

- Backend behavior remains delegated to the existing `binding-create-or-update` Edge Function; no RLS, RPC signature, or destructive data behavior was changed.

## 2026-07-04

### Changed

- Improved manual Data Bindings save feedback so source and ad account technical setup forms show visible success/error status near the form after Edge Function actions complete; feedback persists with submitted form values until the next save, refresh, tab change, or form edit.
- Added compact collapsed technical details for binding save responses, including RPC/result identifiers when returned.
- Hardened the ad account idempotency migration for future environments by replacing `CREATE OR REPLACE FUNCTION` with duplicate preflight, `DROP FUNCTION` without `CASCADE`, `CREATE FUNCTION`, explicit execute grants, and PostgREST schema reload notification.

### Fixed

- Added Supabase migration `20260704_make_ad_account_binding_idempotent.sql` to make `public.bind_ad_account_to_scope` idempotent for repeated manual submissions of the same active ad account binding target.
- Added a non-destructive preflight duplicate check and partial unique index guard for active `ad_account_bindings` on `workspace_id`, `ad_account_id`, `client_id`, `project_id`, and `funnel_id` with `binding_status = 'active'`.
- Added regression tests covering the migration contract: update-before-insert behavior, active natural key matching, archived-row preservation, creator preservation, and active-only unique guard.
- Updated both the Data Bindings Ad Accounts tab and Ads connectors ad account UI so default lists show only active bindings, with explicit Active / Archived-paused / All filters for historical rows.
- Added Ads connectors cache invalidation after binding actions so manual save/archive/update flows refresh the connected ad accounts list.
- Hardened the ad account idempotent update path to preserve existing `notes`, `metadata`, and `is_primary` when repeated manual saves do not explicitly provide replacement values.

### Notes

- The migration does not delete or archive production data; it fails with an explicit error if duplicate active ad account bindings still exist before the unique index is created.
- Local repository inspection found the Edge Function caller and tests, but local migrations do not contain the existing `public.bind_source_entity_to_scope` definition; source binding duplicate risk remains a remote-contract verification follow-up.


## 2026-06-26

### Added

- Added Phase 1 Supabase migration `20260626_phase1_active_membership_access_hardening.sql` for active membership enforcement.
- Added `workspace_members.status` lifecycle values `active`, `inactive`, and `removed`, plus `updated_at` maintenance.
- Hardened central workspace role/access helpers and verified overloads to grant access only for active memberships while preserving `get_workspace_role(p_workspace_id uuid, p_user_id uuid DEFAULT auth.uid())` argument order.
- Hardened `workspace_members` RLS admin checks to depend on active membership through `get_current_user_workspace_role`.
- Made direct `workspace_members` membership management superadmin-only for authenticated users; admins cannot create, update, deactivate, reactivate, remove, or move ordinary or superadmin memberships through direct table access.
- Added trigger-based protection against demoting, deactivating, removing, moving, or deleting the last active `superadmin` membership in a workspace.
- Hardened known permission/member views: `v_current_user_permissions` is explicitly recreated with its previous permission logic, `wm.status = 'active'`, and `security_invoker=true`; `v_workspace_members_with_permissions` is made active-aware and direct `authenticated`/`anon` grants are revoked when the view exists.

### Confirmed

- PR #183 was merged into `main`.
- Remote Supabase Phase 1 user-access hardening was manually applied and verified on 2026-06-26.
- Verified `workspace_members.status` exists and all existing workspace memberships are `active`.
- Verified active-only role/access helpers through `get_current_user_workspace_role` and `get_workspace_role`.
- Verified `workspace_members` direct INSERT/UPDATE/DELETE policies are superadmin-only for authenticated users.
- Verified triggers exist for `updated_at`, workspace member management enforcement, and last active `superadmin` protection.
- Verified `v_current_user_permissions` and `v_workspace_members_with_permissions` are active-aware and use `security_invoker=true`.
- Verified `v_workspace_members_with_permissions` has no direct `SELECT` grant for `anon` or `authenticated`.

### Deferred

- Workspace invitations table/RPCs are deferred to a later phase. Pending invitations still must not grant access.
- User-management action RPCs and user-management-specific audit events are deferred.

## 2026-06-25

### Confirmed

- Completed local repo-state inspection was recorded in project context.
- Confirmed required project context files are present and readable in the local repository.
- Confirmed `Add Project Context Files` is tracked as completed in `NEXT_ACTIONS.md`.


### User Management Verification

- Completed local user-management/access verification from repository files only.
- Confirmed Supabase Auth, `AuthProvider`, session-only `ProtectedRoute`, `useWorkspaceRole`, and `workspace-role-info` are the current local auth/access pieces.
- Confirmed locally visible workspace roles are `member`, `admin`, and `superadmin`.
- Confirmed no verified local invitation flow was found.
- Confirmed no verified inactive/removed member behavior was found in local access helpers/policies.
- Confirmed remote Supabase schema/RLS verification is still required for `profiles`, `workspace_members`, invitations, `audit_logs`, access RPCs/views, first superadmin setup, and deployed policy behavior.
- No application code, Supabase migrations, RLS policies, package files, workflows, or environment files were changed.

### Notes

- No application code, Supabase files, package files, workflows, or environment files were changed.
- Supabase security state, dashboard metrics, package manager choice, remote Supabase contracts, and remote user-management schema/RLS remain upcoming verification items.

## 2026-06-24

### Added

- Created initial project context file set.
- Added project-specific AGENTS guidance.
- Added CONTEXT_UPDATE_PROTOCOL.
- Added USER_MANAGEMENT guidance.
- Added GLOSSARY.
- Added NEXT_ACTIONS.

### Confirmed

- Current stack: Codex + Supabase + GitHub.
- GitHub is source of truth for code/repo context.
- Client approval is not final.
- User management must distinguish auth user from workspace access.

### Notes

- Current state must be verified against actual GitHub repo.
- Supabase schema and RLS need repo verification.
- Dashboard metrics still need definition/verification.
- User management model still needs verification.

### Remaining Risks

- context drift if files are not updated
- old chat memory may conflict with repo facts
- RLS/security could be weakened if changes are rushed
- users/access may be implemented incorrectly without USER_MANAGEMENT.md
