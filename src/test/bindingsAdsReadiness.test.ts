import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const bindingsSource = readFileSync(resolve(process.cwd(), "src/pages/Bindings.tsx"), "utf8");
const appSource = readFileSync(resolve(process.cwd(), "src/App.tsx"), "utf8");
const sidebarSource = readFileSync(resolve(process.cwd(), "src/components/layout/AppSidebar.tsx"), "utf8");
const translationsSource = readFileSync(resolve(process.cwd(), "src/i18n/translations.ts"), "utf8");

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
    expect(bindingsSource).toContain("readiness={query.data?.adsMultiAccountReadiness}");
    expect(bindingsSource).toContain('<TabsContent value="ad-account"');
    expect(bindingsSource).toContain("<BindingGapsPanel");
    expect(bindingsSource).toContain('<TabsContent value="health"');
    expect(bindingsSource).toContain('t("bindingsAdsReadinessTechnicalTitle")');
    expect(bindingsSource).not.toContain('value="ads-readiness"');
    expect(bindingsSource).not.toContain('value="multi-account-readiness"');
    expect(appSource).not.toContain('path="/ads-readiness"');
    expect(sidebarSource).not.toContain('/ads-readiness');
  });

  it("keeps the readiness RPC but does not duplicate the full AdsConnectors metrics block in Overview", () => {
    expect(bindingsSource).toContain('const summary = readObject(payload, "summary");');
    expect(bindingsSource).toContain('readNumber(summary, "unbound_accounts")');
    expect(bindingsSource).not.toContain('readNumber(payload, "total_accounts")');
    expect(bindingsSource).not.toContain('title: t("bindingsReadinessTotalAccounts")');
    expect(bindingsSource).not.toContain('title: t("bindingsReadinessBoundAccounts")');
    expect(bindingsSource).not.toContain('title: t("bindingsReadinessUnboundAccounts")');
    expect(bindingsSource).not.toContain('title: t("bindingsReadinessNeedsAttention")');
  });

  it("renders compact actionable Overview copy for unbound ad accounts", () => {
    expect(bindingsSource).toContain('bindingsAdsNeedBindingSummary');
    expect(bindingsSource).toContain('bindingsAdsNeedBindingSummaryOne');
    expect(translationsSource).toContain('{count} accounts need binding: {platforms}.');
    expect(translationsSource).toContain('Повний стан підключень і синхронізації дивіться в Ads конекторах.');
  });

  it("renders friendly binding-gap cards above the existing binding workflow", () => {
    expect(bindingsSource).toContain('const gapRows = readArray(readiness.payload, "binding_gaps");');
    expect(bindingsSource).toContain('bindingsGapNeedsBinding');
    expect(bindingsSource).toContain('bindingsGapFriendlyMessage');
    expect(bindingsSource).toContain('bindingsGapNextStep');
    expect(bindingsSource).toContain('<BindingGapsPanel');
    const adAccountTabSource = bindingsSource.slice(bindingsSource.indexOf('<TabsContent value="ad-account"'), bindingsSource.indexOf('<TabsContent value="project-data"'));
    expect(adAccountTabSource.indexOf('<BindingGapsPanel')).toBeLessThan(adAccountTabSource.indexOf('<AdAccountsBusinessTable'));
    expect(adAccountTabSource.indexOf('<AdAccountsBusinessTable')).toBeLessThan(adAccountTabSource.indexOf('<AdminBindingForm'));
  });

  it("does not render backend gap codes or backend English messages in normal Bindings UI", () => {
    const normalUiSource = bindingsSource.slice(bindingsSource.indexOf('function AdsBindingReadinessSummary'), bindingsSource.indexOf('function ReadinessUnavailableNotice'));
    expect(normalUiSource).not.toContain('"gap_type"');
    expect(normalUiSource).not.toContain('active_account_without_binding');
    expect(normalUiSource).not.toContain('accounts_discovered_no_bindings');
    expect(normalUiSource).not.toContain('Active ad account has no active binding.');
    expect(translationsSource).toContain('Акаунти, які треба привʼязати');
    expect(translationsSource).toContain('Accounts that need binding');
  });

  it("keeps readiness unavailable state graceful and localized", () => {
    expect(bindingsSource).toContain("ReadinessUnavailableNotice");
    expect(bindingsSource).toContain('t("bindingsAdsReadinessUnavailable")');
    expect(translationsSource).toContain("Ad account binding readiness is temporarily unavailable");
  });

  it("keeps routes, sidebar, tabs, and backend contracts unchanged", () => {
    expect(bindingsSource).toContain('value="ad-account"');
    expect(bindingsSource).toContain('"binding-create-or-update"');
    expect(appSource).toContain('path="/bindings"');
    expect(sidebarSource).toContain('url: "/bindings"');
    expect(appSource).not.toContain('path="/ads-readiness"');
    expect(sidebarSource).not.toContain('/ads-readiness');
  });
});
