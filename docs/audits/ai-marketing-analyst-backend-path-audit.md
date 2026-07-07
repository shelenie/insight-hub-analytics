# AI Marketing Analyst backend path audit

Date: 2026-07-07  
Scope: read-only repo/backend audit for AI Assistant ads performance readiness.  
Workspace observation supplied for audit: `5ebbe435-fd79-44c3-834e-642e8fba00dc` has `ad_platform_connections = 3`, `ad_accounts = 4`, `ad_account_bindings = 6`, `source_entity_bindings = 1`, `mapping_review_queue = 0`, `facts_ads_daily = 0`, `v_ai_ads_daily_context = 0`, `v_ai_ads_anomaly_candidates = 0`, and `ai_helper_requests = 12`.

## Audit summary

The repository has a strong skeleton for an AI Marketing Analyst, but the current local source does not prove an end-to-end real ads performance data path into the AI context. The Edge Functions can discover/sync real ad platform accounts and call raw-insight insertion RPCs, and the scheduler calls `rebuild_ads_daily_facts` after platform sync. The AI helper then delegates ads context construction to `build_ai_ads_context` for `ads_performance`, `ads_anomalies`, and `ads_health` scopes.

The blocking gap is between raw platform sync and AI-ready facts/views:

```text
Meta / Google / TikTok APIs
→ platform sync Edge Functions
→ raw insights insertion RPCs
→ rebuild_ads_daily_facts
→ facts_ads_daily
→ v_ai_ads_daily_context / v_ai_ads_summary_context / v_ai_ads_anomaly_candidates
→ build_ai_ads_context
→ ai-helper-run response
```

For the supplied workspace, the upstream connector/binding counts show setup exists, but `facts_ads_daily = 0`, so every downstream AI ads view is empty. In that state, the assistant can report health/readiness, but it cannot answer performance questions such as “what dropped,” “why CPL increased,” or “which campaigns need attention” from real metrics.

## Existing reusable foundations

### Platform sync functions

- `meta-ads-sync` has backend access checks, active Meta connection lookup, OAuth secret retrieval, account upsert, account-level sync logs, Meta Insights fetching, normalization, and raw insight batch insertion through `insert_meta_ad_raw_insights_batch`.
- `google-ads-sync` has backend access checks, active Google Ads connection lookup, OAuth secret retrieval, customer account upsert, Google Ads API query execution, normalization, and raw insight batch insertion through `insert_google_ads_raw_insights_batch`.
- `tiktok-ads-sync` has backend access checks, active TikTok connection lookup, token retrieval, advertiser/account handling, chunked integrated report fetching, normalization, and raw insight batch insertion through `insert_tiktok_ads_raw_insights_batch`.
- Each platform function has explicit mock and dry-run modes. Mock modes insert test-looking records and return `real_*_api_called: false`; dry-run modes intentionally avoid metrics sync.

### Scheduled sync orchestration

- `ads-scheduled-sync-run` maps platform names to the platform sync Edge Functions.
- It reads due sync rules from `v_ads_scheduled_sync_due`, invokes the matching sync function, then calls `rebuild_ads_daily_facts` unless the rule disables fact rebuilding.
- It can create ads health snapshots through `create_ads_health_snapshot` and mark rule outcomes through `mark_ads_scheduled_sync_result`.

### Ads fact and AI context contracts

- `facts_ads_daily` is the expected canonical daily fact layer for AI and dashboard-ready ads metrics.
- `rebuild_ads_daily_facts` is the expected backend consolidation function after raw platform sync.
- `v_ai_ads_daily_context`, `v_ai_ads_summary_context`, and `v_ai_ads_anomaly_candidates` are the expected read views for AI-ready daily context, summaries, and anomaly candidates.
- `ai-helper-run` maps ads request types to `ads_performance`, `ads_anomalies`, and `ads_health`; those scopes call `build_ai_ads_context` instead of reading the views directly in Edge Function code.

### Frontend assistant foundation

- The AI Assistant already invokes `ai-helper-run` with `workspace_id`, `request_type`, `context_scope`, and `prompt`.
- Existing visible analysis modes already include ads performance, drops/anomalies, data quality, imports, mapping, alerts, clients/funnels, ads connection health, and system readiness.

## Why AI lacks marketing metrics now

For workspace `5ebbe435-fd79-44c3-834e-642e8fba00dc`, the supplied counts show setup without fact data:

