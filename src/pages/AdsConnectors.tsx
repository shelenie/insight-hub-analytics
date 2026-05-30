import { type ReactNode, useMemo, useState } from "react";
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
type Tone = "success" | "warning" | "muted";
type PlatformConnectionState = { label: string; note?: string; tone: Tone };
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
    pageTitle: "Рекламні конектори",
    pageSubtitle: "Операційний стан підключень, рекламних акаунтів і синхронізації.",
    authRequired: "Потрібен вхід",
    signedOut: "Ви вийшли з системи. Увійдіть, щоб відкрити рекламні конектори.",
    loadingTitle: "Завантаження рекламних конекторів",
    loadingDescription: "Завантажуємо операційні дані…",
    loadError: "Не вдалося завантажити рекламні конектори:",
    checkingAccess: "Перевіряємо права доступу…",
    noManageAccess: "У вас немає доступу до керування рекламними конекторами.",
    roleUnavailable: "Роль робочого простору тимчасово недоступна. Дії вимкнено з міркувань безпеки.",
    tabs: {
      overview: "Огляд",
      connections: "Підключення",
      adAccounts: "Рекламні акаунти",
      sync: "Синхронізація",
      facebookLeadAds: "Ліди Facebook",
      diagnostics: "Діагностика",
    },
    overviewTitle: "Операційний огляд",
    overviewSubtitle: "Короткий статус готовності підключень, акаунтів і даних для синхронізації.",
    connectionStatus: "Стан підключень",
    adAccountsKpi: "Рекламні акаунти",
    syncData: "Дані синхронізації",
    readyAfterOauth: "Очікує OAuth-підключення",
    accountsNeedConnection: "Потрібно підключити рекламні акаунти",
    noRealSyncDataYet: "Реальних даних синхронізації ще немає",
    noDataYet: "Даних ще немає",
    technicalStatus: "Технічний статус",
    operationalChecklist: "Операційний чекліст",
    oauthStartCallback: "OAuth-процес налаштований",
    realOAuthStillNeeded: "Потрібно пройти реальне підключення",
    placeholderAccountsNotReal: "Тестові акаунти не запускають реальну синхронізацію",
    realDataAfterFirstSync: "Дані з’являться після першої успішної синхронізації",
    connectionsTitle: "Підключення",
    connectionsDescription: "Безпечні OAuth-підключення для рекламних платформ.",
    currentState: "Поточний стан",
    safety: "Що станеться після підключення",
    connectedState: "Підключено",
    notConnectedState: "Не підключено",
    unknownConnectionState: "Стан невідомий",
    testBindingsNotReal: "Є тестові прив’язки, але реального OAuth-підключення ще немає.",
    stateManagedThroughMeta: "Керується через Meta Ads",
    oauthMayCreate: "Система створить реальне підключення. Синхронізація не стартує автоматично.",
    facebookLeadSafetyNote: "Працює через Meta Ads. Окреме підключення не потрібне.",
    metaDescription: "Підключення рекламних акаунтів Facebook та Instagram через Meta OAuth.",
    googleDescription: "Підключення рекламного акаунта Google Ads через Google OAuth.",
    tiktokDescription: "Підключення TikTok Business або Advertiser акаунта через TikTok OAuth.",
    facebookLeadDescription: "Працює через Meta Ads. Окреме підключення не потрібне.",
    connectMeta: "Підключити Meta Ads",
    connectGoogle: "Підключити Google Ads",
    connectTiktok: "Підключити TikTok Ads",
    openingOauth: "Відкриваємо OAuth…",
    oauthUrlMissing: "Функція безпечного OAuth не повернула URL.",
    adAccountsTitle: "Рекламні акаунти",
    adAccountsDescription: "Прив’язки акаунтів до клієнтів, проєктів і воронок.",
    adAccountsExplain: "Це можуть бути тестові прив’язки. Реальне підключення підтверджується тільки після OAuth.",
    testPlaceholder: "Тестовий акаунт",
    realAccount: "Реальний акаунт",
    bindingScope: "Область прив’язки",
    accountStatus: "Статус акаунта",
    testAccountNote: "Це тестова прив’язка. Вона не підтверджує реальне OAuth-підключення.",
    realAccountHelper: "Реальне підключення потрібно перевірити після OAuth.",
    adAccountsEmpty: "Рекламні акаунти ще не прив’язані.",
    scheduledTitle: "Синхронізація",
    scheduledDescription: "Правила синхронізації, поточна черга та ручний запуск.",
    scheduledWarning: "Не запускайте синхронізацію, доки реальне OAuth-підключення не перевірене.",
    syncRules: "Правила синхронізації",
    syncDue: "Поточна черга",
    manualSync: "Ручна синхронізація",
    syncRulesEmpty: "Правил синхронізації ще немає.",
    syncDueEmpty: "Зараз у черзі немає синхронізацій.",
    runSyncCheck: "Запустити ручну синхронізацію",
    runningSync: "Запускаємо синхронізацію…",
    syncSubmitNote: "Кнопка викликає наявну безпечну функцію синхронізації лише після ручного запуску.",
    syncSuccess: "Ручну синхронізацію надіслано.",
    syncFailedToastTitle: "Помилка синхронізації",
    syncSubmittedToastTitle: "Синхронізацію надіслано",
    syncError: "Синхронізація завершилася з помилкою.",
    detailsDebug: "Додаткові технічні відомості доступні в блоці для розробника.",
    fbTitle: "Ліди Facebook",
    fbDescription: "Форми, ліди, webhook-події та запуски синхронізації Facebook Lead Ads.",
    healthStatus: "Стан",
    activeForms: "Активні форми",
    formsNeedMapping: "Форми без мапінгу",
    leadsLast24h: "Ліди за 24 год",
    failedLeads: "Помилки лідів",
    unprocessedWebhookEvents: "Необроблені webhook-події",
    failedSyncsLast24h: "Помилки синхронізації за 24 год",
    formsTitle: "Форми",
    leadsTitle: "Останні ліди",
    syncRunsTitle: "Останні запуски синхронізації",
    fbFormsEmpty: "Форми з’являться після підключення Meta Ads.",
    fbLeadsEmpty: "Ліди з’являться після отримання Facebook Lead Ads даних.",
    fbSyncRunsEmpty: "Запуски синхронізації з’являться після першого sync.",
    diagnosticsTitle: "Діагностика",
    diagnosticsDescription: "Контекст реклами, кандидати на аномалії та поточні проблеми.",
    adsContext: "Контекст реклами",
    dailyContext: "Щоденний контекст реклами",
    anomalyCandidates: "Кандидати на аномалії",
    recentIssues: "Останні проблеми",
    adsContextUnavailable: "Контекст реклами з’явиться після першої успішної синхронізації.",
    dailyContextAfterSync: "Контекст реклами з’явиться після першої успішної синхронізації.",
    anomaliesAfterPerformance: "Кандидати на аномалії з’являться після появи даних ефективності.",
    noIssues: "Поточних проблем не знайдено.",
    readinessTimeoutLabel: "Таймаут перевірки готовності",
    readinessTimeoutDescription: "Один із запитів готовності перевищив ліміт часу. Це не означає, що OAuth не працює, але потребує окремої оптимізації серверної частини.",
    technicalDetails: "Технічні деталі",
    oauthIssue: "Помилка OAuth",
    sectionUnavailable: "Розділ тимчасово недоступний.",
    dataUnavailable: "Дані тимчасово недоступні.",
    limitedRows: "Показано {shown} із {total}. Повний набір приховано в технічних деталях.",
    emptyFields: "Дані є, але немає полів для відображення.",
    yes: "Так",
    no: "Ні",
    statusLabels: {
      ads_setup_required: "Потрібно підключити рекламні акаунти",
      healthy: "Все працює",
      unavailable: "Даних ще немає",
      no_active_connections: "Немає активних реальних OAuth-підключень",
      active: "Активно",
      inactive: "Неактивно",
      ready: "Готово",
      ok: "Готово",
      connected: "Підключено",
      success: "Успішно",
      pending: "Очікує",
      failed: "Помилка",
      error: "Помилка",
    },
    columnLabels: {
      platform: "Платформа",
      external_account_id: "Зовнішній ID акаунта",
      ad_account_name: "Рекламний акаунт",
      client_name: "Клієнт",
      project_name: "Проєкт",
      funnel_name: "Воронка",
      mapping_status: "Статус мапінгу",
      binding_status: "Статус прив’язки",
      confidence: "Впевненість",
      cadence: "Періодичність",
      schedule: "Розклад",
      status: "Статус",
      last_run_at: "Останній запуск",
      next_run_at: "Наступний запуск",
      updated_at: "Оновлено",
      due_status: "Статус черги",
      is_due: "Потрібен запуск",
      form_name: "Форма",
      form_id: "ID форми",
      leads_count: "Ліди",
      created_at: "Створено",
      error_message: "Помилка",
      health_status: "Стан",
      active_forms: "Активні форми",
      forms_needing_mapping: "Форми без мапінгу",
      leads_last_24h: "Ліди за 24 год",
      failed_leads: "Помилки лідів",
      unprocessed_webhook_events: "Необроблені webhook-події",
      failed_syncs_last_24h: "Помилки синхронізації за 24 год",
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
      sync: "Sync",
      facebookLeadAds: "Facebook leads",
      diagnostics: "Diagnostics",
    },
    overviewTitle: "Operational overview",
    overviewSubtitle: "A concise readiness summary for connections, accounts, and synced data.",
    connectionStatus: "Connection status",
    adAccountsKpi: "Ad accounts",
    syncData: "Sync data",
    readyAfterOauth: "Waiting for OAuth connection",
    accountsNeedConnection: "Ad accounts need to be connected",
    noRealSyncDataYet: "No real sync data yet",
    noDataYet: "No data yet",
    technicalStatus: "Technical status",
    operationalChecklist: "Operational checklist",
    oauthStartCallback: "OAuth flow is configured",
    realOAuthStillNeeded: "Real connection still needs to be completed",
    placeholderAccountsNotReal: "Test accounts do not start real sync",
    realDataAfterFirstSync: "Real data appears after first successful sync",
    connectionsTitle: "Connections",
    connectionsDescription: "Secure OAuth connections for advertising platforms.",
    currentState: "Current state",
    safety: "What happens after connection",
    connectedState: "Connected",
    notConnectedState: "Not connected",
    unknownConnectionState: "Unknown",
    testBindingsNotReal: "Test binding records exist, but there is no real OAuth connection yet.",
    stateManagedThroughMeta: "Managed through Meta Ads",
    oauthMayCreate: "The system will create a real connection. Sync will not start automatically.",
    facebookLeadSafetyNote: "Uses Meta Ads. No separate connection is required.",
    metaDescription: "Connect Facebook and Instagram ad accounts through Meta OAuth.",
    googleDescription: "Connect a Google Ads account through Google OAuth.",
    tiktokDescription: "Connect a TikTok Business or Advertiser account through TikTok OAuth.",
    facebookLeadDescription: "Uses Meta Ads. No separate connection is required.",
    connectMeta: "Connect Meta Ads",
    connectGoogle: "Connect Google Ads",
    connectTiktok: "Connect TikTok Ads",
    openingOauth: "Opening OAuth…",
    oauthUrlMissing: "OAuth URL was not returned by the secure Edge Function.",
    adAccountsTitle: "Ad accounts",
    adAccountsDescription: "Account bindings to clients, projects, and funnels.",
    adAccountsExplain: "These may be test binding records. A real connection is verified only after OAuth.",
    testPlaceholder: "Test account",
    realAccount: "Real account",
    bindingScope: "Binding scope",
    accountStatus: "Account status",
    testAccountNote: "This is a test binding. It does not confirm a real OAuth connection.",
    realAccountHelper: "Real connection should be verified after OAuth.",
    adAccountsEmpty: "Ad accounts are not bound yet.",
    scheduledTitle: "Sync",
    scheduledDescription: "Sync rules, current queue, and manual run controls.",
    scheduledWarning: "Do not run sync until a real OAuth connection is verified.",
    syncRules: "Sync rules",
    syncDue: "Current queue",
    manualSync: "Manual sync",
    syncRulesEmpty: "No sync rules yet.",
    syncDueEmpty: "No syncs need to run right now.",
    runSyncCheck: "Run manual sync",
    runningSync: "Running sync…",
    syncSubmitNote: "Clicking calls the existing secure sync function only when submitted manually.",
    syncSuccess: "Manual sync submitted.",
    syncFailedToastTitle: "Sync failed",
    syncSubmittedToastTitle: "Sync submitted",
    syncError: "Sync finished with an error.",
    detailsDebug: "Additional technical information is available in developer details.",
    fbTitle: "Facebook leads",
    fbDescription: "Facebook Lead Ads forms, leads, webhook events, and sync runs.",
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
    fbFormsEmpty: "Forms will appear after Meta Ads is connected.",
    fbLeadsEmpty: "Leads will appear after Facebook Lead Ads data is received.",
    fbSyncRunsEmpty: "Sync runs will appear after the first sync.",
    diagnosticsTitle: "Diagnostics",
    diagnosticsDescription: "Ads context, anomaly candidates, and current issues.",
    adsContext: "Ads context",
    dailyContext: "Daily ads context",
    anomalyCandidates: "Anomaly candidates",
    recentIssues: "Recent issues",
    adsContextUnavailable: "Ads context will appear after the first successful sync.",
    dailyContextAfterSync: "Ads context will appear after the first successful sync.",
    anomaliesAfterPerformance: "Anomaly candidates will appear after performance data is available.",
    noIssues: "No current issues found.",
    readinessTimeoutLabel: "Readiness query timeout",
    readinessTimeoutDescription: "One readiness query exceeded the time limit. This does not mean Ads OAuth is broken, but needs separate backend optimization.",
    technicalDetails: "Technical details",
    oauthIssue: "OAuth error",
    sectionUnavailable: "This section is temporarily unavailable.",
    dataUnavailable: "Data is temporarily unavailable.",
    limitedRows: "Showing {shown} of {total}. Full data is hidden in technical details.",
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
      connected: "Connected",
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
      ui.syncSuccess;

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

  const connectionRaw = readString(overview.snapshot, "ads_connector_status");
  const hasRealOAuth = connectionRaw === "active" || connectionRaw === "healthy" || connectionRaw === "connected" || realAccountRows.length > 0;
  const overviewConnectionStatus = hasRealOAuth ? ui.connectedState : connectionRaw ? ui.readyAfterOauth : ui.noDataYet;
  const overviewAdAccountsStatus = realAccountRows.length > 0 ? formatMetric(realAccountRows.length) : ui.accountsNeedConnection;
  const overviewSyncStatus = realSyncDataAvailable ? ui.connectedState : ui.noRealSyncDataYet;

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
              <TabsTrigger value="sync">{ui.tabs.sync}</TabsTrigger>
              <TabsTrigger value="facebook-lead-ads">{ui.tabs.facebookLeadAds}</TabsTrigger>
              <TabsTrigger value="diagnostics">{ui.tabs.diagnostics}</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <SectionCard title={ui.overviewTitle} description={ui.overviewSubtitle} accent>
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <StatusCard label={ui.connectionStatus} value={overviewConnectionStatus} raw={connectionRaw} ui={ui} />
                  <StatusCard label={ui.adAccountsKpi} value={overviewAdAccountsStatus} raw={null} ui={ui} />
                  <StatusCard label={ui.syncData} value={overviewSyncStatus} raw={readLikelyStatus(overview.adsHealth)} ui={ui} />
                </div>
                <div className="mt-4 rounded-lg border border-border/70 bg-background/60 p-4">
                  <p className="text-sm font-semibold">{ui.operationalChecklist}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <ReadinessStep label={ui.oauthStartCallback} tone="success" />
                    <ReadinessStep label={ui.realOAuthStillNeeded} tone={hasRealOAuth ? "success" : "warning"} />
                    <ReadinessStep label={ui.placeholderAccountsNotReal} tone="warning" />
                    <ReadinessStep label={ui.realDataAfterFirstSync} tone={realSyncDataAvailable ? "success" : "muted"} />
                  </div>
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
                    stateTone={platformConnectionStates.meta.tone}
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
                    stateTone={platformConnectionStates.google.tone}
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
                    stateTone={platformConnectionStates.tiktok.tone}
                    helperNote={platformConnectionStates.tiktok.note}
                    state={connectorState.tiktok}
                    onConnect={() => void connect("tiktok")}
                    canManage={canManage}
                    ui={ui}
                  />
                  <div className="flex h-full flex-col rounded-lg border border-border/70 bg-card/60 p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">Facebook Lead Ads</p>
                        <p className="mt-1 text-muted-foreground">{ui.facebookLeadDescription}</p>
                      </div>
                      <StatusPill tone="muted">{ui.stateManagedThroughMeta}</StatusPill>
                    </div>
                    <div className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">
                      <p className="font-medium text-foreground">{ui.safety}</p>
                      <p className="mt-1">{ui.facebookLeadSafetyNote}</p>
                    </div>
                    <div className="mt-auto pt-3">
                      <Button type="button" variant="secondary" disabled>{ui.stateManagedThroughMeta}</Button>
                    </div>
                  </div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="ad-accounts">
              <SectionCard title={ui.adAccountsTitle} description={ui.adAccountsDescription}>
                <div className="mb-4">
                  <WarningNotice>{ui.adAccountsExplain}</WarningNotice>
                </div>
                <AdAccountsTable data={query.data?.adBindings} ui={ui} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="sync">
              <SectionCard title={ui.scheduledTitle} description={ui.scheduledDescription}>
                <div className="space-y-4">
                  <WarningNotice>{ui.scheduledWarning}</WarningNotice>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <CompactDataSection title={ui.syncRules} data={query.data?.syncRules} columns={["platform", "cadence", "schedule", "status", "last_run_at", "next_run_at", "updated_at"]} emptyText={ui.syncRulesEmpty} ui={ui} />
                    <CompactDataSection title={ui.syncDue} data={query.data?.syncDue} columns={["platform", "status", "last_run_at", "next_run_at", "due_status", "is_due"]} emptyText={ui.syncDueEmpty} ui={ui} />
                  </div>
                  <div className="rounded-lg border border-border/70 bg-card/50 p-4">
                    <p className="mb-3 text-sm font-semibold">{ui.manualSync}</p>
                    <Button type="button" onClick={() => void runScheduledSync()} disabled={!session || !canManage || !capabilities.can_run_ads_scheduled_sync || syncRunState.loading}>
                      {syncRunState.loading ? ui.runningSync : ui.runSyncCheck}
                    </Button>
                    <p className="mt-2 text-xs text-muted-foreground">{ui.syncSubmitNote}</p>
                    {syncRunState.success && <p className="mt-2 text-xs text-emerald-700">{ui.syncSuccess}</p>}
                    {syncRunState.error && <p className="mt-2 text-xs text-destructive">{ui.syncError} {syncRunState.error}</p>}
                    {syncRunState.details ? <p className="mt-2 text-xs text-muted-foreground">{ui.detailsDebug}</p> : null}
                    <DeveloperDetails title={ui.technicalDetails}>{syncRunState.details ? <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-xs text-muted-foreground">{JSON.stringify(syncRunState.details, null, 2)}</pre> : null}</DeveloperDetails>
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

            <TabsContent value="diagnostics">
              <SectionCard title={ui.diagnosticsTitle} description={ui.diagnosticsDescription}>
                <div className="space-y-4">
                  <CompactDataSection title={ui.adsContext} data={query.data?.adsSummary} columns={preferredColumns(query.data?.adsSummary?.rows)} emptyText={ui.adsContextUnavailable} ui={ui} maxRows={5} />
                  <CompactDataSection title={ui.dailyContext} data={query.data?.adsDaily} columns={preferredColumns(query.data?.adsDaily?.rows)} emptyText={ui.dailyContextAfterSync} ui={ui} maxRows={5} />
                  <CompactDataSection title={ui.anomalyCandidates} data={query.data?.adsAnomalies} columns={preferredColumns(query.data?.adsAnomalies?.rows)} emptyText={ui.anomaliesAfterPerformance} ui={ui} maxRows={5} />
                  <IssuesPanel data={query.data} connectorState={connectorState} ui={ui} />
                </div>
              </SectionCard>
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

function StatusPill({ tone, children }: { tone: Tone; children: ReactNode }) {
  return (
    <span className={cn(
      "shrink-0 rounded-full px-2.5 py-1 text-[11px] font-medium",
      tone === "success" && "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
      tone === "warning" && "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
      tone === "muted" && "bg-muted text-muted-foreground",
    )}>
      {children}
    </span>
  );
}

function WarningNotice({ children }: { children: ReactNode }) {
  return (
    <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
      {children}
    </div>
  );
}

function StatusCard({ label, value, raw, ui }: { label: string; value: string; raw: string | null; ui: Copy }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold leading-tight">{value}</p>
      {raw && raw !== value ? <p className="mt-2 break-all text-[11px] text-muted-foreground">{ui.technicalStatus}: {raw}</p> : null}
    </div>
  );
}

