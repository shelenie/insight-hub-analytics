import { useMemo } from "react";
import { Link } from "react-router-dom";
import { AlertTriangle, ArrowUpRight, CheckCircle2, Database, RefreshCw } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { fmtNum } from "@/lib/format";
import { cn } from "@/lib/utils";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const ROUTES = { bindings: "/bindings", alerts: "/alerts", adsConnectors: "/ads-connectors" } as const;

type Primitive = string | number | boolean | null;
type SourceStatus = "success" | "warning" | "error" | "unknown";
type QuerySlice<T> = { rows: T[]; unavailableReason: string | null };
type ImportsData = {
  health: QuerySlice<ImportHealthRow>;
  errors: QuerySlice<ImportErrorRow>;
  mappings: QuerySlice<MappingRow>;
  mappingReview: QuerySlice<MappingReviewRow>;
  alerts: QuerySlice<AlertRow>;
};

type ImportHealthRow = {
  source_name: Primitive;
  source_type: Primitive;
  status: Primitive;
  last_sync_at: Primitive;
  updated_at?: Primitive;
  created_at?: Primitive;
  rows_received: Primitive;
  rows_inserted: Primitive;
  rows_failed: Primitive;
};

type ImportErrorRow = {
  source_name: Primitive;
  error_type: Primitive;
  error_count: Primitive;
  last_error_at: Primitive;
  created_at?: Primitive;
};

type MappingRow = {
  source_name: Primitive;
  mapping_status: Primitive;
  updated_at: Primitive;
  created_at?: Primitive;
};

type MappingReviewRow = {
  source_name: Primitive;
  mapping_status: Primitive;
  created_at: Primitive;
  updated_at?: Primitive;
};

type AlertRow = {
  severity: Primitive;
  title: Primitive;
  status: Primitive;
  created_at: Primitive;
  resolved_at?: Primitive;
};

type NormalizedImportHealth = {
  source: string;
  type: string;
  status: string;
  statusKind: SourceStatus;
  lastSync: string | null;
  rowsReceived: number | null;
  rowsInserted: number | null;
  rowsFailed: number | null;
};

