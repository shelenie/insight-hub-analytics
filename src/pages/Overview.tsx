import { useMemo, type ReactNode } from "react";
import { format } from "date-fns";
import { Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { Link } from "react-router-dom";
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

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
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
  return <p className={unavailable ? "mt-1 text-sm font-medium text-muted-foreground" : "num mt-1 text-2xl font-semibold tracking-tight"}>{value}</p>;
}

function ChartEmpty({ text }: { text: string }) {
  return <div className="flex min-h-[180px] items-center rounded-md border border-dashed p-3 text-sm text-muted-foreground">{text}</div>;
}

function ChartCard({ title, description, badge, children }: { title: string; description: string; badge?: string | null; children: ReactNode }) {
  return <div className="rounded-xl border bg-background/40 p-4">
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <div><h3 className="text-sm font-semibold">{title}</h3><p className="text-xs text-muted-foreground">{description}</p></div>
      {badge ? <span className="rounded-full border px-2 py-1 text-xs text-muted-foreground">{badge}</span> : null}
    </div>
    {children}
  </div>;
}

const OPEN_STATUSES = ["open","active","pending","unresolved"];
const CLOSED_STATUSES = ["resolved","closed","archived"];
const countOpenAlerts = async () => {
  const res = await supabase.from("v_operational_alerts_recent").select("*").eq("workspace_id", WORKSPACE_ID);
  const rows = filterRows((res.data ?? []) as Row[]);
  if (rows.length === 0) return { count: 0, error: res.error?.message ?? null, label: "Відкриті сповіщення" };
  const hasStatus = rows.some((r) => r.status !== undefined);
  if (hasStatus) {
    const count = rows.filter((r) => { const st=String(r.status ?? "").toLowerCase(); return OPEN_STATUSES.includes(st) && !CLOSED_STATUSES.includes(st); }).length;
    return { count, error: res.error?.message ?? null, label: "Відкриті сповіщення" };
  }
  const hasResolved = rows.some((r) => r.resolved_at !== undefined);
  if (hasResolved) return { count: rows.filter((r)=>!r.resolved_at).length, error: res.error?.message ?? null, label: "Відкриті сповіщення" };
  return { count: rows.length, error: res.error?.message ?? null, label: "Останні сповіщення" };
};

