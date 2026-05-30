import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";
import { DeveloperDetails } from "@/components/common/DeveloperDetails";
import { useI18n } from "@/i18n/I18nProvider";
import { cn } from "@/lib/utils";

type Primitive = string | number | boolean | null;
type Row = Record<string, Primitive | Primitive[] | Record<string, unknown>>;
type OptionalViewData = { rows: Row[]; unavailableReason: string | null };
type ConnectorKey = "meta" | "google" | "tiktok";
type ConnectorState = { loading: boolean; error: string | null };
type SyncRunState = { loading: boolean; error: string | null; success: string | null; details: Record<string, unknown> | null };
type PlatformConnectionState = { label: string; note?: string };
type UiLang = "uk" | "en";
type Copy = (typeof copy)[UiLang];

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const CONNECTOR_FN: Record<ConnectorKey, string> = {
  meta: "meta-oauth-start",
  google: "google-ads-oauth-start",
  tiktok: "tiktok-oauth-start",
};

const copy = {
  uk: {
    pageTitle: "Ads конектори",
    pageSubtitle: "Операційний стан підключень, рекламних акаунтів і синхронізації.",
    authRequired: "Потрібен вхід",
    signedOut: "Ви вийшли з системи. Увійдіть, щоб відкрити Ads конектори.",
    loadingTitle: "Завантаження Ads конекторів",
    loadingDescription: "Завантажуємо операційні дані…",
    loadError: "Не вдалося завантажити Ads конектори:",
    checkingAccess: "Перевіряємо права доступу…",
    noManageAccess: "У вас немає доступу до керування Ads конекторами.",
    roleUnavailable: "Роль робочого простору тимчасово недоступна. Дії вимкнено з міркувань безпеки.",
    tabs: {
      overview: "Огляд",
      connections: "Підключення",
      adAccounts: "Рекламні акаунти",
      scheduledSync: "Планова синхронізація",
      facebookLeadAds: "Facebook Lead Ads",
      adsHealth: "Стан реклами",
      issues: "Проблеми",
    },
    overviewTitle: "Огляд Ads конекторів",
    overviewSubtitle: "Стан підключень, рекламних акаунтів і готовності синхронізації.",
    connectionStatus: "Статус підключень",
    productionReadiness: "Готовність production",
    latestAdsHealth: "Останній стан реклами",
    backendFoundation: "Backend готовність",
    oauthStartCallback: "OAuth start/callback",
    mockSync: "Тестова синхронізація",
    realOAuth: "Реальне OAuth підключення",
    realAdAccount: "Реальний рекламний акаунт",
    realSyncData: "Реальні sync дані",
    foundationReady: "Готово за backend readiness",
    foundationPending: "Потребує перевірки readiness",
    oauthImplemented: "Start функції налаштовані; callback перевіряється після OAuth.",
    mockSyncPassed: "Тестова синхронізація пройдена",
    mockSyncUnknown: "Тестова синхронізація не підтверджена в поточних safe views",
    realOAuthActive: "Є ознаки активного реального connection",
    realOAuthPending: "Потрібно пройти реальний OAuth",
    realAccountConnected: "Є реальні записи привʼязок",
    realAccountPending: "Реальний рекламний акаунт ще не підтверджений",
    realSyncAvailable: "Дані синхронізації доступні",
    realSyncPending: "Зʼявляться після реальної синхронізації",
    noDataYet: "Немає даних",
    connectionsTitle: "Підключення OAuth",
    connectionsDescription: "Запуск безпечних OAuth потоків для рекламних платформ.",
    currentState: "Поточний стан",
    safety: "Безпека",
    connectedState: "Підключено",
    notConnectedState: "Не підключено",
    unknownConnectionState: "Стан невідомий",
    testBindingsNotReal: "Є test binding records, але це не real OAuth connection.",
    stateManagedThroughMeta: "Керується через Meta Ads",
    oauthMayCreate: "OAuth може створити реальний запис підключення. Синхронізація не запускається автоматично.",
    facebookLeadSafetyNote: "Facebook Lead Ads використовує Meta Ads підключення. Форми й ліди перевіряємо після Meta OAuth.",
    useTestAccounts: "Для тесту використовуйте тестові рекламні кабінети.",
    metaDescription: "Підключає Facebook / Instagram рекламний акаунт через Meta OAuth.",
    googleDescription: "Підключає Google Ads акаунт через Google OAuth.",
    tiktokDescription: "Підключає TikTok Business / Advertiser акаунт через TikTok OAuth.",
    facebookLeadDescription: "Використовує Meta Ads підключення. Окремий OAuth тут не потрібен.",
    connectMeta: "Підключити Meta Ads",
    connectGoogle: "Підключити Google Ads",
    connectTiktok: "Підключити TikTok Ads",
    managedThroughMeta: "Керується через Meta Ads",
    openingOauth: "Відкриваємо OAuth…",
    oauthUrlMissing: "OAuth URL не повернувся з безпечної Edge Function.",
    adAccountsTitle: "Рекламні акаунти",
    adAccountsDescription: "Binding records з safe view. Placeholder записи не означають реальне підключення.",
    adAccountsExplain: "Ці записи можуть бути тестовими binding records. Реальне підключення перевіряємо після OAuth.",
    testPlaceholder: "Тестовий / placeholder акаунт",
    adAccountsEmpty: "Рекламні акаунти поки не привʼязані.",
    scheduledTitle: "Планова синхронізація",
    scheduledDescription: "Правила запуску синхронізацій і поточна черга.",
    scheduledWarning: "Не запускайте sync, доки не перевірене реальне OAuth-підключення.",
    syncRules: "Правила синхронізації",
    syncDue: "Поточна черга",
    syncRulesEmpty: "Правил планової синхронізації поки немає.",
    syncDueEmpty: "Немає синхронізацій, які потрібно запускати зараз.",
    runSyncCheck: "Запустити sync вручну",
    runningSync: "Запускаємо sync…",
    syncSubmitNote: "Натискання викликає наявну безпечну sync-функцію лише вручну.",
    syncSuccess: "Ручний sync надіслано.",
    syncFailedToastTitle: "Sync не запустився",
    syncSubmittedToastTitle: "Sync надіслано",
    syncError: "Синхронізація завершилась з помилкою.",
    detailsDebug: "Технічні деталі доступні в developer details.",
    fbTitle: "Facebook Lead Ads",
    fbDescription: "Стан форм, лідів, webhook подій і sync запусків.",
    healthStatus: "Стан",
    activeForms: "Активні форми",
    formsNeedMapping: "Форми без mapping",
    leadsLast24h: "Ліди за 24 год",
    failedLeads: "Ліди з помилками",
    unprocessedWebhookEvents: "Необроблені webhook events",
    failedSyncsLast24h: "Помилки sync за 24 год",
    formsTitle: "Форми",
    leadsTitle: "Останні ліди",
    syncRunsTitle: "Останні запуски синхронізації",
    fbFormsEmpty: "Форми Facebook Lead Ads поки не знайдені. Перевіримо після Meta OAuth підключення.",
    fbLeadsEmpty: "Останніх Facebook лідів поки немає.",
    fbSyncRunsEmpty: "Запусків синхронізації Facebook Lead Ads поки немає.",
    adsHealthTitle: "Ads health",
    adsHealthDescription: "Контекст реклами для AI і операційного моніторингу.",
    adsContextUnavailable: "Контекст реклами поки недоступний.",
    dailyContextAfterSync: "Щоденний контекст реклами зʼявиться після реальної синхронізації рекламних даних.",
    anomaliesAfterPerformance: "Кандидати на аномалії зʼявляться після накопичення performance-даних.",
    summaryContext: "Підсумковий контекст",
    dailyContext: "Щоденний контекст реклами",
    anomalyCandidates: "Кандидати на аномалії",
    issuesTitle: "Проблеми / діагностика",
    issuesDescription: "Реальні помилки safe views і OAuth дій залишаються видимими.",
    noIssues: "Активних проблем у доступних safe views не знайдено.",
    readinessTimeoutLabel: "Readiness query timeout",
    readinessTimeoutDescription: "Один із readiness-запитів перевищив ліміт часу. Це не означає, що Ads OAuth зламаний, але потребує окремої backend-оптимізації.",
    technicalDetails: "Технічні деталі",
    oauthIssue: "OAuth помилка",
    sectionUnavailable: "Розділ тимчасово недоступний.",
    dataUnavailable: "Дані тимчасово недоступні.",
    emptyFields: "Дані є, але немає полів для відображення.",
    yes: "Так",
    no: "Ні",
    statusLabels: {
      ads_setup_required: "Потрібно підключити рекламні акаунти",
      healthy: "Все працює",
      unavailable: "Немає даних",
      no_active_connections: "Немає активних real OAuth підключень",
      active: "Активно",
      inactive: "Неактивно",
      ready: "Готово",
      ok: "Готово",
      success: "Успішно",
      pending: "Очікує",
      failed: "Помилка",
      error: "Помилка",
    },
    columnLabels: {
      platform: "Платформа",
      external_account_id: "ID рекламного акаунта",
      ad_account_name: "Рекламний акаунт",
      client_name: "Клієнт",
      project_name: "Проєкт",
      funnel_name: "Воронка",
      mapping_status: "Статус мапінгу",
      binding_status: "Статус привʼязки",
      confidence: "Впевненість",
      cadence: "Частота",
      schedule: "Розклад",
      status: "Статус",
      last_run_at: "Останній запуск",
      next_run_at: "Наступний запуск",
      updated_at: "Оновлено",
      due_status: "Статус черги",
      is_due: "Потрібен запуск",
      form_name: "Форма",
      form_id: "Form ID",
      leads_count: "Ліди",
      created_at: "Створено",
      error_message: "Помилка",
      health_status: "Стан",
      active_forms: "Активні форми",
      forms_needing_mapping: "Форми без mapping",
      leads_last_24h: "Ліди за 24 год",
      failed_leads: "Ліди з помилками",
      unprocessed_webhook_events: "Необроблені webhook events",
      failed_syncs_last_24h: "Помилки sync за 24 год",
    },
  },
  en: {
    pageTitle: "Ads connectors",
    pageSubtitle: "Operational status for connections, ad accounts, and sync.",
    authRequired: "Sign-in required",
    signedOut: "You are signed out. Sign in to access Ads connectors.",
    loadingTitle: "Loading Ads connectors",
    loadingDescription: "Loading operational data…",
    loadError: "Could not load Ads connectors:",
    checkingAccess: "Checking access…",
    noManageAccess: "You do not have access to manage Ads connectors.",
    roleUnavailable: "Workspace role is temporarily unavailable. Actions are disabled for safety.",
    tabs: {
      overview: "Overview",
      connections: "Connections",
      adAccounts: "Ad accounts",
      scheduledSync: "Scheduled sync",
      facebookLeadAds: "Facebook Lead Ads",
      adsHealth: "Ads health",
      issues: "Issues",
    },
    overviewTitle: "Ads connectors overview",
    overviewSubtitle: "Connection, ad account, and sync readiness status.",
    connectionStatus: "Connection status",
    productionReadiness: "Готовність production",
    latestAdsHealth: "Latest ads health",
    backendFoundation: "Backend готовність",
    oauthStartCallback: "OAuth start/callback",
    mockSync: "Тестова синхронізація",
    realOAuth: "Real OAuth connection",
    realAdAccount: "Real ad account",
    realSyncData: "Real sync data",
    foundationReady: "Ready by backend readiness",
    foundationPending: "Needs readiness verification",
    oauthImplemented: "Start functions are configured; callback is verified after OAuth.",
    mockSyncPassed: "Mock sync passed",
    mockSyncUnknown: "Mock sync is not confirmed in current safe views",
    realOAuthActive: "There are signs of an active real connection",
    realOAuthPending: "Real OAuth still needs to be completed",
    realAccountConnected: "Real binding records are present",
    realAccountPending: "Real ad account is not verified yet",
    realSyncAvailable: "Sync data is available",
    realSyncPending: "Appears after real sync runs",
    noDataYet: "No data yet",
    connectionsTitle: "OAuth connections",
    connectionsDescription: "Start secure OAuth flows for advertising platforms.",
    currentState: "Current state",
    safety: "Safety",
    connectedState: "Connected",
    notConnectedState: "Not connected",
    unknownConnectionState: "Unknown status",
    testBindingsNotReal: "Test binding records exist, but this is not a real OAuth connection.",
    stateManagedThroughMeta: "Managed through Meta Ads",
    oauthMayCreate: "OAuth may create a real connection record. Sync does not start automatically.",
    facebookLeadSafetyNote: "Facebook Lead Ads uses the Meta Ads connection. Forms and leads are checked after Meta OAuth.",
    useTestAccounts: "Use test ad accounts for testing.",
    metaDescription: "Connects a Facebook / Instagram ad account through Meta OAuth.",
    googleDescription: "Connects a Google Ads account through Google OAuth.",
    tiktokDescription: "Connects a TikTok Business / Advertiser account through TikTok OAuth.",
    facebookLeadDescription: "Uses the Meta Ads connection. Separate OAuth is not required here.",
    connectMeta: "Connect Meta Ads",
    connectGoogle: "Connect Google Ads",
    connectTiktok: "Connect TikTok Ads",
    managedThroughMeta: "Managed through Meta Ads",
    openingOauth: "Opening OAuth…",
    oauthUrlMissing: "OAuth URL was not returned by the secure Edge Function.",
    adAccountsTitle: "Ad accounts",
    adAccountsDescription: "Binding records from a safe view. Placeholder rows do not mean a real connection.",
    adAccountsExplain: "These records may be test binding records. Real connection is verified after OAuth.",
    testPlaceholder: "Test / placeholder account",
    adAccountsEmpty: "Ad accounts are not bound yet.",
    scheduledTitle: "Scheduled sync",
    scheduledDescription: "Sync rules and current queue.",
    scheduledWarning: "Do not run sync until real OAuth connection is verified.",
    syncRules: "Sync rules",
    syncDue: "Current queue",
    syncRulesEmpty: "No scheduled sync rules yet.",
    syncDueEmpty: "No syncs need to run right now.",
    runSyncCheck: "Run manual sync",
    runningSync: "Running sync…",
    syncSubmitNote: "Clicking calls the existing secure sync function only when submitted manually.",
    syncSuccess: "Manual sync submitted.",
    syncFailedToastTitle: "Sync failed",
    syncSubmittedToastTitle: "Sync submitted",
    syncError: "Sync finished with an error.",
    detailsDebug: "Technical details are available in developer details.",
    fbTitle: "Facebook Lead Ads",
    fbDescription: "Forms, leads, webhook events, and sync run status.",
    healthStatus: "Health status",
    activeForms: "Active forms",
    formsNeedMapping: "Forms needing mapping",
    leadsLast24h: "Leads last 24h",
    failedLeads: "Failed leads",
    unprocessedWebhookEvents: "Unprocessed webhook events",
    failedSyncsLast24h: "Failed syncs last 24h",
    formsTitle: "Forms",
    leadsTitle: "Recent leads",
    syncRunsTitle: "Recent sync runs",
    fbFormsEmpty: "No Facebook Lead Ads forms found yet. Check after Meta OAuth connection.",
    fbLeadsEmpty: "No recent Facebook leads yet.",
    fbSyncRunsEmpty: "No recent Facebook Lead Ads sync runs yet.",
    adsHealthTitle: "Ads health",
    adsHealthDescription: "Ads context for AI and operational monitoring.",
    adsContextUnavailable: "Ads context is not available yet.",
    dailyContextAfterSync: "Daily ads context will appear after real ad data sync.",
    anomaliesAfterPerformance: "Anomaly candidates will appear after performance data is available.",
    summaryContext: "Summary context",
    dailyContext: "Daily ads context",
    anomalyCandidates: "Anomaly candidates",
    issuesTitle: "Issues / diagnostics",
    issuesDescription: "Real safe-view and OAuth action errors remain visible.",
    noIssues: "No active issues found in available safe views.",
    readinessTimeoutLabel: "Readiness query timeout",
    readinessTimeoutDescription: "One readiness query exceeded the time limit. This does not mean Ads OAuth is broken, but needs separate backend optimization.",
    technicalDetails: "Technical details",
    oauthIssue: "OAuth error",
    sectionUnavailable: "This section is temporarily unavailable.",
    dataUnavailable: "Data is temporarily unavailable.",
    emptyFields: "Data exists, but there are no fields to display.",
    yes: "Yes",
    no: "No",
    statusLabels: {
      ads_setup_required: "Ad accounts need to be connected",
      healthy: "Healthy",
      unavailable: "No data yet",
      no_active_connections: "No active real OAuth connections",
      active: "Active",
      inactive: "Inactive",
      ready: "Ready",
      ok: "Ready",
      success: "Success",
      pending: "Pending",
      failed: "Failed",
      error: "Error",
    },
    columnLabels: {
      platform: "Platform",
      external_account_id: "External account ID",
      ad_account_name: "Ad account",
      client_name: "Client",
      project_name: "Project",
      funnel_name: "Funnel",
      mapping_status: "Mapping status",
      binding_status: "Binding status",
      confidence: "Confidence",
      cadence: "Cadence",
      schedule: "Schedule",
      status: "Status",
      last_run_at: "Last run",
      next_run_at: "Next run",
      updated_at: "Updated",
      due_status: "Queue status",
      is_due: "Due",
      form_name: "Form",
      form_id: "Form ID",
      leads_count: "Leads",
      created_at: "Created",
      error_message: "Error",
      health_status: "Health status",
      active_forms: "Active forms",
      forms_needing_mapping: "Forms needing mapping",
      leads_last_24h: "Leads last 24h",
      failed_leads: "Failed leads",
      unprocessed_webhook_events: "Unprocessed webhook events",
      failed_syncs_last_24h: "Failed syncs last 24h",
    },
  },
} as const;

