## Verified Local Follow-up — 2026-07-12 Step 3 Source Bindings UI Completion

Step 3 Data Bindings frontend wiring now includes the source-binding production workflow on `/bindings`: admins/superadmins load a separate safe source-candidate query only when `can_manage_bindings` is true, choose a known source with searchable selectors, cascade Client → Project → Funnel, set explicit primary intent, create/edit selected source bindings, and archive exact selected rows through a localized confirmation dialog. Selected source rebind is implemented as the required two-phase flow: save the new exact-scope binding first, then archive only the selected previous `binding_id`; if archive fails after save, both rows remain, data refreshes, and a localized partial-success warning exposes only safe old/new identifiers in Technical details. Browser `window.prompt` / `window.confirm` usage was removed in favor of localized dialogs for onboarding and archive. The Google Sheet tab resolver keeps the verified `is_active` / `google_sheet_source_id` fix and no longer invents a `google_sheet_tab` source kind or forces `google_sheet_tabs` when `target_raw_table` carries the established source-table identity. No migration, RLS change, RPC signature change, production data mutation, connector production fix, dashboard change, user invitation change, or `ai-helper-run` change was made.

## Verified Local Change — 2026-07-12 Step 3 Data Bindings Frontend Wiring

Data Bindings Step 3 now wires ad-account operational actions on `/bindings` to the authenticated `manage_ad_account_binding` RPC through a small frontend mutation helper, including explicit primary intent (`unchanged`, `make_primary`, `remove_primary`) and selected-row replacement IDs for rebinds. The ad-account raw UUID technical workflow was removed from the active tab; admins use searchable selectors for ad account, client, project, and funnel, active rows expose rebind/archive actions, and archived rows are read-only. Onboarding hierarchy actions on the same drawer call authenticated `upsert_client`, `upsert_project`, and `upsert_funnel` with null actor fields so backend derives actor identity; the legacy onboarding wrappers were also aligned to the same authenticated user-client RPC signatures because `Onboarding.tsx` still calls them. Archive uses authenticated `archive_binding` for the explicitly selected row, and the legacy archive wrapper now delegates to the same authenticated RPC rather than a service-role mutation. `binding-create-or-update` remains for source bindings only, fixes the Google Sheet tab resolver to use `is_active` and `google_sheet_source_id`, preserves canonical `google_sheet_source` identity for Google Sheet sources, sends source mutations through authenticated `userClient.rpc`, and returns a deprecated response for ad-account mutation attempts. No migration, production data change, RLS change, connector production fix, dashboard change, user invitation change, or `ai-helper-run` change was made.

## Verified Local Follow-up — 2026-07-12 AI Assistant Client Wording Follow-up Routing

AI Assistant thread-follow-up detection now explicitly recognizes client-wording follow-ups such as “що сказати клієнту?”, “поясни клієнту”, “дай текст клієнту”, and “client update” without treating every generic mention of “client” as a continuation. After a System diagnostics or Ads Health answer, those explicit wording requests preserve the previous assistant route; standalone client-wording prompts without previous assistant context continue to fall back to General. No request_type/context_scope values, Supabase schema/migrations, playbook behavior, chat history, Data Bindings, connectors, routes/sidebar, or Edge Function code changed in this follow-up.

## Verified Local Change — 2026-07-12 AI Assistant System Diagnostics Routing

AI Assistant now routes application/system/deploy/auth/API/runtime troubleshooting prompts to the existing Production Readiness backend contract (`production_readiness_summary` / `production_readiness`) with the user-facing label “Системна діагностика” / “System diagnostics”. Deterministic routing keeps Data Quality/Imports and Ads Health ahead of system diagnostics for clearer domain-specific prompts, so imported rows/files/mapping and advertising account/sync/access questions remain separate. System-diagnostics thread follow-ups such as “що перевірити першим?”, “а чому так?”, and client wording requests preserve the Production Readiness route unless the user asks a clear new Ads/Data/General question. The Operations/Production Readiness playbook is now evidence-first for system troubleshooting: it must not claim an outage without evidence, must separate confirmed facts from likely causes and missing verification, must request concrete evidence/logs/statuses, and must recommend safe non-destructive checks before any configuration changes. No Supabase migration, RLS/permission change, chat persistence schema change, Ads connector change, OAuth change, sync orchestration change, routes/sidebar change, or dashboard calculation change was made. The `ai-helper-run` Edge Function guidance changed and must be redeployed after merge.

## Verified Local Follow-up — 2026-07-11 Data Bindings Repository Migration Live Defaults Sync

The repository Data Bindings hardening migration now matches the exact verified live PostgreSQL defaults for the 17-argument `bind_source_entity_to_scope` RPC so future clean environment rebuilds can apply the migration without diverging from production. `p_source_table`, `p_source_id`, and `p_created_by` now default to null in the migration definition while the function body continues to derive authenticated actor identity through `require_source_manager` and auth/JWT context. No Supabase migration application, production data change, grants/role model change, frontend change, Edge Function deployment, connector change, route/sidebar change, or AI Assistant change was made.

## Verified Local Follow-up — 2026-07-11 Data Bindings Onboarding Return-Type Compatibility

PR #242 migration now preserves the verified live UUID return types for `upsert_client`, `upsert_project`, and `upsert_funnel`. The onboarding functions keep the corrected canonical field writes and hierarchy validation but return only the resulting row id (`v_client.id`, `v_project.id`, or `v_funnel.id`) so PostgreSQL `CREATE OR REPLACE FUNCTION` can apply against the existing exact signatures without a return-type change.

