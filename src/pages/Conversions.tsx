import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { RefreshCw } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { DateFilter } from "@/components/dashboard/DateFilter";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtNum } from "@/lib/format";
import { filterPlaceholderRows } from "@/lib/demoFilters";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useDateFilter } from "@/filters/DateContext";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, string | number | boolean | null>;
const STAGE_ORDER = ["registration", "questionnaire", "application", "booking", "sale", "payment"];

export default function Conversions() {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const date = useDateFilter();

  const boundsQuery = useQuery({
    queryKey: ["conversions-bounds", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: () => readView("v_unified_conversions_data_bounds", true),
  });

  const bounds = useMemo(() => {
    const row = boundsQuery.data?.[0];
    if (!row) return null;
    const from = parseDate(row.first_date);
    const to = parseDate(row.last_date);
    if (!from || !to) return null;
    return { from, to };
  }, [boundsQuery.data]);

  useEffect(() => {
    if (bounds) date.setDataBounds(bounds);
  }, [bounds, date]);

  const effectiveFrom = date.preset === "all" && bounds ? bounds.from : date.resolved.from;
  const effectiveTo = date.preset === "all" && bounds ? bounds.to : date.resolved.to;
  const fromIso = format(effectiveFrom, "yyyy-MM-dd");
  const toIso = format(effectiveTo, "yyyy-MM-dd");

  const dataQuery = useQuery({
    queryKey: ["conversions-page", WORKSPACE_ID, fromIso, toIso, date.mode, date.preset],
    enabled: Boolean(session),
    queryFn: async () => {
      const [stageEvents, paymentRecords, paymentLines, onboarding, bindings] = await Promise.all([
        readViewPaged("v_unified_conversions_stage_events", true, fromIso, toIso, "metric_date"),
        readViewPaged("v_unified_conversions_payment_records", true, fromIso, toIso, "metric_date"),
        readViewPaged("v_unified_conversions_payment_lines", true, fromIso, toIso, "metric_date"),
        readView("v_onboarding_hierarchy", true),
        readView("v_project_data_bindings", true),
      ]);
      return { stageEvents, paymentRecords, paymentLines, onboarding, bindings };
    },
  });

  const aggregates = useMemo(() => computeAggregates(dataQuery.data?.stageEvents ?? [], dataQuery.data?.paymentRecords ?? [], dataQuery.data?.paymentLines ?? []), [dataQuery.data]);
  const filteredOnboardingRows = useMemo(() => filterPlaceholderRows(dataQuery.data?.onboarding as Record<string, unknown>[] | undefined) as Row[], [dataQuery.data?.onboarding]);
  const filteredBindingsRows = useMemo(() => filterPlaceholderRows(dataQuery.data?.bindings as Record<string, unknown>[] | undefined) as Row[], [dataQuery.data?.bindings]);

  const isRefreshing = boundsQuery.isRefetching || dataQuery.isRefetching;
  const hasData = aggregates.stageRows.length > 0 || aggregates.paymentRecords > 0 || aggregates.paymentLinesCount > 0;

  return <DashboardLayout title={t("funnelTitle")} subtitle={t("funnelSubtitle")}>
    <div className="space-y-4">
      <div className="rounded border p-3">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2">
          <p className="text-xs font-medium">{t("filters")}</p>
          <DateFilter />
          </div>
          <div className="ml-auto flex flex-wrap items-center gap-2">
          <p className="inline-flex items-center gap-1.5 rounded border border-emerald-500/40 bg-emerald-500/10 px-2 py-1 text-xs font-medium uppercase tracking-wide text-emerald-700 dark:text-emerald-300"><span className="h-1.5 w-1.5 rounded-full bg-emerald-500" />{t("conversionsDataStatus")}</p>
          <Button size="sm" variant="outline" className="h-8" onClick={() => { boundsQuery.refetch(); dataQuery.refetch(); }} disabled={isRefreshing}>
            <RefreshCw className={`mr-1 h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
            {t("refresh")}
          </Button>
          </div>
        </div>
        <p className="mt-2 text-xs text-muted-foreground">{date.contextLabel(lang)}</p>
      </div>

      {!session ? <Empty text={t("conversionsSignIn")} /> : (dataQuery.isLoading || boundsQuery.isLoading) ? <Empty text={t("conversionsLoading")} /> : null}
      {!dataQuery.isLoading && !boundsQuery.isLoading && session && !hasData ? <Empty text={t("conversionsNoDataSelectedPeriod")} /> : null}

      {hasData ? <>
        <SectionCard title={t("conversionsStageSection")} description={t("conversionsStageSectionDesc")}>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
            <MetricCard label={t("conversionsRegistrations")} value={aggregates.registrations} helper={`${t("conversionsUniqueContacts")}: ${fmtNum(aggregates.stageUnique.registration)}`} />
            <MetricCard label={t("conversionsQuestionnaires")} value={aggregates.questionnaires} helper={`${t("conversionsUniqueContacts")}: ${fmtNum(aggregates.stageUnique.questionnaire)}`} />
            <MetricCard label={t("conversionsApplications")} value={aggregates.applications} helper={`${t("conversionsUniqueContacts")}: ${fmtNum(aggregates.stageUnique.application)}`} />
            <MetricCard label={t("conversionsBookings")} value={aggregates.bookings} helper={`${t("conversionsUniqueContacts")}: ${fmtNum(aggregates.stageUnique.booking)}`} />
          </div>
        </SectionCard>

        <SectionCard title={t("conversionsBetweenStages")} description={t("conversionsBetweenStagesDesc")}>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard label={t("conversionsRegToQuestionnaire")} value={safePct(aggregates.questionnaires, aggregates.registrations)} percent />
            <MetricCard label={t("conversionsQuestionnaireToApplication")} value={safePct(aggregates.applications, aggregates.questionnaires)} percent />
            <MetricCard label={t("conversionsApplicationToBooking")} value={safePct(aggregates.bookings, aggregates.applications)} percent />
            <MetricCard label={t("conversionsRegToBooking")} value={safePct(aggregates.bookings, aggregates.registrations)} percent />
            <MetricCard label={t("conversionsRegToPayment")} value={safePct(aggregates.paymentRecords, aggregates.registrations)} percent />
          </div>
        </SectionCard>

        <SectionCard title={t("conversionsPaymentsSection")} description={t("conversionsPaymentsSectionDesc")}><div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
          <MetricCard label={t("conversionsPaymentRecords")} value={aggregates.paymentRecords} />
          <MetricCard label={t("conversionsUniquePayers")} value={aggregates.uniquePayers} />
          <MetricCard label={t("conversionsActivePayments")} value={aggregates.activePaymentRows} />
          <MetricCard label={t("conversionsFullPayments")} value={aggregates.fullPaymentRows} />
          <MetricCard label={t("conversionsInstallments")} value={aggregates.installmentRows} />
          <MetricCard label={t("conversionsDeposits")} value={aggregates.depositRows} />
          <MetricCard label={t("conversionsAdditionalPayments")} value={aggregates.additionalPaymentRows} />
          <MetricCard label={t("conversionsRefunds")} value={aggregates.refundPaymentRows} />
          <MetricCard label={t("conversionsNeedsReview")} value={aggregates.needsReviewPaymentRows} />
          <MetricCard label={t("conversionsCollectedUsd")} value={money(aggregates.collectedUsdTotal, "USD", lang)} raw />
          <MetricCard label={t("conversionsCollectedUah")} value={money(aggregates.collectedUahTotal, "UAH", lang)} raw />
          <MetricCard label={t("conversionsDebt")} value={money(aggregates.debtTotal, "USD", lang)} raw />
          <MetricCard label={t("conversionsTariffTotal")} value={money(aggregates.tariffTotal, "USD", lang)} raw />
        </div></SectionCard>

        <SectionCard title={t("conversionsMatchingTitle")} description={t("conversionsMatchingSubtitle")}>
          <p className="mb-3 text-xs text-muted-foreground">{t("conversionsMatchingExplain")}</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard label={t("conversionsBookingPhones")} value={aggregates.bookingPhones} />
            <MetricCard label={t("conversionsPaymentPhones")} value={aggregates.paymentPhones} />
            <MetricCard label={t("conversionsMatchedPhones")} value={aggregates.matchedPhones} />
            <MetricCard label={t("conversionsBookingToPaymentMatch")} value={safePct(aggregates.matchedPhones, aggregates.bookingPhones)} percent />
            <MetricCard label={t("conversionsPaymentsWithoutBooking")} value={aggregates.paymentsWithoutBooking} />
            <MetricCard label={t("conversionsBookingsWithoutPayment")} value={aggregates.bookingsWithoutPayment} />
            <MetricCard label={t("conversionsRawPaymentsBookingsRatio")} value={safePct(aggregates.paymentRecords, aggregates.bookings)} percent />
          </div>
          <p className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-100">{t("conversionsRatioWarning")}</p>
        </SectionCard>

        <SectionCard title={t("conversionsStageTableTitle")} description={t("conversionsStageTableDesc")} noPadding><Table><TableHeader><TableRow><TableHead>{t("conversionsThStage")}</TableHead><TableHead className="text-right">{t("conversionsThEvents")}</TableHead><TableHead className="text-right">{t("conversionsThUniqueContacts")}</TableHead><TableHead>{t("conversionsThFirstDate")}</TableHead><TableHead>{t("conversionsThLastDate")}</TableHead></TableRow></TableHeader><TableBody>{aggregates.stageRows.map((row, idx) => <TableRow key={idx}><TableCell>{getStageLabel(String(row.stage ?? "").toLowerCase(), row.stage_label, lang)}</TableCell><TableCell className="text-right num">{fmtNum(Number(row.events_count ?? 0))}</TableCell><TableCell className="text-right num">{fmtNum(Number(row.unique_contacts ?? 0))}</TableCell><TableCell>{formatShortDate(row.first_date)}</TableCell><TableCell>{formatShortDate(row.last_date)}</TableCell></TableRow>)}</TableBody></Table></SectionCard>

        {filteredOnboardingRows.length > 0 ? <details className="rounded border"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("conversionsExtraContext")}</summary><SectionCard title={t("conversionsExtraContext")} noPadding><FriendlyTable rows={filterMeaningfulContextRows(filteredOnboardingRows)} columns={[{ key: "client_name", label: t("conversionsContextClient") }, { key: "project_name", label: t("conversionsContextProject") }, { key: "funnel_name", label: t("conversionsContextFunnel") }, { key: "status", label: t("conversionsContextStatus") }]} empty={t("conversionsViewUnavailable")} /></SectionCard></details> : null}
        {filteredBindingsRows.length > 0 ? <details className="rounded border"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("conversionsExtraBindings")}</summary><SectionCard title={t("conversionsExtraBindings")} noPadding><FriendlyTable rows={filteredBindingsRows} columns={[{ key: "project_name", label: "project_name" }, { key: "source_name", label: "source_name" }, { key: "mapping_status", label: "mapping_status" }, { key: "binding_status", label: "binding_status" }, { key: "updated_at", label: "updated_at" }]} empty={t("conversionsViewUnavailable")} /></SectionCard></details> : null}
      </> : null}
    </div>
  </DashboardLayout>;
}

function computeAggregates(stageEvents: Row[], paymentRecordsRows: Row[], paymentLines: Row[]) { /* omitted for brevity */
  const byStage = new Map<string, { count: number; contacts: Set<string>; first: string | null; last: string | null }>();
  const bookingPhones = new Set<string>();
  for (const row of stageEvents) {
    const stage = String(row.stage ?? "").toLowerCase();
    if (!stage) continue;
    const item = byStage.get(stage) ?? { count: 0, contacts: new Set<string>(), first: null, last: null };
    item.count += 1;
    const c = String(row.contact_key ?? ""); if (c) item.contacts.add(c);
    const d = String(row.metric_date ?? ""); if (d) { if (!item.first || d < item.first) item.first = d; if (!item.last || d > item.last) item.last = d; }
    if (stage === "booking") { const p = String(row.phone_key ?? ""); if (p) bookingPhones.add(p); }
    byStage.set(stage, item);
  }
  const goodPayments = (r: Row) => !["refund", "needs_review"].includes(String(r.sale_status_norm ?? "").toLowerCase());
  const paymentPhones = new Set<string>(); const payerSet = new Set<string>();
  let activePaymentRows = 0, refundPaymentRows = 0, needsReviewPaymentRows = 0, fullPaymentRows = 0, installmentRows = 0, depositRows = 0, additionalPaymentRows = 0, debtTotal = 0, tariffTotal = 0;
  for (const row of paymentRecordsRows) {
    const status = String(row.sale_status_norm ?? "").toLowerCase();
    if (status === "active") activePaymentRows++; if (status === "refund") refundPaymentRows++; if (status === "needs_review") needsReviewPaymentRows++;
    const cust = String(row.customer_key ?? ""); if (cust) payerSet.add(cust);
    if (goodPayments(row)) {
      const cat = String(row.payment_category ?? "").toLowerCase();
      if (cat === "full_payment") fullPaymentRows++; if (cat === "installment") installmentRows++; if (cat === "deposit") depositRows++; if (cat === "additional_payment") additionalPaymentRows++;
      debtTotal += toNumber(row.debt_amount) ?? 0; tariffTotal += toNumber(row.tariff_price) ?? 0;
      const p = String(row.phone_key ?? ""); if (p) paymentPhones.add(p);
    }
  }
  let collectedUsdTotal = 0, collectedUahTotal = 0;
  for (const row of paymentLines) if (goodPayments(row)) { collectedUsdTotal += toNumber(row.amount_usd) ?? 0; collectedUahTotal += toNumber(row.amount_uah) ?? 0; }
  const matchedPhones = [...bookingPhones].filter((p) => paymentPhones.has(p)).length;
  const stageRows = [...byStage.entries()].map(([stage, v]) => ({ stage, stage_label: stage, events_count: v.count, unique_contacts: v.contacts.size, first_date: v.first, last_date: v.last })).sort((a,b)=>STAGE_ORDER.indexOf(a.stage)-STAGE_ORDER.indexOf(b.stage));
  return {
    stageRows, paymentLinesCount: paymentLines.length,
    registrations: byStage.get("registration")?.count ?? 0, questionnaires: byStage.get("questionnaire")?.count ?? 0, applications: byStage.get("application")?.count ?? 0, bookings: byStage.get("booking")?.count ?? 0,
    stageUnique: { registration: byStage.get("registration")?.contacts.size ?? 0, questionnaire: byStage.get("questionnaire")?.contacts.size ?? 0, application: byStage.get("application")?.contacts.size ?? 0, booking: byStage.get("booking")?.contacts.size ?? 0 },
    paymentRecords: paymentRecordsRows.length, uniquePayers: payerSet.size, activePaymentRows, refundPaymentRows, needsReviewPaymentRows, fullPaymentRows, installmentRows, depositRows, additionalPaymentRows, debtTotal, tariffTotal,
    collectedUsdTotal, collectedUahTotal, bookingPhones: bookingPhones.size, paymentPhones: paymentPhones.size, matchedPhones, paymentsWithoutBooking: paymentPhones.size - matchedPhones, bookingsWithoutPayment: bookingPhones.size - matchedPhones,
  };
}

async function readView(viewName: string, scopedByWorkspace: boolean, from?: string, to?: string): Promise<Row[]> { let query = supabase.from(viewName).select("*"); if (scopedByWorkspace) query = query.eq("workspace_id", WORKSPACE_ID); if (from && to) query = query.gte("metric_date", from).lte("metric_date", to); const res = await query; return (res.data ?? []) as Row[]; }
async function readViewPaged(viewName: string, scopedByWorkspace: boolean, from?: string, to?: string, orderBy?: string): Promise<Row[]> {
  const pageSize = 1000;
  const maxRows = 50000;
  const rows: Row[] = [];
  for (let fromIndex = 0; fromIndex < maxRows; fromIndex += pageSize) {
    const toIndex = fromIndex + pageSize - 1;
    let query = supabase.from(viewName).select("*");
    if (scopedByWorkspace) query = query.eq("workspace_id", WORKSPACE_ID);
    if (from && to) query = query.gte("metric_date", from).lte("metric_date", to);
    if (orderBy) query = query.order(orderBy, { ascending: true });
    const res = await query.range(fromIndex, toIndex);
    const page = (res.data ?? []) as Row[];
    rows.push(...page);
    if (page.length < pageSize) return rows;
  }
  console.warn(`[Conversions] Reached max rows cap (${maxRows}) for ${viewName}. Results may be truncated.`);
  return rows;
}
function filterMeaningfulContextRows(rows: Row[]) {
  return rows.filter((row) => {
    const client = String(row.client_name ?? "").trim();
    const project = String(row.project_name ?? "").trim();
    const funnel = String(row.funnel_name ?? "").trim();
    const isEmpty = (value: string) => value === "" || value === "—";
    return !(isEmpty(client) && isEmpty(project) && isEmpty(funnel));
  });
}
function MetricCard({ label, value, helper, percent, raw }: { label: string; value: unknown; helper?: string; percent?: boolean; raw?: boolean }) { const formatted = raw ? String(value ?? "—") : formatMetric(value as Row[string], Boolean(percent)); return <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold num">{formatted}</p>{helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}</div>; }
function safePct(num: number, den: number) { if (!den) return null; return (num / den) * 100; }
function parseDate(value: unknown): Date | null { if (!value) return null; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? null : d; }
function toNumber(value: unknown): number | null { if (typeof value === "number" && Number.isFinite(value)) return value; if (typeof value === "string" && value.trim() !== "") { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; } return null; }
function formatMetric(value: Row[string], isPercent: boolean) { const n = toNumber(value); if (n == null) return "—"; return isPercent ? `${fmtNum(n)}%` : fmtNum(n); }
function money(value: unknown, currency: "USD" | "UAH", lang: "uk" | "en") { const n = toNumber(value); if (n == null) return "—"; return new Intl.NumberFormat(lang === "uk" ? "uk-UA" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n); }
function getStageLabel(stage: string, fallback: unknown, lang: "uk" | "en") { const mapped: Record<string, { uk: string; en: string }> = { registration: { uk: "Реєстрації", en: "Registrations" }, questionnaire: { uk: "Анкети", en: "Questionnaires" }, application: { uk: "Заявки", en: "Applications" }, booking: { uk: "Бронювання", en: "Bookings" }, sale: { uk: "Платежі", en: "Payments" }, payment: { uk: "Платежі", en: "Payments" } }; const known = mapped[stage]; if (known) return known[lang]; return String(fallback ?? "—"); }
function formatShortDate(value: unknown) { if (value == null || String(value).trim() === "") return "—"; const raw = String(value); const parsed = new Date(raw); if (Number.isNaN(parsed.getTime())) return raw; const day = String(parsed.getUTCDate()).padStart(2, "0"); const month = String(parsed.getUTCMonth() + 1).padStart(2, "0"); const year = parsed.getUTCFullYear(); const currentYear = new Date().getUTCFullYear(); return year === currentYear ? `${day}.${month}` : `${day}.${month}.${year}`; }
function Empty({ text }: { text: string }) { return <p className="rounded border p-3 text-sm text-muted-foreground">{text}</p>; }
function FriendlyTable({ rows, columns, empty }: { rows: Row[]; columns: { key: string; label: string }[]; empty: string }) { if (!rows.length) return <Empty text={empty} />; return <Table><TableHeader><TableRow>{columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((row, idx) => <TableRow key={idx}>{columns.map((c) => <TableCell key={c.key}>{String(row[c.key] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table>; }
