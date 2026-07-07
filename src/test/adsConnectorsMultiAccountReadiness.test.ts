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

  it("preserves the Real accounts label and uses a compact Ad accounts readiness summary before the account cards", () => {
    expect(source).toContain('realAccountsSection: "Реальні акаунти"');
    expect(source).toContain('realAccountsSection: "Real accounts"');
    expect(source).not.toContain('realAccountsSection: "Active bound accounts"');
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

  it("reads Overview counters from the nested summary payload", () => {
    expect(source).toContain('const summary = readObject(payload, "summary");');
    expect(source).toContain('readNumber(summary, "total_accounts") ?? fallbackAccountCount');
    expect(source).toContain('readNumber(summary, "bound_accounts")');
    expect(source).toContain('readNumber(summary, "unbound_accounts")');
    expect(source).toContain('readNumber(summary, "needs_attention_count")');
    expect(source).toContain('const unbound = readNumber(summary, "unbound_accounts") ?? gaps.length;');
    expect(source).not.toContain('readNumber(payload, "total_accounts")');
    expect(source).not.toContain('readNumber(payload, "bound_accounts")');
    expect(source).not.toContain('readNumber(payload, "unbound_accounts")');
    expect(source).not.toContain('readNumber(payload, "needs_attention_count")');
  });

  it("includes binding gaps and unbound accounts in Overview needs-attention logic", () => {
    expect(source).toContain("const bindingGapSummary = buildBindingGapSummary(data?.multiAccountReadiness, ui);");
    expect(source).toContain("if (bindingGapSummary) items.push(bindingGapSummary);");
    expect(source).toContain('readNumber(summary, "unbound_accounts") ?? gaps.length');
    expect(source).toContain('readString(gap, "platform") ?? readString(gap, "external_account_name") ?? readString(gap, "external_account_id")');
    expect(source).toContain("return targets.length > 0 ? `${formatMetric(unbound)} ${label}: ${targets.join(", ")}.` : `${formatMetric(unbound)} ${label}.`;");
  });

  it("has friendly readiness and binding-gap labels in Ukrainian and English", () => {
    for (const label of [
      'partially_bound: "Частково привʼязано"',
      'accounts_discovered_no_bindings: "Акаунти знайдені, але не привʼязані"',
      'active_account_without_binding: "Потрібна привʼязка"',
      'partially_bound: "Partially linked"',
      'accounts_discovered_no_bindings: "Accounts found, not linked"',
      'active_account_without_binding: "Needs binding"',
    ]) {
      expect(source).toContain(label);
    }
  });

  it("keeps readiness graceful and diagnostics-only raw payload", () => {
    expect(source).toContain("ui.readinessUnavailable");
    expect(source).toContain("data?.multiAccountReadiness?.payload");
  });
});
