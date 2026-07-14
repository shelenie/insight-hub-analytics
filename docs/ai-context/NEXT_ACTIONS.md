## Next Action — 2026-07-14 Bindings Final Manual Geometry Review

After merge to a previewable environment, manually verify `/bindings` with the expanded 256px DashboardLayout sidebar at 1280px, 1440px, and 1700px. Confirm an internal table scrollbar is acceptable at 1280px, no internal table scrollbar appears at 1440px/1700px, the page itself never gains horizontal overflow, Platform/Client, Mapping status/Status, and Updated/Action remain visually separated, and active/archived/permission-loading/read-only action states align inside the compact Action column. No Supabase migration, RPC, Edge Function, production data, deployment, or automated browser harness action is required for this frontend-only review fix.


## Next Action — 2026-07-13 Bindings Layout Manual QA

After CI/preview is available, manually verify `/bindings` at approximately 1440px and 1700px for active and archived Source bindings plus active and archived Ad Account bindings. Confirm no Updated/Action overlap, no desktop horizontal scrollbar, action buttons stay within the table border, Restore uses the same action alignment, friendly source names appear in Archive/Restore dialogs, and the yellow unbound Ad Account cards remain unchanged. No Supabase migration/deployment action is required for this frontend-only task.

## Local Frontend Fix — 2026-07-13 Bindings UI Defects

A narrow frontend-only `/bindings` fix is prepared locally. The archived bindings filter now has the missing `bindingsStatusArchived` translation while retaining the older archived/paused key. Source and Ad Account binding tables keep real semantic `<td>` cells, move line clamping into inner `<div>` wrappers for Client/Project/Funnel values, use explicit desktop `<colgroup>` widths, and keep desktop overflow clipped inside the table container. Google Sheet tab sources now display a friendly `Sheet name · Tab name` label while preserving the raw technical value in the title/developer path. `useWorkspaceRole` now uses the existing React Query cache keyed by workspace and session user to prevent permission flicker and repeated Edge Function calls during cache freshness; binding action cells show a compact loading placeholder until permissions resolve. Archive/restore semantics, RPCs, migrations, RLS, Edge Functions, production data, AI Helper, and Ads sync were not changed.


## Review Follow-up — 2026-07-13 PR #249 Data Bindings Restore Schema and Status Semantics

Review blockers for PR #249 were addressed locally. The `reactivate_binding` migration now matches the verified production Google Sheet tab schema (`google_sheet_source_id`, `is_active`) and validates exact active Client/Project/Funnel parents plus active source/ad-account `is_active` state without applying the migration. Bindings UI status semantics now separate archived from paused: archived filters and restore actions target only exact archived rows, paused rows remain read-only and appear only under All, and restore errors are mapped to friendly UI copy. Ad Account success copy is now determined by create/edit action mode instead of duplicate detection. No production migration application, production data change, Edge Function deployment, archive cascade RPC change, AI Helper change, or Ads synchronization change was made.


## Local Production UX Fix — 2026-07-13 Data Bindings Drawer, Archive Visibility, and Restore RPC

A narrow Data Bindings production UX fix is prepared locally. Source and Ad Account binding drawers now use a three-region Sheet layout with a fixed header, the only scrollable body region, and a non-sticky safe-area footer; pending saves keep fields, Cancel, X, outside click, and Escape disabled until refreshed binding data returns. Source create/edit success copy now distinguishes “Зв’язок створено” from “Зв’язок оновлено”. Source and Ad Account business tables use desktop table-fixed layouts with safe long-name wrapping. Archive success now refreshes data, switches the relevant filter to archived, keeps the archived row visible, and offers a “Переглянути архівні” CTA when active rows are empty. Archived source/ad-account bindings show a real “Відновити” action backed by a new `reactivate_binding` SECURITY DEFINER RPC that restores the existing archived row only after role, workspace, parent hierarchy, source/ad-account active-state, duplicate, and primary-scope validation. Production migration application, production data changes, and Edge Function deployment were not performed.


