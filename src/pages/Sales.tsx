import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtNum } from "@/lib/format";
import { filterPlaceholderRows } from "@/lib/demoFilters";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useDateFilter } from "@/filters/DateContext";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, string | number | boolean | null>;
type SalesTotals = {
  sales_count: number;
  first_payment_usd: number;
  first_payment_uah: number;
  second_payment_usd: number;
  second_payment_uah: number;
  total_payment_usd: number;
  total_payment_uah: number;
};
type Delta = { text: string; tone: "positive" | "negative" | "neutral" };

type KpiRow = {
  label: string;
  value: string;
  compact?: boolean;
  description?: string;
  delta?: Delta;
};

export default function Sales() {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const date = useDateFilter();
  const { compareMode, compareDisplay } = usePreferences();
  const fromIso = format(date.resolved.from, "yyyy-MM-dd");
  const toIso = format(date.resolved.to, "yyyy-MM-dd");

  const comparisonRange = useMemo(() => {
    if (compareMode === "none") return null;
    if (compareMode === "yesterday" && date.mode !== "exact") return null;
    const days = differenceInCalendarDays(date.resolved.to, date.resolved.from) + 1;
    const comparisonToDate = addDays(date.resolved.from, -1);
    const comparisonFromDate = addDays(comparisonToDate, -(days - 1));
    return {
      from: format(comparisonFromDate, "yyyy-MM-dd"),
      to: format(comparisonToDate, "yyyy-MM-dd"),
    };
  }, [compareMode, date.mode, date.resolved.from, date.resolved.to]);

  const query = useQuery({
    queryKey: ["sales-page", WORKSPACE_ID, fromIso, toIso, date.mode, date.preset],
    enabled: Boolean(session),
    queryFn: async () => {
      const [summary, daily, onboarding, buyers] = await Promise.all([
        readSalesSummary(fromIso, toIso),
        readSalesDaily(fromIso, toIso),
        readOnboarding(),
        readSalesBuyers(fromIso, toIso),
      ]);
      return { summary, daily, onboarding, buyers };
    },
  });

  const comparisonQuery = useQuery({
    queryKey: ["sales-page-comparison", WORKSPACE_ID, compareMode, comparisonRange?.from, comparisonRange?.to],
    enabled: Boolean(session) && compareMode !== "none" && Boolean(comparisonRange),
    queryFn: async () => readSalesSummary(comparisonRange!.from, comparisonRange!.to),
  });

  const summaryRows = query.data?.summary.rows ?? [];
  const dailyRows = query.data?.daily.rows ?? [];
  const buyerRows = query.data?.buyers.rows ?? [];
  const comparisonRows = comparisonQuery.data?.rows ?? [];
  const hasSalesDataError = Boolean(query.data?.summary.unavailableReason || query.data?.daily.unavailableReason || query.isError);
  const hasBuyerError = Boolean(query.data?.buyers.unavailableReason);
  const showSummaryEmpty = Boolean(session) && !query.isLoading && !hasSalesDataError && summaryRows.length === 0;
  const filteredOnboardingRows = useMemo(() => filterPlaceholderRows(query.data?.onboarding.rows as Record<string, unknown>[] | undefined) as Row[], [query.data?.onboarding.rows]);
  const contextRows = useMemo(() => filteredOnboardingRows.filter((row) => hasMeaningfulContext(row.client_name, row.project_name, row.funnel_name)), [filteredOnboardingRows]);

  const handleRefresh = () => {
    void query.refetch();
    if (compareMode !== "none" && comparisonRange) void comparisonQuery.refetch();
  };
  const isRefreshing = query.isFetching || comparisonQuery.isFetching;

  const totals = useMemo(() => aggregateSalesTotals(summaryRows), [summaryRows]);
  const comparisonTotals = useMemo(() => aggregateSalesTotals(comparisonRows), [comparisonRows]);
  const showDeltas = compareMode !== "none" && Boolean(comparisonRange) && !comparisonQuery.isLoading;
  const currencyNote = buildCurrencyNote(lang);

  return <DashboardLayout title={t("salesTitle")} subtitle={t("salesSubtitle")}><div className="space-y-4 overflow-x-hidden"><FilterBar showProject={false} showGroup={false} freshness={{ source: lang === "uk" ? "ІМПОРТ ПРОДАЖІВ" : "SALES IMPORT", status: "fresh", lastSync: "live" }} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
    {!session ? <Msg t={lang === "uk" ? "Увійдіть, щоб переглянути дані продажів." : "Sign in to view sales data."} /> : query.isLoading ? <Msg t={t("salesLoading")} /> : null}
    {!query.isLoading && hasSalesDataError ? <Msg t={t("salesLoadError")} /> : null}

    <SectionCard title={lang === "uk" ? "Підсумок продажів" : "Sales summary"} description={lang === "uk" ? "Ключові фінансові показники за вибраний період" : "Key financial metrics for the selected period"}>
      {hasSalesDataError ? <Msg t={t("salesLoadError")} /> : showSummaryEmpty ? <Msg t={t("salesEmpty")} /> : <>
        <Kpi rows={[
          { label: lang === "uk" ? "Продажі" : "Sales", value: fmtNum(totals.sales_count), compact: false, description: lang === "uk" ? "Кількість продажів у вибраному періоді." : "Number of sales in the selected period.", delta: buildDelta(totals.sales_count, comparisonTotals.sales_count, fmtNum, compareDisplay, showDeltas) },
          { label: lang === "uk" ? "Перший платіж USD" : "First payment USD", value: fmtUsd(totals.first_payment_usd), compact: true, description: lang === "uk" ? "Перший платіж у продажі, якщо продукт має кілька оплат." : "First payment in a sale when the product has multiple payments.", delta: buildDelta(totals.first_payment_usd, comparisonTotals.first_payment_usd, fmtUsd, compareDisplay, showDeltas) },
          { label: lang === "uk" ? "Перший платіж UAH" : "First payment UAH", value: fmtUahExact(totals.first_payment_uah), compact: true, description: lang === "uk" ? "Перший платіж у гривні з даних продажів." : "First payment in UAH from sales data.", delta: buildDelta(totals.first_payment_uah, comparisonTotals.first_payment_uah, fmtUahExact, compareDisplay, showDeltas) },
          { label: lang === "uk" ? "Додаткові платежі USD" : "Additional payments USD", value: fmtUsd(totals.second_payment_usd), compact: true, description: lang === "uk" ? "Другий платіж, доплата або платіж за розтермінуванням." : "Second payment, additional payment, or installment payment.", delta: buildDelta(totals.second_payment_usd, comparisonTotals.second_payment_usd, fmtUsd, compareDisplay, showDeltas) },
          { label: lang === "uk" ? "Додаткові платежі UAH" : "Additional payments UAH", value: fmtUahExact(totals.second_payment_uah), compact: true, description: lang === "uk" ? "Додаткові платежі у гривні з даних продажів." : "Additional payments in UAH from sales data.", delta: buildDelta(totals.second_payment_uah, comparisonTotals.second_payment_uah, fmtUahExact, compareDisplay, showDeltas) },
          { label: lang === "uk" ? "Сплачено всього USD" : "Total paid USD", value: fmtUsd(totals.total_payment_usd), compact: true, description: lang === "uk" ? "Усі зафіксовані платежі в USD за період." : "All recorded USD payments for the period.", delta: buildDelta(totals.total_payment_usd, comparisonTotals.total_payment_usd, fmtUsd, compareDisplay, showDeltas) },
          { label: lang === "uk" ? "Сплачено всього UAH" : "Total paid UAH", value: fmtUahExact(totals.total_payment_uah), compact: true, description: lang === "uk" ? "Усі зафіксовані платежі в UAH за період." : "All recorded UAH payments for the period.", delta: buildDelta(totals.total_payment_uah, comparisonTotals.total_payment_uah, fmtUahExact, compareDisplay, showDeltas) },
        ]} />
        <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{currencyNote}</p>
      </>}
    </SectionCard>

    <SectionCard title={lang === "uk" ? "Покупці" : "Buyer contacts"} description={lang === "uk" ? "Контакти людей із платіжними записами за вибраний період" : "Contacts with payment records for the selected period"} noPadding>
      {hasBuyerError ? <Msg t={lang === "uk" ? "Не вдалося завантажити контакти покупців." : "Could not load buyer contacts."} /> : <BuyerRows rows={buyerRows} empty={lang === "uk" ? "Покупців за вибраний період не знайдено." : "No buyer contacts found for the selected period."} locale={lang} />}
    </SectionCard>

    <SectionCard title={lang === "uk" ? "Продажі за кампаніями" : "Sales by campaign"} description={lang === "uk" ? "Зведення по кампаніях" : "Compact campaign summary"} noPadding>
      <CampaignRows rows={summaryRows} empty={t("salesEmpty")} locale={lang} />
    </SectionCard>

    <SectionCard title={lang === "uk" ? "Продажі по днях" : "Sales by day"} description={lang === "uk" ? "Щоденні продажі" : "Daily sales trend"} noPadding>
      <DailyRows rows={dailyRows} empty={t("salesEmpty")} locale={lang} />
    </SectionCard>

    {contextRows.length > 0 ? <details className="rounded border" open={false}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{lang === "uk" ? "Додатково: контекст клієнта / проєкту / воронки" : "Additional: client / project / funnel context"}</summary>
      <SectionCard title={lang === "uk" ? "Контекст клієнта / проєкту / воронки" : "Client / project / funnel context"} description={lang === "uk" ? "Довідковий контекст для аналізу продажів" : "Reference context for sales analytics"} noPadding>
        <FriendlyRows rows={contextRows} columns={[
          { key: "client_name", label: lang === "uk" ? "Клієнт" : "Client" },
          { key: "project_name", label: lang === "uk" ? "Проєкт" : "Project" },
          { key: "funnel_name", label: lang === "uk" ? "Воронка" : "Funnel" },
          { key: "status", label: lang === "uk" ? "Статус" : "Status" },
        ]} />
      </SectionCard>
    </details> : null}
  </div></DashboardLayout>;
}

