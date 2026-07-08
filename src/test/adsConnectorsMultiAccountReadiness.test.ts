import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/AdsConnectors.tsx"), "utf8");
const adAccountsTab = source.slice(source.indexOf('<TabsContent value="ad-accounts"'), source.indexOf('<TabsContent value="sync"'));
const readinessSummary = source.slice(source.indexOf("function MultiAccountAdAccountsSummary"), source.indexOf("function CompactReadinessMetric"));

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

  it("preserves Real accounts wording and uses a compact Ad accounts readiness summary before the account cards", () => {
    expect(source).toContain('realAccountsSection: "Реальні акаунти"');
    expect(source).toContain('realAccountsSection: "Real accounts"');
    expect(source).toContain('realAccount: "Реальний акаунт"');
    expect(source).toContain('realAccount: "Real account"');
    expect(adAccountsTab).toContain("<MultiAccountAdAccountsSummary");
    expect(adAccountsTab.indexOf("<MultiAccountAdAccountsSummary")).toBeLessThan(adAccountsTab.indexOf("<AdAccountsTable"));
    expect(source).toContain("function CompactReadinessMetric");
    expect(source).toContain("grid shrink-0 grid-cols-2 gap-2 text-xs sm:grid-cols-4");
  });

  it("keeps details collapsed and replaces wide readiness tables with readable cards/lists", () => {
    expect(readinessSummary).toContain("<details");
    expect(readinessSummary).toContain("{ui.readinessDetailsTitle}");
    expect(readinessSummary).toContain("<PlatformReadinessCards rows={platformRows} ui={ui} />");
    expect(readinessSummary).toContain("<BindingGapCards rows={gapRows} ui={ui} />");
    expect(readinessSummary).not.toContain("<GenericDataTable");
    expect(source).toContain("function PlatformReadinessCards");
    expect(source).toContain("function BindingGapCards");
    expect(source).not.toContain("function MultiAccountReadinessPanel");
  });

  it("uses the Bindings-style Select dropdown for the status filter", () => {
    const adAccountsTable = source.slice(source.indexOf("function AdAccountsTable"), source.indexOf("function AdAccountSection"));
    expect(source).not.toContain('adAccountsStatusFilterLabel: "Фільтр статусу"');
    expect(source).not.toContain('adAccountsStatusFilterLabel: "Status filter"');
    expect(source).toContain('adAccountsStatusFilterLabel: "Статус"');
    expect(source).toContain('adAccountsStatusFilterLabel: "Status"');
    expect(adAccountsTable).toContain('{ui.adAccountsStatusFilterLabel}:');
    expect(adAccountsTable).toContain('<Select value={statusFilter}');
    expect(adAccountsTable).toContain('<SelectTrigger id="ads-connectors-ad-account-status-filter"');
    expect(adAccountsTable).toContain('<SelectItem value="active">{ui.adAccountsStatusFilterActive}</SelectItem>');
    expect(adAccountsTable).toContain('<SelectItem value="archived">{ui.adAccountsStatusFilterArchived}</SelectItem>');
    expect(adAccountsTable).toContain('<SelectItem value="all">{ui.adAccountsStatusFilterAll}</SelectItem>');
    expect(adAccountsTable).not.toContain('variant={statusFilter === "active" ? "secondary" : "ghost"}');
    expect(adAccountsTable).not.toContain('variant={statusFilter === "archived" ? "secondary" : "ghost"}');
    expect(adAccountsTable).not.toContain('variant={statusFilter === "all" ? "secondary" : "ghost"}');
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
    expect(source).toContain("return targets.length > 0 ? `${formatMetric(unbound)} ${label}: ${targets.join(\", \")}.` : `${formatMetric(unbound)} ${label}.`; ".trim());
  });

  it("uses non-production-safe operational readiness wording", () => {
    expect(source).toContain('operationalChecklist: "Операційна готовність"');
    expect(source).toContain('operationalChecklist: "Operational readiness"');
    expect(source).toContain('production_ready: "Ready for operation"');
    expect(source).not.toContain('operationalChecklist: "Production readiness"');
    expect(source).not.toContain('production_ready: "Ready for production"');
  });

  it("has friendly readiness, binding-gap, and detail labels in Ukrainian and English", () => {
    for (const label of [
      'partially_bound: "Частково привʼязано"',
      'accounts_discovered_no_bindings: "Акаунти знайдені, але не привʼязані"',
      'active_account_without_binding: "Потрібна привʼязка"',
      'accountNameLabel: "Назва акаунта"',
      'externalAccountIdLabel: "Зовнішній ID"',
      'gapTypeLabel: "Тип проблеми"',
      'messageLabel: "Повідомлення"',
      'partially_bound: "Partially linked"',
      'accounts_discovered_no_bindings: "Accounts found, not linked"',
      'active_account_without_binding: "Needs binding"',
      'accountNameLabel: "Account name"',
      'externalAccountIdLabel: "External ID"',
      'gapTypeLabel: "Gap type"',
      'messageLabel: "Message"',
    ]) {
      expect(source).toContain(label);
    }
  });

  it("maps common backend English messages to friendly localized display text", () => {
    expect(source).toContain("function formatFriendlyBackendText");
    expect(source).toContain('"active ad account has no active binding.": "Активний рекламний акаунт ще не привʼязаний."');
    expect(source).toContain('"active ad account has no active binding.": "Active ad account is not bound yet."');
    expect(source).toContain('"bind the account to the correct client, project, or funnel.": "Привʼяжіть акаунт до правильного клієнта, проєкту або воронки."');
    expect(source).toContain('"no platform binding action required.": "Дія не потрібна."');
    expect(source).toContain('"review and bind each active ad account to the correct agency scope.": "Review and bind active accounts to the correct scope."');
  });

  it("keeps readiness graceful and diagnostics-only raw payload", () => {
    expect(source).toContain("ui.readinessUnavailable");
    expect(source).toContain("data?.multiAccountReadiness?.payload");
  });
});
