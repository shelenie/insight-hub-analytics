# AI Ads Context Backend Audit

Date: 2026-07-09  
Scope: read-only backend audit + documentation plan. No application behavior, Supabase schema, migrations, RLS, Edge Functions, frontend pages, AdsConnectors, Bindings, routes, or UI components were changed.

## Files audited

- `supabase/functions/ai-helper-run/index.ts`
- `supabase/migrations/20260707_z_extend_ai_ads_context_with_diagnostics.sql`
- `supabase/migrations/20260707_y_add_ads_pipeline_diagnostics.sql`
- `supabase/migrations/20260707_ab_add_ads_multi_account_readiness.sql`
- `supabase/migrations/20260707_aa_rebuild_imported_ads_facts.sql`
- `supabase/migrations/20260707_fix_ai_ads_context_fallback.sql`
- `supabase/migrations/20260521_add_unified_reporting_views.sql`

## Executive summary

The current ads AI backend path is already safer than a simple campaign summary because `ai-helper-run` routes ads requests to `build_ai_ads_context`, and the SQL context includes freshness, source layer, fallback/imported notes, pipeline diagnostics, source readiness, blocker codes, and nested multi-account readiness. This gives the model enough raw signals to avoid many bad answers.

The main remaining risk is normalization and prompt enforcement. Important operational facts are present, but they are scattered across `data_freshness`, `notes`, `pipeline_diagnostics`, `source_readiness`, `first_blocker_*`, and `pipeline_diagnostics.multi_account_readiness`. The Edge Function prompt tells the model to mention stale/fallback data, but it does not explicitly require it to inspect binding gaps, source readiness, test/no-spend accounts, unbound real accounts, `platform=other` imported facts, or live API health limitations before answering ads questions.

The next PR should not start with UI changes. It should make the backend context more assistant-proof by adding one normalized `answer_guidance` / `ads_context_status` object to `build_ai_ads_context` and tightening the ads prompt in `ai-helper-run` so every answer begins from data availability, freshness, imported/fallback status, binding readiness, and source readiness before performance interpretation.

## 1. Current AI context path

### Request routing

`ai-helper-run` treats `ads_performance`, `ads_anomalies`, and `ads_health` as ads contexts. For these scopes, it calls `build_ai_ads_context` with the request workspace, date range, and optional platform filter.

Current ads request inputs passed to SQL:

- `workspace_id` → required request body field.
- `date_from` → nullable body field, passed as `p_date_from`.
- `date_to` → nullable body field, passed as `p_date_to`.
- `platform` → nullable body field, passed as `p_platform`.
- `context_scope` is not passed into SQL; it only controls routing.

The Edge Function stores the same `date_from`, `date_to`, and `platform` in `ai_helper_requests.input_payload`, and after the OpenAI response it stores the full SQL context in `ai_helper_requests.ai_result.context_used`.

### Context object returned by `build_ai_ads_context`

The SQL returns a JSON object with these top-level fields for ads questions:

- `context_type = ads_context`
- `workspace_id`
- `date_from`
- `date_to`
- `platform_filter`
- `generated_at`
- `source_layer_used`
- `data_freshness`
- `health`
- `pipeline_diagnostics`
- `source_readiness`
- `first_blocker_code`
- `first_blocker_message`
- `platform_blockers`
- `summary_by_platform`
- `summary`
- `top_campaigns_by_spend`
- `anomaly_candidates`
- `notes`

### Date range

`build_ai_ads_context` applies the requested date range to facts and daily/top-campaign context queries:

- Facts are counted from `facts_ads_daily.insight_date`.
- Unified fallback rows are counted from `v_unified_ads_performance_daily.metric_date`.
- Daily/top-campaign facts use `insight_date` when facts are selected.
- Daily/top-campaign fallback uses `metric_date` when fallback is selected.
- `build_ads_pipeline_diagnostics` also receives the same `p_date_from` and `p_date_to`.

Current caveat: `summary_by_platform` / `summary` reads from summary views with only `workspace_id` and no date/platform filter in the current SQL. This can make summary rows broader than the requested period/platform even when `top_campaigns_by_spend`, freshness, and diagnostics are date-aware.

### Platform filter

`p_platform` is used only in the `facts_ads_daily` path and facts/date-source queries via a dynamic `and platform = $4` clause. It is returned as `platform_filter`.

Current caveats:

