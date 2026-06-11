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

  it("builds the ad account RPC payload from the existing bind_ad_account_to_scope signature", () => {
    const adAccountPayloadStart = functionSource.indexOf('rpcName = "bind_ad_account_to_scope"');
    const rpcCallStart = functionSource.indexOf("const { data, error } = await adminClient.rpc", adAccountPayloadStart);
    const adAccountPayloadSource = functionSource.slice(adAccountPayloadStart, rpcCallStart);

    expect(adAccountPayloadSource).toContain("p_platform:");
    expect(adAccountPayloadSource).toContain("p_ad_platform_connection_id:");
    expect(adAccountPayloadSource).toContain("p_ad_account_id:");
    expect(adAccountPayloadSource).toContain("p_external_account_id:");
    expect(adAccountPayloadSource).toContain("p_external_account_name:");
    expect(adAccountPayloadSource).toContain("p_is_primary:");
    expect(adAccountPayloadSource).not.toContain("p_source_id:");
  });
});
