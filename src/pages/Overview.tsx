import { useMemo, type ReactNode } from "react";
import { addDays, differenceInCalendarDays, format, isSameDay } from "date-fns";
import { uk } from "date-fns/locale";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
import { CheckCircle2 } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { DeveloperDetails, FriendlyError } from "@/components/common/DeveloperDetails";
import { fmtCurrency, fmtNum } from "@/lib/format";
import { useDateFilter } from "@/filters/DateContext";
import { useI18n } from "@/i18n/I18nProvider";
import { usePreferences } from "@/preferences/PreferencesProvider";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const ROUTES = { sales: "/sales", campaigns: "/campaigns", imports: "/imports", bindings: "/bindings", alerts: "/alerts" } as const;
type Row = Record<string, unknown>;

const PLACEHOLDER_PATTERNS = ["test agency","test client","northstar digital clinic","evergreen growth program","main webinar funnel","placeholder","demo","mock","test_upload","backend_test"];
function isPlaceholderRow(row: Row) { const text = Object.values(row).join(" ").toLowerCase(); return PLACEHOLDER_PATTERNS.some((p) => text.includes(p)); }
function filterRows(rows: Row[]) { return rows.filter((r) => !isPlaceholderRow(r)); }

function shouldRetryWithoutWorkspace(errorMessage: string | null) {
  if (!errorMessage) return false;
  const m = errorMessage.toLowerCase();
  return m.includes("workspace_id") && (m.includes("column") || m.includes("schema cache") || m.includes("could not find"));
}

const countView = async (view: string) => {
  const scoped = await supabase.from(view).select("*").eq("workspace_id", WORKSPACE_ID);
  if (!scoped.error) return { count: filterRows((scoped.data ?? []) as Row[]).length, error: null };
  if (shouldRetryWithoutWorkspace(scoped.error.message)) {
    const fallback = await supabase.from(view).select("*");
    return { count: filterRows((fallback.data ?? []) as Row[]).length, error: fallback.error?.message ?? null };
  }
  return { count: 0, error: scoped.error.message };
};



type BusinessDailyRow = {
  date: string;
  revenueUsd: number | null;
  sales: number | null;
  adSpend: number | null;
  costPerSale: number | null;
};
type BusinessDashboardData = {
  salesRows: Row[];
  adsRows: Row[];
  salesUnavailableReason: string | null;
  adsUnavailableReason: string | null;
};

const toNumber = (value: unknown) => {
  if (value === null || value === undefined || value === "") return 0;
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
};

const sumField = (rows: Row[], field: string) => rows.reduce((total, row) => total + toNumber(row[field]), 0);

const formatOverviewDate = (date: Date, lang: "uk" | "en") =>
  lang === "uk" ? format(date, "d MMMM yyyy", { locale: uk }) : format(date, "d MMMM yyyy");

const buildPeriodSummary = (range: { from: Date; to: Date }, lang: "uk" | "en") => {
  const label = isSameDay(range.from, range.to)
    ? formatOverviewDate(range.from, lang)
    : `${formatOverviewDate(range.from, lang)} — ${formatOverviewDate(range.to, lang)}`;
  return lang === "uk" ? `Період: ${label}` : `Period: ${label}`;
};

const formatDateLabel = (value: string) => {
  const [year, month, day] = value.split("-");
  return year && month && day ? `${day}.${month}` : value;
};
const formatCurrencyValue = (value: unknown, compact = false) => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? fmtCurrency(n, { compact }) : "—";
};
const formatNumberValue = (value: unknown) => {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  return Number.isFinite(n) ? fmtNum(n) : "—";
};

type ComparisonMetric = "currency" | "number";
type DeltaPolarity = "higherIsBetter" | "lowerIsBetter" | "neutral";
type KpiDelta = { text: string; direction: "up" | "down" | "flat"; tone: "positive" | "negative" | "neutral" } | { text: string; direction: "muted"; tone: "muted" };

const metricTotals = (salesRows: Row[], adsRows: Row[]) => {
  const revenueUsd = sumField(salesRows, "total_payment_usd");
  const salesCount = sumField(salesRows, "sales_count");
  const adSpend = sumField(adsRows, "spend");
  const costPerSale = salesCount > 0 && adsRows.length > 0 ? adSpend / salesCount : null;
  return { revenueUsd, salesCount, adSpend, costPerSale };
};

const formatDeltaValue = (value: number, metric: ComparisonMetric) =>
  metric === "currency" ? fmtCurrency(Math.abs(value), { compact: true }) : fmtNum(Math.abs(value));

const buildKpiDelta = ({
  current,
  previous,
  metric,
  compareDisplay,
  unavailableText,
  polarity = "higherIsBetter",
}: {
  current: number | null;
  previous: number | null;
  metric: ComparisonMetric;
  compareDisplay: "percent" | "absolute";
  unavailableText: string;
  polarity?: DeltaPolarity;
}): KpiDelta => {
  if (current === null || previous === null || !Number.isFinite(current) || !Number.isFinite(previous)) return { text: "—", direction: "muted", tone: "muted" };
  if (previous <= 0) return { text: "—", direction: "muted", tone: "muted" };
  const diff = current - previous;
  const direction = diff > 0 ? "up" : diff < 0 ? "down" : "flat";
  const tone = polarity === "neutral" || direction === "flat"
    ? "neutral"
    : polarity === "lowerIsBetter"
      ? diff < 0 ? "positive" : "negative"
      : diff > 0 ? "positive" : "negative";
  if (compareDisplay === "percent") {
    const pct = (diff / Math.abs(previous)) * 100;
    if (!Number.isFinite(pct)) return { text: unavailableText, direction: "muted", tone: "muted" };
    return { text: `${diff > 0 ? "+" : ""}${pct.toFixed(1)}%`, direction, tone };
  }
  if (!Number.isFinite(diff)) return { text: unavailableText, direction: "muted", tone: "muted" };
  return { text: `${diff > 0 ? "+" : diff < 0 ? "−" : ""}${formatDeltaValue(diff, metric)}`, direction, tone };
};

