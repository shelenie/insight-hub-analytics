import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const helper = readFileSync("src/lib/dataBindingsMutations.ts", "utf8");
const clientWrapper = readFileSync("supabase/functions/onboarding-client-upsert/index.ts", "utf8");
const projectWrapper = readFileSync("supabase/functions/onboarding-project-upsert/index.ts", "utf8");
const funnelWrapper = readFileSync("supabase/functions/onboarding-funnel-upsert/index.ts", "utf8");

function rpcPayloadSource(source: string, rpc: string) {
  let start = source.indexOf(`rpc("${rpc}"`);
  if (start === -1) {
    const functionName = rpc.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
    start = source.indexOf(`function ${functionName}`);
  }
  if (start === -1) return source;
  const end = source.indexOf("} as never", start);
  if (end !== -1) return source.slice(start, end);
  const wrapperEnd = source.indexOf("});", start);
  return wrapperEnd === -1 ? source.slice(start) : source.slice(start, wrapperEnd);
}

function expectPayloadKeys(source: string, rpc: string, expected: string[]) {
  const payload = rpcPayloadSource(source, rpc);
  for (const key of expected) {
    expect(payload, `${rpc} should include ${key}`).toContain(`${key}:`);
  }
}

function expectUnsupportedAbsent(source: string, rpc: string, unsupported: string[]) {
  const payload = rpcPayloadSource(source, rpc);
  for (const key of unsupported) {
    expect(payload, `${key} must not be sent`).not.toContain(`${key}:`);
  }
}

describe("Step 3 onboarding RPC payload contracts", () => {
  it("sends the exact upsert_client arguments from the frontend helper and wrapper", () => {
    const expected = [
      "p_workspace_id",
      "p_client_name",
      "p_client_code",
      "p_status",
      "p_default_currency",
      "p_default_timezone",
      "p_website_url",
      "p_owner_name",
      "p_owner_email",
      "p_notes",
      "p_created_by",
      "p_created_by_email",
      "p_metadata",
    ];
    expectPayloadKeys(helper, "upsert_client", expected);
    expectPayloadKeys(clientWrapper, "upsert_client", expected);
    expectUnsupportedAbsent(helper, "upsert_client", ["p_industry", "p_region"]);
    expectUnsupportedAbsent(clientWrapper, "upsert_client", ["p_industry", "p_region"]);
    expect(helper + clientWrapper).toContain("p_created_by: null");
    expect(helper + clientWrapper).toContain("p_created_by_email: null");
  });

  it("sends the exact upsert_project arguments from the frontend helper and wrapper", () => {
    const expected = [
      "p_workspace_id",
      "p_client_id",
      "p_project_name",
      "p_project_code",
      "p_status",
      "p_business_model",
      "p_primary_offer",
      "p_default_currency",
      "p_default_timezone",
      "p_owner_name",
      "p_owner_email",
      "p_notes",
      "p_created_by",
      "p_created_by_email",
      "p_metadata",
    ];
    expectPayloadKeys(helper, "upsert_project", expected);
    expectPayloadKeys(projectWrapper, "upsert_project", expected);
    expectUnsupportedAbsent(helper, "upsert_project", ["p_project_type", "p_start_date", "p_end_date"]);
    expectUnsupportedAbsent(projectWrapper, "upsert_project", ["p_project_type", "p_start_date", "p_end_date"]);
  });

  it("sends the exact upsert_funnel arguments from the frontend helper and wrapper", () => {
    const expected = [
      "p_workspace_id",
      "p_project_id",
      "p_funnel_name",
      "p_funnel_code",
      "p_funnel_type",
      "p_status",
      "p_traffic_source_notes",
      "p_offer_notes",
      "p_default_currency",
      "p_default_timezone",
      "p_starts_at",
      "p_ends_at",
      "p_notes",
      "p_created_by",
      "p_created_by_email",
      "p_metadata",
    ];
    expectPayloadKeys(helper, "upsert_funnel", expected);
    expectPayloadKeys(funnelWrapper, "upsert_funnel", expected);
    const unsupported = [
      "p_stage",
      "p_primary_goal",
      "p_owner_name",
      "p_owner_email",
      "p_start_date",
      "p_end_date",
    ];
    expectUnsupportedAbsent(helper, "upsert_funnel", unsupported);
    expectUnsupportedAbsent(funnelWrapper, "upsert_funnel", unsupported);
  });
});