| Layer | Observed count | Meaning |
| --- | ---: | --- |
| `ad_platform_connections` | 3 | There are platform connection records. |
| `ad_accounts` | 4 | Ad accounts exist/discovered. |
| `ad_account_bindings` | 6 | Accounts have workspace/client/project/funnel bindings or binding history. |
| `source_entity_bindings` | 1 | At least one non-ad source binding exists. |
| `mapping_review_queue` | 0 | No current mapping review blockers are visible in that queue. |
| `facts_ads_daily` | 0 | No canonical ads performance facts are available. |
| `v_ai_ads_daily_context` | 0 | No daily ads context can be supplied to AI. |
| `v_ai_ads_anomaly_candidates` | 0 | No anomaly candidates can be supplied to AI. |
| `ai_helper_requests` | 12 | The assistant has been used, but requests cannot create missing fact data. |

Likely causes to verify in Supabase, in priority order:

1. Real platform syncs may not have inserted raw insight rows for the date range, even if account discovery succeeded.
2. Syncs may have run only in mock or dry-run mode, which is not sufficient for real performance answers.
3. Raw insight RPCs may be present remotely but not represented by local migrations, so the local repo does not document the raw table schema or insertion behavior.
4. `rebuild_ads_daily_facts` may not have been run after real raw rows were inserted, may have failed, or may not include all platform raw tables.
5. `rebuild_ads_daily_facts` may require valid ad-account bindings at the right grain/date but currently cannot map raw rows into client/project/funnel context.
6. The AI views may depend on `facts_ads_daily`; with zero facts, they correctly return zero rows.
7. `build_ai_ads_context` may return empty context for ads scopes without adding enough diagnostic explanation about missing raw rows versus missing facts versus missing bindings.

## Mock-only vs real API-ready

### Mock-only / test paths

- Platform sync functions contain mock flows that create test connections/accounts/raw rows with `created_by_edge_test` metadata and report that real platform APIs were not called.
- `ads-scheduled-sync-run` has a mock path that creates a test scheduled rule, calls `rebuild_ads_daily_facts`, creates a health snapshot, and marks a result.
- These paths are useful for smoke tests but must not be treated as client performance data.

### Real API-ready paths

- Meta, Google Ads, and TikTok functions include real OAuth/API paths and real raw batch insertion RPC calls.
- The scheduler is ready to orchestrate real syncs from due rules and trigger fact rebuilds afterward.
- The AI helper is ready to call a backend context builder for ads scopes.

### Not proven locally

The local migration set does not define these critical backend objects:

- raw/staging ads insight tables
- `insert_meta_ad_raw_insights_batch`
- `insert_google_ads_raw_insights_batch`
- `insert_tiktok_ads_raw_insights_batch`
- `facts_ads_daily`
- `rebuild_ads_daily_facts`
- `v_ai_ads_daily_context`
- `v_ai_ads_summary_context`
- `v_ai_ads_anomaly_candidates`
- `build_ai_ads_context`

These may exist in the remote Supabase project, but the repository currently does not provide enough DDL to review their formulas, RLS/security mode, indexing, or failure behavior.

## Required backend fixes

No production code or migrations were implemented in this audit. Recommended backend work:

1. **Commit source-of-truth DDL for ads analytics objects.** Add versioned migrations or documented introspection snapshots for raw insight tables, `facts_ads_daily`, AI context views, `rebuild_ads_daily_facts`, and `build_ai_ads_context`.
2. **Add raw-to-fact diagnostics.** Create a safe admin/debug view or RPC that reports, per workspace/platform/date range: active connections, discovered accounts, bound accounts, raw insight rows, last successful sync run, fact rows, AI context rows, and the first failing stage.
3. **Harden `rebuild_ads_daily_facts` observability.** Return inserted/updated/deleted/skipped counts by platform, missing-binding counts, invalid-date counts, and row-level rejection summaries without exposing raw secrets.
4. **Define metric formulas.** Document formulas for spend, impressions, clicks, leads/conversions, CPL, CPC, CPM, CTR, conversion rate, revenue if available, ROAS if available, and exact date/timezone logic.
5. **Separate account discovery from metrics readiness.** A workspace with connected accounts should show “connected but no performance facts yet,” not imply that AI marketing analysis is ready.
6. **Make AI context empty-state explicit.** `build_ai_ads_context` should return structured diagnostics when fact/context rows are zero, including whether raw rows exist and whether a rebuild was attempted.
7. **Add backend tests for the data path.** Use controlled fixture raw rows for each platform to verify `rebuild_ads_daily_facts` populates facts and AI views as expected.

