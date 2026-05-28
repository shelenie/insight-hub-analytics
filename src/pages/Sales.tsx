import { useMemo, useState, type MouseEvent as ReactMouseEvent } from "react";
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
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import * as XLSX from "xlsx";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

type Row = Record<string, string | number | boolean | null>;
type ExportCell = string | number;
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
type KpiRow = { label: string; value: string; compact?: boolean; description?: string; delta?: Delta };
type KpiGroup = { title: string; rows: KpiRow[] };
type BuyerColumnKey = "date" | "name" | "phone" | "email" | "type" | "usd" | "uah" | "remaining" | "status";
type BuyerColumn = { key: BuyerColumnKey; label: string; width: number; minWidth: number; align?: "left" | "right"; tooltip?: string };

const BUYER_COLUMN_DEFAULT_WIDTHS: Record<BuyerColumnKey, number> = {
  date: 96,
  name: 165,
  phone: 165,
  email: 165,
  type: 150,
  usd: 96,
  uah: 96,
  remaining: 96,
  status: 96,
};

const STICKY_TABLE_HEAD_CLASS = "sticky top-0 z-30 border-b bg-card shadow-[0_1px_0_hsl(var(--border))]";

export default function Sales() {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const date = useDateFilter();
  const { compareMode, compareDisplay } = usePreferences();
  const [selectedSaleDate, setSelectedSaleDate] = useState("all");
  const [buyersSearch, setBuyersSearch] = useState("");
  const [campaignSearch, setCampaignSearch] = useState("");
  const [dailySearch, setDailySearch] = useState("");
  const fromIso = format(date.resolved.from, "yyyy-MM-dd");
  const toIso = format(date.resolved.to, "yyyy-MM-dd");

  const comparisonRange = useMemo(() => {
    if (compareMode === "none") return null;
    if (compareMode === "yesterday" && date.mode !== "exact") return null;
    const days = differenceInCalendarDays(date.resolved.to, date.resolved.from) + 1;
    const comparisonToDate = addDays(date.resolved.from, -1);
    const comparisonFromDate = addDays(comparisonToDate, -(days - 1));
    return { from: format(comparisonFromDate, "yyyy-MM-dd"), to: format(comparisonToDate, "yyyy-MM-dd") };
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
  const dailyDateOptions = useMemo(() => Array.from(new Set(dailyRows.map((row) => String(row.sale_date ?? "")).filter(Boolean))).sort(), [dailyRows]);
  const filteredDailyRows = useMemo(() => selectedSaleDate === "all" ? dailyRows : dailyRows.filter((row) => String(row.sale_date ?? "") === selectedSaleDate), [dailyRows, selectedSaleDate]);

  const buyerVisibleCount = useMemo(() => buyerRows.filter((row) => !isDemoBuyerRow(row)).filter((row) => searchBuyerRow(row, buyersSearch, lang)).length, [buyerRows, buyersSearch, lang]);
  const campaignVisibleCount = useMemo(() => summaryRows.filter((row) => searchCampaignRow(row, campaignSearch)).length, [summaryRows, campaignSearch]);
  const dailyVisibleCount = useMemo(() => filteredDailyRows.filter((row) => searchDailyRow(row, dailySearch)).length, [filteredDailyRows, dailySearch]);

  const handleRefresh = () => {
    void query.refetch();
    if (compareMode !== "none" && comparisonRange) void comparisonQuery.refetch();
  };
  const isRefreshing = query.isFetching || comparisonQuery.isFetching;
  const totals = useMemo(() => aggregateSalesTotals(summaryRows), [summaryRows]);
  const comparisonTotals = useMemo(() => aggregateSalesTotals(comparisonRows), [comparisonRows]);
  const showDeltas = compareMode !== "none" && Boolean(comparisonRange) && !comparisonQuery.isLoading;
  const currencyNote = buildCurrencyNote(lang);

  const kpiGroups: KpiGroup[] = [
    { title: lang === "uk" ? "Продажі" : "Sales", rows: [{ label: lang === "uk" ? "Продажі" : "Sales", value: fmtNum(totals.sales_count), description: lang === "uk" ? "Кількість продажів у вибраному періоді." : "Number of sales in the selected period.", delta: buildDelta(totals.sales_count, comparisonTotals.sales_count, fmtNum, compareDisplay, showDeltas) }] },
    { title: lang === "uk" ? "Перші платежі" : "First payments", rows: [
      { label: "USD", value: fmtUsd(totals.first_payment_usd), compact: true, description: lang === "uk" ? "Перший платіж у продажі, якщо продукт має кілька оплат." : "First payment in a sale when the product has multiple payments.", delta: buildDelta(totals.first_payment_usd, comparisonTotals.first_payment_usd, fmtUsd, compareDisplay, showDeltas) },
      { label: "UAH", value: fmtUahExact(totals.first_payment_uah), compact: true, description: lang === "uk" ? "Перший платіж у гривні з даних продажів." : "First payment in UAH from sales data.", delta: buildDelta(totals.first_payment_uah, comparisonTotals.first_payment_uah, fmtUahExact, compareDisplay, showDeltas) },
    ] },
    { title: lang === "uk" ? "Додаткові платежі" : "Additional payments", rows: [
      { label: "USD", value: fmtUsd(totals.second_payment_usd), compact: true, description: lang === "uk" ? "Другий платіж, доплата або платіж за розтермінуванням." : "Second payment, additional payment, or installment payment.", delta: buildDelta(totals.second_payment_usd, comparisonTotals.second_payment_usd, fmtUsd, compareDisplay, showDeltas) },
      { label: "UAH", value: fmtUahExact(totals.second_payment_uah), compact: true, description: lang === "uk" ? "Додаткові платежі у гривні з даних продажів." : "Additional payments in UAH from sales data.", delta: buildDelta(totals.second_payment_uah, comparisonTotals.second_payment_uah, fmtUahExact, compareDisplay, showDeltas) },
    ] },
    { title: lang === "uk" ? "Всього сплачено" : "Total paid", rows: [
      { label: "USD", value: fmtUsd(totals.total_payment_usd), compact: true, description: lang === "uk" ? "Усі зафіксовані платежі в USD за період." : "All recorded USD payments for the period.", delta: buildDelta(totals.total_payment_usd, comparisonTotals.total_payment_usd, fmtUsd, compareDisplay, showDeltas) },
      { label: "UAH", value: fmtUahExact(totals.total_payment_uah), compact: true, description: lang === "uk" ? "Усі зафіксовані платежі в UAH за період." : "All recorded UAH payments for the period.", delta: buildDelta(totals.total_payment_uah, comparisonTotals.total_payment_uah, fmtUahExact, compareDisplay, showDeltas) },
    ] },
  ];

  return <DashboardLayout title={t("salesTitle")} subtitle={t("salesSubtitle")}>
    <div className="sales-page space-y-4 overflow-x-hidden">
      <FilterBar showProject={false} showGroup={false} freshness={{ source: lang === "uk" ? "ІМПОРТ ПРОДАЖІВ" : "SALES IMPORT", status: "fresh", lastSync: "live" }} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
      {!session ? <Msg t={lang === "uk" ? "Увійдіть, щоб переглянути дані продажів." : "Sign in to view sales data."} /> : query.isLoading ? <Msg t={t("salesLoading")} /> : null}
      {!query.isLoading && hasSalesDataError ? <Msg t={t("salesLoadError")} /> : null}

      <SectionCard title={lang === "uk" ? "Підсумок продажів" : "Sales summary"} description={lang === "uk" ? "Ключові фінансові показники за вибраний період" : "Key financial metrics for the selected period"}>
        {hasSalesDataError ? <Msg t={t("salesLoadError")} /> : showSummaryEmpty ? <Msg t={t("salesEmpty")} /> : <>
          <KpiGroups groups={kpiGroups} />
          <p className="mt-3 rounded-md bg-muted/40 px-3 py-2 text-xs text-muted-foreground">{currencyNote}</p>
        </>}
      </SectionCard>

      <SectionCard title={lang === "uk" ? "Покупці" : "Buyer contacts"} description={lang === "uk" ? "Контакти людей із платіжними записами за вибраний період" : "Contacts with payment records for the selected period"} noPadding actions={<TableActions locale={lang} search={buyersSearch} visibleCount={buyerVisibleCount} onSearch={setBuyersSearch} onClear={() => setBuyersSearch("")} onCsv={() => exportBuyerCsv(buyerRows, lang, buyersSearch)} onXlsx={() => exportBuyerXlsx(buyerRows, lang, buyersSearch)} />}>
        {hasBuyerError ? <Msg t={lang === "uk" ? "Не вдалося завантажити контакти покупців." : "Could not load buyer contacts."} /> : <BuyerRows rows={buyerRows} empty={lang === "uk" ? "Покупців за вибраний період не знайдено." : "No buyer contacts found for the selected period."} locale={lang} search={buyersSearch} />}
      </SectionCard>

      <SectionCard title={lang === "uk" ? "Продажі за кампаніями" : "Sales by campaign"} description={lang === "uk" ? "Зведення по кампаніях" : "Compact campaign summary"} noPadding actions={<TableActions locale={lang} search={campaignSearch} visibleCount={campaignVisibleCount} onSearch={setCampaignSearch} onClear={() => setCampaignSearch("")} onCsv={() => exportCampaignCsv(summaryRows, lang, campaignSearch)} onXlsx={() => exportCampaignXlsx(summaryRows, lang, campaignSearch)} />}>
        <CampaignRows rows={summaryRows} empty={t("salesEmpty")} locale={lang} search={campaignSearch} />
      </SectionCard>

      <SectionCard title={lang === "uk" ? "Продажі по днях" : "Sales by day"} description={lang === "uk" ? "Щоденні продажі" : "Daily sales trend"} noPadding actions={<div className="flex flex-wrap items-center gap-2">{dailyDateOptions.length > 1 ? <div className="flex items-center gap-2 text-xs text-muted-foreground"><span>{lang === "uk" ? "День" : "Day"}</span><Select value={selectedSaleDate} onValueChange={setSelectedSaleDate}><SelectTrigger className="h-8 w-[140px] text-xs"><SelectValue /></SelectTrigger><SelectContent><SelectItem value="all">{lang === "uk" ? "Усі дні" : "All days"}</SelectItem>{dailyDateOptions.map((day) => <SelectItem key={day} value={day}>{formatDay(day)}</SelectItem>)}</SelectContent></Select></div> : null}<TableActions locale={lang} search={dailySearch} visibleCount={dailyVisibleCount} onSearch={setDailySearch} onClear={() => setDailySearch("")} onCsv={() => exportDailyCsv(filteredDailyRows, lang, dailySearch)} onXlsx={() => exportDailyXlsx(filteredDailyRows, lang, dailySearch)} /></div>}>
        <DailyRows rows={filteredDailyRows} empty={t("salesEmpty")} locale={lang} search={dailySearch} />
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
    </div>
  </DashboardLayout>;
}

function TableActions({ locale, search, visibleCount, onSearch, onClear, onCsv, onXlsx }: { locale: "uk" | "en"; search: string; visibleCount: number; onSearch: (value: string) => void; onClear: () => void; onCsv: () => void; onXlsx: () => void }) {
  return <div className="flex flex-wrap items-center justify-end gap-2">
    <div className="flex items-center gap-2"><Input value={search} onChange={(event) => onSearch(event.target.value)} placeholder={locale === "uk" ? "Пошук..." : "Search..."} className="h-8 w-[220px]" />{search ? <Button variant="ghost" size="sm" onClick={onClear}>{locale === "uk" ? "Очистити" : "Clear"}</Button> : null}</div>
    <span className="whitespace-nowrap text-xs text-muted-foreground">{locale === "uk" ? "Знайдено" : "Found"}: {visibleCount}</span>
    <DropdownMenu><DropdownMenuTrigger asChild><Button variant="outline" size="sm">{locale === "uk" ? "Завантажити" : "Download"}</Button></DropdownMenuTrigger><DropdownMenuContent align="end"><DropdownMenuItem onClick={onCsv}>CSV</DropdownMenuItem><DropdownMenuItem onClick={onXlsx}>XLSX</DropdownMenuItem></DropdownMenuContent></DropdownMenu>
  </div>;
}

function BuyerRows({ rows, empty, locale, search }: { rows: Row[]; empty: string; locale: "uk" | "en"; search: string }) {
  const [widths, setWidths] = useState<Record<BuyerColumnKey, number>>(BUYER_COLUMN_DEFAULT_WIDTHS);
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const columns = useMemo<BuyerColumn[]>(() => [
    { key: "date", label: locale === "uk" ? "Дата" : "Date", width: 96, minWidth: 82 },
    { key: "name", label: locale === "uk" ? "Імʼя" : "Name", width: 165, minWidth: 120 },
    { key: "phone", label: locale === "uk" ? "Телефон" : "Phone", width: 165, minWidth: 120 },
    { key: "email", label: "Email", width: 165, minWidth: 120 },
    { key: "type", label: locale === "uk" ? "Тип оплати" : "Payment type", width: 150, minWidth: 110 },
    { key: "usd", label: "USD", width: 96, minWidth: 70, align: "right" },
    { key: "uah", label: "UAH", width: 96, minWidth: 70, align: "right" },
    { key: "remaining", label: locale === "uk" ? "Залишок" : "Remaining", width: 96, minWidth: 74, align: "right", tooltip: locale === "uk" ? "Неоплачена частина тарифу / покупки в USD" : "Unpaid part of the tariff / purchase in USD" },
    { key: "status", label: locale === "uk" ? "Статус" : "Status", width: 96, minWidth: 74 },
  ], [locale]);
  const visibleRows = [...rows].filter((row) => !isDemoBuyerRow(row)).filter((row) => searchBuyerRow(row, search, locale)).sort((a, b) => String(a.metric_date ?? "").localeCompare(String(b.metric_date ?? "")));
  if (!visibleRows.length) return <Msg t={empty} />;
  const tableWidth = totalBuyerTableWidth(columns, widths);
  const copyValue = async (key: string, value: string) => { if (!value || value === "—") return; await navigator.clipboard?.writeText(value); setCopied(key); window.setTimeout(() => setCopied(null), 1200); };
  return <div className="sales-table-scroll sales-buyers-table overflow-x-auto"><Table className="table-fixed" style={{ width: tableWidth > 900 ? tableWidth : "100%" }}><colgroup>{columns.map((column) => <col key={column.key} style={{ width: widths[column.key] ?? column.width }} />)}</colgroup><TableHeader><TableRow>{columns.map((column) => <TableHead key={column.key} className={`${STICKY_TABLE_HEAD_CLASS} px-1.5 text-left text-[10.5px] uppercase tracking-wide`}><span className="block truncate" title={column.tooltip ?? column.label}>{column.label}</span><span role="separator" aria-orientation="vertical" aria-label={locale === "uk" ? `Змінити ширину: ${column.label}` : `Resize column: ${column.label}`} title={locale === "uk" ? "Потягніть, щоб змінити ширину колонки" : "Drag to resize column"} onMouseDown={(event) => startBuyerColumnResize(event, column, widths, setWidths)} className="absolute right-0 top-1/2 h-6 w-[4px] -translate-y-1/2 cursor-col-resize touch-none rounded-full bg-border transition hover:bg-primary" /></TableHead>)}</TableRow></TableHeader><TableBody>
    {visibleRows.map((r, i) => {
      const email = display(r.email);
      const phone = display(r.phone_key);
      const paidUsd = getPaidUsd(r);
      const paidUah = getPaidUah(r);
      const hasPaidAmount = paidUsd != null || paidUah != null;
      const rowKey = buyerRowKey(r, i);
      const isSelected = selectedRowKey === rowKey;
      const selectedClass = isSelected ? "bg-primary/10 hover:bg-primary/15 [&>td:first-child]:border-l-4 [&>td:first-child]:border-primary" : "hover:bg-muted/50";
      return <TableRow key={rowKey} onClick={() => setSelectedRowKey((current) => current === rowKey ? null : rowKey)} className={`cursor-pointer ${selectedClass}`}>
        <TableCell className="whitespace-nowrap px-1.5 text-sm">{formatDay(r.metric_date)}</TableCell>
        <TableCell className="truncate whitespace-nowrap px-1.5 text-sm" title={display(r.customer_name)}>{display(r.customer_name)}</TableCell>
        <TableCell className="truncate whitespace-nowrap px-1.5 text-sm" title={phone}><button type="button" className="max-w-full truncate underline-offset-2 hover:underline" onClick={(event) => { event.stopPropagation(); void copyValue(`phone-${rowKey}`, phone); }}>{phone}</button>{copied === `phone-${rowKey}` ? <span className="ml-1 text-[10px] text-emerald-600">✓</span> : null}</TableCell>
        <TableCell className="truncate whitespace-nowrap px-1.5 text-sm" title={email}><button type="button" className="max-w-full truncate underline-offset-2 hover:underline" onClick={(event) => { event.stopPropagation(); void copyValue(`email-${rowKey}`, email); }}>{email}</button>{copied === `email-${rowKey}` ? <span className="ml-1 text-[10px] text-emerald-600">✓</span> : null}</TableCell>
        <TableCell className="px-1.5 text-sm" title={hasPaidAmount ? formatPaymentType(r, locale) : locale === "uk" ? "У raw-джерелі цей запис є, але сума оплати не заповнена" : "The raw source has this record, but the payment amount is empty"}><div className="flex flex-col items-start gap-1"><span className="max-w-full truncate whitespace-nowrap">{formatPaymentType(r, locale)}</span>{!hasPaidAmount ? <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-700">{locale === "uk" ? "немає суми" : "no amount"}</span> : null}</div></TableCell>
        <TableCell className="whitespace-nowrap px-1.5 text-right text-sm num">{fmtOptionalUsd(paidUsd)}</TableCell>
        <TableCell className="whitespace-nowrap px-1.5 text-right text-sm num">{fmtOptionalUahExact(paidUah)}</TableCell>
        <TableCell className="whitespace-nowrap px-1.5 text-right text-sm num">{fmtOptionalUsd(toOptionalNumber(r.debt_amount))}</TableCell>
        <TableCell className="truncate whitespace-nowrap px-1.5 text-sm" title={formatSaleStatus(r.sale_status_norm, locale)}>{formatSaleStatus(r.sale_status_norm, locale)}</TableCell>
      </TableRow>;
    })}
  </TableBody></Table></div>;
}

function CampaignRows({ rows, empty, locale, search }: { rows: Row[]; empty: string; locale: "uk" | "en"; search: string }) {
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const visibleRows = rows.filter((row) => searchCampaignRow(row, search));
  if (!visibleRows.length) return <Msg t={empty} />;
  return <div className="sales-table-scroll sales-campaign-table overflow-x-auto"><Table className="w-full table-fixed"><colgroup><col /><col style={{ width: 146 }} /><col style={{ width: 74 }} /><col style={{ width: 94 }} /><col style={{ width: 106 }} /><col style={{ width: 100 }} /><col style={{ width: 112 }} /></colgroup><TableHeader><TableRow>{[
    locale === "uk" ? "Кампанія" : "Campaign",
    locale === "uk" ? "Період" : "Period",
    locale === "uk" ? "Продажі" : "Sales",
    locale === "uk" ? "Перші USD" : "First USD",
    locale === "uk" ? "Дод. USD" : "Add. USD",
    locale === "uk" ? "Всього USD" : "Total USD",
    locale === "uk" ? "Всього UAH" : "Total UAH",
  ].map((c) => <TableHead key={c} className={`${STICKY_TABLE_HEAD_CLASS} whitespace-nowrap px-3 text-left text-xs uppercase tracking-wide`}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>
    {visibleRows.slice(0, 200).map((r, i) => {
      const rowKey = campaignRowKey(r, i);
      const isSelected = selectedRowKey === rowKey;
      const selectedClass = isSelected ? "bg-primary/10 hover:bg-primary/15 [&>td:first-child]:border-l-4 [&>td:first-child]:border-primary" : "hover:bg-muted/50";
      return <TableRow key={rowKey} onClick={() => setSelectedRowKey((current) => current === rowKey ? null : rowKey)} className={`cursor-pointer ${selectedClass}`}>
        <TableCell className="truncate px-3 text-sm" title={String(r.campaign_name ?? "—")}>{String(r.campaign_name ?? "—")}</TableCell>
        <TableCell className="whitespace-nowrap px-3 text-sm">{formatPeriod(r.first_date, r.last_date)}</TableCell>
        <TableCell className="whitespace-nowrap px-3 text-right num text-sm">{fmtNum(Number(r.sales_count ?? 0))}</TableCell>
        <TableCell className="whitespace-nowrap px-3 text-right num text-sm">{fmtUsd(Number(r.first_payment_usd ?? 0))}</TableCell>
        <TableCell className="whitespace-nowrap px-3 text-right num text-sm">{fmtUsd(Number(r.second_payment_usd ?? 0))}</TableCell>
        <TableCell className="whitespace-nowrap px-3 text-right num text-sm">{fmtUsd(Number(r.total_payment_usd ?? 0))}</TableCell>
        <TableCell className="whitespace-nowrap px-3 text-right num text-sm">{fmtUahExact(Number(r.total_payment_uah ?? 0))}</TableCell>
      </TableRow>;
    })}
  </TableBody></Table></div>;
}

function DailyRows({ rows, empty, locale, search }: { rows: Row[]; empty: string; locale: "uk" | "en"; search: string }) {
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const visibleRows = [...rows].filter((row) => searchDailyRow(row, search)).sort((a, b) => String(a.sale_date ?? "").localeCompare(String(b.sale_date ?? "")));
  if (!visibleRows.length) return <Msg t={empty} />;
  return <div className="sales-table-scroll sales-daily-table overflow-x-auto"><Table className="w-full table-fixed"><colgroup><col style={{ width: 108 }} /><col /><col style={{ width: 80 }} /><col style={{ width: 120 }} /><col style={{ width: 130 }} /></colgroup><TableHeader><TableRow>{[
    locale === "uk" ? "Дата" : "Date",
    locale === "uk" ? "Кампанія" : "Campaign",
    locale === "uk" ? "Продажі" : "Sales",
    locale === "uk" ? "Загалом USD" : "Total USD",
    locale === "uk" ? "Загалом UAH" : "Total UAH",
  ].map((c) => <TableHead key={c} className={`${STICKY_TABLE_HEAD_CLASS} whitespace-nowrap px-3 text-left text-xs uppercase tracking-wide`}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>
    {visibleRows.slice(0, 200).map((r, i) => {
      const rowKey = dailyRowKey(r, i);
      const isSelected = selectedRowKey === rowKey;
      const selectedClass = isSelected ? "bg-primary/10 hover:bg-primary/15 [&>td:first-child]:border-l-4 [&>td:first-child]:border-primary" : "hover:bg-muted/50";
      return <TableRow key={rowKey} onClick={() => setSelectedRowKey((current) => current === rowKey ? null : rowKey)} className={`cursor-pointer ${selectedClass}`}>
        <TableCell className="whitespace-nowrap px-3 text-sm">{formatDay(r.sale_date)}</TableCell>
        <TableCell className="truncate px-3 text-sm" title={String(r.campaign_name ?? "—")}>{String(r.campaign_name ?? "—")}</TableCell>
        <TableCell className="whitespace-nowrap px-3 text-right num text-sm">{fmtNum(Number(r.sales_count ?? 0))}</TableCell>
        <TableCell className="whitespace-nowrap px-3 text-right num text-sm">{fmtUsd(Number(r.total_payment_usd ?? 0))}</TableCell>
        <TableCell className="whitespace-nowrap px-3 text-right num text-sm">{fmtUahExact(Number(r.total_payment_uah ?? 0))}</TableCell>
      </TableRow>;
    })}
  </TableBody></Table></div>;
}

function KpiGroups({ groups }: { groups: KpiGroup[] }) {
  return <div className="grid gap-3 xl:grid-cols-4">{groups.map((group) => <div key={group.title} className="rounded-xl border bg-card p-3"><p className="mb-2 text-sm font-semibold text-foreground">{group.title}</p><div className="grid gap-2">{group.rows.map((r) => <div key={`${group.title}-${r.label}`} className="rounded-lg border bg-background/40 px-3 py-2" title={r.description}><p className="text-xs font-medium leading-snug text-muted-foreground">{r.label}</p><p className={`num mt-1 whitespace-nowrap ${r.compact ? "text-lg" : "text-2xl"} font-semibold`}>{r.value}</p>{r.description ? <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{r.description}</p> : null}{r.delta ? <p className={`mt-1 whitespace-nowrap text-xs font-medium ${r.delta.tone === "positive" ? "text-emerald-600" : r.delta.tone === "negative" ? "text-red-600" : "text-muted-foreground"}`}>{r.delta.text}</p> : null}</div>)}</div></div>)}</div>;
}

const Msg = ({ t }: { t: string }) => <p className="rounded border p-3 text-sm text-muted-foreground">{t}</p>;

async function readOnboarding() { const res = await supabase.from("v_onboarding_hierarchy").select("*").eq("workspace_id", WORKSPACE_ID).limit(500); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }
async function readSalesSummary(fromIso: string, toIso: string) { const res = await supabase.from("v_unified_sales_performance_summary").select("*").eq("workspace_id", WORKSPACE_ID).lte("first_date", toIso).gte("last_date", fromIso).limit(500); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }
async function readSalesDaily(fromIso: string, toIso: string) { const res = await supabase.from("v_unified_sales_performance_daily").select("*").eq("workspace_id", WORKSPACE_ID).gte("sale_date", fromIso).lte("sale_date", toIso).limit(500); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }
async function readSalesBuyers(fromIso: string, toIso: string) { const res = await supabase.from("v_unified_conversions_payment_records").select("*").eq("workspace_id", WORKSPACE_ID).gte("metric_date", fromIso).lte("metric_date", toIso).order("metric_date", { ascending: true }).limit(500); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }
function FriendlyRows({ rows, columns }: { rows: Row[]; columns: { key: string; label: string }[] }) { return <div className="overflow-x-auto"><Table className="min-w-[560px]"><TableHeader><TableRow>{columns.map((c) => <TableHead className="whitespace-nowrap text-xs uppercase tracking-wide" key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((r, i) => <TableRow key={i}>{columns.map((c) => <TableCell className="text-sm" key={c.key}>{String(r[c.key] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table></div>; }
function aggregateSalesTotals(rows: Row[]): SalesTotals { return rows.reduce((acc, row) => ({ sales_count: acc.sales_count + Number(row.sales_count ?? 0), first_payment_usd: acc.first_payment_usd + Number(row.first_payment_usd ?? 0), first_payment_uah: acc.first_payment_uah + Number(row.first_payment_uah ?? 0), second_payment_usd: acc.second_payment_usd + Number(row.second_payment_usd ?? 0), second_payment_uah: acc.second_payment_uah + Number(row.second_payment_uah ?? 0), total_payment_usd: acc.total_payment_usd + Number(row.total_payment_usd ?? 0), total_payment_uah: acc.total_payment_uah + Number(row.total_payment_uah ?? 0) }), emptySalesTotals()); }
function emptySalesTotals(): SalesTotals { return { sales_count: 0, first_payment_usd: 0, first_payment_uah: 0, second_payment_usd: 0, second_payment_uah: 0, total_payment_usd: 0, total_payment_uah: 0 }; }
function fmtUsd(value: number) { return `$${fmtNum(value)}`; }
function fmtUahExact(value: number) { return `₴${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`; }
function fmtOptionalUsd(value: number | null) { return value == null ? "—" : fmtUsd(value); }
function fmtOptionalUahExact(value: number | null) { return value == null ? "—" : fmtUahExact(value); }
function buildCurrencyNote(locale: "uk" | "en") { return locale === "uk" ? "Курс USD/UAH не рахується у браузері. Сторінка показує USD і UAH окремо так, як вони приходять із backend-даних." : "USD/UAH exchange is not calculated in the browser. This page displays USD and UAH separately exactly as provided by backend data."; }
function buildDelta(current: number | null, comparison: number | null, formatter: (value: number) => string, compareDisplay: "percent" | "absolute", showDelta: boolean): Delta | undefined { if (!showDelta) return undefined; if (current == null || comparison == null) return { text: "—", tone: "neutral" }; const absolute = current - comparison; const tone = absolute > 0 ? "positive" : absolute < 0 ? "negative" : "neutral"; if (compareDisplay === "percent") { if (comparison === 0) { if (current === 0) return { text: "0.0%", tone: "neutral" }; return { text: current > 0 ? "+100.0%" : "-100.0%", tone }; } const percent = (absolute / Math.abs(comparison)) * 100; const sign = percent > 0 ? "+" : ""; return { text: `${sign}${percent.toFixed(1)}%`, tone }; } return { text: formatSigned(absolute, formatter), tone }; }
function formatSigned(value: number, formatter: (value: number) => string) { const base = formatter(Math.abs(value)); if (value > 0) return `+${base}`; if (value < 0) return `-${base}`; return base; }
function totalBuyerTableWidth(columns: BuyerColumn[], widths: Record<BuyerColumnKey, number>) { return columns.reduce((total, column) => total + (widths[column.key] ?? column.width), 0); }
function startBuyerColumnResize(event: ReactMouseEvent<HTMLSpanElement>, column: BuyerColumn, widths: Record<BuyerColumnKey, number>, setWidths: (updater: (previous: Record<BuyerColumnKey, number>) => Record<BuyerColumnKey, number>) => void) { event.preventDefault(); event.stopPropagation(); const startX = event.clientX; const startWidth = widths[column.key] ?? column.width; const onMouseMove = (moveEvent: MouseEvent) => { const nextWidth = Math.max(column.minWidth, startWidth + moveEvent.clientX - startX); setWidths((previous) => ({ ...previous, [column.key]: nextWidth })); }; const onMouseUp = () => { document.removeEventListener("mousemove", onMouseMove); document.removeEventListener("mouseup", onMouseUp); document.body.style.cursor = ""; document.body.style.userSelect = ""; }; document.body.style.cursor = "col-resize"; document.body.style.userSelect = "none"; document.addEventListener("mousemove", onMouseMove); document.addEventListener("mouseup", onMouseUp); }
function buyerRowKey(row: Row, index: number) { return `${display(row.phone_key)}-${display(row.metric_date)}-${index}`; }
function campaignRowKey(row: Row, index: number) { return `${display(row.campaign_name)}-${display(row.first_date)}-${index}`; }
function dailyRowKey(row: Row, index: number) { return `${display(row.sale_date)}-${display(row.campaign_name)}-${index}`; }
function getPaidUsd(row: Row) { return coalescePaymentAmount(row.total_payment_usd, sumPaymentAmounts(row.first_payment_usd, row.second_payment_usd), row.payment_usd, row.paid_usd, row.amount_usd); }
function getPaidUah(row: Row) { return coalescePaymentAmount(row.total_payment_uah, sumPaymentAmounts(row.first_payment_uah, row.second_payment_uah), row.payment_uah, row.paid_uah, row.amount_uah); }
function coalescePaymentAmount(...values: (Row[string] | number | null)[]) { for (const value of values) { const number = typeof value === "number" ? value : toOptionalNumber(value); if (number != null && number !== 0) return number; } return null; }
function sumPaymentAmounts(...values: Row[string][]) { const numbers = values.map(toOptionalNumber).filter((value): value is number => value != null && value !== 0); if (!numbers.length) return null; return numbers.reduce((sum, value) => sum + value, 0); }
function toOptionalNumber(value: Row[string] | number | null) { if (typeof value === "number") return Number.isFinite(value) ? value : null; if (value == null || value === "") return null; const number = Number(value); return Number.isFinite(number) ? number : null; }
function display(value: Row[string]) { if (value == null) return "—"; const text = String(value).trim(); return text || "—"; }
function formatPaymentType(row: Row, locale: "uk" | "en") { const labels: Record<string, { uk: string; en: string }> = { full_payment: { uk: "Повна оплата", en: "Full payment" }, full: { uk: "Повна оплата", en: "Full payment" }, "повна": { uk: "Повна оплата", en: "Full payment" }, installment: { uk: "Розтермінування", en: "Installment" }, "розтермінування": { uk: "Розтермінування", en: "Installment" }, deposit: { uk: "Бронь / депозит", en: "Deposit" }, "бронь": { uk: "Бронь / депозит", en: "Deposit" }, additional_payment: { uk: "Доплата", en: "Additional payment" }, "доплата": { uk: "Доплата", en: "Additional payment" }, unknown: { uk: "Невідомо", en: "Unknown" } }; const category = display(row.payment_category).toLowerCase(); if (category !== "—" && labels[category]) return labels[category][locale]; const typeNorm = display(row.payment_type_norm).toLowerCase(); if (typeNorm !== "—" && labels[typeNorm]) return labels[typeNorm][locale]; return display(row.payment_category) !== "—" ? display(row.payment_category) : display(row.payment_type_norm); }
function formatSaleStatus(value: Row[string], locale: "uk" | "en") { const normalized = display(value).toLowerCase(); if (normalized === "refund") return locale === "uk" ? "Повернення" : "Refund"; if (normalized === "needs_review") return locale === "uk" ? "На перевірці" : "Needs review"; if (normalized === "active") return locale === "uk" ? "Активний" : "Active"; return display(value); }
function isDemoBuyerRow(row: Row) { const email = display(row.email).toLowerCase(); const customerName = display(row.customer_name).toLowerCase(); return email.includes("example.com") || email.includes("refund.dev") || email.includes("alex.dev") || email.includes("ira.dev") || customerName.includes("тест") || customerName.includes("test"); }
function formatDay(v: Row[string]) { const d = toDate(v); if (!d) return "—"; return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`; }
function formatPeriod(first: Row[string], last: Row[string]) { const start = toDate(first); const end = toDate(last); if (!start || !end) return "—"; const sameYear = start.getUTCFullYear() === end.getUTCFullYear(); const s = sameYear ? `${pad(start.getUTCDate())}.${pad(start.getUTCMonth() + 1)}` : `${pad(start.getUTCDate())}.${pad(start.getUTCMonth() + 1)}.${start.getUTCFullYear()}`; const e = `${pad(end.getUTCDate())}.${pad(end.getUTCMonth() + 1)}.${end.getUTCFullYear()}`; return `${s} — ${e}`; }
function pad(v: number) { return String(v).padStart(2, "0"); }
function toDate(v: Row[string]) { if (typeof v !== "string") return null; const d = new Date(v); return Number.isNaN(d.getTime()) ? null : d; }
function hasMeaningfulContext(client: Row[string], project: Row[string], funnel: Row[string]) { return [client, project, funnel].some((value) => { if (value == null) return false; const normalized = String(value).trim(); return normalized !== "" && normalized !== "—"; }); }
function normalize(text: string) { return text.trim().toLowerCase(); }
function includesSearch(values: Array<string>, search: string) { const needle = normalize(search); if (!needle) return true; return values.some((value) => normalize(value).includes(needle)); }
function searchBuyerRow(row: Row, search: string, locale: "uk" | "en") { return includesSearch([formatDay(row.metric_date), display(row.customer_name), display(row.phone_key), display(row.email), formatPaymentType(row, locale), formatSaleStatus(row.sale_status_norm, locale)], search); }
function searchCampaignRow(row: Row, search: string) { return includesSearch([display(row.campaign_name), formatPeriod(row.first_date, row.last_date)], search); }
function searchDailyRow(row: Row, search: string) { return includesSearch([display(row.campaign_name), formatDay(row.sale_date)], search); }
function toCsv(rows: string[][]) { return rows.map((r) => r.map((cell) => `"${cell.replaceAll("\"", "\"\"")}"`).join(",")).join("\n"); }
function downloadText(filename: string, contents: string, mime: string) { const blob = new Blob([contents], { type: mime }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
function downloadXlsx(filename: string, rows: ExportCell[][], sheetName: string) { const workbook = XLSX.utils.book_new(); const worksheet = XLSX.utils.aoa_to_sheet(rows); XLSX.utils.book_append_sheet(workbook, worksheet, sheetName); const workbookBytes = XLSX.write(workbook, { bookType: "xlsx", type: "array" }); const blob = new Blob([workbookBytes], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }); const url = URL.createObjectURL(blob); const link = document.createElement("a"); link.href = url; link.download = filename; link.click(); URL.revokeObjectURL(url); }
function numberForExport(value: number | null) { return value == null ? "" : value; }
function exportBuyerCsv(rows: Row[], locale: "uk" | "en", search: string) { const visible = rows.filter((row) => !isDemoBuyerRow(row)).filter((row) => searchBuyerRow(row, search, locale)).sort((a, b) => String(a.metric_date ?? "").localeCompare(String(b.metric_date ?? ""))); const header = locale === "uk" ? ["Дата", "Імʼя", "Телефон", "Email", "Тип оплати", "USD", "UAH", "Залишок", "Статус"] : ["Date", "Name", "Phone", "Email", "Payment type", "USD", "UAH", "Remaining", "Status"]; const data = visible.map((r) => [formatDay(r.metric_date), display(r.customer_name), display(r.phone_key), display(r.email), formatPaymentType(r, locale), fmtOptionalUsd(getPaidUsd(r)), fmtOptionalUahExact(getPaidUah(r)), fmtOptionalUsd(toOptionalNumber(r.debt_amount)), formatSaleStatus(r.sale_status_norm, locale)]); downloadText("sales-buyers.csv", toCsv([header, ...data]), "text/csv;charset=utf-8"); }
function exportBuyerXlsx(rows: Row[], locale: "uk" | "en", search: string) { const visible = rows.filter((row) => !isDemoBuyerRow(row)).filter((row) => searchBuyerRow(row, search, locale)).sort((a, b) => String(a.metric_date ?? "").localeCompare(String(b.metric_date ?? ""))); const header = locale === "uk" ? ["Дата", "Імʼя", "Телефон", "Email", "Тип оплати", "USD", "UAH", "Залишок", "Статус"] : ["Date", "Name", "Phone", "Email", "Payment type", "USD", "UAH", "Remaining", "Status"]; const data: ExportCell[][] = visible.map((r) => [formatDay(r.metric_date), display(r.customer_name), display(r.phone_key), display(r.email), formatPaymentType(r, locale), numberForExport(getPaidUsd(r)), numberForExport(getPaidUah(r)), numberForExport(toOptionalNumber(r.debt_amount)), formatSaleStatus(r.sale_status_norm, locale)]); downloadXlsx("sales-buyers.xlsx", [header, ...data], "Buyers"); }
function exportCampaignCsv(rows: Row[], locale: "uk" | "en", search: string) { const visible = rows.filter((row) => searchCampaignRow(row, search)).slice(0, 200); const header = locale === "uk" ? ["Кампанія", "Період", "Продажі", "Перші USD", "Додаткові USD", "Загалом USD", "Загалом UAH"] : ["Campaign", "Period", "Sales", "First USD", "Additional USD", "Total USD", "Total UAH"]; const data = visible.map((r) => [display(r.campaign_name), formatPeriod(r.first_date, r.last_date), fmtNum(Number(r.sales_count ?? 0)), fmtUsd(Number(r.first_payment_usd ?? 0)), fmtUsd(Number(r.second_payment_usd ?? 0)), fmtUsd(Number(r.total_payment_usd ?? 0)), fmtUahExact(Number(r.total_payment_uah ?? 0))]); downloadText("sales-campaigns.csv", toCsv([header, ...data]), "text/csv;charset=utf-8"); }
function exportCampaignXlsx(rows: Row[], locale: "uk" | "en", search: string) { const visible = rows.filter((row) => searchCampaignRow(row, search)).slice(0, 200); const header = locale === "uk" ? ["Кампанія", "Період", "Продажі", "Перші USD", "Додаткові USD", "Загалом USD", "Загалом UAH"] : ["Campaign", "Period", "Sales", "First USD", "Additional USD", "Total USD", "Total UAH"]; const data: ExportCell[][] = visible.map((r) => [display(r.campaign_name), formatPeriod(r.first_date, r.last_date), Number(r.sales_count ?? 0), Number(r.first_payment_usd ?? 0), Number(r.second_payment_usd ?? 0), Number(r.total_payment_usd ?? 0), Number(r.total_payment_uah ?? 0)]); downloadXlsx("sales-campaigns.xlsx", [header, ...data], "Campaigns"); }
function exportDailyXlsx(rows: Row[], locale: "uk" | "en", search: string) { const visible = [...rows].filter((row) => searchDailyRow(row, search)).sort((a, b) => String(a.sale_date ?? "").localeCompare(String(b.sale_date ?? ""))).slice(0, 200); const header = locale === "uk" ? ["Дата", "Кампанія", "Продажі", "Загалом USD", "Загалом UAH"] : ["Date", "Campaign", "Sales", "Total USD", "Total UAH"]; const data: ExportCell[][] = visible.map((r) => [formatDay(r.sale_date), display(r.campaign_name), Number(r.sales_count ?? 0), Number(r.total_payment_usd ?? 0), Number(r.total_payment_uah ?? 0)]); downloadXlsx("sales-by-day.xlsx", [header, ...data], "Daily sales"); }
function exportDailyCsv(rows: Row[], locale: "uk" | "en", search: string) { const visible = [...rows].filter((row) => searchDailyRow(row, search)).sort((a, b) => String(a.sale_date ?? "").localeCompare(String(b.sale_date ?? ""))).slice(0, 200); const header = locale === "uk" ? ["Дата", "Кампанія", "Продажі", "Загалом USD", "Загалом UAH"] : ["Date", "Campaign", "Sales", "Total USD", "Total UAH"]; const data = visible.map((r) => [formatDay(r.sale_date), display(r.campaign_name), fmtNum(Number(r.sales_count ?? 0)), fmtUsd(Number(r.total_payment_usd ?? 0)), fmtUahExact(Number(r.total_payment_uah ?? 0))]); downloadText("sales-by-day.csv", toCsv([header, ...data]), "text/csv;charset=utf-8"); }
