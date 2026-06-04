import { useMemo } from "react";
import { Link } from "react-router-dom";
import {
  AlertTriangle,
  ArrowUpRight,
  CheckCircle2,
  Database,
  RefreshCw,
} from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const ROUTES = {
  bindings: "/bindings",
  alerts: "/alerts",
  adsConnectors: "/ads-connectors",
} as const;

type Primitive = string | number | boolean | null;
type SourceStatus = "success" | "warning" | "error" | "unknown";
type QuerySlice<T> = { rows: T[]; unavailableReason: string | null };
type CountSlice = { count: number | null; unavailableReason: string | null };
type ImportsData = {
  health: QuerySlice<ImportHealthRow>;
  errors: QuerySlice<ImportErrorRow>;
  mappings: QuerySlice<MappingRow>;
  mappingReview: CountSlice;
  alerts: QuerySlice<AlertRow>;
};

type ImportHealthRow = {
  workspace_id: Primitive;
  open_rejected_rows: Primitive;
  critical_rejected_rows: Primitive;
  rejected_rows_last_24h: Primitive;
  latest_rejected_row_at: Primitive;
  latest_sync_status: Primitive;
  latest_sync_rows_failed: Primitive;
  latest_sync_at: Primitive;
  import_health_status: Primitive;
};

type ImportErrorRow = {
  workspace_id: Primitive;
  source_name: Primitive;
  source_type: Primitive;
  source_table: Primitive;
  target_table: Primitive;
  error_code: Primitive;
  severity: Primitive;
  status: Primitive;
  rejected_rows_count: Primitive;
  first_seen_at: Primitive;
  last_seen_at: Primitive;
};

type MappingRow = {
  workspace_id: Primitive;
  name: Primitive;
  source_type: Primitive;
  target_table: Primitive;
  file_type: Primitive;
  status: Primitive;
  updated_at: Primitive;
  active_fields_count: Primitive;
  required_fields_count: Primitive;
};

type AlertRow = {
  severity: Primitive;
  title: Primitive;
  status: Primitive;
  created_at: Primitive;
};

type NormalizedImportHealth = {
  importHealthStatus: string;
  importHealthStatusKind: SourceStatus;
  latestSyncStatus: string;
  latestSyncStatusKind: SourceStatus;
  latestSyncAt: string | null;
  latestSyncRowsFailed: number;
  openRejectedRows: number;
  criticalRejectedRows: number;
  rejectedRowsLast24h: number;
  latestRejectedRowAt: string | null;
};

type NormalizedImportError = {
  source: string;
  sourceType: string;
  errorCode: string;
  severity: string;
  severityKind: SourceStatus;
  status: string;
  statusKind: SourceStatus;
  count: number;
  firstSeen: string | null;
  lastSeen: string | null;
};
type NormalizedMapping = {
  name: string;
  sourceType: string;
  targetTable: string;
  fileType: string;
  status: string;
  statusKind: SourceStatus;
  updatedAt: string | null;
  activeFieldsCount: number | null;
  requiredFieldsCount: number | null;
  needsReview: boolean;
};
type NormalizedAlert = {
  severity: string;
  title: string;
  status: string;
  statusKind: SourceStatus;
  createdAt: string | null;
  isOpen: boolean | null;
};

type Copy = typeof copy.uk;

