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
      lastUpdate: "Останнє оновлення",
      lastUpdateHelper: "Максимальна дата з доступних джерел",
      importErrors: "Помилки імпорту",
      importErrorsHelper: "Сума rejected rows у зведенні помилок",
      problemRows: "Rejected / failed rows",
      problemRowsHelper: "Сума відкритих, критичних, 24-год rejected rows і помилок останнього sync",
      noRowCounter: "Немає окремого лічильника",
      mapping: "Мапінг",
      mappingHelper: "Очевидні pending/error статуси",
      alerts: "Сповіщення",
      openAlertsHelper: "Відкриті / активні сигнали",
      recentAlertsHelper: "Останні сигнали без статусу відкриття",
    },
    activity: {
      title: "Стан імпортів",
      desc: "Зведення синхронізацій і rejected rows",
      error: "Не вдалося завантажити стан імпортів.",
      empty: "Стан імпортів поки не зафіксований.",
      importHealth: "Стан імпортів",
      latestSync: "Останній sync",
      latestSyncTime: "Час останнього sync",
      latestSyncFailedRows: "Помилки в останньому sync",
      openRejectedRows: "Відкриті rejected rows",
      criticalRejectedRows: "Критичні rejected rows",
      rejectedRowsLast24h: "Rejected rows за 24 год",
      latestRejectedRow: "Останній rejected row",
    },
    errors: {
      title: "Помилки імпорту",
      desc: "Коди помилок і rejected rows за джерелами",
      error: "Не вдалося завантажити помилки імпорту.",
      empty: "Помилок імпорту не знайдено.",
      source: "Джерело",
      sourceType: "Тип джерела",
      errorCode: "Код помилки",
      severity: "Рівень",
      status: "Статус",
      count: "Rejected rows",
      firstSeen: "Перша поява",
      lastSeen: "Остання поява",
    },
    mapping: {
      title: "Стан мапінгу",
      desc: "Привʼязка імпортованих джерел до бізнес-структури",
      error: "Не вдалося завантажити стан мапінгу.",
      empty: "Рядків мапінгу поки немає.",
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
      desc: "Дії формуються лише з фактичних сигналів на сторінці.",
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
      importErrorsHelper: "Sum of rejected rows in import error summary",
      problemRows: "Rejected / failed rows",
      problemRowsHelper: "Open, critical, 24h rejected rows plus latest sync failures",
      noRowCounter: "No row-level counter",
      mapping: "Mapping",
      mappingHelper: "Obvious pending/error statuses",
      alerts: "Alerts",
      openAlertsHelper: "Open / active signals",
      recentAlertsHelper: "Recent signals without open status",
    },
    activity: {
      title: "Import health",
      desc: "Sync and rejected-row summary",
      error: "Could not load import status.",
      empty: "Import health has not been recorded yet.",
      importHealth: "Import health",
      latestSync: "Latest sync",
      latestSyncTime: "Latest sync time",
      latestSyncFailedRows: "Failed rows in latest sync",
      openRejectedRows: "Open rejected rows",
      criticalRejectedRows: "Critical rejected rows",
      rejectedRowsLast24h: "Rejected rows last 24h",
      latestRejectedRow: "Latest rejected row",
    },
    errors: {
      title: "Import errors",
      desc: "Error codes and rejected rows by source",
      error: "Could not load import errors.",
      empty: "No import errors found.",
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
      empty: "No mapping rows yet.",
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
      desc: "Actions are based only on actual signals on this page.",
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

  const healthRows = useMemo(
    () => normalizeImportHealthRows(query.data?.health.rows ?? []),
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
      : sum(
          healthRows.map(
            (row) =>
              row.openRejectedRows +
              row.criticalRejectedRows +
              row.rejectedRowsLast24h +
              row.latestSyncRowsFailed,
          ),
        );
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
      : healthRows.filter(
          (row) =>
            row.importHealthStatusKind === "warning" ||
            row.latestSyncStatusKind === "warning",
        ).length;
  const lastUpdate =
    !hasLoadedData || pageUnavailableReason
      ? null
      : latestDate([
          ...healthRows.flatMap((row) => [
            row.latestSyncAt,
            row.latestRejectedRowAt,
          ]),
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
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
              helper={
                (pageUnavailableReason ?? query.data?.health.unavailableReason)
                  ? ui.sourceUnavailable
                  : ui.kpis.problemRowsHelper
              }
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
                    empty={!healthRows.length}
                    emptyText={ui.activity.empty}
                  >
                    <div className="grid gap-3 p-4 md:grid-cols-2 xl:grid-cols-4">
                      {healthRows.map((row, index) => (
                        <div
                          key={`${row.latestSyncAt ?? "sync"}-${row.latestRejectedRowAt ?? index}`}
                          className="rounded-lg border border-border/70 bg-muted/20 p-3"
                        >
                          <div className="space-y-3">
                            <HealthSummaryItem label={ui.activity.importHealth}>
                              <HumanStatusBadge
                                status={row.importHealthStatusKind}
                                label={statusLabel(
                                  row.importHealthStatus,
                                  row.importHealthStatusKind,
                                  ui,
                                )}
                              />
                            </HealthSummaryItem>
                            <HealthSummaryItem label={ui.activity.latestSync}>
                              <HumanStatusBadge
                                status={row.latestSyncStatusKind}
                                label={statusLabel(
                                  row.latestSyncStatus,
                                  row.latestSyncStatusKind,
                                  ui,
                                )}
                              />
                            </HealthSummaryItem>
                            <HealthSummaryItem label={ui.activity.latestSyncTime}>
                              {formatNullableDate(row.latestSyncAt, lang)}
                            </HealthSummaryItem>
                            <HealthSummaryItem
                              label={ui.activity.latestSyncFailedRows}
                              emphasize={row.latestSyncRowsFailed > 0}
                            >
                              {fmtNum(row.latestSyncRowsFailed)}
                            </HealthSummaryItem>
                            <HealthSummaryItem
                              label={ui.activity.openRejectedRows}
                              emphasize={row.openRejectedRows > 0}
                            >
                              {fmtNum(row.openRejectedRows)}
                            </HealthSummaryItem>
                            <HealthSummaryItem
                              label={ui.activity.criticalRejectedRows}
                              emphasize={row.criticalRejectedRows > 0}
                            >
                              {fmtNum(row.criticalRejectedRows)}
                            </HealthSummaryItem>
                            <HealthSummaryItem
                              label={ui.activity.rejectedRowsLast24h}
                              emphasize={row.rejectedRowsLast24h > 0}
                            >
                              {fmtNum(row.rejectedRowsLast24h)}
                            </HealthSummaryItem>
                            <HealthSummaryItem label={ui.activity.latestRejectedRow}>
                              {formatNullableDate(row.latestRejectedRowAt, lang)}
                            </HealthSummaryItem>
                          </div>
                        </div>
                      ))}
                    </div>
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
              <div className="space-y-3">
                {actions.map((action) =>
                  action.href ? (
                    <Link
                      key={action.key}
                      to={action.href}
                      className={cn(
                        "flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50",
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
                      className="flex items-start gap-3 rounded-lg border border-success/25 bg-success-soft/20 p-3"
                    >
                      <ActionIcon tone={action.tone} />
                      <span className="text-sm font-medium">
                        {action.label}
                      </span>
                    </div>
                  ),
                )}
                <Link
                  to={ROUTES.adsConnectors}
                  className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary hover:underline"
                >
                  {ui.actionPanel.sources}
                  <ArrowUpRight className="h-3 w-3" />
                </Link>
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
    supabase
      .from("v_import_health")
      .select(
        "workspace_id,open_rejected_rows,critical_rejected_rows,rejected_rows_last_24h,latest_rejected_row_at,latest_sync_status,latest_sync_rows_failed,latest_sync_at,import_health_status",
      )
      .eq("workspace_id", WORKSPACE_ID)
      .order("latest_sync_at", { ascending: false, nullsFirst: false })
      .limit(200),
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

  warnUnavailable("v_import_health", health.error);
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
  data: unknown[] | null,
  unavailableReason: string | null,
): QuerySlice<T> {
  return {
    rows: unavailableReason ? [] : ((data ?? []) as T[]),
    unavailableReason,
  };
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

function normalizeImportHealthRows(
  rows: ImportHealthRow[],
): NormalizedImportHealth[] {
  return rows.map((row) => {
    const importHealthStatus =
      readString(row.import_health_status) || "unknown";
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
      latestSyncAt: readString(row.latest_sync_at) || null,
      latestSyncRowsFailed,
      openRejectedRows,
      criticalRejectedRows,
      rejectedRowsLast24h,
      latestRejectedRowAt: readString(row.latest_rejected_row_at) || null,
    };
  });
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
  unavailable?: string | null;
  tone?: "success" | "warning" | "error" | "neutral";
  href?: string;
}) {
  const content = (
    <div
      className={cn(
        "group flex min-h-[148px] flex-col rounded-xl border border-border/70 bg-card p-4 shadow-card transition-all",
        href && "h-full hover:border-primary/40 hover:shadow-card-md",
        tone === "success" && "ring-accent-top",
        tone === "warning" && "border-warning/30",
        tone === "error" && "border-destructive/25",
      )}
    >
      <div className="flex min-h-[34px] items-start justify-between gap-2">
        <p className="min-w-0 text-[10px] font-semibold uppercase leading-snug tracking-[0.1em] text-muted-foreground">
          {title}
        </p>
        {href ? (
          <ArrowUpRight className="mt-0.5 h-3.5 w-3.5 shrink-0 text-muted-foreground transition-colors group-hover:text-primary" />
        ) : null}
      </div>
      <div className="mt-2 flex min-h-[40px] items-start">
        <p
          className={cn(
            "text-2xl font-semibold leading-tight tracking-tight",
            unavailable && "text-base text-muted-foreground",
          )}
        >
          {value}
        </p>
      </div>
      <p className="mt-2 min-h-[34px] text-xs leading-snug text-muted-foreground">
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
    <div className="flex items-start justify-between gap-3">
      <span className="text-xs leading-snug text-muted-foreground">{label}</span>
      <div
        className={cn(
          "shrink-0 text-right text-sm font-medium",
          emphasize && "text-destructive",
        )}
      >
        {children}
      </div>
    </div>
  );
}

function AvailabilityBoundary({
  unavailableReason,
  errorText,
  empty,
  emptyText,
  children,
}: {
  unavailableReason?: string | null;
  errorText: string;
  empty: boolean;
  emptyText: string;
  children: React.ReactNode;
}) {
  if (unavailableReason) return <Message tone="error">{errorText}</Message>;
  if (empty) return <Message>{emptyText}</Message>;
  return <>{children}</>;
}

function Message({
  children,
  tone = "neutral",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "error";
}) {
  return (
    <p
      className={cn(
        "m-4 rounded-lg border p-3 text-sm",
        tone === "error"
          ? "border-destructive/25 bg-destructive-soft/20 text-destructive"
          : "text-muted-foreground",
      )}
    >
      {children}
    </p>
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
  return new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", {
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
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
