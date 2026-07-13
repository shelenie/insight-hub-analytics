
## Local QA Fix — 2026-07-13 Onboarding Archive Cascade Semantics

A narrow production QA fix adds authenticated transactional onboarding archive cascade RPCs for Clients, Projects, and Funnels. Archive transitions are soft-only, preserve IDs, update timestamps/metadata, cascade inactive status to descendants where applicable, and archive active ad-account/source bindings in the affected scope. Onboarding Edge Functions now distinguish archive transitions from normal edits/reactivation so archive is allowed under inactive parents, while reactivation and normal edits still require active parents in Client → Project → Funnel order. `/onboarding` now confirms Client/Project archive actions and parses JSON Edge Function error payloads into friendly localized messages instead of surfacing only generic non-2xx text. Production migration application, Edge Function deployment, and live manual retest are still required.

## 2026-07-13 — Post-QA Source Candidate Privileges and Onboarding Toast Styling

### Fixed

- Added a Supabase migration to allow authenticated frontend source-candidate reads by granting only `SELECT` on `google_sheet_sources`, `google_sheet_tabs`, and `raw_external_datasets` while revoking unnecessary direct `MAINTAIN`, `REFERENCES`, `TRIGGER`, and `TRUNCATE` privileges.
- Updated `/bindings` source-candidate UI states so query failures show a temporary-unavailable message with retry/refresh and do not also claim that no sources exist; successful zero-candidate responses still show the genuine empty state.
- Centralized toast success/error/warning/info styling in the shared toast component and migrated Onboarding/Bindings toast calls to semantic variants instead of page-local color classes.

### Notes

- No production records, RLS policy predicates, RPC signatures, Edge Functions, Data Binding RPC behavior, onboarding create/edit behavior, ads connectors, `ai-helper-run`, or binding archive/rebind behavior changed.
- Production migration application and live privilege verification still require Supabase migration access.

## 2026-07-12 — PR #245 Final Step 3 Stabilization

### Fixed

- Completed Step 3 Data Bindings frontend actions on `/bindings` with authenticated hardened RPC usage, safe source candidates, selected source/ad-account edit-rebind-archive flows, explicit primary behavior, localized dialogs, and member read-only protections.
- Completed onboarding Client/Project/Funnel exact create/edit paths: create uses hardened `upsert_*` RPCs, edit updates exact selected rows by ID/workspace, supports inactive/archived reactivation, writes server-derived audit metadata, and blocks normal Project/Funnel reparenting.
- Enforced inactive/missing Google Sheet parent validation for source tabs and preserved canonical source identity.
- Updated CI workflow to run typecheck, lint, build, and tests on pull requests.

### Notes

- No Supabase migration, RLS change, RPC signature change, production data mutation, or `ai-helper-run` change was made.
- After merge, deploy only `binding-create-or-update`, `binding-archive`, `onboarding-client-upsert`, `onboarding-project-upsert`, and `onboarding-funnel-upsert`, then complete manual production QA.

## 2026-07-12 — AI Assistant Client Wording Follow-up Routing

### Fixed

- Aligned frontend thread-follow-up detection with explicit client communication triggers so “що сказати клієнту?”, “поясни клієнту”, “дай текст клієнту”, and “client update” preserve the previous System diagnostics or Ads Health route.
- Added regression coverage for previous System diagnostics, previous Ads Health, standalone General fallback, and clear-new-intent switching.

### Notes

- No request_type/context_scope values, Supabase schema/migrations, playbooks, chat history, Data Bindings, connectors, routes/sidebar, or Edge Function code changed in this follow-up.

## 2026-07-12 — AI Assistant System Diagnostics Routing

### Changed

- Added deterministic Ukrainian and English app/system/deploy/auth/API/runtime troubleshooting signals that route to the existing `production_readiness_summary` / `production_readiness` backend contract.
- Renamed the Production Readiness user-facing Assistant mode label to “Системна діагностика” / “System diagnostics” while preserving admin Technical details with exact request/context values.
- Extended thread-aware follow-up routing so system diagnostics conversations stay in Production Readiness for natural next-step/client-copy follow-ups, while clear Ads/Data/General intents still switch normally.
- Hardened the Operations/Production Readiness playbook for evidence-first, non-destructive system troubleshooting across frontend, deploy, API, auth/JWT, RLS/permissions, database, webhook, and background-job layers.

### Notes

- Reuses existing DB-allowed values: `production_readiness_summary` and `production_readiness`; no new CHECK-constraint migration is required.
- `supabase/functions/ai-helper-run` must be redeployed after merge because playbook guidance changed.
- Existing Ads/Data/General routing remains separate and prioritized ahead of system diagnostics where the prompt is clearly about imports, data quality, mapping, or ad-platform health.

## Verified Local Follow-up — 2026-07-11 Data Bindings Repository Migration Live Defaults Sync

The repository Data Bindings hardening migration now matches the exact verified live PostgreSQL defaults for the 17-argument `bind_source_entity_to_scope` RPC so future clean environment rebuilds can apply the migration without diverging from production. `p_source_table`, `p_source_id`, and `p_created_by` now default to null in the migration definition while the function body continues to derive authenticated actor identity through `require_source_manager` and auth/JWT context. No Supabase migration application, production data change, grants/role model change, frontend change, Edge Function deployment, connector change, route/sidebar change, or AI Assistant change was made.

## 2026-07-11 — Data Bindings Onboarding UUID Return-Type Compatibility

