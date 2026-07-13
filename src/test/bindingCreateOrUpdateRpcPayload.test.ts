import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const functionSource = readFileSync(resolve(process.cwd(), "supabase/functions/binding-create-or-update/index.ts"), "utf8");

describe("binding-create-or-update RPC payloads", () => {
  it("does not send legacy generic binding parameters to binding RPCs", () => {
    expect(functionSource).not.toContain("p_binding_id:");
    expect(functionSource).not.toContain("p_binding_status:");
  });

  it("builds the source RPC payload from the existing bind_source_entity_to_scope signature", () => {
    const sourcePayloadStart = functionSource.indexOf('if (binding_type === "source")');
    const adAccountBranchStart = functionSource.indexOf("} else {", sourcePayloadStart);
    const sourcePayloadSource = functionSource.slice(sourcePayloadStart, adAccountBranchStart);

    expect(sourcePayloadSource).toContain("getActiveSourceEntity");
    expect(sourcePayloadSource).toContain("p_source_kind:");
    expect(sourcePayloadSource).toContain("p_source_table:");
    expect(sourcePayloadSource).toContain("p_source_id:");
    expect(sourcePayloadSource).toContain("p_source_external_id:");
    expect(sourcePayloadSource).toContain("p_source_name:");
    expect(sourcePayloadSource).toContain("p_is_primary:");
    expect(sourcePayloadSource).not.toContain("p_ad_account_id:");
    expect(sourcePayloadSource).not.toContain("p_platform:");
  });

  it("deprecates the ad-account branch instead of calling legacy bind_ad_account_to_scope", () => {
    expect(functionSource).toContain("deprecated_ad_account_binding_path");
    expect(functionSource).not.toContain('rpcName = "bind_ad_account_to_scope"');
    expect(functionSource).not.toContain("p_platform:");
    expect(functionSource).not.toContain("p_external_account_id:");
    expect(functionSource).not.toContain("p_external_account_name:");
  });

  it("uses the authenticated user client for source mutations", () => {
    expect(functionSource).toContain("await userClient.rpc(rpcName, rpcPayload)");
    expect(functionSource).not.toContain("await adminClient.rpc(rpcName, rpcPayload)");
  });

  it("resolves Google Sheet tabs with is_active and google_sheet_source_id", () => {
    expect(functionSource).toContain('from("google_sheet_tabs")');
    expect(functionSource).not.toContain("google_sheet_tabs.status");
    expect(functionSource).not.toContain('.from("google_sheet_tabs")\n    .select("id, workspace_id, status');
    expect(functionSource).toContain("google_sheet_source_id");
    expect(functionSource).toContain("data.is_active === false");
    expect(functionSource).toContain('source_kind: "google_sheet_tab"');
  });

  it("does not send empty metadata as the default RPC payload", () => {
    expect(functionSource).toContain("p_metadata: body.metadata ?? null");
    expect(functionSource).not.toContain("p_metadata: body.metadata ?? {}");
  });
});