- The unified imported fallback row count does not apply `p_platform` because `v_unified_ads_performance_daily` has no platform column.
- Top campaigns do not apply `p_platform` in the current dynamic SQL even when the facts source is selected.
- Pipeline diagnostics do not receive a platform parameter and therefore diagnose all platforms in the workspace/date range.
- Imported facts may be stored as `platform = other`, so user questions for Google/Meta/TikTok can miss historical imported facts if they filter by a live platform code.

### Source layer used

The SQL chooses the source layer like this:

1. If `facts_ads_daily` has rows for the workspace/date range/platform filter, `source_layer_used = facts_ads_daily`.
2. Otherwise it falls back to `source_layer_used = v_unified_ads_performance_daily` and adds a note: facts context is empty, unified imported ads performance is used as fallback.

After the imported facts backfill, historical imported rows can also be available from `facts_ads_daily` with `platform = other`, so `source_layer_used = facts_ads_daily` does not necessarily mean live API facts. The source needs a separate imported/live classification.

### Data freshness

`data_freshness` includes:

- `first_available_date`
- `last_available_date`
- `latest_ads_sync_at`
- `fact_ads_rows`
- `unified_ads_rows`
- `is_fresh`
- `warning`

Freshness is calculated from the latest available metric date and is fresh only when `last_available_date >= current_date - 7`. If stale, the warning says the AI can analyze only historical/imported data and cannot analyze current last-7-days drops until fresh sync/import data is available.

Current caveat: freshness only communicates the latest metric date. It does not separately classify `fresh_imported_file`, `fresh_api_fact`, `historical_imported_fact`, or `live_platform_fact`.

### Facts rows and daily facts

Facts are counted in `data_freshness.fact_ads_rows`. Pipeline diagnostics also returns `fact_context_state.facts_ads_daily_by_platform`, with rows and first/last fact dates grouped by platform.

Top campaign analysis is built from the selected daily source and returns up to 10 campaigns ordered by spend with:

- `campaign_name`
- `first_date`
- `last_date`
- `spend`
- `clicks`
- `leads`
- `cpl`

### Imported fallback and `platform = other`

There are two imported-data paths:

1. Fallback path: if facts are empty, `build_ai_ads_context` uses `v_unified_ads_performance_daily`, which is sourced from `ad_traffic_raw` and exposes campaign/day performance without a platform column.
2. Imported facts path: `rebuild_imported_ads_facts` aggregates the unified imported source into `facts_ads_daily` with `platform = other`, campaign-level fact keys, spend/clicks/leads/impressions, and warnings that imported reach was mapped to impressions and imported historical rows are stored as `other`.

This means the assistant can see imported history, but it may not infer that `platform = other` represents imported historical ads rather than a real live platform.

### Diagnostics

`pipeline_diagnostics` includes:

- `connection_account_state`
  - active platform connections by platform
  - ad accounts by platform
  - active bound ad accounts by platform
  - binding counts
- `raw_data_state`
  - raw insights by platform
  - `ad_traffic_raw` rows/date range/date column
- `fact_context_state`
  - `facts_ads_daily` rows by platform
  - AI daily context rows/date range
  - anomaly context rows/date range
- `sync_state`
  - latest sync runs by platform
  - latest successful runs
  - latest failed runs with redacted error messages
- `source_readiness`
- `multi_account_readiness`
- `blocker_diagnosis`
- top-level `first_blocker_code`, `first_blocker_message`, `platform_blockers`

### Source readiness

`source_readiness` is copied to the top-level ads context from diagnostics. It currently normalizes source state into:

- `overall_status`
- `has_connections`
- `has_accounts`
- `has_bindings`
- `has_api_raw_rows`
- `has_imported_fallback_rows`
- `has_facts_rows`
- `has_fresh_data`
- `likely_test_or_empty_accounts`
- `production_validation_possible`
- `message`
- `next_action`

Known statuses include:

- `not_connected`
- `needs_real_ad_account`
- `connected_no_production_data`
- `connected_with_imported_fallback`
- `platform_permission_or_access_blocked`
- `production_data_ready`

### Multi-account readiness and binding gaps

`multi_account_readiness` is nested under `pipeline_diagnostics`. It returns:

- `overall_status`
- summary counts for connections, accounts, active accounts, bound accounts, unbound accounts, platforms, multi-account state, production-ready account count, and needs-attention count
- per-platform readiness rows
- per-account readiness rows
- `binding_gaps`