type NormalizedImportError = { source: string; type: string; count: number; lastError: string | null };
type NormalizedMapping = { source: string; status: string; statusKind: SourceStatus; updatedAt: string | null; needsReview: boolean };
type NormalizedAlert = { severity: string; title: string; status: string; statusKind: SourceStatus; createdAt: string | null; isOpen: boolean | null };

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
      importErrorsHelper: "Сума помилок у зведенні імпорту",
      problemRows: "Проблемні рядки",
      problemRowsHelper: "Сума проблемних рядків у стані імпортів",
      noRowCounter: "Немає окремого лічильника",
      mapping: "Мапінг",
      mappingHelper: "Очевидні pending/error статуси",
      alerts: "Сповіщення",
      openAlertsHelper: "Відкриті / активні сигнали",
      recentAlertsHelper: "Останні сигнали без статусу відкриття",
    },
    activity: {
      title: "Остання активність джерел",
      desc: "Синхронізації та лічильники імпортованих рядків",
      error: "Не вдалося завантажити стан імпортів.",
      empty: "Активність імпортів поки не зафіксована.",
      source: "Джерело",
      type: "Тип",
      status: "Статус",
      lastSync: "Остання синхронізація",
      received: "Отримано",
      inserted: "Додано",
      failed: "Помилки",
    },
    errors: {
      title: "Помилки імпорту",
      desc: "Типи помилок та час останнього збою",
      error: "Не вдалося завантажити помилки імпорту.",
      empty: "Помилок імпорту не знайдено.",
      source: "Джерело",
      type: "Тип помилки",
      count: "Кількість",
      lastError: "Остання помилка",
    },
    mapping: {
      title: "Стан мапінгу",
      desc: "Привʼязка імпортованих джерел до бізнес-структури",
      error: "Не вдалося завантажити стан мапінгу.",
      empty: "Рядків мапінгу поки немає.",
      source: "Джерело",
      status: "Статус мапінгу",
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
      importErrorsHelper: "Sum of errors in import summary",
      problemRows: "Problem rows",
      problemRowsHelper: "Sum of failed rows in import health",
      noRowCounter: "No row-level counter",
      mapping: "Mapping",
      mappingHelper: "Obvious pending/error statuses",
      alerts: "Alerts",
      openAlertsHelper: "Open / active signals",
      recentAlertsHelper: "Recent signals without open status",
    },
    activity: {
      title: "Recent source activity",
      desc: "Syncs and imported-row counters",
      error: "Could not load import status.",
      empty: "No import activity has been recorded yet.",
      source: "Source",
      type: "Type",
      status: "Status",
      lastSync: "Last sync",
      received: "Received",
      inserted: "Inserted",
      failed: "Failed",
    },
    errors: {
      title: "Import errors",
      desc: "Error types and latest failure time",
      error: "Could not load import errors.",
      empty: "No import errors found.",
      source: "Source",
      type: "Error type",
      count: "Count",
      lastError: "Last error",
    },
    mapping: {
      title: "Mapping health",
      desc: "Imported source bindings to business structure",
      error: "Could not load mapping health.",
      empty: "No mapping rows yet.",
      source: "Source",
      status: "Mapping status",
      updatedAt: "Updated at",
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

  const healthRows = useMemo(() => normalizeImportHealthRows(query.data?.health.rows ?? []), [query.data?.health.rows]);
  const errorRows = useMemo(() => normalizeImportErrors(query.data?.errors.rows ?? []), [query.data?.errors.rows]);
  const mappingRows = useMemo(
    () => normalizeMappings(query.data?.mappings.rows ?? [], query.data?.mappingReview.rows ?? []),
    [query.data?.mappings.rows, query.data?.mappingReview.rows],
  );
  const alertRows = useMemo(() => normalizeAlerts(query.data?.alerts.rows ?? []), [query.data?.alerts.rows]);

  const unavailableSections = [query.data?.health, query.data?.errors, query.data?.mappings, query.data?.mappingReview, query.data?.alerts]
    .filter((slice): slice is QuerySlice<unknown> => Boolean(slice))
    .filter((slice) => Boolean(slice.unavailableReason));
  const hasUnavailable = query.isError || unavailableSections.length > 0;
  const failedImports = query.data?.errors.unavailableReason ? null : sum(errorRows.map((row) => row.count));
  const failedRows = query.data?.health.unavailableReason ? null : sum(healthRows.map((row) => row.rowsFailed ?? 0));
  const mappingIssues = query.data?.mappings.unavailableReason && query.data?.mappingReview.unavailableReason ? null : mappingRows.filter((row) => row.needsReview).length;
  const alertCount = query.data?.alerts.unavailableReason ? null : countAlerts(alertRows).count;
  const alertLabel = countAlerts(alertRows).label;
  const staleSources = query.data?.health.unavailableReason ? null : healthRows.filter((row) => row.statusKind === "warning").length;
  const lastUpdate = latestDate([
    ...healthRows.map((row) => row.lastSync),
    ...errorRows.map((row) => row.lastError),
    ...mappingRows.map((row) => row.updatedAt),
    ...alertRows.map((row) => row.createdAt),
  ]);
  const needsReview = [failedImports, failedRows, mappingIssues, alertCount, staleSources].some((value) => (value ?? 0) > 0);
  const overall = hasUnavailable ? "partial" : needsReview ? "review" : "healthy";
  const loading = query.isLoading || query.isFetching;
  const signedOut = !session;

  const actions = buildActions({ ui, failedImports, failedRows, mappingIssues, alertCount, hasUnavailable });

  return (
    <DashboardLayout title={t("importsTitle")} subtitle={t("importsSubtitle")}>
      <div className="space-y-4">
        {signedOut ? <Message>{ui.signIn}</Message> : null}
        {query.isLoading ? <Message>{ui.loading}</Message> : null}

        <Toolbar
          label={hasUnavailable ? ui.someUnavailable : ui.dataAvailable}
          unavailable={hasUnavailable}
          refreshLabel={query.isFetching ? ui.refreshing : ui.refresh}
          onRefresh={() => void query.refetch()}
          isRefreshing={query.isFetching}
        />

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-6">
          <MetricCard
            title={ui.kpis.health}
            value={overall === "partial" ? ui.kpis.partial : overall === "review" ? ui.kpis.needsReview : ui.kpis.healthy}
            helper={overall === "partial" ? ui.kpis.healthPartial : overall === "review" ? ui.kpis.healthReview : ui.kpis.healthOk}
            tone={overall === "partial" ? "error" : overall === "review" ? "warning" : "success"}
          />
          <MetricCard title={ui.kpis.lastUpdate} value={lastUpdate ? formatDateTime(lastUpdate, lang) : ui.noUpdates} helper={ui.kpis.lastUpdateHelper} href={ROUTES.adsConnectors} />
          <MetricCard title={ui.kpis.importErrors} value={formatNullableCount(failedImports, ui)} helper={ui.kpis.importErrorsHelper} unavailable={query.data?.errors.unavailableReason} href="#import-errors" />
          <MetricCard title={ui.kpis.problemRows} value={formatNullableCount(failedRows, ui)} helper={query.data?.health.unavailableReason ? ui.sourceUnavailable : ui.kpis.problemRowsHelper} unavailable={query.data?.health.unavailableReason} href="#source-activity" />
          <MetricCard title={ui.kpis.mapping} value={formatNullableCount(mappingIssues, ui)} helper={ui.kpis.mappingHelper} unavailable={mappingIssues === null} href={ROUTES.bindings} />
          <MetricCard title={ui.kpis.alerts} value={formatNullableCount(alertCount, ui)} helper={alertLabel === "open" ? ui.kpis.openAlertsHelper : ui.kpis.recentAlertsHelper} unavailable={query.data?.alerts.unavailableReason} href={ROUTES.alerts} />
        </div>

        <div className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-4">
            <div id="source-activity"><SectionCard title={ui.activity.title} description={ui.activity.desc} noPadding>
              <AvailabilityBoundary unavailableReason={query.data?.health.unavailableReason} errorText={ui.activity.error} empty={!healthRows.length} emptyText={ui.activity.empty}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{ui.activity.source}</TableHead>
                        <TableHead>{ui.activity.type}</TableHead>
                        <TableHead>{ui.activity.status}</TableHead>
                        <TableHead>{ui.activity.lastSync}</TableHead>
                        <TableHead className="text-right">{ui.activity.received}</TableHead>
                        <TableHead className="text-right">{ui.activity.inserted}</TableHead>
                        <TableHead className="text-right">{ui.activity.failed}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {healthRows.slice(0, 100).map((row, index) => (
                        <TableRow key={`${row.source}-${row.lastSync ?? index}`}>
                          <TableCell className="font-medium">{row.source}</TableCell>
                          <TableCell>{row.type}</TableCell>
                          <TableCell><HumanStatusBadge status={row.statusKind} label={statusLabel(row.status, row.statusKind, ui)} /></TableCell>
                          <TableCell>{formatNullableDate(row.lastSync, lang)}</TableCell>
                          <TableCell className="text-right num">{formatNullableNumber(row.rowsReceived)}</TableCell>
                          <TableCell className="text-right num">{formatNullableNumber(row.rowsInserted)}</TableCell>
                          <TableCell className={cn("text-right num", (row.rowsFailed ?? 0) > 0 && "font-semibold text-destructive")}>{formatNullableNumber(row.rowsFailed)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AvailabilityBoundary>
            </SectionCard></div>

            <div id="import-errors"><SectionCard title={ui.errors.title} description={ui.errors.desc} noPadding>
              <AvailabilityBoundary unavailableReason={query.data?.errors.unavailableReason} errorText={ui.errors.error} empty={!errorRows.length} emptyText={ui.errors.empty}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>{ui.errors.source}</TableHead><TableHead>{ui.errors.type}</TableHead><TableHead className="text-right">{ui.errors.count}</TableHead><TableHead>{ui.errors.lastError}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {errorRows.slice(0, 100).map((row, index) => (
                        <TableRow key={`${row.source}-${row.type}-${index}`}>
                          <TableCell className="font-medium">{row.source}</TableCell>
                          <TableCell>{row.type}</TableCell>
                          <TableCell className="text-right num font-semibold text-destructive">{fmtNum(row.count)}</TableCell>
                          <TableCell>{formatNullableDate(row.lastError, lang)}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AvailabilityBoundary>
            </SectionCard></div>

            <SectionCard title={ui.mapping.title} description={ui.mapping.desc} actions={<Button asChild size="sm" variant="outline" className="h-8 text-xs"><Link to={ROUTES.bindings}>{ui.mapping.goBindings}<ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link></Button>} noPadding>
              <AvailabilityBoundary unavailableReason={query.data?.mappings.unavailableReason && query.data?.mappingReview.unavailableReason ? query.data.mappings.unavailableReason : null} errorText={ui.mapping.error} empty={!mappingRows.length} emptyText={ui.mapping.empty}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>{ui.mapping.source}</TableHead><TableHead>{ui.mapping.status}</TableHead><TableHead>{ui.mapping.updatedAt}</TableHead><TableHead>{ui.actions}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {mappingRows.slice(0, 100).map((row, index) => (
                        <TableRow key={`${row.source}-${row.updatedAt ?? index}`} className={row.needsReview ? "bg-warning-soft/30" : undefined}>
                          <TableCell className="font-medium">{row.source}</TableCell>
                          <TableCell><HumanStatusBadge status={row.statusKind} label={statusLabel(row.status, row.statusKind, ui)} /></TableCell>
                          <TableCell>{formatNullableDate(row.updatedAt, lang)}</TableCell>
                          <TableCell><Link className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" to={ROUTES.bindings}>{row.needsReview ? ui.mapping.goBindings : ui.open}<ArrowUpRight className="h-3 w-3" /></Link></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AvailabilityBoundary>
            </SectionCard>

            <SectionCard title={ui.alerts.title} description={ui.alerts.desc} actions={<Button asChild size="sm" variant="outline" className="h-8 text-xs"><Link to={ROUTES.alerts}>{ui.alerts.goAlerts}<ArrowUpRight className="ml-1 h-3.5 w-3.5" /></Link></Button>} noPadding>
              <AvailabilityBoundary unavailableReason={query.data?.alerts.unavailableReason} errorText={ui.alerts.error} empty={!alertRows.length} emptyText={ui.alerts.empty}>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader><TableRow><TableHead>{ui.alerts.severity}</TableHead><TableHead>{ui.alerts.titleCol}</TableHead><TableHead>{ui.alerts.status}</TableHead><TableHead>{ui.alerts.createdAt}</TableHead><TableHead>{ui.actions}</TableHead></TableRow></TableHeader>
                    <TableBody>
                      {alertRows.slice(0, 100).map((row, index) => (
                        <TableRow key={`${row.title}-${row.createdAt ?? index}`}>
                          <TableCell><HumanStatusBadge status={severityKind(row.severity)} label={humanize(row.severity)} /></TableCell>
                          <TableCell className="font-medium">{row.title}</TableCell>
                          <TableCell><HumanStatusBadge status={row.statusKind} label={statusLabel(row.status, row.statusKind, ui)} /></TableCell>
                          <TableCell>{formatNullableDate(row.createdAt, lang)}</TableCell>
                          <TableCell><Link className="inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline" to={ROUTES.alerts}>{ui.alerts.goAlerts}<ArrowUpRight className="h-3 w-3" /></Link></TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </AvailabilityBoundary>
            </SectionCard>
          </div>

          <SectionCard title={ui.actionPanel.title} description={ui.actionPanel.desc} className="xl:sticky xl:top-4 xl:self-start">
            <div className="space-y-3">
              {actions.map((action) => (
                action.href ? (
                  <Link key={action.key} to={action.href} className={cn("flex items-start gap-3 rounded-lg border p-3 transition-colors hover:bg-muted/50", action.tone === "warning" && "border-warning/30 bg-warning-soft/20", action.tone === "error" && "border-destructive/25 bg-destructive-soft/20")}>
                    <ActionIcon tone={action.tone} />
                    <span className="min-w-0 flex-1 text-sm font-medium">{action.label}</span>
                    <ArrowUpRight className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground" />
                  </Link>
                ) : (
                  <div key={action.key} className="flex items-start gap-3 rounded-lg border border-success/25 bg-success-soft/20 p-3">
                    <ActionIcon tone={action.tone} />
                    <span className="text-sm font-medium">{action.label}</span>
                  </div>
                )
              ))}
              <Link to={ROUTES.adsConnectors} className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-primary hover:underline">{ui.actionPanel.sources}<ArrowUpRight className="h-3 w-3" /></Link>
            </div>
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}

async function readImportsDashboard(): Promise<ImportsData> {
  const [health, errors, mappings, mappingReview, alerts] = await Promise.all([
    supabase.from("v_import_health").select("source_name,source_type,status,last_sync_at,updated_at,created_at,rows_received,rows_inserted,rows_failed").eq("workspace_id", WORKSPACE_ID).order("last_sync_at", { ascending: false }).limit(200),
    supabase.from("v_import_error_summary").select("source_name,error_type,error_count,last_error_at,created_at").eq("workspace_id", WORKSPACE_ID).order("last_error_at", { ascending: false }).limit(200),
    supabase.from("v_file_import_mappings").select("source_name,mapping_status,updated_at,created_at").eq("workspace_id", WORKSPACE_ID).order("updated_at", { ascending: false }).limit(200),
    supabase.from("v_mapping_review_queue").select("source_name,mapping_status,created_at,updated_at").eq("workspace_id", WORKSPACE_ID).order("created_at", { ascending: false }).limit(200),
    supabase.from("v_alert_events_recent").select("severity,title,status,created_at,resolved_at").eq("workspace_id", WORKSPACE_ID).order("created_at", { ascending: false }).limit(200),
  ]);

  return {
    health: toSlice<ImportHealthRow>(health.data, health.error?.message ?? null),
    errors: toSlice<ImportErrorRow>(errors.data, errors.error?.message ?? null),
    mappings: toSlice<MappingRow>(mappings.data, mappings.error?.message ?? null),
    mappingReview: toSlice<MappingReviewRow>(mappingReview.data, mappingReview.error?.message ?? null),
    alerts: toSlice<AlertRow>(alerts.data, alerts.error?.message ?? null),
  };
}

function toSlice<T>(data: unknown[] | null, unavailableReason: string | null): QuerySlice<T> {
  return { rows: unavailableReason ? [] : ((data ?? []) as T[]), unavailableReason };
}

function normalizeImportHealthRows(rows: ImportHealthRow[]): NormalizedImportHealth[] {
  return rows.map((row) => {
    const failed = toNullableNumber(row.rows_failed);
    const status = readString(row.status) || (failed && failed > 0 ? "failed" : "unknown");
    return {
      source: readString(row.source_name) || "—",
      type: readString(row.source_type) || "—",
      status,
      statusKind: statusKind(status, failed && failed > 0 ? "error" : "unknown"),
      lastSync: readString(row.last_sync_at) || readString(row.updated_at) || readString(row.created_at) || null,
      rowsReceived: toNullableNumber(row.rows_received),
      rowsInserted: toNullableNumber(row.rows_inserted),
      rowsFailed: failed,
    };
  });
}

function normalizeImportErrors(rows: ImportErrorRow[]): NormalizedImportError[] {
  return rows.map((row) => ({
    source: readString(row.source_name) || "—",
    type: humanize(readString(row.error_type) || "—"),
    count: toNumber(row.error_count),
    lastError: readString(row.last_error_at) || readString(row.created_at) || null,
  }));
}

function normalizeMappings(rows: MappingRow[], reviewRows: MappingReviewRow[]): NormalizedMapping[] {
  const regular = rows.map((row) => {
    const status = readString(row.mapping_status) || "unknown";
    const needsReview = isMappingIssueStatus(status);
    return {
      source: readString(row.source_name) || "—",
      status,
      statusKind: needsReview ? statusKind(status, "warning") : statusKind(status, "success"),
      updatedAt: readString(row.updated_at) || readString(row.created_at) || null,
      needsReview,
    };
  });
  const review = reviewRows.map((row) => {
    const status = readString(row.mapping_status) || "pending_review";
    return {
      source: readString(row.source_name) || "—",
      status,
      statusKind: statusKind(status, "warning"),
      updatedAt: readString(row.updated_at) || readString(row.created_at) || null,
      needsReview: true,
    };
  });
  return [...review, ...regular];
}

function normalizeAlerts(rows: AlertRow[]): NormalizedAlert[] {
  return rows.map((row) => {
    const status = readString(row.status) || (row.resolved_at ? "resolved" : "recent");
    return {
      severity: readString(row.severity) || "info",
      title: readString(row.title) || "—",
      status,
      statusKind: statusKind(status, "unknown"),
      createdAt: readString(row.created_at) || null,
      isOpen: isOpenAlertStatus(status, row.resolved_at),
    };
  });
}

function statusKind(value: string, fallback: SourceStatus): SourceStatus {
  const normalized = value.toLowerCase();
  if (["success", "healthy", "complete", "completed", "confirmed", "ok", "active", "resolved"].some((token) => normalized.includes(token))) return "success";
  if (["pending", "review", "partial", "stale", "warning", "queued"].some((token) => normalized.includes(token))) return "warning";
  if (["fail", "error", "reject", "invalid", "critical", "blocked"].some((token) => normalized.includes(token))) return "error";
  return fallback;
}

function isMappingIssueStatus(value: string) {
  const normalized = value.toLowerCase();
  if (["confirmed", "healthy", "complete", "completed", "ok"].some((token) => normalized.includes(token))) return false;
  return ["pending", "review", "fail", "error", "reject", "invalid", "missing", "unknown", "unmapped"].some((token) => normalized.includes(token));
}

function isOpenAlertStatus(status: string, resolvedAt: Primitive | undefined): boolean | null {
  const normalized = status.toLowerCase();
  if (["open", "active", "unresolved", "pending", "new"].some((token) => normalized.includes(token))) return true;
  if (["resolved", "closed", "dismissed"].some((token) => normalized.includes(token)) || Boolean(resolvedAt)) return false;
  return null;
}

function countAlerts(rows: NormalizedAlert[]) {
  const withOpenSemantics = rows.filter((row) => row.isOpen !== null);
  if (withOpenSemantics.length > 0) return { count: withOpenSemantics.filter((row) => row.isOpen).length, label: "open" as const };
  return { count: rows.length, label: "recent" as const };
}

function buildActions({ ui, failedImports, failedRows, mappingIssues, alertCount, hasUnavailable }: { ui: Copy; failedImports: number | null; failedRows: number | null; mappingIssues: number | null; alertCount: number | null; hasUnavailable: boolean }) {
  const actions: { key: string; label: string; href?: string; tone: "success" | "warning" | "error" }[] = [];
  if (hasUnavailable) actions.push({ key: "unavailable", label: ui.actionPanel.unavailable, tone: "error" });
  if ((failedImports ?? 0) > 0) actions.push({ key: "errors", label: ui.actionPanel.importErrors, href: "#import-errors", tone: "error" });
  if ((failedRows ?? 0) > 0) actions.push({ key: "rows", label: ui.actionPanel.rowsFailed, href: "#source-activity", tone: "error" });
  if ((mappingIssues ?? 0) > 0) actions.push({ key: "mapping", label: ui.actionPanel.mapping, href: ROUTES.bindings, tone: "warning" });
  if ((alertCount ?? 0) > 0) actions.push({ key: "alerts", label: ui.actionPanel.alerts, href: ROUTES.alerts, tone: "warning" });
  if (actions.length === 0) actions.push({ key: "clear", label: ui.actionPanel.noIssues, tone: "success" });
  return actions;
}

function Toolbar({ label, unavailable, refreshLabel, onRefresh, isRefreshing }: { label: string; unavailable: boolean; refreshLabel: string; onRefresh: () => void; isRefreshing: boolean }) {
  return (
    <div className="rounded-xl border border-border/70 bg-card p-3 shadow-card-md">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <StatusBadge status={unavailable ? "warning" : "healthy"} label={label} />
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs" onClick={onRefresh} disabled={isRefreshing}>
          <RefreshCw className={cn("h-3.5 w-3.5", isRefreshing && "animate-spin")} />
          {refreshLabel}
        </Button>
      </div>
    </div>
  );
}

function MetricCard({ title, value, helper, unavailable, tone = "neutral", href }: { title: string; value: string; helper: string; unavailable?: string | null; tone?: "success" | "warning" | "error" | "neutral"; href?: string }) {
  const content = (
    <div className={cn("group rounded-xl border border-border/70 bg-card p-4 shadow-card transition-all", href && "hover:border-primary/40 hover:shadow-card-md", tone === "success" && "ring-accent-top", tone === "warning" && "border-warning/30", tone === "error" && "border-destructive/25")}>
      <div className="flex items-start justify-between gap-2">
        <p className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">{title}</p>
        {href ? <ArrowUpRight className="h-3.5 w-3.5 text-muted-foreground transition-colors group-hover:text-primary" /> : null}
      </div>
      <p className={cn("mt-2 text-2xl font-semibold leading-tight tracking-tight", unavailable && "text-base text-muted-foreground")}>{unavailable ? value : value}</p>
      <p className="mt-2 text-xs leading-snug text-muted-foreground">{unavailable ? helper : helper}</p>
    </div>
  );
  if (!href) return content;
  return href.startsWith("#") ? <a href={href}>{content}</a> : <Link to={href}>{content}</Link>;
}

function AvailabilityBoundary({ unavailableReason, errorText, empty, emptyText, children }: { unavailableReason?: string | null; errorText: string; empty: boolean; emptyText: string; children: React.ReactNode }) {
  if (unavailableReason) return <Message tone="error">{errorText}</Message>;
  if (empty) return <Message>{emptyText}</Message>;
  return <>{children}</>;
}

function Message({ children, tone = "neutral" }: { children: React.ReactNode; tone?: "neutral" | "error" }) {
  return <p className={cn("m-4 rounded-lg border p-3 text-sm", tone === "error" ? "border-destructive/25 bg-destructive-soft/20 text-destructive" : "text-muted-foreground")}>{children}</p>;
}

function HumanStatusBadge({ status, label }: { status: SourceStatus; label: string }) {
  if (status === "success") return <StatusBadge status="healthy" label={label} />;
  if (status === "warning") return <StatusBadge status="warning" label={label} />;
  if (status === "error") return <StatusBadge status="failed" label={label} />;
  return <StatusBadge status="info" label={label} />;
}

function ActionIcon({ tone }: { tone: "success" | "warning" | "error" }) {
  if (tone === "success") return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-success" />;
  if (tone === "error") return <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />;
  return <Database className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />;
}

function statusLabel(value: string, kind: SourceStatus, ui: Copy) {
  const normalized = value.toLowerCase();
  if (normalized.includes("confirm") || normalized.includes("complete")) return ui.statuses.confirmed;
  if (normalized.includes("pending") || normalized.includes("review")) return ui.statuses.pending;
  if (normalized.includes("active")) return ui.statuses.active;
  if (normalized.includes("resolved")) return ui.statuses.resolved;
  if (kind === "success") return ui.statuses.success;
  if (kind === "warning") return ui.statuses.warning;
  if (kind === "error") return ui.statuses.error;
  return value === "recent" ? ui.statuses.unknown : humanize(value);
}

function severityKind(value: string): SourceStatus {
  const normalized = value.toLowerCase();
  if (["critical", "error", "high"].some((token) => normalized.includes(token))) return "error";
  if (["warning", "medium"].some((token) => normalized.includes(token))) return "warning";
  if (["success", "healthy", "low"].some((token) => normalized.includes(token))) return "success";
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
  return new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", { dateStyle: "medium", timeStyle: "short" }).format(date);
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
  return value.replace(/[_-]+/g, " ").replace(/\s+/g, " ").trim().replace(/^./, (char) => char.toUpperCase());
}