## Proposed AI Marketing Analyst context architecture

### Context builder input

`build_ai_ads_context` should support:

- `p_workspace_id`
- `p_context_scope`: `ads_performance`, `ads_anomalies`, `ads_health`
- `p_date_from`, `p_date_to`
- optional `p_platform`
- optional grain filters later: client, project, funnel, ad account, campaign

### Context payload shape

Recommended high-level JSON returned to `ai-helper-run`:

```json
{
  "readiness": {
    "has_active_connections": true,
    "has_bound_accounts": true,
    "has_raw_rows": true,
    "has_fact_rows": true,
    "has_ai_context_rows": true,
    "blocking_stage": null
  },
  "date_range": { "from": "YYYY-MM-DD", "to": "YYYY-MM-DD", "timezone": "..." },
  "metric_definitions": { "cpl": "spend / leads", "ctr": "clicks / impressions" },
  "summary": { "spend": 0, "clicks": 0, "leads": 0, "cpl": null },
  "comparisons": {
    "current_period": {},
    "previous_period": {},
    "deltas": {}
  },
  "entities_needing_attention": [],
  "anomaly_candidates": [],
  "data_quality_notes": [],
  "client_ready_takeaways": []
}
```

### Required context for target questions

#### “What dropped in the last 7 days?”

Needed backend context:

- Current 7-day metrics by campaign/ad account/project/funnel.
- Previous comparable 7-day period.
- Absolute and percentage deltas for spend, impressions, clicks, leads, CPL, CTR, conversion rate.
- Minimum-volume thresholds so tiny noisy campaigns are not over-explained.
- Data quality flags for missing days, partial sync, disconnected accounts, or delayed platform reporting.

#### “Why did CPL increase?”

Needed backend context:

- CPL decomposition: spend change versus lead/conversion change.
- Funnel/project/campaign contribution to CPL delta.
- Click and conversion-rate movement to distinguish traffic cost issues from landing/funnel issues.
- Platform/account sync completeness for both comparison periods.
- Mapping/binding confidence so AI does not attribute unbound rows to a client/project incorrectly.

#### “Which campaigns need attention?”

Needed backend context:

- Campaign-level ranked candidates from `facts_ads_daily` or a campaign fact view.
- Rules for severity: high spend with zero leads, CPL above threshold, sharp click/lead drop, spend spike, tracking gap, stale sync, unmapped account/campaign.
- Client/project/funnel labels from bindings.
- Suggested owner action category: check tracking, budget, creative fatigue, landing page, mapping/sync issue.

#### “What should we tell the client?”

Needed backend context:

- Client-ready summary with verified facts only.
- Period-over-period performance deltas.
- Known limitations and data quality caveats.
- Recommended next actions with confidence level.
- Explicit “not enough data” response when facts are missing.

## Recommended next PRs

1. **Backend introspection/documentation PR.** Add DDL snapshots or migrations for the missing ads fact/context functions and views, plus metric definitions. No behavior changes.
2. **Ads data path diagnostics PR.** Add safe diagnostic view/RPC for connection → account → raw → fact → AI-context readiness by workspace/date/platform.
3. **Fact rebuild observability PR.** Improve `rebuild_ads_daily_facts` return payload and audit logs so failed or zero-row rebuilds are explainable.
4. **AI empty-context diagnostics PR.** Update `build_ai_ads_context` to return structured missing-data diagnostics while preserving the `ai-helper-run` Edge Function contract.
5. **Fixture-based backend validation PR.** Add tests proving raw rows from Meta/Google/TikTok rebuild into `facts_ads_daily` and populate AI views.
6. **Marketing Analyst prompt/context PR.** After facts are verified, enrich AI context with comparisons, anomaly candidates, metric definitions, confidence, limitations, and client-ready takeaways.

## Risks / notes

- Do not change RLS, Edge Function contracts, production sync behavior, or migrations until the missing backend DDL is reviewed and approved.
- Do not present connector counts as ads performance readiness. Connected accounts are necessary but not sufficient.
- Do not use mock rows for client-facing AI marketing answers.
- The supplied workspace observations strongly indicate a fact-population blocker, but the exact failing stage requires remote Supabase verification of raw insight tables, sync logs, `rebuild_ads_daily_facts`, and AI context builder output.
- Current repo state cannot fully audit remote-only database objects because their definitions are absent from local migrations.
