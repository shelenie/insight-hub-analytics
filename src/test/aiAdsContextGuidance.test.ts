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

  it("hardens the ads prompt around status, historical data, live API claims, and bindings", () => {
    expect(edgeFunctionSource).toContain("check context.ads_context_status before any campaign performance analysis");
    expect(edgeFunctionSource).toContain("Do not say 'no data' when data_freshness.fact_ads_rows > 0");
    expect(edgeFunctionSource).toContain("only historical imported data");
    expect(edgeFunctionSource).toContain("only fallback imported data");
    expect(edgeFunctionSource).toContain("Do not claim live API health unless context.ads_context_status.source_interpretation.live_api_health_claim_allowed is true");
    expect(edgeFunctionSource).toContain("Do not equate real/discovered accounts with bound accounts");
    expect(edgeFunctionSource).toContain("bind each active ad account to the correct client/project/funnel in Bindings");
  });

  it("does not change frontend pages, routes, sidebar, AdsConnectors, or Bindings files", () => {
    const changedFiles = execSync("git diff --name-only", { encoding: "utf8" })
      .split("\n")
      .filter(Boolean);

    expect(changedFiles).not.toContain("src/pages/AdsConnectors.tsx");
    expect(changedFiles).not.toContain("src/pages/Bindings.tsx");
    expect(changedFiles.some((file) => file.startsWith("src/pages/"))).toBe(false);
    expect(changedFiles.some((file) => /route|sidebar/i.test(file))).toBe(false);
  });
});
