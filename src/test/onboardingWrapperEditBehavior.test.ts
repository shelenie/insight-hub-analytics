import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const onboarding = readFileSync("src/pages/Onboarding.tsx", "utf8");
const clientWrapper = readFileSync("supabase/functions/onboarding-client-upsert/index.ts", "utf8");
const projectWrapper = readFileSync("supabase/functions/onboarding-project-upsert/index.ts", "utf8");
const funnelWrapper = readFileSync("supabase/functions/onboarding-funnel-upsert/index.ts", "utf8");

function editBlock(source: string, marker: string) {
  const start = source.indexOf(`if (${marker})`);
  expect(start).toBeGreaterThanOrEqual(0);
  const rpcStart = source.indexOf("userClient.rpc", start);
  return source.slice(start, rpcStart === -1 ? undefined : rpcStart);
}

describe("onboarding Edge Function edit behavior", () => {
  it("keeps create without an ID on the hardened RPC path", () => {
    expect(clientWrapper).toContain('userClient.rpc("upsert_client"');
    expect(projectWrapper).toContain('userClient.rpc("upsert_project"');
    expect(funnelWrapper).toContain('userClient.rpc("upsert_funnel"');
    expect(clientWrapper).toContain("p_created_by: null");
    expect(projectWrapper).toContain("p_created_by: null");
    expect(funnelWrapper).toContain("p_created_by: null");
  });

  it("updates an exact selected client row without rejecting inactive/archived current status", () => {
    const block = editBlock(clientWrapper, "client_id");
    expect(block).toContain('.from("clients")');
    expect(block).toContain('.select("id, workspace_id, status, metadata")');
    expect(block).toContain('.eq("id", client_id)');
    expect(block).toContain('.eq("workspace_id", workspace_id)');
    expect(block).toContain(".update(patch)");
    expect(block).not.toContain('userClient.rpc("upsert_client"');
    expect(block).not.toContain("inactive_client");
    expect(block).toContain("client_code");
    expect(block).toContain("if (!existing)");
  });

  it("updates an exact selected project row without rejecting its own inactive status, but validates parent", () => {
    const block = editBlock(projectWrapper, "project_id");
    expect(projectWrapper).toContain("requireActiveClient(userClient, workspace_id, client_id)");
    expect(projectWrapper).toContain('.from("clients")');
    expect(block).toContain('.from("projects")');
    expect(block).toContain('.select("id, workspace_id, client_id, status, metadata")');
    expect(block).toContain('.eq("id", project_id)');
    expect(block).toContain('.eq("workspace_id", workspace_id)');
    expect(block).not.toContain("inactive_project");
    expect(block).not.toContain('userClient.rpc("upsert_project"');
  });

  it("updates an exact selected funnel row without rejecting its own inactive status, but validates parent", () => {
    const block = editBlock(funnelWrapper, "funnel_id");
    expect(funnelWrapper).toContain("requireActiveProjectAndClient(userClient, workspace_id, project_id)");
    expect(funnelWrapper).toContain('.select("id, workspace_id, client_id, status")');
    expect(funnelWrapper).toContain("const client_id = projectCheck.project.client_id");
    expect(block).toContain('.from("funnels")');
    expect(block).toContain('.select("id, workspace_id, project_id, client_id, status, metadata")');
    expect(block).toContain('.eq("id", funnel_id)');
    expect(block).toContain('.eq("workspace_id", workspace_id)');
    expect(block).not.toContain("inactive_funnel");
    expect(block).not.toContain('userClient.rpc("upsert_funnel"');
  });

  it("writes server-derived audit metadata while preserving existing/request metadata safely", () => {
    for (const [source, via] of [
      [clientWrapper, "onboarding-client-upsert"],
      [projectWrapper, "onboarding-project-upsert"],
      [funnelWrapper, "onboarding-funnel-upsert"],
    ] as const) {
      expect(source).toContain("metadata: mergeAuditMetadata(existing.metadata, body.metadata, actor");
      expect(source).toContain(`updated_via: updatedVia`);
      expect(source).toContain(`"${via}"`);
      expect(source).toContain("...safeExisting");
      expect(source).toContain("...safeRequested");
      expect(source).toContain("updated_by: actor.id");
      expect(source).toContain("updated_by_email: actor.email");
      expect(source).toContain("updated_at: updatedAt");
      expect(source).toContain("isPlainObject(requested)");
      expect(source).not.toContain("void actor");
      expect(source).not.toContain("body.created_by");
      expect(source).not.toContain("body.updated_by");
      expect(source).not.toContain("body.created_by_email");
      expect(source).not.toContain("body.updated_by_email");
    }
  });

  it("rejects normal hierarchy reparenting during edit mode", () => {
    const projectBlock = editBlock(projectWrapper, "project_id");
    const funnelBlock = editBlock(funnelWrapper, "funnel_id");
    expect(projectBlock).toContain("client_id !== existing.client_id");
    expect(projectBlock).toContain("project_reparent_requires_dedicated_action");
    expect(funnelBlock).toContain("project_id !== existing.project_id");
    expect(funnelBlock).toContain("funnel_reparent_requires_dedicated_action");
  });

  it("disables hierarchy selectors only while editing existing project/funnel records", () => {
    expect(onboarding).toContain("Boolean(projectForm.project_id)");
    expect(onboarding).toContain("Boolean(funnelForm.funnel_id)");
    expect(onboarding).toContain("projectMutation.mutate({ project_id: projectForm.project_id || undefined");
    expect(onboarding).toContain("funnelMutation.mutate({ funnel_id: funnelForm.funnel_id || undefined");
  });

  it("does not use service role or request-body actor identity for edit paths", () => {
    for (const source of [clientWrapper, projectWrapper, funnelWrapper]) {
      expect(source).not.toContain("SUPABASE_SERVICE_ROLE_KEY");
      expect(source).not.toContain("body.created_by");
      expect(source).not.toContain("body.created_by_email");
      expect(source).toContain("actorContext(authData.user)");
    }
  });
});
