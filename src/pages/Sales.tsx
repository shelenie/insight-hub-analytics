import { useMemo } from "react";
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

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, string | number | boolean | null>;

export default function Sales() {
  const { t, locale } = useI18n();
  const { session } = useAuth();
  const query = useQuery({ queryKey: ["sales-page", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const [summary, daily, onboarding] = await Promise.all([read("v_unified_sales_performance_summary"), read("v_unified_sales_performance_daily"), read("v_onboarding_hierarchy")]);
    return { summary, daily, onboarding };
  }});

  const summaryRows = query.data?.summary.rows ?? [];
  const dailyRows = query.data?.daily.rows ?? [];
  const showSummaryEmpty = Boolean(session) && !query.isLoading && (query.data?.summary.unavailableReason != null || summaryRows.length === 0);
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

  return <DashboardLayout title={t("salesTitle")} subtitle={t("salesSubtitle")}><div className="space-y-4 overflow-x-hidden"><FilterBar freshness={{ source: locale === "uk" ? "ІМПОРТ ПРОДАЖІВ" : "SALES IMPORT", status: "fresh", lastSync: "live", label: locale === "uk" ? "Дані" : "Data" }} />
    {!session ? <Msg t={locale === "uk" ? "Увійдіть, щоб переглянути дані продажів." : "Sign in to view sales data."} /> : query.isLoading ? <Msg t={t("salesLoading")} /> : null}
    {!query.isLoading && query.data?.summary.unavailableReason ? <Msg t={t("salesLoadError")} /> : null}

    <SectionCard title={locale === "uk" ? "Підсумок продажів" : "Sales summary"} description={locale === "uk" ? "Ключові фінансові показники за вибраний період" : "Key financial metrics for the selected period"}>
      {showSummaryEmpty ? <Msg t={t("salesEmpty")} /> : <Kpi rows={[
        { label: locale === "uk" ? "Продажі" : "Sales", value: fmtNum(totals.sales_count), compact: false },
        { label: locale === "uk" ? "Перші платежі USD" : "First payments USD", value: fmtUsd(totals.first_payment_usd), compact: true },
        { label: locale === "uk" ? "Перші платежі UAH" : "First payments UAH", value: fmtUah(totals.first_payment_uah), compact: true },
        { label: locale === "uk" ? "Другі платежі USD" : "Second payments USD", value: fmtUsd(totals.second_payment_usd), compact: true },
        { label: locale === "uk" ? "Другі платежі UAH" : "Second payments UAH", value: fmtUah(totals.second_payment_uah), compact: true },
        { label: locale === "uk" ? "Загалом USD" : "Total USD", value: fmtUsd(totals.total_payment_usd), compact: true },
        { label: locale === "uk" ? "Загалом UAH" : "Total UAH", value: fmtUah(totals.total_payment_uah), compact: true },
      ]} />}
    </SectionCard>

    <SectionCard title={locale === "uk" ? "Продажі за кампаніями" : "Sales by campaign"} description={locale === "uk" ? "Компактне зведення за кампаніями" : "Compact campaign summary"} noPadding>
      <CampaignRows rows={summaryRows} empty={t("salesEmpty")} locale={locale} />
    </SectionCard>

    <SectionCard title={locale === "uk" ? "Продажі по днях" : "Sales by day"} description={locale === "uk" ? "Щоденна динаміка продажів" : "Daily sales trend"} noPadding>
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
  ].map((c) => <TableHead key={c} className="text-xs uppercase tracking-wide whitespace-nowrap">{c}</TableHead>)}</TableRow></TableHeader><TableBody>
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
  ].map((c) => <TableHead key={c} className="text-xs uppercase tracking-wide whitespace-nowrap">{c}</TableHead>)}</TableRow></TableHeader><TableBody>
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

async function read(view: string) { const res = await supabase.from(view).select("*").eq("workspace_id", WORKSPACE_ID).limit(500); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }

function FriendlyRows({ rows, columns }: { rows: Row[]; columns: { key: string; label: string }[] }) {
  return <div className="overflow-x-auto"><Table className="min-w-[560px]"><TableHeader><TableRow>{columns.map((c) => <TableHead className="text-xs uppercase tracking-wide whitespace-nowrap" key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((r, i) => <TableRow key={i}>{columns.map((c) => <TableCell className="text-sm" key={c.key}>{String(r[c.key] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table></div>;
}

function fmtUsd(value: number) { return `$${fmtNum(value)}`; }
function fmtUah(value: number) { return `₴${fmtNum(value)}`; }

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