function ReadinessStep({ label, value, tone }: { label: string; value?: string; tone: Tone }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-3 text-sm">
      <div className="flex items-center gap-2">
        <span className={cn("h-2 w-2 rounded-full", tone === "success" && "bg-emerald-500", tone === "warning" && "bg-amber-500", tone === "muted" && "bg-muted-foreground/40")} />
        <p className="font-medium">{label}</p>
      </div>
      {value ? <p className="mt-1 text-xs text-muted-foreground">{value}</p> : null}
    </div>
  );
}

function ConnectorCard({ name, description, buttonText, stateText, stateTone, helperNote, state, onConnect, canManage, ui }: { name: string; description: string; buttonText: string; stateText: string; stateTone: Tone; helperNote?: string; state: ConnectorState; onConnect: () => void; canManage: boolean; ui: Copy }) {
  return (
    <div className="flex h-full flex-col rounded-lg border border-border/70 bg-card/60 p-4 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="font-semibold">{name}</p>
          <p className="mt-1 text-muted-foreground">{description}</p>
        </div>
        <StatusPill tone={stateTone}>{stateText}</StatusPill>
      </div>
      <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
        <p><span className="font-medium text-foreground">{ui.currentState}:</span> {stateText}</p>
        {helperNote ? <WarningNotice>{helperNote}</WarningNotice> : null}
        <div className="rounded-md bg-muted/40 p-3">
          <p className="font-medium text-foreground">{ui.safety}</p>
          <p className="mt-1">{ui.oauthMayCreate}</p>
        </div>
      </div>
      <div className="mt-auto pt-3">
        <Button type="button" onClick={onConnect} disabled={state.loading || !canManage}>
          {state.loading ? ui.openingOauth : buttonText}
        </Button>
        {state.error && <p className="mt-2 text-xs text-destructive">{state.error}</p>}
      </div>
    </div>
  );
}

