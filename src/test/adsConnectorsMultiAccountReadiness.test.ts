import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/AdsConnectors.tsx"), "utf8");

describe("AdsConnectors multi-account readiness UI", () => {
  it("loads backend multi-account readiness through the AdsConnectors query", () => {
    expect(source).toContain('readAdsMultiAccountReadiness()');
    expect(source).toContain('supabase.rpc("build_ads_multi_account_readiness"');
    expect(source).toContain('return { readiness, multiAccountReadiness, snapshot');
  });

  it("renders read-only readiness on existing Overview and Ad accounts tabs", () => {
    expect(source).toContain('<MultiAccountOverview readiness={query.data?.multiAccountReadiness}');
    expect(source).toContain('<MultiAccountReadinessPanel readiness={query.data?.multiAccountReadiness}');
    expect(source).toContain('columns={["platform", "readiness_status", "accounts_count", "bound_accounts_count", "unbound_accounts_count", "next_action"]}');
    expect(source).toContain('columns={["gap_type", "platform", "external_account_name", "external_account_id", "message", "next_action"]}');
  });

  it("keeps readiness graceful and diagnostics-only raw payload without adding navigation", () => {
    expect(source).toContain('ui.readinessUnavailable');
    expect(source).toContain('data?.multiAccountReadiness?.payload');
    expect(source).not.toContain('value="multi-account-readiness"');
    expect(source).not.toContain('path="/ads-readiness"');
  });
});
