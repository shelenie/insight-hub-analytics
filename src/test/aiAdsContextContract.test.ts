import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const edgeFunctionSource = readFileSync("supabase/functions/ai-helper-run/index.ts", "utf8");
const migrationSource = readFileSync("supabase/migrations/20260707_fix_ai_ads_context_fallback.sql", "utf8");

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
});