function BuyerRows({ rows, empty, locale }: { rows: Row[]; empty: string; locale: "uk" | "en" }) {
  const [search, setSearch] = useState("");
  // Hide obvious demo/test buyer rows from production-facing Sales UI.
  const visibleRows = useMemo(() => rows.filter((row) => !isDemoBuyerRow(row)), [rows]);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    const baseRows = [...visibleRows].sort((a, b) => String(a.metric_date ?? "").localeCompare(String(b.metric_date ?? "")));
    if (!term) return baseRows;
    return baseRows.filter((row) => [row.metric_date, row.customer_name, row.phone_key, row.email, row.payment_category, row.payment_type_norm, row.sale_status_norm].some((value) => String(value ?? "").toLowerCase().includes(term)));
  }, [search, visibleRows]);
  if (!visibleRows.length) return <Msg t={empty} />;
  return <>
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={locale === "uk" ? "Пошук у таблиці покупців" : "Search buyers table"} className="h-8 w-full max-w-xs" />
      <Button variant="outline" size="sm" onClick={() => exportRowsCsv(filteredRows, locale === "uk" ? "pokupci" : "buyers")}>CSV</Button>
      <Button variant="outline" size="sm" onClick={() => exportRowsXlsx(filteredRows, locale === "uk" ? "pokupci" : "buyers")}>XLSX</Button>
    </div>
    <div className="overflow-x-hidden"><Table className="w-full table-fixed"><TableHeader><TableRow>{[
    locale === "uk" ? "Дата" : "Date",
    locale === "uk" ? "Імʼя" : "Name",
    locale === "uk" ? "Телефон" : "Phone",
    "Email",
    locale === "uk" ? "Тип оплати" : "Payment type",
    "USD",
    "UAH",
    locale === "uk" ? "Залишок" : "Remaining",
    locale === "uk" ? "Статус" : "Status",
  ].map((c) => <TableHead key={c} className="px-2 text-[10px] uppercase tracking-wide">{c === (locale === "uk" ? "Залишок" : "Remaining") ? <span title={locale === "uk" ? "Неоплачена частина тарифу / покупки в USD" : "Unpaid part of the tariff / purchase in USD"}>{c}</span> : c}</TableHead>)}</TableRow></TableHeader><TableBody>
    {filteredRows.map((r, i) => {
      const email = display(r.email);
      const paidUsd = getPaidUsd(r);
      const paidUah = getPaidUah(r);
      const hasPaidAmount = paidUsd != null || paidUah != null;
      return <TableRow key={`${String(r.phone_key ?? "")}-${String(r.metric_date ?? "")}-${i}`}>
        <TableCell className="w-[8%] whitespace-nowrap px-2 text-xs">{formatDay(r.metric_date)}</TableCell>
        <TableCell className="w-[14%] truncate px-2 text-sm" title={display(r.customer_name)}>{display(r.customer_name)}</TableCell>
        <TableCell className="w-[13%] truncate px-2 text-sm" title={display(r.phone_key)}>{display(r.phone_key)}</TableCell>
        <TableCell className="w-[18%] truncate px-2 text-sm" title={email}>{email}</TableCell>
        <TableCell className="w-[13%] truncate px-2 text-sm" title={formatPaymentType(r, locale)}>
          <span>{formatPaymentType(r, locale)}</span>
          {!hasPaidAmount ? <span className="ml-1 rounded bg-amber-100 px-1 text-[10px] text-amber-700" title={locale === "uk" ? "У джерелі немає суми оплати для цього запису" : "The source data has no payment amount for this record"}>{locale === "uk" ? "без суми" : "no amount"}</span> : null}
        </TableCell>
        <TableCell className="w-[8%] whitespace-nowrap px-2 text-right text-sm num">{fmtOptionalUsd(paidUsd)}</TableCell>
        <TableCell className="w-[8%] whitespace-nowrap px-2 text-right text-sm num">{fmtOptionalUahExact(paidUah)}</TableCell>
        <TableCell className="w-[8%] whitespace-nowrap px-2 text-right text-sm num">{fmtOptionalUsd(toOptionalNumber(r.debt_amount))}</TableCell>
        <TableCell className="w-[10%] whitespace-nowrap px-2 text-sm">{formatSaleStatus(r.sale_status_norm, locale)}</TableCell>
      </TableRow>;
    })}
  </TableBody></Table></div></>;
}