## Verified Local Follow-up — 2026-07-11 Data Bindings RPC Live-Schema Compatibility Fix

PR #242 migration was corrected against verified live Supabase schema compatibility findings. `require_source_manager` now verifies workspace existence without referencing a non-existent `workspaces.status` column and continues to delegate active access/admin authorization to `can_manage_sources`. The migration now hardens the exact live long signatures for `archive_binding`, `update_binding_mapping_status`, `upsert_client`, `upsert_project`, and `upsert_funnel` instead of creating short overloads, and includes a pg_proc audit so no sensitive overload remains PUBLIC/anon executable. Mapping review audit writes now use the live `mapping_review_actions` columns. Onboarding upserts preserve canonical `client_name`, `project_name`, `funnel_name`, and required funnel `client_id`. `manage_ad_account_binding` now defaults `p_is_primary` to null so duplicate saves preserve existing primary state unless explicitly changed.

## Verified Local Change — 2026-07-11 Data Bindings RPC Production Hardening

A local Supabase migration now hardens operational Data Binding and onboarding mutation RPCs before frontend mutation wiring. Sensitive mutation RPC grants are audited so PUBLIC/anon execution is revoked, authenticated execution is granted only to RPCs with in-function admin/superadmin authorization through `can_manage_sources`, and service-role backend job access is preserved. A new `manage_ad_account_binding` RPC provides an authenticated admin/superadmin contract that loads real ad-account identifiers from `ad_accounts`, validates active client/project/funnel hierarchy ownership, idempotently upserts the exact active scope, and transactionally archives only an explicitly selected replacement binding. Archive and mapping-review RPCs remain soft/archive-only and keep mapping review audit writes. Onboarding upsert RPCs now derive actor identity from the authenticated session instead of trusting caller-supplied creator fields. No production row backfill/update/delete is included. Frontend Binding UI, Ads connector OAuth/API logic, sync orchestration, raw ads/leads/sales data, dashboard calculations, routes/sidebar, AI Assistant, and `ai-helper-run` were not changed.

## Verified Local Follow-up — 2026-07-11 AI Assistant Routing Source, Client-only Copy, and Compact Debug Popover

AI Assistant routing metadata now treats `auto_routed` as the routing source: automatic AI routing stores `true` even when the resolved mode is General, while manual overrides store `false`. The value is propagated from user message through the mutation result to the assistant message, persisted chat rows, and loaded history. Admin/superadmin Technical details moved into the answer action row beside Copy and now opens as a compact popover with user-facing Automatic/Manual routing text instead of a vertical expanded details block. Client-communication playbook guidance now distinguishes client-wording-only requests from combined client + internal-checklist requests: plain prompts such as “сформулюй клієнту” should return only the marked client-copy block, while internal notes are allowed only when explicitly requested. The `ai-helper-run` Edge Function wording guidance changed and must be redeployed after merge. No Supabase schema/RLS/migrations, chat table definitions, connectors, bindings, sync logic, routes/sidebar, or Edge Function auth/JWT/DB access behavior changed.

## Verified Local Follow-up — 2026-07-11 AI Assistant History Default, Admin Routing Debug, and Client Copy Polish

AI Assistant History now resets to the Recent tab whenever the main History button opens the drawer, while Archive remains selectable inside the drawer with existing archive/restore/delete behavior unchanged. Assistant routing metadata remains hidden from normal bubbles and history cards, but admin/superadmin users now get a collapsed, muted Technical details section under assistant answer actions showing only request_type, context_scope, auto_routed, and user-facing mode label for QA. The client communication playbook now asks for shorter, softer, non-technical client-safe copy with internal diagnostics kept outside the client-copy markers. The `ai-helper-run` Edge Function wording guidance changed and must be redeployed after merge. No Supabase schema/RLS/migrations, source connectors, bindings, sync logic, routes/sidebar, or chat archive/restore/delete persistence logic changed.

## Verified Local Follow-up — 2026-07-11 AI Assistant Archive Delete and Drawer Final Polish

AI Assistant history now keeps Recent as a 14-day non-archived view while Archive loads longer-term archived chats with a bounded 100-row limit. Drawer subtitles are view-specific, stored markdown previews are sanitized again at render time for old rows, archived chats can be permanently deleted only from Archive after an explicit confirmation dialog, and the frontend delete call requires `archived_at is not null`. A new Supabase migration adds a narrowly scoped DELETE policy for own archived `ai_chat_sessions` rows with the same active workspace role helper pattern; messages rely on the existing `on delete cascade` session foreign key. History rows and starter prompts received small spacing/compactness polish, and the composer auto-mode badge now says the AI will choose the mode. No Edge Functions, `supabase/functions/ai-helper-run`, routing contracts, connector behavior, source bindings, or existing archive/restore/rename behavior changed.

## Verified Local Follow-up — 2026-07-11 AI Assistant History Drawer Polish and General Constraint Migration

AI Assistant history drawer UX is now clearer and more compact: Recent/Archive tabs have stronger active styling with muted inactive states, chat rows use tighter list-like spacing with one-line titles/previews and compact inline rename/archive/restore actions, and sessions saved before a failed AI response show a muted “Без відповіді AI” / “No AI answer” label while remaining rename/archive/restore capable. Drawer preview/title/model-context sanitization now removes markdown heading, bold, and italic markers while preserving client-copy marker and leading context-label cleanup for previews only. The Assistant subtitle now reflects analytics, ads, imports, data quality, workflows, and general system questions. Repository migrations now include `20260711_allow_general_ai_helper_requests.sql`, matching the production `allow_general_ai_helper_requests` manual fix by allowing `general_assistant` request type and `general` context scope on `ai_helper_requests` without data, RLS, grant, or permission changes.