function AdAccountsTable({ data, ui }: { data: OptionalViewData | undefined; ui: Copy }) {
  if (!data) return <p className="text-sm text-muted-foreground">{ui.dataUnavailable}</p>;
  if (data.unavailableReason) return <UnavailableMessage reason={data.unavailableReason} ui={ui} />;
  if (data.rows.length === 0) return <p className="text-sm text-muted-foreground">{ui.adAccountsEmpty}</p>;

  return (
    <div className="grid gap-3 xl:grid-cols-2">
      {data.rows.map((row, index) => <AdAccountCard key={`${index}-${String(row.external_account_id ?? row.id ?? "account")}`} row={row} ui={ui} />)}
    </div>
  );
}

function AdAccountCard({ row, ui }: { row: Row; ui: Copy }) {
  const placeholder = isPlaceholderAccount(row);
  return (
    <article className={cn(
      "flex h-full flex-col rounded-lg border bg-card/60 p-4 text-sm",
      placeholder ? "border-amber-200 dark:border-amber-900/60" : "border-border/70",
    )}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{ui.columnLabels.platform}</p>
          <p className="mt-1 text-base font-semibold text-foreground">{formatValue(row.platform, ui)}</p>
        </div>
        <StatusPill tone={placeholder ? "warning" : "success"}>{placeholder ? ui.testPlaceholder : ui.realAccount}</StatusPill>
      </div>

      <div className="mt-4 rounded-md bg-muted/30 px-3 py-2">
        <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{ui.columnLabels.external_account_id}</p>
        <p className="mt-1 break-all font-mono text-sm text-foreground">{formatValue(row.external_account_id, ui)}</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{ui.bindingScope}</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <AccountField label={ui.columnLabels.client_name} value={row.client_name} ui={ui} />
            <AccountField label={ui.columnLabels.project_name} value={row.project_name} ui={ui} />
            <AccountField label={ui.columnLabels.funnel_name} value={row.funnel_name} ui={ui} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{ui.accountStatus}</p>
          <div className="grid gap-2 sm:grid-cols-3 lg:grid-cols-1">
            <AccountField label={ui.columnLabels.mapping_status} value={row.mapping_status} ui={ui} />
            <AccountField label={ui.columnLabels.binding_status} value={row.binding_status} ui={ui} />
            <AccountField label={ui.columnLabels.confidence} value={row.confidence} ui={ui} />
          </div>
        </div>
      </div>

      <div className="mt-auto pt-4">
        {placeholder ? <WarningNotice>{ui.testAccountNote}</WarningNotice> : <p className="text-xs text-muted-foreground">{ui.realAccountHelper}</p>}
      </div>
    </article>
  );
}