export default function AdsConnectors() {
  const { session } = useAuth();
  const { lang } = useI18n();
  const ui = copy[lang];
  const queryClient = useQueryClient();
  const { capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);
  const canManage = capabilities.can_manage_bindings;
  const [connectorState, setConnectorState] = useState<Record<ConnectorKey, ConnectorState>>({
    meta: { loading: false, error: null },
    google: { loading: false, error: null },
    tiktok: { loading: false, error: null },
  });

  const [syncRunState, setSyncRunState] = useState<SyncRunState>({
    loading: false,
    error: null,
    success: null,
    details: null,
  });

  const query = useQuery({
    queryKey: ["ads-connectors-workspace", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const [readiness, snapshot, adBindings, syncRules, syncDue, adsSummary, adsDaily, adsAnomalies, fbHealth, fbForms, fbLeads, fbSyncRuns] = await Promise.all([
        readOptionalView("v_production_backend_readiness"),
        readOptionalView("v_production_backend_snapshot"),
        readOptionalView("v_ad_account_bindings"),
        readOptionalView("v_ads_scheduled_sync_rules"),
        readOptionalView("v_ads_scheduled_sync_due"),
        readOptionalView("v_ai_ads_summary_context"),
        readOptionalView("v_ai_ads_daily_context"),
        readOptionalView("v_ai_ads_anomaly_candidates"),
        readOptionalView("v_facebook_lead_ads_health"),
        readOptionalView("v_facebook_lead_forms"),
        readOptionalView("v_facebook_leads_recent"),
        readOptionalView("v_facebook_lead_sync_runs_recent"),
      ]);

      return { readiness, snapshot, adBindings, syncRules, syncDue, adsSummary, adsDaily, adsAnomalies, fbHealth, fbForms, fbLeads, fbSyncRuns };
    },
  });

  const overview = useMemo(() => ({
    readiness: query.data?.readiness.rows[0],
    snapshot: query.data?.snapshot.rows[0],
    adsHealth: query.data?.adsSummary.rows[0] ?? query.data?.adsAnomalies.rows[0],
  }), [query.data]);

  const realAccountRows = useMemo(
    () => (query.data?.adBindings.rows ?? []).filter((row) => !isPlaceholderAccount(row)),
    [query.data?.adBindings.rows],
  );

  const realSyncDataAvailable = Boolean(
    (query.data?.adsSummary.rows.length ?? 0) > 0 ||
    (query.data?.adsDaily.rows.length ?? 0) > 0 ||
    (query.data?.fbSyncRuns.rows.length ?? 0) > 0,
  );

  const platformConnectionStates = useMemo(() => ({
    meta: getPlatformConnectionState("meta", query.data?.adBindings, ui),
    google: getPlatformConnectionState("google", query.data?.adBindings, ui),
    tiktok: getPlatformConnectionState("tiktok", query.data?.adBindings, ui),
  }), [query.data?.adBindings, ui]);

  const runScheduledSync = async () => {
    setSyncRunState({ loading: true, error: null, success: null, details: null });
    const { data, error } = await supabase.functions.invoke("ads-scheduled-sync-run", {
      body: { workspace_id: WORKSPACE_ID },
    });

    if (error) {
      setSyncRunState({ loading: false, error: error.message, success: null, details: null });
      toast({ title: ui.syncFailedToastTitle, description: error.message, variant: "destructive" });
      return;
    }

    const details = toObject(data);
    const message =
      readString(details, "message") ??
      readString(details, "status") ??
      "Scheduled sync submitted securely.";

    setSyncRunState({ loading: false, error: null, success: message, details });
    toast({ title: ui.syncSubmittedToastTitle, description: message });

    await Promise.all([
      query.refetch(),
      queryClient.invalidateQueries({ queryKey: ["ads-connectors-workspace", WORKSPACE_ID] }),
      queryClient.invalidateQueries({ queryKey: ["ads-health"] }),
      queryClient.invalidateQueries({ queryKey: ["scheduled-sync"] }),
      queryClient.invalidateQueries({ queryKey: ["ads-readiness"] }),
    ]);
  };

  const connect = async (connector: ConnectorKey) => {
    setConnectorState((prev) => ({ ...prev, [connector]: { loading: true, error: null } }));
    const { data, error } = await supabase.functions.invoke(CONNECTOR_FN[connector], {
      body: { workspace_id: WORKSPACE_ID },
    });

    if (error) {
      setConnectorState((prev) => ({ ...prev, [connector]: { loading: false, error: error.message } }));
      return;
    }

    const payload = toObject(data);
    const url = readString(payload, "authorization_url") ?? readString(payload, "authorizationUrl") ?? readString(payload, "url");
    if (!url) {
      setConnectorState((prev) => ({ ...prev, [connector]: { loading: false, error: ui.oauthUrlMissing } }));
      return;
    }

    window.location.href = url;
  };

  const connectionStatus = friendlyStatus(readString(overview.snapshot, "ads_connector_status"), ui);
  const productionStatus = friendlyStatus(
    readString(overview.snapshot, "production_backend_status") ?? readString(overview.readiness, "production_backend_status"),
    ui,
  );
  const latestAdsHealth = friendlyStatus(readLikelyStatus(overview.adsHealth), ui);
  const connectionRaw = readString(overview.snapshot, "ads_connector_status");
  const productionRaw = readString(overview.snapshot, "production_backend_status") ?? readString(overview.readiness, "production_backend_status");
  const mockSyncPassed = rowContainsValue(overview.readiness, "mock", "passed") || rowContainsValue(overview.snapshot, "mock", "passed");
  const hasRealOAuth = connectionRaw === "active" || connectionRaw === "healthy" || connectionRaw === "connected" || realAccountRows.length > 0;

  return (
    <DashboardLayout title={ui.pageTitle} subtitle={ui.pageSubtitle}>
      {!session ? (
        <SectionCard title={ui.pageTitle} description={ui.authRequired}>
          <p className="text-sm text-muted-foreground">{ui.signedOut}</p>
        </SectionCard>
      ) : query.isLoading ? (
        <SectionCard title={ui.loadingTitle} description={ui.loadingDescription}>
          <p className="text-sm text-muted-foreground">{ui.loadingDescription}</p>
        </SectionCard>
      ) : query.error ? (
        <SectionCard title={ui.pageTitle} description={ui.dataUnavailable}>
          <p className="text-sm text-destructive">{ui.loadError} {query.error.message}</p>
        </SectionCard>
      ) : (
        <>
          {roleLoading ? <p className="text-xs text-muted-foreground">{ui.checkingAccess}</p> : null}
          {!roleLoading && !canManage ? <p className="text-xs text-muted-foreground">{ui.noManageAccess}</p> : null}
          {!roleLoading && roleError ? <p className="text-xs text-muted-foreground">{ui.roleUnavailable}</p> : null}
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">{ui.tabs.overview}</TabsTrigger>
              <TabsTrigger value="connections">{ui.tabs.connections}</TabsTrigger>
              <TabsTrigger value="ad-accounts">{ui.tabs.adAccounts}</TabsTrigger>
              <TabsTrigger value="scheduled-sync">{ui.tabs.scheduledSync}</TabsTrigger>
              <TabsTrigger value="facebook-lead-ads">{ui.tabs.facebookLeadAds}</TabsTrigger>
              <TabsTrigger value="ads-health">{ui.tabs.adsHealth}</TabsTrigger>
              <TabsTrigger value="recent-issues">{ui.tabs.issues}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <SectionCard title={ui.overviewTitle} description={ui.overviewSubtitle} accent>
                <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3">
                  <StatusCard label={ui.connectionStatus} value={connectionStatus} raw={connectionRaw} ui={ui} />
                  <StatusCard label={ui.productionReadiness} value={productionStatus} raw={productionRaw} ui={ui} />
                  <StatusCard label={ui.latestAdsHealth} value={latestAdsHealth} raw={readLikelyStatus(overview.adsHealth)} ui={ui} />
                </div>
                <div className="mt-4 grid gap-2 md:grid-cols-2 lg:grid-cols-3">
                  <ReadinessStep label={ui.backendFoundation} value={isReadyValue(productionRaw) ? ui.foundationReady : ui.foundationPending} tone={isReadyValue(productionRaw) ? "success" : "muted"} />
                  <ReadinessStep label={ui.oauthStartCallback} value={ui.oauthImplemented} tone="success" />
                  <ReadinessStep label={ui.mockSync} value={mockSyncPassed ? ui.mockSyncPassed : ui.mockSyncUnknown} tone={mockSyncPassed ? "success" : "muted"} />
                  <ReadinessStep label={ui.realOAuth} value={hasRealOAuth ? ui.realOAuthActive : ui.realOAuthPending} tone={hasRealOAuth ? "success" : "warning"} />
                  <ReadinessStep label={ui.realAdAccount} value={realAccountRows.length > 0 ? ui.realAccountConnected : ui.realAccountPending} tone={realAccountRows.length > 0 ? "success" : "warning"} />
                  <ReadinessStep label={ui.realSyncData} value={realSyncDataAvailable ? ui.realSyncAvailable : ui.realSyncPending} tone={realSyncDataAvailable ? "success" : "muted"} />
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="connections">
              <SectionCard title={ui.connectionsTitle} description={ui.connectionsDescription}>
                <div className="grid gap-3 md:grid-cols-2">
                  <ConnectorCard
                    name="Meta Ads"
                    description={ui.metaDescription}
                    buttonText={ui.connectMeta}
                    stateText={platformConnectionStates.meta.label}
                    helperNote={platformConnectionStates.meta.note}
                    state={connectorState.meta}
                    onConnect={() => void connect("meta")}
                    canManage={canManage}
                    ui={ui}
                  />
                  <ConnectorCard
                    name="Google Ads"
                    description={ui.googleDescription}
                    buttonText={ui.connectGoogle}
                    stateText={platformConnectionStates.google.label}
                    helperNote={platformConnectionStates.google.note}
                    state={connectorState.google}
                    onConnect={() => void connect("google")}
                    canManage={canManage}
                    ui={ui}
                  />
                  <ConnectorCard
                    name="TikTok Ads"
                    description={ui.tiktokDescription}
                    buttonText={ui.connectTiktok}
                    stateText={platformConnectionStates.tiktok.label}
                    helperNote={platformConnectionStates.tiktok.note}
                    state={connectorState.tiktok}
                    onConnect={() => void connect("tiktok")}
                    canManage={canManage}
                    ui={ui}
                  />
                  <div className="rounded-lg border border-border/70 bg-card/60 p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">Facebook Lead Ads</p>
                        <p className="mt-1 text-muted-foreground">{ui.facebookLeadDescription}</p>
                      </div>
                      <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{ui.stateManagedThroughMeta}</span>
                    </div>
                    <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{ui.safety}</p>
                      <p className="mt-1">{ui.facebookLeadSafetyNote}</p>
                    </div>
                    <Button type="button" className="mt-3" variant="secondary" disabled>{ui.managedThroughMeta}</Button>
                  </div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="ad-accounts">
              <SectionCard title={ui.adAccountsTitle} description={ui.adAccountsDescription}>
                <p className="mb-3 rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                  {ui.adAccountsExplain}
                </p>
                <AdAccountsTable data={query.data?.adBindings} ui={ui} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="scheduled-sync">
              <SectionCard title={ui.scheduledTitle} description={ui.scheduledDescription}>
                <div className="space-y-4">
                  <p className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
                    {ui.scheduledWarning}
                  </p>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <CompactDataSection title={ui.syncRules} data={query.data?.syncRules} columns={["platform", "cadence", "schedule", "status", "last_run_at", "next_run_at", "updated_at"]} emptyText={ui.syncRulesEmpty} ui={ui} />
                    <CompactDataSection title={ui.syncDue} data={query.data?.syncDue} columns={["platform", "status", "last_run_at", "next_run_at", "due_status", "is_due"]} emptyText={ui.syncDueEmpty} ui={ui} />
                  </div>
                  <div className="rounded-lg border border-dashed border-border/70 bg-muted/30 p-4">
                    <Button type="button" onClick={() => void runScheduledSync()} disabled={!session || !canManage || !capabilities.can_run_ads_scheduled_sync || syncRunState.loading}>
                      {syncRunState.loading ? ui.runningSync : ui.runSyncCheck}
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">{ui.syncSubmitNote}</p>
                    {syncRunState.success && <p className="mt-2 text-xs text-emerald-700">{ui.syncSuccess}</p>}
                    {syncRunState.error && <p className="mt-2 text-xs text-destructive">{ui.syncError} {syncRunState.error}</p>}
                    {syncRunState.details ? <p className="mt-2 text-xs text-muted-foreground">{ui.detailsDebug}</p> : null}
                    <DeveloperDetails>{syncRunState.details ? <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-xs text-muted-foreground">{JSON.stringify(syncRunState.details, null, 2)}</pre> : null}</DeveloperDetails>
                  </div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="facebook-lead-ads">
              <SectionCard title={ui.fbTitle} description={ui.fbDescription}>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  <MetricCard label={ui.healthStatus} value={friendlyStatus(readLikelyStatus(query.data?.fbHealth.rows[0]), ui)} />
                  <MetricCard label={ui.activeForms} value={formatMetric(findMetric(query.data?.fbHealth.rows, ["active_forms", "active_forms_count", "forms_active"]))} />
                  <MetricCard label={ui.formsNeedMapping} value={formatMetric(findMetric(query.data?.fbHealth.rows, ["forms_needing_mapping", "forms_need_mapping", "unmapped_forms"]))} />
                  <MetricCard label={ui.leadsLast24h} value={formatMetric(findMetric(query.data?.fbHealth.rows, ["leads_last_24h", "leads_24h", "recent_leads_24h"]))} />
                  <MetricCard label={ui.failedLeads} value={formatMetric(findMetric(query.data?.fbHealth.rows, ["failed_leads", "failed_leads_count"]))} />
                  <MetricCard label={ui.unprocessedWebhookEvents} value={formatMetric(findMetric(query.data?.fbHealth.rows, ["unprocessed_webhook_events", "pending_webhook_events"]))} />
                  <MetricCard label={ui.failedSyncsLast24h} value={formatMetric(findMetric(query.data?.fbHealth.rows, ["failed_syncs_last_24h", "failed_sync_runs_last_24h"]))} />
                </div>
                <div className="mt-4 space-y-4">
                  <CompactDataSection title={ui.formsTitle} data={query.data?.fbForms} columns={["form_name", "form_id", "status", "mapping_status", "leads_count", "updated_at"]} emptyText={ui.fbFormsEmpty} ui={ui} />
                  <CompactDataSection title={ui.leadsTitle} data={query.data?.fbLeads} columns={["created_at", "status", "form_name", "client_name", "project_name", "error_message"]} emptyText={ui.fbLeadsEmpty} ui={ui} />
                  <CompactDataSection title={ui.syncRunsTitle} data={query.data?.fbSyncRuns} columns={["created_at", "status", "last_run_at", "updated_at", "error_message"]} emptyText={ui.fbSyncRunsEmpty} ui={ui} />
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="ads-health">
              <SectionCard title={ui.adsHealthTitle} description={ui.adsHealthDescription}>
                {(query.data?.adsSummary.rows.length ?? 0) === 0 && (query.data?.adsDaily.rows.length ?? 0) === 0 && (query.data?.adsAnomalies.rows.length ?? 0) === 0 ? (
                  <div className="rounded-lg border border-border/70 bg-muted/30 p-4">
                    <p className="font-medium">{ui.adsContextUnavailable}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{ui.dailyContextAfterSync}</p>
                    <p className="mt-1 text-sm text-muted-foreground">{ui.anomaliesAfterPerformance}</p>
                  </div>
                ) : null}
                <div className="mt-4 space-y-4">
                  <CompactDataSection title={ui.summaryContext} data={query.data?.adsSummary} columns={preferredColumns(query.data?.adsSummary?.rows)} emptyText={ui.adsContextUnavailable} ui={ui} />
                  <CompactDataSection title={ui.dailyContext} data={query.data?.adsDaily} columns={preferredColumns(query.data?.adsDaily?.rows)} emptyText={ui.dailyContextAfterSync} ui={ui} />
                  <CompactDataSection title={ui.anomalyCandidates} data={query.data?.adsAnomalies} columns={preferredColumns(query.data?.adsAnomalies?.rows)} emptyText={ui.anomaliesAfterPerformance} ui={ui} />
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="recent-issues">
              <IssuesPanel data={query.data} connectorState={connectorState} ui={ui} />
            </TabsContent>
          </Tabs>
        </>
      )}
    </DashboardLayout>
  );
}

async function readOptionalView(viewName: string): Promise<OptionalViewData> {
  const result = await supabase.from(viewName).select("*").eq("workspace_id", WORKSPACE_ID).limit(200);
  if (result.error) return { rows: [], unavailableReason: result.error.message };
  return { rows: ((result.data ?? []) as Row[]), unavailableReason: null };
}

function StatusCard({ label, value, raw, ui }: { label: string; value: string; raw: string | null; ui: Copy }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold leading-tight">{value}</p>
      {raw && raw !== value ? <p className="mt-2 break-all text-[11px] text-muted-foreground">{ui.technicalDetails}: {raw}</p> : null}
    </div>
  );
}

