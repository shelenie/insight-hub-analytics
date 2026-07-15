import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const readinessMigration = readFileSync("supabase/migrations/20260707_ab_add_ads_multi_account_readiness.sql", "utf8");
const pipelineDiagnosticsMigration = readFileSync("supabase/migrations/20260707_y_add_ads_pipeline_diagnostics.sql", "utf8");
const aiContextMigration = readFileSync("supabase/migrations/20260707_z_extend_ai_ads_context_with_diagnostics.sql", "utf8");
const edgeFunctionSource = readFileSync("supabase/functions/ai-helper-run/index.ts", "utf8");

const functionBody = readinessMigration.match(/create or replace function public\.build_ads_multi_account_readiness[\s\S]*?\$\$;\n\ngrant execute/)?.[0] ?? "";

describe("ads multi-account readiness diagnostics", () => {
  it("adds the build_ads_multi_account_readiness RPC as a read-only JSON diagnostic", () => {
    expect(readinessMigration).toContain("create or replace function public.build_ads_multi_account_readiness");
    expect(readinessMigration).toContain("p_workspace_id uuid");
    expect(readinessMigration).toContain("returns jsonb");
    expect(readinessMigration).toContain("stable");
    expect(readinessMigration).toContain("set search_path = public");
    expect(readinessMigration).toContain("grant execute on function public.build_ads_multi_account_readiness(uuid) to authenticated");

    expect(functionBody).not.toMatch(/\b(insert|update|delete|truncate)\b/i);
  });

  it("returns the required top-level readiness objects", () => {
    for (const field of [
      "overall_status",
      "summary",
      "platforms",
      "accounts",
      "binding_gaps",
    ]) {
      expect(functionBody).toContain(`'${field}'`);
    }
  });

  it("includes the required summary fields", () => {
    for (const field of [
      "total_connections",
      "total_accounts",
      "active_accounts",
      "bound_accounts",
      "unbound_accounts",
      "platforms_count",
      "has_multiple_accounts_same_platform",
      "production_ready_account_count",
      "needs_attention_count",
    ]) {
      expect(functionBody).toContain(`'${field}'`);
    }
  });

  it("includes stable multi-account readiness status codes", () => {
    for (const statusCode of [
      "no_connections",
      "accounts_discovered_no_bindings",
      "partially_bound",
      "ready",
      "needs_mapping_review",
      "ambiguous_bindings",
    ]) {
      expect(functionBody).toContain(statusCode);
    }
  });

  it("returns per-platform and per-account binding diagnostics", () => {
    for (const field of [
      "platform",
      "connections_count",
      "accounts_count",
      "active_accounts_count",
      "bound_accounts_count",
      "unbound_accounts_count",
      "has_multiple_accounts",
      "readiness_status",
      "message",
      "next_action",
      "ad_account_id",
      "external_account_id",
      "external_account_name",
      "status",
      "is_active",
      "binding_count",
      "is_bound",
      "is_primary_somewhere",
      "bound_client_ids",
      "bound_project_ids",
      "bound_funnel_ids",
    ]) {
      expect(functionBody).toContain(`'${field}'`);
    }
  });

  it("detects multiple accounts per platform and active unbound accounts", () => {
    expect(functionBody).toContain("count(*) over (partition by platform::text) as platform_accounts");
    expect(functionBody).toContain("coalesce(bool_or(platform_accounts > 1), false)");
    expect(functionBody).toContain("coalesce(a.accounts_count, 0) > 1");
    expect(functionBody).toContain("active_account_without_binding");
    expect(functionBody).toContain("b.id is null");
  });

  it("detects mapping and binding gaps requested for agency onboarding", () => {
    for (const gapType of [
      "active_account_without_binding",
      "account_primary_binding_conflict",
      "binding_without_client_project_funnel",
      "inactive_account_with_active_binding",
      "platform_connection_without_accounts",
    ]) {
      expect(functionBody).toContain(gapType);
    }

    expect(functionBody).toContain("b.client_id is null and b.project_id is null and b.funnel_id is null");
    expect(functionBody).toContain("coalesce(b.is_primary, false)");
    expect(functionBody).toContain("count(distinct concat_ws");
  });

  it("does not expose tokens or secrets in the readiness payload", () => {
    expect(functionBody).not.toMatch(/access_token|refresh_token|client_secret|service_role|api_key|apikey|bearer/i);
    expect(functionBody).not.toContain("select *");
  });

  it("extends pipeline diagnostics without changing existing RPC signatures or ai-helper-run contract", () => {
    expect(pipelineDiagnosticsMigration).toContain("create or replace function public.build_ads_pipeline_diagnostics(\n  p_workspace_id uuid,\n  p_date_from date default null,\n  p_date_to date default null\n)");
    expect(pipelineDiagnosticsMigration).toContain("'multi_account_readiness', public.build_ads_multi_account_readiness(p_workspace_id)");

    expect(aiContextMigration).toContain("create or replace function public.build_ai_ads_context(\n  p_workspace_id uuid,\n  p_date_from date default null,\n  p_date_to date default null,\n  p_platform text default null\n)");
    expect(aiContextMigration).not.toContain("p_context_scope");

    expect(edgeFunctionSource).toContain('rpc("build_ai_ads_context", payload)');
    expect(edgeFunctionSource).toContain("const workspaceId = body.workspace_id;");
    expect(edgeFunctionSource).toContain("const requestType = body.request_type ?? \"production_readiness_summary\";");
    expect(edgeFunctionSource).toContain("const contextScope = body.context_scope ?? defaultContextScope(requestType);");
    expect(edgeFunctionSource).toContain("answer: aiResult.answer");
  });
});


describe("Ads Connectors frontend status labels", () => {
  it("does not expose raw needs binding status in Ukrainian cards", () => {
    const source = readFileSync("src/pages/AdsConnectors.tsx", "utf8");

    expect(source).toContain('"needs binding": "Потрібна прив’язка"');
    expect(source).toContain('needs_binding: "Потрібна прив’язка"');
    expect(source).not.toContain('"needs binding": "needs binding"');
  });
});