## Review Follow-up — 2026-07-13 PR #248 Source Error Payloads and Exact Archive Counts

Review follow-up for PR #248 now parses structured `FunctionsHttpError` JSON payloads for source binding save failures through the existing helper before showing the single global error toast. Source resolver identity is canonical (`google_sheet_source` / `google_sheet_tab` / `file_dataset`) with source business/ingestion details preserved in metadata, and onboarding archive binding counts now match cascade RPC semantics exactly by counting only blank/null or `active` binding statuses. Fake string-test compatibility comments were removed and formatting-only churn was reduced. No migration, RPC signature change, RLS change, production data change, Edge Function deployment, AI Helper change, or Ads synchronization change was made.


## Local QA Fix — 2026-07-13 Production Binding Source Kinds, Drawer UX, and Archive Dialog

A narrow production QA fix maps binding source entities to canonical RPC-safe source kinds: Google Sheet roots use `google_sheet_source`, Google Sheet tabs use `google_sheet_tab`, and raw external/file datasets use `file_dataset`, so business classifications such as questionnaires are no longer passed as `source_kind`. Binding source save failures now parse Edge Function JSON where available and show one global semantic error toast without a persistent duplicate drawer error block. Source and ad-account binding drawers share one scrollable layout with padded sticky safe-area footer, and shared `BindingSelect` uses one wheel-scrollable, overscroll-contained list. Onboarding archive confirmation now uses the shared AlertDialog and shows active Project/Funnel/source-binding/ad-account-binding counts separately for only the selected active scope; no migration, RLS change, archive RPC change, binding RPC signature change, production data change, AI Helper change, or Ads synchronization change was made.


## Review Follow-up — 2026-07-13 Funnel Activation Parent Validation

Final review fix extends `onboarding-funnel-upsert` parent validation so Funnel reactivation and active edits require both an active Project and the owning active Client in the same workspace. Funnel archive transitions still run before parent checks, and archived-to-archived edits still skip parent checks. No migration, deployment, production data, binding behavior, Ads connector, AI helper, or frontend count-helper changes were made in this follow-up.


## Review Follow-up — 2026-07-13 Onboarding Archive Transition and Count Fix

Review fixes refined onboarding archive semantics: Edge Functions now classify existing/requested statuses so only active-to-inactive transitions invoke cascade RPCs. Already-inactive records saved as inactive update the selected row normally without parent-active checks or descendant changes; reactivation and active normal edits retain parent-active validation. `/onboarding` archive confirmations now count only active descendants in the selected Client or Project scope and exclude unrelated/already-inactive rows. Production migration application and live verification remain blocked in this environment because Supabase apply_migration tooling/credentials are unavailable.


## Local QA Fix — 2026-07-13 Onboarding Archive Cascade Semantics

A narrow production QA fix adds authenticated transactional onboarding archive cascade RPCs for Clients, Projects, and Funnels. Archive transitions are soft-only, preserve IDs, update timestamps/metadata, cascade inactive status to descendants where applicable, and archive active ad-account/source bindings in the affected scope. Onboarding Edge Functions now distinguish archive transitions from normal edits/reactivation so archive is allowed under inactive parents, while reactivation and normal edits still require active parents in Client → Project → Funnel order. `/onboarding` now confirms Client/Project archive actions and parses JSON Edge Function error payloads into friendly localized messages instead of surfacing only generic non-2xx text. Production migration application, Edge Function deployment, and live manual retest are still required.

## Next Action — 2026-07-13 Post-QA Source Candidate Privilege Verification

After merge, apply `supabase/migrations/20260713_fix_source_candidate_table_privileges.sql` through the project-standard Supabase migration workflow if it has not already been applied, then verify live table privileges and RLS state for `google_sheet_sources`, `google_sheet_tabs`, and `raw_external_datasets`. Manually retest `/bindings` → `Джерела даних` source candidate visibility, create one source binding, then edit one test Onboarding record and confirm the semantic success toast. No Edge Function redeploy is expected.