function ReadinessStep({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "muted" }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", tone === "success" && "bg-emerald-500", tone === "warning" && "bg-amber-500", tone === "muted" && "bg-muted-foreground/40")} />
        <p className="font-medium">{label}</p>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">{value}</p>
    </div>
  );
}

function ConnectorCard({ name, description, buttonText, stateText, helperNote, state, onConnect, canManage, ui }: { name: string; description: string; buttonText: string; stateText: string; helperNote?: string; state: ConnectorState; onConnect: () => void; canManage: boolean; ui: Copy }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/60 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{name}</p>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </div>
        <span className="rounded-full bg-muted px-2 py-1 text-[11px] text-muted-foreground">{stateText}</span>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">{ui.currentState}:</span> {stateText}</p>
        {helperNote ? <p className="text-amber-700 dark:text-amber-300">{helperNote}</p> : null}
        <div className="rounded-md bg-muted/40 p-3">
          <p className="font-medium text-foreground">{ui.safety}</p>
          <p className="mt-1">{ui.oauthMayCreate}</p>
          <p>{ui.useTestAccounts}</p>
        </div>
      </div>
      <Button type="button" className="mt-3" onClick={onConnect} disabled={state.loading || !canManage}>
        {state.loading ? ui.openingOauth : buttonText}
      </Button>
      {state.error && <p className="mt-2 text-xs text-destructive">{state.error}</p>}
    </div>
  );
}