## Verified Local Follow-up — 2026-07-11 AI Assistant General Mode Prompt Polish

AI Assistant General mode prompt wording is now broader and adaptive: `ai-helper-run` identifies as the Analytics Hub AI Assistant first, uses marketing/ads/data/import/operations playbooks only when relevant, and sets `response_requirements.role` to `analytics_hub_ai_assistant` for General mode while retaining `senior_performance_marketing_analyst` for scoped analytical contexts. The Safety/Evidence playbook now applies JSON-only evidence specifically to workspace claims while allowing general explanatory/conversational answers from general knowledge and conversation history without invented workspace facts or action claims. Visible welcome/composer/thinking copy now reflects analytics, ads, imports, data quality, workflows, and general system questions.

## Verified Local Change — 2026-07-11 AI Assistant General Context Routing and History Archive UX

AI Assistant now defaults to a safe General mode (`general_assistant` / `general`) instead of Ads Health, so conversational/test/product/process prompts are no longer forced through ads-health context or ads-health playbooks. Deterministic routing still sends strong analytics prompts to Ads Health, Data Quality, Ads Anomalies, or Ads Performance, and true follow-ups continue using the previous analytical context unless a strong new intent appears. The `ai-helper-run` Edge Function now handles General mode with a safe non-analytics context builder, avoids `build_ai_ads_context` / production context for general prompts, and softens prompt wording so JSON-only evidence rules apply to workspace metrics/status/operations while general explanatory answers remain allowed without invented workspace facts. General playbook selection is limited to Safety/Evidence plus a General Assistant playbook. Normal Assistant UI no longer shows context chips on user bubbles, assistant cards, or history rows, while persisted request/context metadata is retained. The history drawer now has Recent and Archive views, compact chat-list rows, Archive and Restore actions backed by `archived_at`, and no hard delete. No Supabase RLS/schema, `ai_chat_sessions` / `ai_chat_messages` schema, access checks, AdsConnectors, Bindings / Звʼязки даних, source connectors, sync logic, routes/sidebar, or production secrets handling changed.

## Verified Local Fix — 2026-07-11 AI Assistant Live Chat History Persistence

AI Assistant chat history persistence now has a live-safe corrective path: authenticated PostgREST grants are added for `ai_chat_sessions` / `ai_chat_messages`, RLS policies are recreated with fully-qualified user/workspace predicates, and the frontend awaits first-session creation before saving messages. Successful session creation immediately sets `currentSessionId` and `pendingSessionId`, optimistically adds the session to the drawer list, then reloads real sessions so the History drawer depends on actual `ai_chat_sessions` rows. Non-blocking diagnostics now expose safe operation-level failures for session create, user/assistant message save, metadata update, drawer load, message load, rename, and archive while preserving visible AI answers if history saving fails. No `ai-helper-run` contract, assistant routing/playbooks, `build_ai_ads_context`, `build_ai_production_context`, AdsConnectors, Bindings / Звʼязки даних, source connectors, sync logic, routes/sidebar, or overlay styling changes were made.

## Verified Local Follow-up — 2026-07-10 AI Assistant History Drawer Overlay Polish

AI Assistant chat history drawer now uses an opt-in lighter Sheet overlay (`bg-slate-950/35` with subtle blur) so the app behind the drawer remains readable. Shared `SheetContent` supports an optional `overlayClassName` while preserving the existing `bg-black/80` default for every sheet that does not opt in. Drawer panel layout, title/i18n, rename, archive, client-copy behavior, Supabase schema/RLS, Edge Functions, routing, migrations, connectors, sync logic, routes, and sidebar were not changed.

## Verified Local Follow-up — 2026-07-10 AI Assistant Client Copy i18n Polish

AI Assistant client-copy block visible copy is now localized through the existing i18n map for both Ukrainian and English. The dedicated client-copy action still copies only the client-ready text, whole-answer copy still uses marker sanitization, and no schema/RLS, Edge Function, routing, conversation-history, drawer, rename/archive, connector, sync, route/sidebar, or permissions behavior changed.

## Verified Local Follow-up — 2026-07-10 AI Assistant Chat History Rename Polish

AI Assistant history drawer now includes localized manual rename controls for chat sessions. Rename keeps deterministic first-prompt titles as the default, updates only the session title, sanitizes leading context labels/client-copy marker lines, ignores empty submissions, and does not change archive behavior, schema/RLS, Edge Functions, routes/sidebar, connectors, sync, or permissions.

## Verified Local Follow-up — 2026-07-10 AI Assistant Chat History Production Polish

AI Assistant chat history polish now localizes all drawer copy through the existing i18n map, formats drawer timestamps with the current app language, derives drawer context labels from persisted request/context metadata when possible, and guards the async first-message session creation path against fast duplicate submits. No Edge Function contract, routing/playbook behavior, AdsConnectors, Bindings, source connectors, sync logic, routes/sidebar, permissions model, or migration shape changed.

## Verified Local Follow-up — 2026-07-10 AI Assistant Chat History Sanitization