Binding gap types include:

- `active_account_without_binding`
- `account_primary_binding_conflict`
- `binding_without_client_project_funnel`
- `inactive_account_with_active_binding`
- `platform_connection_without_accounts`

Current caveat: `multi_account_readiness` is not copied to a top-level field in `build_ai_ads_context`; the model has to find it under `pipeline_diagnostics.multi_account_readiness`.

### Stale data warnings

Stale warnings are present in two places:

- `data_freshness.warning`
- `notes`, with the warning that current last-7-days analysis is not possible unless fresh API facts or imported ads data are available

Diagnostics can also return `first_blocker_code = stale_ads_data` when all earlier blockers are clear but latest data is older than seven days.

## 2. Reasoning gaps where the AI may still answer incorrectly

### Saying “no data” when historical imported data exists

Risk: medium/high. The context can contain stale imported facts or fallback rows, but the model may focus on freshness or live platform blockers and say there is no data. This is especially likely when a user asks about fresh data and the available period is historical.

Needed improvement: add a normalized `available_analysis_window` and `data_availability_status` with explicit values such as `historical_imported_available`, `fresh_facts_available`, `fallback_only_available`, and `no_ads_data_available`.

### Not explaining stale data

Risk: medium. The system prompt and response constraints already say stale data must be mentioned, but stale state is not transformed into required answer text or a hard section checklist.

Needed improvement: include normalized `must_mention` flags and prompt instructions that require the assistant to state `last_available_date`, whether last-7-days analysis is possible, and what data can still be analyzed.

### Not explaining unbound accounts

Risk: high. Binding gaps are present only inside nested diagnostics. Unless the model explores deeply, it may discuss performance without telling the admin that discovered real accounts are not bound to client/project/funnel scopes.

Needed improvement: copy `multi_account_readiness` to a top-level ads context field and add a compact `binding_status_summary` with unbound account count and top gaps.

### Not explaining test/no-spend accounts

Risk: medium/high. `source_readiness.likely_test_or_empty_accounts` exists, and `connected_no_production_data` explains test/empty accounts, but the prompt does not explicitly require the model to explain this distinction.

Needed improvement: add prompt rules for `likely_test_or_empty_accounts` and `connected_no_production_data`: never frame zero rows as a production sync failure until a real account with spend/leads is validated.

### Not explaining `platform=other` / imported data

Risk: high. Imported historical facts are intentionally stored as `platform = other`, but neither the top-level ads context nor prompt says `other` means imported historical data in this project. The model may treat `other` as a platform or ignore it when answering platform-specific questions.

Needed improvement: add `imported_data_explanation` / `platform_semantics` to `build_ai_ads_context`, including that `platform=other` can represent imported historical ads facts created from `v_unified_ads_performance_daily`.

### Confusing “real account” with “bound account”

Risk: high. Recent frontend work intentionally distinguishes discovered real platform accounts from bound accounts. The backend contains account and binding counts, but the prompt does not teach this distinction.

Needed improvement: add normalized fields and prompt wording: a real account means a discovered platform account; a bound account means an account mapped to a client/project/funnel scope. Do not equate discovered account presence with analytics readiness.

### Ignoring source readiness / diagnostics

Risk: high. The current marketing prompt emphasizes performance diagnosis. It mentions data status but not source readiness, diagnostics, blocker diagnosis, or multi-account readiness as mandatory before analysis.

Needed improvement: update `buildSystemPrompt` and `buildUserPrompt` constraints so ads answers must inspect `source_readiness`, `first_blocker_code`, `pipeline_diagnostics`, and `multi_account_readiness` before performance conclusions.

### Overclaiming live API health

Risk: medium/high. `source_layer_used = facts_ads_daily` can include imported facts with `platform = other`, and sync logs can contain successful zero-row syncs. The assistant may infer that live APIs are healthy because facts exist or because a sync succeeded.

Needed improvement: add normalized `live_api_health_claim_allowed = false` unless fresh API/raw rows are present and source readiness says `production_data_ready`. Prompt should say a successful zero-row sync is not proof of production data health.

## 3. Concrete backend / prompt improvement plan for the next PR

### Goal

Make ads answers robust even when the model does not deeply inspect nested JSON. The backend context should provide an explicit operational interpretation layer, and the prompt should require the assistant to use it before campaign analysis.

### Files to change