function AdAccountsTable({ data, ui }: { data: OptionalViewData | undefined; ui: Copy }) {
  if (!data) return <p className="text-sm text-muted-foreground">{ui.dataUnavailable}</p>;
  if (data.unavailableReason) return <UnavailableMessage reason={data.unavailableReason} ui={ui} />;
  if (data.rows.length === 0) return <p className="text-sm text-muted-foreground">{ui.adAccountsEmpty}</p>;

  const columns = ["platform", "external_account_id", "client_name", "project_name", "funnel_name", "mapping_status", "binding_status", "confidence"];
  return <GenericDataTable rows={data.rows} columns={columns} ui={ui} markPlaceholders />;
}

function CompactDataSection({ title, data, columns, emptyText, ui }: { title: string; data: OptionalViewData | undefined; columns: string[]; emptyText: string; ui: Copy }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/50 p-3">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <OptionalKnownColumns data={data} columns={columns} emptyText={emptyText} ui={ui} />
    </div>
  );
}

function OptionalKnownColumns({ data, columns, emptyText, ui }: { data: OptionalViewData | undefined; columns: string[]; emptyText: string; ui: Copy }) {
  if (!data) return <p className="text-sm text-muted-foreground">{ui.dataUnavailable}</p>;
  if (data.unavailableReason) return <UnavailableMessage reason={data.unavailableReason} ui={ui} />;
  const filtered = columns.filter((column) => data.rows.some((row) => row[column] !== undefined));
  return filtered.length === 0 ? <GenericTable rows={data.rows} emptyText={emptyText} ui={ui} /> : <GenericDataTable rows={data.rows} columns={filtered} ui={ui} />;
}