function AccountField({ label, value, ui }: { label: string; value: unknown; ui: Copy }) {
  return (
    <div className="min-w-0 rounded-md bg-muted/30 px-3 py-2">
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-1 break-words text-sm text-foreground">{formatValue(value, ui)}</p>
    </div>
  );
}

function CompactDataSection({ title, data, columns, emptyText, ui, maxRows }: { title: string; data: OptionalViewData | undefined; columns: string[]; emptyText: string; ui: Copy; maxRows?: number }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/50 p-3">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <OptionalKnownColumns data={data} columns={columns} emptyText={emptyText} ui={ui} maxRows={maxRows} />
    </div>
  );
}

function OptionalKnownColumns({ data, columns, emptyText, ui, maxRows }: { data: OptionalViewData | undefined; columns: string[]; emptyText: string; ui: Copy; maxRows?: number }) {
  if (!data) return <p className="text-sm text-muted-foreground">{ui.dataUnavailable}</p>;
  if (data.unavailableReason) return <UnavailableMessage reason={data.unavailableReason} ui={ui} />;
  const filtered = columns.filter((column) => data.rows.some((row) => row[column] !== undefined));
  return filtered.length === 0 ? <GenericTable rows={data.rows} emptyText={emptyText} ui={ui} maxRows={maxRows} /> : <GenericDataTable rows={data.rows} columns={filtered} ui={ui} maxRows={maxRows} />;
}