const readBusinessDashboard = async (fromIso: string, toIso: string): Promise<BusinessDashboardData> => {
  const [sales, ads] = await Promise.all([
    supabase
      .from("v_unified_sales_performance_daily")
      .select("sale_date,sales_count,total_payment_usd")
      .eq("workspace_id", WORKSPACE_ID)
      .gte("sale_date", fromIso)
      .lte("sale_date", toIso)
      .order("sale_date", { ascending: true })
      .limit(500),
    supabase
      .from("v_unified_ads_performance_daily")
      .select("metric_date,spend")
      .eq("workspace_id", WORKSPACE_ID)
      .gte("metric_date", fromIso)
      .lte("metric_date", toIso)
      .order("metric_date", { ascending: true })
      .limit(500),
  ]);

  return {
    salesRows: (sales.data ?? []) as Row[],
    adsRows: (ads.data ?? []) as Row[],
    salesUnavailableReason: sales.error?.message ?? null,
    adsUnavailableReason: ads.error?.message ?? null,
  };
};

const createDailyRow = (date: string): BusinessDailyRow => ({ date, revenueUsd: null, sales: null, adSpend: null, costPerSale: null });

const buildDailySeries = (salesRows: Row[], adsRows: Row[]) => {
  const byDate = new Map<string, BusinessDailyRow>();
  for (const row of salesRows) {
    const date = String(row.sale_date ?? "");
    if (!date) continue;
    const existing = byDate.get(date) ?? createDailyRow(date);
    existing.revenueUsd = (existing.revenueUsd ?? 0) + toNumber(row.total_payment_usd);
    existing.sales = (existing.sales ?? 0) + toNumber(row.sales_count);
    byDate.set(date, existing);
  }
  for (const row of adsRows) {
    const date = String(row.metric_date ?? "");
    if (!date) continue;
    const existing = byDate.get(date) ?? createDailyRow(date);
    existing.adSpend = (existing.adSpend ?? 0) + toNumber(row.spend);
    byDate.set(date, existing);
  }
  return Array.from(byDate.values())
    .map((row) => ({ ...row, costPerSale: row.adSpend !== null && row.sales !== null && row.sales > 0 ? row.adSpend / row.sales : null }))
    .sort((a, b) => a.date.localeCompare(b.date));
};

function KpiValue({ value, unavailable }: { value: string; unavailable?: boolean }) {
  return <p className={unavailable ? "text-sm font-medium leading-snug text-muted-foreground" : "num text-2xl font-semibold leading-tight tracking-tight"}>{value}</p>;
}