AI Assistant persistent chat history now keeps raw assistant text with client-copy markers in saved message rows for faithful reload/rendering, while sanitizing titles, drawer previews, and bounded `conversation_history` text to strip leading `Контекст:` / `Context:` labels and remove raw client-copy marker lines. This preserves `Текст для клієнта` rendering after loading old chats without exposing markers in drawer previews or model continuity context.

## Verified Local Change — 2026-07-10 AI Assistant Persistent Chat History

AI Assistant now has persistent, user-owned Supabase chat sessions and messages. The Assistant header includes a compact `Історія` drawer that lists non-archived chats updated in the last 14 days, groups them by recency, lets users load prior messages, and soft-hides sessions via `archived_at` instead of deleting them. Loaded chats become the active thread, so the existing bounded `conversation_history` and thread metadata flow continues to provide context for follow-up prompts. Assistant response cards no longer show the visible frontend context chip by default, while user bubbles and persisted metadata retain the resolved context/request metadata. Client-copy behavior, whole-answer copy sanitization, deterministic routing/playbooks, AdsConnectors, Bindings, source connectors, sync logic, ads/import data models, `build_ai_ads_context`, and `build_ai_production_context` were not changed. System/outage routing remains a next task.

## Verified Local Follow-up — 2026-07-10 AI Assistant Whole-Answer Copy Sanitization

AI Assistant whole-answer copy now serializes rendered assistant text without raw `[CLIENT_COPY_START]` / `[CLIENT_COPY_END]` marker lines, while preserving the client-ready text and any internal notes outside the markers. The dedicated `Текст для клієнта` card copy remains unchanged and still copies only the client-ready text. Visual rendering is unchanged, and no Supabase schema, RLS, migrations, connectors, sync logic, permissions model, routes, or sidebar changes were made.

## Verified Local Follow-up — 2026-07-10 AI Assistant Client Copy Polish

AI Assistant answer rendering now deterministically strips duplicated leading `Контекст: ...` / `Context: ...` labels before display because the UI already shows the context chip. Explicit client-communication answers can now render model-marked `[CLIENT_COPY_START]` / `[CLIENT_COPY_END]` content as a dedicated copy-ready `Текст для клієнта` card with its own copy action, while the existing whole-answer copy remains available and internal notes/checklists render outside the client card. Prompt/playbook guidance keeps client communication conditional and instructs the model to keep internal notes outside the copy markers. No Supabase schema, RLS, migrations, `build_ai_ads_context`, `build_ai_production_context`, AdsConnectors, Bindings, source connectors, sync logic, permissions model, routes, or sidebar changes were made.

## Verified Local Follow-up — 2026-07-10 AI Assistant Adaptive Answer Structure

AI Assistant answer guidance was clarified so playbooks act as reasoning lenses rather than fixed output templates. Conciseness remains important to avoid bloated or cut-off answers, but section counts and campaign counts are now adaptive guidance rather than hard caps: small follow-ups should be answered directly, while complex questions may use enough structure and detail to include important blockers, risks, and actions. Client communication remains conditional and thread-aware, and normal analytical answers should avoid repeated client wording or generic report templates. No Supabase schema, RLS, migrations, `build_ai_ads_context`, `build_ai_production_context`, AdsConnectors, Bindings, source connectors, sync logic, permissions model, routes, or sidebar changes were made.

## Verified Local Follow-up — 2026-07-10 AI Assistant Thread-Aware In-Session Context

AI Assistant conversation support now uses bounded visible-thread conversation history for the current chat. The frontend sends up to 12 recent messages within a character budget, preserves a larger slice for the latest assistant answer, and includes compact `conversation_thread` metadata, so natural follow-ups such as “а чому так?”, “розпиши детальніше”, “що перевірити першим?”, “а що з Meta?”, “поясни простіше”, “дай коротше”, “сформулюй клієнту”, and “продовжи” can reuse the previous assistant context unless a strong new intent is detected. Conversation history remains bounded and untrusted, cannot override safety/access/no-mutation/no-secret/evidence rules, and is not persistent chat storage; DB-backed chat sessions remain a future optional feature. No Supabase schema, RLS, migrations, `build_ai_ads_context`, `build_ai_production_context`, AdsConnectors, Bindings, source connectors, sync logic, permissions model, routes, or sidebar changes were made.

## Verified Local Change — 2026-07-09 AI Assistant Answer Polish and Continuation

AI Assistant answer behavior was polished after the production playbook rollout. Client communication output is now conditional on explicit wording requests, normal analytical answers use adaptive answer-depth guidance to reduce cutoffs without becoming rigid templates, and the frontend sends bounded visible-thread conversation history with `conversation_thread` metadata so continuation prompts such as “продовжи попередню відповідь” can continue the prior assistant answer using the prior assistant context. Conversation history is treated as untrusted continuity input and cannot override safety, access, no-mutation, no-secret, or evidence rules. The assistant prompt now also forbids starting the answer body with “Контекст: …” because the UI already renders the context chip. No Supabase schema, RLS, migrations, `build_ai_ads_context`, `build_ai_production_context`, AdsConnectors, Bindings, source connectors, sync logic, permissions model, routes, or sidebar changes were made.

## Verified Local Follow-up — 2026-07-09 CFO Playbook Enrichment