1. `supabase/migrations/<new_timestamp>_normalize_ai_ads_context_guidance.sql`
   - Create or replace `public.build_ai_ads_context` with the same signature.
   - Add normalized top-level fields only; do not remove existing fields.
   - Keep change additive and reversible.
2. `supabase/functions/ai-helper-run/index.ts`
   - Tighten ads-specific system prompt and response constraints.
   - No request/response contract change required.
3. Tests, if existing project test patterns support them:
   - Add or update SQL/Edge Function fixture tests if a Supabase SQL test harness exists.
   - Otherwise add targeted documentation/manual test cases in the PR and run frontend static checks.
4. Context docs:
   - Update `docs/ai-context/PROJECT_STATE.md`, `docs/ai-context/NEXT_ACTIONS.md`, and `docs/ai-context/CHANGELOG.md` after implementation.

### Additive `build_ai_ads_context` fields to add

Recommended top-level additions:

```json
{
  "ads_context_status": {
    "data_availability_status": "fresh_facts_available | historical_imported_available | fallback_only_available | connected_no_production_data | no_ads_data_available",
    "analysis_window": {
      "first_available_date": "date|null",
      "last_available_date": "date|null",
      "can_analyze_available_period": true,
      "can_analyze_last_7_days": false
    },
    "source_interpretation": {
      "source_layer_used": "facts_ads_daily | v_unified_ads_performance_daily",
      "uses_imported_data": true,
      "uses_live_api_data": false,
      "platform_other_means_imported_history": true,
      "live_api_health_claim_allowed": false
    },
    "readiness_interpretation": {
      "source_readiness_status": "connected_with_imported_fallback",
      "production_validation_possible": false,
      "likely_test_or_empty_accounts": true,
      "first_blocker_code": "ready_with_fallback_only"
    },
    "binding_interpretation": {
      "real_accounts_count": 0,
      "bound_accounts_count": 0,
      "unbound_accounts_count": 0,
      "needs_attention_count": 0,
      "has_binding_gaps": false,
      "top_binding_gaps": []
    },
    "must_mention": [
      "available_period",
      "stale_data",
      "imported_or_fallback_data",
      "binding_gaps",
      "source_readiness",
      "no_live_api_health_claim"
    ]
  },
  "multi_account_readiness": {},
  "binding_gaps": [],
  "test_prompt_expectations": {}
}
```

Notes:

- Copy `pipeline_diagnostics.multi_account_readiness` to top-level `multi_account_readiness` for discoverability.
- Copy `multi_account_readiness.binding_gaps` to top-level `binding_gaps` or include a compact top-level summary.
- Do not remove the existing nested diagnostics shape, because AdsConnectors and Bindings may already rely on the current RPC contract.
- Avoid changing RLS, table schema, facts rebuild logic, or Edge Function request payload in this PR.

### Prompt changes needed in `ai-helper-run`

Yes, the Edge Function prompt should change. Recommended additions:

- Before campaign analysis, always summarize:
  1. available date period,
  2. source layer and whether it is imported/fallback/live API,
  3. freshness / last-7-days eligibility,
  4. source readiness status,
  5. binding gaps / unbound discovered accounts.
- Treat `platform=other` as imported historical ads facts when context says so.
- Do not say “no data” when `fact_ads_rows > 0`, `unified_ads_rows > 0`, `top_campaigns_by_spend` is non-empty, or `summary` is non-empty; say “no fresh/live data” or “only historical imported data” instead.
- Do not equate real/discovered accounts with bound accounts.
- Do not claim live API health unless context explicitly says production validation is possible and fresh API/raw/facts data are available.
- If `source_readiness.overall_status` is `connected_no_production_data`, explain test/no-spend account possibility before recommending sync-code fixes.
- If binding gaps exist, name the next admin action: bind each active ad account to the correct client/project/funnel in Bindings.

### Tests to update or add

Minimum checks for the next PR:

1. Static checks:
   - `npm run typecheck`
   - `npm run lint`
   - `npm test` or the repo-supported test command
2. SQL manual verification against staging/production-like data:
   - Call `public.build_ai_ads_context(workspace_id, null, null, null)`.
   - Call it for the historical imported range, expected 2026-04-01 through 2026-05-05 in current project context.
   - Call it for a last-7-days range.
   - Call it with `p_platform = 'other'`.
   - Call it with a live platform code such as `tiktok_ads` when an unbound/empty real account exists.