### Fixed

- Changed the corrected onboarding upsert RPC migration bodies to preserve live `uuid` return types for `upsert_client`, `upsert_project`, and `upsert_funnel`.
- The functions still write canonical names and required hierarchy fields, but now return `v_client.id`, `v_project.id`, and `v_funnel.id` instead of JSON payloads.

## 2026-07-11 — Data Bindings RPC Live-Schema Compatibility Fix

### Fixed

- Removed the invalid `workspaces.status` dependency from the Data Bindings RPC hardening migration.
- Replaced short RPC overload hardening with exact live signatures for binding archive, mapping review status, and onboarding upsert RPCs.
- Corrected `mapping_review_actions` audit inserts to use `action_type`, previous/new mapping status, actor user/email/role, notes, and metadata.
- Preserved canonical onboarding fields (`client_name`, `project_name`, `funnel_name`) and required funnel `client_id`.
- Changed `manage_ad_account_binding` primary semantics so omitted `p_is_primary` preserves an existing primary binding on idempotent duplicate calls.

## 2026-07-11 — Data Bindings RPC Production Hardening

### Changed

- Added a Supabase migration to revoke PUBLIC/anon execution from sensitive binding and onboarding mutation RPCs while preserving service-role access.
- Added in-function admin/superadmin authorization for binding archive, mapping status review, source binding, ad-account binding management, and onboarding upsert RPCs through `can_manage_sources`.
- Added `manage_ad_account_binding` as the safe authenticated ad-account binding RPC: it loads account identity from `ad_accounts`, validates active hierarchy ownership, idempotently upserts the exact active scope, and transactionally archives only a selected replacement binding.
- Kept binding archive behavior soft-only and preserved mapping review action logging.

### Notes

- Migration: `supabase/migrations/20260711_harden_data_binding_mutation_rpcs.sql`.
- No production data backfill, destructive delete, frontend Binding UI, Ads connector OAuth/API, sync orchestration, raw data, dashboard calculation, routes/sidebar, AI Assistant, or `ai-helper-run` changes.

## 2026-07-11 — AI Assistant Routing Source, Client-only Copy, and Compact Debug Popover

### Fixed

- Changed `auto_routed` semantics to mean automatic-vs-manual routing source instead of “resolved mode differs from default,” so automatic General and automatic Ads Health both persist `true`.
- Propagated the same `autoRouted` value from the user chat message through the AI run result into the assistant message and persisted chat history rows.
- Replaced the admin-only expanded Technical details block with a compact Popover in the same action row as Copy, with user-facing Automatic/Manual routing labels.
- Tightened client communication guidance so client-only wording prompts return only the client-copy marker block, while internal notes/checklists are allowed only when explicitly requested.

### Notes

- `ai-helper-run` prompt/playbook guidance changed and requires Edge Function redeploy after merge.
- No Supabase schema, RLS, migrations, chat table definitions, connector, binding, sync, route/sidebar, or Edge Function auth/JWT/DB access changes.

## 2026-07-11 — AI Assistant History Default, Admin Routing Debug, and Client Copy Polish

### Changed

- Reset the AI Assistant History drawer to Recent whenever it is opened from the main History button, while preserving Archive selection inside the open drawer.
- Added admin/superadmin-only collapsed Technical details under assistant answer actions for routing QA, limited to request_type, context_scope, auto_routed, and mode label.
- Updated the client communication playbook to produce shorter, softer, non-technical, client-safe copy and keep internal diagnostics outside `[CLIENT_COPY_START]` / `[CLIENT_COPY_END]`.

### Notes

- `supabase/functions/ai-helper-run` must be redeployed after merge because playbook wording changed.
- No Supabase schema/RLS/migrations, chat archive/restore/delete logic, connectors, bindings, sync, routes/sidebar, or Edge Function auth/JWT/DB access behavior changed.

## 2026-07-11 — AI Assistant Archive Delete and Drawer Final Polish

### Changed

- Kept Recent as the 14-day chat-history view and made Archive a longer-term archived-chat view with a bounded 100-row load ordered by `updated_at desc`.
- Added view-specific history drawer subtitles for Recent and Archive.
- Sanitized stored history previews at render time so old rows with markdown headings/bold/italic markers display cleanly without changing full assistant answers or mutating historical rows.
- Added permanent delete only for archived chats, guarded by an explicit confirmation dialog and local-state removal/reset after success.
- Added a Supabase migration for the archived-session delete policy on `public.ai_chat_sessions`; it requires `user_id = auth.uid()`, active workspace access via existing role helpers, and `archived_at is not null`.
- Made drawer action rows more compact and added more vertical breathing room above starter prompts.
- Renamed the auto-context composer badge to a friendlier “AI will choose the mode” / “AI сам обере режим”.

### Notes

- No Edge Functions were deployed or changed; `supabase/functions/ai-helper-run` remains untouched.
- The migration does not delete rows, disable RLS, expose service role access, or grant broad delete access.

## 2026-07-11 — AI Assistant History Drawer Polish and General Constraint Migration

### Changed