export default function Overview() {
  const { session } = useAuth();
  const { lang } = useI18n();
  const date = useDateFilter();
  const fromIso = format(date.resolved.from, "yyyy-MM-dd");
  const toIso = format(date.resolved.to, "yyyy-MM-dd");
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

  const businessData = businessDashboard.data;
  const salesUnavailable = businessData?.salesUnavailableReason ?? null;
  const adsUnavailable = businessData?.adsUnavailableReason ?? null;
  const salesRows = businessData?.salesRows ?? [];
  const adsRows = businessData?.adsRows ?? [];
  const revenueUsd = sumField(salesRows, "total_payment_usd");
  const salesCount = sumField(salesRows, "sales_count");
  const adSpend = sumField(adsRows, "spend");
  const costPerSale = salesCount > 0 && adsRows.length > 0 && !adsUnavailable ? adSpend / salesCount : null;
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
    { key: "mapping", label: lang === "uk" ? "Мапінг" : "Mapping", value: counts.data?.mapping.count ?? null, unavailable: Boolean(counts.data?.mapping.error) || !counts.data },
    { key: "alerts", label: lang === "uk" ? "Сповіщення" : "Alerts", value: counts.data?.alerts.count ?? null, unavailable: Boolean(counts.data?.alerts.error) || !counts.data },
    { key: "imports", label: lang === "uk" ? "Імпорт" : "Imports", value: activity.data ? (activity.data.hasImportErrors ? 1 : 0) : null, unavailable: Boolean(activity.data?.errors.importErrors) || !activity.data },
  ];
  const attentionMax = Math.max(...attentionItems.map((item) => item.value ?? 0), 1);
  const relationshipSummary = salesUnavailable || adsUnavailable
    ? lang === "uk" ? "Одне з бізнес-джерел тимчасово недоступне, тому частина висновків не показана як нуль." : "One business source is temporarily unavailable, so missing insights are not shown as zero."
    : salesRows.length > 0 && adsRows.length > 0
      ? lang === "uk" ? "За вибраний період є дохід і рекламні витрати. Перевірте співвідношення доходу до витрат." : "Revenue and ad spend are available for the selected period. Check the revenue-to-spend relationship."
      : salesRows.length > 0
        ? lang === "uk" ? "Продажі доступні, але рекламні витрати за період не знайдені." : "Sales are available, but ad spend was not found for the selected period."
        : adsRows.length > 0
          ? lang === "uk" ? "Рекламні витрати є, але продажів за період не знайдено." : "Ad spend is available, but no sales were found for the selected period."
          : lang === "uk" ? "За вибраний період бізнес-дані для графіків поки не знайдені." : "No business data was found for the selected period yet.";
  const businessSummary = [
    lang === "uk" ? `Період: ${date.contextLabel(lang)}.` : `Period: ${date.contextLabel(lang)}.`,
    relationshipSummary,
    openIssues && openIssues > 0
      ? lang === "uk" ? "Є сигнали, які потребують перевірки." : "There are signals that need review."
      : openIssues === null
        ? lang === "uk" ? "Стан сигналів уваги поки завантажується або недоступний." : "Attention signals are still loading or unavailable."
        : lang === "uk" ? "Критичних відкритих сигналів у налаштуванні не видно." : "No critical open setup signals are visible.",
  ];

  const r = readiness.data ?? {};
  const cards = [
    ["Стан системи", r.technical_status === "PASS" ? "Система працює" : "Триває перевірка"],
    ["Підключення даних", Number(r.failed_checks ?? 1) === 0 ? "Критичних помилок немає" : "Є пункти, що потребують уваги"],
    ["Клієнти / проєкти / воронки", String(r.onboarding_status ?? "") === "ready" ? "Дані доступні" : "Налаштування триває"],
    ["Рекламні дані", ["ads_setup_required"].includes(String(r.production_backend_status ?? r.snapshot_status)) ? "Потрібно підключити рекламні акаунти" : "Рекламні дані доступні"],
    ["AI-асистент", String(r.ai_helper_status ?? "ready") === "ready" ? "AI-асистент доступний" : "Перевіряємо доступність"],
    ["Сповіщення", String(r.operational_alerts_status ?? "ready") === "ready" ? "Сповіщення працюють" : "Потрібна увага"],
  ];

  const steps = useMemo(() => {
    const arr: { text: string; href: string; label: string }[] = [];
    if (["ads_setup_required"].includes(String(r.production_backend_status ?? r.snapshot_status))) arr.push({ text: "Підключіть рекламні акаунти, щоб побачити витрати та ефективність реклами.", href: "/ads-connectors", label: "Перейти до Ads конекторів" });
    if ((counts.data?.clients.count ?? 0) === 0 || (counts.data?.projects.count ?? 0) === 0 || (counts.data?.funnels.count ?? 0) === 0) arr.push({ text: "Додайте клієнта, проєкт і воронку.", href: "/onboarding", label: "Перейти до онбордингу" });
    if ((counts.data?.mapping.count ?? 0) > 0) arr.push({ text: "Перевірте мапінг джерел даних.", href: "/bindings", label: "Перейти до звʼязків даних" });
    if ((counts.data?.alerts.count ?? 0) > 0) arr.push({ text: "Перевірте відкриті сповіщення.", href: "/alerts", label: "Перейти до сповіщень" });
    if (!arr.length) arr.push({ text: "Основні налаштування виглядають готовими.", href: "/", label: "Готово" });
    return arr;
  }, [r.production_backend_status, r.snapshot_status, counts.data]);

  return <DashboardLayout title="Огляд" subtitle="Головний дашборд робочого простору">
    <div className="space-y-4">
      {!session ? <SectionCard title="Огляд"><p className="text-sm text-muted-foreground">Увійдіть, щоб побачити огляд робочого простору.</p></SectionCard> : null}
      {readiness.error ? <FriendlyError message="Потрібне оновлення backend для цього розділу." technical={readiness.error.message} /> : null}
      {session ? <FilterBar showProject={false} showGroup={false} freshness={{ source: lang === "uk" ? "Бізнес-дані" : "Business data", status: businessDashboard.isError || salesUnavailable || adsUnavailable ? "failed" : "fresh", lastSync: "live" }} /> : null}

      {session ? <SectionCard title={lang === "uk" ? "Бізнес-дашборд" : "Executive dashboard"} description={lang === "uk" ? "Ключові бізнес-показники за вибраний період" : "Key business metrics for the selected period"}>
        {dashboardLoading ? <p className="rounded-md border p-3 text-sm text-muted-foreground">{lang === "uk" ? "Завантажуємо бізнес-показники…" : "Loading business metrics…"}</p> : null}
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <div className="rounded-xl border bg-background/40 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{lang === "uk" ? "Дохід" : "Revenue"}</p><KpiValue unavailable={Boolean(salesUnavailable)} value={salesUnavailable ? (lang === "uk" ? "Дані недоступні" : "Unavailable") : salesRows.length ? fmtCurrency(revenueUsd) : "—"} /><p className="mt-2 text-xs text-muted-foreground">USD</p></div>
          <div className="rounded-xl border bg-background/40 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{lang === "uk" ? "Продажі" : "Sales"}</p><KpiValue unavailable={Boolean(salesUnavailable)} value={salesUnavailable ? (lang === "uk" ? "Дані недоступні" : "Unavailable") : salesRows.length ? fmtNum(salesCount) : "—"} /><p className="mt-2 text-xs text-muted-foreground">{lang === "uk" ? "записів продажів" : "sales records"}</p></div>
          <div className="rounded-xl border bg-background/40 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{lang === "uk" ? "Витрати на рекламу" : "Ad Spend"}</p><KpiValue unavailable={Boolean(adsUnavailable)} value={adsUnavailable ? (lang === "uk" ? "Дані недоступні" : "Unavailable") : adsRows.length ? fmtCurrency(adSpend) : "—"} /><p className="mt-2 text-xs text-muted-foreground">USD</p></div>
          <div className="rounded-xl border bg-background/40 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{lang === "uk" ? "Вартість продажу" : "Cost / sale"}</p><KpiValue unavailable={Boolean(adsUnavailable || salesUnavailable)} value={adsUnavailable || salesUnavailable ? (lang === "uk" ? "Дані недоступні" : "Unavailable") : costPerSale === null ? "—" : fmtCurrency(costPerSale, { compact: false })} /><p className="mt-2 text-xs text-muted-foreground">{lang === "uk" ? "витрати / продажі" : "spend / sales"}</p></div>
          <div className="rounded-xl border bg-background/40 p-4"><p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">{lang === "uk" ? "Потребують уваги" : "Open issues"}</p><KpiValue unavailable={issuesUnavailable} value={issuesUnavailable ? (lang === "uk" ? "Дані недоступні" : "Unavailable") : openIssues === null ? "—" : fmtNum(openIssues)} /><p className="mt-2 text-xs text-muted-foreground">{lang === "uk" ? "мапінг, сповіщення, імпорт" : "mapping, alerts, imports"}</p></div>
        </div>

        <div className="mt-4 grid gap-4 lg:grid-cols-2">
          <div className="lg:col-span-2">
            <ChartCard title={lang === "uk" ? "Дохід vs витрати на рекламу" : "Revenue vs ad spend"} description={lang === "uk" ? "Щоденний тренд за вибраний період" : "Daily trend for the selected period"} badge={(salesUnavailable || adsUnavailable) ? (lang === "uk" ? "Частина джерел недоступна" : "Some sources unavailable") : null}>
              {businessDashboard.isLoading ? <ChartEmpty text={lang === "uk" ? "Завантажуємо тренд…" : "Loading trend…"} /> : hasChartData ? <div className="h-[280px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartRows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                    <XAxis dataKey="date" tickFormatter={formatDateLabel} tickLine={false} axisLine={false} className="text-xs" />
                    <YAxis tickFormatter={(value) => formatCurrencyValue(value, true)} tickLine={false} axisLine={false} width={72} className="text-xs" />
                    <Tooltip formatter={(value, name) => [formatCurrencyValue(value), name === "revenueUsd" ? (lang === "uk" ? "Дохід" : "Revenue") : (lang === "uk" ? "Витрати" : "Ad spend")]} labelFormatter={(value) => formatDateLabel(String(value))} />
                    <Legend />
                    {hasRevenueSeries ? <Line connectNulls={false} type="monotone" dataKey="revenueUsd" name={lang === "uk" ? "Дохід" : "Revenue"} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} /> : null}
                    {hasSpendSeries ? <Line connectNulls={false} type="monotone" dataKey="adSpend" name={lang === "uk" ? "Витрати" : "Ad spend"} stroke="hsl(var(--muted-foreground))" strokeWidth={2} dot={false} /> : null}
                  </LineChart>
                </ResponsiveContainer>
              </div> : <ChartEmpty text={salesUnavailable && adsUnavailable ? (lang === "uk" ? "Тренд тимчасово недоступний через помилки джерел даних." : "Trend is temporarily unavailable due to data source errors.") : (lang === "uk" ? "Даних для графіка за вибраний період поки немає." : "No chart data is available for the selected period yet.")} />}
            </ChartCard>
          </div>

          <ChartCard title={lang === "uk" ? "Продажі" : "Sales trend"} description={lang === "uk" ? "Кількість продажів за днями" : "Daily sales count"} badge={salesUnavailable ? (lang === "uk" ? "Джерело недоступне" : "Source unavailable") : null}>
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

          <ChartCard title={lang === "uk" ? "Витрати на рекламу" : "Ad spend trend"} description={lang === "uk" ? "Щоденні витрати на рекламу" : "Daily advertising spend"} badge={adsUnavailable ? (lang === "uk" ? "Джерело недоступне" : "Source unavailable") : null}>
            {businessDashboard.isLoading ? <ChartEmpty text={lang === "uk" ? "Завантажуємо витрати…" : "Loading spend…"} /> : hasSpendSeries ? <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartRows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis tickFormatter={(value) => formatCurrencyValue(value, true)} tickLine={false} axisLine={false} width={64} className="text-xs" />
                  <Tooltip formatter={(value) => [formatCurrencyValue(value), lang === "uk" ? "Витрати" : "Ad spend"]} labelFormatter={(value) => formatDateLabel(String(value))} />
                  <Bar dataKey="adSpend" name={lang === "uk" ? "Витрати" : "Ad spend"} fill="hsl(var(--muted-foreground))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div> : <ChartEmpty text={adsUnavailable ? (lang === "uk" ? "Рекламні витрати тимчасово недоступні." : "Ad spend is temporarily unavailable.") : (lang === "uk" ? "Рекламних витрат за вибраний період поки немає." : "No ad spend was found for the selected period yet.")} />}
          </ChartCard>

          <ChartCard title={lang === "uk" ? "Вартість продажу" : "Cost / sale"} description={lang === "uk" ? "Витрати на рекламу / продажі за день" : "Daily ad spend divided by sales"} badge={!hasCostPerSaleSeries && !businessDashboard.isLoading ? "—" : null}>
            {businessDashboard.isLoading ? <ChartEmpty text={lang === "uk" ? "Завантажуємо ефективність…" : "Loading efficiency…"} /> : hasCostPerSaleSeries ? <div className="h-[220px] w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartRows} margin={{ left: 8, right: 8, top: 8, bottom: 8 }}>
                  <CartesianGrid strokeDasharray="3 3" className="stroke-border/60" />
                  <XAxis dataKey="date" tickFormatter={formatDateLabel} tickLine={false} axisLine={false} className="text-xs" />
                  <YAxis tickFormatter={(value) => formatCurrencyValue(value, true)} tickLine={false} axisLine={false} width={64} className="text-xs" />
                  <Tooltip formatter={(value) => [formatCurrencyValue(value), lang === "uk" ? "Вартість продажу" : "Cost / sale"]} labelFormatter={(value) => formatDateLabel(String(value))} />
                  <Line connectNulls={false} type="monotone" dataKey="costPerSale" name={lang === "uk" ? "Вартість продажу" : "Cost / sale"} stroke="hsl(var(--primary))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div> : <ChartEmpty text={salesUnavailable || adsUnavailable ? (lang === "uk" ? "Ефективність недоступна через помилку джерела." : "Efficiency is unavailable because a source errored.") : (lang === "uk" ? "Недостатньо даних для розрахунку вартості продажу." : "Not enough data to calculate cost per sale.")} />}
          </ChartCard>

          <ChartCard title={lang === "uk" ? "Потребують уваги" : "Needs attention"} description={lang === "uk" ? "Мапінг, сповіщення та імпорти" : "Mapping, alerts, and imports"} badge={openIssues && openIssues > 0 ? (lang === "uk" ? "Перевірити" : "Review") : null}>
            {counts.isLoading || activity.isLoading ? <ChartEmpty text={lang === "uk" ? "Завантажуємо сигнали…" : "Loading signals…"} /> : <div className="space-y-3">
              {attentionItems.map((item) => <div key={item.key} className="rounded-md border bg-card/60 p-3">
                <div className="flex items-center justify-between gap-3 text-sm"><span className="font-medium">{item.label}</span><span className="num font-semibold">{item.unavailable ? (lang === "uk" ? "Недоступно" : "Unavailable") : item.value === null ? "—" : fmtNum(item.value)}</span></div>
                {!item.unavailable && item.value !== null ? <div className="mt-2 h-2 overflow-hidden rounded-full bg-muted"><div className="h-full rounded-full bg-primary" style={{ width: `${Math.min(100, (item.value / attentionMax) * 100)}%` }} /></div> : null}
              </div>)}
              <p className="text-xs text-muted-foreground">{openIssues && openIssues > 0 ? (lang === "uk" ? "Є пункти, які потребують перевірки зараз." : "There are items that need review now.") : openIssues === null ? (lang === "uk" ? "Частина сигналів недоступна." : "Some signals are unavailable.") : (lang === "uk" ? "Активних сигналів для перевірки не видно." : "No active review signals are visible.")}</p>
            </div>}
          </ChartCard>
        </div>

        <div className="mt-4 rounded-xl border bg-muted/30 p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{lang === "uk" ? "Короткий підсумок" : "Summary"}</p>
          <ul className="mt-2 space-y-1 text-sm text-muted-foreground">{businessSummary.map((line) => <li key={line}>{line}</li>)}</ul>
        </div>
      </SectionCard> : null}

      {session && !readiness.error && <SectionCard title="Стан робочого простору"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([title, desc]) => <div key={String(title)} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{title}</p><p className="font-medium">{desc}</p></div>)}</div></SectionCard>}

      <SectionCard title="Налаштування робочого простору"><div className="grid grid-cols-2 gap-2 md:grid-cols-4">{[
        ["Клієнти", counts.data?.clients], ["Проєкти", counts.data?.projects], ["Воронки", counts.data?.funnels], ["Джерела даних", counts.data?.sources], ["Рекламні акаунти", counts.data?.ads], ["Мапінг на перевірку", counts.data?.mapping], [String((counts.data?.alerts as {label?:string}|undefined)?.label ?? "Відкриті сповіщення"), counts.data?.alerts],
      ].map(([label, item]) => <div key={String(label)} className="rounded-md border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="text-lg font-semibold">{(item as {error:string|null,count:number}|undefined)?.error ? "Дані поки недоступні" : (item as {count:number}|undefined)?.count ?? "—"}</p></div>)}</div></SectionCard>

      <SectionCard title="Наступні кроки"><div className="space-y-3">{steps.map((s, i) => <div key={i} className="rounded-md border p-3"><p className="text-sm">{s.text}</p><Button asChild variant="outline" size="sm" className="mt-2"><Link to={s.href}>{s.label}</Link></Button></div>)}</div></SectionCard>

      <SectionCard title="Остання активність"><ul className="space-y-2 text-sm"><li>{activity.data?.hasImports ? "Імпорти оновлюються" : "Імпортів поки немає"}</li><li>{activity.data?.hasImportErrors ? "Є помилки імпорту" : "Помилок імпорту немає"}</li><li>{(counts.data?.alerts.count ?? 0) > 0 ? "Є відкриті сповіщення" : "Критичних сповіщень немає"}</li><li>{activity.data?.aiOk === false ? "AI тимчасово недоступний" : "AI працює"}</li></ul></SectionCard>

      <DeveloperDetails><pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify({ readiness: readiness.data, counts: counts.data, activity: activity.data, businessDashboard: businessDashboard.data, errors: activity.data?.errors }, null, 2)}</pre></DeveloperDetails>
    </div>
  </DashboardLayout>;
}