## PR #245 Final Step 3 Status — Ready for merge after main sync and CI

- Step 3 Data Bindings frontend actions and onboarding exact create/edit paths are complete locally.
- No Data Bindings migration is required; do not reapply `20260711_harden_data_binding_mutation_rpcs.sql`.
- After merge, deploy only: `binding-create-or-update`, `binding-archive`, `onboarding-client-upsert`, `onboarding-project-upsert`, and `onboarding-funnel-upsert`. Do not deploy unrelated functions.
- Manual production QA after deployment: binding create/edit/rebind/archive for source and ad-account rows, member read-only behavior, source parent validation, onboarding create/edit/reactivation, audit metadata, and reparent guard behavior.
- Local environment could not fetch GitHub `main` because outbound GitHub access is blocked by a CONNECT 403; complete final GitHub mergeability/CI confirmation on the remote PR head after branch sync.

## Verified Local Follow-up — 2026-07-12 AI Assistant Client Wording Follow-up Routing

AI Assistant thread-follow-up detection now explicitly recognizes client-wording follow-ups such as “що сказати клієнту?”, “поясни клієнту”, “дай текст клієнту”, and “client update” without treating every generic mention of “client” as a continuation. After a System diagnostics or Ads Health answer, those explicit wording requests preserve the previous assistant route; standalone client-wording prompts without previous assistant context continue to fall back to General. No request_type/context_scope values, Supabase schema/migrations, playbook behavior, chat history, Data Bindings, connectors, routes/sidebar, or Edge Function code changed in this follow-up.

## Verified Local Change — 2026-07-12 AI Assistant System Diagnostics Routing

AI Assistant now routes application/system/deploy/auth/API/runtime troubleshooting prompts to the existing Production Readiness backend contract (`production_readiness_summary` / `production_readiness`) with the user-facing label “Системна діагностика” / “System diagnostics”. Deterministic routing keeps Data Quality/Imports and Ads Health ahead of system diagnostics for clearer domain-specific prompts, so imported rows/files/mapping and advertising account/sync/access questions remain separate. System-diagnostics thread follow-ups such as “що перевірити першим?”, “а чому так?”, and client wording requests preserve the Production Readiness route unless the user asks a clear new Ads/Data/General question. The Operations/Production Readiness playbook is now evidence-first for system troubleshooting: it must not claim an outage without evidence, must separate confirmed facts from likely causes and missing verification, must request concrete evidence/logs/statuses, and must recommend safe non-destructive checks before any configuration changes. No Supabase migration, RLS/permission change, chat persistence schema change, Ads connector change, OAuth change, sync orchestration change, routes/sidebar change, or dashboard calculation change was made. The `ai-helper-run` Edge Function guidance changed and must be redeployed after merge.

## Next — Verify PR #242 Data Bindings migration against live Supabase

- Before merge/deployment, verify the corrected exact-signature migration in a safe staging or SQL review path against the target Supabase project.
- Confirm the corrected migration still preserves exact live UUID return types for onboarding upserts during staging SQL review.
- After deployment, verify the pg_proc audit passes and no sensitive overload remains executable by PUBLIC or anon.

## Next — Deploy and wire hardened Data Bindings mutations

- Apply and verify `supabase/migrations/20260711_harden_data_binding_mutation_rpcs.sql` against the target Supabase project before wiring frontend mutation actions.
- Confirm live function signatures match the hardened migration, especially `bind_source_entity_to_scope`, `archive_binding`, `update_binding_mapping_status`, and onboarding upsert RPC return types.
- After deployment, update frontend binding mutations to use `manage_ad_account_binding` for authenticated admin/superadmin ad-account binding create/replace flows.
- Manually verify that existing active production bindings remain unchanged by migration application and that members cannot execute mutation RPCs.

## Next Actions — 2026-07-11 AI Assistant Routing Source QA

