import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const edgeFunctionSource = readFileSync("supabase/functions/ai-helper-run/index.ts", "utf8");
const migrationSource = readFileSync("supabase/migrations/20260707_fix_ai_ads_context_fallback.sql", "utf8");
const diagnosticsMigrationSource = readFileSync("supabase/migrations/20260707_y_add_ads_pipeline_diagnostics.sql", "utf8");
const diagnosticsAiContextMigrationSource = readFileSync("supabase/migrations/20260707_z_extend_ai_ads_context_with_diagnostics.sql", "utf8");

describe("AI ads context backend contract", () => {
  it("calls build_ai_ads_context without unsupported p_context_scope", () => {
    const buildAdsContextBody = edgeFunctionSource.match(/async function buildAdsContext[\s\S]*?async function buildImportContext/)?.[0] ?? "";

    expect(buildAdsContextBody).toContain('rpc("build_ai_ads_context", payload)');
    expect(buildAdsContextBody).toContain("p_workspace_id: params.workspaceId");
    expect(buildAdsContextBody).toContain("p_date_from: params.dateFrom");
    expect(buildAdsContextBody).toContain("p_date_to: params.dateTo");
    expect(buildAdsContextBody).toContain("p_platform: params.platform");
    expect(buildAdsContextBody).not.toContain("p_context_scope");
  });

  it("keeps the frontend request scope mapped to ads context without visible Auto context changes", () => {
    expect(edgeFunctionSource).toContain("const contextScope = body.context_scope ?? defaultContextScope(requestType);");
    expect(edgeFunctionSource).toContain('ads_performance_summary: "ads_performance"');
    expect(edgeFunctionSource).toContain('ads_anomaly_explanation: "ads_anomalies"');
    expect(edgeFunctionSource).toContain('ads_health_summary: "ads_health"');
  });


  it("uses a senior performance marketing analyst system prompt with strict data boundaries", () => {
    const systemPromptBody = edgeFunctionSource.match(/function buildSystemPrompt\(\)[\s\S]*?function buildUserPrompt/)?.[0] ?? "";

    expect(systemPromptBody).toContain("senior performance marketing analyst");
    expect(systemPromptBody).toContain("CMO-level campaign diagnosis");
    expect(systemPromptBody).toContain("CFO-level budget and unit-economics discipline");
    expect(systemPromptBody).toContain("Use only the provided JSON context");
    expect(systemPromptBody).toContain("Never invent metrics, periods, campaign names, client names, revenue, ROAS, causes");
    expect(systemPromptBody).toContain("stale, missing, incomplete, fallback/imported");
    expect(systemPromptBody).toContain("fact_ads_rows/unified_ads_rows");
    expect(systemPromptBody).toContain("do not force ads/CPL sections when the context is not ads-related");
  });

  it("passes marketing analyst response requirements into the OpenAI user prompt", () => {
    const userPromptBody = edgeFunctionSource.match(/function buildUserPrompt[\s\S]*?function extractResponsesText/)?.[0] ?? "";

    expect(userPromptBody).toContain('role: "senior_performance_marketing_analyst"');
    expect(userPromptBody).toContain('"CMO campaign diagnosis"');
    expect(userPromptBody).toContain('"CFO budget efficiency"');
    expect(userPromptBody).toContain('"data quality/freshness"');
    expect(userPromptBody).toContain('"Стан даних"');
    expect(userPromptBody).toContain('"Що видно по рекламі"');
    expect(userPromptBody).toContain('"Що потребує уваги"');
    expect(userPromptBody).toContain('"Можливі причини"');
    expect(userPromptBody).toContain('"Що робити далі"');
    expect(userPromptBody).toContain('"Що сказати клієнту"');
    expect(userPromptBody).toContain("mention stale/fallback/imported data");
    expect(userPromptBody).toContain("do not claim last-7-days trends if data_freshness.is_fresh is false");
    expect(userPromptBody).toContain("do not invent revenue/ROAS if missing");
    expect(userPromptBody).toContain("do not invent client/funnel attribution if not in context");
  });

  it("keeps ai-helper-run request and response contract keys unchanged", () => {
    expect(edgeFunctionSource).toContain("body = await req.json();");
    expect(edgeFunctionSource).toContain("const workspaceId = body.workspace_id;");
    expect(edgeFunctionSource).toContain("const requestType = body.request_type ?? \"production_readiness_summary\";");
    expect(edgeFunctionSource).toContain("const contextScope = body.context_scope ?? defaultContextScope(requestType);");
    expect(edgeFunctionSource).toContain("const userPrompt =");
    expect(edgeFunctionSource).toContain("body.prompt ??");
    expect(edgeFunctionSource).toContain("body.question ??");
    expect(edgeFunctionSource).toContain("const dateFrom = body.date_from ?? null;");
    expect(edgeFunctionSource).toContain("const dateTo = body.date_to ?? null;");
    expect(edgeFunctionSource).toContain("const platform = body.platform ?? null;");
    expect(edgeFunctionSource).toContain("ok: true");
    expect(edgeFunctionSource).toContain("workspace_id: workspaceId");
    expect(edgeFunctionSource).toContain("request_type: requestType");
    expect(edgeFunctionSource).toContain("context_scope: contextScope");
    expect(edgeFunctionSource).toContain("date_from: dateFrom");
    expect(edgeFunctionSource).toContain("date_to: dateTo");
    expect(edgeFunctionSource).toContain("answer: aiResult.answer");
  });

  it("adds a unified ads fallback with freshness metadata", () => {
    expect(migrationSource).toContain("create or replace function public.build_ai_ads_context");
    expect(migrationSource).toContain("v_unified_ads_performance_daily");
    expect(migrationSource).toContain("v_unified_ads_performance_summary");
    expect(migrationSource).toContain("source_layer_used");
    expect(migrationSource).toContain("data_freshness");
    expect(migrationSource).toContain("fact_ads_rows");
    expect(migrationSource).toContain("unified_ads_rows");
    expect(migrationSource).toContain("is_fresh");
    expect(migrationSource).toContain("current_date - 7");
    expect(migrationSource).toContain("historical/imported data");
  });

  it("uses the correct date column for facts and unified ads sources", () => {
    const factsCountBlock = migrationSource.match(/from public\.facts_ads_daily[\s\S]*?using p_workspace_id, p_date_from, p_date_to, p_platform;/)?.[0] ?? "";
    const factsBranchBlock = migrationSource.match(/if v_fact_rows > 0 then[\s\S]*?else/)?.[0] ?? "";
    const unifiedCountBlock = migrationSource.match(/from public\.v_unified_ads_performance_daily[\s\S]*?using p_workspace_id, p_date_from, p_date_to;/)?.[0] ?? "";
    const topCampaignsBlock = migrationSource.match(/if v_daily_source is not null and v_daily_date_column is not null then[\s\S]*?end if;/)?.[0] ?? "";

    expect(factsCountBlock).toContain("insight_date");
    expect(factsCountBlock).not.toContain("metric_date");
    expect(factsBranchBlock).toContain("v_daily_date_column := 'insight_date'");
    expect(factsBranchBlock).toContain("min(insight_date), max(insight_date)");
    expect(unifiedCountBlock).toContain("metric_date");
    expect(topCampaignsBlock).toContain("v_daily_date_column");
    expect(topCampaignsBlock).toContain("min(%1$I) as first_date");
    expect(topCampaignsBlock).toContain("max(%1$I) as last_date");
  });

  it("adds a safe ads pipeline diagnostics RPC without exposing token or secret fields", () => {
    expect(diagnosticsMigrationSource).toContain("create or replace function public.build_ads_pipeline_diagnostics");
    expect(diagnosticsMigrationSource).toContain("returns jsonb");
    expect(diagnosticsMigrationSource).toContain("set search_path = public");
    expect(diagnosticsMigrationSource).toContain("grant execute on function public.build_ads_pipeline_diagnostics(uuid, date, date) to authenticated");
    expect(diagnosticsMigrationSource).toContain("active_platform_connections_by_platform");
    expect(diagnosticsMigrationSource).toContain("ad_accounts_by_platform");
    expect(diagnosticsMigrationSource).toContain("account_binding_counts");
    expect(diagnosticsMigrationSource).toContain("ad_raw_insights_by_platform");
    expect(diagnosticsMigrationSource).toContain("ad_traffic_raw");
    expect(diagnosticsMigrationSource).toContain("facts_ads_daily_by_platform");
    expect(diagnosticsMigrationSource).toContain("latest_ad_sync_run_logs_by_platform");
    expect(diagnosticsMigrationSource).toContain("regexp_replace");
    expect(diagnosticsMigrationSource).toContain("[redacted]");
    expect(diagnosticsMigrationSource).not.toMatch(/select \*/i);
    expect(diagnosticsMigrationSource).not.toContain("access_token,");
    expect(diagnosticsMigrationSource).not.toContain("refresh_token,");
    expect(diagnosticsMigrationSource).not.toContain("client_secret,");
    expect(diagnosticsMigrationSource).not.toContain("service_role_key");
  });

  it("includes explicit ads pipeline blocker codes", () => {
    for (const blockerCode of [
      "no_active_connections",
      "no_ad_accounts",
      "no_account_bindings",
      "no_raw_ads_rows",
      "raw_rows_exist_but_facts_empty",
      "ai_context_empty",
      "google_ads_permission_denied",
      "tiktok_date_range_too_large",
      "platform_success_zero_rows",
      "stale_ads_data",
      "ready_with_fallback_only",
      "ready",
    ]) {
      expect(diagnosticsMigrationSource).toContain(blockerCode);
    }
  });

  it("extends build_ai_ads_context with diagnostics while preserving its signature", () => {
    expect(diagnosticsAiContextMigrationSource).toContain("create or replace function public.build_ai_ads_context(\n  p_workspace_id uuid,\n  p_date_from date default null,\n  p_date_to date default null,\n  p_platform text default null\n)");
    expect(diagnosticsAiContextMigrationSource).not.toContain("p_context_scope");
    expect(diagnosticsAiContextMigrationSource).toContain("public.build_ads_pipeline_diagnostics(p_workspace_id, p_date_from, p_date_to)");
    expect(diagnosticsAiContextMigrationSource).toContain("'pipeline_diagnostics', v_pipeline_diagnostics");
    expect(diagnosticsAiContextMigrationSource).toContain("'first_blocker_code'");
    expect(diagnosticsAiContextMigrationSource).toContain("'first_blocker_message'");
    expect(diagnosticsAiContextMigrationSource).toContain("'platform_blockers'");
  });
});
