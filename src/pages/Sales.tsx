import { useMemo } from "react";
import { format } from "date-fns";
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

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, string | number | boolean | null>;

export default function Sales() {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const date = useDateFilter();
  const fromIso = format(date.resolved.from, "yyyy-MM-dd");
  const toIso = format(date.resolved.to, "yyyy-MM-dd");
  const query = useQuery({ queryKey: ["sales-page", WORKSPACE_ID, fromIso, toIso, date.mode, date.preset], enabled: Boolean(session), queryFn: async () => {
    const [summary, daily, onboarding, buyers] = await Promise.all([
      readSalesSummary(fromIso, toIso),
      readSalesDaily(fromIso, toIso),
      readOnboarding(),
      readSalesBuyers(fromIso, toIso),
    ]);
    return { summary, daily, onboarding, buyers };
  }});

  const summaryRows = query.data?.summary.rows ?? [];
  const dailyRows = query.data?.daily.rows ?? [];
  const buyerRows = query.data?.buyers.rows ?? [];
  const hasSalesDataError = Boolean(query.data?.summary.unavailableReason || query.data?.daily.unavailableReason || query.isError);
  const hasBuyerError = Boolean(query.data?.buyers.unavailableReason);
  const showSummaryEmpty = Boolean(session) && !query.isLoading && !hasSalesDataError && summaryRows.length === 0;
  const filteredOnboardingRows = useMemo(() => filterPlaceholderRows(query.data?.onboarding.rows as Record<string, unknown>[] | undefined) as Row[], [query.data?.onboarding.rows]);
  const contextRows = useMemo(() => filteredOnboardingRows.filter((row) => hasMeaningfulContext(row.client_name, row.project_name, row.funnel_name)), [filteredOnboardingRows]);

  const totals = summaryRows.reduce((acc, row) => ({
    sales_count: acc.sales_count + Number(row.sales_count ?? 0),
    first_payment_usd: acc.first_payment_usd + Number(row.first_payment_usd ?? 0),
    first_payment_uah: acc.first_payment_uah + Number(row.first_payment_uah ?? 0),
    second_payment_usd: acc.second_payment_usd + Number(row.second_payment_usd ?? 0),
    second_payment_uah: acc.second_payment_uah + Number(row.second_payment_uah ?? 0),
    total_payment_usd: acc.total_payment_usd + Number(row.total_payment_usd ?? 0),
    total_payment_uah: acc.total_payment_uah + Number(row.total_payment_uah ?? 0),
  }), { sales_count: 0, first_payment_usd: 0, first_payment_uah: 0, second_payment_usd: 0, second_payment_uah: 0, total_payment_usd: 0, total_payment_uah: 0 });

  return <DashboardLayout title={t("salesTitle")} subtitle={t("salesSubtitle")}><div className="space-y-4 overflow-x-hidden"><FilterBar showProject={false} showGroup={false} freshness={{ source: locale === "uk" ? "ІМПОРТ ПРОДАЖІВ" : "SALES IMPORT", status: "fresh", lastSync: "live" }} onRefresh={() => { void query.refetch(); }} isRefreshing={query.isFetching} />
    {!session ? <Msg t={locale === "uk" ? "Увійдіть, щоб переглянути дані продажів." : "Sign in to view sales data."} /> : query.isLoading ? <Msg t={t("salesLoading")} /> : null}
    {!query.isLoading && hasSalesDataError ? <Msg t={t("salesLoadError")} /> : null}

    <SectionCard title={locale === "uk" ? "Підсумок продажів" : "Sales summary"} description={locale === "uk" ? "Ключові фінансові показники за вибраний період" : "Key financial metrics for the selected period"}>
      {hasSalesDataError ? <Msg t={t("salesLoadError")} /> : showSummaryEmpty ? <Msg t={t("salesEmpty")} /> : <Kpi rows={[
        { label: locale === "uk" ? "Продажі" : "Sales", value: fmtNum(totals.sales_count), compact: false },
        { label: locale === "uk" ? "Перші платежі USD" : "First payments USD", value: fmtUsd(totals.first_payment_usd), compact: true },
        { label: locale === "uk" ? "Перші платежі UAH" : "First payments UAH", value: fmtUah(totals.first_payment_uah), compact: true },
        { label: locale === "uk" ? "Другі платежі USD" : "Second payments USD", value: fmtUsd(totals.second_payment_usd), compact: true },
        { label: locale === "uk" ? "Другі платежі UAH" : "Second payments UAH", value: fmtUah(totals.second_payment_uah), compact: true },
        { label: locale === "uk" ? "Загалом USD" : "Total USD", value: fmtUsd(totals.total_payment_usd), compact: true },
        { label: locale === "uk" ? "Загалом UAH" : "Total UAH", value: fmtUah(totals.total_payment_uah), compact: true },
      ]} />}
    </SectionCard>

    <SectionCard title={locale === "uk" ? "Покупці" : "Buyer contacts"} description={locale === "uk" ? "Контакти людей із платіжними записами за вибраний період" : "Contacts with payment records for the selected period"} noPadding>
      {hasBuyerError ? <Msg t={locale === "uk" ? "Не вдалося завантажити контакти покупців." : "Could not load buyer contacts."} /> : <BuyerRows rows={buyerRows} empty={locale === "uk" ? "Покупців за вибраний період не знайдено." : "No buyer contacts found for the selected period."} locale={locale} />}
    </SectionCard>

    <SectionCard title={locale === "uk" ? "Продажі за кампаніями" : "Sales by campaign"} description={locale === "uk" ? "Зведення по кампаніях" : "Compact campaign summary"} noPadding>
      <CampaignRows rows={summaryRows} empty={t("salesEmpty")} locale={locale} />
    </SectionCard>

    <SectionCard title={locale === "uk" ? "Продажі по днях" : "Sales by day"} description={locale === "uk" ? "Щоденні продажі" : "Daily sales trend"} noPadding>
      <DailyRows rows={dailyRows} empty={t("salesEmpty")} locale={locale} />
    </SectionCard>

    {contextRows.length > 0 ? <details className="rounded border" open={false}>
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{locale === "uk" ? "Додатково: контекст клієнта / проєкту / воронки" : "Additional: client / project / funnel context"}</summary>
      <SectionCard title={locale === "uk" ? "Контекст клієнта / проєкту / воронки" : "Client / project / funnel context"} description={locale === "uk" ? "Довідковий контекст для аналізу продажів" : "Reference context for sales analytics"} noPadding>
        <FriendlyRows rows={contextRows} columns={[
          { key: "client_name", label: locale === "uk" ? "Клієнт" : "Client" },
          { key: "project_name", label: locale === "uk" ? "Проєкт" : "Project" },
          { key: "funnel_name", label: locale === "uk" ? "Воронка" : "Funnel" },
          { key: "status", label: locale === "uk" ? "Статус" : "Status" },
        ]} />
      </SectionCard>
    </details> : null}
  </div></DashboardLayout>;
}