- Added source-controlled Supabase migration `20260711_allow_general_ai_helper_requests.sql` to align future environments with the production `allow_general_ai_helper_requests` manual fix for `ai_helper_requests` CHECK constraints.
- Made Recent / Archive history tabs visually distinct with stronger active styling and muted inactive states.
- Made history rows more compact and list-like with one-line title/preview, right-aligned time, and small inline rename/archive/restore actions.
- Added an incomplete-chat label for sessions that only have a saved user prompt and no AI response metadata after a failed backend run, without deleting or blocking rename/archive/restore.
- Cleaned drawer previews/titles/model-context snippets so markdown headings, bold, and italic markers do not leak into previews while full assistant answers remain unchanged.
- Broadened Assistant subtitle copy to cover analytics, ads, imports, data quality, workflows, and general system questions.

### Notes

- Production DB was already manually fixed with migration name `allow_general_ai_helper_requests`; this repo migration preserves source-of-truth consistency.
- No rows, RLS policies, grants, permissions, Edge Function deploy config, or existing migrations were changed.

## 2026-07-11 — AI Assistant General Mode Prompt Polish

### Changed

- Reworded `ai-helper-run` system identity from marketing-only analyst to the broader Analytics Hub AI Assistant with specialist playbooks applied only when relevant.
- Made response role adaptive so General mode uses `analytics_hub_ai_assistant` and scoped analytical contexts retain `senior_performance_marketing_analyst`.
- Replaced broad Safety/Evidence JSON-only wording with workspace-claim-specific evidence wording while preserving no-secret, no-mutation, no-fake-action, and no-invented-workspace-facts rules.
- Updated Assistant welcome, composer placeholder, and thinking copy to include workflows and general system explanations.

### Notes

- No Supabase schema/RLS, migrations, connectors, sync, routes/sidebar, permissions, or chat history persistence changes.

## 2026-07-11 — AI Assistant General Context Routing and History Archive UX

### Changed

- Added a General Assistant mode and made it the default frontend selected context.
- Updated deterministic routing so weak/no-signal general prompts resolve to General while strong analytics prompts still resolve to Ads Health, Data Quality, Ads Anomalies, or Ads Performance.
- Added safe backend General context handling that does not call ads or production context builders.
- Softened prompt requirements so workspace factual claims must use provided JSON context, while general explanatory/conversational questions can be answered from the prompt and chat history without invented workspace facts.
- Added a General Assistant playbook and scoped playbook selection so General mode avoids Ads Health, Data Readiness, CMO, and CFO lenses unless a real matching intent is routed.
- Hid context chips from normal user bubbles, assistant answer cards, and history rows while preserving persisted routing metadata.
- Made history drawer rows more compact and added Recent / Archive views with Restore for archived chats; no hard delete was added.

### Notes

- No Supabase RLS/schema, access-check, connector, sync, route/sidebar, or secrets handling changes.

## 2026-07-11 — AI Assistant Live Chat History Persistence Fix

### Changed

- Added a corrective Supabase migration that grants authenticated PostgREST access to the AI Assistant chat history tables while keeping RLS enabled and user-owned active-workspace policy checks.
- Recreated AI chat history RLS policies with fully-qualified `ai_chat_sessions` / `ai_chat_messages` predicates to keep owner/workspace checks explicit.
- Updated the Assistant submit flow to await first-session creation before saving the first user message, set both active session refs immediately, avoid null-session message inserts, save user/assistant messages with explicit operation diagnostics, update metadata after the assistant response, and refresh/optimistically update the drawer sessions list.
- Added muted non-blocking history persistence diagnostics in the Assistant UI so live operators can see whether session creation, message save, metadata update, drawer load, load, rename, or archive failed while the AI answer remains visible.

### Notes

- No `ai-helper-run` contract, assistant routing/playbooks, `build_ai_ads_context`, `build_ai_production_context`, AdsConnectors, Bindings / Звʼязки даних, source connectors, sync logic, routes/sidebar, or PR #235 overlay styling changes were made.
- Drawer visibility still depends on real `ai_chat_sessions` rows; the local optimistic row is followed by a reload of saved sessions for verification.

## Verified Local Follow-up — 2026-07-10 AI Assistant History Drawer Overlay Polish

AI Assistant chat history drawer now uses an opt-in lighter Sheet overlay (`bg-slate-950/35` with subtle blur) so the app behind the drawer remains readable. Shared `SheetContent` supports an optional `overlayClassName` while preserving the existing `bg-black/80` default for every sheet that does not opt in. Drawer panel layout, title/i18n, rename, archive, client-copy behavior, Supabase schema/RLS, Edge Functions, routing, migrations, connectors, sync logic, routes, and sidebar were not changed.

## 2026-07-10 — AI Assistant Client Copy i18n Polish

### Fixed

- Localized the `ClientCopyBlock` title and client-copy aria label through existing AI Assistant i18n keys while preserving client-only copy and whole-answer sanitization behavior.

## 2026-07-10 — AI Assistant Chat History Rename Polish

### Changed

- Added localized manual chat-session rename controls in the history drawer.
- Rename updates only `ai_chat_sessions.title`, trims/collapses/sanitizes the submitted title, ignores empty renames, and keeps archive behavior unchanged.

## 2026-07-10 — AI Assistant Chat History Production Polish

### Fixed

- Localized the chat history drawer labels through the existing i18n translation map, including English copy.
- Rendered drawer context labels from persisted request/context metadata when possible, falling back to stored labels only when metadata cannot be mapped.
- Added a submit/session-creation guard so a fast double-submit cannot create duplicate first-message chat sessions.

## 2026-07-10 — AI Assistant Chat History Marker Sanitization Follow-up

### Fixed