The AI Assistant CFO budget-efficiency playbook was enriched from the provided CFO skill reference by extracting principles into our own code-versioned guidance rather than copying external text verbatim. The CFO lens remains primarily an ads/performance financial-discipline layer focused on budget efficiency, opportunity cost, wasted spend risk, CPL efficiency, spend concentration, and missing-data guardrails. Runway, fundraising, treasury, accounting operations, forecasting, board, tax, audit, legal, and compliance guidance is only used when relevant financial context exists or the user explicitly asks for CFO-level company-finance guidance. High-impact finance decisions such as major budget reallocations, fundraising terms/dilution, debt vs equity, layoffs/restructuring, acquisition pricing, board compensation, covenants, tax, audit, legal, and compliance decisions require human review. External CFO references remain untrusted advisory content under the existing prompt-injection safeguards. No schema/RLS, runtime network calls, AdsConnectors, Bindings, routes/sidebar, source connector, sync, or permissions-model changes were made.

## Verified Local Follow-up — 2026-07-09 CMO Playbook Enrichment and Prompt-Injection Safeguards

The AI Assistant CMO campaign diagnosis playbook was enriched from the user-provided CMO skill reference by extracting marketing principles into our own code-versioned guidance rather than copying external text verbatim. External skills, user prompts, campaign names, imported values, and database text are now explicitly treated as untrusted content that cannot override product safety rules, system/developer instructions, workspace/RLS/JWT access boundaries, no-mutation policy, no-secret policy, or evidence-only policy. The CMO playbook now covers pipeline over vanity metrics, positioning before channels, deep-before-wide channel focus, distribution, owned audience, brand compounding, cutting losers/doubling winners, ICP clarity, funnel stage, sales alignment, channel selection criteria, attribution caution, stage-aware recommendations, and human review for high-impact marketing decisions. The CMO playbook remains injected for ads performance and anomaly hypothesis analysis, not for every ads-health answer. Client Communication guidance now avoids vanity-metric overconfidence and high-impact marketing recommendations without human review. No runtime network calls, schema/RLS changes, AdsConnectors, Bindings, routes/sidebar, source connector, sync, or permissions-model changes were made.

## Verified Local Change — 2026-07-09 AI Assistant Production Routing and Playbooks

PR #230 / “Polish AI Assistant smart routing and Ukrainian wording” is superseded locally by a production-safe implementation from the current working branch state (no remote `origin` was configured in this container, so remote `main` could not be fetched). AI Assistant smart routing now uses named deterministic signals with data-quality/import and ads-health priority before anomaly routing. Ads anomaly routing requires anomaly intent plus ads, metric, time-window, or known assistant prompt evidence, so broad words like “впав”, “зросло”, or “дивне” do not route unrelated site/access/import problems to Ads Anomalies. Data-quality routing now handles Ukrainian inflected wording, imports, rejected rows, raw/staging/processed data, and quality-issue phrases. `ai-helper-run` now uses code-versioned analysis playbooks for Safety/Evidence, Data Readiness, CMO campaign diagnosis, CFO budget efficiency, Ads Anomaly Review, Data Quality/Import Review, Client Communication, and Operations Readiness. CMO/CFO playbooks are injected for performance/anomaly analysis, not for every ads-health answer. CFO guidance includes cash/runway awareness when relevant, opportunity cost, simple decision-making, spend/CPL efficiency, unit-economics guardrails, and no invented revenue/ROAS/LTV/payback; CMO guidance includes audience, creative, offer/message-market fit, funnel step, landing page/form, tracking, lead quality, and fatigue. No schema, RLS, migrations, AdsConnectors, Bindings, routes/sidebar, source connector, sync, or permissions-model changes were made. DB-managed prompt registry remains a future optional enhancement only if admin-editable prompt governance is required.

## Verified Local Change — 2026-07-09 AI Assistant Routing and Ukrainian Wording Polish

AI Assistant smart routing now handles Ukrainian data-quality inflections such as “якістю даних” and routes quality/import/rejected/raw-data prompts to `data_quality_summary` / `data_quality` without treating every generic “даних” phrase as data quality. Drop/spike/anomaly prompts such as “Що просіло за останні 7 днів?” now route to `ads_anomaly_explanation` / `ads_anomalies`, while ads freshness/sync/account prompts continue to route to Ads Health and campaign/CPL/spend prompts continue to route to Ads Performance. `ai-helper-run` Ukrainian prompt guidance now reduces mixed English operational wording, prefers “витрати / ліди”, “права доступу” / “відмова в доступі”, “привʼязки”, and “Звʼязки даних”, avoids grammar such as “бо є немає”, and keeps stale-data anomaly answers from inventing current drops. No Supabase schema, RLS, migrations, AdsConnectors, Bindings, routes/sidebar, source connectors, sync logic, or permissions-model changes were made.

## Verified Local Change — 2026-07-09 AI Assistant Live UX Polish

AI Assistant normal composer UX no longer exposes the confusing context override button/popover or disabled manual context dropdown. Smart auto-routing remains the default, with a neutral read-only Autocontext-enabled badge before submit, while resolved context still appears on routed messages after submit. The New chat action now lives in the assistant page header actions area, context labels were made less dominant in chat bubbles/cards, and the composer container radius now matches assistant answer cards instead of looking like a large pill. `ai-helper-run` prompt guidance for `ads_health_summary`/`ads_health` now asks for complete but focused freshness/readiness/binding guidance rather than artificially short answers or full campaign/CPL analysis unless explicitly requested. No Supabase schema, RLS, `build_ai_ads_context`, AdsConnectors, Bindings, routes/sidebar, source connectors, sync logic, or permissions-model changes were made.