const copy = {
  uk: {
    signIn: "Увійдіть, щоб переглянути дані імпортів.",
    loading: "Завантаження даних імпортів…",
    dataAvailable: "Дані доступні",
    someUnavailable: "Частина даних недоступна",
    refresh: "Оновити",
    refreshing: "Оновлюємо…",
    unavailable: "Недоступно",
    sourceUnavailable: "Джерело недоступне",
    noUpdates: "Поки немає",
    noRows: "немає рядків",
    records: "записів",
    status: "Статус",
    actions: "Дії",
    open: "Відкрити",
    review: "Перевірити",
    kpis: {
      health: "Стан даних",
      healthy: "Все працює",
      needsReview: "Потрібна перевірка",
      partial: "Частина даних недоступна",
      healthOk: "Критичних сигналів не видно",
      healthReview: "Є сигнали, які потребують уваги",
      healthPartial: "Один або більше розділів недоступні",
      lastUpdate: "Оновлено",
      lastUpdateHelper: "Найсвіжіша дата з доступних джерел",
      importErrors: "Помилки імпорту",
      importErrorsHelper: "Відхилені рядки у зведенні помилок",
      problemRows: "Проблемні рядки",
      problemRowsHelper: "Відхилені рядки та помилки синхронізації",
      noRowCounter: "Немає окремого лічильника",
      mapping: "Мапінг",
      mappingHelper: "Статуси очікування або помилки",
      alerts: "Сповіщення",
      openAlertsHelper: "Останні відкриті сигнали",
      recentAlertsHelper: "Останні відкриті сигнали",
    },
    activity: {
      title: "Стан імпортів",
      desc: "Зведення синхронізацій і відхилених рядків",
      error: "Не вдалося завантажити стан імпортів.",
      errorHelp: "Цей розділ недоступний. Інші секції можуть працювати.",
      empty: "Стан імпортів поки не зафіксований.",
      importHealth: "Стан",
      latestSync: "Синхронізація",
      latestSyncTime: "Час синхронізації",
      latestSyncFailedRows: "Помилки синхронізації",
      openRejectedRows: "Відкриті рядки",
      criticalRejectedRows: "Критичні",
      rejectedRowsLast24h: "За 24 год",
      latestRejectedRow: "Останній рядок",
    },
    errors: {
      title: "Помилки імпорту",
      desc: "Коди помилок і відхилені рядки за джерелами",
      error: "Не вдалося завантажити помилки імпорту.",
      empty: "Помилок імпорту не знайдено. Відхилених рядків у зведенні немає.",
      source: "Джерело",
      sourceType: "Тип джерела",
      errorCode: "Код помилки",
      severity: "Рівень",
      status: "Статус",
      count: "Відхилені рядки",
      firstSeen: "Перша поява",
      lastSeen: "Остання поява",
    },
    mapping: {
      title: "Стан мапінгу",
      desc: "Привʼязка імпортованих джерел до бізнес-структури",
      error: "Не вдалося завантажити стан мапінгу.",
      empty: "Рядків мапінгу поки немає. Якщо джерела вже додані, перевірте зв’язки даних.",
      name: "Назва",
      sourceType: "Тип джерела",
      targetTable: "Цільова таблиця",
      fileType: "Тип файлу",
      status: "Статус",
      activeFields: "Активні поля",
      requiredFields: "Обовʼязкові поля",
      updatedAt: "Оновлено",
      goBindings: "Перейти до звʼязків даних",
    },
    alerts: {
      title: "Операційні сигнали",
      desc: "Останні сповіщення, повʼязані з якістю даних",
      error: "Не вдалося завантажити сповіщення.",
      empty: "Немає сповіщень про помилки імпорту.",
      severity: "Рівень",
      titleCol: "Назва",
      status: "Статус",
      createdAt: "Створено",
      goAlerts: "Перейти до сповіщень",
    },
    actionPanel: {
      title: "Що перевірити",
      desc: "Дії з’являться тут, якщо система знайде проблеми.",
      importErrors: "Перевірити помилки імпорту",
      rowsFailed: "Перевірити проблемні рядки",
      mapping: "Перевірити мапінг",
      alerts: "Перейти до сповіщень",
      noIssues: "Критичних проблем не видно",
      unavailable: "Частина даних недоступна — перевірте секції з помилками.",
      sources: "Перевірити джерела даних",
    },
    statuses: {
      success: "Успішно",
      warning: "Увага",
      error: "Помилка",
      unknown: "Невідомо",
      confirmed: "Підтверджено",
      pending: "Очікує перевірки",
      active: "Активне",
      resolved: "Закрито",
    },
  },
  en: {
    signIn: "Sign in to view import data.",
    loading: "Loading import data…",
    dataAvailable: "Data available",
    someUnavailable: "Some data unavailable",
    refresh: "Refresh",
    refreshing: "Refreshing…",
    unavailable: "Unavailable",
    sourceUnavailable: "Source unavailable",
    noUpdates: "No updates yet",
    noRows: "no rows",
    records: "records",
    status: "Status",
    actions: "Actions",
    open: "Open",
    review: "Review",
    kpis: {
      health: "Data health",
      healthy: "Healthy",
      needsReview: "Needs review",
      partial: "Partially unavailable",
      healthOk: "No critical signals visible",
      healthReview: "There are signals that need attention",
      healthPartial: "One or more sections are unavailable",
      lastUpdate: "Last update",
      lastUpdateHelper: "Latest timestamp from available sources",
      importErrors: "Import errors",
      importErrorsHelper: "Rejected rows in error summary",
      problemRows: "Problem rows",
      problemRowsHelper: "Rejected rows and sync failures",
      noRowCounter: "No row-level counter",
      mapping: "Mapping",
      mappingHelper: "Pending or error statuses",
      alerts: "Alerts",
      openAlertsHelper: "Recent open signals",
      recentAlertsHelper: "Recent open signals",
    },
    activity: {
      title: "Import health",
      desc: "Sync and rejected-row summary",
      error: "Could not load import status.",
      errorHelp: "This section is unavailable. Other sections may still work.",
      empty: "Import health has not been recorded yet.",
      importHealth: "Status",
      latestSync: "Sync",
      latestSyncTime: "Sync time",
      latestSyncFailedRows: "Sync failures",
      openRejectedRows: "Open rows",
      criticalRejectedRows: "Critical",
      rejectedRowsLast24h: "Last 24h",
      latestRejectedRow: "Latest row",
    },
    errors: {
      title: "Import errors",
      desc: "Error codes and rejected rows by source",
      error: "Could not load import errors.",
      empty: "No import errors found. No rejected rows are currently listed.",
      source: "Source",
      sourceType: "Source type",
      errorCode: "Error code",
      severity: "Severity",
      status: "Status",
      count: "Rejected rows",
      firstSeen: "First seen",
      lastSeen: "Last seen",
    },
    mapping: {
      title: "Mapping health",
      desc: "Imported source bindings to business structure",
      error: "Could not load mapping health.",
      empty: "No mapping rows yet. If sources are already added, check data bindings.",
      name: "Name",
      sourceType: "Source type",
      targetTable: "Target table",
      fileType: "File type",
      status: "Status",
      activeFields: "Active fields",
      requiredFields: "Required fields",
      updatedAt: "Updated",
      goBindings: "Go to Bindings / Mapping",
    },
    alerts: {
      title: "Operational signals",
      desc: "Recent alerts related to data quality",
      error: "Could not load alerts.",
      empty: "No import error alerts.",
      severity: "Severity",
      titleCol: "Title",
      status: "Status",
      createdAt: "Created at",
      goAlerts: "Open alerts",
    },
    actionPanel: {
      title: "What to check",
      desc: "Actions will appear here when the system detects issues.",
      importErrors: "Review import errors",
      rowsFailed: "Review problem rows",
      mapping: "Review mapping",
      alerts: "Open alerts",
      noIssues: "No critical issues visible",
      unavailable: "Some data is unavailable — check sections with errors.",
      sources: "Review data sources",
    },
    statuses: {
      success: "Success",
      warning: "Warning",
      error: "Error",
      unknown: "Unknown",
      confirmed: "Confirmed",
      pending: "Pending review",
      active: "Active",
      resolved: "Resolved",
    },
  },
} as const;