- Cleaned chat titles, drawer previews, and bounded `conversation_history` text so leading context labels and raw `[CLIENT_COPY_START]` / `[CLIENT_COPY_END]` marker lines are not shown to users or sent back to the model.
- Preserved raw saved assistant message text for UI rendering so loaded chats can still restore the `Текст для клієнта` block and dedicated client-copy action.

## 2026-07-10 — AI Assistant Persistent Chat History

### Changed

- Added Supabase-backed, user-owned AI Assistant chat sessions and messages with safe visible text/routing metadata only.
- Added a compact `Історія` drawer that shows non-archived chats from the last 14 days, grouped by recency, with one-line previews and soft-hide archive behavior.
- Loading a previous chat now restores messages into the active Assistant thread so follow-up prompts reuse the existing bounded `conversation_history` flow.
- Hid the assistant-card context chip by default while preserving context metadata on user bubbles and persisted chat rows.
- Preserved client-copy block rendering/copy and whole-answer copy sanitization behavior.

### Notes

- Migration: `supabase/migrations/20260710_ai_assistant_chat_history.sql`.
- RLS: authenticated users can select/insert/update only their own chat sessions/messages when they have active workspace access through existing `get_workspace_role` / `workspace_role_rank` helper patterns.
- Older and archived chats remain in the database but are hidden from the primary drawer.
- No AdsConnectors, Bindings, source connector, sync logic, ads/import model, `build_ai_ads_context`, or `build_ai_production_context` changes were made.
- This is not system/outage routing; that remains next.

## 2026-07-10 — AI Assistant Whole-Answer Copy Sanitization

### Fixed

- Sanitized the existing whole-answer copy action so raw client-copy marker lines are not copied.
- Preserved client-ready text and internal notes in whole-answer copy, while keeping the dedicated client-card copy action limited to client text only.

### Notes

- Frontend copy behavior only; visual rendering is unchanged.
- No Supabase schema, RLS, migrations, connectors, sync logic, permissions model, routes, or sidebar changes were made.

## 2026-07-10 — AI Assistant Client Copy Polish

### Changed

- Added deterministic frontend stripping for duplicated leading `Контекст: ...` / `Context: ...` labels before assistant answer rendering.
- Added AI Assistant client-copy marker parsing and a dedicated `Текст для клієнта` card with its own copy button for explicit client communication.
- Kept the existing whole-answer copy action available for assistant answers.
- Updated `ai-helper-run` prompt/playbook guidance so client-ready text is emitted only for explicit client-communication requests and internal notes/checklists stay outside `[CLIENT_COPY_START]` / `[CLIENT_COPY_END]`.

### Notes

- No Supabase schema, RLS, migrations, AdsConnectors, Bindings, source connectors, sync logic, permissions model, routes, or sidebar changes were made.

## 2026-07-10 — AI Assistant Adaptive Answer Structure

### Changed

- Clarified AI Assistant prompt/playbook wording so answer structure is adaptive rather than hard template-driven.
- Reframed section-count and campaign-list guidance as concision defaults, not absolute caps; completeness wins when important blockers, risks, or actions exist.
- Added guidance that playbooks are reasoning lenses, section headings are optional, small follow-ups should be direct, and complex analysis may include enough detail to be useful.
- Kept client communication conditional and thread-aware without appending client wording to normal analytical answers.

### Notes

- No Supabase schema, RLS, migrations, `build_ai_ads_context`, `build_ai_production_context`, AdsConnectors, Bindings, source connectors, sync logic, permissions model, routes, or sidebar changes were made.

## 2026-07-10 — AI Assistant Thread-Aware In-Session Context

### Changed

- Replaced the older continuation-only history wording with bounded visible-thread conversation history: up to 12 recent messages are selected within a character budget, the latest assistant answer gets a larger slice, and messages are sent chronologically with `conversation_thread` metadata.
- Added previous-assistant thread metadata so natural follow-ups reuse the prior assistant context unless a strong new intent is detected.
- Expanded follow-up routing for explanation, simplification, summary, prioritized-check, platform-specific, client-wording, and continuation prompts.
- Updated `ai-helper-run` prompt handling so visible conversation history is untrusted continuity context and follow-ups refine, continue, simplify, summarize, or prioritize checks without restarting full analysis.
- Kept client communication conditional but thread-aware for follow-ups such as “сформулюй клієнту” and “напиши клієнту”.

### Notes

- Conversation context is in-session only and bounded; persistent DB-backed chat sessions remain a future optional feature.
- No Supabase schema, RLS, migrations, `build_ai_ads_context`, `build_ai_production_context`, AdsConnectors, Bindings, source connectors, sync logic, permissions model, routes, or sidebar changes were made.

## 2026-07-09 — AI Assistant Answer Polish and Continuation

### Changed

- Made the AI Assistant client communication section conditional on explicit client wording requests.
- Tightened ads health, ads performance, ads anomalies, and data quality answer guidance to prefer concise focused structure while avoiding long lists/cutoffs.
- Added compact frontend conversation history payloads for AI Assistant calls and continuation routing that reuses the previous assistant context when a user asks to continue.
- Marked conversation history as untrusted input in `ai-helper-run` prompt construction.
- Added prompt guidance to avoid starting assistant answer bodies with “Контекст: …” because the UI already displays the context label.

### Notes

- No Supabase schema, RLS, migrations, `build_ai_ads_context`, `build_ai_production_context`, AdsConnectors, Bindings, source connectors, sync logic, permissions model, routes, or sidebar changes were made.