## Verified Local Change — 2026-07-09 AI Assistant Production UX Auto-Routing

AI Assistant now auto-routes user questions to safer backend contexts instead of relying on the primary composer context dropdown. The default mode is Ads health, ads freshness/sync/account questions route to `ads_health`, campaign/CPL/spend questions route to `ads_performance`, anomaly/drop/spike questions route to `ads_anomalies`, and import/data-quality/mapping questions keep specialized contexts where possible. The primary composer now shows a subtle resolved-context badge and keeps manual context selection collapsed as an advanced/testing override. Assistant answers now include a copy action and improved lightweight markdown rendering with grouped bullets/numbered lists/headings/bold text. `ai-helper-run` now allows longer responses (`max_output_tokens = 2200`) while adding prompt rules for concise, user-facing wording that avoids raw backend field names in normal answers. No Supabase schema, RLS, routes/sidebar, AdsConnectors, Bindings, connector, sync, mutation, or permissions-model changes were made.

## Verified Local Follow-up — 2026-07-09 Conservative AI Ads Live API Interpretation

`ads_context_status.source_interpretation` now treats live API interpretation conservatively: `live_api_health_claim_allowed` and `uses_live_api_data` require fresh facts plus production-ready/readiness-validated API raw data, no likely test/empty account state, no `platform=other` filter, and facts not interpreted as imported history. Imported interpretation now explicitly includes unified fallback, `platform=other`, selected imported-history facts, and `connected_with_imported_fallback`. Existing `build_ai_ads_context` signature, returned fields, nested `pipeline_diagnostics`, top-level `multi_account_readiness`/`binding_gaps`, prompt hardening, frontend routes/pages/sidebar, RLS, schemas, and request payloads remain unchanged.

## Verified Local Change — 2026-07-09 Normalized AI Ads Context Guidance

AI ads context now returns normalized `ads_context_status` guidance for safer AI Assistant interpretation of ads data availability, analysis windows, source layer/freshness, source readiness, and binding gaps. The existing `pipeline_diagnostics` contract remains preserved, while `multi_account_readiness` and `binding_gaps` are also promoted to top-level fields for easier AI discovery. `platform=other` is explicitly documented in context as imported historical ads facts, not a live ad network. The `ai-helper-run` ads prompt now requires data availability/freshness/source readiness/binding status review before performance analysis and forbids unsafe "no data" or live API health claims when historical/imported/fallback data or disallowing status exists.

## Verified Local Change — 2026-07-09 AdsConnectors Diagnostics Compact Admin Overview

AdsConnectors → Diagnostics was polished from long side-by-side diagnostic columns into a compact admin overview. The normal view keeps the intro card, renders Ads data context as a full-width compact metrics summary, and places Daily snapshots plus Anomaly candidates in responsive two-column cards with three-row previews. Raw diagnostics remain in collapsed DeveloperDetails / technical details, and imported facts stored with backend `platform = other` display as friendly Imported data / Імпортовані дані labels in normal UI. Frontend only: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, backend values, data fetching, write actions, AdsConnectors tab structure, or Bindings page changed.

## Verified Local Change — 2026-07-09 AdsConnectors Diagnostics UI Polish and Binding Terminology

AdsConnectors now restores binding terminology to Bound / Unbound / Partially bound / Needs binding in English and Привʼязано / Без привʼязки / Частково привʼязано / Потрібна привʼязка in Ukrainian. The Diagnostics tab normal view was redesigned from cramped raw tables into readable admin-first cards/lists: an explanation card, compact ads data context summary, daily context list, and anomaly candidate list with localized labels. Raw diagnostics and wide technical tables remain available only inside collapsed DeveloperDetails / technical details. Frontend only: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, backend values, data fetching, or write actions changed.

## Verified Local Follow-up — 2026-07-09 AdsConnectors Shared Operational Notice Completion

AdsConnectors no longer keeps page-local StatusPill, WarningNotice, or InfoNotice implementations for reusable operational status UI. Remaining warning/info/success/muted notices, badges, status dots, and attention surfaces now use the shared operational status layer, including the new info surface tone. Bindings behavior remains unchanged, including gap cards, Bind account / Привʼязати акаунт, drawer prefill, warning summary, and manual bind flow. Frontend only: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, backend values, data fetching, or write actions changed.

## Verified Local Change — 2026-07-09 Shared Operational UI Styles

AdsConnectors and Bindings now share operational UI styling instead of duplicating page-local Tailwind status strings. Badge variants now cover success, warning, info, and muted operational states; shared status surfaces/cards cover warning, success, neutral, and muted states; and both AdsConnectors and Bindings use the shared operational subnav trigger style. Bindings needs-binding warning badges/surfaces still render as amber action-needed UI, and the existing Bind account / Привʼязати акаунт drawer prefill flow remains unchanged. Frontend only: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, backend values, data fetching, or write actions changed. Future operational UI work should reuse the shared status badge/surface and subnav helpers instead of defining local Tailwind status classes.

## Verified Local Follow-up — 2026-07-09 Bindings Needs-Binding Warning State

Bindings → Overview and Bindings → Ad accounts now render accounts that need binding with amber warning badges and subtle warning card/surface styling instead of neutral outline badges. The existing gap-card Bind account / Привʼязати акаунт action, create drawer behavior, matched `ad_account_id` prefill, empty client/project/funnel selections, unmatched disabled fallback, and manual bind flow remain unchanged. Frontend only: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, AdsConnectors page, backend values, import pipeline, or binding-create/update contract changed.

