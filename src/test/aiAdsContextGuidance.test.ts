import { describe, expect, it } from "vitest";
import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";

const migrationSource = readFileSync(
  "supabase/migrations/20260709_normalize_ai_ads_context_guidance.sql",
  "utf8",
);
const edgeFunctionSource = readFileSync("supabase/functions/ai-helper-run/index.ts", "utf8");

describe("normalized AI ads context guidance", () => {
  it("adds ads_context_status while preserving existing diagnostics fields", () => {
    expect(migrationSource).toContain("create or replace function public.build_ai_ads_context");
    expect(migrationSource).toContain("'ads_context_status', v_ads_context_status");
    expect(migrationSource).toContain("'data_availability_status'");
    expect(migrationSource).toContain("'fresh_facts_available'");
    expect(migrationSource).toContain("'historical_imported_available'");
    expect(migrationSource).toContain("'fallback_only_available'");
    expect(migrationSource).toContain("'connected_no_production_data'");
    expect(migrationSource).toContain("'no_ads_data_available'");
    expect(migrationSource).toContain("'pipeline_diagnostics', v_pipeline_diagnostics");
    expect(migrationSource).toContain("public.build_ads_pipeline_diagnostics(p_workspace_id, p_date_from, p_date_to)");
  });

  it("promotes multi-account readiness and binding gaps for AI discoverability", () => {
    expect(migrationSource).toContain("v_multi_account_readiness := coalesce(v_pipeline_diagnostics->'multi_account_readiness'");
    expect(migrationSource).toContain("'multi_account_readiness', v_multi_account_readiness");
    expect(migrationSource).toContain("'binding_gaps', v_binding_gaps");
    expect(migrationSource).toContain("'top_binding_gaps'");
    expect(migrationSource).toContain("'has_binding_gaps'");
  });

  it("explains platform other as imported historical ads facts instead of a live network", () => {
    expect(migrationSource).toContain("'platform_other_means_imported_history', true");
    expect(migrationSource).toContain("platform=other can represent imported historical ads facts");
    expect(migrationSource).toContain("it is not a live ad network");
  });

  it("keeps live API health claims conservative and not based only on fresh facts", () => {
    expect(migrationSource).toContain("v_live_api_health_claim_allowed := v_source_layer_used = 'facts_ads_daily'");
    expect(migrationSource).toContain("and v_fact_rows > 0");
    expect(migrationSource).toContain("and coalesce(v_is_fresh, false)");
    expect(migrationSource).toContain("v_source_readiness_status = 'production_data_ready'");
    expect(migrationSource).toContain("v_production_validation_possible and v_has_api_raw_rows");
    expect(migrationSource).toContain("and not v_likely_test_or_empty_accounts");
    expect(migrationSource).toContain("and lower(coalesce(p_platform, '')) <> 'other'");
    expect(migrationSource).toContain("and not v_selected_facts_are_imported_history");
    expect(migrationSource).toContain("'live_api_health_claim_allowed', v_live_api_health_claim_allowed");
    expect(migrationSource).not.toContain("'live_api_health_claim_allowed', v_source_layer_used = 'facts_ads_daily' and v_fact_rows > 0 and coalesce(v_is_fresh, false)");
  });

  it("treats platform other and imported fallback as imported data", () => {
    expect(migrationSource).toContain("v_uses_imported_data := v_source_layer_used = 'v_unified_ads_performance_daily'");
    expect(migrationSource).toContain("or lower(coalesce(p_platform, '')) = 'other'");
    expect(migrationSource).toContain("or v_selected_facts_are_imported_history");
    expect(migrationSource).toContain("or coalesce(v_source_readiness_status, '') = 'connected_with_imported_fallback'");
    expect(migrationSource).toContain("'uses_imported_data', v_uses_imported_data");
    expect(migrationSource).toContain("'selected_facts_are_imported_history', v_selected_facts_are_imported_history");
  });

  it("hardens the ads prompt around status, historical data, live API claims, and bindings", () => {
    expect(edgeFunctionSource).toContain("check context.ads_context_status before any campaign performance analysis");
    expect(edgeFunctionSource).toContain("Do not say 'no data' when data_freshness.fact_ads_rows > 0");
    expect(edgeFunctionSource).toContain("only historical imported data");
    expect(edgeFunctionSource).toContain("only fallback imported data");
    expect(edgeFunctionSource).toContain("Do not claim live API health unless context.ads_context_status.source_interpretation.live_api_health_claim_allowed is true");
    expect(edgeFunctionSource).toContain("Do not equate real/discovered accounts with bound accounts");
    expect(edgeFunctionSource).toContain("bind each active ad account to the correct client/project/funnel in Bindings (Звʼязки даних in Ukrainian answers)");
  });


  it("polishes ai-helper-run answer limits and user-facing backend wording rules", () => {
    expect(edgeFunctionSource).toContain("max_output_tokens: 2200");
    expect(edgeFunctionSource).toContain("Do not expose raw backend field names in the main answer unless the user explicitly asks for technical details");
    expect(edgeFunctionSource).toContain("Translate operational backend fields into human language");
    expect(edgeFunctionSource).toContain("Say історичні імпортовані дані instead of platform=other");
    expect(edgeFunctionSource).toContain("Avoid English backend field names like fact_ads_rows, active_ad_accounts, active_ad_account_bindings, and ads_context_status");
    expect(edgeFunctionSource).toContain("Технічна примітка");
    expect(edgeFunctionSource).toContain("max 5 sections");
    expect(edgeFunctionSource).toContain("In Ukrainian answers, prefer Звʼязки даних");
    expect(edgeFunctionSource).toContain("проєкт instead of project");
    expect(edgeFunctionSource).toContain("воронка instead of funnel");
  });

  it("tightens ads health answers around complete focused freshness, readiness, and bindings guidance", () => {
    expect(edgeFunctionSource).toContain("For request_type=ads_health_summary or context_scope=ads_health, focus on data availability, freshness, source readiness, sync/access blockers, and binding gaps.");
    expect(edgeFunctionSource).toContain("stay focused on data freshness/readiness, source availability, sync/access blockers, and binding gaps");
    expect(edgeFunctionSource).toContain("do not include detailed campaign performance, CPL rankings, weak campaigns, budget redistribution, or performance diagnosis unless the user explicitly asks");
    expect(edgeFunctionSource).toContain("answer with complete but focused admin guidance in these sections: Стан даних, Чому немає свіжих даних, Що підтверджено / що є гіпотезою, Що перевірити далі, Що сказати клієнту");
    expect(edgeFunctionSource).toContain("available historical period");
    expect(edgeFunctionSource).toContain("confirmed blockers, hypotheses that need verification, next admin checks/actions, and client-ready explanation");
    expect(edgeFunctionSource).toContain("avoid hard bullet-count caps");
    expect(edgeFunctionSource).not.toContain("max 8-12 bullets total");
    expect(edgeFunctionSource).not.toContain("max 8–12 bullets total");
    expect(edgeFunctionSource).toContain("do not list top campaigns/CPL in ads_health answers unless asked");
  });

  it("does not change frontend pages, routes, sidebar, AdsConnectors, or Bindings files", () => {
    const changedFiles = execSync("git diff --name-only", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);

    expect(changedFiles).not.toContain("src/pages/AdsConnectors.tsx");
    expect(changedFiles).not.toContain("src/pages/Bindings.tsx");
    expect(changedFiles.filter((file) => file.startsWith("src/pages/")).every((file) => file === "src/pages/Assistant.tsx")).toBe(true);
    expect(changedFiles.some((file) => /route|sidebar/i.test(file))).toBe(false);
  });
});