function KpiCard({
  title,
  value,
  subtitle,
  unavailable,
  delta,
  compareLabel,
  deltaTitle,
  showComparison = false,
  href,
  linkLabel,
  linkAriaLabel,
}: {
  title: string;
  value: string;
  subtitle: string;
  unavailable?: boolean;
  delta?: KpiDelta | null;
  compareLabel?: string;
  deltaTitle?: string;
  showComparison?: boolean;
  href?: string;
  linkLabel?: string;
  linkAriaLabel?: string;
}) {
  const deltaClass =
    delta?.tone === "positive"
      ? "text-emerald-600"
      : delta?.tone === "negative"
        ? "text-destructive"
        : "text-muted-foreground";
  return <div className={`flex h-full flex-col rounded-xl border bg-background/40 p-4 ${showComparison ? "min-h-[150px]" : "min-h-[124px]"}`}>
    <p className="flex min-h-8 items-start text-xs font-medium uppercase leading-4 tracking-wide text-muted-foreground">{title}</p>
    <div className="flex min-h-11 items-end pt-2"><KpiValue unavailable={unavailable} value={value} /></div>
    {showComparison ? <div className="flex min-h-9 items-start pt-1">
      {delta ? <p className={`text-xs leading-snug ${deltaClass}`} title={deltaTitle}><span className="font-medium">{delta.text}</span>{compareLabel ? <span className="text-muted-foreground"> {compareLabel}</span> : null}</p> : <span className="text-xs leading-snug opacity-0" aria-hidden="true">—</span>}
    </div> : null}
    <div className={`flex items-end justify-between gap-3 ${showComparison ? "mt-auto pt-2" : "mt-2 pt-1"}`}>
      <p className="text-xs leading-snug text-muted-foreground">{subtitle}</p>
      {href ? <Link to={href} aria-label={linkAriaLabel ?? linkLabel} className="shrink-0 text-xs font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{linkLabel}</Link> : null}
    </div>
  </div>;
}

function ChartEmpty({ text }: { text: string }) {
  return <div className="flex min-h-[180px] items-center rounded-md border border-dashed p-3 text-sm text-muted-foreground">{text}</div>;
}

function ChartCard({ title, description, badge, href, linkLabel, linkAriaLabel, children }: { title: string; description: string; badge?: string | null; href?: string; linkLabel?: string; linkAriaLabel?: string; children: ReactNode }) {
  return <div className="rounded-xl border bg-background/40 p-4">
    <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
      <div><h3 className="text-sm font-semibold">{title}</h3><p className="text-xs text-muted-foreground">{description}</p></div>
      <div className="flex shrink-0 items-center gap-2">
        {badge ? <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{badge}</span> : null}
        {href ? <Link to={href} aria-label={linkAriaLabel ?? linkLabel} className="rounded-full border px-2 py-1 text-xs font-medium text-primary transition-colors hover:bg-primary/5 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{linkLabel}</Link> : null}
      </div>
    </div>
    {children}
  </div>;
}

const OPEN_STATUSES = ["open","active","pending","unresolved"];
const CLOSED_STATUSES = ["resolved","closed","archived"];
const countOpenAlerts = async () => {
  const res = await supabase.from("v_operational_alerts_recent").select("*").eq("workspace_id", WORKSPACE_ID);
  const rows = filterRows((res.data ?? []) as Row[]);
  if (rows.length === 0) return { count: 0, error: res.error?.message ?? null, labelKey: "openAlerts" };
  const hasStatus = rows.some((r) => r.status !== undefined);
  if (hasStatus) {
    const count = rows.filter((r) => { const st=String(r.status ?? "").toLowerCase(); return OPEN_STATUSES.includes(st) && !CLOSED_STATUSES.includes(st); }).length;
    return { count, error: res.error?.message ?? null, labelKey: "openAlerts" };
  }
  const hasResolved = rows.some((r) => r.resolved_at !== undefined);
  if (hasResolved) return { count: rows.filter((r)=>!r.resolved_at).length, error: res.error?.message ?? null, labelKey: "openAlerts" };
  return { count: rows.length, error: res.error?.message ?? null, labelKey: "recentAlerts" };
};

export default function Overview() {
  const { session } = useAuth();
  const { lang } = useI18n();
  const { compareMode, compareDisplay } = usePreferences();
  const date = useDateFilter();
  const fromIso = format(date.resolved.from, "yyyy-MM-dd");
  const toIso = format(date.resolved.to, "yyyy-MM-dd");
  const comparisonRange = useMemo(() => {
    if (compareMode === "none") return null;
    if (compareMode === "yesterday") {
      if (date.mode !== "exact") return null;
      const previousDay = addDays(date.resolved.from, -1);
      return { from: previousDay, to: previousDay };
    }
    const days = differenceInCalendarDays(date.resolved.to, date.resolved.from) + 1;
    if (days <= 0) return null;
    return { from: addDays(date.resolved.from, -days), to: addDays(date.resolved.from, -1) };
  }, [compareMode, date.mode, date.resolved.from, date.resolved.to]);
  const hasActiveComparison = compareMode !== "none" && Boolean(comparisonRange);
  const compareFromIso = comparisonRange ? format(comparisonRange.from, "yyyy-MM-dd") : null;
  const compareToIso = comparisonRange ? format(comparisonRange.to, "yyyy-MM-dd") : null;
  const readiness = useQuery({ queryKey: ["backend-readiness", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const { data, error } = await supabase.from("v_production_backend_snapshot").select("*").eq("workspace_id", WORKSPACE_ID).maybeSingle();
    if (error) throw error;
    return (data as Row | null) ?? null;
  }});
  const counts = useQuery({ queryKey: ["overview-counts", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const [clients, projects, funnels, sources, ads, mapping, alerts] = await Promise.all([
      countView("v_clients"), countView("v_projects"), countView("v_funnels"), countView("v_source_entity_bindings"), countView("v_ad_account_bindings"), countView("v_mapping_review_queue"), countOpenAlerts(),
    ]);
    return { clients, projects, funnels, sources, ads, mapping, alerts };
  }});
  const activity = useQuery({ queryKey: ["overview-activity", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const [importHealth, importErrors, aiHealth] = await Promise.all([
      supabase.from("v_import_health").select("*").eq("workspace_id", WORKSPACE_ID).limit(10),
      supabase.from("v_import_error_summary").select("*").eq("workspace_id", WORKSPACE_ID).limit(10),
      supabase.from("v_ai_helper_health").select("*").eq("workspace_id", WORKSPACE_ID).limit(10),
    ]);
    return {
      hasImports: (importHealth.data ?? []).length > 0,
      hasImportErrors: (importErrors.data ?? []).length > 0,
      aiOk: aiHealth.error ? null : (aiHealth.data ?? []).length > 0,
      errors: { importHealth: importHealth.error?.message, importErrors: importErrors.error?.message, aiHealth: aiHealth.error?.message },
    };
  }});

  const businessDashboard = useQuery({
    queryKey: ["overview-business-dashboard", WORKSPACE_ID, fromIso, toIso],
    enabled: Boolean(session),
    queryFn: () => readBusinessDashboard(fromIso, toIso),
  });

  const comparisonDashboard = useQuery({
    queryKey: ["overview-business-dashboard-compare", WORKSPACE_ID, compareMode, compareFromIso, compareToIso],
    enabled: Boolean(session && hasActiveComparison && compareFromIso && compareToIso),
    queryFn: () => readBusinessDashboard(compareFromIso!, compareToIso!),
  });

  const businessData = businessDashboard.data;
  const salesUnavailable = businessData?.salesUnavailableReason ?? null;
  const adsUnavailable = businessData?.adsUnavailableReason ?? null;
  const salesRows = businessData?.salesRows ?? [];
  const adsRows = businessData?.adsRows ?? [];
  const currentTotals = metricTotals(salesRows, adsRows);
  const { revenueUsd, salesCount, adSpend } = currentTotals;
  const costPerSale = salesCount > 0 && adsRows.length > 0 && !adsUnavailable ? currentTotals.costPerSale : null;
  const comparisonData = comparisonDashboard.data;
  const comparisonSalesUnavailable = comparisonData?.salesUnavailableReason ?? null;
  const comparisonAdsUnavailable = comparisonData?.adsUnavailableReason ?? null;
  const comparisonTotals = comparisonData ? metricTotals(comparisonData.salesRows, comparisonData.adsRows) : null;
  const compareLabel = compareMode === "previous_period"
    ? lang === "uk" ? "до попереднього періоду" : "vs previous period"
    : lang === "uk" ? "до вчора" : "vs yesterday";
  const comparisonUnavailableText = lang === "uk" ? "порівняння недоступне" : "comparison unavailable";
  const shouldShowComparison = hasActiveComparison;
  const revenueDelta = shouldShowComparison
    ? comparisonSalesUnavailable || comparisonDashboard.isError
      ? { text: comparisonUnavailableText, direction: "muted" as const, tone: "muted" as const }
      : buildKpiDelta({ current: salesUnavailable || !salesRows.length ? null : revenueUsd, previous: comparisonTotals && comparisonData.salesRows.length ? comparisonTotals.revenueUsd : null, metric: "currency", compareDisplay, unavailableText: comparisonUnavailableText, polarity: "higherIsBetter" })
    : null;
  const salesDelta = shouldShowComparison
    ? comparisonSalesUnavailable || comparisonDashboard.isError
      ? { text: comparisonUnavailableText, direction: "muted" as const, tone: "muted" as const }
      : buildKpiDelta({ current: salesUnavailable || !salesRows.length ? null : salesCount, previous: comparisonTotals && comparisonData.salesRows.length ? comparisonTotals.salesCount : null, metric: "number", compareDisplay, unavailableText: comparisonUnavailableText, polarity: "higherIsBetter" })
    : null;
  const adSpendDelta = shouldShowComparison
    ? comparisonAdsUnavailable || comparisonDashboard.isError
      ? { text: comparisonUnavailableText, direction: "muted" as const, tone: "muted" as const }
      : buildKpiDelta({ current: adsUnavailable || !adsRows.length ? null : adSpend, previous: comparisonTotals && comparisonData.adsRows.length ? comparisonTotals.adSpend : null, metric: "currency", compareDisplay, unavailableText: comparisonUnavailableText, polarity: "neutral" })
    : null;
  const costPerSaleDelta = shouldShowComparison
    ? comparisonSalesUnavailable || comparisonAdsUnavailable || comparisonDashboard.isError
      ? { text: comparisonUnavailableText, direction: "muted" as const, tone: "muted" as const }
      : buildKpiDelta({ current: adsUnavailable || salesUnavailable ? null : costPerSale, previous: comparisonTotals?.costPerSale ?? null, metric: "currency", compareDisplay, unavailableText: comparisonUnavailableText, polarity: "lowerIsBetter" })
    : null;
  const issuesUnavailable = Boolean(counts.data?.mapping.error || counts.data?.alerts.error || activity.data?.errors.importErrors);
  const openIssues = issuesUnavailable || !counts.data || !activity.data ? null : counts.data.mapping.count + counts.data.alerts.count + (activity.data.hasImportErrors ? 1 : 0);
  const chartRows = buildDailySeries(salesRows, adsRows);
  const hasRevenueSeries = !salesUnavailable && salesRows.length > 0;
  const hasSalesSeries = !salesUnavailable && salesRows.length > 0;
  const hasSpendSeries = !adsUnavailable && adsRows.length > 0;
  const costPerSaleRows = chartRows.filter((row) => row.costPerSale !== null);
  const hasCostPerSaleSeries = !salesUnavailable && !adsUnavailable && costPerSaleRows.length > 0;
  const hasChartData = chartRows.length > 0 && (hasRevenueSeries || hasSpendSeries);
  const dashboardLoading = businessDashboard.isLoading || counts.isLoading || activity.isLoading;
  const attentionItems = [
    { key: "mapping", label: lang === "uk" ? "Мапінг" : "Mapping", href: ROUTES.bindings, value: counts.data?.mapping.count ?? null, unavailable: Boolean(counts.data?.mapping.error) || !counts.data },
    { key: "alerts", label: lang === "uk" ? "Сповіщення" : "Alerts", href: ROUTES.alerts, value: counts.data?.alerts.count ?? null, unavailable: Boolean(counts.data?.alerts.error) || !counts.data },
    { key: "imports", label: lang === "uk" ? "Імпорт" : "Imports", href: ROUTES.imports, value: activity.data ? (activity.data.hasImportErrors ? 1 : 0) : null, unavailable: Boolean(activity.data?.errors.importErrors) || !activity.data },
  ];
  const attentionHasUnavailable = attentionItems.some((item) => item.unavailable);
  const attentionHasActiveValue = attentionItems.some((item) => (item.value ?? 0) > 0);
  const showAttentionDetails = attentionHasUnavailable || attentionHasActiveValue;
  const attentionAllClear = !attentionHasUnavailable && attentionItems.every((item) => item.value === 0);
  const attentionMax = Math.max(...attentionItems.map((item) => item.value ?? 0), 1);
  const relationshipSummary = salesUnavailable || adsUnavailable
    ? lang === "uk" ? "Частина джерел тимчасово недоступна, тому відсутні значення не показані як нулі." : "Some sources are temporarily unavailable, so missing values are not shown as zero."
    : salesRows.length > 0 && adsRows.length > 0 && salesCount > 0
      ? lang === "uk" ? "Є дохід і рекламні витрати. Перевірте, чи рекламна вартість продажу відповідає очікуванням." : "Revenue and ad spend are available. Check whether ad cost per sale is within expectations."
      : salesRows.length > 0 && salesCount > 0
        ? lang === "uk" ? "Продажі є, але рекламні витрати за період не знайдені." : "Sales are available, but ad spend was not found for the period."
        : adsRows.length > 0
          ? lang === "uk" ? "Рекламні витрати є, але продажів за період не знайдено." : "Ad spend is available, but no sales were found for the period."
          : lang === "uk" ? "Бізнес-дані за вибраний період поки не знайдені." : "Business data was not found for the selected period yet.";
  const comparisonSummary = shouldShowComparison && revenueDelta?.direction === "down" && adSpendDelta?.direction === "up"
    ? lang === "uk" ? "Дохід знизився, а витрати зросли — варто перевірити кампанії." : "Revenue decreased while spend increased — campaigns may need review."
    : shouldShowComparison && revenueDelta?.direction === "up" && costPerSaleDelta?.direction === "down"
      ? lang === "uk" ? "Дохід зріс, а рекламна вартість продажу знизилась — динаміка виглядає позитивно." : "Revenue increased while ad cost per sale decreased — performance looks positive."
      : null;
  const attentionSummary = openIssues && openIssues > 0
    ? lang === "uk" ? "Є сигнали, які потребують перевірки: мапінг, сповіщення або імпорти." : "There are signals to review: mapping, alerts, or imports."
    : openIssues === null
      ? lang === "uk" ? "Частина операційних сигналів недоступна для перевірки." : "Some operational signals are unavailable."
      : lang === "uk" ? "Критичних відкритих сигналів не видно." : "No critical open signals are visible.";
  const businessSummary = [
    buildPeriodSummary(date.resolved, lang),
    comparisonSummary ?? relationshipSummary,
    attentionSummary,
  ];

  const r = readiness.data ?? {};
  const cards = [
    [lang === "uk" ? "Стан системи" : "System status", r.technical_status === "PASS" ? (lang === "uk" ? "Система працює" : "System is running") : (lang === "uk" ? "Триває перевірка" : "Check in progress")],
    [lang === "uk" ? "Підключення даних" : "Data connection", Number(r.failed_checks ?? 1) === 0 ? (lang === "uk" ? "Критичних помилок немає" : "No critical errors") : (lang === "uk" ? "Є пункти, що потребують уваги" : "Some items need attention")],
    [lang === "uk" ? "Клієнти / проєкти / воронки" : "Clients / projects / funnels", String(r.onboarding_status ?? "") === "ready" ? (lang === "uk" ? "Дані доступні" : "Data is available") : (lang === "uk" ? "Налаштування триває" : "Setup in progress")],
    [lang === "uk" ? "Рекламні дані" : "Ads data", ["ads_setup_required"].includes(String(r.production_backend_status ?? r.snapshot_status)) ? (lang === "uk" ? "Потрібно підключити рекламні акаунти" : "Ad accounts need to be connected") : (lang === "uk" ? "Рекламні дані доступні" : "Ads data is available")],
    [lang === "uk" ? "AI-асистент" : "AI assistant", String(r.ai_helper_status ?? "ready") === "ready" ? (lang === "uk" ? "AI-асистент доступний" : "AI assistant is available") : (lang === "uk" ? "Перевіряємо доступність" : "Checking availability")],
    [lang === "uk" ? "Сповіщення" : "Alerts", String(r.operational_alerts_status ?? "ready") === "ready" ? (lang === "uk" ? "Сповіщення працюють" : "Alerts are working") : (lang === "uk" ? "Потрібна увага" : "Needs attention")],
  ];

  const steps = useMemo(() => {
    const arr: { text: string; href: string; label: string }[] = [];
    if (["ads_setup_required"].includes(String(r.production_backend_status ?? r.snapshot_status))) arr.push({ text: lang === "uk" ? "Підключіть рекламні акаунти, щоб побачити витрати та ефективність реклами." : "Connect ad accounts to see ad spend and efficiency.", href: "/ads-connectors", label: lang === "uk" ? "Перейти до Ads конекторів" : "Go to Ads connectors" });
    if ((counts.data?.clients.count ?? 0) === 0 || (counts.data?.projects.count ?? 0) === 0 || (counts.data?.funnels.count ?? 0) === 0) arr.push({ text: lang === "uk" ? "Додайте клієнта, проєкт і воронку." : "Add a client, project, and funnel.", href: "/onboarding", label: lang === "uk" ? "Перейти до онбордингу" : "Go to onboarding" });
    if ((counts.data?.mapping.count ?? 0) > 0) arr.push({ text: lang === "uk" ? "Перевірте мапінг джерел даних." : "Review data source mapping.", href: "/bindings", label: lang === "uk" ? "Перейти до звʼязків даних" : "Go to data bindings" });
    if ((counts.data?.alerts.count ?? 0) > 0) arr.push({ text: lang === "uk" ? "Перевірте відкриті сповіщення." : "Review open alerts.", href: "/alerts", label: lang === "uk" ? "Перейти до сповіщень" : "Go to alerts" });
    if (!arr.length) arr.push({ text: lang === "uk" ? "Основні налаштування виглядають готовими." : "Core setup looks ready.", href: "/", label: lang === "uk" ? "Готово" : "Done" });
    return arr;
  }, [lang, r.production_backend_status, r.snapshot_status, counts.data]);

  const setupCounts = [
    [lang === "uk" ? "Клієнти" : "Clients", counts.data?.clients],
    [lang === "uk" ? "Проєкти" : "Projects", counts.data?.projects],
    [lang === "uk" ? "Воронки" : "Funnels", counts.data?.funnels],
    [lang === "uk" ? "Джерела даних" : "Data sources", counts.data?.sources],
    [lang === "uk" ? "Рекламні акаунти" : "Ad accounts", counts.data?.ads],
    [lang === "uk" ? "Мапінг на перевірку" : "Mapping to review", counts.data?.mapping],
    [counts.data?.alerts.labelKey === "recentAlerts" ? (lang === "uk" ? "Останні сповіщення" : "Recent alerts") : (lang === "uk" ? "Відкриті сповіщення" : "Open alerts"), counts.data?.alerts],
  ];
  const recentActivity = [
    activity.data?.hasImports ? (lang === "uk" ? "Імпорти оновлюються" : "Imports are updating") : (lang === "uk" ? "Імпортів поки немає" : "No imports yet"),
    activity.data?.hasImportErrors ? (lang === "uk" ? "Є помилки імпорту" : "Import errors detected") : (lang === "uk" ? "Помилок імпорту немає" : "No import errors"),
    (counts.data?.alerts.count ?? 0) > 0 ? (lang === "uk" ? "Є відкриті сповіщення" : "Open alerts exist") : (lang === "uk" ? "Критичних сповіщень немає" : "No critical alerts"),
    activity.data?.aiOk === false ? (lang === "uk" ? "AI тимчасово недоступний" : "AI is temporarily unavailable") : (lang === "uk" ? "AI працює" : "AI is working"),
  ];
  const refreshOverview = () => {
    void readiness.refetch();
    void counts.refetch();
    void activity.refetch();
    void businessDashboard.refetch();
    if (hasActiveComparison) void comparisonDashboard.refetch();
  };
  const isOverviewRefreshing = readiness.isFetching || counts.isFetching || activity.isFetching || businessDashboard.isFetching || (hasActiveComparison && comparisonDashboard.isFetching);

  return <DashboardLayout title={lang === "uk" ? "Огляд" : "Overview"} subtitle={lang === "uk" ? "Головний дашборд робочого простору" : "Workspace executive dashboard"}>
    <div className="space-y-4">
      {!session ? <SectionCard title={lang === "uk" ? "Огляд" : "Overview"}><p className="text-sm text-muted-foreground">{lang === "uk" ? "Увійдіть, щоб побачити огляд робочого простору." : "Sign in to view the workspace overview."}</p></SectionCard> : null}
      {readiness.error ? <FriendlyError message={lang === "uk" ? "Потрібне оновлення backend для цього розділу." : "A backend update is required for this section."} technical={readiness.error.message} /> : null}
      {session ? <FilterBar showProject={false} showGroup={false} onRefresh={refreshOverview} isRefreshing={isOverviewRefreshing} freshness={{ source: lang === "uk" ? "Бізнес-дані" : "Business data", status: businessDashboard.isError || salesUnavailable || adsUnavailable ? "failed" : "fresh", lastSync: "live" }} /> : null}

      {session ? <SectionCard title={lang === "uk" ? "Бізнес-дашборд" : "Executive dashboard"} description={lang === "uk" ? "Ключові бізнес-показники за вибраний період" : "Key business metrics for the selected period"}>
        {dashboardLoading ? <p className="rounded-md border p-3 text-sm text-muted-foreground">{lang === "uk" ? "Завантажуємо бізнес-показники…" : "Loading business metrics…"}</p> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <KpiCard title={lang === "uk" ? "Дохід" : "Revenue"} unavailable={Boolean(salesUnavailable)} value={salesUnavailable ? (lang === "uk" ? "Дані недоступні" : "Unavailable") : salesRows.length ? fmtCurrency(revenueUsd) : "—"} delta={revenueDelta} compareLabel={compareLabel} subtitle="USD" showComparison={shouldShowComparison} href={ROUTES.sales} linkLabel={lang === "uk" ? "Деталі" : "Details"} linkAriaLabel={lang === "uk" ? "Відкрити деталі доходу" : "Open revenue details"} />
          <KpiCard title={lang === "uk" ? "Продажі" : "Sales"} unavailable={Boolean(salesUnavailable)} value={salesUnavailable ? (lang === "uk" ? "Дані недоступні" : "Unavailable") : salesRows.length ? fmtNum(salesCount) : "—"} delta={salesDelta} compareLabel={compareLabel} subtitle={lang === "uk" ? "записів продажів" : "sales records"} showComparison={shouldShowComparison} href={ROUTES.sales} linkLabel={lang === "uk" ? "Деталі" : "Details"} linkAriaLabel={lang === "uk" ? "Відкрити деталі продажів" : "Open sales details"} />
          <KpiCard title={lang === "uk" ? "Витрати на рекламу" : "Ad Spend"} unavailable={Boolean(adsUnavailable)} value={adsUnavailable ? (lang === "uk" ? "Дані недоступні" : "Unavailable") : adsRows.length ? fmtCurrency(adSpend) : "—"} delta={adSpendDelta} compareLabel={compareLabel} deltaTitle={lang === "uk" ? "Нейтральна зміна: вищі витрати оцінюються разом із доходом." : "Neutral change: higher spend is evaluated together with revenue."} subtitle="USD" showComparison={shouldShowComparison} href={ROUTES.campaigns} linkLabel={lang === "uk" ? "Деталі" : "Details"} linkAriaLabel={lang === "uk" ? "Відкрити деталі рекламних кампаній" : "Open campaign details"} />
          <KpiCard title={lang === "uk" ? "Вартість продажу з реклами" : "Ad cost / sale"} unavailable={Boolean(adsUnavailable || salesUnavailable)} value={adsUnavailable || salesUnavailable ? (lang === "uk" ? "Дані недоступні" : "Unavailable") : costPerSale === null ? "—" : fmtCurrency(costPerSale, { compact: false })} delta={costPerSaleDelta} compareLabel={compareLabel} subtitle={lang === "uk" ? "витрати на рекламу / продажі" : "ad spend / sales"} showComparison={shouldShowComparison} href={ROUTES.campaigns} linkLabel={lang === "uk" ? "Деталі" : "Details"} linkAriaLabel={lang === "uk" ? "Відкрити деталі вартості продажу з реклами" : "Open ad cost per sale details"} />
          <KpiCard title={lang === "uk" ? "Потребують уваги" : "Open issues"} unavailable={issuesUnavailable} value={issuesUnavailable ? (lang === "uk" ? "Дані недоступні" : "Unavailable") : openIssues === null ? "—" : fmtNum(openIssues)} subtitle={lang === "uk" ? "мапінг, сповіщення, імпорт" : "mapping, alerts, imports"} showComparison={shouldShowComparison} href={ROUTES.imports} linkLabel={lang === "uk" ? "Деталі" : "Details"} linkAriaLabel={lang === "uk" ? "Відкрити операційні деталі" : "Open operational details"} />
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <ChartCard title={lang === "uk" ? "Дохід vs витрати на рекламу" : "Revenue vs ad spend"} description={lang === "uk" ? "Щоденний тренд за вибраний період" : "Daily trend for the selected period"} badge={(salesUnavailable || adsUnavailable) ? (lang === "uk" ? "Частина джерел недоступна" : "Some sources unavailable") : null} href={ROUTES.campaigns} linkLabel={lang === "uk" ? "Відкрити" : "Open"} linkAriaLabel={lang === "uk" ? "Відкрити кампанії для аналізу доходу та витрат" : "Open campaigns to review revenue and spend"}>
              {businessDashboard.isLoading ? <ChartEmpty text={lang === "uk" ? "Завантажуємо тренд…" : "Loading trend…"} /> : hasChartData ? <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                    <XAxis dataKey="date" tickFormatter={formatDateLabel} tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickFormatter={(value) => formatCurrencyValue(value, true)} tickLine={false} axisLine={false} width={72} className="text-xs" />
                    <Tooltip formatter={(value, name) => [formatCurrencyValue(value), name === "revenueUsd" ? (lang === "uk" ? "Дохід" : "Revenue") : (lang === "uk" ? "Витрати" : "Ad spend")]} labelFormatter={(value) => formatDateLabel(String(value))} />
                    <Legend wrapperStyle={{ fontSize: 12, paddingTop: 4 }} iconType="line" />
                    {hasRevenueSeries ? <Line connectNulls={false} type="monotone" dataKey="revenueUsd" name={lang === "uk" ? "Дохід" : "Revenue"} stroke="hsl(var(--primary))" strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /> : null}
                    {hasSpendSeries ? <Line connectNulls={false} type="monotone" dataKey="adSpend" name={lang === "uk" ? "Витрати" : "Ad spend"} stroke="hsl(var(--foreground))" strokeOpacity={0.7} strokeWidth={2.5} dot={false} activeDot={{ r: 4 }} /> : null}
                  </LineChart>
                </ResponsiveContainer>
              </div> : <ChartEmpty text={salesUnavailable && adsUnavailable ? (lang === "uk" ? "Тренд тимчасово недоступний через помилки джерел даних." : "Trend is temporarily unavailable due to data source errors.") : (lang === "uk" ? "Даних для графіка за вибраний період поки немає." : "No chart data is available for the selected period yet.")} />}
            </ChartCard>
          </div>

          <ChartCard title={lang === "uk" ? "Продажі" : "Sales trend"} description={lang === "uk" ? "Кількість продажів за днями" : "Daily sales count"} badge={salesUnavailable ? (lang === "uk" ? "Джерело недоступне" : "Source unavailable") : null} href={ROUTES.sales} linkLabel={lang === "uk" ? "Відкрити" : "Open"} linkAriaLabel={lang === "uk" ? "Відкрити сторінку продажів" : "Open sales page"}>
            {businessDashboard.isLoading ? <ChartEmpty text={lang === "uk" ? "Завантажуємо продажі…" : "Loading sales…"} /> : hasSalesSeries ? <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis tickFormatter={formatNumberValue} tickLine={false} axisLine={false} width={48} className="text-xs" />
                  <Tooltip formatter={(value) => [formatNumberValue(value), lang === "uk" ? "Продажі" : "Sales"]} labelFormatter={(value) => formatDateLabel(String(value))} />
                  <Bar dataKey="sales" name={lang === "uk" ? "Продажі" : "Sales"} fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div> : <ChartEmpty text={salesUnavailable ? (lang === "uk" ? "Дані продажів тимчасово недоступні." : "Sales data is temporarily unavailable.") : (lang === "uk" ? "Продажів за вибраний період поки немає." : "No sales were found for the selected period yet.")} />}
          </ChartCard>

          <ChartCard title={lang === "uk" ? "Витрати на рекламу" : "Ad spend trend"} description={lang === "uk" ? "Щоденні витрати на рекламу" : "Daily advertising spend"} badge={adsUnavailable ? (lang === "uk" ? "Джерело недоступне" : "Source unavailable") : null} href={ROUTES.campaigns} linkLabel={lang === "uk" ? "Відкрити" : "Open"} linkAriaLabel={lang === "uk" ? "Відкрити сторінку кампаній" : "Open campaigns page"}>
            {businessDashboard.isLoading ? <ChartEmpty text={lang === "uk" ? "Завантажуємо витрати…" : "Loading spend…"} /> : hasSpendSeries ? <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis tickFormatter={(value) => formatCurrencyValue(value, true)} tickLine={false} axisLine={false} width={64} className="text-xs" />
                  <Tooltip formatter={(value) => [formatCurrencyValue(value), lang === "uk" ? "Витрати" : "Ad spend"]} labelFormatter={(value) => formatDateLabel(String(value))} />
                  <Bar dataKey="adSpend" name={lang === "uk" ? "Витрати" : "Ad spend"} fill="hsl(var(--foreground))" fillOpacity={0.7} radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div> : <ChartEmpty text={adsUnavailable ? (lang === "uk" ? "Рекламні витрати тимчасово недоступні." : "Ad spend is temporarily unavailable.") : (lang === "uk" ? "Рекламних витрат за вибраний період поки немає." : "No ad spend was found for the selected period yet.")} />}
          </ChartCard>

          <ChartCard title={lang === "uk" ? "Вартість продажу з реклами" : "Ad cost / sale"} description={lang === "uk" ? "Витрати на рекламу / продажі за день" : "Daily ad spend divided by sales"} badge={!hasCostPerSaleSeries && !businessDashboard.isLoading ? "—" : null} href={ROUTES.campaigns} linkLabel={lang === "uk" ? "Відкрити" : "Open"} linkAriaLabel={lang === "uk" ? "Відкрити кампанії для аналізу вартості продажу" : "Open campaigns to review ad cost per sale"}>
            {businessDashboard.isLoading ? <ChartEmpty text={lang === "uk" ? "Завантажуємо ефективність…" : "Loading efficiency…"} /> : hasCostPerSaleSeries ? <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis tickFormatter={(value) => formatCurrencyValue(value, true)} tickLine={false} axisLine={false} width={64} className="text-xs" />
                  <Tooltip formatter={(value) => [formatCurrencyValue(value), lang === "uk" ? "Вартість продажу з реклами" : "Ad cost / sale"]} labelFormatter={(value) => formatDateLabel(String(value))} />
                  <Line connectNulls={false} type="monotone" dataKey="costPerSale" name={lang === "uk" ? "Вартість продажу з реклами" : "Ad cost / sale"} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div> : <ChartEmpty text={salesUnavailable || adsUnavailable ? (lang === "uk" ? "Ефективність недоступна через помилку джерела." : "Efficiency is unavailable because a source errored.") : (lang === "uk" ? "Недостатньо даних для розрахунку вартості продажу з реклами." : "Not enough data to calculate ad cost per sale.")} />}
          </ChartCard>

          <ChartCard title={lang === "uk" ? "Потребують уваги" : "Needs attention"} description={lang === "uk" ? "Мапінг, сповіщення та імпорти" : "Mapping, alerts, and imports"} badge={openIssues && openIssues > 0 ? (lang === "uk" ? "Перевірити" : "Review") : null} href={ROUTES.imports} linkLabel={lang === "uk" ? "Відкрити" : "Open"} linkAriaLabel={lang === "uk" ? "Відкрити імпорти та якість даних" : "Open imports and data health"}>
            {counts.isLoading || activity.isLoading ? <ChartEmpty text={lang === "uk" ? "Завантажуємо сигнали…" : "Loading signals…"} /> : attentionAllClear ? <div className="flex min-h-[76px] items-center gap-3 rounded-md border bg-emerald-500/5 px-3 py-3">
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600">
                <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
              </span>
              <div>
                <p className="text-sm font-semibold">{lang === "uk" ? "Активних сигналів немає" : "No active signals"}</p>
                <p className="mt-1 text-xs text-muted-foreground">{lang === "uk" ? "Мапінг, сповіщення та імпорти не потребують дій." : "Mapping, alerts, and imports do not need action."}</p>
              </div>
            </div> : <div className="space-y-3">
              {showAttentionDetails ? attentionItems.map((item) => <div key={item.key} className="rounded-md border bg-card/60 p-3">
                <div className="flex items-center justify-between gap-3 text-sm">
                  <Link to={item.href} className="font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">{item.label}</Link>
                  <span className="num font-semibold">{item.unavailable ? (lang === "uk" ? "Недоступно" : "Unavailable") : item.value === null ? "—" : fmtNum(item.value)}</span>
                </div>
                {!item.unavailable && item.value !== null ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (item.value / attentionMax) * 100)}%` }} /></div> : null}
              </div>) : null}
              <p className="text-xs text-muted-foreground">{openIssues && openIssues > 0 ? (lang === "uk" ? "Є пункти, які потребують перевірки зараз." : "There are items that need review now.") : openIssues === null ? (lang === "uk" ? "Частина сигналів недоступна." : "Some signals are unavailable.") : (lang === "uk" ? "Активних сигналів для перевірки не видно." : "No active review signals are visible.")}</p>
            </div>}
          </ChartCard>
        </div>

        <div className="mt-4 rounded-xl border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lang === "uk" ? "Короткий підсумок" : "Summary"}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{businessSummary.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      </SectionCard> : null}

      {session && !readiness.error ? <SectionCard title={lang === "uk" ? "Операційний стан" : "Operational status"} description={lang === "uk" ? "Компактний стан робочого простору, налаштувань і останніх сигналів" : "Compact workspace readiness, setup, and recent signals"}>
        <div className="grid gap-5 lg:grid-cols-2">
          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold">{lang === "uk" ? "Стан робочого простору" : "Workspace readiness"}</h3>
              <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                {cards.map(([title, desc]) => <div key={String(title)} className="rounded-md border bg-background/50 px-3 py-2"><p className="text-[11px] uppercase tracking-wide text-muted-foreground">{title}</p><p className="mt-1 text-sm font-medium leading-snug">{desc}</p></div>)}
              </div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">{lang === "uk" ? "Налаштування робочого простору" : "Workspace setup"}</h3>
              <div className="mt-2 flex flex-wrap gap-2">
                {setupCounts.map(([label, item]) => <div key={String(label)} className="min-w-[132px] flex-1 rounded-full border bg-background/50 px-3 py-2 sm:flex-none"><p className="text-[11px] leading-none text-muted-foreground">{label}</p><p className="num mt-1 text-sm font-semibold leading-none">{(item as {error:string|null,count:number}|undefined)?.error ? (lang === "uk" ? "Недоступно" : "Unavailable") : (item as {count:number}|undefined)?.count ?? "—"}</p></div>)}
              </div>
            </div>
          </div>

          <div className="space-y-5">
            <div>
              <h3 className="text-sm font-semibold">{lang === "uk" ? "Наступні кроки" : "Next actions"}</h3>
              <div className="mt-2 space-y-2">{steps.map((s, i) => <div key={i} className="rounded-md border bg-background/50 p-3"><p className="text-sm leading-snug">{s.text}</p><Button asChild variant="outline" size="sm" className="mt-2 h-8"><Link to={s.href}>{s.label}</Link></Button></div>)}</div>
            </div>

            <div>
              <h3 className="text-sm font-semibold">{lang === "uk" ? "Остання активність" : "Recent activity"}</h3>
              <ul className="mt-2 space-y-1.5 text-sm text-muted-foreground">{recentActivity.map((line) => <li key={line} className="rounded-md border bg-background/50 px-3 py-2 leading-snug">{line}</li>)}</ul>
            </div>
          </div>
        </div>
      </SectionCard> : null}

      <DeveloperDetails><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify({ readiness: readiness.data, counts: counts.data, activity: activity.data, businessDashboard: businessDashboard.data, errors: activity.data?.errors }, null, 2)}</pre></DeveloperDetails>
    </div>
  </DashboardLayout>;
}