3. Edge Function manual verification:
   - Invoke `ai-helper-run` with `context_scope = ads_performance` and the prompt pack below.
   - Inspect `ai_helper_requests.ai_result.context_used` to confirm normalized guidance fields are stored.
   - Confirm answers do not say “no data” when historical imported facts or fallback rows exist.

### How to test with existing data

Use the current known workspace from project context if available in staging: `5ebbe435-fd79-44c3-834e-642e8fba00dc`.

Recommended SQL calls:

```sql
select public.build_ai_ads_context(
  '5ebbe435-fd79-44c3-834e-642e8fba00dc'::uuid,
  '2026-04-01'::date,
  '2026-05-05'::date,
  null
);

select public.build_ai_ads_context(
  '5ebbe435-fd79-44c3-834e-642e8fba00dc'::uuid,
  current_date - 7,
  current_date,
  null
);

select public.build_ai_ads_context(
  '5ebbe435-fd79-44c3-834e-642e8fba00dc'::uuid,
  null,
  null,
  'other'
);

select public.build_ads_pipeline_diagnostics(
  '5ebbe435-fd79-44c3-834e-642e8fba00dc'::uuid,
  null,
  null
);

select public.build_ads_multi_account_readiness(
  '5ebbe435-fd79-44c3-834e-642e8fba00dc'::uuid
);
```

Expected answer behavior:

- For the historical imported range, AI should analyze campaigns for the available period and clearly say the data is historical/imported.
- For last-7-days, AI should say current fresh analysis is not possible if no fresh facts exist, while still acknowledging historical data if present elsewhere in the context.
- For `platform = other`, AI should explain that `other` represents imported historical ads facts, not a live ad network.
- For TikTok/unbound account prompts, AI should distinguish a discovered real account from a bound analytics-ready account.

## 4. AI Assistant test prompt pack

Use these prompts through `ai-helper-run` with `context_scope = ads_performance` or `ads_health`, depending on the UX mode being tested.

### Ukrainian prompts requested for acceptance

1. `Чому немає свіжих рекламних даних?`
   - Expected: mention `last_available_date`, freshness warning, source readiness, and whether only historical/imported data is available.
2. `Які рекламні акаунти треба привʼязати?`
   - Expected: mention unbound active accounts/binding gaps from multi-account readiness; do not confuse real/discovered accounts with bound accounts.
3. `Проаналізуй кампанії за доступний період.`
   - Expected: analyze the available historical period instead of saying no data; mention imported/fallback/stale status before performance diagnosis.
4. `Чому TikTok не готовий для аналізу?`
   - Expected: explain source readiness, lack of fresh rows/facts if applicable, binding status if applicable, and avoid overclaiming API code failure without proof.
5. `Що сказати клієнту про стан рекламних даних?`
   - Expected: client-safe summary separating known historical/imported performance from current freshness/source-readiness limitations.
6. `Які наступні дії для адміна?`
   - Expected: prioritized admin checklist: bind unbound accounts, validate real production account access, refresh/import current data, then re-run context.

### Additional regression prompts

7. `Чи є дані за останні 7 днів і чи можна робити висновки по падінню реклами?`
   - Expected: no last-7-days conclusions when `is_fresh = false`.
8. `Чи означає platform=other, що це окрема рекламна платформа?`
   - Expected: explain imported historical ads facts semantics when context supports it.
9. `Чи працює live API синхронізація Google/Meta/TikTok?`
   - Expected: do not claim live API health unless source readiness and fresh API/raw/fact rows prove it; mention permission/zero-row/test account states.
10. `Які кампанії мають найбільший ризик марного бюджету?`
    - Expected: only answer from available spend/leads/CPL rows; mark hypotheses and missing revenue/margin limits.

## Proposed next PR checklist

- [ ] Add normalized top-level ads context guidance to `build_ai_ads_context` in a new additive migration.
- [ ] Copy `multi_account_readiness` and compact `binding_gaps` to top-level ads context.
- [ ] Add imported/platform semantics for `platform=other` and fallback source.
- [ ] Add `live_api_health_claim_allowed` and last-7-days eligibility flags.
- [ ] Tighten `ai-helper-run` ads prompt and response constraints.
- [ ] Verify with historical imported range, last-7-days range, `platform=other`, and TikTok/unbound account prompts.
- [ ] Update project context files after implementation.
