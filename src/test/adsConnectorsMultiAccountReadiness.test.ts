import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/AdsConnectors.tsx"), "utf8");

describe("AdsConnectors multi-account readiness UI", () => {
  it("loads backend multi-account readiness through the AdsConnectors query", () => {
    expect(source).toContain("readAdsMultiAccountReadiness()");
    expect(source).toContain('supabase.rpc("build_ads_multi_account_readiness"');
    expect(source).toContain("return { readiness, multiAccountReadiness, snapshot");
  });

  it("keeps readiness on existing tabs without adding route, tab, or navigation", () => {
    expect(source).toContain('<MultiAccountOverview readiness={query.data?.multiAccountReadiness}');
    expect(source).toContain('<MultiAccountAdAccountsSummary readiness={query.data?.multiAccountReadiness}');
    expect(source).toContain('value="ad-accounts"');
    expect(source).not.toContain('value="multi-account-readiness"');
    expect(source).not.toContain('value="ads-readiness"');
    expect(source).not.toContain('path="/ads-readiness"');
  });

  it("uses a compact Ad accounts readiness summary before the account cards", () => {
    const adAccountsTab = source.slice(source.indexOf('<TabsContent value="ad-accounts"'), source.indexOf('<TabsContent value="sync"'));
    expect(adAccountsTab).toContain("<MultiAccountAdAccountsSummary");
    expect(adAccountsTab.indexOf("<MultiAccountAdAccountsSummary")).toBeLessThan(adAccountsTab.indexOf("<AdAccountsTable"));
    expect(source).toContain("function CompactReadinessMetric");
    expect(source).toContain("grid shrink-0 grid-cols-2 gap-2 text-xs sm:grid-cols-4");
  });

  it("keeps detailed platform readiness and binding gaps collapsed instead of always expanded first", () => {
    expect(source).toContain("<details");
    expect(source).toContain("{ui.readinessDetailsTitle}");
    expect(source).toContain('columns={["platform", "readiness_status", "accounts_count", "bound_accounts_count", "unbound_accounts_count", "next_action"]}');
    expect(source).toContain('columns={["gap_type", "platform", "external_account_name", "external_account_id", "message", "next_action"]}');
    expect(source).not.toContain("function MultiAccountReadinessPanel");
  });

  it("reads counters from the nested summary payload", () => {
    expect(source).toContain('const summary = readObject(payload, "summary");');
    expect(source).toContain('readNumber(summary, "total_accounts") ?? fallbackAccountCount');
    expect(source).toContain('readNumber(summary, "bound_accounts")');
    expect(source).toContain('readNumber(summary, "unbound_accounts")');
    expect(source).toContain('readNumber(summary, "needs_attention_count")');
    expect(source).toContain('const unbound = readNumber(summary, "unbound_accounts") ?? 0;');
    expect(source).not.toContain('readNumber(payload, "total_accounts")');
    expect(source).not.toContain('readNumber(payload, "bound_accounts")');
    expect(source).not.toContain('readNumber(payload, "unbound_accounts")');
    expect(source).not.toContain('readNumber(payload, "needs_attention_count")');
  });

  it("has friendly readiness and binding-gap labels in Ukrainian and English", () => {
    for (const label of [
      'partially_bound: "Частково привʼязано"',
      'accounts_discovered_no_bindings: "Акаунти знайдено, привʼязок немає"',
      'active_account_without_binding: "Активний акаунт без привʼязки"',
      'partially_bound: "Partially bound"',
      'accounts_discovered_no_bindings: "Accounts found, no bindings"',
      'active_account_without_binding: "Active account without binding"',
    ]) {
      expect(source).toContain(label);
    }
  });

  it("keeps readiness graceful and diagnostics-only raw payload", () => {
    expect(source).toContain("ui.readinessUnavailable");
    expect(source).toContain("data?.multiAccountReadiness?.payload");
  });
});