## 2026-07-09 — CFO Playbook Enrichment for Budget Efficiency

### Changed

- Enriched `PLAYBOOK_CFO_BUDGET_EFFICIENCY` from the provided CFO skill reference by extracting finance-discipline principles into original code-versioned guidance, without copying external text verbatim or adding runtime network calls.
- Added CFO guidance for cash-is-oxygen thinking, 13-week rolling forecast visibility, no board surprises, opportunity cost, simplicity over precision, finance-enables-operations, stage-aware finance context, unit-economics guardrails, and human review for high-impact finance decisions.
- Scoped CFO usage for Analytics Hub: primarily budget efficiency and opportunity-cost analysis in ads performance, conditional use for budget-impact anomalies, no full CFO playbook for ads health or data quality by default.
- Added guardrails so runway, fundraising, treasury, accounting operations, forecasting, board, tax, audit, legal, and compliance guidance is only used when relevant context exists or the user asks for CFO-level company-finance guidance.

### Notes

- External CFO references remain untrusted advisory content under existing prompt-injection safeguards.
- No Supabase schema, RLS, migrations, runtime network calls, AdsConnectors, Bindings, routes/sidebar, source connector, sync, or permissions-model changes were made.

## 2026-07-09 — CMO Playbook Enrichment and External-Reference Safeguards

### Changed

- Enriched `PLAYBOOK_CMO_CAMPAIGN_DIAGNOSIS` from the provided CMO skill reference by extracting principles into original code-versioned guidance, without copying external text verbatim or adding runtime network calls.
- Added CMO guidance for pipeline over vanity metrics, positioning before channels, deep-before-wide focus, distribution, owned audience, brand compounding, cut losers/double winners, ICP clarity, funnel stage, sales alignment, lead quality, channel selection, attribution caution, stage-aware recommendations, and human review for high-impact decisions.
- Added prompt-injection safeguards so external references, skill texts, user prompts, campaign names, imported values, and database text cannot override system/developer instructions, RLS/JWT/access rules, workspace boundaries, no-mutation/no-secret/evidence-only policies, or product safety rules.
- Updated Client Communication guidance to avoid vanity-metric overconfidence, separate known facts from verification items, avoid untested channel/campaign/brand promises, and require human review for high-impact recommendations.

### Notes

- CMO remains injected for ads performance and anomaly hypothesis analysis, not for every ads-health answer.
- No Supabase schema, RLS, migrations, runtime network calls, AdsConnectors, Bindings, routes/sidebar, source connector, sync, or permissions-model changes were made.

## 2026-07-09 — AI Assistant Production-Safe Routing and Code-Versioned Playbooks

### Changed

- Superseded PR #230 locally with deterministic smart routing that prioritizes Data Quality/Imports, Ads Health/source readiness, guarded Ads Anomalies, Ads Performance, Mapping, and System Readiness.
- Added domain/metric/time-window guards for anomaly routing so broad anomaly words do not route unrelated access, import, or website issues to Ads Anomalies.
- Expanded data-quality routing for Ukrainian inflections, import/rejected-row wording, raw/staging/processed data, and quality issues.
- Added code-versioned AI Assistant analysis playbooks for Safety/Evidence, Data Readiness, CMO campaign diagnosis, CFO budget efficiency, Ads Anomaly Review, Data Quality/Import Review, Client Communication, and Operations Readiness.
- Inject CMO/CFO playbooks for performance and relevant anomaly analysis rather than every ads-health answer.
- CFO playbook covers cash/runway awareness when relevant, opportunity cost, simple decision-making, spend efficiency, CPL efficiency, unit-economics guardrails, and no invented revenue/ROAS/LTV/payback.
- CMO playbook covers audience, creative, offer/message-market fit, funnel step, landing page/form, tracking, lead quality, and fatigue.

### Notes

- No Supabase schema, RLS, migrations, AdsConnectors, Bindings, routes/sidebar, source connector, sync, or permissions-model changes were made.
- DB-managed prompt registry remains a future optional enhancement only if admin-editable prompt governance is required.

## 2026-07-09 — AI Assistant Smart Routing and Ukrainian Wording Polish

### Changed

- Updated AI Assistant smart routing so data quality prompts handle Ukrainian inflected phrases like “якістю даних” and related import/rejected/raw-data wording.
- Updated drop/anomaly routing so prompts such as “Що просіло за останні 7 днів?” select Ads Anomalies, while stale data still forces the answer to explain that current anomaly/drop analysis is blocked or unreliable.
- Polished `ai-helper-run` Ukrainian answer guidance to reduce mixed English operational wording such as spend/leads and permission/access, avoid “бо є немає”, and prefer app wording like “Звʼязки даних”.

### Notes

- No Supabase schema, RLS, migrations, AdsConnectors, Bindings, routes/sidebar, source connector, sync, or permissions-model changes were made.

## 2026-07-09 — AI Assistant Live UX Polish

### Changed

- Removed/hidden the AI Assistant context override popover from the normal composer UX while preserving smart auto-routing.
- Moved the New chat action to the assistant page header actions area.
- Made context badges subtle/read-only and stopped presenting the context label as prominent user-bubble text.
- Aligned the composer input card radius with assistant answer card styling while keeping the send button round.
- Tightened `ads_health` prompt behavior so answers are complete but focused on data freshness/readiness/source status/access blockers/Звʼязки даних gaps instead of artificially short or detailed campaign/CPL analysis unless requested.
- Changed the composer autocontext badge to neutral pre-submit wording while preserving resolved context labels on routed messages.
- Added prompt wording preferences for Ukrainian user-facing answers: Звʼязки даних, проєкт, and воронка.