## Verified Local Change — 2026-07-09 Bindings Gap Card Direct Binding Action

Bindings → Ad accounts now lets admins start the existing ad account binding workflow directly from an account-gap card. Each matched gap card has a localized Bind account / Привʼязати акаунт action that opens the existing drawer in create mode, prefills only the matched `ad_account_id` found by platform plus `external_account_id`, and leaves client/project/funnel empty for admin selection. If the diagnostic gap cannot be matched to a selectable ad account option, the card keeps the action disabled and shows localized refresh/check-Ads-Connectors guidance instead of submitting fake IDs. AdsConnectors remains the operational source/account/sync status page, while Bindings remains the remediation/action page. Frontend only: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, AdsConnectors page, backend values, import pipeline, or binding-create/update contract changed.

## Verified Local Change — 2026-07-08 Bindings Ads Readiness UX Separation

Bindings / Mapping now clarifies that it is the action area for binding sources and ad accounts to clients, projects, and funnels, while AdsConnectors remains the operational source/account/sync status area. The Bindings Overview no longer duplicates the full AdsConnectors ad readiness metric block; it keeps a compact Ad accounts summary focused on accounts that need binding and points admins to Ads Connectors for connection/sync status. Bindings → Ad accounts now shows binding gaps as friendly actionable account cards above the existing binding form/table, using localized “Needs binding” copy and next-step guidance instead of normal-UI backend codes or backend English messages. The Health tab keeps the raw readiness payload only in developer/technical details. Frontend only: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, AdsConnectors page, backend values, write actions, or binding-create/update contracts changed.

## Verified Local Change — 2026-07-08 AdsConnectors Real Account Visibility Semantics

AdsConnectors → Ad accounts now treats Real accounts / Реальні акаунти as discovered real platform ad accounts rather than only active bound binding rows. The frontend derives and dedupes platform accounts from existing binding rows, `multiAccountReadiness.accounts`, and `multiAccountReadiness.binding_gaps`, prioritizing active binding details when present while still rendering unbound real accounts such as the live TikTok Ads advertiser with Needs binding / Потрібна привʼязка. Binding gaps remain read-only diagnostics in collapsed readiness details, and archived/test/service placeholder bindings remain in Test and archived bindings. The Overview bound-only KPI is now labeled Bound accounts / Привʼязані акаунти instead of Ready accounts / Готові акаунти. Backend contracts were not changed: no Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, Bindings page, Imports page, or write actions changed.

## Verified Local Change — 2026-07-07 AdsConnectors Status Filter Dropdown Alignment

AdsConnectors → Ad accounts now uses the same compact inline status Select/dropdown pattern as Bindings / Mapping → Ad accounts. The visible label remains localized as “Статус:” / “Status:”, the existing active/archived/all filtering logic and values are preserved, and the segmented button group was removed. Backend contracts were not changed.

## Verified Local Change — 2026-07-07 AdsConnectors Ad Accounts Live Review Polish

AdsConnectors → Ad accounts was polished after live review with frontend-only changes. The status filter was compacted into an inline toolbar that keeps the active/archived/all control without the heavy visible “Status filter” label. Expanded readiness details now render readable platform readiness and binding-gap cards/lists instead of wide technical tables, with localized labels and frontend-only friendly display copy for common backend readiness messages. The compact readiness summary, “Real accounts” / “Real account” wording, binding-gap next action, collapsed-by-default details, and no-fake-write-action behavior remain unchanged. Backend contracts were not changed: no Supabase schema, RLS, RPC contracts, OAuth, sync behavior, Edge Functions, or `ai-helper-run` changes.

## Verified Local Change — 2026-07-07 AdsConnectors Readiness UI Polish

AdsConnectors Overview and Ad accounts now present multi-account readiness in business-readable, non-production-safe language. Overview keeps a compact Ad account readiness summary with friendly overall status, nested total/bound/unbound/needs-attention counters, and a specific next action that names binding gaps by count and platform/account when available. Binding gaps/unbound accounts are first-class Needs attention items alongside TikTok no-data and Facebook Lead Ads no-forms states. The readiness block uses “Operational readiness” instead of “Production readiness”, while preserving “Real accounts” for ad accounts that truly exist on Meta Ads, Google Ads, or TikTok Ads even when they have no spend/campaign data yet. The Ad accounts tab keeps Real accounts cards high on the page with compact readiness first and detailed platform readiness/binding gaps collapsed for developer review. Bindings remains the place to actually fix binding gaps. No Supabase schema, RLS, RPC contracts, OAuth, sync behavior, Edge Functions, ai-helper-run, Bindings page, Imports page, routes, sidebar, or top-level tabs changed.

## Verified Local Change — 2026-07-07 Bindings Ads Binding Gap Readiness

The existing `/bindings` page now uses `public.build_ads_multi_account_readiness(uuid)` as read-only guidance where admins manage ad account bindings. The Overview tab shows a compact Ads account binding readiness card with `overall_status` plus nested `summary.total_accounts`, `summary.bound_accounts`, `summary.unbound_accounts`, and `summary.needs_attention_count`. The existing Ad accounts tab shows a compact read-only Binding gaps section from `binding_gaps` above the existing binding table/form, while keeping create/edit binding actions unchanged. The existing Health tab includes the raw readiness payload inside technical details. If the readiness RPC is unavailable, only the readiness sections show an unavailable state and the rest of Bindings continues to load. No new page, route, sidebar item, top-level tab, Imports placement, Supabase schema, RLS, OAuth, sync behavior, Edge Functions, AdsConnectors duplication, ads connector write logic, or binding-create/update contract changed. AdsConnectors remains the source/account/sync readiness surface; Bindings now shows binding gaps where admins manage bindings. One-click fix actions remain future work, and real platform sync fixes remain deferred until real ad accounts/data are available.