export default function Imports() {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const ui = copy[lang];

  const query = useQuery<ImportsData>({
    queryKey: ["imports-page-operational", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: readImportsDashboard,
  });

  const hasLoadedData = Boolean(query.data);
  const isInitialLoading = query.isLoading && !query.data;
  const signedOut = !session;
  const pageUnavailableReason = query.isError
    ? (query.error?.message ?? "Query failed")
    : null;

  const healthSummary = useMemo(
    () => normalizeImportHealthSummary(query.data?.health.rows ?? null),
    [query.data?.health.rows],
  );
  const errorRows = useMemo(
    () => normalizeImportErrors(query.data?.errors.rows ?? []),
    [query.data?.errors.rows],
  );
  const mappingRows = useMemo(
    () => normalizeMappings(query.data?.mappings.rows ?? []),
    [query.data?.mappings.rows],
  );
  const alertRows = useMemo(
    () => normalizeAlerts(query.data?.alerts.rows ?? []),
    [query.data?.alerts.rows],
  );

  const unavailableSections = [
    query.data?.health,
    query.data?.errors,
    query.data?.mappings,
    query.data?.mappingReview,
    query.data?.alerts,
  ]
    .filter((slice): slice is QuerySlice<unknown> | CountSlice =>
      Boolean(slice),
    )
    .filter((slice) => Boolean(slice.unavailableReason));
  const hasUnavailable =
    Boolean(pageUnavailableReason) || unavailableSections.length > 0;
  const failedImports =
    !hasLoadedData ||
    pageUnavailableReason ||
    query.data?.errors.unavailableReason
      ? null
      : sum(errorRows.map((row) => row.count));
  const failedRows =
    !hasLoadedData ||
    pageUnavailableReason ||
    query.data?.health.unavailableReason
      ? null
      : healthSummary
        ? healthSummary.openRejectedRows +
          healthSummary.criticalRejectedRows +
          healthSummary.rejectedRowsLast24h +
          healthSummary.latestSyncRowsFailed
        : 0;
  const mappingReviewCount = query.data?.mappingReview.count ?? 0;
  const mappingIssues =
    !hasLoadedData ||
    pageUnavailableReason ||
    (query.data?.mappings.unavailableReason &&
      query.data?.mappingReview.unavailableReason)
      ? null
      : mappingRows.filter((row) => row.needsReview).length +
        mappingReviewCount;
  const alertSummary = countAlerts(alertRows);
  const alertCount =
    !hasLoadedData ||
    pageUnavailableReason ||
    query.data?.alerts.unavailableReason
      ? null
      : alertSummary.count;
  const alertLabel = alertSummary.label;
  const staleSources =
    !hasLoadedData ||
    pageUnavailableReason ||
    query.data?.health.unavailableReason
      ? null
      : healthSummary &&
          (healthSummary.importHealthStatusKind === "warning" ||
            healthSummary.latestSyncStatusKind === "warning")
        ? 1
        : 0;
  const lastUpdate =
    !hasLoadedData || pageUnavailableReason
      ? null
      : latestDate([
          healthSummary?.latestSyncAt ?? null,
          healthSummary?.latestRejectedRowAt ?? null,
          ...errorRows.map((row) => row.lastSeen),
          ...mappingRows.map((row) => row.updatedAt),
          ...alertRows.map((row) => row.createdAt),
        ]);
  const needsReview =
    hasLoadedData &&
    [failedImports, failedRows, mappingIssues, alertCount, staleSources].some(
      (value) => (value ?? 0) > 0,
    );
  const overall = hasUnavailable
    ? "partial"
    : needsReview
      ? "review"
      : "healthy";

  const actions = buildActions({
    ui,
    failedImports,
    failedRows,
    mappingIssues,
    alertCount,
    hasUnavailable,
  });

  return (
    <DashboardLayout title={t("importsTitle")} subtitle={t("importsSubtitle")}>
      <div className="space-y-4">
        {signedOut ? <Message>{ui.signIn}</Message> : null}
        {!signedOut && isInitialLoading ? (
          <Message>{ui.loading}</Message>
        ) : null}

        {!signedOut && !isInitialLoading ? (
          <Toolbar
            label={hasUnavailable ? ui.someUnavailable : ui.dataAvailable}
            unavailable={hasUnavailable}
            refreshLabel={query.isFetching ? ui.refreshing : ui.refresh}
            onRefresh={() => void query.refetch()}
            isRefreshing={query.isFetching}
          />
        ) : null}

        {!signedOut && !isInitialLoading ? (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            <MetricCard
              title={ui.kpis.health}
              value={
                overall === "partial"
                  ? ui.kpis.partial
                  : overall === "review"
                    ? ui.kpis.needsReview
                    : ui.kpis.healthy
              }
              helper={
                overall === "partial"
                  ? ui.kpis.healthPartial
                  : overall === "review"
                    ? ui.kpis.healthReview
                    : ui.kpis.healthOk
              }
              tone={
                overall === "partial"
                  ? "error"
                  : overall === "review"
                    ? "warning"
                    : "success"
              }
            />
            <MetricCard
              title={ui.kpis.lastUpdate}
              value={
                pageUnavailableReason
                  ? ui.unavailable
                  : lastUpdate
                    ? formatDateTime(lastUpdate, lang)
                    : ui.noUpdates
              }
              helper={
                pageUnavailableReason
                  ? ui.sourceUnavailable
                  : ui.kpis.lastUpdateHelper
              }
              unavailable={pageUnavailableReason}
              href={ROUTES.adsConnectors}
            />
            <MetricCard
              title={ui.kpis.importErrors}
              value={formatNullableCount(failedImports, ui)}
              helper={ui.kpis.importErrorsHelper}
              unavailable={
                pageUnavailableReason ?? query.data?.errors.unavailableReason
              }
              href="#import-errors"
            />
            <MetricCard
              title={ui.kpis.problemRows}
              value={formatNullableCount(failedRows, ui)}
              helper={ui.kpis.problemRowsHelper}
              unavailable={
                pageUnavailableReason ?? query.data?.health.unavailableReason
              }
              href="#import-health"
            />
            <MetricCard
              title={ui.kpis.mapping}
              value={formatNullableCount(mappingIssues, ui)}
              helper={ui.kpis.mappingHelper}
              unavailable={mappingIssues === null}
              href={ROUTES.bindings}
            />
            <MetricCard
              title={ui.kpis.alerts}
              value={formatNullableCount(alertCount, ui)}
              helper={
                alertLabel === "open"
                  ? ui.kpis.openAlertsHelper
                  : ui.kpis.recentAlertsHelper
              }
              unavailable={
                pageUnavailableReason ?? query.data?.alerts.unavailableReason
              }
              href={ROUTES.alerts}
            />
          </div>
        ) : null}

        {!signedOut && !isInitialLoading ? (
          <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
            <div className="space-y-4">
              <div id="import-health">
                <SectionCard
                  title={ui.activity.title}
                  description={ui.activity.desc}
                  noPadding
                >
                  <AvailabilityBoundary
                    unavailableReason={
                      pageUnavailableReason ??
                      query.data?.health.unavailableReason
                    }
                    errorText={ui.activity.error}
                    errorHelp={ui.activity.errorHelp}
                    empty={!healthSummary}
                    emptyText={ui.activity.empty}
                  >
                    {healthSummary ? (
                      <dl className="grid gap-x-6 p-3 sm:grid-cols-2">
                        <HealthSummaryItem label={ui.activity.importHealth}>
                          <HumanStatusBadge
                            status={healthSummary.importHealthStatusKind}
                            label={statusLabel(
                              healthSummary.importHealthStatus,
                              healthSummary.importHealthStatusKind,
                              ui,
                            )}
                          />
                        </HealthSummaryItem>
                        <HealthSummaryItem label={ui.activity.latestSync}>
                          <HumanStatusBadge
                            status={healthSummary.latestSyncStatusKind}
                            label={statusLabel(
                              healthSummary.latestSyncStatus,
                              healthSummary.latestSyncStatusKind,
                              ui,
                            )}
                          />
                        </HealthSummaryItem>
                        <HealthSummaryItem label={ui.activity.latestSyncTime}>
                          {formatNullableDate(healthSummary.latestSyncAt, lang)}
                        </HealthSummaryItem>
                        <HealthSummaryItem
                          label={ui.activity.latestSyncFailedRows}
                          emphasize={healthSummary.latestSyncRowsFailed > 0}
                        >
                          {fmtNum(healthSummary.latestSyncRowsFailed)}
                        </HealthSummaryItem>
                        <HealthSummaryItem
                          label={ui.activity.openRejectedRows}
                          emphasize={healthSummary.openRejectedRows > 0}
                        >
                          {fmtNum(healthSummary.openRejectedRows)}
                        </HealthSummaryItem>
                        <HealthSummaryItem
                          label={ui.activity.criticalRejectedRows}
                          emphasize={healthSummary.criticalRejectedRows > 0}
                        >
                          {fmtNum(healthSummary.criticalRejectedRows)}
                        </HealthSummaryItem>
                        <HealthSummaryItem
                          label={ui.activity.rejectedRowsLast24h}
                          emphasize={healthSummary.rejectedRowsLast24h > 0}
                        >
                          {fmtNum(healthSummary.rejectedRowsLast24h)}
                        </HealthSummaryItem>
                        <HealthSummaryItem label={ui.activity.latestRejectedRow}>
                          {formatNullableDate(healthSummary.latestRejectedRowAt, lang)}
                        </HealthSummaryItem>
                      </dl>
                    ) : null}
                  </AvailabilityBoundary>
                </SectionCard>
              </div>

              <div id="import-errors">
                <SectionCard
                  title={ui.errors.title}
                  description={ui.errors.desc}
                  noPadding
                >
                  <AvailabilityBoundary
                    unavailableReason={
                      pageUnavailableReason ??
                      query.data?.errors.unavailableReason
                    }
                    errorText={ui.errors.error}
                    empty={!errorRows.length}
                    emptyText={ui.errors.empty}
                  >
                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>{ui.errors.source}</TableHead>
                            <TableHead>{ui.errors.sourceType}</TableHead>
                            <TableHead>{ui.errors.errorCode}</TableHead>
                            <TableHead>{ui.errors.severity}</TableHead>
                            <TableHead>{ui.errors.status}</TableHead>
                            <TableHead className="text-right">
                              {ui.errors.count}
                            </TableHead>
                            <TableHead>{ui.errors.firstSeen}</TableHead>
                            <TableHead>{ui.errors.lastSeen}</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {errorRows.slice(0, 100).map((row, index) => (
                            <TableRow
                              key={`${row.source}-${row.errorCode}-${index}`}
                            >
                              <TableCell className="font-medium">
                                {row.source}
                              </TableCell>
                              <TableCell>{row.sourceType}</TableCell>
                              <TableCell>{row.errorCode}</TableCell>
                              <TableCell>
                                <HumanStatusBadge
                                  status={row.severityKind}
                                  label={humanize(row.severity)}
                                />
                              </TableCell>
                              <TableCell>
                                <HumanStatusBadge
                                  status={row.statusKind}
                                  label={statusLabel(
                                    row.status,
                                    row.statusKind,
                                    ui,
                                  )}
                                />
                              </TableCell>
                              <TableCell className="text-right num font-semibold text-destructive">
                                {fmtNum(row.count)}
                              </TableCell>
                              <TableCell>
                                {formatNullableDate(row.firstSeen, lang)}
                              </TableCell>
                              <TableCell>
                                {formatNullableDate(row.lastSeen, lang)}
                              </TableCell>
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    </div>
                  </AvailabilityBoundary>
                </SectionCard>
              </div>

              <SectionCard
                title={ui.mapping.title}
                description={ui.mapping.desc}
                actions={
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                  >
                    <Link to={ROUTES.bindings}>
                      {ui.mapping.goBindings}
                      <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                }
                noPadding
              >
                <AvailabilityBoundary
                  unavailableReason={
                    pageUnavailableReason ??
                    (query.data?.mappings.unavailableReason &&
                    query.data?.mappingReview.unavailableReason
                      ? query.data.mappings.unavailableReason
                      : null)
                  }
                  errorText={ui.mapping.error}
                  empty={!mappingRows.length}
                  emptyText={ui.mapping.empty}
                >
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{ui.mapping.name}</TableHead>
                          <TableHead>{ui.mapping.sourceType}</TableHead>
                          <TableHead>{ui.mapping.targetTable}</TableHead>
                          <TableHead>{ui.mapping.fileType}</TableHead>
                          <TableHead>{ui.mapping.status}</TableHead>
                          <TableHead className="text-right">
                            {ui.mapping.activeFields}
                          </TableHead>
                          <TableHead className="text-right">
                            {ui.mapping.requiredFields}
                          </TableHead>
                          <TableHead>{ui.mapping.updatedAt}</TableHead>
                          <TableHead>{ui.actions}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {mappingRows.slice(0, 100).map((row, index) => (
                          <TableRow
                            key={`${row.name}-${row.updatedAt ?? index}`}
                            className={
                              row.needsReview ? "bg-warning-soft/30" : undefined
                            }
                          >
                            <TableCell className="font-medium">
                              {row.name}
                            </TableCell>
                            <TableCell>{row.sourceType}</TableCell>
                            <TableCell>{row.targetTable}</TableCell>
                            <TableCell>{row.fileType}</TableCell>
                            <TableCell>
                              <HumanStatusBadge
                                status={row.statusKind}
                                label={statusLabel(
                                  row.status,
                                  row.statusKind,
                                  ui,
                                )}
                              />
                            </TableCell>
                            <TableCell className="text-right num">
                              {formatNullableNumber(row.activeFieldsCount)}
                            </TableCell>
                            <TableCell className="text-right num">
                              {formatNullableNumber(row.requiredFieldsCount)}
                            </TableCell>
                            <TableCell>
                              {formatNullableDate(row.updatedAt, lang)}
                            </TableCell>
                            <TableCell>
                              <Link
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                to={ROUTES.bindings}
                              >
                                {row.needsReview
                                  ? ui.mapping.goBindings
                                  : ui.open}
                                <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AvailabilityBoundary>
              </SectionCard>

              <SectionCard
                title={ui.alerts.title}
                description={ui.alerts.desc}
                actions={
                  <Button
                    asChild
                    size="sm"
                    variant="outline"
                    className="h-8 text-xs"
                  >
                    <Link to={ROUTES.alerts}>
                      {ui.alerts.goAlerts}
                      <ArrowUpRight className="ml-1 h-3.5 w-3.5" />
                    </Link>
                  </Button>
                }
                noPadding
              >
                <AvailabilityBoundary
                  unavailableReason={
                    pageUnavailableReason ??
                    query.data?.alerts.unavailableReason
                  }
                  errorText={ui.alerts.error}
                  empty={!alertRows.length}
                  emptyText={ui.alerts.empty}
                >
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader>
                        <TableRow>
                          <TableHead>{ui.alerts.severity}</TableHead>
                          <TableHead>{ui.alerts.titleCol}</TableHead>
                          <TableHead>{ui.alerts.status}</TableHead>
                          <TableHead>{ui.alerts.createdAt}</TableHead>
                          <TableHead>{ui.actions}</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {alertRows.slice(0, 100).map((row, index) => (
                          <TableRow
                            key={`${row.title}-${row.createdAt ?? index}`}
                          >
                            <TableCell>
                              <HumanStatusBadge
                                status={severityKind(row.severity)}
                                label={humanize(row.severity)}
                              />
                            </TableCell>
                            <TableCell className="font-medium">
                              {row.title}
                            </TableCell>
                            <TableCell>
                              <HumanStatusBadge
                                status={row.statusKind}
                                label={statusLabel(
                                  row.status,
                                  row.statusKind,
                                  ui,
                                )}
                              />
                            </TableCell>
                            <TableCell>
                              {formatNullableDate(row.createdAt, lang)}
                            </TableCell>
                            <TableCell>
                              <Link
                                className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
                                to={ROUTES.alerts}
                              >
                                {ui.alerts.goAlerts}
                                <ArrowUpRight className="h-3 w-3" />
                              </Link>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </AvailabilityBoundary>
              </SectionCard>
            </div>

            <SectionCard
              title={ui.actionPanel.title}
              description={ui.actionPanel.desc}
              className="xl:sticky xl:top-4 xl:self-start"
            >
              <div className="space-y-2">
                {actions.map((action) =>
                  action.href ? (
                    <Link
                      key={action.key}
                      to={action.href}
                      className={cn(
                        "flex items-start gap-2.5 rounded-lg border p-2.5 transition-colors hover:bg-muted/50",
                        action.tone === "warning" &&
                          "border-warning/30 bg-warning-soft/20",
                        action.tone === "error" &&
                          "border-destructive/25 bg-destructive-soft/20",
                      )}
                    >
                      <ActionIcon tone={action.tone} />
                      <span className="min-w-0 flex-1 text-sm font-medium">
                        {action.label}
                      </span>
                      <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                    </Link>
                  ) : (
                    <div
                      key={action.key}
                      className="flex items-start gap-2.5 rounded-lg border border-success/25 bg-success-soft/10 p-2.5"
                    >
                      <ActionIcon tone={action.tone} />
                      <span className="text-sm font-medium text-success">
                        {action.label}
                      </span>
                    </div>
                  ),
                )}
                {actions.some((action) => action.key !== "clear") ? (
                  <Link
                    to={ROUTES.adsConnectors}
                    className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
                  >
                    {ui.actionPanel.sources}
                    <ArrowUpRight className="h-3 w-3" />
                  </Link>
                ) : null}
              </div>
            </SectionCard>
          </div>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

async function readImportsDashboard(): Promise<ImportsData> {
  const [health, errors, mappings, mappingReview, alerts] = await Promise.all([
    supabase.rpc("get_import_health_summary" as never, {
      p_workspace_id: WORKSPACE_ID,
    } as never),
    supabase
      .from("v_import_error_summary")
      .select(
        "workspace_id,source_name,source_type,source_table,target_table,error_code,severity,status,rejected_rows_count,first_seen_at,last_seen_at",
      )
      .eq("workspace_id", WORKSPACE_ID)
      .order("last_seen_at", { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from("v_file_import_mappings")
      .select(
        "workspace_id,name,source_type,target_table,file_type,status,updated_at,active_fields_count,required_fields_count",
      )
      .eq("workspace_id", WORKSPACE_ID)
      .order("updated_at", { ascending: false, nullsFirst: false })
      .limit(200),
    supabase
      .from("v_mapping_review_queue")
      .select("workspace_id", { count: "exact", head: true })
      .eq("workspace_id", WORKSPACE_ID),
    supabase
      .from("v_alert_events_recent")
      .select("severity,title,status,created_at")
      .eq("workspace_id", WORKSPACE_ID)
      .order("created_at", { ascending: false })
      .limit(200),
  ]);

  warnUnavailable("get_import_health_summary", health.error);
  warnUnavailable("v_import_error_summary", errors.error);
  warnUnavailable("v_file_import_mappings", mappings.error);
  warnUnavailable("v_mapping_review_queue", mappingReview.error);
  warnUnavailable("v_alert_events_recent", alerts.error);

  return {
    health: toSlice<ImportHealthRow>(
      health.data,
      health.error?.message ?? null,
    ),
    errors: toSlice<ImportErrorRow>(errors.data, errors.error?.message ?? null),
    mappings: toSlice<MappingRow>(
      mappings.data,
      mappings.error?.message ?? null,
    ),
    mappingReview: toCountSlice(
      mappingReview.count,
      mappingReview.error?.message ?? null,
    ),
    alerts: toSlice<AlertRow>(alerts.data, alerts.error?.message ?? null),
  };
}

function toSlice<T>(
  data: unknown,
  unavailableReason: string | null,
): QuerySlice<T> {
  return {
    rows: unavailableReason ? [] : toRows<T>(data),
    unavailableReason,
  };
}

function toRows<T>(data: unknown): T[] {
  if (!data) return [];
  return (Array.isArray(data) ? data : [data]) as T[];
}

function toCountSlice(
  count: number | null,
  unavailableReason: string | null,
): CountSlice {
  return { count: unavailableReason ? null : (count ?? 0), unavailableReason };
}

function warnUnavailable(viewName: string, error: { message?: string } | null) {
  if (error)
    console.warn(`Imports/Data Health: ${viewName} unavailable`, error);
}

function normalizeImportHealthSummary(
  rows: ImportHealthRow[] | null,
): NormalizedImportHealth | null {
  if (!rows?.length) return null;

  const normalizedRows = rows.map((row) => {
    const importHealthStatus = readString(row.import_health_status) || "unknown";
    const latestSyncStatus = readString(row.latest_sync_status) || "unknown";
    const latestSyncRowsFailed = toNumber(row.latest_sync_rows_failed);
    const openRejectedRows = toNumber(row.open_rejected_rows);
    const criticalRejectedRows = toNumber(row.critical_rejected_rows);
    const rejectedRowsLast24h = toNumber(row.rejected_rows_last_24h);
    return {
      importHealthStatus,
      importHealthStatusKind: statusKind(
        importHealthStatus,
        openRejectedRows + criticalRejectedRows + rejectedRowsLast24h > 0
          ? "warning"
          : "unknown",
      ),
      latestSyncStatus,
      latestSyncStatusKind: statusKind(
        latestSyncStatus,
        latestSyncRowsFailed > 0 ? "error" : "unknown",
      ),
      latestSyncAt: readTimestamp(row.latest_sync_at),
      latestSyncRowsFailed,
      openRejectedRows,
      criticalRejectedRows,
      rejectedRowsLast24h,
      latestRejectedRowAt: readTimestamp(row.latest_rejected_row_at),
    } satisfies NormalizedImportHealth;
  });

  if (normalizedRows.length === 1) return normalizedRows[0];

  const importHealthStatusKind = mostSevereStatus(
    normalizedRows.map((row) => row.importHealthStatusKind),
  );
  const latestSyncStatusKind = mostSevereStatus(
    normalizedRows.map((row) => row.latestSyncStatusKind),
  );

  return {
    importHealthStatus:
      normalizedRows.find(
        (row) => row.importHealthStatusKind === importHealthStatusKind,
      )?.importHealthStatus ?? "unknown",
    importHealthStatusKind,
    latestSyncStatus:
      normalizedRows.find((row) => row.latestSyncStatusKind === latestSyncStatusKind)
        ?.latestSyncStatus ?? "unknown",
    latestSyncStatusKind,
    latestSyncAt: latestDate(normalizedRows.map((row) => row.latestSyncAt)),
    latestSyncRowsFailed: maxNumber(
      normalizedRows.map((row) => row.latestSyncRowsFailed),
    ),
    openRejectedRows: maxNumber(
      normalizedRows.map((row) => row.openRejectedRows),
    ),
    criticalRejectedRows: maxNumber(
      normalizedRows.map((row) => row.criticalRejectedRows),
    ),
    rejectedRowsLast24h: maxNumber(
      normalizedRows.map((row) => row.rejectedRowsLast24h),
    ),
    latestRejectedRowAt: latestDate(
      normalizedRows.map((row) => row.latestRejectedRowAt),
    ),
  };
}

function normalizeImportErrors(
  rows: ImportErrorRow[],
): NormalizedImportError[] {
  return rows.map((row) => {
    const severity = readString(row.severity) || "unknown";
    const status = readString(row.status) || "unknown";
    return {
      source: readString(row.source_name) || readString(row.source_table) || "—",
      sourceType: readString(row.source_type) || "—",
      errorCode: readString(row.error_code) || "—",
      severity,
      severityKind: severityKind(severity),
      status,
      statusKind: statusKind(status, "unknown"),
      count: toNumber(row.rejected_rows_count),
      firstSeen: readString(row.first_seen_at) || null,
      lastSeen: readString(row.last_seen_at) || null,
    };
  });
}

function normalizeMappings(rows: MappingRow[]): NormalizedMapping[] {
  return rows.map((row) => {
    const status = readString(row.status) || "unknown";
    const needsReview = isMappingIssueStatus(status);
    return {
      name: readString(row.name) || "—",
      sourceType: readString(row.source_type) || "—",
      targetTable: readString(row.target_table) || "—",
      fileType: readString(row.file_type) || "—",
      status,
      statusKind: needsReview
        ? statusKind(status, "warning")
        : statusKind(status, "success"),
      updatedAt: readString(row.updated_at) || null,
      activeFieldsCount: toNullableNumber(row.active_fields_count),
      requiredFieldsCount: toNullableNumber(row.required_fields_count),
      needsReview,
    };
  });
}

function normalizeAlerts(rows: AlertRow[]): NormalizedAlert[] {
  return rows.map((row) => {
    const status = readString(row.status) || "recent";
    return {
      severity: readString(row.severity) || "info",
      title: readString(row.title) || "—",
      status,
      statusKind: statusKind(status, "unknown"),
      createdAt: readString(row.created_at) || null,
      isOpen: isOpenAlertStatus(status),
    };
  });
}

function statusKind(value: string, fallback: SourceStatus): SourceStatus {
  const normalized = value.toLowerCase();
  if (
    [
      "success",
      "healthy",
      "complete",
      "completed",
      "confirmed",
      "ok",
      "active",
      "resolved",
    ].some((token) => normalized.includes(token))
  )
    return "success";
  if (
    ["pending", "review", "partial", "stale", "warning", "queued"].some(
      (token) => normalized.includes(token),
    )
  )
    return "warning";
  if (
    ["fail", "error", "reject", "invalid", "critical", "blocked"].some(
      (token) => normalized.includes(token),
    )
  )
    return "error";
  return fallback;
}

function isMappingIssueStatus(value: string) {
  const normalized = value.toLowerCase();
  if (
    ["confirmed", "healthy", "complete", "completed", "ok"].some((token) =>
      normalized.includes(token),
    )
  )
    return false;
  return [
    "pending",
    "review",
    "fail",
    "error",
    "reject",
    "invalid",
    "missing",
    "unknown",
    "unmapped",
  ].some((token) => normalized.includes(token));
}

function isOpenAlertStatus(status: string): boolean | null {
  const normalized = status.toLowerCase();
  if (
    ["open", "active", "unresolved", "pending", "new"].some((token) =>
      normalized.includes(token),
    )
  )
    return true;
  if (
    ["resolved", "closed", "dismissed"].some((token) =>
      normalized.includes(token),
    )
  )
    return false;
  return null;
}

function countAlerts(rows: NormalizedAlert[]) {
  const withOpenSemantics = rows.filter((row) => row.isOpen !== null);
  if (withOpenSemantics.length > 0)
    return {
      count: withOpenSemantics.filter((row) => row.isOpen).length,
      label: "open" as const,
    };
  return { count: rows.length, label: "recent" as const };
}

function buildActions({
  ui,
  failedImports,
  failedRows,
  mappingIssues,
  alertCount,
  hasUnavailable,
}: {
  ui: Copy;
  failedImports: number | null;
  failedRows: number | null;
  mappingIssues: number | null;
  alertCount: number | null;
  hasUnavailable: boolean;
}) {
  const actions: {
    key: string;
    label: string;
    href?: string;
    tone: "success" | "warning" | "error";
  }[] = [];
  if (hasUnavailable)
    actions.push({
      key: "unavailable",
      label: ui.actionPanel.unavailable,
      tone: "error",
    });
  if ((failedImports ?? 0) > 0)
    actions.push({
      key: "errors",
      label: ui.actionPanel.importErrors,
      href: "#import-errors",
      tone: "error",
    });
  if ((failedRows ?? 0) > 0)
    actions.push({
      key: "rows",
      label: ui.actionPanel.rowsFailed,
      href: "#import-health",
      tone: "error",
    });
  if ((mappingIssues ?? 0) > 0)
    actions.push({
      key: "mapping",
      label: ui.actionPanel.mapping,
      href: ROUTES.bindings,
      tone: "warning",
    });
  if ((alertCount ?? 0) > 0)
    actions.push({
      key: "alerts",
      label: ui.actionPanel.alerts,
      href: ROUTES.alerts,
      tone: "warning",
    });
  if (actions.length === 0)
    actions.push({
      key: "clear",
      label: ui.actionPanel.noIssues,
      tone: "success",
    });
  return actions;
}

function Toolbar({
  label,
  unavailable,
  refreshLabel,
  onRefresh,
  isRefreshing,
}: {
  label: string;
  unavailable: boolean;
  refreshLabel: string;
  onRefresh: () => void;
  isRefreshing: boolean;
}) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-card-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge
          status={unavailable ? "warning" : "healthy"}
          label={label}
        />
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 text-xs"
          onClick={onRefresh}
          disabled={isRefreshing}
        >
          <RefreshCw
            className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")}
          />
          {refreshLabel}
        </Button>
      </div>
    </div>
  );
}

function MetricCard({
  title,
  value,
  helper,
  unavailable,
  tone = "neutral",
  href,
}: {
  title: string;
  value: string;
  helper: string;
  unavailable?: string | boolean | null;
  tone?: "success" | "warning" | "error" | "neutral";
  href?: string;
}) {
  const content = (
    <div
      className={cn(
        "group flex min-h-[82px] flex-col rounded-xl border border-border/70 bg-card px-3 py-2.5 shadow-card transition-all",
        href && "h-full hover:border-primary/40 hover:shadow-card-md",
        tone === "warning" && "border-warning/30 bg-warning-soft/10",
        tone === "error" && "border-destructive/20 bg-destructive-soft/10",
      )}
    >
      <div className="flex items-start justify-between gap-2">
        <p className="min-w-0 text-[10px] font-semibold uppercase leading-tight tracking-[0.08em] text-muted-foreground">
          {title}
        </p>
        {href ? (
          <ArrowUpRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        ) : null}
      </div>
      <p
        className={cn(
          "mt-1 truncate text-lg font-semibold leading-tight tracking-tight",
          unavailable && "text-sm text-muted-foreground",
        )}
      >
        {value}
      </p>
      <p className="mt-auto line-clamp-2 pt-1 text-[11px] leading-snug text-muted-foreground">
        {helper}
      </p>
    </div>
  );
  if (!href) return content;
  return href.startsWith("#") ? (
    <a className="block h-full" href={href}>
      {content}
    </a>
  ) : (
    <Link className="block h-full" to={href}>
      {content}
    </Link>
  );
}

function HealthSummaryItem({
  label,
  emphasize = false,
  children,
}: {
  label: string;
  emphasize?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="grid grid-cols-[minmax(8rem,0.9fr)_minmax(0,1.1fr)] items-center gap-3 border-b border-border/60 py-2 last:border-b-0 sm:even:last:border-b-0 sm:[&:nth-last-child(2)]:border-b-0">
      <dt className="text-[11px] font-semibold uppercase leading-tight tracking-[0.08em] text-muted-foreground">
        {label}
      </dt>
      <dd
        className={cn(
          "min-w-0 text-right text-sm font-semibold leading-tight sm:text-left",
          emphasize && "text-destructive",
        )}
      >
        {children}
      </dd>
    </div>
  );
}

function AvailabilityBoundary({
  unavailableReason,
  errorText,
  errorHelp,
  empty,
  emptyText,
  children,
}: {
  unavailableReason?: string | null;
  errorText: string;
  errorHelp?: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (unavailableReason)
    return (
      <Message tone="error" helper={errorHelp}>
        {errorText}
      </Message>
    );
  if (empty) return <Message>{emptyText}</Message>;
  return <>{children}</>;
}


function Message({
  children,
  helper,
  tone = "neutral",
}: {
  children: React.ReactNode;
  helper?: string;
  tone?: "neutral" | "error";
}) {
  return (
    <div
      className={cn(
        "m-4 rounded-lg border p-3 text-sm",
        tone === "error"
          ? "border-destructive/20 bg-destructive-soft/10 text-foreground"
          : "border-border/70 bg-muted/20 text-muted-foreground",
      )}
    >
      <p className={cn("font-medium", tone === "error" && "text-destructive")}>
        {children}
      </p>
      {helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}
    </div>
  );
}

function HumanStatusBadge({
  status,
  label,
}: {
  status: SourceStatus;
  label: string;
}) {
  if (status === "success")
    return <StatusBadge status="healthy" label={label} />;
  if (status === "warning")
    return <StatusBadge status="warning" label={label} />;
  if (status === "error") return <StatusBadge status="failed" label={label} />;
  return <StatusBadge status="info" label={label} />;
}

function ActionIcon({ tone }: { tone: "success" | "warning" | "error" }) {
  if (tone === "success")
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />;
  if (tone === "error")
    return (
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />
    );
  return (
    <Database className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
  );
}

function statusLabel(value: string, kind: SourceStatus, ui: Copy) {
  const normalized = value.toLowerCase();
  if (normalized === "unknown" || !normalized) return ui.statuses.unknown;
  if (normalized.includes("confirm") || normalized.includes("complete"))
    return ui.statuses.confirmed;
  if (normalized.includes("pending") || normalized.includes("review"))
    return ui.statuses.pending;
  if (normalized.includes("active")) return ui.statuses.active;
  if (normalized.includes("resolved")) return ui.statuses.resolved;
  if (kind === "success") return ui.statuses.success;
  if (kind === "warning") return ui.statuses.warning;
  if (kind === "error") return ui.statuses.error;
  return value === "recent" ? ui.statuses.unknown : humanize(value);
}

function severityKind(value: string): SourceStatus {
  const normalized = value.toLowerCase();
  if (["critical", "error", "high"].some((token) => normalized.includes(token)))
    return "error";
  if (["warning", "medium"].some((token) => normalized.includes(token)))
    return "warning";
  if (["success", "healthy", "low"].some((token) => normalized.includes(token)))
    return "success";
  return "unknown";
}

function readString(value: Primitive | undefined) {
  if (value === null || value === undefined || value === "") return "";
  return String(value);
}

function readTimestamp(value: Primitive | undefined) {
  const timestamp = readString(value);
  return timestamp || null;
}

function toNumber(value: Primitive | undefined) {
  const numeric = Number(value ?? 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function toNullableNumber(value: Primitive | undefined) {
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function maxNumber(values: number[]) {
  return values.reduce((highest, value) => Math.max(highest, value), 0);
}

function mostSevereStatus(values: SourceStatus[]): SourceStatus {
  if (values.includes("error")) return "error";
  if (values.includes("warning")) return "warning";
  if (values.includes("success")) return "success";
  return "unknown";
}

function formatNullableCount(value: number | null, ui: Copy) {
  return value === null ? ui.unavailable : fmtNum(value);
}

function formatNullableNumber(value: number | null) {
  return value === null ? "—" : fmtNum(value);
}

function formatNullableDate(value: string | null, lang: "uk" | "en") {
  return value ? formatDateTime(value, lang) : "—";
}

function formatDateTime(value: string, lang: "uk" | "en") {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  const parts = new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", {
    day: "numeric",
    month: lang === "uk" ? "short" : "long",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  })
    .formatToParts(date)
    .reduce<Record<string, string>>((acc, part) => {
      if (part.type !== "literal") acc[part.type] = part.value;
      return acc;
    }, {});

  const time = `${parts.hour ?? "00"}:${parts.minute ?? "00"}`;
  if (lang === "uk") {
    return `${parts.day} ${parts.month} ${parts.year}, ${time}`;
  }
  return `${parts.month} ${parts.day}, ${parts.year}, ${time}`;
}

function latestDate(values: (string | null)[]) {
  return values.reduce<string | null>((latest, value) => {
    if (!value) return latest;
    const timestamp = new Date(value).getTime();
    if (Number.isNaN(timestamp)) return latest;
    if (!latest) return value;
    return timestamp > new Date(latest).getTime() ? value : latest;
  }, null);
}

function humanize(value: string) {
  if (!value || value === "—") return "—";
  return value
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}
