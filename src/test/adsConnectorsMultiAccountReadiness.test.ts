import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/AdsConnectors.tsx"),
  "utf8",
);
const navigationStylesSource = readFileSync(
  resolve(process.cwd(), "src/components/common/navigationStyles.ts"),
  "utf8",
);
const operationalStatusSource = readFileSync(
  resolve(process.cwd(), "src/components/common/OperationalStatus.tsx"),
  "utf8",
);
const statusStylesSource = readFileSync(
  resolve(process.cwd(), "src/components/common/statusStyles.ts"),
  "utf8",
);
const adAccountsTab = source.slice(
  source.indexOf('<TabsContent value="ad-accounts"'),
  source.indexOf('<TabsContent value="sync"'),
);
const readinessSummary = source.slice(
  source.indexOf("function MultiAccountAdAccountsSummary"),
  source.indexOf("function CompactReadinessMetric"),
);

describe("AdsConnectors multi-account readiness UI", () => {
  it("loads backend multi-account readiness through the AdsConnectors query", () => {
    expect(source).toContain("readAdsMultiAccountReadiness()");
    expect(source).toMatch(
      /supabase\.rpc\(\s*"build_ads_multi_account_readiness"/,
    );
    expect(source).toContain("multiAccountReadiness");
    expect(source).toContain("snapshot");
  });

  it("uses shared operational subnav and status helpers instead of local status components", () => {
    expect(navigationStylesSource).toContain(
      "OPERATIONAL_SUBNAV_TRIGGER_CLASS",
    );
    expect(operationalStatusSource).toContain("function OperationalNotice");
    expect(operationalStatusSource).toContain("function StatusBadge");
    expect(operationalStatusSource).toContain(
      "function OperationalStatusSurface",
    );
    expect(statusStylesSource).toContain("info:");
    expect(statusStylesSource).toContain("border-sky-200 bg-sky-50/70");
    expect(source).toContain("OPERATIONAL_SUBNAV_TRIGGER_CLASS");
    expect(source).toContain("OperationalNotice");
    expect(source).toContain("StatusBadge");
    expect(source).toContain("OperationalStatusSurface");
    expect(source).not.toContain("const ADS_SUBNAV_TRIGGER_CLASS");
    expect(source).not.toContain("function StatusPill");
    expect(source).not.toContain("function WarningNotice");
    expect(source).not.toContain("function InfoNotice");
    expect(source).not.toContain("border-amber-200");
    expect(source).not.toContain("bg-amber-50");
    expect(source).not.toContain("border-sky-200");
    expect(source).not.toContain("bg-sky-50");
    expect(source).not.toContain("bg-emerald-50");
  });

  it("keeps readiness on existing tabs without adding route, tab, or navigation", () => {
    expect(source).toMatch(
      /<MultiAccountOverview\s+readiness=\{query\.data\?\.multiAccountReadiness\}/,
    );
    expect(source).toMatch(
      /<MultiAccountAdAccountsSummary\s+readiness=\{query\.data\?\.multiAccountReadiness\}/,
    );
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
    expect(
      adAccountsTab.indexOf("<MultiAccountAdAccountsSummary"),
    ).toBeLessThan(adAccountsTab.indexOf("<AdAccountsTable"));
    expect(source).toContain("function CompactReadinessMetric");
    expect(source).toContain(
      "grid shrink-0 grid-cols-2 gap-2 text-xs sm:grid-cols-4",
    );
  });

  it("derives Real accounts from active bindings, readiness accounts, and binding gaps", () => {
    expect(source).toContain("function buildRealPlatformAccountRows");
    expect(source).toContain('readArray(payload, "accounts")');
    expect(source).toContain('readArray(payload, "binding_gaps")');
    expect(source).toContain(
      "const key = `${platform.toLowerCase()}::${externalAccountId}`;",
    );
    expect(source).toMatch(
      /if \(\s*existing &&\s*isRealPlatformAccountBound\(existing\) &&\s*priority !== "binding"\s*\)/,
    );
    expect(source).toMatch(
      /<AdAccountsTable\s+data=\{query\.data\?\.adBindings\}\s+readiness=\{query\.data\?\.multiAccountReadiness\}/,
    );
  });

  it("renders unbound TikTok-style real platform accounts in Real accounts with Needs binding", () => {
    expect(source).toContain("external_account_name");
    expect(source).toContain('needsBinding: "Потрібна привʼязка"');
    expect(source).toContain('needsBinding: "Needs binding"');
    expect(source).toContain("unboundRealAccountHelper:");
    expect(source).toContain(
      "Акаунт існує на рекламній платформі, але ще не привʼязаний до клієнта, проєкту або воронки.",
    );
    expect(source).toContain(
      "This account exists on the ad platform but is not bound to a client, project, or funnel yet.",
    );
    expect(source).toContain("isRealPlatformAccountBound(row)");
  });

  it("keeps archived placeholder TikTok bindings out of main Real accounts unless tied to a real platform account", () => {
    expect(source).toContain(
      "!isTestOrArchivedAccount(row) && isActiveAccountBinding(row)",
    );
    expect(source).toMatch(
      /\.filter\(\(row\) =>\s*!hasTestBindingMarker\(row\)/,
    );
    expect(source).toContain("testRows");
    expect(source).toContain("visibleBindingRows");
    expect(source).toContain("filter(isTestOrArchivedAccount)");
    expect(source).toContain("{ui.testAccountsSection}");
  });

  it("renames the bound-only Overview KPI away from Ready accounts", () => {
    expect(source).toContain('adAccountsKpi: "Привʼязані акаунти"');
    expect(source).toContain('adAccountsKpi: "Bound accounts"');
    expect(source).not.toContain('adAccountsKpi: "Готові акаунти"');
    expect(source).not.toContain('adAccountsKpi: "Ready accounts"');
  });

  it("keeps details collapsed and replaces wide readiness tables with readable cards/lists", () => {
    expect(readinessSummary).toContain("<details");
    expect(readinessSummary).toContain("{ui.readinessDetailsTitle}");
    expect(readinessSummary).toContain(
      "<PlatformReadinessCards rows={platformRows} ui={ui} />",
    );
    expect(readinessSummary).toContain(
      "<BindingGapCards rows={gapRows} ui={ui} />",
    );
    expect(readinessSummary).not.toContain("<GenericDataTable");
    expect(source).toContain("function PlatformReadinessCards");
    expect(source).toContain("function BindingGapCards");
    expect(source).not.toContain("function MultiAccountReadinessPanel");
  });

  it("uses the Bindings-style Select dropdown for the status filter", () => {
    const adAccountsTable = source.slice(
      source.indexOf("function AdAccountsTable"),
      source.indexOf("function AdAccountSection"),
    );
    expect(source).not.toContain(
      'adAccountsStatusFilterLabel: "Фільтр статусу"',
    );
    expect(source).not.toContain(
      'adAccountsStatusFilterLabel: "Status filter"',
    );
    expect(source).toContain('adAccountsStatusFilterLabel: "Статус"');
    expect(source).toContain('adAccountsStatusFilterLabel: "Status"');
    expect(adAccountsTable).toContain("{ui.adAccountsStatusFilterLabel}:");
    expect(adAccountsTable).toMatch(/<Select\s+value=\{statusFilter\}/);
    expect(adAccountsTable).toContain("<SelectTrigger");
    expect(adAccountsTable).toContain(
      'id="ads-connectors-ad-account-status-filter"',
    );
    expect(adAccountsTable).toContain('<SelectItem value="active">');
    expect(adAccountsTable).toContain("{ui.adAccountsStatusFilterActive}");
    expect(adAccountsTable).toContain('<SelectItem value="archived">');
    expect(adAccountsTable).toContain("{ui.adAccountsStatusFilterArchived}");
    expect(adAccountsTable).toContain('<SelectItem value="all">');
    expect(adAccountsTable).toContain("{ui.adAccountsStatusFilterAll}");
    expect(adAccountsTable).not.toContain(
      'variant={statusFilter === "active" ? "secondary" : "ghost"}',
    );
    expect(adAccountsTable).not.toContain(
      'variant={statusFilter === "archived" ? "secondary" : "ghost"}',
    );
    expect(adAccountsTable).not.toContain(
      'variant={statusFilter === "all" ? "secondary" : "ghost"}',
    );
  });

  it("reads Overview counters from the nested summary payload", () => {
    expect(source).toContain('const summary = readObject(payload, "summary");');
    expect(source).toContain(
      'readNumber(summary, "total_accounts") ?? fallbackAccountCount',
    );
    expect(source).toContain('readNumber(summary, "bound_accounts")');
    expect(source).toContain('readNumber(summary, "unbound_accounts")');
    expect(source).toContain('readNumber(summary, "needs_attention_count")');
    expect(source).toContain(
      'const unbound = readNumber(summary, "unbound_accounts") ?? gaps.length;',
    );
    expect(source).not.toContain('readNumber(payload, "total_accounts")');
    expect(source).not.toContain('readNumber(payload, "bound_accounts")');
    expect(source).not.toContain('readNumber(payload, "unbound_accounts")');
    expect(source).not.toContain(
      'readNumber(payload, "needs_attention_count")',
    );
  });

  it("includes binding gaps and unbound accounts in Overview needs-attention logic", () => {
    expect(source).toMatch(
      /const bindingGapSummary = buildBindingGapSummary\(\s*data\?\.multiAccountReadiness,\s*ui,?\s*\)/,
    );
    expect(source).toContain(
      "if (bindingGapSummary) items.push(bindingGapSummary);",
    );
    expect(source).toContain(
      'readNumber(summary, "unbound_accounts") ?? gaps.length',
    );
    expect(source).toContain('readString(gap, "platform")');
    expect(source).toContain('readString(gap, "external_account_name")');
    expect(source).toContain('readString(gap, "external_account_id")');
    expect(source).toContain("targets.length > 0");
    expect(source).toContain("targets.join");
  });

  it("uses non-production-safe operational readiness wording", () => {
    expect(source).toContain('operationalChecklist: "Операційна готовність"');
    expect(source).toContain('operationalChecklist: "Operational readiness"');
    expect(source).toContain('production_ready: "Ready for operation"');
    expect(source).not.toContain(
      'operationalChecklist: "Production readiness"',
    );
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
      'partially_bound: "Partially bound"',
      'accounts_discovered_no_bindings: "Accounts found, not bound"',
      'active_account_without_binding: "Needs binding"',
      'accountNameLabel: "Account name"',
      'externalAccountIdLabel: "External ID"',
      'gapTypeLabel: "Gap type"',
      'messageLabel: "Message"',
    ]) {
      expect(source).toContain(label);
    }
  });



  it("keeps binding terminology bound instead of linked", () => {
    expect(source).toContain('partially_bound: "Partially bound"');
    expect(source).toContain('partially_bound: "Частково привʼязано"');
    expect(source).toContain('needsBinding: "Needs binding"');
    expect(source).not.toContain("Partially linked");
    expect(source).not.toContain("partially linked");
    expect(source).not.toContain("linked accounts");
    expect(source).not.toContain("link status");
  });

  it("renders Diagnostics as compact admin overview and keeps raw tables behind technical details", () => {
    const diagnosticsPanel = source.slice(
      source.indexOf("function DiagnosticsPanel"),
      source.indexOf("function IssuesPanel"),
    );
    expect(diagnosticsPanel).toContain("ui.diagnosticsIntroTitle");
    expect(diagnosticsPanel).toContain('className="space-y-4"');
    expect(diagnosticsPanel).toContain('className="grid gap-4 lg:grid-cols-2"');
    expect(diagnosticsPanel).not.toContain("xl:grid-cols-3");
    expect(diagnosticsPanel).toContain("<DiagnosticsSummaryCard title={ui.adsContext}");
    expect(diagnosticsPanel).toContain("function AdsContextSummaryCard");
    expect(diagnosticsPanel).toContain("lg:grid-cols-4");
    expect(diagnosticsPanel).toContain("function DiagnosticsListCard");
    expect(diagnosticsPanel).toContain("function DiagnosticsListItem");
    expect(diagnosticsPanel).toContain("data.rows.slice(0, 3)");
    expect(diagnosticsPanel).not.toContain("data.rows.slice(0, 5)");
    expect(diagnosticsPanel).toContain("<DeveloperDetails title={ui.rawDiagnosticsTitle}>");
    expect(diagnosticsPanel.indexOf("<DeveloperDetails title={ui.rawDiagnosticsTitle}>")).toBeLessThan(
      diagnosticsPanel.indexOf("<CompactDataSection"),
    );
  });

  it("uses polished diagnostics copy and friendly imported platform labels", () => {
    expect(source).toContain('diagnosticsIntroText: "Короткий адміністративний огляд рекламних даних, денних зрізів і можливих аномалій. Повні технічні дані залишаються в технічних деталях."');
    expect(source).toContain('diagnosticsIntroText: "A short admin overview of ads data, daily snapshots, and possible anomalies. Full technical payloads remain in technical details."');
    expect(source).toContain('adsContext: "Контекст рекламних даних"');
    expect(source).toContain('dailyContext: "Денні зрізи"');
    expect(source).toContain('adsContext: "Ads data context"');
    expect(source).toContain('dailyContext: "Daily snapshots"');
    expect(source).toContain('other: "Імпортовані дані"');
    expect(source).toContain('other: "Imported data"');
    expect(source).not.toContain("payload-и");
  });

  it("localizes Ukrainian diagnostics labels instead of showing English raw headers in normal UI", () => {
    for (const label of [
      'firstDate: "Перша дата"',
      'lastDate: "Остання дата"',
      'factRows: "Рядків фактів"',
      'spend: "Витрати"',
      'date: "Дата"',
      'level: "Рівень"',
      'accountId: "ID акаунта"',
      'campaign: "Кампанія"',
      'impressions: "Покази"',
      'clicks: "Кліки"',
      'first_date: "Перша дата"',
      'last_date: "Остання дата"',
      'fact_rows: "Рядків фактів"',
      'insight_date: "Дата"',
      'external_campaign_id: "ID кампанії"',
    ]) {
      expect(source).toContain(label);
    }
  });

  it("maps common backend English messages to friendly localized display text", () => {
    expect(source).toContain("function formatFriendlyBackendText");
    expect(source).toContain('"active ad account has no active binding.":');
    expect(source).toContain('"Активний рекламний акаунт ще не привʼязаний."');
    expect(source).toContain('"Active ad account is not bound yet."');
    expect(source).toContain(
      '"bind the account to the correct client, project, or funnel.":',
    );
    expect(source).toContain(
      '"Привʼяжіть акаунт до правильного клієнта, проєкту або воронки."',
    );
    expect(source).toContain('"no platform binding action required.":');
    expect(source).toContain('"Дія не потрібна."');
    expect(source).toContain(
      '"review and bind each active ad account to the correct agency scope.":',
    );
    expect(source).toContain(
      '"Review and bind active accounts to the correct scope."',
    );
  });

  it("keeps readiness graceful and diagnostics-only raw payload", () => {
    expect(source).toContain("ui.readinessUnavailable");
    expect(source).toContain("data?.multiAccountReadiness?.payload");
  });
});