### Notes

- No Supabase schema, RLS, `build_ai_ads_context`, AdsConnectors, Bindings, routes/sidebar, connectors, sync logic, or permissions model changes were made.

## 2026-07-09 — AI Assistant Production UX Auto-Routing

### Changed

- Added smart AI Assistant context routing so ads freshness/sync/account questions use Ads health, campaign/CPL/spend questions use Ads performance, and anomaly/drop/spike questions use Ads anomalies.
- Changed the assistant default context to Ads health and removed the always-visible primary composer dropdown dependency.
- Kept manual context selection as a collapsed advanced/testing override.
- Added resolved-context badges on chat messages and a copy button for assistant answers.
- Improved lightweight answer rendering for headings, paragraphs, grouped bullet lists, grouped numbered lists, and bold text.
- Increased `ai-helper-run` output limit to 2200 tokens and added prompt rules that translate backend diagnostics into user-facing language instead of exposing raw field names in normal answers.

### Notes

- No Supabase schema, RLS, migrations, routes/sidebar, AdsConnectors, Bindings, connectors, sync logic, data mutations, or permissions-model changes were made.

## 2026-07-09 — Conservative AI Ads Live API Interpretation

### Fixed

- Made `ads_context_status.source_interpretation.live_api_health_claim_allowed` and `uses_live_api_data` conservative so fresh `facts_ads_daily` rows alone do not imply live ad API health.
- Required production-ready/readiness-validated API raw data, non-test/non-empty account state, non-`other` platform filter, and facts not interpreted as imported history before allowing live API health claims.
- Expanded imported-data interpretation to include unified fallback, `platform=other`, selected imported-history facts, and `connected_with_imported_fallback`.

### Notes

- Backend safety fix only; no RPC signature, returned-field removal, nested diagnostics shape, frontend pages/routes/sidebar, RLS, table schemas, or request payloads changed.

## 2026-07-09 — Normalized AI Ads Context Guidance

### Changed

- Added normalized `ads_context_status` to `build_ai_ads_context` for data availability, analysis-window, source-interpretation, readiness, binding-gap, and required-mention guidance.
- Promoted `multi_account_readiness` and `binding_gaps` to top-level AI ads context fields while preserving the existing nested `pipeline_diagnostics.multi_account_readiness` diagnostics contract.
- Added explicit platform semantics that `platform=other` represents imported historical ads facts, not a live ad network.
- Hardened the `ai-helper-run` ads prompt so answers must check data availability/freshness/source readiness/binding status before analysis, avoid unsafe "no data" wording when historical/imported/fallback data exists, and avoid live API health claims unless allowed.

### Notes

- Backend AI context and Edge Function prompt only. No frontend pages, AdsConnectors, Bindings, routes, sidebar, UI components, request payload shape, RPC signature, nested diagnostics shape, RLS policies, or table schemas were changed.

## 2026-07-09 — AdsConnectors Diagnostics Compact Admin Overview

### Changed

- Polished AdsConnectors Diagnostics from long diagnostic columns into a compact admin overview.
- Rendered Ads data context as a full-width compact metric summary instead of a column stretched to match longer lists.
- Rendered Daily snapshots and Anomaly candidates as responsive cards with compact three-row previews.
- Displayed backend `platform = other` as friendly Imported data / Імпортовані дані labels in normal UI.
- Cleaned Diagnostics intro copy and removed awkward Ukrainian mixed wording.

### Notes

- Raw diagnostics remain in collapsed DeveloperDetails / technical details.
- Frontend-only change; no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, backend values, data fetching, write actions, AdsConnectors tab structure, or Bindings page changed.

## 2026-07-09 — AdsConnectors Diagnostics UI Polish and Binding Terminology

### Changed

- Standardized AdsConnectors binding terminology back to Bound / Unbound / Partially bound / Needs binding and Ukrainian equivalents, including `partially_bound` display copy.
- Polished AdsConnectors → Diagnostics from raw side-by-side tables into admin-readable cards/lists for ads data context, daily context, and anomaly candidates.
- Kept raw diagnostics and full technical payloads behind collapsed DeveloperDetails / technical details.
- Localized diagnostics labels for Ukrainian and English normal UI.

### Notes

- Backend contracts were not changed: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, data fetching, backend values, or write actions changed.

## 2026-07-09 — AdsConnectors Shared Operational Notice Completion

### Changed

- Migrated AdsConnectors remaining local operational status/notice helpers to the shared status UI layer.
- Added shared info surface/text/dot support for operational notices and indicators.
- Replaced local reusable amber/sky/emerald status styling in AdsConnectors with shared StatusBadge, OperationalNotice, OperationalStatusSurface, and OperationalStatusDot usage.

### Notes

- Frontend-only follow-up. No Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, backend values, data fetching behavior, or write actions changed.
- Shared status components should be reused for warning, info, success, and muted operational states.

## 2026-07-09 — Shared Operational UI Styles

### Changed

- Added shared operational Badge variants for success, warning, info, and muted states.
- Added shared operational status surface/card helpers for warning, success, neutral, muted, and compact summary presentation.
- Moved the repeated AdsConnectors/Bindings subnav trigger style into a shared navigation style export.
- Updated AdsConnectors and Bindings to use shared status/subnav styling while preserving current tab behavior and binding actions.