function GenericTable({ rows, emptyText, ui }: { rows: Row[]; emptyText: string; ui: Copy }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const columns = Object.keys(rows[0] ?? {}).filter((column) => column !== "workspace_id");
  if (columns.length === 0) return <p className="text-sm text-muted-foreground">{ui.emptyFields}</p>;
  return <GenericDataTable rows={rows} columns={columns} ui={ui} />;
}

function GenericDataTable({ rows, columns, ui, markPlaceholders = false }: { rows: Row[]; columns: string[]; ui: Copy; markPlaceholders?: boolean }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{ui.noDataYet}</p>;
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-muted-foreground">
            {columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{friendlyLabel(column, ui)}</th>)}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => {
            const placeholder = markPlaceholders && isPlaceholderAccount(row);
            return (
              <tr key={`${index}-${String(row.id ?? "row")}`} className="border-b border-border/40 last:border-0">
                {columns.map((column) => (
                  <td key={`${index}-${column}`} className="max-w-[220px] px-2 py-2 align-top text-foreground">
                    <span className="break-words">{formatValue(row[column], ui)}</span>
                    {placeholder && column === "external_account_id" ? (
                      <span className="mt-1 inline-flex rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-900 dark:bg-amber-950/50 dark:text-amber-200">
                        {ui.testPlaceholder}
                      </span>
                    ) : null}
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

function IssuesPanel({ data, connectorState, ui }: { data: { [k: string]: OptionalViewData } | undefined; connectorState: Record<ConnectorKey, ConnectorState>; ui: Copy }) {
  const unavailable = collectUnavailableViews(data);
  const connectorErrors = Object.entries(connectorState).filter(([, state]) => state.error);
  const hasIssues = unavailable.length > 0 || connectorErrors.length > 0;

  return (
    <SectionCard title={ui.issuesTitle} description={ui.issuesDescription}>
      {!hasIssues ? <p className="text-sm text-muted-foreground">{ui.noIssues}</p> : null}
      <div className="space-y-3">
        {unavailable.map((item) => {
          const isTimeout = item.reason.toLowerCase().includes("statement timeout") || item.reason.toLowerCase().includes("readiness");
          return (
            <div key={`${item.name}-${item.reason}`} className="rounded-lg border border-border/70 bg-card/60 p-3 text-sm">
              <p className="font-semibold">{isTimeout ? ui.readinessTimeoutLabel : item.name}</p>
              <p className="mt-1 text-muted-foreground">{isTimeout ? ui.readinessTimeoutDescription : ui.sectionUnavailable}</p>
              <details className="mt-2">
                <summary className="cursor-pointer text-xs text-muted-foreground">{ui.technicalDetails}</summary>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs text-muted-foreground">{`${item.name}: ${item.reason}`}</pre>
              </details>
            </div>
          );
        })}
        {connectorErrors.map(([connector, state]) => (
          <div key={connector} className="rounded-lg border border-border/70 bg-card/60 p-3 text-sm">
            <p className="font-semibold">{ui.oauthIssue}: {connector}</p>
            <p className="mt-1 text-destructive">{state.error}</p>
          </div>
        ))}
      </div>
    </SectionCard>
  );
}

function MetricCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-lg font-semibold">{value}</p>
    </div>
  );
}

function UnavailableMessage({ reason, ui }: { reason: string; ui: Copy }) {
  return (
    <div className="text-sm text-muted-foreground">
      <p>{ui.sectionUnavailable}</p>
      <details className="mt-2">
        <summary className="cursor-pointer text-xs">{ui.technicalDetails}</summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">{reason}</pre>
      </details>
    </div>
  );
}

function friendlyLabel(value: string, ui: Copy) {
  return ui.columnLabels[value as keyof typeof ui.columnLabels] ?? value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
}

function formatValue(value: unknown, ui: Copy): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? ui.yes : ui.no;
  if (typeof value === "object") return JSON.stringify(value);
  if (typeof value === "string") return friendlyStatus(value, ui);
  return String(value);
}

function friendlyStatus(value: unknown, ui: Copy): string {
  if (value === null || value === undefined || value === "") return ui.noDataYet;
  const normalized = String(value).toLowerCase();
  return ui.statusLabels[normalized as keyof typeof ui.statusLabels] ?? String(value).replace(/_/g, " ");
}

function toObject(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}; }
function readString(row: Row | Record<string, unknown> | undefined, key: string): string | null { const value = row?.[key]; return typeof value === "string" ? value : null; }

function readLikelyStatus(row: Row | undefined): string | null {
  if (!row) return null;
  for (const key of ["health_status", "ads_health", "status", "state", "summary_status", "readiness_status"]) {
    const value = readString(row, key);
    if (value) return value;
  }
  return null;
}

function isReadyValue(value: string | null) {
  if (!value) return false;
  return ["ready", "healthy", "ok", "active", "success"].includes(value.toLowerCase());
}

function rowContainsValue(row: Row | undefined, keyNeedle: string, valueNeedle: string) {
  if (!row) return false;
  return Object.entries(row).some(([key, value]) => key.toLowerCase().includes(keyNeedle) && String(value).toLowerCase().includes(valueNeedle));
}

function isPlaceholderAccount(row: Row) {
  const values = [row.external_account_id, row.ad_account_name, row.source_name, row.platform]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase());
  return values.some((value) => value.includes("placeholder") || value.includes("test_") || value.includes("_test") || value.includes("northstar"));
}