function GenericTable({ rows, emptyText, ui, maxRows }: { rows: Row[]; emptyText: string; ui: Copy; maxRows?: number }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const columns = Object.keys(rows[0] ?? {}).filter((column) => column !== "workspace_id");
  if (columns.length === 0) return <p className="text-sm text-muted-foreground">{ui.emptyFields}</p>;
  return <GenericDataTable rows={rows} columns={columns} ui={ui} maxRows={maxRows} />;
}

function GenericDataTable({ rows, columns, ui, markPlaceholders = false, maxRows }: { rows: Row[]; columns: string[]; ui: Copy; markPlaceholders?: boolean; maxRows?: number }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{ui.noDataYet}</p>;
  const visibleRows = maxRows ? rows.slice(0, maxRows) : rows;
  const hiddenRows = rows.length - visibleRows.length;
  return (
    <>
    <div className="overflow-x-auto rounded-md">
      <table className="min-w-full table-fixed text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-muted-foreground">
            {columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{friendlyLabel(column, ui)}</th>)}
          </tr>
        </thead>
        <tbody>
          {visibleRows.map((row, index) => {
            const placeholder = markPlaceholders && isPlaceholderAccount(row);
            return (
              <tr key={`${index}-${String(row.id ?? "row")}`} className="border-b border-border/40 last:border-0">
                {columns.map((column) => (
                  <td key={`${index}-${column}`} className="max-w-[180px] px-2 py-2 align-top text-foreground">
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
    {hiddenRows > 0 ? (
      <div className="mt-2 text-xs text-muted-foreground">
        <p>{formatLimitedRows(ui.limitedRows, visibleRows.length, rows.length)}</p>
        <DeveloperDetails title={ui.technicalDetails}>
          <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs text-muted-foreground">{JSON.stringify(rows.slice(visibleRows.length), null, 2)}</pre>
        </DeveloperDetails>
      </div>
    ) : null}
    </>
  );
}

function IssuesPanel({ data, connectorState, ui }: { data: { [k: string]: OptionalViewData } | undefined; connectorState: Record<ConnectorKey, ConnectorState>; ui: Copy }) {
  const unavailable = collectUnavailableViews(data);
  const connectorErrors = Object.entries(connectorState).filter(([, state]) => state.error);
  const hasIssues = unavailable.length > 0 || connectorErrors.length > 0;

  return (
    <div className="rounded-lg border border-border/70 bg-card/50 p-3">
      <p className="mb-2 text-sm font-semibold">{ui.recentIssues}</p>
      {!hasIssues ? <p className="text-sm text-muted-foreground">{ui.noIssues}</p> : null}
      <div className="space-y-3">
        {unavailable.map((item) => {
          const isTimeout = item.reason.toLowerCase().includes("statement timeout") || item.reason.toLowerCase().includes("readiness");
          return (
            <div key={`${item.name}-${item.reason}`} className={cn("rounded-lg border p-3 text-sm", isTimeout ? "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20" : "border-border/70 bg-card/60")}>
              <p className="font-semibold">{isTimeout ? ui.readinessTimeoutLabel : friendlyIssueName(item.name, ui)}</p>
              <p className="mt-1 text-muted-foreground">{isTimeout ? ui.readinessTimeoutDescription : ui.sectionUnavailable}</p>
              <DeveloperDetails title={ui.technicalDetails}>
                <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs text-muted-foreground">{`${item.name}: ${item.reason}`}</pre>
              </DeveloperDetails>
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
    </div>
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
      <DeveloperDetails title={ui.technicalDetails}>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">{reason}</pre>
      </DeveloperDetails>
    </div>
  );
}

function formatLimitedRows(template: string, shown: number, total: number) {
  return template.replace("{shown}", String(shown)).replace("{total}", String(total));
}

function friendlyIssueName(name: string, ui: Copy) {
  const labels: Record<string, string> = {
    readiness: ui.operationalChecklist,
    snapshot: ui.overviewTitle,
    adBindings: ui.adAccountsTitle,
    syncRules: ui.syncRules,
    syncDue: ui.syncDue,
    adsSummary: ui.adsContext,
    adsDaily: ui.dailyContext,
    adsAnomalies: ui.anomalyCandidates,
    fbHealth: ui.fbTitle,
    fbForms: ui.formsTitle,
    fbLeads: ui.leadsTitle,
    fbSyncRuns: ui.syncRunsTitle,
  };
  return labels[name] ?? name;
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

function isPlaceholderAccount(row: Row) {
  const values = [row.external_account_id, row.ad_account_name, row.source_name, row.platform]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase());
  return values.some((value) => value.includes("placeholder") || value.includes("test_") || value.includes("_test") || value.includes("northstar"));
}

function getPlatformConnectionState(platform: ConnectorKey, data: OptionalViewData | undefined, ui: Copy): PlatformConnectionState {
  if (!data || data.unavailableReason) return { label: ui.unknownConnectionState, tone: "muted" };

  const platformRows = data.rows.filter((row) => rowMatchesPlatform(row, platform));
  if (platformRows.some((row) => !isPlaceholderAccount(row))) return { label: ui.connectedState, tone: "success" };
  if (platformRows.length > 0) return { label: ui.notConnectedState, note: ui.testBindingsNotReal, tone: "warning" };

  return { label: ui.notConnectedState, tone: "warning" };
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