- Redeploy `ai-helper-run` after merge because client-only copy guidance changed in the Edge Function prompt/playbooks.
- Live-test automatic General (“Що таке CPL?”) and Ads Health (“Чому немає свіжих рекламних даних?”) prompts and confirm admin Technical details show Routing = Автоматично with `general_assistant/general` and `ads_health_summary/ads_health` respectively.
- Live-test any explicit manual override/dev mode flow if re-enabled and confirm Routing = Вручну / `auto_routed = false`.
- Live-test “сформулюй клієнту” after redeploy and confirm the answer contains only `[CLIENT_COPY_START]... [CLIENT_COPY_END]` client copy with no internal checklist unless explicitly requested.

## 2026-07-11 — Next: Redeploy AI Helper and QA Assistant Polish

- Redeploy `supabase/functions/ai-helper-run` after merge because client communication playbook wording changed.
- QA History drawer behavior: open History from any prior Archive state and confirm it starts on Recent, then switch to Archive inside the open drawer.
- QA admin/superadmin Assistant answers: confirm Technical details are collapsed by default and show only request_type, context_scope, auto_routed, and mode_label.
- QA normal member Assistant answers/history cards: confirm no context chips or routing metadata are visible.

## 2026-07-11 — AI Assistant History UX Follow-up

- Verify the new archived-session DELETE policy after migration deployment: permanent delete should succeed only for own archived sessions with active workspace access and should remain unavailable for Recent/non-archived sessions.
- Live-check that Recent still shows only the last 14 days, Archive shows older archived chats, and old stored markdown previews render without raw `**`, `*`, or `###` markers.

## 2026-07-11 Follow-up

- After deployment, verify a future clean/non-production Supabase environment applies `20260711_allow_general_ai_helper_requests.sql` successfully and accepts `general_assistant` / `general` AI helper requests without manual DB intervention.
- Live-smoke the AI Assistant drawer in light and dark themes to confirm Recent/Archive active-state contrast and compact rows feel clear on desktop and touch devices.

## Updated — 2026-07-11 AI Assistant General Routing Follow-up

- Verify General mode behavior in the deployed app with representative Ukrainian prompts: “Тест історії чату”, “Просто тест”, “Що таке CPL?”, “Чому немає свіжих рекламних даних?”, “Де є проблеми з якістю даних?”, “Що просіло за останні 7 днів?”, and “Які кампанії потребують уваги?”.
- If product wants explicit debug visibility, add an opt-in developer-only context metadata panel rather than restoring normal UI context chips.
- Keep monitoring whether additional strong routing signals are needed for system/outage/product-process prompts without weakening evidence or access rules.

## 2026-07-11 Next — Verify AI Assistant History Persistence in Live

After deploying this fix and applying `supabase/migrations/20260711_fix_ai_assistant_chat_history_persistence.sql`, create a fresh live AI Assistant chat and verify that `ai_chat_sessions` increments, both user and assistant rows appear in `ai_chat_messages`, and the new session appears in the History drawer without a full page reload. If a save fails, use the muted history diagnostic under the composer to capture the safe operation name/code/message. Continue to avoid AdsConnectors, Bindings / Звʼязки даних, source connector, sync, routing/sidebar, and overlay work in this verification.

## 2026-07-10 Next — System / Outage Routing After Assistant Chat History

AI Assistant persistent chat sessions are now implemented locally with a 14-day recent-history drawer, user-owned RLS-backed tables, soft archive hiding, loaded-session continuation through bounded conversation history, and hidden assistant-card context chips. After review/apply of migration `20260710_ai_assistant_chat_history.sql`, the next AI Assistant product step remains system/outage routing; do not treat this chat-history work as system/outage routing.

## 2026-07-10 — AI Assistant Whole-Answer Copy Follow-up

- In live QA, confirm the bottom whole-answer copy no longer includes `[CLIENT_COPY_START]` / `[CLIENT_COPY_END]` marker lines while preserving client text and internal notes.

## 2026-07-10 — AI Assistant Client Copy Polish Follow-up