function BuyerRows({ rows, empty, locale }: { rows: Row[]; empty: string; locale: "uk" | "en" }) {
  // Hide obvious demo/test buyer rows from production-facing Sales UI.
  const visibleRows = rows.filter((row) => !isDemoBuyerRow(row));
  if (!visibleRows.length) return <Msg t={empty} />;
  return <div className="overflow-x-auto"><Table className="min-w-[940px] w-full"><TableHeader><TableRow>{[
    locale === "uk" ? "Дата" : "Date",
    locale === "uk" ? "Імʼя" : "Name",
    locale === "uk" ? "Телефон" : "Phone",
    "Email",
    locale === "uk" ? "Тип оплати" : "Payment type",
    locale === "uk" ? "Сплачено USD" : "Paid USD",
    locale === "uk" ? "Сплачено UAH" : "Paid UAH",
    locale === "uk" ? "Залишок USD" : "Remaining USD",
    locale === "uk" ? "Статус" : "Status",
  ].map((c) => <TableHead key={c} className="whitespace-nowrap text-xs uppercase tracking-wide">{c === (locale === "uk" ? "Залишок USD" : "Remaining USD") ? <span title={locale === "uk" ? "Неоплачена частина тарифу / покупки" : "Unpaid part of the tariff / purchase"}>{c}</span> : c}</TableHead>)}</TableRow></TableHeader><TableBody>
    {visibleRows.map((r, i) => {
      const email = display(r.email);
      return <TableRow key={`${String(r.phone_key ?? "")}-${String(r.metric_date ?? "")}-${i}`}>
        <TableCell className="whitespace-nowrap text-sm">{formatDay(r.metric_date)}</TableCell>
        <TableCell className="max-w-[160px] truncate text-sm" title={display(r.customer_name)}>{display(r.customer_name)}</TableCell>
        <TableCell className="max-w-[130px] truncate text-sm" title={display(r.phone_key)}>{display(r.phone_key)}</TableCell>
        <TableCell className="max-w-[190px] truncate text-sm" title={email}>{email}</TableCell>
        <TableCell className="max-w-[140px] truncate text-sm" title={formatPaymentType(r, locale)}>{formatPaymentType(r, locale)}</TableCell>
        <TableCell className="text-right num whitespace-nowrap text-sm">{fmtOptionalUsd(sumOptional(r.first_payment_usd, r.second_payment_usd))}</TableCell>
        <TableCell className="text-right num whitespace-nowrap text-sm">{fmtOptionalUahExact(sumOptional(r.first_payment_uah, r.second_payment_uah))}</TableCell>
        <TableCell className="text-right num whitespace-nowrap text-sm">{fmtOptionalUsd(toOptionalNumber(r.debt_amount))}</TableCell>
        <TableCell className="whitespace-nowrap text-sm">{formatSaleStatus(r.sale_status_norm, locale)}</TableCell>
      </TableRow>;
    })}
  </TableBody></Table></div>;
}