function getPlatformConnectionState(platform: ConnectorKey, data: OptionalViewData | undefined, ui: Copy): PlatformConnectionState {
  if (!data || data.unavailableReason) return { label: ui.unknownConnectionState };

  const platformRows = data.rows.filter((row) => rowMatchesPlatform(row, platform));
  if (platformRows.some((row) => !isPlaceholderAccount(row))) return { label: ui.connectedState };
  if (platformRows.length > 0) return { label: ui.notConnectedState, note: ui.testBindingsNotReal };

  return { label: ui.notConnectedState };
}

function rowMatchesPlatform(row: Row, platform: ConnectorKey) {
  const searchable = [row.platform, row.external_account_id, row.ad_account_name, row.source_name]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase())
    .join(" ");

  if (platform === "meta") return searchable.includes("meta") || searchable.includes("facebook") || searchable.includes("instagram") || searchable.includes("act_");
  if (platform === "google") return searchable.includes("google");
  return searchable.includes("tiktok");
}

function findMetric(rows: Row[] | undefined, keys: string[]): unknown {
  for (const row of rows ?? []) {
    for (const key of keys) {
      const value = row[key];
      if (value !== undefined && value !== null && value !== "") return value;
    }
  }
  return null;
}

function formatMetric(value: unknown): string {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function preferredColumns(rows: Row[] | undefined): string[] {
  if (!rows?.length) return [];
  return Object.keys(rows[0]).filter((column) => column !== "workspace_id").slice(0, 8);
}

function collectUnavailableViews(data: { [k: string]: OptionalViewData } | undefined): Array<{ name: string; reason: string }> {
  if (!data) return [];
  return Object.entries(data)
    .filter(([, value]) => value && typeof value === "object" && "unavailableReason" in value && value.unavailableReason)
    .map(([name, value]) => ({ name, reason: value.unavailableReason ?? "" }));
}
