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

  it("project and funnel archive run only for active-to-inactive transitions", () => {
    for (const wrapper of [clientWrapper, projectWrapper, funnelWrapper]) {
      expect(wrapper).toContain("const existingInactive = isInactiveStatus(existingStatus);");
      expect(wrapper).toContain("const requestedInactive = isInactiveStatus(requestedStatus);");
      expect(wrapper).toContain("archiveTransition: !existingInactive && requestedInactive");
      expect(wrapper).toContain("reactivationTransition: existingInactive && !requestedInactive");
    }
    expect(projectWrapper).toContain('userClient["rpc"]("archive_onboarding_project_cascade"');
    expect(funnelWrapper).toContain('userClient["rpc"]("archive_onboarding_funnel_cascade"');
    expect(projectWrapper.indexOf("if (archiveTransition)")).toBeLessThan(projectWrapper.indexOf("if (!transition.existingInactive || reactivationTransition)"));
    expect(funnelWrapper.indexOf("if (archiveTransition)")).toBeLessThan(funnelWrapper.indexOf("const projectCheck = !transition.existingInactive || reactivationTransition"));
    expect(migration).toContain("where workspace_id = p_workspace_id and project_id = p_project_id and coalesce(binding_status::text, 'active') = 'active'");
    expect(migration).toContain("where workspace_id = p_workspace_id and funnel_id = p_funnel_id and coalesce(binding_status::text, 'active') = 'active'");
  });

  it("inactive-to-inactive edits skip parent guards while reactivation and active edits keep them", () => {
    expect(projectWrapper).toContain("if (!transition.existingInactive || reactivationTransition)");
    expect(projectWrapper).toContain("const clientCheck = await requireActiveClient");
    expect(funnelWrapper).toContain("const projectCheck = !transition.existingInactive || reactivationTransition");
    expect(funnelWrapper).toContain("await requireActiveProjectAndClient");
    expect(projectWrapper).toContain(".update(patch)");
    expect(funnelWrapper).toContain(".update(patch)");
    expect(projectWrapper).toContain("stableRpcErrorCode");
    expect(funnelWrapper).toContain("stableRpcErrorCode");
  });


  it("funnel activation and active edits require both active project and active client", () => {
    expect(funnelWrapper).toContain("requireActiveProjectAndClient");
    expect(funnelWrapper).toContain('.from("projects")');
    expect(funnelWrapper).toContain('.from("clients")');
    expect(funnelWrapper).toContain('code: "inactive_project"');
    expect(funnelWrapper).toContain('code: "inactive_client"');
    expect(funnelWrapper).toContain('code: "project_not_found"');
    expect(funnelWrapper).toContain('code: "client_not_found"');
    expect(funnelWrapper).toContain('if (!project.client_id)');
    expect(funnelWrapper).toContain('if (isInactiveStatus(client.status))');
  });

  it("funnel archived-to-archived edits skip parent checks but reactivation/active edits validate client", () => {
    expect(funnelWrapper).toContain("const projectCheck = !transition.existingInactive || reactivationTransition");
    expect(funnelWrapper).toContain("? await requireActiveProjectAndClient(userClient, workspace_id, project_id)");
    expect(funnelWrapper).toContain(': { project: { client_id: existing.client_id }, error: null }');
    expect(funnelWrapper.indexOf("if (archiveTransition)")).toBeLessThan(funnelWrapper.indexOf("const projectCheck = !transition.existingInactive || reactivationTransition"));
    expect(funnelWrapper).toContain("const projectCheck = await requireActiveProjectAndClient(userClient, workspace_id, project_id)");
  });

  it("migration signatures and grants remain restricted", () => {
    for (const name of ["client", "project", "funnel"]) {
      expect(migration).toContain(`archive_onboarding_${name}_cascade(uuid, uuid, text, jsonb)`);
      expect(migration).toContain(`revoke all on function public.archive_onboarding_${name}_cascade(uuid, uuid, text, jsonb) from public, anon`);
      expect(migration).toContain(`grant execute on function public.archive_onboarding_${name}_cascade(uuid, uuid, text, jsonb) to authenticated, service_role`);
    }
    expect(migration).toMatch(/security definer/g);
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