## Verified Local Fix — 2026-07-07 AdsConnectors Readiness Summary Shape

AdsConnectors multi-account readiness UI now matches the backend data shape: Overview summary counters read from `multi_account_readiness.summary` while platform rows remain sourced from `platforms` and binding gaps from `binding_gaps`. Missing `summary` remains safe and does not break the page; total accounts can fall back to the existing account count while other missing counters use existing metric formatting. No routes, tabs, navigation, Supabase schema, RLS, OAuth, sync behavior, Edge Functions, Imports page, or Bindings write actions changed.

## Verified Local Change — 2026-07-07 AdsConnectors Multi-Account Readiness UI

The existing `/ads-connectors` page now reads `public.build_ads_multi_account_readiness(uuid)` as the source of truth for multi-account ads readiness and surfaces the backend diagnostics on the existing Overview and Ad accounts tabs. Overview shows the overall status, account totals, bound/unbound counts, needs-attention count, and a read-only next action derived from binding gaps. The Ad accounts tab now shows a compact read-only platform readiness table and binding-gap table above the existing `AdAccountsTable`. Diagnostics includes the raw multi-account readiness payload only inside the existing developer-details pattern. No new page, route, sidebar item, top-level tab, Imports placement, Admin panel, Supabase schema, RLS, OAuth, sync behavior, Edge Functions, imports pipeline, or binding write actions were added. `/bindings` remains the place for actual binding management, write actions for fixing binding gaps remain future work, and real platform sync fixes remain deferred until real ad accounts/data are available.

## Verified Production Hotfix Mirror — 2026-07-07 Imported Ads Facts Platform Constraint

The repository now mirrors the Supabase production hotfix for `public.rebuild_imported_ads_facts(uuid, date, date)`: imported historical facts are written to `facts_ads_daily` with `platform = other` because the production `facts_ads_daily_platform_check` only allows known platform codes (`meta_ads`, `facebook_ads`, `google_ads`, `tiktok_ads`) or `other`. The deterministic fact key still preserves the imported marker as `imported:{metric_date}:{md5(campaign_name)}`, `ON CONFLICT (workspace_id, fact_key)` remains the idempotent upsert key, `level = campaign` is unchanged, and imported reach still maps to `impressions`. The production backfill succeeded with `status = ok`, `rows_read = 240`, and `rows_inserted_or_upserted = 240`; `facts_ads_daily` now contains imported historical facts for 2026-04-01 through 2026-05-05, and AI ads context now uses `source_layer_used = facts_ads_daily` with `fallback_used = false` for this historical imported ads window. Frontend UI, OAuth, live platform sync, RLS, Edge Function contracts, `build_ai_ads_context` signature, and `ai-helper-run` request/response contract were not changed. Real Google/Meta/TikTok sync fixes remain deferred until real accounts/data are available.

## Verified Local Change — 2026-07-07 Imported Ads Facts Backfill

A safe additive imported ads facts rebuild path now exists as `public.rebuild_imported_ads_facts(uuid, date, date)`. The RPC reads historical imported ads performance from `v_unified_ads_performance_daily`, aggregates deterministically at the workspace/date/imported-platform/campaign grain supported by the current unified imported source, and upserts into `facts_ads_daily` through the production `(workspace_id, fact_key)` key with deterministic imported fact keys, explicit `level = campaign`, imported reach mapped to `impressions`, and a JSON summary containing rows read/upserted, effective date range, first/last metric dates, source layer, warnings, and status. This does not require real Google/Meta/TikTok production accounts and does not change OAuth, live sync functions, frontend UI/routes, RLS, secrets, or the `ai-helper-run` request/response contract. `build_ai_ads_context` was already facts-primary and should automatically prefer `facts_ads_daily` once imported facts are populated; unified imported fallback remains available when facts are empty. Real Google/Meta/TikTok sync fixes remain deferred until real production accounts/data are available.

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


## Verified Local Change — 2026-07-07 Ads Multi-Account Readiness Diagnostics

Backend ads diagnostics now include additive multi-account onboarding/binding readiness through `public.build_ads_multi_account_readiness(uuid)`, and `build_ads_pipeline_diagnostics` includes the result as `multi_account_readiness` without changing its signature. The diagnostic JSON makes agency multi-account provider support explicit for cases where one Meta, Google Ads, or TikTok connection can expose many ad/customer/advertiser accounts, and reports stable readiness statuses, summary counts, per-platform readiness, per-account binding state, and binding gaps such as unbound active accounts, ambiguous primary bindings, scope-less bindings, inactive accounts with active bindings, and connections with no discovered accounts. This prepares admin/source-management workflows to display account binding readiness. It is read-only and does not change frontend UI, OAuth, live platform sync, RLS, Edge Functions, tokens/secrets, sync logs, facts, source data, `build_ai_ads_context` signature, or the `ai-helper-run` request/response contract. Real Google/Meta/TikTok sync fixes remain deferred until real production accounts/data are available.


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
