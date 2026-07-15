import { readFileSync } from "node:fs";

const sidebar = readFileSync("src/components/layout/AppSidebar.tsx", "utf8");
const dashboardLayout = readFileSync("src/components/layout/DashboardLayout.tsx", "utf8");
const onboarding = readFileSync("src/pages/Onboarding.tsx", "utf8");
const bindings = readFileSync("src/pages/Bindings.tsx", "utf8");
const ads = readFileSync("src/pages/AdsConnectors.tsx", "utf8");
const translations = readFileSync("src/i18n/translations.ts", "utf8");

describe("production UX polish", () => {
  it("keeps admin navigation ordered Onboarding, Bindings, Ads connectors, Telegram", () => {
    const adminStart = sidebar.indexOf('labelKey: "sidebarAdmin"');
    const adminEnd = sidebar.indexOf('labelKey: "sidebarAi"', adminStart);
    const admin = sidebar.slice(adminStart, adminEnd);
    expect(admin.indexOf('url: "/onboarding"')).toBeLessThan(admin.indexOf('url: "/bindings"'));
    expect(admin.indexOf('url: "/bindings"')).toBeLessThan(admin.indexOf('url: "/ads-connectors"'));
    expect(admin.indexOf('url: "/ads-connectors"')).toBeLessThan(admin.indexOf('url: "/alerts"'));

    const searchStart = dashboardLayout.indexOf('path: "/onboarding"');
    const search = dashboardLayout.slice(searchStart, dashboardLayout.indexOf('path: "/assistant"', searchStart));
    expect(search.indexOf('path: "/bindings"')).toBeLessThan(search.indexOf('path: "/ads-connectors"'));
    expect(search.indexOf('path: "/ads-connectors"')).toBeLessThan(search.indexOf('path: "/alerts"'));
  });

  it("keeps Onboarding active views and counts active-only", () => {
    expect(onboarding).toContain('useState<StatusFilter>("active")');
    expect(onboarding).toContain('filterHierarchyRows(hierarchyRows, "active")');
    expect(onboarding).toContain('filterByOperationalStatus(projects, "active")');
    expect(onboarding).toContain('filterByOperationalStatus(funnels, "active")');
    expect(translations).toContain('Активних записів немає. Створіть клієнта, проєкт і воронку');
  });

  it("does not count archived project bindings in Bindings overview or default project bindings", () => {
    expect(bindings).toContain('filterProjectBindings(filterRows(query.data?.projectDataBindings ?? []), "active", projectBindingStatusMaps)');
    expect(bindings).toContain('projectDataBindings: activeProjectDataBindings.length');
    expect(bindings).toContain('const [projectBindingStatusFilter, setProjectBindingStatusFilter] = useState<BindingStatusFilter>("active")');
    expect(translations).toContain('Активних прив’язок до проєктів немає');
  });

  it("imports the active status helper used by the Bindings overview", () => {
    expect(bindings).toContain("filterByOperationalStatus(query.data?.funnels ?? [], \"active\")");
    expect(bindings).toContain("filterByOperationalStatus,\n  filterProjectBindings");
  });

  it("renders production copy for bindings next action and unbound ads", () => {
    expect(bindings).toContain('bindingsOverviewNextActionTitle');
    expect(bindings).toContain('bindingsOverviewUnboundTitle');
    expect(bindings).toContain('readNumber(readObject(readinessPayload, "summary"), "unbound_accounts")');
    expect(translations).toContain('Потрібна дія: {count} рекламні акаунти');
  });

  it("polishes Ads Connectors copy without changing OAuth or sync function calls", () => {
    expect(ads).toContain('meta-oauth-start');
    expect(ads).toContain('google-ads-oauth-start');
    expect(ads).toContain('tiktok-oauth-start');
    expect(ads).toContain('ads-scheduled-sync-run');
    expect(ads).toContain('facebook-lead-ads-sync');
    expect(ads).toContain('Акаунт знайдений в Ads конекторах, але ще не прив’язаний');
    expect(ads).toContain('This account was found in Ads Connectors but is not bound to a client, project, or funnel yet. Missing spend/campaign data does not mean the account is fake.');
    expect(ads).toContain('unboundRealAccount ? null : <p className="text-xs text-muted-foreground">{accountNote}</p>');
    expect(ads).toContain('Lead Ads форми поки не знайдені. Вони з’являться');
    expect(ads).toContain('Окреме OAuth-підключення не потрібне');
  });
});