function CampaignRows({ rows, empty, locale }: { rows: Row[]; empty: string; locale: "uk" | "en" }) {
  const [search, setSearch] = useState("");
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return rows.slice(0, 200);
    return rows.filter((row) => [row.campaign_name, row.first_date, row.last_date].some((value) => String(value ?? "").toLowerCase().includes(term))).slice(0, 200);
  }, [rows, search]);
  if (!rows.length) return <Msg t={empty} />;
  return <>
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={locale === "uk" ? "Пошук у таблиці кампаній" : "Search campaign table"} className="h-8 w-full max-w-xs" />
      <Button variant="outline" size="sm" onClick={() => exportRowsCsv(filteredRows, locale === "uk" ? "kampanii" : "campaign-sales")}>CSV</Button>
      <Button variant="outline" size="sm" onClick={() => exportRowsXlsx(filteredRows, locale === "uk" ? "kampanii" : "campaign-sales")}>XLSX</Button>
    </div>
    <div className="overflow-x-auto"><Table className="min-w-[860px]"><TableHeader><TableRow>{[
    locale === "uk" ? "Кампанія" : "Campaign",
    locale === "uk" ? "Період" : "Period",
    locale === "uk" ? "Продажі" : "Sales",
    locale === "uk" ? "Перші USD" : "First USD",
    locale === "uk" ? "Додаткові USD" : "Additional USD",
    locale === "uk" ? "Загалом USD" : "Total USD",
    locale === "uk" ? "Загалом UAH" : "Total UAH",
  ].map((c) => <TableHead key={c} className="text-xs uppercase tracking-wide whitespace-nowrap">{c}</TableHead>)}</TableRow></TableHeader><TableBody>
    {filteredRows.map((r, i) => <TableRow key={i}>
      <TableCell className="max-w-[220px] truncate text-sm" title={String(r.campaign_name ?? "—")}>{String(r.campaign_name ?? "—")}</TableCell>
      <TableCell className="whitespace-nowrap text-sm">{formatPeriod(r.first_date, r.last_date)}</TableCell>
      <TableCell className="text-right num text-sm">{fmtNum(Number(r.sales_count ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUsd(Number(r.first_payment_usd ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUsd(Number(r.second_payment_usd ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUsd(Number(r.total_payment_usd ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUahExact(Number(r.total_payment_uah ?? 0))}</TableCell>
    </TableRow>)}
  </TableBody></Table></div></>;
}

function DailyRows({ rows, empty, locale }: { rows: Row[]; empty: string; locale: "uk" | "en" }) {
  const [search, setSearch] = useState("");
  const [dayFilter, setDayFilter] = useState("all");
  const dayOptions = useMemo(() => Array.from(new Set(rows.map((row) => String(row.sale_date ?? "")).filter(Boolean))).sort(), [rows]);
  const filteredRows = useMemo(() => {
    const term = search.trim().toLowerCase();
    return rows.filter((row) => {
      const dayOk = dayFilter === "all" || String(row.sale_date ?? "") === dayFilter;
      if (!dayOk) return false;
      if (!term) return true;
      return [row.sale_date, row.campaign_name].some((value) => String(value ?? "").toLowerCase().includes(term));
    }).slice(0, 200);
  }, [dayFilter, rows, search]);
  if (!rows.length) return <Msg t={empty} />;
  return <>
    <div className="flex flex-wrap items-center gap-2 border-b px-3 py-2">
      <Input value={search} onChange={(e) => setSearch(e.target.value)} placeholder={locale === "uk" ? "Пошук у таблиці днів" : "Search daily table"} className="h-8 w-full max-w-xs" />
      <Select value={dayFilter} onValueChange={setDayFilter}>
        <SelectTrigger className="h-8 w-[180px]"><SelectValue placeholder={locale === "uk" ? "Оберіть день" : "Select day"} /></SelectTrigger>
        <SelectContent>
          <SelectItem value="all">{locale === "uk" ? "Усі дні" : "All days"}</SelectItem>
          {dayOptions.map((day) => <SelectItem key={day} value={day}>{formatDay(day)}</SelectItem>)}
        </SelectContent>
      </Select>
      <Button variant="outline" size="sm" onClick={() => exportRowsCsv(filteredRows, locale === "uk" ? "prodazhi-po-dniakh" : "sales-by-day")}>CSV</Button>
      <Button variant="outline" size="sm" onClick={() => exportRowsXlsx(filteredRows, locale === "uk" ? "prodazhi-po-dniakh" : "sales-by-day")}>XLSX</Button>
    </div>
    <div className="overflow-x-auto"><Table className="min-w-[720px]"><TableHeader><TableRow>{[
    locale === "uk" ? "Дата" : "Date",
    locale === "uk" ? "Кампанія" : "Campaign",
    locale === "uk" ? "Продажі" : "Sales",
    locale === "uk" ? "Загалом USD" : "Total USD",
    locale === "uk" ? "Загалом UAH" : "Total UAH",
  ].map((c) => <TableHead key={c} className="text-xs uppercase tracking-wide whitespace-nowrap">{c}</TableHead>)}</TableRow></TableHeader><TableBody>
    {filteredRows.map((r, i) => <TableRow key={i}>
      <TableCell className="whitespace-nowrap text-sm">{formatDay(r.sale_date)}</TableCell>
      <TableCell className="max-w-[220px] truncate text-sm" title={String(r.campaign_name ?? "—")}>{String(r.campaign_name ?? "—")}</TableCell>
      <TableCell className="text-right num text-sm">{fmtNum(Number(r.sales_count ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUsd(Number(r.total_payment_usd ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUahExact(Number(r.total_payment_uah ?? 0))}</TableCell>
    </TableRow>)}
  </TableBody></Table></div></>;
}

function Kpi({ rows }: { rows: KpiRow[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{rows.map((r) => <div key={r.label} className="rounded border bg-card px-3 py-2" title={r.description}><p className="truncate text-xs text-muted-foreground">{r.label}</p><p className={`num mt-1 whitespace-nowrap ${r.compact ? "text-base" : "text-lg"} font-semibold`}>{r.value}</p>{r.description ? <p className="mt-1 line-clamp-2 text-[11px] text-muted-foreground">{r.description}</p> : null}{r.delta ? <p className={`mt-1 whitespace-nowrap text-[11px] ${r.delta.tone === "positive" ? "text-emerald-600" : r.delta.tone === "negative" ? "text-red-600" : "text-muted-foreground"}`}>{r.delta.text}</p> : null}</div>)}</div>;
}

const Msg = ({ t }: { t: string }) => <p className="rounded border p-3 text-sm text-muted-foreground">{t}</p>;

async function readOnboarding() { const res = await supabase.from("v_onboarding_hierarchy").select("*").eq("workspace_id", WORKSPACE_ID).limit(500); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }

async function readSalesSummary(fromIso: string, toIso: string) {
  const res = await supabase
    .from("v_unified_sales_performance_summary")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .lte("first_date", toIso)
    .gte("last_date", fromIso)
    .limit(500);
  return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null };
}

async function readSalesDaily(fromIso: string, toIso: string) {
  const res = await supabase
    .from("v_unified_sales_performance_daily")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .gte("sale_date", fromIso)
    .lte("sale_date", toIso)
    .limit(500);
  return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null };
}

async function readSalesBuyers(fromIso: string, toIso: string) {
  const res = await supabase
    .from("v_unified_conversions_payment_records")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .gte("metric_date", fromIso)
    .lte("metric_date", toIso)
    .order("metric_date", { ascending: true })
    .limit(500);
  return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null };
}

function FriendlyRows({ rows, columns }: { rows: Row[]; columns: { key: string; label: string }[] }) {
  return <div className="overflow-x-auto"><Table className="min-w-[560px]"><TableHeader><TableRow>{columns.map((c) => <TableHead className="text-xs uppercase tracking-wide whitespace-nowrap" key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((r, i) => <TableRow key={i}>{columns.map((c) => <TableCell className="text-sm" key={c.key}>{String(r[c.key] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table></div>;
}

function aggregateSalesTotals(rows: Row[]): SalesTotals {
  return rows.reduce((acc, row) => ({
    sales_count: acc.sales_count + Number(row.sales_count ?? 0),
    first_payment_usd: acc.first_payment_usd + Number(row.first_payment_usd ?? 0),
    first_payment_uah: acc.first_payment_uah + Number(row.first_payment_uah ?? 0),
    second_payment_usd: acc.second_payment_usd + Number(row.second_payment_usd ?? 0),
    second_payment_uah: acc.second_payment_uah + Number(row.second_payment_uah ?? 0),
    total_payment_usd: acc.total_payment_usd + Number(row.total_payment_usd ?? 0),
    total_payment_uah: acc.total_payment_uah + Number(row.total_payment_uah ?? 0),
  }), emptySalesTotals());
}

function emptySalesTotals(): SalesTotals {
  return { sales_count: 0, first_payment_usd: 0, first_payment_uah: 0, second_payment_usd: 0, second_payment_uah: 0, total_payment_usd: 0, total_payment_uah: 0 };
}

function fmtUsd(value: number) { return `$${fmtNum(value)}`; }
function fmtUahExact(value: number) { return `₴${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`; }
function fmtOptionalUsd(value: number | null) { return value == null ? "—" : fmtUsd(value); }
function fmtOptionalUahExact(value: number | null) { return value == null ? "—" : fmtUahExact(value); }

function buildCurrencyNote(locale: "uk" | "en") {
  return locale === "uk"
    ? "Курс USD/UAH не рахується у браузері. Сторінка показує USD і UAH окремо так, як вони приходять із backend-даних."
    : "USD/UAH exchange is not calculated in the browser. This page displays USD and UAH separately exactly as provided by backend data.";
}

function buildDelta(current: number | null, comparison: number | null, formatter: (value: number) => string, compareDisplay: "percent" | "absolute", showDelta: boolean): Delta | undefined {
  if (!showDelta) return undefined;
  if (current == null || comparison == null) return { text: "—", tone: "neutral" };
  const absolute = current - comparison;
  const tone = absolute > 0 ? "positive" : absolute < 0 ? "negative" : "neutral";
  if (compareDisplay === "percent") {
    if (comparison === 0) return { text: "—", tone: "neutral" };
    const percent = (absolute / comparison) * 100;
    const sign = percent > 0 ? "+" : "";
    return { text: `${sign}${percent.toFixed(1)}%`, tone };
  }
  return { text: formatSigned(absolute, formatter), tone };
}

function formatSigned(value: number, formatter: (value: number) => string) {
  const base = formatter(Math.abs(value));
  if (value > 0) return `+${base}`;
  if (value < 0) return `-${base}`;
  return base;
}

function getPaidUsd(row: Row) {
  return coalescePaymentAmount(row.total_payment_usd, sumPaymentAmounts(row.first_payment_usd, row.second_payment_usd), row.payment_usd, row.paid_usd, row.amount_usd);
}

function getPaidUah(row: Row) {
  return coalescePaymentAmount(row.total_payment_uah, sumPaymentAmounts(row.first_payment_uah, row.second_payment_uah), row.payment_uah, row.paid_uah, row.amount_uah);
}

function coalescePaymentAmount(...values: (Row[string] | number | null)[]) {
  for (const value of values) {
    const number = typeof value === "number" ? value : toOptionalNumber(value);
    if (number != null && number !== 0) return number;
  }
  return null;
}

function sumPaymentAmounts(...values: Row[string][]) {
  const numbers = values.map(toOptionalNumber).filter((value): value is number => value != null && value !== 0);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0);
}

function toOptionalNumber(value: Row[string] | number | null) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (value == null || value === "") return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}

function display(value: Row[string]) {
  if (value == null) return "—";
  const text = String(value).trim();
  return text || "—";
}

function formatPaymentType(row: Row, locale: "uk" | "en") {
  const labels: Record<string, { uk: string; en: string }> = {
    full_payment: { uk: "Повна оплата", en: "Full payment" },
    full: { uk: "Повна оплата", en: "Full payment" },
    "повна": { uk: "Повна оплата", en: "Full payment" },
    installment: { uk: "Розтермінування", en: "Installment" },
    "розтермінування": { uk: "Розтермінування", en: "Installment" },
    deposit: { uk: "Бронь / депозит", en: "Deposit" },
    "бронь": { uk: "Бронь / депозит", en: "Deposit" },
    additional_payment: { uk: "Доплата", en: "Additional payment" },
    "доплата": { uk: "Доплата", en: "Additional payment" },
    unknown: { uk: "Невідомо", en: "Unknown" },
  };

  const category = display(row.payment_category).toLowerCase();
  if (category !== "—" && labels[category]) return labels[category][locale];

  const typeNorm = display(row.payment_type_norm).toLowerCase();
  if (typeNorm !== "—" && labels[typeNorm]) return labels[typeNorm][locale];

  return display(row.payment_category) !== "—" ? display(row.payment_category) : display(row.payment_type_norm);
}

function formatSaleStatus(value: Row[string], locale: "uk" | "en") {
  const normalized = display(value).toLowerCase();
  if (normalized === "refund") return locale === "uk" ? "Повернення" : "Refund";
  if (normalized === "needs_review") return locale === "uk" ? "На перевірці" : "Needs review";
  if (normalized === "active") return locale === "uk" ? "Активний" : "Active";
  return display(value);
}

function isDemoBuyerRow(row: Row) {
  const email = display(row.email).toLowerCase();
  const customerName = display(row.customer_name).toLowerCase();
  return email.includes("example.com") || email.includes("refund.dev") || email.includes("alex.dev") || email.includes("ira.dev") || customerName.includes("тест") || customerName.includes("test");
}

function formatDay(v: Row[string]) {
  const d = toDate(v);
  if (!d) return "—";
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
}

function formatPeriod(first: Row[string], last: Row[string]) {
  const start = toDate(first);
  const end = toDate(last);
  if (!start || !end) return "—";
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const s = sameYear ? `${pad(start.getUTCDate())}.${pad(start.getUTCMonth() + 1)}` : `${pad(start.getUTCDate())}.${pad(start.getUTCMonth() + 1)}.${start.getUTCFullYear()}`;
  const e = `${pad(end.getUTCDate())}.${pad(end.getUTCMonth() + 1)}.${end.getUTCFullYear()}`;
  return `${s} — ${e}`;
}

function pad(v: number) { return String(v).padStart(2, "0"); }
function toDate(v: Row[string]) { if (typeof v !== "string") return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }

function hasMeaningfulContext(client: Row[string], project: Row[string], funnel: Row[string]) {
  return [client, project, funnel].some((value) => {
    if (value == null) return false;
    const normalized = String(value).trim();
    return normalized !== "" && normalized !== "—";
  });
}

function exportRowsCsv(rows: Row[], fileName: string) {
  const ws = XLSX.utils.json_to_sheet(rows);
  const csv = XLSX.utils.sheet_to_csv(ws);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  downloadBlob(blob, `${fileName}.csv`);
}

function exportRowsXlsx(rows: Row[], fileName: string) {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.json_to_sheet(rows);
  XLSX.utils.book_append_sheet(wb, ws, "Sheet1");
  const xlsxBuffer = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  const blob = new Blob([xlsxBuffer], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" });
  downloadBlob(blob, `${fileName}.xlsx`);
}

function downloadBlob(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  anchor.click();
  URL.revokeObjectURL(url);
}