### Notes

- Frontend-only refactor. No Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, backend values, data fetching behavior, or write actions changed.
- Future operational UI work should reuse shared status components/styles rather than defining local Tailwind status classes.

## 2026-07-09 — Bindings Needs-Binding Warning State

### Changed

- Updated Bindings needs-binding badges from neutral outline styling to reusable amber warning styling.
- Applied subtle warning surfaces to the Overview ad-account summary and Ad accounts gap area/cards when binding gaps exist.
- Kept the working Bind account / Привʼязати акаунт drawer flow from PR #222 unchanged.

### Notes

- Frontend-only follow-up. No backend contracts, routes, sidebar, AdsConnectors page, sync behavior, import pipeline, or binding-create/update flow changed.

## 2026-07-09 — Bindings Gap Card Direct Binding Action

### Changed

- Added a localized Bind account / Привʼязати акаунт action to Bindings → Ad accounts account-gap cards.
- Gap actions open the existing ad account binding drawer in create mode and prefill only the matched ad account UUID when platform plus `external_account_id` match an available ad account option.
- Client, project, and funnel remain empty so admins choose the correct business context.
- Unmatched diagnostic gaps keep the action disabled and show localized guidance to refresh or check Ads Connectors instead of submitting fake IDs.

### Notes

- AdsConnectors remains the operational status page for ad platform connections, discovered accounts, sync status, and diagnostics.
- Bindings remains the remediation/action page for binding sources and ad accounts to clients, projects, and funnels.
- Frontend-only change. No backend contracts were changed: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, AdsConnectors page, backend values, import pipeline, or binding-create/update flow changed.

## 2026-07-08 — Bindings Ads Readiness UX Separation

### Changed

- Clarified Bindings / Mapping as the action area for fixing account/source mappings while keeping AdsConnectors as the source/account/sync status area.
- Reduced duplicate readiness metrics in Bindings Overview by replacing the full ad readiness counter block with a compact actionable Ad accounts summary.
- Reworked Bindings → Ad accounts binding gaps into friendly actionable cards shown above the existing binding form/table, without normal-UI backend codes or backend English diagnostic messages.
- Kept the raw multi-account readiness payload only in Health developer/technical details.

### Notes

- Frontend-only change. Backend contracts were not changed: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, AdsConnectors page, backend values, or write actions changed.

## 2026-07-08 — AdsConnectors Real Account Visibility Semantics

### Changed

- Updated AdsConnectors → Ad accounts so Real accounts means discovered real platform accounts, not only active bound account rows.
- Unbound real accounts are now visible in the main Real accounts section with Needs binding while binding gaps remain read-only diagnostics in collapsed readiness details.
- Renamed the bound-only Overview KPI from Ready accounts / Готові акаунти to Bound accounts / Привʼязані акаунти.

### Notes

- Frontend-only change. Backend contracts were not changed: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, Bindings page, Imports page, or write actions changed.

## 2026-07-07 — AdsConnectors Status Filter Dropdown Alignment

### Changed

- Updated AdsConnectors → Ad accounts to use the same inline status Select/dropdown pattern as Bindings / Mapping → Ad accounts instead of segmented status buttons.

### Notes

- Backend contracts remain unchanged.

## 2026-07-07 — AdsConnectors Ad Accounts Live Review Polish

### Changed

- Polished the existing AdsConnectors → Ad accounts UI after live review.
- Compacted the status filter into an inline toolbar while preserving the compact readiness summary and Real accounts wording.
- Replaced expanded readiness technical tables with readable platform readiness and binding-gap cards/lists.
- Added frontend-only friendly localized display mapping for common backend readiness messages.

### Notes

- Backend contracts were not changed: no Supabase schema, RLS, RPC contracts, OAuth, sync behavior, Edge Functions, or `ai-helper-run` changes.

## 2026-07-07 — AdsConnectors Ad Accounts Readiness UX Polish

### Changed

- Polished AdsConnectors Overview and Ad accounts readiness UI into compact business-readable summaries with friendly status, total/bound/unbound/needs-attention counters, and specific binding-gap next actions.
- Surfaced binding gaps/unbound accounts as first-class Needs attention items while keeping TikTok no-data and Facebook Lead Ads no-forms guidance.
- Moved detailed platform readiness and binding gaps into an expandable details section so Real accounts cards are no longer pushed down by diagnostic tables.
- Added Ukrainian and English friendly labels for key multi-account readiness and binding-gap status codes.
- Replaced “Production readiness” with “Operational readiness” while preserving “Real accounts” for ad accounts that truly exist on Meta Ads, Google Ads, or TikTok Ads even when they have no spend/campaign data yet.

### Notes

- Bindings remains the place for fixing binding gaps.
- Frontend-only change; no Supabase schema, RLS, RPC contracts, OAuth, sync behavior, Edge Functions, ai-helper-run, routes, sidebar, top-level tabs, Bindings page, or Imports page changed.

## 2026-07-07 — Bindings Ads Binding Gap Readiness

### Changed

