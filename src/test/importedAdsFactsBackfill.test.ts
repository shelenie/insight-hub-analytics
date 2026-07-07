import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";

const migration = readFileSync("supabase/migrations/20260707_aa_rebuild_imported_ads_facts.sql", "utf8");
const aiContextMigration = readFileSync("supabase/migrations/20260707_z_extend_ai_ads_context_with_diagnostics.sql", "utf8");
const edgeFunctionSource = readFileSync("supabase/functions/ai-helper-run/index.ts", "utf8");

describe("imported ads facts backfill migration", () => {
  it("adds the rebuild_imported_ads_facts RPC with the approved signature and JSON summary", () => {
    expect(migration).toContain("create or replace function public.rebuild_imported_ads_facts(");
    expect(migration).toContain("p_workspace_id uuid");
    expect(migration).toContain("p_date_from date default null");
    expect(migration).toContain("p_date_to date default null");
    expect(migration).toContain("returns jsonb");
    expect(migration).toContain("grant execute on function public.rebuild_imported_ads_facts(uuid, date, date) to authenticated");

    for (const summaryField of [
      "rows_read",
      "rows_inserted_or_upserted",
      "date_from",
      "date_to",
      "first_metric_date",
      "last_metric_date",
      "source_layer_used",
      "warnings",
      "status",
    ]) {
      expect(migration).toContain(summaryField);
    }
  });

  it("reads deterministically from imported unified ads performance data", () => {
    expect(migration).toContain("v_source_layer_used text := 'v_unified_ads_performance_daily'");
    expect(migration).toContain("from public.v_unified_ads_performance_daily");
    expect(migration).toContain("metric_date::date as insight_date");
    expect(migration).toContain("'other'::text as platform");
    expect(migration).not.toContain("'imported'::text as platform");
    expect(migration).toContain("group by workspace_id, metric_date::date, campaign_name::text");
    expect(migration).toContain("sum(coalesce(spend, 0))::numeric as spend");
    expect(migration).toContain("sum(coalesce(clicks, 0))::integer as clicks");
    expect(migration).toContain("sum(coalesce(leads, 0))::integer as leads");
    expect(migration).toContain("sum(coalesce(reach, 0))::integer as impressions");
  });

  it("stores imported historical facts as platform other while retaining imported fact keys", () => {
    expect(migration).toContain("'other'::text as platform");
    expect(migration).not.toContain("'imported'::text as platform");
    expect(migration).toContain("('imported:' || metric_date::date::text || ':' || md5(coalesce(campaign_name::text, '')))::text as fact_key");
    expect(migration).toContain("Imported historical rows are stored with platform=other because facts_ads_daily only allows known platform codes or other.");
  });

  it("writes/upserts into facts_ads_daily idempotently using the production fact_key key", () => {
    expect(migration).toContain("insert into public.facts_ads_daily");
    expect(migration).toContain("fact_key");
    expect(migration).toContain("('imported:' || metric_date::date::text || ':' || md5(coalesce(campaign_name::text, '')))::text as fact_key");
    expect(migration).toContain("on conflict (workspace_id, fact_key)");
    expect(migration).toContain("do update set");
    expect(migration).not.toContain("facts_ads_daily_imported_backfill_uniq");
    expect(migration).not.toContain("on conflict (workspace_id, insight_date, platform, campaign_name)");
  });

  it("inserts explicit campaign level and maps imported reach into production impressions", () => {
    expect(migration).toContain("'campaign'::text as level");
    expect(migration).toContain("level,");
    expect(migration).toContain("impressions,");
    expect(migration).toContain("impressions = excluded.impressions");
    expect(migration).toContain("Imported reach was mapped to impressions because imported fallback source does not expose impressions.");

    const insertBlock = migration.match(/insert into public\.facts_ads_daily \([\s\S]*?\)\n {4}select/)?.[0] ?? "";
    expect(insertBlock).not.toContain("reach");
    expect(migration).toContain("sum(coalesce(clicks, 0))::integer as clicks");
    expect(migration).toContain("sum(coalesce(leads, 0))::integer as leads");
    expect(migration).toContain("sum(coalesce(reach, 0))::integer as impressions");
  });

  it("is workspace-scoped and date-range scoped everywhere", () => {
    expect(migration).toContain("if p_workspace_id is null then");
    expect(migration).toContain("where workspace_id = $1");
    expect(migration).toContain("and ($2 is null or metric_date >= $2)");
    expect(migration).toContain("and ($3 is null or metric_date <= $3)");
    expect(migration).toContain("using p_workspace_id, p_date_from, p_date_to");
  });

  it("does not perform global destructive cleanup or touch live sync/OAuth paths", () => {
    expect(migration).not.toMatch(/\btruncate\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
    expect(migration).not.toContain("access_token");
    expect(migration).not.toContain("refresh_token");
    expect(migration).not.toContain("client_secret");
    expect(migration).not.toContain("service_role_key");
    expect(migration).not.toContain("oauth");
    expect(migration).not.toMatch(/\btruncate\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\b/i);
  });

  it("keeps build_ai_ads_context signature unchanged and already facts-primary", () => {
    expect(aiContextMigration).toContain("create or replace function public.build_ai_ads_context(\n  p_workspace_id uuid,\n  p_date_from date default null,\n  p_date_to date default null,\n  p_platform text default null\n)");
    expect(aiContextMigration).toContain("if v_fact_rows > 0 then");
    expect(aiContextMigration).toContain("v_source_layer_used := 'facts_ads_daily'");
    expect(aiContextMigration).toContain("else\n    v_source_layer_used := 'v_unified_ads_performance_daily'");
    expect(aiContextMigration).not.toContain("p_context_scope");
  });

  it("keeps the ai-helper-run request/response contract unchanged", () => {
    expect(edgeFunctionSource).toContain("body = await req.json();");
    expect(edgeFunctionSource).toContain("const workspaceId = body.workspace_id;");
    expect(edgeFunctionSource).toContain("const requestType = body.request_type ?? \"production_readiness_summary\";");
    expect(edgeFunctionSource).toContain("const contextScope = body.context_scope ?? defaultContextScope(requestType);");
    expect(edgeFunctionSource).toContain('rpc("build_ai_ads_context", payload)');
    expect(edgeFunctionSource).toContain("ok: true");
    expect(edgeFunctionSource).toContain("answer: aiResult.answer");
  });
});
