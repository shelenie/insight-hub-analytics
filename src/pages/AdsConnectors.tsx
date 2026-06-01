import { type ReactNode, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, RefreshCw } from "lucide-react";
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
type TabKey = "overview" | "connections" | "ad-accounts" | "sync" | "facebook-lead-ads" | "diagnostics";
type ActiveConnectionDetails = { id: string; displayName: string | null; lastConnectedAt: string | null; activeCount: number };
type SyncRunState = { loading: boolean; error: string | null; success: string | null; details: Record<string, unknown> | null };

const ADS_SUBNAV_TRIGGER_CLASS =
  "h-10 whitespace-nowrap rounded-lg border border-transparent px-4 text-sm font-semibold transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm";
type Tone = "success" | "warning" | "muted";
type PlatformConnectionState = { label: string; currentState?: string; note?: string; tone: Tone; details?: string[]; availableItems?: readonly string[]; todoItems?: readonly string[]; activeConnection?: ActiveConnectionDetails | null };
type PlatformSyncInsight = { hasDataRows: boolean; hasVerifiedSync: boolean; latestFailure: string | null; hasRealAccount: boolean };
type DisconnectTarget = { id: string; name: string } | null;
type UiLang = "uk" | "en";
type TimezoneDisplayMode = "utc" | "local";
type Copy = (typeof copy)[UiLang];

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const CONNECTOR_FN: Record<ConnectorKey, string> = {
  meta: "meta-oauth-start",
  google: "google-ads-oauth-start",
  tiktok: "tiktok-oauth-start",
};
const TAB_KEYS: TabKey[] = ["overview", "connections", "ad-accounts", "sync", "facebook-lead-ads", "diagnostics"];
const TIMEZONE_DISPLAY_MODE_KEY = "insight-hub-timezone-display-mode";
const TIMEZONE_NAME_KEY = "insight-hub-timezone-name";

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
    adAccountsKpi: "Готові акаунти",
    syncData: "Дані синхронізації",
    connectionStatusHelper: "Meta Ads і TikTok Ads підключені. Facebook Lead Ads працює через Meta Ads.",
    adAccountsHelper: "Meta Ads готовий. TikTok підключено без даних. Google Ads очікує API.",
    syncVerifiedStatus: "Синхронізацію перевірено",
    syncVerifiedNoRows: "Конектори працюють, даних поки немає",
    needsAttention: "Потребує уваги",
    nextAction: "Наступна дія",
    nextActionDescription: "Перевірити рекламні акаунти та прив’язати їх до проєктів/воронок у розділі Звʼязки даних.",
    nextActionGoogle: "Google Ads: очікуємо Basic Access / доступ до Google Ads API.",
    googleNeedsAccess: "Google Ads: OAuth підключено, але синхронізація очікує доступ Google Ads API / Basic Access.",
    tiktokNoDataYetAttention: "TikTok Ads: синхронізація працює, але тестовий рекламний акаунт поки без даних.",
    facebookLeadFormsAttention: "Facebook Lead Ads: форми не знайдені. Sync і webhook перевірені, але реальні ліди з’являться після наявності форм/подій.",
    noCriticalActions: "Критичних дій немає. Перевірки синхронізації пройшли без помилок.",
    adAccountsFoundButEmpty: "Акаунти знайдено, частина конекторів поки без рекламних даних.",
    syncCheckedNoRows: "Останні перевірки синхронізації завершилися без помилок; рядків поки немає через порожні акаунти.",
    readyAfterOauth: "Очікує підключення",
    accountsNeedConnection: "Потрібно підключити рекламні акаунти",
    noRealSyncDataYet: "Реальних даних синхронізації ще немає",
    noDataYet: "Даних ще немає",
    technicalStatus: "Технічний статус",
    operationalChecklist: "Готовність до роботи",
    oauthStartCallback: "Безпечне підключення",
    realOAuthStillNeeded: "Реальні OAuth-підключення",
    placeholderAccountsNotReal: "Рекламні акаунти знайдено",
    realDataAfterFirstSync: "Синхронізацію перевірено",
    connectionsTitle: "Підключення",
    connectionsDescription: "Безпечні підключення для рекламних платформ.",
    refresh: "Оновити",
    refreshing: "Оновлюємо…",
    oauthSuccessTitle: "Meta Ads підключено",
    oauthSuccessDescription: "Meta Ads підключено. Тепер перевірте рекламні акаунти.",
    oauthErrorTitle: "Не вдалося підключити Meta Ads",
    oauthErrorDescription: "Спробуйте повторити підключення або перевірте повідомлення в callback-функції.",
    checkAdAccounts: "Перевірити рекламні акаунти",
    dismiss: "Закрити",
    cancel: "Скасувати",
    currentState: "Поточний стан",
    safety: "Що станеться після підключення",
    availableNow: "Що доступно зараз",
    toDo: "Що треба зробити",
    connectedState: "Підключено",
    oauthConnectedState: "OAuth-підключення виконано",
    metaConnectedState: "Meta Ads підключено",
    connectedAccount: "Акаунт",
    activeConnections: "Активних підключень",
    lastConnected: "Останнє підключення",
    oauthNotCompletedState: "Підключення ще не виконано",
    realConnectionNotCreated: "Реальне підключення ще не створено",
    unknownConnectionState: "Стан невідомий",
    testBindingsNotReal: "Є тестові прив’язки, але підключення ще не завершено.",
    testBindingsNoRealOauth: "Є тестові прив’язки, але реального OAuth-підключення ще немає.",
    stateManagedThroughMeta: "Через Meta Ads",
    facebookLeadAvailableAfterMeta: "Facebook Lead Ads стане доступним після підключення Meta Ads.",
    oauthMayCreate: "Після підключення система створить реальний запис підключення.",
    facebookLeadSafetyNote: "Працює через Meta Ads. Окреме OAuth-підключення не потрібне.",
    metaSyncVerifiedNote: "Синхронізація Meta Ads перевірена. Даних за період поки немає.",
    tiktokSyncVerifiedNote: "Синхронізація TikTok Ads перевірена. Рекламний акаунт поки без даних.",
    googleAccessPendingNote: "Очікуємо доступ Google Ads API. Після підтвердження Basic Access синхронізація стане доступною.",
    googleSyncVerifiedNote: "Синхронізація Google Ads перевірена.",
    googleDataSyncingNote: "Дані Google Ads синхронізуються.",
    metaDataSyncingNote: "Дані Meta Ads синхронізуються.",
    tiktokDataSyncingNote: "Дані TikTok Ads синхронізуються.",
    syncFailedNote: "Остання синхронізація завершилася з помилкою.",
    syncFailedWithErrorNote: "Остання синхронізація завершилася з помилкою: {error}",
    facebookLeadVerifiedNote: "Lead Ads sync і webhook endpoint перевірені.",
    facebookLeadFormsMissingNote: "Форми поки не знайдені. Вони з’являться після наявності Facebook Lead Forms або доступу до сторінок.",
    googleOauthConnectedState: "OAuth підключено",
    googleAwaitingAccessState: "Очікує доступ",
    metaAvailableItems: ["Рекламний акаунт знайдено.", "Ручна синхронізація доступна.", "Планова синхронізація налаштована."],
    tiktokAvailableItems: ["Рекламний акаунт знайдено.", "365 днів синхронізуються частинами по 30 днів.", "Останній тест завершився без помилок."],
    googleAvailableItems: ["OAuth-підключення створено.", "Рекламний акаунт буде синхронізовано після доступу Google Ads API."],
    googleTodoItems: ["Дочекатися Basic Access / доступу до Google Ads API."],
    facebookLeadAvailableItems: ["Окреме OAuth-підключення не потрібне.", "Ручна синхронізація лідів доступна на вкладці Ліди Facebook.", "Webhook endpoint активний."],
    metaDescription: "Підключення рекламних акаунтів Facebook та Instagram через безпечне підключення Meta Ads.",
    googleDescription: "Підключення рекламного акаунта Google Ads через безпечну авторизацію.",
    tiktokDescription: "Підключення TikTok Business або рекламного акаунта через безпечну авторизацію.",
    facebookLeadDescription: "Працює через Meta Ads. Окреме підключення не потрібне.",
    connectMeta: "Підключити Meta Ads",
    connectGoogle: "Підключити Google Ads",
    connectTiktok: "Підключити TikTok Ads",
    reconnect: "Перепідключити",
    disconnect: "Від’єднати",
    disconnectMetaTitle: "Від’єднати Meta Ads?",
    disconnectTitle: "Від’єднати {platform}?",
    disconnectMetaDescription: "Синхронізація зупиниться. Історичні дані залишаться в системі. Ви зможете підключити акаунт повторно.",
    disconnecting: "Від’єднуємо…",
    disconnectSuccessTitle: "Meta Ads від’єднано",
    disconnectSuccessDescription: "Підключення вимкнено без видалення історичних даних.",
    disconnectErrorTitle: "Не вдалося від’єднати Meta Ads",
    openingOauth: "Відкриваємо авторизацію…",
    oauthUrlMissing: "Не вдалося отримати посилання для безпечного підключення.",
    adAccountsTitle: "Рекламні акаунти",
    adAccountsDescription: "Прив’язки акаунтів до клієнтів, проєктів і воронок.",
    adAccountsAllExplain: "Реальні акаунти показані першими. Нижче доступні тестові та архівні прив’язки для перевірки.",
    adAccountsTestExplain: "Ці записи потрібні для перевірки сценаріїв. Вони не підтверджують реальне підключення.",
    adAccountsNoRealExplain: "Реальні рекламні акаунти з’являться після OAuth-підключення та першої синхронізації акаунтів. Нижче можуть бути службові тестові прив’язки.",
    accountSection: "Акаунт",
    realAccountsSection: "Реальні акаунти",
    testAccountsSection: "Тестові та архівні прив’язки",
    serviceTestBinding: "Службова тестова прив’язка",
    technicalId: "Технічний ID",
    bindingSection: "Прив’язка",
    statusSection: "Статус",
    archived: "Архівовано",
    testPlaceholder: "Тестова прив’язка",
    realAccount: "Реальний акаунт",
    bindingScope: "Прив’язка",
    accountStatus: "Статус",
    testAccountNote: "Це тестова прив’язка. Вона не підтверджує реальне підключення.",
    archivedAccountNote: "Цю прив’язку архівовано. Вона залишена для історії та перевірки.",
    realAccountHelper: "Реальне підключення перевірено для синхронізації.",
    adAccountsEmpty: "Рекламні акаунти ще не прив’язані.",
    scheduledTitle: "Синхронізація",
    scheduledDescription: "Правила синхронізації, поточна черга та ручний запуск.",
    scheduledWarning: "Не запускайте синхронізацію, доки реальне OAuth-підключення та рекламний акаунт не перевірені.",
    timezoneLabel: "Час",
    timezoneUtc: "UTC",
    timezoneLocal: "Мій час",
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
    fbOauthHelper: "Facebook Lead Ads працює через підключення Meta Ads. Після підключення Meta Ads тут з’являться форми, ліди та webhook-події.",
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
    fbSyncRunsEmpty: "Запуски синхронізації з’являться після першої синхронізації.",
    fbManualSync: "Ручна синхронізація лідів",
    fbRunLeadSync: "Запустити синхронізацію лідів",
    fbRunningLeadSync: "Синхронізуємо…",
    fbSyncSubmitNote: "Запускає наявну Edge Function facebook-lead-ads-sync за останні 30 днів через поточну сесію користувача.",
    fbSyncSuccessTitle: "Синхронізацію лідів виконано",
    fbSyncFailedTitle: "Помилка синхронізації лідів",
    fbSyncSuccess: "Синхронізацію лідів виконано.",
    diagnosticsTitle: "Діагностика",
    diagnosticsDescription: "Контекст реклами, кандидати на аномалії та поточні проблеми.",
    adsContext: "Контекст реклами",
    dailyContext: "Щоденний контекст",
    anomalyCandidates: "Кандидати на аномалії",
    recentIssues: "Останні проблеми",
    diagnosticsEmptyTitle: "Діагностика стане доступною після першої успішної синхронізації реклами.",
    diagnosticsEmptyText: "Поки що реальних рекламних даних немає. Після синхронізації тут з’являться контекст реклами, щоденні показники та кандидати на аномалії.",
    adsContextUnavailable: "Очікує першу синхронізацію",
    dailyContextAfterSync: "Очікує дані ефективності",
    anomaliesAfterPerformance: "З’являться після появи даних ефективності",
    noIssues: "Поточних проблем не знайдено.",
    readinessTimeoutLabel: "Таймаут перевірки готовності",
    readinessTimeoutDescription: "Один із запитів готовності перевищив ліміт часу. Це не означає, що підключення не працює, але потребує окремої оптимізації серверної частини.",
    technicalDetails: "Технічні деталі",
    oauthIssue: "Помилка авторизації",
    sectionUnavailable: "Розділ тимчасово недоступний.",
    dataUnavailable: "Дані тимчасово недоступні.",
    limitedRows: "Показано {shown} із {total}. Повний набір приховано в технічних деталях.",
    emptyFields: "Дані є, але немає полів для відображення.",
    yes: "Так",
    no: "Ні",
    statusLabels: {
      ads_setup_required: "Потрібно підключити рекламні акаунти",
      meta: "Meta Ads",
      meta_ads: "Meta Ads",
      "meta ads": "Meta Ads",
      facebook: "Meta Ads",
      google: "Google Ads",
      google_ads: "Google Ads",
      "google ads": "Google Ads",
      tiktok: "TikTok Ads",
      tiktok_ads: "TikTok Ads",
      "tiktok ads": "TikTok Ads",
      facebook_lead_ads: "Facebook Lead Ads",
      "facebook lead ads": "Facebook Lead Ads",
      fb_lead_ads: "Facebook Lead Ads",
      healthy: "Все працює",
      unavailable: "Даних ще немає",
      no_active_connections: "Немає активних реальних підключень",
      need_mapping: "Потрібен мапінг",
      needs_mapping: "Потрібен мапінг",
      in_review: "На перевірці",
      needs_review: "Потребує перевірки",
      disabled: "Вимкнено",
      enabled: "Увімкнено",
      active: "Активно",
      inactive: "Неактивно",
      ready: "Готово",
      ok: "Готово",
      connected: "Підключено",
      confirmed: "Підтверджено",
      success: "Успішно",
      pending: "Очікує",
      rejected: "Відхилено",
      failed: "Помилка",
      error: "Помилка",
      archived: "Архівовано",
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
      facebookLeadAds: "Facebook Lead Ads",
      diagnostics: "Diagnostics",
    },
    overviewTitle: "Operational overview",
    overviewSubtitle: "A concise readiness summary for connections, accounts, and synced data.",
    connectionStatus: "Connection status",
    adAccountsKpi: "Ready accounts",
    syncData: "Sync data",
    connectionStatusHelper: "Meta Ads and TikTok Ads are connected. Facebook Lead Ads works through Meta Ads.",
    adAccountsHelper: "Meta Ads is ready. TikTok is connected without data. Google Ads is waiting for API access.",
    syncVerifiedStatus: "Sync verified",
    syncVerifiedNoRows: "Connectors work; no data yet",
    needsAttention: "Needs attention",
    nextAction: "Next action",
    nextActionDescription: "Check ad accounts and link them to projects/funnels in Data links.",
    nextActionGoogle: "Google Ads: waiting for Basic Access / Google Ads API access.",
    googleNeedsAccess: "Google Ads: OAuth is connected, but sync is waiting for Google Ads API / Basic Access.",
    tiktokNoDataYetAttention: "TikTok Ads: sync works, but the test ad account has no data yet.",
    facebookLeadFormsAttention: "Facebook Lead Ads: no forms found. Sync and webhook are verified; real leads will appear after forms/events exist.",
    noCriticalActions: "No critical actions. Sync checks completed without errors.",
    adAccountsFoundButEmpty: "Accounts are found; some connectors still have no ad data.",
    syncCheckedNoRows: "Recent sync checks completed without errors; rows are empty because the accounts have no data.",
    readyAfterOauth: "Waiting for connection",
    accountsNeedConnection: "Ad accounts need to be connected",
    noRealSyncDataYet: "No real sync data yet",
    noDataYet: "No data yet",
    technicalStatus: "Technical status",
    operationalChecklist: "Production readiness",
    oauthStartCallback: "Secure connection",
    realOAuthStillNeeded: "Real OAuth connections",
    placeholderAccountsNotReal: "Ad accounts found",
    realDataAfterFirstSync: "Sync verified",
    connectionsTitle: "Connections",
    connectionsDescription: "Secure connections for advertising platforms.",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    oauthSuccessTitle: "Meta Ads connected",
    oauthSuccessDescription: "Meta Ads connected. Now check ad accounts.",
    oauthErrorTitle: "Meta Ads could not be connected",
    oauthErrorDescription: "Try reconnecting or check the callback function message.",
    checkAdAccounts: "Check ad accounts",
    dismiss: "Dismiss",
    cancel: "Cancel",
    currentState: "Current state",
    safety: "What happens after connection",
    availableNow: "Available now",
    toDo: "What to do",
    connectedState: "Connected",
    oauthConnectedState: "OAuth connected",
    metaConnectedState: "Meta Ads connected",
    connectedAccount: "Account",
    activeConnections: "Active connections",
    lastConnected: "Last connected",
    oauthNotCompletedState: "Connection is not completed yet",
    realConnectionNotCreated: "Real connection has not been created yet",
    unknownConnectionState: "Unknown",
    testBindingsNotReal: "Test bindings exist, but connection has not been completed yet.",
    testBindingsNoRealOauth: "Test bindings exist, but there is no real OAuth connection yet.",
    stateManagedThroughMeta: "Through Meta Ads",
    facebookLeadAvailableAfterMeta: "Facebook Lead Ads will become available after Meta Ads is connected.",
    oauthMayCreate: "After connection, the system will create a real connection record.",
    facebookLeadSafetyNote: "Works through Meta Ads. No separate OAuth connection is required.",
    metaSyncVerifiedNote: "Meta Ads sync is verified. There is no data for the period yet.",
    tiktokSyncVerifiedNote: "TikTok Ads sync is verified. The ad account has no data yet.",
    googleAccessPendingNote: "Waiting for Google Ads API access. Sync will become available after Basic Access is approved.",
    googleSyncVerifiedNote: "Google Ads sync is verified.",
    googleDataSyncingNote: "Google Ads data is syncing.",
    metaDataSyncingNote: "Meta Ads data is syncing.",
    tiktokDataSyncingNote: "TikTok Ads data is syncing.",
    syncFailedNote: "The latest sync failed.",
    syncFailedWithErrorNote: "The latest sync failed: {error}",
    facebookLeadVerifiedNote: "Lead Ads sync and webhook endpoint are verified.",
    facebookLeadFormsMissingNote: "No forms found yet. They will appear after Facebook Lead Forms exist or page access is granted.",
    googleOauthConnectedState: "OAuth connected",
    googleAwaitingAccessState: "Awaiting access",
    metaAvailableItems: ["Ad account found.", "Manual sync is available.", "Scheduled sync is configured."],
    tiktokAvailableItems: ["Ad account found.", "365 days sync in 30-day chunks.", "The latest test finished without errors."],
    googleAvailableItems: ["OAuth connection created.", "The ad account will sync after Google Ads API access is available."],
    googleTodoItems: ["Wait for Basic Access / Google Ads API access."],
    facebookLeadAvailableItems: ["No separate OAuth connection is required.", "Manual lead sync is available on the Facebook Leads tab.", "Webhook endpoint is active."],
    metaDescription: "Connect Facebook and Instagram ad accounts through a secure Meta Ads connection.",
    googleDescription: "Connect a Google Ads ad account through secure authorization.",
    tiktokDescription: "Connect a TikTok Business or ad account through secure authorization.",
    facebookLeadDescription: "Uses the Meta Ads connection. No separate connection is required.",
    connectMeta: "Connect Meta Ads",
    connectGoogle: "Connect Google Ads",
    connectTiktok: "Connect TikTok Ads",
    reconnect: "Reconnect",
    disconnect: "Disconnect",
    disconnectMetaTitle: "Disconnect Meta Ads?",
    disconnectTitle: "Disconnect {platform}?",
    disconnectMetaDescription: "Sync will stop. Historical data will remain in the system. You can reconnect the account later.",
    disconnecting: "Disconnecting…",
    disconnectSuccessTitle: "Meta Ads disconnected",
    disconnectSuccessDescription: "Connection was disabled without deleting historical data.",
    disconnectErrorTitle: "Could not disconnect Meta Ads",
    openingOauth: "Opening authorization…",
    oauthUrlMissing: "A secure connection link was not returned.",
    adAccountsTitle: "Ad accounts",
    adAccountsDescription: "Account bindings to clients, projects, and funnels.",
    adAccountsAllExplain: "Real accounts are shown first. Test and archived bindings are available below for review.",
    adAccountsTestExplain: "These records are used for scenario checks. They do not confirm a real connection.",
    adAccountsNoRealExplain: "Real ad accounts will appear after OAuth connection and the first account sync. Service test bindings may appear below.",
    accountSection: "Account",
    realAccountsSection: "Real accounts",
    testAccountsSection: "Test and archived bindings",
    serviceTestBinding: "Service test binding",
    technicalId: "Technical ID",
    bindingSection: "Binding",
    statusSection: "Status",
    archived: "Archived",
    testPlaceholder: "Test binding",
    realAccount: "Real account",
    bindingScope: "Binding",
    accountStatus: "Status",
    testAccountNote: "This is a test binding. It does not confirm a real connection.",
    archivedAccountNote: "This binding is archived. It remains visible for history and review.",
    realAccountHelper: "Real connection is verified for sync.",
    adAccountsEmpty: "Ad accounts are not bound yet.",
    scheduledTitle: "Sync",
    scheduledDescription: "Sync rules, current queue, and manual run controls.",
    scheduledWarning: "Do not run sync until a real OAuth connection and ad account have been verified.",
    timezoneLabel: "Time",
    timezoneUtc: "UTC",
    timezoneLocal: "Local time",
    syncRules: "Sync rules",
    syncDue: "Current queue",
    manualSync: "Manual sync",
    syncRulesEmpty: "No sync rules yet.",
    syncDueEmpty: "There are no sync jobs in the queue right now.",
    runSyncCheck: "Run manual sync",
    runningSync: "Running sync…",
    syncSubmitNote: "Clicking calls the existing secure sync function only when submitted manually.",
    syncSuccess: "Manual sync submitted.",
    syncFailedToastTitle: "Sync failed",
    syncSubmittedToastTitle: "Sync submitted",
    syncError: "Sync finished with an error.",
    detailsDebug: "Additional technical information is available in developer details.",
    fbTitle: "Facebook Lead Ads",
    fbDescription: "Forms, leads, webhook events, and Facebook Lead Ads sync runs.",
    fbOauthHelper: "Facebook Lead Ads uses the Meta Ads connection. After Meta Ads is connected, forms, leads, and webhook events will appear here.",
    healthStatus: "State",
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
    fbManualSync: "Manual lead sync",
    fbRunLeadSync: "Run lead sync",
    fbRunningLeadSync: "Syncing…",
    fbSyncSubmitNote: "Runs the existing facebook-lead-ads-sync Edge Function for the last 30 days with the current user session.",
    fbSyncSuccessTitle: "Lead sync completed",
    fbSyncFailedTitle: "Lead sync failed",
    fbSyncSuccess: "Lead sync completed.",
    diagnosticsTitle: "Diagnostics",
    diagnosticsDescription: "Ads context, anomaly candidates, and current issues.",
    adsContext: "Ads context",
    dailyContext: "Daily context",
    anomalyCandidates: "Anomaly candidates",
    recentIssues: "Recent issues",
    diagnosticsEmptyTitle: "Diagnostics will become available after the first successful ads sync.",
    diagnosticsEmptyText: "No real ads data is available yet. After sync, this page will show ads context, daily metrics, and anomaly candidates.",
    adsContextUnavailable: "Waiting for first sync",
    dailyContextAfterSync: "Waiting for performance data",
    anomaliesAfterPerformance: "Will appear after performance data is available",
    noIssues: "No current issues found.",
    readinessTimeoutLabel: "Readiness query timeout",
    readinessTimeoutDescription: "One readiness query exceeded the time limit. This does not mean the Ads connection is broken, but needs separate backend optimization.",
    technicalDetails: "Technical details",
    oauthIssue: "Authorization error",
    sectionUnavailable: "This section is temporarily unavailable.",
    dataUnavailable: "Data is temporarily unavailable.",
    limitedRows: "Showing {shown} of {total}. Full data is hidden in technical details.",
    emptyFields: "Data exists, but there are no fields to display.",
    yes: "Yes",
    no: "No",
    statusLabels: {
      ads_setup_required: "Ad accounts need to be connected",
      meta: "Meta Ads",
      meta_ads: "Meta Ads",
      "meta ads": "Meta Ads",
      facebook: "Meta Ads",
      google: "Google Ads",
      google_ads: "Google Ads",
      "google ads": "Google Ads",
      tiktok: "TikTok Ads",
      tiktok_ads: "TikTok Ads",
      "tiktok ads": "TikTok Ads",
      facebook_lead_ads: "Facebook Lead Ads",
      "facebook lead ads": "Facebook Lead Ads",
      fb_lead_ads: "Facebook Lead Ads",
      healthy: "Healthy",
      unavailable: "No data yet",
      no_active_connections: "No active real connections",
      need_mapping: "Needs mapping",
      needs_mapping: "Needs mapping",
      in_review: "In review",
      needs_review: "Needs review",
      disabled: "Disabled",
      enabled: "Enabled",
      active: "Active",
      inactive: "Inactive",
      ready: "Ready",
      ok: "Ready",
      connected: "Connected",
      confirmed: "Confirmed",
      success: "Success",
      pending: "Pending",
      rejected: "Rejected",
      failed: "Failed",
      error: "Error",
      archived: "Archived",
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
      health_status: "State",
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
  const [searchParams, setSearchParams] = useSearchParams();
  const oauthParam = searchParams.get("oauth");
  const platformParam = searchParams.get("platform");
  const isMetaCallback = platformParam === "meta_ads" || !platformParam;
  const isMetaOauthSuccess = isMetaCallback && isMetaOauthSuccessParam(oauthParam);
  const isMetaOauthError = isMetaCallback && isMetaOauthErrorParam(oauthParam);
  const requestedTab = searchParams.get("tab");
  const initialTab = isTabKey(requestedTab) ? requestedTab : isMetaOauthSuccess ? "connections" : "overview";
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);
  const [oauthSuccessDismissed, setOauthSuccessDismissed] = useState(false);
  const [oauthErrorDismissed, setOauthErrorDismissed] = useState(false);
  const [disconnectTarget, setDisconnectTarget] = useState<DisconnectTarget>(null);
  const [disconnectLoading, setDisconnectLoading] = useState(false);
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
  const [facebookLeadSyncState, setFacebookLeadSyncState] = useState<SyncRunState>({
    loading: false,
    error: null,
    success: null,
    details: null,
  });
  const [timezoneDisplayMode, setTimezoneDisplayMode] = useState<TimezoneDisplayMode>(() => readStoredTimezoneDisplayMode());
  const [browserTimeZone, setBrowserTimeZone] = useState(() => resolveBrowserTimeZone());

  useEffect(() => {
    const timeZone = resolveBrowserTimeZone();
    setBrowserTimeZone(timeZone);
    localStorage.setItem(TIMEZONE_DISPLAY_MODE_KEY, timezoneDisplayMode);
    localStorage.setItem(TIMEZONE_NAME_KEY, timeZone);
  }, [timezoneDisplayMode]);

  const query = useQuery({
    queryKey: ["ads-connectors-workspace", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const [readiness, snapshot, adBindings, adPlatformConnections, syncRules, syncDue, adsSummary, adsDaily, adsAnomalies, fbHealth, fbForms, fbLeads, fbSyncRuns] = await Promise.all([
        readOptionalView("v_production_backend_readiness"),
        readOptionalView("v_production_backend_snapshot"),
        readOptionalView("v_ad_account_bindings"),
        readAdPlatformConnections(),
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

      return { readiness, snapshot, adBindings, adPlatformConnections, syncRules, syncDue, adsSummary, adsDaily, adsAnomalies, fbHealth, fbForms, fbLeads, fbSyncRuns };
    },
  });

  const overview = useMemo(() => ({
    readiness: query.data?.readiness.rows[0],
    snapshot: query.data?.snapshot.rows[0],
    adsHealth: query.data?.adsSummary.rows[0] ?? query.data?.adsAnomalies.rows[0],
  }), [query.data]);

  const realAccountRows = useMemo(
    () => (query.data?.adBindings.rows ?? []).filter((row) => !isTestOrArchivedAccount(row)),
    [query.data?.adBindings.rows],
  );

  const realSyncDataAvailable = Boolean(
    (query.data?.adsSummary.rows.length ?? 0) > 0 ||
    (query.data?.adsDaily.rows.length ?? 0) > 0 ||
    (query.data?.fbSyncRuns.rows.length ?? 0) > 0,
  );

  const activeMetaConnection = useMemo(
    () => findActiveOAuthConnection("meta", query.data?.adPlatformConnections),
    [query.data?.adPlatformConnections],
  );

  const platformSyncInsights = useMemo(() => ({
    meta: getPlatformSyncInsight("meta", query.data),
    google: getPlatformSyncInsight("google", query.data),
    tiktok: getPlatformSyncInsight("tiktok", query.data),
  }), [query.data]);

  const platformConnectionStates = useMemo(() => ({
    meta: getPlatformConnectionState("meta", query.data?.adBindings, query.data?.adPlatformConnections, platformSyncInsights.meta, ui, lang),
    google: getPlatformConnectionState("google", query.data?.adBindings, query.data?.adPlatformConnections, platformSyncInsights.google, ui, lang),
    tiktok: getPlatformConnectionState("tiktok", query.data?.adBindings, query.data?.adPlatformConnections, platformSyncInsights.tiktok, ui, lang),
  }), [lang, platformSyncInsights, query.data?.adBindings, query.data?.adPlatformConnections, ui]);

  const attentionItems = useMemo(() => buildAttentionItems(platformSyncInsights, query.data, ui), [platformSyncInsights, query.data, ui]);

  const runFacebookLeadSync = async () => {
    if (!session?.access_token) return;

    setFacebookLeadSyncState({ loading: true, error: null, success: null, details: null });

    const { dateFrom, dateTo } = getLastThirtyDaysRange();
    const { data, error } = await supabase.functions.invoke("facebook-lead-ads-sync", {
      headers: { Authorization: `Bearer ${session.access_token}` },
      body: {
        workspace_id: WORKSPACE_ID,
        sync_mode: "manual",
        date_from: dateFrom,
        date_to: dateTo,
      },
    });

    if (error) {
      const errorDetails = await readFunctionErrorDetails(error);
      setFacebookLeadSyncState({ loading: false, error: errorDetails, success: null, details: null });
      toast({ title: ui.fbSyncFailedTitle, description: errorDetails, variant: "destructive" });
      return;
    }

    const details = toObject(data);
    const message = buildFacebookLeadSyncSuccessMessage(details, ui);

    setFacebookLeadSyncState({ loading: false, error: null, success: message, details });
    toast({ title: ui.fbSyncSuccessTitle, description: message });

    await Promise.all([
      query.refetch(),
      queryClient.invalidateQueries({ queryKey: ["ads-connectors-workspace", WORKSPACE_ID] }),
      queryClient.invalidateQueries({ queryKey: ["facebook-lead-ads"] }),
      queryClient.invalidateQueries({ queryKey: ["facebook-lead-sync-runs"] }),
    ]);
  };

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


  const disconnectConnection = async () => {
    if (!disconnectTarget) return;
    setDisconnectLoading(true);
    const { error } = await supabase.rpc("disconnect_ad_platform_connection" as never, {
      p_workspace_id: WORKSPACE_ID,
      p_connection_id: disconnectTarget.id,
      p_reason: "user_disconnect",
    } as never);

    if (error) {
      setDisconnectLoading(false);
      toast({ title: ui.disconnectErrorTitle, description: error.message, variant: "destructive" });
      return;
    }

    await Promise.all([
      query.refetch(),
      queryClient.invalidateQueries({ queryKey: ["ads-connectors-workspace", WORKSPACE_ID] }),
    ]);
    setDisconnectLoading(false);
    setDisconnectTarget(null);
    toast({ title: ui.disconnectSuccessTitle, description: ui.disconnectSuccessDescription });
  };

  const connectionRaw = readString(overview.snapshot, "ads_connector_status");
  const hasRealOAuth = Boolean(platformConnectionStates.meta.activeConnection || platformConnectionStates.google.activeConnection || platformConnectionStates.tiktok.activeConnection) || connectionRaw === "active" || connectionRaw === "healthy" || connectionRaw === "connected" || realAccountRows.length > 0;
  const overviewConnectionStatus = hasRealOAuth ? ui.connectedState : connectionRaw ? ui.readyAfterOauth : ui.noDataYet;
  const overviewAdAccountsStatus = realAccountRows.length > 0 ? formatMetric(realAccountRows.length) : ui.accountsNeedConnection;
  const overviewSyncStatus = realSyncDataAvailable ? ui.syncVerifiedStatus : ui.syncVerifiedNoRows;

  const refreshStatus = async () => {
    await query.refetch();
    await queryClient.invalidateQueries({ queryKey: ["ads-connectors-workspace", WORKSPACE_ID] });
  };

  const selectTab = (tab: string) => {
    if (!isTabKey(tab)) return;
    setActiveTab(tab);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.set("tab", tab);
    setSearchParams(nextParams, { replace: true });
  };

  const dismissOauthBanner = (kind: "success" | "error") => {
    if (kind === "success") setOauthSuccessDismissed(true);
    else setOauthErrorDismissed(true);
    const nextParams = new URLSearchParams(searchParams);
    nextParams.delete("oauth");
    nextParams.delete("platform");
    setSearchParams(nextParams, { replace: true });
  };

  const headerActions = session && !query.isLoading && !query.error ? (
    <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-xs" onClick={() => void refreshStatus()} disabled={query.isFetching}>
      <RefreshCw className={cn("h-3.5 w-3.5", query.isFetching && "animate-spin")} />
      {query.isFetching ? ui.refreshing : ui.refresh}
    </Button>
  ) : null;

  return (
    <DashboardLayout title={ui.pageTitle} subtitle={ui.pageSubtitle} actions={headerActions} contentClassName="pt-1 lg:pt-2">
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
          {!roleLoading && !canManage ? <p className="text-xs text-muted-foreground">{ui.noManageAccess}</p> : null}
          {!roleLoading && roleError ? <p className="text-xs text-muted-foreground">{ui.roleUnavailable}</p> : null}
          {isMetaOauthSuccess && !oauthSuccessDismissed ? (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/30 dark:text-emerald-100">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold">{ui.oauthSuccessTitle}</p>
                  <p className="mt-1">{ui.oauthSuccessDescription}</p>
                </div>
                <div className="flex shrink-0 flex-wrap gap-2">
                  <Button type="button" size="sm" variant="secondary" onClick={() => selectTab("ad-accounts")}>{ui.checkAdAccounts}</Button>
                  <Button type="button" size="sm" variant="ghost" onClick={() => dismissOauthBanner("success")}>{ui.dismiss}</Button>
                </div>
              </div>
            </div>
          ) : null}
          {isMetaOauthError && !oauthErrorDismissed ? (
            <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-100">
              <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <p className="font-semibold">{ui.oauthErrorTitle}</p>
                  <p className="mt-1">{ui.oauthErrorDescription}</p>
                </div>
                <Button type="button" size="sm" variant="ghost" onClick={() => dismissOauthBanner("error")}>{ui.dismiss}</Button>
              </div>
            </div>
          ) : null}
          <Tabs value={activeTab} onValueChange={selectTab} className="space-y-2">
            <div className="overflow-x-auto rounded-xl border border-border/70 bg-muted/30 px-2 py-2 shadow-sm">
              <TabsList className="inline-flex h-auto w-max min-w-full items-center justify-start gap-1.5 bg-transparent p-0 text-muted-foreground">
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="overview">{ui.tabs.overview}</TabsTrigger>
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="connections">{ui.tabs.connections}</TabsTrigger>
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="ad-accounts">{ui.tabs.adAccounts}</TabsTrigger>
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="sync">{ui.tabs.sync}</TabsTrigger>
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="facebook-lead-ads">{ui.tabs.facebookLeadAds}</TabsTrigger>
                <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="diagnostics">{ui.tabs.diagnostics}</TabsTrigger>
              </TabsList>
            </div>

            <TabsContent value="overview" className="mt-1">
              <SectionCard title={ui.overviewTitle} description={ui.overviewSubtitle} accent>
                <div className="grid gap-3 text-sm md:grid-cols-3">
                  <StatusCard label={ui.connectionStatus} value={overviewConnectionStatus} helper={hasRealOAuth ? ui.connectionStatusHelper : undefined} />
                  <StatusCard label={ui.adAccountsKpi} value={overviewAdAccountsStatus} helper={realAccountRows.length > 0 ? ui.adAccountsHelper : undefined} />
                  <StatusCard label={ui.syncData} value={overviewSyncStatus} helper={realSyncDataAvailable ? ui.syncCheckedNoRows : ui.syncVerifiedNoRows} />
                </div>
                <div className="mt-4 rounded-lg border border-border/70 bg-background/60 p-4">
                  <p className="text-sm font-semibold">{ui.operationalChecklist}</p>
                  <div className="mt-3 grid gap-2 md:grid-cols-2">
                    <ReadinessStep label={ui.oauthStartCallback} tone="success" />
                    <ReadinessStep label={ui.realOAuthStillNeeded} tone={hasRealOAuth ? "success" : "warning"} />
                    <ReadinessStep label={ui.placeholderAccountsNotReal} value={ui.adAccountsFoundButEmpty} tone={realAccountRows.length > 0 ? "warning" : "muted"} />
                    <ReadinessStep label={ui.realDataAfterFirstSync} value={ui.syncCheckedNoRows} tone={realSyncDataAvailable ? "success" : "warning"} />
                  </div>
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-2">
                  <div className={cn(
                    "rounded-lg border p-4 text-sm",
                    attentionItems.length > 0
                      ? "border-amber-200 bg-amber-50/70 text-amber-950 dark:border-amber-900/60 dark:bg-amber-950/20 dark:text-amber-100"
                      : "border-emerald-200 bg-emerald-50/70 text-emerald-950 dark:border-emerald-900/60 dark:bg-emerald-950/20 dark:text-emerald-100",
                  )}>
                    <p className="font-semibold">{ui.needsAttention}</p>
                    {attentionItems.length > 0 ? (
                      <ul className="mt-2 list-disc space-y-1 pl-5 text-xs leading-5">
                        {attentionItems.map((item) => <li key={item}>{item}</li>)}
                      </ul>
                    ) : (
                      <p className="mt-2 text-xs leading-5">{ui.noCriticalActions}</p>
                    )}
                  </div>
                  <div className="rounded-lg border border-border/70 bg-background/60 p-4 text-sm">
                    <p className="font-semibold">{ui.nextAction}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{ui.nextActionDescription}</p>
                    <p className="mt-2 text-xs leading-5 text-muted-foreground">{ui.nextActionGoogle}</p>
                  </div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="connections" className="mt-1">
              <SectionCard title={ui.connectionsTitle} description={ui.connectionsDescription}>
                <div className="grid gap-3 md:grid-cols-2">
                  <ConnectorCard
                    name="Meta Ads"
                    description={ui.metaDescription}
                    buttonText={ui.connectMeta}
                    stateText={platformConnectionStates.meta.label}
                    stateTone={platformConnectionStates.meta.tone}
                    currentStateText={platformConnectionStates.meta.currentState}
                    helperNote={platformConnectionStates.meta.note}
                    details={platformConnectionStates.meta.details}
                    availableItems={platformConnectionStates.meta.availableItems}
                    activeConnection={platformConnectionStates.meta.activeConnection}
                    state={connectorState.meta}
                    onConnect={() => void connect("meta")}
                    onDisconnect={(connection) => setDisconnectTarget({ id: connection.id, name: "Meta Ads" })}
                    canManage={canManage}
                    ui={ui}
                  />
                  <ConnectorCard
                    name="Google Ads"
                    description={ui.googleDescription}
                    buttonText={ui.connectGoogle}
                    stateText={platformConnectionStates.google.label}
                    stateTone={platformConnectionStates.google.tone}
                    currentStateText={platformConnectionStates.google.currentState}
                    helperNote={platformConnectionStates.google.note}
                    details={platformConnectionStates.google.details}
                    availableItems={platformConnectionStates.google.availableItems}
                    todoItems={platformConnectionStates.google.todoItems}
                    activeConnection={platformConnectionStates.google.activeConnection}
                    state={connectorState.google}
                    onConnect={() => void connect("google")}
                    onDisconnect={(connection) => setDisconnectTarget({ id: connection.id, name: "Google Ads" })}
                    canManage={canManage}
                    ui={ui}
                  />
                  <ConnectorCard
                    name="TikTok Ads"
                    description={ui.tiktokDescription}
                    buttonText={ui.connectTiktok}
                    stateText={platformConnectionStates.tiktok.label}
                    stateTone={platformConnectionStates.tiktok.tone}
                    currentStateText={platformConnectionStates.tiktok.currentState}
                    helperNote={platformConnectionStates.tiktok.note}
                    details={platformConnectionStates.tiktok.details}
                    availableItems={platformConnectionStates.tiktok.availableItems}
                    activeConnection={platformConnectionStates.tiktok.activeConnection}
                    state={connectorState.tiktok}
                    onConnect={() => void connect("tiktok")}
                    onDisconnect={(connection) => setDisconnectTarget({ id: connection.id, name: "TikTok Ads" })}
                    canManage={canManage}
                    ui={ui}
                  />
                  <div className="flex h-full flex-col rounded-lg border border-border/70 bg-card/60 p-4 text-sm">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold">Facebook Lead Ads</p>
                        <p className="mt-1 text-muted-foreground">{activeMetaConnection ? ui.facebookLeadSafetyNote : ui.facebookLeadAvailableAfterMeta}</p>
                        {activeMetaConnection ? <p className="mt-1 text-muted-foreground">{ui.facebookLeadVerifiedNote}</p> : null}
                        {activeMetaConnection ? <p className="mt-1 text-muted-foreground">{ui.facebookLeadFormsMissingNote}</p> : null}
                      </div>
                      <StatusPill tone={activeMetaConnection ? "warning" : "muted"}>{ui.stateManagedThroughMeta}</StatusPill>
                    </div>
                    <div className="mt-3 grid gap-2 text-xs text-muted-foreground">
                      <p><span className="font-medium text-foreground">{ui.currentState}:</span> {activeMetaConnection ? ui.metaConnectedState : ui.facebookLeadAvailableAfterMeta}</p>
                      <div className="rounded-md bg-muted/40 p-3">
                        <p className="font-medium text-foreground">{activeMetaConnection ? ui.availableNow : ui.safety}</p>
                        <ul className="mt-2 list-disc space-y-1 pl-4">
                          {(activeMetaConnection ? ui.facebookLeadAvailableItems : [ui.facebookLeadSafetyNote]).map((item) => <li key={item}>{item}</li>)}
                        </ul>
                      </div>
                    </div>
                    <div className="mt-auto pt-3 text-xs text-muted-foreground">
                      {activeMetaConnection ? ui.metaConnectedState : ui.facebookLeadAvailableAfterMeta}
                    </div>
                  </div>
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="ad-accounts" className="mt-1">
              <SectionCard title={ui.adAccountsTitle} description={ui.adAccountsDescription}>
                <AdAccountsTable data={query.data?.adBindings} ui={ui} />
              </SectionCard>
            </TabsContent>

            <TabsContent value="sync" className="mt-1">
              <SectionCard title={ui.scheduledTitle} description={ui.scheduledDescription}>
                <div className="space-y-4">
                  <WarningNotice>{ui.scheduledWarning}</WarningNotice>
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end">
                    <label className="text-xs font-medium text-muted-foreground" htmlFor="ads-sync-timezone-mode">{ui.timezoneLabel}</label>
                    <Select value={timezoneDisplayMode} onValueChange={(value: TimezoneDisplayMode) => setTimezoneDisplayMode(value)}>
                      <SelectTrigger id="ads-sync-timezone-mode" className="h-8 w-full text-xs sm:w-[150px]">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="utc">{ui.timezoneUtc}</SelectItem>
                        <SelectItem value="local">{ui.timezoneLocal}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-4 lg:grid-cols-2">
                    <CompactDataSection title={ui.syncRules} data={query.data?.syncRules} columns={["platform", "status", "last_run_at", "next_run_at"]} emptyText={ui.syncRulesEmpty} ui={ui} timestampDisplayMode={timezoneDisplayMode} browserTimeZone={browserTimeZone} />
                    <CompactDataSection title={ui.syncDue} data={query.data?.syncDue} columns={["platform", "status", "last_run_at", "next_run_at"]} emptyText={ui.syncDueEmpty} ui={ui} timestampDisplayMode={timezoneDisplayMode} browserTimeZone={browserTimeZone} />
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

            <TabsContent value="facebook-lead-ads" className="mt-1">
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
                <p className="mt-3 rounded-md bg-muted/40 p-3 text-xs text-muted-foreground">{ui.fbOauthHelper}</p>
                <div className="mt-4 rounded-lg border border-border/70 bg-card/50 p-4">
                  <p className="mb-3 text-sm font-semibold">{ui.fbManualSync}</p>
                  <Button type="button" onClick={() => void runFacebookLeadSync()} disabled={!session || !canManage || facebookLeadSyncState.loading}>
                    {facebookLeadSyncState.loading ? ui.fbRunningLeadSync : ui.fbRunLeadSync}
                  </Button>
                  <p className="mt-2 text-xs text-muted-foreground">{ui.fbSyncSubmitNote}</p>
                  {facebookLeadSyncState.success && <p className="mt-2 text-xs text-emerald-700">{facebookLeadSyncState.success}</p>}
                  {facebookLeadSyncState.error && <p className="mt-2 text-xs text-destructive">{facebookLeadSyncState.error}</p>}
                  {facebookLeadSyncState.details ? <p className="mt-2 text-xs text-muted-foreground">{ui.detailsDebug}</p> : null}
                  <DeveloperDetails title={ui.technicalDetails}>{facebookLeadSyncState.details ? <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-xs text-muted-foreground">{JSON.stringify(facebookLeadSyncState.details, null, 2)}</pre> : null}</DeveloperDetails>
                </div>
                <div className="mt-4 space-y-4">
                  <CompactDataSection title={ui.formsTitle} data={query.data?.fbForms} columns={["form_name", "form_id", "status", "mapping_status", "leads_count", "updated_at"]} emptyText={ui.fbFormsEmpty} ui={ui} />
                  <CompactDataSection title={ui.leadsTitle} data={query.data?.fbLeads} columns={["created_at", "status", "form_name", "client_name", "project_name", "error_message"]} emptyText={ui.fbLeadsEmpty} ui={ui} />
                  <CompactDataSection title={ui.syncRunsTitle} data={query.data?.fbSyncRuns} columns={["created_at", "status", "last_run_at", "updated_at", "error_message"]} emptyText={ui.fbSyncRunsEmpty} ui={ui} />
                </div>
              </SectionCard>
            </TabsContent>

            <TabsContent value="diagnostics" className="mt-1">
              <SectionCard title={ui.diagnosticsTitle} description={ui.diagnosticsDescription}>
                <DiagnosticsPanel data={query.data} connectorState={connectorState} ui={ui} />
              </SectionCard>
            </TabsContent>
          </Tabs>
          <AlertDialog open={Boolean(disconnectTarget)} onOpenChange={(open) => !open && !disconnectLoading && setDisconnectTarget(null)}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>{formatDisconnectTitle(ui, disconnectTarget)}</AlertDialogTitle>
                <AlertDialogDescription>{ui.disconnectMetaDescription}</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={disconnectLoading}>{ui.cancel}</AlertDialogCancel>
                <AlertDialogAction
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  disabled={disconnectLoading}
                  onClick={(event) => {
                    event.preventDefault();
                    void disconnectConnection();
                  }}
                >
                  {disconnectLoading ? ui.disconnecting : ui.disconnect}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
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

async function readAdPlatformConnections(): Promise<OptionalViewData> {
  const safeColumns = [
    "id",
    "workspace_id",
    "platform",
    "connection_name",
    "status",
    "provider_business_name",
    "provider_account_email",
    "last_connected_at",
    "token_expires_at",
  ].join(",");
  const result = await supabase.from("ad_platform_connections").select(safeColumns).eq("workspace_id", WORKSPACE_ID).limit(50);
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

function StatusCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/60 p-4">
      <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className="mt-2 text-lg font-semibold leading-tight">{value}</p>
      {helper ? <p className="mt-2 text-xs leading-5 text-muted-foreground">{helper}</p> : null}
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

function ConnectorCard({
  name,
  description,
  buttonText,
  stateText,
  currentStateText,
  stateTone,
  helperNote,
  details,
  availableItems,
  todoItems,
  activeConnection,
  state,
  onConnect,
  onDisconnect,
  canManage,
  ui,
}: {
  name: string;
  description: string;
  buttonText: string;
  stateText: string;
  currentStateText?: string;
  stateTone: Tone;
  helperNote?: string;
  details?: string[];
  availableItems?: readonly string[];
  todoItems?: readonly string[];
  activeConnection?: ActiveConnectionDetails | null;
  state: ConnectorState;
  onConnect: () => void;
  onDisconnect?: (connection: ActiveConnectionDetails) => void;
  canManage: boolean;
  ui: Copy;
}) {
  const connected = Boolean(activeConnection);
  return (
    <div className="flex h-full flex-col rounded-xl border border-border/70 bg-card/70 p-4 text-sm shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold leading-none">{name}</p>
          <p className="mt-2 text-sm leading-5 text-muted-foreground">{description}</p>
        </div>
        <StatusPill tone={stateTone}>{stateText}</StatusPill>
      </div>
      <div className="mt-4 grid gap-3 text-xs text-muted-foreground">
        <div className="rounded-lg bg-muted/30 p-3">
          <p className="font-medium text-foreground">{ui.currentState}</p>
          <p className="mt-1">{currentStateText ?? (connected ? ui.oauthConnectedState : ui.oauthNotCompletedState)}</p>
        </div>
        {details?.length ? (
          <div className="grid gap-2 sm:grid-cols-2">
            {details.map((detail) => <p className="rounded-md bg-background/70 px-3 py-2" key={detail}>{detail}</p>)}
          </div>
        ) : null}
        {helperNote ? <WarningNotice>{helperNote}</WarningNotice> : null}
        <div className="rounded-md bg-muted/40 p-3">
          <p className="font-medium text-foreground">{connected ? ui.availableNow : ui.safety}</p>
          {connected && availableItems?.length ? (
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {availableItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          ) : <p className="mt-1">{ui.oauthMayCreate}</p>}
        </div>
        {connected && todoItems?.length ? (
          <div className="rounded-md bg-muted/40 p-3">
            <p className="font-medium text-foreground">{ui.toDo}</p>
            <ul className="mt-2 list-disc space-y-1 pl-4">
              {todoItems.map((item) => <li key={item}>{item}</li>)}
            </ul>
          </div>
        ) : null}
      </div>
      <div className="mt-auto flex items-center justify-between gap-2 pt-4">
        {connected && activeConnection ? (
          <>
            <Button type="button" size="sm" variant="secondary" className="h-8" onClick={onConnect} disabled={state.loading || !canManage}>
              {state.loading ? ui.openingOauth : ui.reconnect}
            </Button>
            {onDisconnect ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button type="button" size="icon" variant="ghost" className="h-8 w-8" disabled={!canManage || state.loading} aria-label={ui.disconnect}>
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="end">
                  <DropdownMenuItem className="text-destructive focus:text-destructive" onSelect={() => onDisconnect(activeConnection)}>
                    {ui.disconnect}
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : null}
          </>
        ) : (
          <Button type="button" size="sm" className="h-8" onClick={onConnect} disabled={state.loading || !canManage}>
            {state.loading ? ui.openingOauth : buttonText}
          </Button>
        )}
      </div>
      {state.error && <p className="mt-2 text-xs text-destructive">{state.error}</p>}
    </div>
  );
}

function AdAccountsTable({ data, ui }: { data: OptionalViewData | undefined; ui: Copy }) {
  if (!data) return <p className="text-sm text-muted-foreground">{ui.dataUnavailable}</p>;
  if (data.unavailableReason) return <UnavailableMessage reason={data.unavailableReason} ui={ui} />;
  if (data.rows.length === 0) return <p className="text-sm text-muted-foreground">{ui.adAccountsEmpty}</p>;

  const realRows = data.rows.filter((row) => !isTestOrArchivedAccount(row)).sort(sortAdAccountsForDisplay);
  const testRows = data.rows.filter(isTestOrArchivedAccount).sort(sortAdAccountsForDisplay);

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-border/70 bg-muted/20 p-3 text-sm text-muted-foreground">
        <p>{ui.adAccountsAllExplain}</p>
        {testRows.length > 0 ? <p className="mt-1 text-xs">{ui.adAccountsTestExplain}</p> : null}
        {realRows.length === 0 ? <p className="mt-1 text-xs">{ui.adAccountsNoRealExplain}</p> : null}
      </div>

      <AdAccountSection title={ui.realAccountsSection} emptyText={realRows.length === 0 ? ui.adAccountsNoRealExplain : undefined}>
        {realRows.length > 0 ? realRows.map((row, index) => <AdAccountCard key={`real-${index}-${String(row.external_account_id ?? row.id ?? "account")}`} row={row} ui={ui} />) : null}
      </AdAccountSection>

      {testRows.length > 0 ? (
        <AdAccountSection title={ui.testAccountsSection} helper={ui.adAccountsTestExplain} secondary compact>
          {testRows.map((row, index) => <AdAccountCard key={`test-${index}-${String(row.external_account_id ?? row.id ?? "account")}`} row={row} ui={ui} compact />)}
        </AdAccountSection>
      ) : null}
    </div>
  );
}


function AdAccountSection({ title, helper, emptyText, secondary = false, compact = false, children }: { title: string; helper?: string; emptyText?: string; secondary?: boolean; compact?: boolean; children: ReactNode }) {
  return (
    <section className={cn("space-y-3", secondary && "border-t border-border/70 pt-4")}>
      <div>
        <p className="text-sm font-semibold">{title}</p>
        {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
      </div>
      {emptyText ? <p className="rounded-lg border border-dashed border-border/70 bg-card/40 p-4 text-sm text-muted-foreground">{emptyText}</p> : null}
      <div className={cn("grid xl:grid-cols-2", compact ? "gap-2" : "gap-3")}>{children}</div>
    </section>
  );
}

function AdAccountCard({ row, ui, compact = false }: { row: Row; ui: Copy; compact?: boolean }) {
  const testBinding = hasTestBindingMarker(row);
  const archived = isArchivedAccount(row);
  const testOrArchived = testBinding || archived;
  const activeRealAccount = !testOrArchived && isActiveAccountBinding(row);
  const mappingStatus = activeRealAccount ? ui.statusLabels.confirmed : row.mapping_status;
  const bindingStatus = archived ? ui.archived : activeRealAccount ? ui.statusLabels.active : row.binding_status;
  const accountNote = testBinding ? ui.testAccountNote : archived ? ui.archivedAccountNote : ui.realAccountHelper;
  const technicalAccountId = row.external_account_id ?? row.ad_account_name;

  return (
    <article className={cn(
      "flex h-full flex-col rounded-lg border text-sm",
      testOrArchived ? "border-border/60 bg-muted/15 p-3 shadow-none" : "border-border/70 bg-card/60 p-4",
    )}>
      <div className={cn("flex flex-wrap items-start justify-between", compact ? "gap-2" : "gap-3")}>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-muted-foreground">{ui.accountSection}</p>
          <p className="mt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{ui.columnLabels.platform}</p>
          <p className={cn("mt-1 font-semibold text-foreground", compact ? "text-sm" : "text-base")}>{formatValue(row.platform, ui)}</p>
          {testOrArchived ? <p className="mt-1.5 text-sm font-semibold text-foreground">{ui.serviceTestBinding}</p> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <StatusPill tone={testOrArchived ? "warning" : "success"}>{testOrArchived ? ui.testPlaceholder : ui.realAccount}</StatusPill>
          {archived ? <StatusPill tone="muted">{ui.archived}</StatusPill> : null}
        </div>
      </div>

      <div className={cn(
        compact ? "mt-3 rounded-md px-2.5 py-1.5" : "mt-4 rounded-md px-3 py-2",
        testOrArchived ? "bg-background/55" : "bg-muted/30",
      )}>
        {testOrArchived ? (
          <p className="break-all font-mono text-xs text-muted-foreground">{ui.technicalId}: {formatValue(technicalAccountId, ui)}</p>
        ) : (
          <>
            <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{ui.columnLabels.external_account_id}</p>
            <p className="mt-1 break-all font-mono text-sm text-foreground">{formatValue(row.external_account_id, ui)}</p>
          </>
        )}
      </div>

      <div className={cn("grid lg:grid-cols-2", compact ? "mt-3 gap-3" : "mt-4 gap-4")}>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{ui.bindingSection}</p>
          <div className={cn("grid sm:grid-cols-3 lg:grid-cols-1", compact ? "gap-1.5" : "gap-2")}>
            <AccountField label={ui.columnLabels.client_name} value={row.client_name} ui={ui} compact={compact} />
            <AccountField label={ui.columnLabels.project_name} value={row.project_name} ui={ui} compact={compact} />
            <AccountField label={ui.columnLabels.funnel_name} value={row.funnel_name} ui={ui} compact={compact} />
          </div>
        </div>
        <div>
          <p className="mb-2 text-xs font-semibold text-muted-foreground">{ui.statusSection}</p>
          <div className={cn("grid sm:grid-cols-3 lg:grid-cols-1", compact ? "gap-1.5" : "gap-2")}>
            <AccountField label={ui.columnLabels.mapping_status} value={mappingStatus} ui={ui} compact={compact} />
            <AccountField label={ui.columnLabels.binding_status} value={bindingStatus} ui={ui} compact={compact} />
            <AccountField label={ui.columnLabels.confidence} value={row.confidence} ui={ui} compact={compact} />
          </div>
        </div>
      </div>

      <div className={cn("mt-auto", compact ? "pt-3" : "pt-4")}>
        {testOrArchived ? <WarningNotice>{accountNote}</WarningNotice> : <p className="text-xs text-muted-foreground">{accountNote}</p>}
      </div>
    </article>
  );
}

function AccountField({ label, value, ui, compact = false }: { label: string; value: unknown; ui: Copy; compact?: boolean }) {
  return (
    <div className={cn("min-w-0 rounded-md bg-muted/30", compact ? "px-2.5 py-1.5" : "px-3 py-2")}>
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</p>
      <p className={cn("mt-1 break-words text-foreground", compact ? "text-xs" : "text-sm")}>{formatValue(value, ui)}</p>
    </div>
  );
}

type TimezoneFormattingOptions = { timestampDisplayMode?: TimezoneDisplayMode; browserTimeZone?: string };

function CompactDataSection({ title, data, columns, emptyText, ui, maxRows, timestampDisplayMode, browserTimeZone }: { title: string; data: OptionalViewData | undefined; columns: string[]; emptyText: string; ui: Copy; maxRows?: number } & TimezoneFormattingOptions) {
  return (
    <div className="rounded-lg border border-border/70 bg-card/50 p-3">
      <p className="mb-2 text-sm font-semibold">{title}</p>
      <OptionalKnownColumns data={data} columns={columns} emptyText={emptyText} ui={ui} maxRows={maxRows} timestampDisplayMode={timestampDisplayMode} browserTimeZone={browserTimeZone} />
    </div>
  );
}

function OptionalKnownColumns({ data, columns, emptyText, ui, maxRows, timestampDisplayMode, browserTimeZone }: { data: OptionalViewData | undefined; columns: string[]; emptyText: string; ui: Copy; maxRows?: number } & TimezoneFormattingOptions) {
  if (!data) return <p className="text-sm text-muted-foreground">{ui.dataUnavailable}</p>;
  if (data.unavailableReason) return <UnavailableMessage reason={data.unavailableReason} ui={ui} />;
  const filtered = columns.filter((column) => data.rows.some((row) => row[column] !== undefined));
  return filtered.length === 0 ? <GenericTable rows={data.rows} emptyText={emptyText} ui={ui} maxRows={maxRows} timestampDisplayMode={timestampDisplayMode} browserTimeZone={browserTimeZone} /> : <GenericDataTable rows={data.rows} columns={filtered} ui={ui} maxRows={maxRows} timestampDisplayMode={timestampDisplayMode} browserTimeZone={browserTimeZone} />;
}

function GenericTable({ rows, emptyText, ui, maxRows, timestampDisplayMode, browserTimeZone }: { rows: Row[]; emptyText: string; ui: Copy; maxRows?: number } & TimezoneFormattingOptions) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const columns = Object.keys(rows[0] ?? {}).filter((column) => column !== "workspace_id");
  if (columns.length === 0) return <p className="text-sm text-muted-foreground">{ui.emptyFields}</p>;
  return <GenericDataTable rows={rows} columns={columns} ui={ui} maxRows={maxRows} timestampDisplayMode={timestampDisplayMode} browserTimeZone={browserTimeZone} />;
}

function GenericDataTable({ rows, columns, ui, markPlaceholders = false, maxRows, timestampDisplayMode, browserTimeZone }: { rows: Row[]; columns: string[]; ui: Copy; markPlaceholders?: boolean; maxRows?: number } & TimezoneFormattingOptions) {
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
                    <span className={cn(isTimestampColumn(column) && timestampDisplayMode ? "whitespace-nowrap" : "break-words")}>{formatTableValue(row[column], column, ui, timestampDisplayMode, browserTimeZone)}</span>
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


function DiagnosticsPanel({ data, connectorState, ui }: { data: { [k: string]: OptionalViewData } | undefined; connectorState: Record<ConnectorKey, ConnectorState>; ui: Copy }) {
  const hasDiagnosticRows = Boolean(
    (data?.adsSummary.rows.length ?? 0) > 0 ||
    (data?.adsDaily.rows.length ?? 0) > 0 ||
    (data?.adsAnomalies.rows.length ?? 0) > 0,
  );

  return (
    <div className="space-y-4">
      {!hasDiagnosticRows ? (
        <div className="rounded-lg border border-border/70 bg-card/50 p-4">
          <p className="text-sm font-semibold">{ui.diagnosticsEmptyTitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">{ui.diagnosticsEmptyText}</p>
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-3">
          <CompactDataSection title={ui.adsContext} data={data?.adsSummary} columns={preferredColumns(data?.adsSummary?.rows)} emptyText={ui.adsContextUnavailable} ui={ui} maxRows={5} />
          <CompactDataSection title={ui.dailyContext} data={data?.adsDaily} columns={preferredColumns(data?.adsDaily?.rows)} emptyText={ui.dailyContextAfterSync} ui={ui} maxRows={5} />
          <CompactDataSection title={ui.anomalyCandidates} data={data?.adsAnomalies} columns={preferredColumns(data?.adsAnomalies?.rows)} emptyText={ui.anomaliesAfterPerformance} ui={ui} maxRows={5} />
        </div>
      )}

      <div className="grid gap-3 md:grid-cols-3">
        <DiagnosticStatusCard title={ui.adsContext} text={ui.adsContextUnavailable} />
        <DiagnosticStatusCard title={ui.dailyContext} text={ui.dailyContextAfterSync} />
        <DiagnosticStatusCard title={ui.anomalyCandidates} text={ui.anomaliesAfterPerformance} />
      </div>

      <IssuesPanel data={data} connectorState={connectorState} ui={ui} />
    </div>
  );
}

function DiagnosticStatusCard({ title, text }: { title: string; text: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background p-3 text-sm">
      <p className="font-medium">{title}</p>
      <p className="mt-1 text-xs text-muted-foreground">{text}</p>
    </div>
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
            <p className="font-semibold">{ui.oauthIssue}: {connectorDisplayName(connector as ConnectorKey)}</p>
            <p className="mt-1 text-destructive">{state.error}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

function connectorDisplayName(connector: ConnectorKey): string {
  if (connector === "meta") return "Meta Ads";
  if (connector === "google") return "Google Ads";
  return "TikTok Ads";
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

function formatDisconnectTitle(ui: Copy, target: DisconnectTarget): string {
  if (!target || target.name === "Meta Ads") return ui.disconnectMetaTitle;
  return ui.disconnectTitle.replace("{platform}", target.name);
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

function formatTableValue(value: unknown, column: string, ui: Copy, timestampDisplayMode?: TimezoneDisplayMode, browserTimeZone?: string): string {
  if (timestampDisplayMode && isTimestampColumn(column)) {
    return formatOperationalTimestamp(value, timestampDisplayMode, browserTimeZone);
  }

  return formatValue(value, ui);
}

function isTimestampColumn(column: string): boolean {
  return column.endsWith("_at") || column.endsWith("_time") || column === "timestamp";
}

function formatOperationalTimestamp(value: unknown, mode: TimezoneDisplayMode, browserTimeZone = resolveBrowserTimeZone()): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "string" && typeof value !== "number") return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  if (mode === "local") {
    const displayTimeZone = browserTimeZone || "Local";
    const formatterTimeZone = displayTimeZone === "Local" ? undefined : displayTimeZone;
    return `${formatDateTimeInZone(date, formatterTimeZone)} ${displayTimeZone}`;
  }

  return `${formatDateTimeInZone(date, "UTC")} UTC`;
}

function formatDateTimeInZone(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  }).format(date).replace(",", "");
}

function readStoredTimezoneDisplayMode(): TimezoneDisplayMode {
  if (typeof localStorage === "undefined") return "utc";
  return localStorage.getItem(TIMEZONE_DISPLAY_MODE_KEY) === "local" ? "local" : "utc";
}

function resolveBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || "Local";
}

function friendlyStatus(value: unknown, ui: Copy): string {
  if (value === null || value === undefined || value === "") return ui.noDataYet;
  const normalized = String(value).toLowerCase();
  return ui.statusLabels[normalized as keyof typeof ui.statusLabels] ?? String(value).replace(/_/g, " ");
}

function toObject(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}; }
function readString(row: Row | Record<string, unknown> | undefined, key: string): string | null { const value = row?.[key]; return typeof value === "string" ? value : null; }

function getLastThirtyDaysRange() {
  const dateTo = new Date();
  const dateFrom = new Date(dateTo);
  dateFrom.setUTCDate(dateFrom.getUTCDate() - 30);

  return {
    dateFrom: dateFrom.toISOString().slice(0, 10),
    dateTo: dateTo.toISOString().slice(0, 10),
  };
}

function buildFacebookLeadSyncSuccessMessage(details: Record<string, unknown>, ui: Copy): string {
  const metricKeys = ["forms_seen", "leads_received", "leads_inserted", "leads_failed"];
  const metrics = metricKeys
    .map((key) => {
      const value = details[key];
      return typeof value === "number" || typeof value === "string" ? `${key}: ${value}` : null;
    })
    .filter((value): value is string => Boolean(value));

  return metrics.length > 0 ? `${ui.fbSyncSuccess} ${metrics.join(", ")}` : ui.fbSyncSuccess;
}

async function readFunctionErrorDetails(error: unknown): Promise<string> {
  const fallback = error instanceof Error ? error.message : "Unknown Edge Function error";
  const maybeContext = typeof error === "object" && error !== null && "context" in error
    ? (error as { context?: unknown }).context
    : null;

  if (maybeContext instanceof Response) {
    try {
      const payload = await maybeContext.clone().json();
      const payloadObject = toObject(payload);
      const errorMessage = readString(payloadObject, "error");
      const details = readString(payloadObject, "details");
      if (errorMessage && details) return `${errorMessage} ${details}`;
      if (errorMessage) return errorMessage;
      if (details) return details;
      if (Object.keys(payloadObject).length > 0) return JSON.stringify(payloadObject);
    } catch {
      const text = await maybeContext.clone().text();
      if (text) return text;
    }
  }

  return fallback;
}

function readLikelyStatus(row: Row | undefined): string | null {
  if (!row) return null;
  for (const key of ["health_status", "ads_health", "status", "state", "summary_status", "readiness_status"]) {
    const value = readString(row, key);
    if (value) return value;
  }
  return null;
}

function isPlaceholderAccount(row: Row) {
  return hasTestBindingMarker(row);
}

function isTestOrArchivedAccount(row: Row) {
  return hasTestBindingMarker(row) || isArchivedAccount(row);
}

function isArchivedAccount(row: Row) {
  return String(row.binding_status ?? row.status ?? "").toLowerCase() === "archived";
}

function hasTestBindingMarker(row: Row) {
  const values = [
    row.external_account_id,
    row.ad_account_name,
    row.source_name,
    row.platform,
    row.binding_status,
    row.status,
    row.binding_method,
    row.mapping_status,
  ]
    .filter((value) => value !== null && value !== undefined)
    .map((value) => String(value).toLowerCase());

  return values.some((value) =>
    value.includes("placeholder") ||
    value.includes("mock") ||
    value.includes("northstar") ||
    value.includes("test") ||
    value.includes("тестова прив"),
  );
}

function isActiveAccountBinding(row: Row) {
  return String(row.binding_status ?? row.status ?? "").toLowerCase() === "active";
}

function sortAdAccountsForDisplay(a: Row, b: Row) {
  const aActive = isActiveAccountBinding(a) ? 0 : 1;
  const bActive = isActiveAccountBinding(b) ? 0 : 1;
  if (aActive !== bActive) return aActive - bActive;
  return String(a.platform ?? "").localeCompare(String(b.platform ?? ""));
}


function getPlatformConnectionState(
  platform: ConnectorKey,
  bindings: OptionalViewData | undefined,
  connections: OptionalViewData | undefined,
  insight: PlatformSyncInsight,
  ui: Copy,
  _lang: UiLang,
): PlatformConnectionState {
  const activeConnection = findActiveOAuthConnection(platform, connections);
  if (activeConnection) {
    const details: string[] = [];
    const fallbackAccount = platform === "tiktok" ? "Insight Hub Test Advertiser" : null;
    const accountName = activeConnection.displayName ?? fallbackAccount;
    if (accountName) details.push(`${ui.connectedAccount}: ${accountName}`);

    if (insight.latestFailure) {
      return {
        label: platform === "google" ? ui.googleOauthConnectedState : ui.connectedState,
        currentState: ui.oauthConnectedState,
        note: formatSyncFailureNote(insight.latestFailure, ui),
        tone: "warning",
        details,
        availableItems: platformAvailableItems(platform, ui),
        todoItems: platform === "google" ? ui.googleTodoItems : undefined,
        activeConnection,
      };
    }

    if (platform === "google") {
      if (insight.hasDataRows) {
        return {
          label: ui.connectedState,
          currentState: ui.oauthConnectedState,
          note: ui.googleDataSyncingNote,
          tone: "success",
          details,
          availableItems: ui.googleAvailableItems,
          activeConnection,
        };
      }

      if (insight.hasVerifiedSync || insight.hasRealAccount) {
        return {
          label: ui.connectedState,
          currentState: ui.oauthConnectedState,
          note: ui.googleSyncVerifiedNote,
          tone: "success",
          details,
          availableItems: ui.googleAvailableItems,
          activeConnection,
        };
      }

      return {
        label: ui.googleOauthConnectedState,
        currentState: ui.oauthConnectedState,
        note: ui.googleAccessPendingNote,
        tone: "warning",
        details,
        availableItems: ui.googleAvailableItems,
        todoItems: ui.googleTodoItems,
        activeConnection,
      };
    }

    if (platform === "tiktok") {
      return {
        label: ui.connectedState,
        currentState: ui.oauthConnectedState,
        note: insight.hasDataRows ? ui.tiktokDataSyncingNote : ui.tiktokSyncVerifiedNote,
        tone: "success",
        details,
        availableItems: ui.tiktokAvailableItems,
        activeConnection,
      };
    }

    return {
      label: ui.connectedState,
      currentState: ui.oauthConnectedState,
      note: insight.hasDataRows ? ui.metaDataSyncingNote : ui.metaSyncVerifiedNote,
      tone: "success",
      details,
      availableItems: ui.metaAvailableItems,
      activeConnection,
    };
  }

  if (!bindings || bindings.unavailableReason) return { label: ui.unknownConnectionState, tone: "muted" };

  const platformRows = bindings.rows.filter((row) => rowMatchesPlatform(row, platform));
  if (platformRows.some((row) => !isPlaceholderAccount(row))) {
    const note = insight.latestFailure ? formatSyncFailureNote(insight.latestFailure, ui) : undefined;
    return {
      label: platform === "google" ? ui.googleAwaitingAccessState : ui.connectedState,
      currentState: ui.oauthConnectedState,
      note,
      tone: platform === "google" || note ? "warning" : "success",
    };
  }
  if (platformRows.length > 0) return { label: ui.oauthNotCompletedState, note: ui.testBindingsNoRealOauth, tone: "warning" };

  return { label: ui.oauthNotCompletedState, tone: "warning" };
}

function platformAvailableItems(platform: ConnectorKey, ui: Copy): readonly string[] {
  if (platform === "google") return ui.googleAvailableItems;
  if (platform === "tiktok") return ui.tiktokAvailableItems;
  return ui.metaAvailableItems;
}

function formatSyncFailureNote(error: string | null, ui: Copy): string {
  return error ? ui.syncFailedWithErrorNote.replace("{error}", error) : ui.syncFailedNote;
}

function getPlatformSyncInsight(platform: ConnectorKey, data: { [k: string]: OptionalViewData } | undefined): PlatformSyncInsight {
  const bindingRows = data?.adBindings.rows.filter((row) => rowMatchesPlatform(row, platform)) ?? [];
  const hasRealAccount = bindingRows.some((row) => !isTestOrArchivedAccount(row));
  const dataRows = [data?.adsSummary.rows, data?.adsDaily.rows, data?.adsAnomalies.rows].flatMap((rows) => rows ?? []);
  const hasDataRows = dataRows.some((row) => rowMatchesPlatform(row, platform) && rowHasDataSignal(row));
  const syncRows = [data?.syncDue.rows, data?.syncRules.rows].flatMap((rows) => rows ?? []).filter((row) => rowMatchesPlatform(row, platform));
  const latestFailure = findLatestSyncFailure(syncRows);
  const hasVerifiedSync = syncRows.some((row) => isSuccessfulSyncStatus(readLikelyStatus(row))) || hasRealAccount || hasDataRows;

  return { hasDataRows, hasVerifiedSync, latestFailure, hasRealAccount };
}

function buildAttentionItems(insights: Record<ConnectorKey, PlatformSyncInsight>, data: { [k: string]: OptionalViewData } | undefined, ui: Copy): string[] {
  const items: string[] = [];
  if (insights.google.latestFailure) items.push(`Google Ads: ${formatSyncFailureNote(insights.google.latestFailure, ui)}`);
  else if (!insights.google.hasVerifiedSync && !insights.google.hasDataRows) items.push(ui.googleNeedsAccess);

  if (insights.tiktok.latestFailure) items.push(`TikTok Ads: ${formatSyncFailureNote(insights.tiktok.latestFailure, ui)}`);
  else if (!insights.tiktok.hasDataRows) items.push(ui.tiktokNoDataYetAttention);

  if (facebookLeadFormsOrLeadsMissing(data)) items.push(ui.facebookLeadFormsAttention);

  return items;
}

function facebookLeadFormsOrLeadsMissing(data: { [k: string]: OptionalViewData } | undefined): boolean {
  if (!data) return true;
  if (data.fbForms.unavailableReason || data.fbLeads.unavailableReason) return true;
  const hasForms = data.fbForms.rows.length > 0 || Number(findMetric(data.fbHealth.rows, ["active_forms", "forms_count", "total_forms"]) ?? 0) > 0;
  const hasLeads = data.fbLeads.rows.length > 0 || Number(findMetric(data.fbHealth.rows, ["leads_last_24h", "leads_count", "total_leads"]) ?? 0) > 0;
  return !hasForms && !hasLeads;
}

function findLatestSyncFailure(rows: Row[]): string | null {
  const failedRows = rows
    .filter((row) => isFailedSyncStatus(readLikelyStatus(row)))
    .sort((a, b) => timestampValue(readLatestSyncTimestamp(b)) - timestampValue(readLatestSyncTimestamp(a)));
  if (failedRows.length === 0) return null;
  return readSyncError(failedRows[0]);
}

function readLatestSyncTimestamp(row: Row): string | null {
  return readString(row, "last_run_at") ?? readString(row, "updated_at") ?? readString(row, "created_at") ?? readString(row, "next_run_at");
}

function readSyncError(row: Row): string | null {
  return readString(row, "error_message") ?? readString(row, "last_error") ?? readString(row, "error") ?? readString(row, "details");
}

function isSuccessfulSyncStatus(status: string | null): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return ["success", "succeeded", "completed", "ok", "ready", "healthy", "active", "synced"].some((value) => normalized.includes(value));
}

function isFailedSyncStatus(status: string | null): boolean {
  if (!status) return false;
  const normalized = status.toLowerCase();
  return ["failed", "error", "rejected"].some((value) => normalized.includes(value));
}

function rowHasDataSignal(row: Row): boolean {
  const ignoredKeys = new Set(["workspace_id", "platform", "source", "source_name", "date", "day", "created_at", "updated_at"]);
  return Object.entries(row).some(([key, value]) => {
    if (ignoredKeys.has(key) || value === null || value === undefined || value === "") return false;
    if (typeof value === "number") return value > 0;
    if (typeof value === "string") {
      const numericValue = Number(value);
      return Number.isFinite(numericValue) ? numericValue > 0 : !["0", "false", "none", "null"].includes(value.toLowerCase());
    }
    if (typeof value === "boolean") return value;
    if (Array.isArray(value)) return value.length > 0;
    return Object.keys(value).length > 0;
  });
}


function findActiveOAuthConnection(platform: ConnectorKey, data: OptionalViewData | undefined): ActiveConnectionDetails | null {
  if (!data || data.unavailableReason) return null;
  const platformName = platform === "meta" ? "meta_ads" : platform === "google" ? "google_ads" : "tiktok_ads";
  const rows = data.rows.filter((connection) => {
    const rowPlatform = String(connection.platform ?? "").toLowerCase();
    const rowStatus = String(connection.status ?? "").toLowerCase();
    return rowPlatform === platformName && rowStatus === "active";
  });

  if (rows.length === 0) return null;
  const sortedRows = [...rows].sort((a, b) => timestampValue(b.last_connected_at) - timestampValue(a.last_connected_at));
  const row = sortedRows[0];
  const id = readString(row, "id");
  if (!id) return null;
  return {
    id,
    displayName: readString(row, "provider_business_name") ?? readString(row, "connection_name") ?? readString(row, "provider_account_email"),
    lastConnectedAt: readString(row, "last_connected_at"),
    activeCount: rows.length,
  };
}

function formatDateTime(value: string, lang: UiLang): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

function isTabKey(value: string | null): value is TabKey {
  return Boolean(value && TAB_KEYS.includes(value as TabKey));
}

function isMetaOauthSuccessParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === "meta_success" || (normalized.includes("meta") && normalized.includes("success"));
}

function isMetaOauthErrorParam(value: string | null): boolean {
  if (!value) return false;
  const normalized = value.toLowerCase();
  return normalized === "meta_error" || (normalized.includes("meta") && normalized.includes("error"));
}

function timestampValue(value: unknown): number {
  if (!value) return 0;
  const time = new Date(String(value)).getTime();
  return Number.isNaN(time) ? 0 : time;
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