- Wired read-only Ads multi-account binding readiness into the existing `/bindings` page without adding a page, route, sidebar item, top-level tab, Imports placement, or duplicating AdsConnectors.
- Added a compact Overview readiness card that reads `overall_status` and nested `summary` counters from `build_ads_multi_account_readiness(uuid)`.
- Added a read-only Binding gaps section in the existing Ad accounts tab showing `gap_type`, `platform`, `external_account_name`, `external_account_id`, `message`, and `next_action` from `payload.binding_gaps`.
- Added raw readiness payload diagnostics inside the existing Health technical-details pattern.
- Added graceful readiness-only unavailable states so existing binding management continues if the RPC fails.
- Added source tests covering the RPC call, existing-tab-only placement, no new navigation, nested summary counters, binding gaps rows, and unavailable state.

### Notes

- AdsConnectors shows source/account/sync readiness; Bindings now shows binding gaps where admins manage ad account bindings.
- This is still read-only gap guidance. Actual one-click fix actions remain future work.
- Real platform sync fixes remain deferred until real ad accounts/data are available.
- No Supabase schema, RLS, OAuth, sync behavior, Edge Functions, imports page, ads connector write logic, or binding-create-or-update contract changed.

## 2026-07-07 — AdsConnectors Readiness Summary Shape Fix

### Fixed

- Fixed AdsConnectors multi-account readiness summary cards to read account counters from the backend payload `summary` object instead of top-level fields.
- Kept platform rows from `platforms`, binding gaps from `binding_gaps`, and the existing no-new-navigation/read-only behavior unchanged.

## 2026-07-07 — AdsConnectors Multi-Account Readiness UI

### Changed

- Wired the existing AdsConnectors page to the backend `build_ads_multi_account_readiness` RPC.
- Added read-only readiness metrics to the existing Overview tab and compact platform/binding-gap readiness details above the existing Ad accounts table.
- Added the raw multi-account readiness payload to Diagnostics only inside the existing developer-details pattern.

### Notes

- No new tab, route, navigation item, Imports admin surface, or separate Admin panel was added.
- Bindings remains the place for actual binding management.
- Write actions for fixing binding gaps remain future work.
- Real platform sync fixes remain deferred until real ad accounts/data are available.

## 2026-07-07 — Imported Ads Facts Production Hotfix Mirror

### Changed

- Mirrored the Supabase production hotfix for `rebuild_imported_ads_facts(uuid, date, date)` so imported historical rows are stored in `facts_ads_daily` with `platform = other` instead of `platform = imported`, matching the production `facts_ads_daily_platform_check` allowed values.
- Kept deterministic imported fact keys in the form `imported:{metric_date}:{md5(campaign_name)}`, `ON CONFLICT (workspace_id, fact_key)`, explicit `level = campaign`, and imported reach mapped to `impressions`.
- Added/kept the returned warning that imported historical rows are stored with `platform=other` because `facts_ads_daily` only allows known platform codes or `other`.
- Updated source-level tests to assert `other` platform storage, reject `imported` platform storage, retain imported fact keys, preserve campaign/impressions/idempotency behavior, and avoid destructive statements.

### Production result

- Production backfill succeeded with `status = ok`, `rows_read = 240`, and `rows_inserted_or_upserted = 240`.
- `facts_ads_daily` now has imported historical facts for 2026-04-01 to 2026-05-05.
- AI ads context now uses `facts_ads_daily` as the primary source for historical imported ads (`source_layer_used = facts_ads_daily`, `fallback_used = false`).
- Real Google/Meta/TikTok platform sync fixes remain deferred until real accounts/data are available.

### Notes

- No frontend UI, OAuth, live platform sync, RLS, Edge Function contracts, `build_ai_ads_context` signature, or `ai-helper-run` request/response contract changed.

## 2026-07-07 — Imported Ads Facts Backfill

### Added

- Added additive Supabase RPC `rebuild_imported_ads_facts(uuid, date, date)` to rebuild historical imported ads performance from `v_unified_ads_performance_daily` into `facts_ads_daily` without requiring live Google/Meta/TikTok production accounts.
- Added deterministic imported `fact_key` generation and `ON CONFLICT (workspace_id, fact_key)` upserts so repeated workspace/date backfills update instead of duplicating facts.
- Added source-level tests for the imported source read path, `facts_ads_daily` fact-key upsert path, workspace/date scoping, JSON summary fields, unchanged `build_ai_ads_context` signature, unchanged `ai-helper-run` contract, and no truncate/delete/global destructive cleanup.

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


## 2026-07-07 — Ads Multi-Account Readiness Diagnostics

### Added

- Added read-only Supabase RPC `build_ads_multi_account_readiness(uuid)` to describe multi-account ads onboarding and binding readiness for agency workflows where one platform connection can expose many ad accounts.
- Added stable readiness status codes, summary counts, per-platform details, per-account binding state, and binding gap detection for unbound active accounts, ambiguous primary bindings, bindings without client/project/funnel scope, inactive accounts with active bindings, and platform connections with no discovered accounts.
- Extended `build_ads_pipeline_diagnostics` to include `multi_account_readiness` without changing its signature.
- Added source-level tests for function existence, read-only behavior, required JSON shape, readiness codes, multi-account/unbound/scope-less binding detection, token/secret avoidance, unchanged RPC signatures, and unchanged `ai-helper-run` contract.

### Notes

- Multi-account provider support is now explicitly visible in backend diagnostics.
- The next UI step can display account binding readiness in admin/source management.
- Real Google/Meta/TikTok platform sync fixes remain deferred until real production accounts/data are available.
- No frontend UI, OAuth, live platform sync, RLS, Edge Function contracts, `build_ai_ads_context` signature, or `ai-helper-run` request/response contract changed.


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