- Verify the dedicated client-copy card in a live assistant thread with explicit prompts such as “сформулюй клієнту” and confirm only the client-ready text is copied by the card button.
- Continue monitoring live answers for awkward client-intro prefixes or internal checklist leakage; prompt rules and frontend marker parsing are now in place, but model behavior should still be observed.

## 2026-07-10 — AI Assistant Adaptive Answer Structure Follow-up

- Live-test that normal answers stay concise without becoming rigid templates or omitting important blockers.
- Confirm small follow-ups are answered directly and complex prompts can receive fuller structured analysis when useful.
- Continue keeping client wording conditional and avoiding duplicate context labels in answer bodies.

## 2026-07-10 — AI Assistant Thread-Aware Context Follow-up

- Smoke test current-chat follow-ups after deployment: continuation, simplification, prioritized checks, platform-specific follow-ups, and client wording follow-ups.
- Confirm strong new-intent prompts still reroute to Data Quality, Ads Performance, Ads Anomalies, and Ads Health as expected.
- Keep persistent DB-backed chat sessions as an optional future feature, not part of the current PR.

## 2026-07-09 — AI Assistant Answer Polish Follow-up

- Verify live AI Assistant responses for the four production prompts and one explicit client-communication prompt after deployment.
- Confirm continuation prompts continue the visible previous assistant answer instead of restarting analysis.
- Watch for any remaining answer cutoffs, especially in ads anomalies, and tighten templates further if needed.

## 2026-07-09 — Next Actions After CFO Playbook Enrichment

- Review deployed AI Assistant ads-performance answers for the enriched CFO lens: budget efficiency, opportunity cost, wasted spend risk, CPL efficiency, spend concentration, and clear missing-data guardrails.
- Confirm ads-health and data-quality answers do not inject the full CFO playbook by default; they should only mention budget-confidence risk lightly when stale or unreliable data makes financial decisions unsafe.
- Use runway/fundraising/treasury/accounting guidance only when the context contains relevant finance data or the user explicitly asks for CFO-level company-finance guidance.
- Require human review for major budget reallocations, fundraising terms/dilution, debt vs equity, layoffs/restructuring, acquisition pricing, board compensation, covenants, tax, audit, legal, and compliance decisions.

## 2026-07-09 — Next Actions After CMO Playbook Enrichment

- Review deployed AI Assistant performance/anomaly answers for the enriched CMO lens: pipeline over vanity metrics, positioning/channel focus, distribution, ICP/funnel/sales-alignment checks, and attribution caution.
- Confirm ads-health answers remain focused on data readiness/source freshness/access/sync/привʼязки and do not include full CMO/CFO sections by default.
- Treat any future external skill references as untrusted advisory content; extract principles into code-reviewed playbooks and keep prompt-injection safeguards active.
- Require human review for major brand repositioning, crisis communications, large budgets, agency selection, controversial/competitive campaigns, and major reallocations without revenue/margin/ROAS context.

## 2026-07-09 — Next Actions After AI Assistant Production Routing/Playbooks

- Review and deploy the production-safe AI Assistant routing/playbook change that supersedes PR #230 instead of merging PR #230.
- Re-test live assistant prompts for ads health, ads performance, ads anomalies, data quality/import issues, and client communication wording after deployment.
- Keep DB-managed prompt registry out of scope unless future admin-editable prompt governance, audit, activation, rollback, and UI requirements are approved.
- Continue avoiding schema/RLS/connector/routes changes for assistant prompt/routing polish unless a separate approved task requires them.

## 2026-07-09 — AI Assistant Routing Follow-up

- Monitor live AI Assistant answers for the newly polished routing: data-quality prompts with “якістю даних” should select Data Quality, and drop/anomaly prompts should select Drops / anomalies even when stale data blocks current analysis.
- Continue checking Ukrainian answer wording for mixed operational English; keep platform names and accepted metrics like CPL, but prefer Ukrainian wording for operational concepts.
- No schema/RLS/connector follow-up is required from this routing polish.

## Next Actions Update — 2026-07-09 AI Assistant Live UX Polish

