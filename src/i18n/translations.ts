// Bilingual dictionary for the internal analytics workspace.
// Default language is Ukrainian (uk). English (en) is a fallback for analyst staff.

export type Lang = "uk" | "en";

export const translations = {
  // App / brand
  appName: { uk: "Insight Hub", en: "Insight Hub" },
  appTagline: { uk: "Внутрішня аналітика", en: "Internal analytics" },
  workspace: { uk: "Робочий простір", en: "Workspace" },
  systemsOk: { uk: "Усі системи працюють", en: "All systems operational" },
  searchPlaceholder: { uk: "Пошук кампаній, проєктів Insight Hub…", en: "Search Insight Hub campaigns, projects…" },

  // Navigation
  navOverview: { uk: "Огляд", en: "Overview" },
  navFunnel: { uk: "Воронка", en: "Funnel / Report" },
  navCampaigns: { uk: "Кампанії", en: "Campaigns" },
  navSales: { uk: "Продажі", en: "Sales / Revenue" },
  navImports: { uk: "Імпорти / Якість даних", en: "Imports / Data Health" },
  navAssistant: { uk: "AI-асистент", en: "AI Assistant" },
  navOnboarding: { uk: "Онбординг", en: "Onboarding" },
  navBindingsMapping: { uk: "Звʼязки даних", en: "Bindings / Mapping" },
  navTelegramAlerts: { uk: "Telegram / Сповіщення", en: "Telegram / Alerts" },
  navAdsConnectors: { uk: "Ads конектори", en: "Ads Connectors" },

  // Filters
  filters: { uk: "Фільтри", en: "Filters" },
  project: { uk: "Проєкт", en: "Project" },
  reportGroup: { uk: "Група звітів", en: "Report group" },
  allProjects: { uk: "Усі проєкти", en: "All projects" },
  allGroups: { uk: "Усі групи", en: "All groups" },
  dateRange: { uk: "Період", en: "Date range" },
  refresh: { uk: "Оновити", en: "Refresh" },
  data: { uk: "Дані:", en: "Data:" },
  viewMode: { uk: "Режим перегляду", en: "View mode" },
  summaryView: { uk: "Зведення", en: "Summary" },
  dailyView: { uk: "Щоденно", en: "Daily breakdown" },

  // Date presets
  dateToday: { uk: "Сьогодні", en: "Today" },
  dateYesterday: { uk: "Вчора", en: "Yesterday" },
  date7d: { uk: "Останні 7 днів", en: "Last 7 days" },
  date30d: { uk: "Останні 30 днів", en: "Last 30 days" },
  dateMtd: { uk: "З початку місяця", en: "Month to date" },
  dateQtd: { uk: "З початку кварталу", en: "Quarter to date" },
  dateCustom: { uk: "Свій період", en: "Custom range" },
  dateExact: { uk: "Конкретна дата", en: "Specific date" },
  dateMode: { uk: "Режим", en: "Mode" },
  quickPresets: { uk: "Швидкий вибір", en: "Quick presets" },
  apply: { uk: "Застосувати", en: "Apply" },
  pickPresetHint: { uk: "Оберіть пресет або режим зліва", en: "Pick a preset or mode on the left" },
  activeRange: { uk: "Активний період", en: "Active range" },
  activeDate: { uk: "Активна дата", en: "Active date" },

  // Funnel blocks
  blockTraffic: { uk: "Трафік", en: "Traffic" },
  blockRegs: { uk: "Реєстрації", en: "Registrations" },
  blockViewers: { uk: "Глядачі", en: "Viewers" },
  blockApps: { uk: "Анкети", en: "Surveys" },
  blockBookings: { uk: "Заявки", en: "Applications" },
  blockReservations: { uk: "Броні", en: "Bookings" },
  blockSales: { uk: "Продажі", en: "Sales" },
  blockRevenue: { uk: "Revenue Plan / Fact", en: "Revenue Plan / Fact" },
  blockRoas: { uk: "ROAS", en: "ROAS" },

  // Imports per source
  perSourceTitle: { uk: "По джерелах", en: "By source" },
  perSourceDesc: { uk: "Стан кожного джерела даних", en: "Status of each data source" },
  thLastSync: { uk: "Остання синхр.", en: "Last sync" },
  thRowsToday: { uk: "Сьогодні", en: "Today" },
  thHealth: { uk: "Стан", en: "Health" },

  // Buttons
  export: { uk: "Експорт", en: "Export" },
  exportCsv: { uk: "Експорт CSV", en: "Export CSV" },
  askAi: { uk: "Запит до AI", en: "Ask analyst AI" },
  send: { uk: "Надіслати", en: "Send" },
  retry: { uk: "Повторити", en: "Retry" },
  approve: { uk: "Підтвердити", en: "Approve" },
  edit: { uk: "Редагувати", en: "Edit" },
  investigate: { uk: "Розібратись", en: "Investigate" },
  signIn: { uk: "Увійти", en: "Sign in" },
  signOut: { uk: "Вийти", en: "Sign out" },
  sendMagicLink: { uk: "Надіслати magic link", en: "Send magic link" },

  // Status
  statusSuccess: { uk: "Успішно", en: "Success" },
  statusPartial: { uk: "Частково", en: "Partial" },
  statusFailed: { uk: "Помилка", en: "Failed" },
  statusFresh: { uk: "Свіжі", en: "Fresh" },
  statusStale: { uk: "Застарілі", en: "Stale" },
  statusHealthy: { uk: "В нормі", en: "Healthy" },
  statusWarning: { uk: "Увага", en: "Warning" },
  statusCritical: { uk: "Критично", en: "Critical" },
  statusInfo: { uk: "Інфо", en: "Info" },

  // Theme / language
  theme: { uk: "Тема", en: "Theme" },
  themeLight: { uk: "Світла", en: "Light" },
  themeDark: { uk: "Темна", en: "Dark" },
  themeSystem: { uk: "Системна", en: "System" },
  language: { uk: "Мова", en: "Language" },
  langUk: { uk: "Українська", en: "Ukrainian" },
  langEn: { uk: "Англійська", en: "English" },

  // Pages — Overview
  overviewTitle: { uk: "Огляд", en: "Overview" },
  overviewSubtitle: {
    uk: "Операційний зріз ефективності по всіх проєктах",
    en: "Operational performance snapshot across all projects",
  },
  revenueVsSpend: { uk: "Виторг vs Витрати", en: "Revenue vs Spend" },
  revenueVsSpendDesc: {
    uk: "Денні суми по обраних проєктах",
    en: "Daily totals across selected projects",
  },
  aiObservations: { uk: "Аналітичні спостереження", en: "Analyst observations" },
  aiObservationsDesc: { uk: "3 ключові висновки за період", en: "3 key takeaways for the period" },
  topCampaigns: { uk: "Топ кампаній", en: "Top campaigns" },
  topCampaignsDesc: { uk: "Сортування за ROAS · 30 днів", en: "Sorted by ROAS · last 30 days" },
  topGroups: { uk: "Топ груп звітів", en: "Top report groups" },
  recentAnomalies: { uk: "Аномалії та сповіщення", en: "Anomalies & alerts" },
  recentAnomaliesDesc: {
    uk: "Виявлено аналітичним рушієм",
    en: "Auto-detected by the analytics engine",
  },
  dataFreshness: { uk: "Свіжість даних", en: "Data freshness" },
  dataFreshnessDesc: { uk: "Стан синхронізації джерел", en: "Source sync status" },
  dailyBreakdown: { uk: "Щоденна аналітика", en: "Daily analytics" },
  dailyBreakdownDesc: {
    uk: "Метрики по кожному дню — клікни рядок для деталей",
    en: "Day-by-day metrics — click a row for details",
  },

  // Operations / data health
  opsBlock: { uk: "Стан даних", en: "Data operations" },
  lastSync: { uk: "Останнє оновлення", en: "Last sync" },
  lastSuccessSync: { uk: "Остання успішна синхронізація", en: "Last successful sync" },
  staleWarning: { uk: "Дані застарілі", en: "Stale data" },
  failedImport: { uk: "Помилки імпорту", en: "Failed imports" },
  partialImport: { uk: "Часткові імпорти", en: "Partial imports" },
  unmappedQueue: { uk: "Невідомі мапінги", en: "Unmapped values" },
  awaitingReview: { uk: "очікують перегляду", en: "awaiting review" },
  lastRefresh: { uk: "Останнє оновлення інтерфейсу", en: "Last UI refresh" },
  importsTitle: { uk: "Імпорти / Якість даних", en: "Imports / Data Health" },
  importsSubtitle: {
    uk: "Операційний контроль усіх джерел даних",
    en: "Operational control of all data sources",
  },
  recentImports: { uk: "Останні імпорти", en: "Recent imports" },
  recentImportsDesc: { uk: "За останні 24 години", en: "Last 24 hours" },
  qualityAlerts: { uk: "Сповіщення про якість даних", en: "Data quality alerts" },
  unknownMappings: { uk: "Черга невідомих мапінгів", en: "Unknown mappings queue" },
  unknownMappingsDesc: {
    uk: "Значення з сирих даних без мапінгу",
    en: "Raw values with no mapping target",
  },

  // Table headers
  thSource: { uk: "Джерело → Ціль", en: "Source → Target" },
  thStarted: { uk: "Початок", en: "Started" },
  thDuration: { uk: "Тривалість", en: "Duration" },
  thReceived: { uk: "Отримано", en: "Received" },
  thInserted: { uk: "Записано", en: "Inserted" },
  thFailed: { uk: "Помилок", en: "Failed" },
  thStatus: { uk: "Статус", en: "Status" },
  thError: { uk: "Помилка", en: "Error" },
  thAction: { uk: "Дія", en: "Action" },
  thType: { uk: "Тип", en: "Type" },
  thRawValue: { uk: "Сире значення", en: "Raw value" },
  thOccurrences: { uk: "К-сть", en: "Occurrences" },
  thSuggested: { uk: "Запропоновано", en: "Suggested" },
  thCampaign: { uk: "Кампанія", en: "Campaign" },
  thProject: { uk: "Проєкт", en: "Project" },
  thPlacement: { uk: "Плейсмент", en: "Placement" },
  thSpend: { uk: "Витрати", en: "Spend" },
  thReach: { uk: "Охоплення", en: "Reach" },
  thClicks: { uk: "Кліки", en: "Clicks" },
  thRegs: { uk: "Реєстр.", en: "Regs" },
  thApps: { uk: "Заявки", en: "Apps" },
  thBookings: { uk: "Брон.", en: "Bookings" },
  thViewers: { uk: "Глядачі", en: "Viewers" },
  thSales: { uk: "Продажі", en: "Sales" },
  thRevenue: { uk: "Виторг", en: "Revenue" },
  thRoas: { uk: "ROAS", en: "ROAS" },
  thCpl: { uk: "CPL", en: "CPL" },
  thCpc: { uk: "CPC", en: "CPC" },
  thCpm: { uk: "CPM", en: "CPM" },
  thCtr: { uk: "CTR", en: "CTR" },
  thDay: { uk: "День", en: "Day" },

  // KPI labels
  kpiSpend: { uk: "Витрати", en: "Spend" },
  kpiReach: { uk: "Охоплення", en: "Reach" },
  kpiClicks: { uk: "Кліки", en: "Clicks" },
  kpiRegs: { uk: "Реєстрації", en: "Registrations" },
  kpiApps: { uk: "Заявки", en: "Applications" },
  kpiBookings: { uk: "Бронювання", en: "Bookings" },
  kpiViewers: { uk: "Глядачі", en: "Viewers" },
  kpiSales: { uk: "Продажі", en: "Sales" },
  kpiRevPlan: { uk: "Виторг · план", en: "Revenue Plan" },
  kpiRevFact: { uk: "Виторг · факт", en: "Revenue Fact" },
  kpiRoas: { uk: "ROAS", en: "ROAS" },
  kpiCpl: { uk: "CPL", en: "CPL" },

  // Empty / misc
  noData: { uk: "Немає даних", en: "No data" },
  noDataDesc: {
    uk: "За цей період даних не знайдено",
    en: "No data for the selected period",
  },

  // AI Assistant
  assistantTitle: { uk: "AI-асистент аналітика", en: "Analyst AI assistant" },
  assistantSubtitle: {
    uk: "Працює в режимі read-only на підготовлених fact-таблицях",
    en: "Read-only — works on prepared fact tables only",
  },
  suggestedPrompts: { uk: "Готові запити", en: "Suggested questions" },
  whatICanDo: { uk: "Що я вмію", en: "What I can do" },
  canAnalyze: { uk: "Аналізувати fact-таблиці", en: "Analyze prepared fact tables" },
  canCompare: { uk: "Порівнювати періоди й когорти", en: "Compare periods & cohorts" },
  canSurface: { uk: "Виявляти аномалії та тренди", en: "Surface anomalies & trends" },
  cantEdit: { uk: "Змінювати сирі дані чи мапінги", en: "Edit raw data or mappings" },
  cantTrigger: { uk: "Запускати дії, що руйнують стан", en: "Trigger destructive actions" },
  appliedFilters: { uk: "Застосовані фільтри", en: "Applied filters" },
  keyMetrics: { uk: "Ключові метрики", en: "Key metrics" },
  supportingChart: { uk: "Підтверджуючий графік", en: "Supporting chart" },
  topContributors: { uk: "Топ контриб'ютори", en: "Top contributors" },
  assistantInputPlaceholder: {
    uk: "Запитай про метрики, кампанії або тренди…",
    en: "Ask about metrics, campaigns, or trends…",
  },
  assistantWelcome: {
    uk: "Привіт 👋 Я аналітичний асистент. Я працюю тільки з підготовленими fact-таблицями. Спитай про метрики, кампанії або тренди.",
    en: "Hi 👋 I'm your analyst assistant. I only work with prepared fact tables. Ask me about metrics, campaigns, or trends.",
  },

  // Auth
  loginTitle: { uk: "Вхід для команди", en: "Internal team sign-in" },
  loginSubtitle: {
    uk: "Доступ лише за запрошенням. Введіть робочу пошту — надішлемо magic link.",
    en: "Invite-only access. Enter your work email — we'll send you a magic link.",
  },
  email: { uk: "Робоча пошта", en: "Work email" },
  emailPlaceholder: { uk: "you@agency.com", en: "you@agency.com" },
  magicLinkSent: {
    uk: "Перевірте пошту — посилання для входу надіслано.",
    en: "Check your inbox — sign-in link has been sent.",
  },
  magicLinkError: {
    uk: "Не вдалось надіслати посилання. Перевірте пошту й спробуйте ще раз.",
    en: "Couldn't send the magic link. Check the email and try again.",
  },
  inviteOnlyNote: {
    uk: "Якщо вас немає в списку запрошених — зверніться до адміністратора.",
    en: "If you're not on the invite list, contact your workspace admin.",
  },
  signInWithGoogle: { uk: "Увійти через Google", en: "Sign in with Google" },
  orDivider: { uk: "або", en: "or" },
  googleSignInError: {
    uk: "Не вдалось увійти через Google. Спробуйте ще раз.",
    en: "Couldn't sign in with Google. Please try again.",
  },
  myAccount: { uk: "Мій акаунт", en: "My account" },

  // Sales
  salesTitle: { uk: "Продажі / Виторг", en: "Sales / Revenue" },
  salesSubtitle: { uk: "Внутрішня аналітика продажів", en: "Internal sales analytics" },
  salesBySource: { uk: "Продажі за джерелом", en: "Sales by source" },
  salesByLeadType: { uk: "Продажі за типом ліда", en: "Sales by lead type" },
  salesByTariff: { uk: "Продажі за тарифом", en: "Sales by tariff" },
  source: { uk: "Джерело", en: "Source" },
  leadType: { uk: "Тип ліда", en: "Lead type" },
  tariff: { uk: "Тариф", en: "Tariff" },
  avgDeal: { uk: "Сер. чек", en: "Avg deal" },
  revenueOverTime: { uk: "Виторг по днях", en: "Revenue over time" },
  revenueOverTimeDesc: { uk: "Денний виторг (факт)", en: "Daily revenue (fact)" },
  dopayNoteTitle: { uk: "Як обробляється «доплата»", en: "About “доплата” handling" },
  dopayNote: {
    uk: "Доплати не враховуються у кількості продажів, щоб уникнути подвійного підрахунку угод, але сума платежу включена у фактичний виторг. Це зберігає чисту воронку та коректну виручку.",
    en: "Top-up payments (доплата) are excluded from sales count to avoid double-counting deals, but the payment amount is still included in revenue fact.",
  },

  // Funnel
  funnelTitle: { uk: "Воронка / Звіт", en: "Funnel / Report" },
  funnelSubtitle: { uk: "Головний робочий екран аналітика", en: "Main analyst working screen" },
  conversionFlow: { uk: "Послідовність конверсій", en: "Conversion flow" },
  conversionFlowDesc: {
    uk: "Перехід між кроками воронки",
    en: "Step-to-step conversion across the funnel",
  },
  dailyTrend: { uk: "Денний тренд", en: "Daily trend" },
  dailyTrendDesc: { uk: "Реєстрації та продажі", en: "Registrations & sales" },
  planVsFact: { uk: "План vs факт продажів", en: "Sales plan vs fact" },
  weekly: { uk: "Тижнево", en: "Weekly" },

  // Campaigns
  campaignsTitle: { uk: "Кампанії / Плейсменти", en: "Campaigns / Placements" },
  campaignsSubtitle: {
    uk: "Аналітика медіа-баїнгу для команди трафіку",
    en: "Media buying analytics for the traffic team",
  },
  totalSpend: { uk: "Усього витрат", en: "Total spend" },
  totalRevenue: { uk: "Усього виторгу", en: "Total revenue" },
  blendedRoas: { uk: "Сумарний ROAS", en: "Blended ROAS" },
  byRoas: { uk: "За ROAS", en: "By ROAS" },
  bySpend: { uk: "За витратами", en: "By spend" },
  allCampaigns: { uk: "Усі кампанії та плейсменти", en: "All campaigns & placements" },
  rows: { uk: "рядків", en: "rows" },

  // Preferences
  preferences: { uk: "Налаштування", en: "Preferences" },
  preferencesDesc: {
    uk: "Персональні налаштування — зберігаються лише для вас.",
    en: "Personal settings — saved only for you.",
  },
  defaultLanding: { uk: "Стартова сторінка", en: "Default landing page" },
  defaultDateMode: { uk: "Режим дати за замовч.", en: "Default date mode" },
  defaultViewMode: { uk: "Режим перегляду за замовч.", en: "Default view mode" },
  tableDensity: { uk: "Щільність таблиць", en: "Table density" },
  densityComfortable: { uk: "Комфортна", en: "Comfortable" },
  densityCompact: { uk: "Щільна", en: "Compact" },
  currencyFormat: { uk: "Формат валюти", en: "Currency format" },
  showAiSummary: { uk: "Показувати AI-блок", en: "Show AI summary block" },
  resetDefaults: { uk: "Скинути", en: "Reset" },
  done: { uk: "Готово", en: "Done" },

  // Saved views
  savedViews: { uk: "Збережені види", en: "Saved views" },
  savedViewNamePlaceholder: { uk: "Назва виду…", en: "View name…" },
  noSavedViews: { uk: "Немає збережених видів", en: "No saved views yet" },

  // Compare
  compare: { uk: "Порівняння", en: "Compare" },
  compareMode: { uk: "Режим порівняння", en: "Compare mode" },
  compareDisplay: { uk: "Відображення", en: "Display" },
  compareNone: { uk: "Без порівняння", en: "None" },
  compareYesterday: { uk: "vs вчора", en: "vs yesterday" },
  comparePrevious: { uk: "vs попередній період", en: "vs previous period" },
  comparePercent: { uk: "У відсотках", en: "Percent (%)" },
  compareAbsolute: { uk: "Абсолютне (Δ)", en: "Absolute (Δ)" },
} as const;

export type TranslationKey = keyof typeof translations;
