import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

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

  it("updates an exact selected client row instead of calling upsert on edit", () => {
    const block = editBlock(clientWrapper, "client_id");
    expect(block).toContain('.from("clients")');
    expect(block).toContain('.eq("id", client_id)');
    expect(block).toContain('.eq("workspace_id", workspace_id)');
    expect(block).toContain(".update(patch)");
    expect(block).not.toContain('userClient.rpc("upsert_client"');
    expect(block).toContain("client_code");
    expect(block).toContain("if (!existing)");
  });

  it("updates an exact selected project row after validating active client hierarchy", () => {
    const block = editBlock(projectWrapper, "project_id");
    expect(projectWrapper).toContain("requireActiveClient(userClient, workspace_id, client_id)");
    expect(projectWrapper).toContain('.from("clients")');
    expect(block).toContain('.from("projects")');
    expect(block).toContain('.eq("id", project_id)');
    expect(block).toContain('.eq("workspace_id", workspace_id)');
    expect(block).toContain("client_id,");
    expect(block).not.toContain('userClient.rpc("upsert_project"');
  });

  it("updates an exact selected funnel row after validating active project and deriving client_id", () => {
    const block = editBlock(funnelWrapper, "funnel_id");
    expect(funnelWrapper).toContain("requireActiveProject(userClient, workspace_id, project_id)");
    expect(funnelWrapper).toContain('.select("id, workspace_id, client_id, status")');
    expect(funnelWrapper).toContain("const client_id = projectCheck.project.client_id");
    expect(block).toContain('.from("funnels")');
    expect(block).toContain('.eq("id", funnel_id)');
    expect(block).toContain('.eq("workspace_id", workspace_id)');
    expect(block).toContain("client_id,");
    expect(block).not.toContain('userClient.rpc("upsert_funnel"');
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