function CampaignRows({ rows, empty, locale }: { rows: Row[]; empty: string; locale: "uk" | "en" }) {
  if (!rows.length) return <Msg t={empty} />;
  return <div className="overflow-x-auto"><Table className="min-w-[860px]"><TableHeader><TableRow>{[
    locale === "uk" ? "Кампанія" : "Campaign",
    locale === "uk" ? "Період" : "Period",
    locale === "uk" ? "Продажі" : "Sales",
    locale === "uk" ? "Перші USD" : "First USD",
    locale === "uk" ? "Другі USD" : "Second USD",
    locale === "uk" ? "Загалом USD" : "Total USD",
    locale === "uk" ? "Загалом UAH" : "Total UAH",
  ].map((c) => <TableHead key={c} className="text-xs uppercase tracking-wide whitespace-nowrap">{c === (locale === "uk" ? "Залишок USD" : "Remaining USD") ? <span title={locale === "uk" ? "Неоплачена частина тарифу / покупки" : "Unpaid part of the tariff / purchase"}>{c}</span> : c}</TableHead>)}</TableRow></TableHeader><TableBody>
    {rows.slice(0, 200).map((r, i) => <TableRow key={i}>
      <TableCell className="max-w-[220px] truncate text-sm" title={String(r.campaign_name ?? "—")}>{String(r.campaign_name ?? "—")}</TableCell>
      <TableCell className="whitespace-nowrap text-sm">{formatPeriod(r.first_date, r.last_date)}</TableCell>
      <TableCell className="text-right num text-sm">{fmtNum(Number(r.sales_count ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUsd(Number(r.first_payment_usd ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUsd(Number(r.second_payment_usd ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUsd(Number(r.total_payment_usd ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUah(Number(r.total_payment_uah ?? 0))}</TableCell>
    </TableRow>)}
  </TableBody></Table></div>;
}

function DailyRows({ rows, empty, locale }: { rows: Row[]; empty: string; locale: "uk" | "en" }) {
  if (!rows.length) return <Msg t={empty} />;
  return <div className="overflow-x-auto"><Table className="min-w-[720px]"><TableHeader><TableRow>{[
    locale === "uk" ? "Дата" : "Date",
    locale === "uk" ? "Кампанія" : "Campaign",
    locale === "uk" ? "Продажі" : "Sales",
    locale === "uk" ? "Загалом USD" : "Total USD",
    locale === "uk" ? "Загалом UAH" : "Total UAH",
  ].map((c) => <TableHead key={c} className="text-xs uppercase tracking-wide whitespace-nowrap">{c === (locale === "uk" ? "Залишок USD" : "Remaining USD") ? <span title={locale === "uk" ? "Неоплачена частина тарифу / покупки" : "Unpaid part of the tariff / purchase"}>{c}</span> : c}</TableHead>)}</TableRow></TableHeader><TableBody>
    {rows.slice(0, 200).map((r, i) => <TableRow key={i}>
      <TableCell className="whitespace-nowrap text-sm">{formatDay(r.sale_date)}</TableCell>
      <TableCell className="max-w-[220px] truncate text-sm" title={String(r.campaign_name ?? "—")}>{String(r.campaign_name ?? "—")}</TableCell>
      <TableCell className="text-right num text-sm">{fmtNum(Number(r.sales_count ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUsd(Number(r.total_payment_usd ?? 0))}</TableCell>
      <TableCell className="text-right num text-sm">{fmtUah(Number(r.total_payment_uah ?? 0))}</TableCell>
    </TableRow>)}
  </TableBody></Table></div>;
}

function Kpi({ rows }: { rows: { label: string; value: string; compact: boolean }[] }) {
  return <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">{rows.map((r) => <div key={r.label} className="rounded border bg-card px-3 py-2"><p className="text-xs text-muted-foreground">{r.label}</p><p className={`num mt-1 whitespace-nowrap ${r.compact ? "text-base" : "text-lg"} font-semibold`}>{r.value}</p></div>)}</div>;
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
    .select("metric_date,customer_name,email,phone_key,payment_type_norm,payment_category,sale_status_norm,tariff_price,debt_amount,first_payment_date,first_payment_usd,first_payment_uah,second_payment_date,second_payment_usd,second_payment_uah")
    .eq("workspace_id", WORKSPACE_ID)
    .gte("metric_date", fromIso)
    .lte("metric_date", toIso)
    .limit(500);
  return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null };
}

function FriendlyRows({ rows, columns }: { rows: Row[]; columns: { key: string; label: string }[] }) {
  return <div className="overflow-x-auto"><Table className="min-w-[560px]"><TableHeader><TableRow>{columns.map((c) => <TableHead className="text-xs uppercase tracking-wide whitespace-nowrap" key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((r, i) => <TableRow key={i}>{columns.map((c) => <TableCell className="text-sm" key={c.key}>{String(r[c.key] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table></div>;
}

function fmtUsd(value: number) { return `$${fmtNum(value)}`; }
function fmtUah(value: number) { return `₴${fmtNum(value)}`; }
function fmtOptionalUsd(value: number | null) { return value == null ? "—" : fmtUsd(value); }
function fmtOptionalUahExact(value: number | null) { return value == null ? "—" : `₴${new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 }).format(value)}`; }

function sumOptional(...values: Row[string][]) {
  const numbers = values.map(toOptionalNumber).filter((value): value is number => value != null);
  if (!numbers.length) return null;
  return numbers.reduce((sum, value) => sum + value, 0);
}

function toOptionalNumber(value: Row[string]) {
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
