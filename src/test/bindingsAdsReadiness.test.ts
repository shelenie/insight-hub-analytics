import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const bindingsSource = readFileSync(
  resolve(process.cwd(), "src/pages/Bindings.tsx"),
  "utf8",
);
const badgeSource = readFileSync(
  resolve(process.cwd(), "src/components/ui/badge.tsx"),
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
const navigationStylesSource = readFileSync(
  resolve(process.cwd(), "src/components/common/navigationStyles.ts"),
  "utf8",
);
const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const sidebarSource = readFileSync(
  resolve(process.cwd(), "src/components/layout/AppSidebar.tsx"),
  "utf8",
);
const translationsSource = readFileSync(
  resolve(process.cwd(), "src/i18n/translations.ts"),
  "utf8",
);

describe("Bindings ads multi-account readiness", () => {
  it("calls the backend readiness RPC from the existing Bindings query", () => {
    expect(bindingsSource).toContain("readAdsMultiAccountReadiness()");
    expect(bindingsSource).toContain("supabase.rpc(");
    expect(bindingsSource).toContain('"build_ads_multi_account_readiness"');
    expect(bindingsSource).toContain("adsMultiAccountReadiness");
  });

  it("renders readiness only inside existing Bindings tabs without new navigation", () => {
    expect(bindingsSource).toContain('<TabsContent value="overview"');
    expect(bindingsSource).toContain("<AdsBindingReadinessSummary");
    expect(bindingsSource).toContain(
      "readiness={query.data?.adsMultiAccountReadiness}",
    );
    expect(bindingsSource).toContain('<TabsContent value="ad-account"');
    expect(bindingsSource).toContain("<BindingGapsPanel");
    expect(bindingsSource).toContain('<TabsContent value="health"');
    expect(bindingsSource).toContain('t("bindingsAdsReadinessTechnicalTitle")');
    expect(bindingsSource).not.toContain('value="ads-readiness"');
    expect(bindingsSource).not.toContain('value="multi-account-readiness"');
    expect(appSource).not.toContain('path="/ads-readiness"');
    expect(sidebarSource).not.toContain("/ads-readiness");
  });

  it("keeps the readiness RPC but does not duplicate the full AdsConnectors metrics block in Overview", () => {
    expect(bindingsSource).toContain(
      'const summary = readObject(payload, "summary");',
    );
    expect(bindingsSource).toContain('readNumber(summary, "unbound_accounts")');
    expect(bindingsSource).not.toContain(
      'readNumber(payload, "total_accounts")',
    );
    expect(bindingsSource).not.toContain(
      'title: t("bindingsReadinessTotalAccounts")',
    );
    expect(bindingsSource).not.toContain(
      'title: t("bindingsReadinessBoundAccounts")',
    );
    expect(bindingsSource).not.toContain(
      'title: t("bindingsReadinessUnboundAccounts")',
    );
    expect(bindingsSource).not.toContain(
      'title: t("bindingsReadinessNeedsAttention")',
    );
  });

  it("renders compact actionable Overview copy for unbound ad accounts", () => {
    expect(bindingsSource).toContain("bindingsAdsNeedBindingSummary");
    expect(bindingsSource).toContain("bindingsAdsNeedBindingSummaryOne");
    expect(translationsSource).toContain(
      "{count} accounts need binding: {platforms}.",
    );
    expect(translationsSource).toContain(
      "Повний стан підключень і синхронізації дивіться в Ads конекторах.",
    );
  });

  it("renders friendly binding-gap cards above the existing binding workflow", () => {
    expect(bindingsSource).toContain(
      'const gapRows = readArray(readiness.payload, "binding_gaps");',
    );
    expect(bindingsSource).toContain("bindingsGapNeedsBinding");
    expect(bindingsSource).toContain("bindingsGapFriendlyMessage");
    expect(bindingsSource).toContain("bindingsGapNextStep");
    expect(bindingsSource).toContain("bindingsGapBindAccountAction");
    expect(bindingsSource).toContain("bindingsGapAccountNotSelectable");
    expect(translationsSource).toContain("Привʼязати акаунт");
    expect(translationsSource).toContain("Bind account");
    expect(bindingsSource).toContain("<BindingGapsPanel");
    const adAccountTabSource = bindingsSource.slice(
      bindingsSource.indexOf('<TabsContent value="ad-account"'),
      bindingsSource.indexOf('<TabsContent value="project-data"'),
    );
    expect(adAccountTabSource.indexOf("<BindingGapsPanel")).toBeLessThan(
      adAccountTabSource.indexOf("<AdAccountsBusinessTable"),
    );
    expect(adAccountTabSource).not.toContain('type="ad_account"');
    expect(adAccountTabSource).toContain("manageAdAccountBinding");
  });

  it("uses shared amber warning badge and surface styles for needs-binding UI", () => {
    expect(badgeSource).toContain("warning:");
    expect(badgeSource).toContain(
      "border-amber-200 bg-amber-50 text-amber-900",
    );
    expect(badgeSource).toContain(
      "dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200",
    );
    expect(statusStylesSource).toContain("warning:");
    expect(statusStylesSource).toContain("border-amber-200 bg-amber-50/70");
    expect(statusStylesSource).toContain(
      "dark:border-amber-900/60 dark:bg-amber-950/20",
    );
    expect(bindingsSource).toContain("<CompactStatusSummaryCard");
    expect(bindingsSource).toContain("<OperationalStatusSurface");
    expect(bindingsSource).toContain('<StatusBadge tone="warning">');
    expect(bindingsSource).not.toContain("NEEDS_BINDING_WARNING_BADGE_CLASS");
    expect(bindingsSource).not.toContain("NEEDS_BINDING_WARNING_SURFACE_CLASS");
    expect(bindingsSource).toContain("unboundCount > 0");
    expect(bindingsSource).toContain(
      '<NeedsBindingWarningBadge label={t("bindingsGapNeedsBinding")} />',
    );
    expect(bindingsSource).not.toContain(
      '<Badge variant={unboundCount > 0 ? "outline" : "secondary"}>',
    );
    expect(bindingsSource).not.toContain(
      '<Badge variant="outline">{t("bindingsGapNeedsBinding")}</Badge>',
    );
  });

  it("uses the shared operational subnav trigger style instead of a local ADS constant", () => {
    expect(navigationStylesSource).toContain(
      "OPERATIONAL_SUBNAV_TRIGGER_CLASS",
    );
    expect(bindingsSource).toContain("OPERATIONAL_SUBNAV_TRIGGER_CLASS");
    expect(bindingsSource).not.toContain("const ADS_SUBNAV_TRIGGER_CLASS");
  });

  it("keeps warning state localized without backend codes in normal UI", () => {
    expect(translationsSource).toContain("Потрібна привʼязка");
    expect(translationsSource).toContain("Needs binding");
    const normalUiSource = bindingsSource.slice(
      bindingsSource.indexOf("function AdsBindingReadinessSummary"),
      bindingsSource.indexOf("function ReadinessUnavailableNotice"),
    );
    expect(normalUiSource).not.toContain("partially_bound");
    expect(normalUiSource).not.toContain("partially bound");
    expect(normalUiSource).not.toContain("active_account_without_binding");
    expect(normalUiSource).not.toContain("accounts_discovered_no_bindings");
  });

  it("opens the existing create drawer from matched binding-gap cards without inventing targets", () => {
    expect(bindingsSource).toContain("function findMatchingAdAccountId(");
    expect(bindingsSource).toContain(
      "asText(row.platform).toLowerCase() === normalizedPlatform",
    );
    expect(bindingsSource).toContain(
      "asText(row.external_account_id) === externalAccountId",
    );
    expect(bindingsSource).toContain("onBindAccount={(adAccountId) => {");
    expect(bindingsSource).toContain('setAdFormMode("create")');
    expect(bindingsSource).toContain("ad_account_id: adAccountId");
    expect(bindingsSource).toContain('client_id: ""');
    expect(bindingsSource).toContain('project_id: ""');
    expect(bindingsSource).toContain('funnel_id: ""');
    expect(bindingsSource).toContain("setAdFormOpen(true)");
  });

  it("keeps unmatched diagnostic gaps safe and non-submitting", () => {
    expect(bindingsSource).toMatch(
      /const actionDisabled =\s*!session \|\| !canManage \|\| !matchedAdAccountId/,
    );
    expect(bindingsSource).toContain("disabled={actionDisabled}");
    expect(bindingsSource).toContain(
      "if (matchedAdAccountId) onBindAccount(matchedAdAccountId);",
    );
    expect(translationsSource).toContain(
      "The account was found in diagnostics, but it is not selectable in the form yet. Refresh the page or check Ads Connectors.",
    );
    expect(bindingsSource).not.toContain("fake");
  });

  it("uses hardened direct RPC helpers for ad-account binding actions", () => {
    expect(bindingsSource).toContain("bindingsCreateAdAccountButton");
    expect(translationsSource).toContain("+ Привʼязати рекламний акаунт");
    expect(bindingsSource).toContain("setNormalAdForm(EMPTY_AD_FORM)");
    expect(bindingsSource).toContain("manageAdAccountBinding");
    expect(bindingsSource).toContain("replaceBindingId: sameScope ? null : normalAdForm.binding_id || null");
    expect(bindingsSource).not.toContain('binding_type: "ad_account"');
  });

  it("does not render backend gap codes or backend English messages in normal Bindings UI", () => {
    const normalUiSource = bindingsSource.slice(
      bindingsSource.indexOf("function AdsBindingReadinessSummary"),
      bindingsSource.indexOf("function ReadinessUnavailableNotice"),
    );
    expect(normalUiSource).not.toContain('"gap_type"');
    expect(normalUiSource).not.toContain("active_account_without_binding");
    expect(normalUiSource).not.toContain("accounts_discovered_no_bindings");
    expect(normalUiSource).not.toContain(
      "Active ad account has no active binding.",
    );
    expect(translationsSource).toContain("Акаунти, які треба привʼязати");
    expect(translationsSource).toContain("Accounts that need binding");
  });

  it("keeps readiness unavailable state graceful and localized", () => {
    expect(bindingsSource).toContain("ReadinessUnavailableNotice");
    expect(bindingsSource).toContain('t("bindingsAdsReadinessUnavailable")');
    expect(translationsSource).toContain(
      "Ad account binding readiness is temporarily unavailable",
    );
  });

  it("keeps routes, sidebar, tabs, and backend contracts unchanged", () => {
    expect(bindingsSource).toContain('value="ad-account"');
    expect(bindingsSource).toContain('"binding-create-or-update"');
    expect(appSource).toContain('path="/bindings"');
    expect(sidebarSource).toContain('url: "/bindings"');
    expect(appSource).not.toContain('path="/ads-readiness"');
    expect(sidebarSource).not.toContain("/ads-readiness");
  });
});