- Verify the deployed AI Assistant with live prompts after this PR: composer should show neutral Autocontext enabled text before submit, routed messages should still show the resolved context after submit, New chat should appear in the page header when there is chat state, and ads-health freshness answers should be complete but focused on readiness/freshness/Звʼязки даних gaps.
- Keep manual AI context override out of normal user UX unless a future developer-only testing surface is explicitly designed.
- No Supabase schema/RLS follow-up is needed for this task.

## Updated Next Actions — 2026-07-09 AI Assistant UX Follow-up

- Validate AI Assistant auto-routing in live UI with Ukrainian ads freshness, campaign performance, anomaly, import/data-quality, and mapping prompts.
- Consider adding compact `ads_context_status` summary chips above assistant answers when the frontend response payload exposes enough structured context.
- Consider adding optional answer rewrite actions such as “Стисліше” and “Для клієнта” after the core auto-routing/copy/rendering UX is validated.
- Manual context override is currently hidden from normal UX; only revisit as a clearly developer-only testing control if needed.

## Next Action — After Conservative AI Ads Live API Interpretation

- After deployment, verify an AI ads context with fresh imported `platform=other` facts keeps `live_api_health_claim_allowed = false` and describes the data as imported historical ads facts.
- Verify a real live API context only allows live API health claims when source readiness is production-ready or production validation is possible with API raw rows.

## Next Action — After Normalized AI Ads Context Guidance

- Deploy the new `normalize_ai_ads_context_guidance` Supabase migration and verify `build_ai_ads_context` returns `ads_context_status`, top-level `multi_account_readiness`, and top-level `binding_gaps` while preserving nested `pipeline_diagnostics`.
- Run an AI Assistant ads prompt against a workspace with imported historical ads facts and confirm the answer mentions available period, source layer, freshness/last-7-days eligibility, source readiness, and binding gaps before analysis.
- Continue to preserve the existing diagnostics contract; future improvements should be additive and should not change frontend routes/sidebar or the existing request payload shape unless explicitly approved.

## Updated — 2026-07-09 AdsConnectors Diagnostics Compact Admin Overview

- Diagnostics normal view has been polished into a compact admin overview: Ads data context is a full-width metric summary, while Daily snapshots and Anomaly candidates use responsive two-column cards with three-row previews.
- Raw diagnostics remain in technical details only.
- Imported/`other` platform values are displayed with friendly labels in normal UI.
- Backend contracts were not changed; keep any future diagnostics work frontend-only unless explicitly approved.

## Updated — 2026-07-09 AdsConnectors Diagnostics UI Polish and Binding Terminology

1. Verify `/ads-connectors?tab=diagnostics` in desktop light mode and dark mode for Ukrainian and English to confirm cards/lists are readable and normal UI has no horizontal raw-table scroll.
2. Confirm raw diagnostics remain available only inside technical details and that admin-facing copy uses Bound / Partially bound / Needs binding terminology.
3. Keep backend contracts unchanged; this polish did not change Supabase schema, RLS, RPC contracts, Edge Functions, OAuth, sync behavior, routes, sidebar, backend values, data fetching, or write actions.

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


## Updated — 2026-07-09 AI Ads Context Backend Audit

1. Next backend PR should add an additive normalized `ads_context_status` / answer-guidance layer to `public.build_ai_ads_context` so AI answers reliably mention available period, freshness, imported/fallback status, source readiness, binding gaps, and live API health limitations before campaign analysis.
2. Copy `pipeline_diagnostics.multi_account_readiness` and compact binding gaps to top-level AI ads context for discoverability; keep existing nested diagnostics and RPC signatures backward-compatible.
3. Tighten `supabase/functions/ai-helper-run/index.ts` ads prompt so it does not say “no data” when historical imported/fallback data exists, does not confuse real/discovered accounts with bound accounts, explains `platform=other` imported facts, and avoids claiming live API health without fresh validated API/raw/fact data.
4. Use `docs/ai-context/AI_ADS_CONTEXT_AUDIT.md` as the implementation checklist and prompt regression pack for the next PR.
---

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
