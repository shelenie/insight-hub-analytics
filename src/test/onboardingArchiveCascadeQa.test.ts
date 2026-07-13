import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const migration = readFileSync("supabase/migrations/20260713_onboarding_archive_cascade_rpcs.sql", "utf8");
const clientWrapper = readFileSync("supabase/functions/onboarding-client-upsert/index.ts", "utf8");
const projectWrapper = readFileSync("supabase/functions/onboarding-project-upsert/index.ts", "utf8");
const funnelWrapper = readFileSync("supabase/functions/onboarding-funnel-upsert/index.ts", "utf8");
const onboarding = readFileSync("src/pages/Onboarding.tsx", "utf8");

describe("onboarding archive cascade production QA fix", () => {
  it("adds transactional RPCs for client, project, and funnel archive cascades", () => {
    expect(migration).toContain("archive_onboarding_client_cascade");
    expect(migration).toContain("archive_onboarding_project_cascade");
    expect(migration).toContain("archive_onboarding_funnel_cascade");
    expect(migration).toContain("public.require_source_manager(p_workspace_id)");
    expect(migration).not.toMatch(/delete\s+from\s+public\.(clients|projects|funnels|ad_account_bindings|source_entity_bindings)/i);
  });

  it("client archive cascades to projects, funnels, and active bindings idempotently", () => {
    expect(migration).toContain("where workspace_id = p_workspace_id and client_id = p_client_id and coalesce(status::text, 'active') not in");
    expect(migration).toContain("where workspace_id = p_workspace_id and client_id = p_client_id and coalesce(binding_status::text, 'active') = 'active'");
  });

  it("project and funnel archive can run when parents are inactive and cascade scoped bindings", () => {
    expect(projectWrapper).toContain('userClient["rpc"]("archive_onboarding_project_cascade"');
    expect(funnelWrapper).toContain('userClient["rpc"]("archive_onboarding_funnel_cascade"');
    expect(projectWrapper.indexOf("archiveTransition")).toBeLessThan(projectWrapper.indexOf("requireActiveClient"));
    expect(funnelWrapper.indexOf("archiveTransition")).toBeLessThan(funnelWrapper.indexOf("requireActiveProject"));
    expect(migration).toContain("where workspace_id = p_workspace_id and project_id = p_project_id and coalesce(binding_status::text, 'active') = 'active'");
    expect(migration).toContain("where workspace_id = p_workspace_id and funnel_id = p_funnel_id and coalesce(binding_status::text, 'active') = 'active'");
  });

  it("normal edits/reactivation still keep active-parent validation and stable error codes", () => {
    expect(projectWrapper).toContain("const clientCheck = await requireActiveClient");
    expect(funnelWrapper).toContain("const projectCheck = await requireActiveProject");
    expect(projectWrapper).toContain("stableRpcErrorCode");
    expect(funnelWrapper).toContain("stableRpcErrorCode");
  });

  it("frontend confirms archive, parses backend JSON details, and uses semantic toast variants", () => {
    expect(onboarding).toContain("confirmArchive");
    expect(onboarding).toContain("getFriendlyFunctionError");
    expect(onboarding).toContain("formatBackendError");
    expect(onboarding).not.toContain('variant: "destructive"');
    expect(onboarding.match(/variant: "success"/g)?.length).toBe(3);
    expect(onboarding.match(/variant: "error"/g)?.length).toBe(3);
  });
});
