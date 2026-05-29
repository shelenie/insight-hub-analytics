import { type ReactNode, useEffect, useMemo, useState } from "react";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtNum } from "@/lib/format";
import { filterPlaceholderRows } from "@/lib/demoFilters";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useDateFilter } from "@/filters/DateContext";
import { usePreferences } from "@/preferences/PreferencesProvider";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

type Row = Record<string, string | number | boolean | null>;
type Delta = { text: string; tone: "positive" | "negative" | "neutral" };
type FunnelStage = "registration" | "questionnaire" | "application" | "booking" | "payment";
type ContactLevelFunnelRow = { key: string; label: string; fromCount: number; reachedCount: number; droppedCount: number; conversionRate: number | null };

type ContactStageDates = Record<FunnelStage, Map<string, string>>;

const STAGE_ORDER = ["registration", "questionnaire", "application", "booking", "sale", "payment"];
const SELECTED_ROW_CLASS = "cursor-pointer bg-primary/10 hover:bg-primary/15 [&>td:first-child]:border-l-4 [&>td:first-child]:border-primary";
const HOVER_ROW_CLASS = "cursor-pointer hover:bg-muted/50";
const TABLE_HEAD_CLASS = "whitespace-nowrap px-3 text-left text-xs uppercase tracking-wide";
const TABLE_NUM_HEAD_CLASS = "whitespace-nowrap px-3 text-right text-xs uppercase tracking-wide";
const TABLE_CENTER_HEAD_CLASS = "whitespace-nowrap px-3 text-center text-xs uppercase tracking-wide";
const TABLE_CELL_CLASS = "whitespace-nowrap px-3 text-sm";
const TABLE_NUM_CLASS = "whitespace-nowrap px-3 text-right text-sm num";
const TABLE_CENTER_CLASS = "whitespace-nowrap px-3 text-center text-sm num";

export default function Conversions() {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const date = useDateFilter();
  const { compareMode, compareDisplay } = usePreferences();

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

  const comparisonRange = useMemo(() => {
    if (compareMode === "none") return null;
    if (compareMode === "yesterday" && date.mode !== "exact") return null;
    const days = differenceInCalendarDays(effectiveTo, effectiveFrom) + 1;
    const comparisonToDate = addDays(effectiveFrom, -1);
    const comparisonFromDate = addDays(comparisonToDate, -(days - 1));
    return { from: format(comparisonFromDate, "yyyy-MM-dd"), to: format(comparisonToDate, "yyyy-MM-dd") };
  }, [compareMode, date.mode, effectiveFrom, effectiveTo]);

  const dataQuery = useQuery({
    queryKey: ["conversions-page", WORKSPACE_ID, fromIso, toIso, date.mode, date.preset],
    enabled: Boolean(session),
    queryFn: async () => {
      const [stageEvents, paymentRecords, paymentLines, onboarding, bindings] = await Promise.all([
        readViewPaged("v_unified_conversions_stage_events", true, fromIso, toIso, ["metric_date", "stage", "source_table", "source_row_id", "contact_key", "phone_key"]),
        readViewPaged("v_unified_conversions_payment_records", true, fromIso, toIso, ["metric_date", "payment_record_id", "customer_key", "phone_key"]),
        readViewPaged("v_unified_conversions_payment_lines", true, fromIso, toIso, ["metric_date", "payment_record_id", "payment_line_type", "customer_key", "phone_key"]),
        readView("v_onboarding_hierarchy", true),
        readView("v_project_data_bindings", true),
      ]);
      return { stageEvents, paymentRecords, paymentLines, onboarding, bindings };
    },
  });

  const comparisonQuery = useQuery({
    queryKey: ["conversions-comparison", WORKSPACE_ID, compareMode, comparisonRange?.from, comparisonRange?.to],
    enabled: Boolean(session) && compareMode !== "none" && Boolean(comparisonRange),
    queryFn: async () => {
      const [stageEvents, paymentRecords, paymentLines] = await Promise.all([
        readViewPaged("v_unified_conversions_stage_events", true, comparisonRange!.from, comparisonRange!.to, ["metric_date", "stage", "source_table", "source_row_id", "contact_key", "phone_key"]),
        readViewPaged("v_unified_conversions_payment_records", true, comparisonRange!.from, comparisonRange!.to, ["metric_date", "payment_record_id", "customer_key", "phone_key"]),
        readViewPaged("v_unified_conversions_payment_lines", true, comparisonRange!.from, comparisonRange!.to, ["metric_date", "payment_record_id", "payment_line_type", "customer_key", "phone_key"]),
      ]);
      return { stageEvents, paymentRecords, paymentLines };
    },
  });

  const aggregates = useMemo(() => computeAggregates(dataQuery.data?.stageEvents ?? [], dataQuery.data?.paymentRecords ?? [], dataQuery.data?.paymentLines ?? []), [dataQuery.data]);
  const comparisonAggregates = useMemo(() => computeAggregates(comparisonQuery.data?.stageEvents ?? [], comparisonQuery.data?.paymentRecords ?? [], comparisonQuery.data?.paymentLines ?? []), [comparisonQuery.data]);
  const contactLevelFunnel = useMemo(() => computeContactLevelFunnel(dataQuery.data?.stageEvents ?? [], dataQuery.data?.paymentRecords ?? [], lang), [dataQuery.data, lang]);
  const filteredOnboardingRows = useMemo(() => filterPlaceholderRows(dataQuery.data?.onboarding as Record<string, unknown>[] | undefined) as Row[], [dataQuery.data?.onboarding]);
  const meaningfulOnboardingRows = useMemo(() => filterMeaningfulContextRows(filteredOnboardingRows), [filteredOnboardingRows]);
  const filteredBindingsRows = useMemo(() => filterPlaceholderRows(dataQuery.data?.bindings as Record<string, unknown>[] | undefined) as Row[], [dataQuery.data?.bindings]);

  const isRefreshing = boundsQuery.isRefetching || dataQuery.isRefetching || comparisonQuery.isRefetching;
  const hasData = aggregates.stageRows.length > 0 || aggregates.paymentRecords > 0 || aggregates.paymentLinesCount > 0;
  const hasError = dataQuery.isError || boundsQuery.isError;
  const showDeltas = compareMode !== "none" && Boolean(comparisonRange) && !comparisonQuery.isLoading && !comparisonQuery.isError;
  const handleRefresh = () => {
    void boundsQuery.refetch();
    void dataQuery.refetch();
    if (compareMode !== "none" && comparisonRange) void comparisonQuery.refetch();
  };

  return <DashboardLayout title={t("funnelTitle")} subtitle={t("funnelSubtitle")}>
    <div className="space-y-4 overflow-x-hidden">
      <FilterBar showProject={false} showGroup={false} freshness={{ source: t("conversionsDataLabel").replace(":", ""), status: "fresh", lastSync: "live" }} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
      {!session ? <Empty text={t("conversionsSignIn")} /> : (dataQuery.isLoading || boundsQuery.isLoading) ? <Empty text={t("conversionsLoading")} /> : null}
      {session && hasError ? <Empty text={t("conversionsLoadError")} /> : null}
      {!dataQuery.isLoading && !boundsQuery.isLoading && session && !hasError && !hasData ? <Empty text={t("conversionsNoDataSelectedPeriod")} /> : null}

      {hasData && !hasError ? <>
        <SectionCard title={t("conversionsStageSection")} description={t("conversionsStageSectionDesc")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <MetricCard label={t("conversionsRegistrations")} value={aggregates.registrations} delta={buildDelta(aggregates.registrations, comparisonAggregates.registrations, compareDisplay, showDeltas)} helper={`${t("conversionsUniqueContacts")}: ${fmtNum(aggregates.stageUnique.registration)}`} />
            <MetricCard label={t("conversionsQuestionnaires")} value={aggregates.questionnaires} delta={buildDelta(aggregates.questionnaires, comparisonAggregates.questionnaires, compareDisplay, showDeltas)} helper={`${t("conversionsUniqueContacts")}: ${fmtNum(aggregates.stageUnique.questionnaire)}`} />
            <MetricCard label={t("conversionsApplications")} value={aggregates.applications} delta={buildDelta(aggregates.applications, comparisonAggregates.applications, compareDisplay, showDeltas)} helper={`${t("conversionsUniqueContacts")}: ${fmtNum(aggregates.stageUnique.application)}`} />
            <MetricCard label={t("conversionsBookings")} value={aggregates.bookings} delta={buildDelta(aggregates.bookings, comparisonAggregates.bookings, compareDisplay, showDeltas)} helper={`${t("conversionsUniqueContacts")}: ${fmtNum(aggregates.stageUnique.booking)}`} />
          </div>
        </SectionCard>

        <SectionCard title={t("conversionsBetweenStages")} description={t("conversionsBetweenStagesDesc")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
            <MetricCard label={t("conversionsRegToQuestionnaire")} value={safePct(aggregates.questionnaires, aggregates.registrations)} percent delta={buildDelta(safePct(aggregates.questionnaires, aggregates.registrations), safePct(comparisonAggregates.questionnaires, comparisonAggregates.registrations), compareDisplay, showDeltas, true)} helper={<RatioHelper counts={`${fmtNum(aggregates.questionnaires)} ${t("conversionsQuestionnairesLower")} / ${fmtNum(aggregates.registrations)} ${t("conversionsRegistrationsLower")}`} ratio={safePct(aggregates.questionnaires, aggregates.registrations)} lang={lang} />} align />
            <MetricCard label={t("conversionsQuestionnaireToApplication")} value={safePct(aggregates.applications, aggregates.questionnaires)} percent delta={buildDelta(safePct(aggregates.applications, aggregates.questionnaires), safePct(comparisonAggregates.applications, comparisonAggregates.questionnaires), compareDisplay, showDeltas, true)} helper={<RatioHelper counts={`${fmtNum(aggregates.applications)} ${t("conversionsApplicationsLower")} / ${fmtNum(aggregates.questionnaires)} ${t("conversionsQuestionnairesLower")}`} ratio={safePct(aggregates.applications, aggregates.questionnaires)} lang={lang} />} align />
            <MetricCard label={t("conversionsApplicationToBooking")} value={safePct(aggregates.bookings, aggregates.applications)} percent delta={buildDelta(safePct(aggregates.bookings, aggregates.applications), safePct(comparisonAggregates.bookings, comparisonAggregates.applications), compareDisplay, showDeltas, true)} helper={<RatioHelper counts={`${fmtNum(aggregates.bookings)} ${t("conversionsBookingsLower")} / ${fmtNum(aggregates.applications)} ${t("conversionsApplicationsLower")}`} ratio={safePct(aggregates.bookings, aggregates.applications)} lang={lang} />} align />
            <MetricCard label={t("conversionsRegToBooking")} value={safePct(aggregates.bookings, aggregates.registrations)} percent delta={buildDelta(safePct(aggregates.bookings, aggregates.registrations), safePct(comparisonAggregates.bookings, comparisonAggregates.registrations), compareDisplay, showDeltas, true)} helper={<RatioHelper counts={`${fmtNum(aggregates.bookings)} ${t("conversionsBookingsLower")} / ${fmtNum(aggregates.registrations)} ${t("conversionsRegistrationsLower")}`} ratio={safePct(aggregates.bookings, aggregates.registrations)} lang={lang} />} align />
            <MetricCard label={t("conversionsRegToPayment")} value={safePct(aggregates.paymentRecords, aggregates.registrations)} percent delta={buildDelta(safePct(aggregates.paymentRecords, aggregates.registrations), safePct(comparisonAggregates.paymentRecords, comparisonAggregates.registrations), compareDisplay, showDeltas, true)} helper={<RatioHelper counts={`${fmtNum(aggregates.paymentRecords)} ${t("conversionsPaymentsLower")} / ${fmtNum(aggregates.registrations)} ${t("conversionsRegistrationsLower")}`} ratio={safePct(aggregates.paymentRecords, aggregates.registrations)} lang={lang} />} align />
          </div>
          <details className="mt-3 rounded border"><summary className="cursor-pointer px-3 py-2 text-xs font-medium">{t("conversionsStageMeaningTitle")}</summary><div className="space-y-1 px-3 pb-3 text-xs text-muted-foreground"><p>{t("conversionsStageMeaningRegistrations")}</p><p>{t("conversionsStageMeaningQuestionnaires")}</p><p>{t("conversionsStageMeaningApplications")}</p><p>{t("conversionsStageMeaningBookings")}</p><p>{t("conversionsStageMeaningPayments")}</p></div></details>
        </SectionCard>

        <ContactLevelFunnelTable rows={contactLevelFunnel} t={t} lang={lang} />

        <SectionCard title={lang === "uk" ? "Платежі та суми" : "Payments and totals"} description={t("conversionsPaymentsSectionDesc")}>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-5">
            <MetricCard label={t("conversionsPaymentRecords")} value={aggregates.paymentRecords} delta={buildDelta(aggregates.paymentRecords, comparisonAggregates.paymentRecords, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsUniquePayers")} value={aggregates.uniquePayers} delta={buildDelta(aggregates.uniquePayers, comparisonAggregates.uniquePayers, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsActivePayments")} value={aggregates.activePaymentRows} delta={buildDelta(aggregates.activePaymentRows, comparisonAggregates.activePaymentRows, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsFullPayments")} value={aggregates.fullPaymentRows} delta={buildDelta(aggregates.fullPaymentRows, comparisonAggregates.fullPaymentRows, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsInstallments")} value={aggregates.installmentRows} delta={buildDelta(aggregates.installmentRows, comparisonAggregates.installmentRows, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsDeposits")} value={aggregates.depositRows} delta={buildDelta(aggregates.depositRows, comparisonAggregates.depositRows, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsAdditionalPayments")} value={aggregates.additionalPaymentRows} delta={buildDelta(aggregates.additionalPaymentRows, comparisonAggregates.additionalPaymentRows, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsRefunds")} value={aggregates.refundPaymentRows} delta={buildDelta(aggregates.refundPaymentRows, comparisonAggregates.refundPaymentRows, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsNeedsReview")} value={aggregates.needsReviewPaymentRows} delta={buildDelta(aggregates.needsReviewPaymentRows, comparisonAggregates.needsReviewPaymentRows, compareDisplay, showDeltas)} />
          </div>
          <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard label={t("conversionsCollectedUsd")} value={money(aggregates.collectedUsdTotal, "USD", lang)} raw delta={buildMoneyDelta(aggregates.collectedUsdTotal, comparisonAggregates.collectedUsdTotal, "USD", lang, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsCollectedUah")} value={money(aggregates.collectedUahTotal, "UAH", lang)} raw delta={buildMoneyDelta(aggregates.collectedUahTotal, comparisonAggregates.collectedUahTotal, "UAH", lang, compareDisplay, showDeltas)} />
            <MetricCard label={lang === "uk" ? "Несплачений залишок" : "Unpaid balance"} value={money(aggregates.debtTotal, "USD", lang)} raw delta={buildMoneyDelta(aggregates.debtTotal, comparisonAggregates.debtTotal, "USD", lang, compareDisplay, showDeltas)} helper={lang === "uk" ? "Ще не доплачено за продажами у вибраному періоді." : "Still unpaid for sales in the selected period."} />
            <MetricCard label={t("conversionsTariffTotal")} value={money(aggregates.tariffTotal, "USD", lang)} raw delta={buildMoneyDelta(aggregates.tariffTotal, comparisonAggregates.tariffTotal, "USD", lang, compareDisplay, showDeltas)} />
          </div>
        </SectionCard>

        {aggregates.paymentCategoryRows.length > 0 ? <PaymentTypeTable rows={aggregates.paymentCategoryRows} t={t} /> : null}

        <SectionCard title={t("conversionsMatchingTitle")} description={t("conversionsMatchingSubtitle")}>
          <p className="mb-3 text-xs text-muted-foreground">{t("conversionsMatchingExplain")}</p>
          <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
            <MetricCard label={t("conversionsBookingPhones")} value={aggregates.bookingPhones} delta={buildDelta(aggregates.bookingPhones, comparisonAggregates.bookingPhones, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsPaymentPhones")} value={aggregates.paymentPhones} delta={buildDelta(aggregates.paymentPhones, comparisonAggregates.paymentPhones, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsMatchedPhones")} value={aggregates.matchedPhones} delta={buildDelta(aggregates.matchedPhones, comparisonAggregates.matchedPhones, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsBookingToPaymentMatch")} value={safePct(aggregates.matchedPhones, aggregates.bookingPhones)} percent delta={buildDelta(safePct(aggregates.matchedPhones, aggregates.bookingPhones), safePct(comparisonAggregates.matchedPhones, comparisonAggregates.bookingPhones), compareDisplay, showDeltas, true)} />
            <MetricCard label={t("conversionsPaymentsWithoutBooking")} value={aggregates.paymentsWithoutBooking} delta={buildDelta(aggregates.paymentsWithoutBooking, comparisonAggregates.paymentsWithoutBooking, compareDisplay, showDeltas)} />
            <MetricCard label={t("conversionsBookingsWithoutPayment")} value={aggregates.bookingsWithoutPayment} delta={buildDelta(aggregates.bookingsWithoutPayment, comparisonAggregates.bookingsWithoutPayment, compareDisplay, showDeltas)} />
          </div>
          <div className="mt-3 max-w-sm rounded border p-3"><p className="text-xs font-medium">{t("conversionsRawPaymentsBookingsRatio")}</p><p className="mt-1 text-2xl font-semibold leading-none num">{aggregates.bookings > 0 ? `${(aggregates.paymentRecords / aggregates.bookings).toFixed(1)}×` : "—"}</p><p className="mt-1 text-xs text-muted-foreground">{aggregates.bookings > 0 ? `${fmtNum(aggregates.paymentRecords)} ${t("conversionsPaymentsLower")} / ${fmtNum(aggregates.bookings)} ${t("conversionsBookingsLower")}` : t("conversionsNoBookingsInPeriod")}</p><p className="mt-2 text-xs text-muted-foreground">{t("conversionsRatioWarning")}</p></div>
        </SectionCard>

        <StageTable rows={aggregates.stageRows} t={t} lang={lang} />
        {meaningfulOnboardingRows.length > 0 ? <details className="rounded border"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("conversionsExtraContext")}</summary><SectionCard title={t("conversionsExtraContext")} noPadding><FriendlyTable rows={meaningfulOnboardingRows} columns={[{ key: "client_name", label: t("conversionsContextClient") }, { key: "project_name", label: t("conversionsContextProject") }, { key: "funnel_name", label: t("conversionsContextFunnel") }, { key: "status", label: t("conversionsContextStatus") }]} empty={t("conversionsViewUnavailable")} /></SectionCard></details> : null}
        {filteredBindingsRows.length > 0 ? <details className="rounded border"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("conversionsExtraBindings")}</summary><SectionCard title={t("conversionsExtraBindings")} noPadding><FriendlyTable rows={filteredBindingsRows} columns={[{ key: "project_name", label: "project_name" }, { key: "source_name", label: "source_name" }, { key: "mapping_status", label: "mapping_status" }, { key: "binding_status", label: "binding_status" }, { key: "updated_at", label: "updated_at" }]} empty={t("conversionsViewUnavailable")} /></SectionCard></details> : null}
      </> : null}
    </div>
  </DashboardLayout>;
}

function ContactLevelFunnelTable({ rows, t, lang }: { rows: ContactLevelFunnelRow[]; t: (key: string) => string; lang: "uk" | "en" }) {
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  const helper = lang === "uk"
    ? [
      "Рахується по конкретних contact_key / phone_key у вибраному періоді.",
      "Наступний етап зараховується тільки якщо він стався в той самий день або після попереднього.",
    ]
    : [
      "Calculated by specific contact_key / phone_key within the selected period.",
      "The next stage is counted only if it happened on the same day or after the previous stage.",
    ];
  const dataQualityNote = lang === "uk"
    ? "Низькі значення можуть означати, що contact_key / phone_key не збігаються між джерелами або частина шляху контакту була поза вибраним періодом."
    : "Low values may mean contact_key / phone_key do not match across sources, or part of the contact path happened outside the selected period.";

  return <SectionCard title={t("conversionsContactFunnelTitle")} description={t("conversionsContactFunnelDesc")} noPadding><div className="space-y-2 px-4 pb-4 pt-2"><div className="space-y-1 px-3 text-xs leading-snug text-muted-foreground">{helper.map((line) => <p key={line}>{line}</p>)}</div><div className="overflow-hidden rounded-md border"><Table className="w-full table-fixed"><colgroup><col /><col style={{ width: 120 }} /><col style={{ width: 120 }} /><col style={{ width: 110 }} /><col style={{ width: 110 }} /></colgroup><TableHeader><TableRow><TableHead className={TABLE_HEAD_CLASS}>{t("conversionsContactFunnelThTransition")}</TableHead><TableHead className={TABLE_CENTER_HEAD_CLASS}>{t("conversionsContactFunnelThAtStage")}</TableHead><TableHead className={TABLE_CENTER_HEAD_CLASS}>{t("conversionsContactFunnelThReached")}</TableHead><TableHead className={TABLE_CENTER_HEAD_CLASS}>{t("conversionsContactFunnelThDropped")}</TableHead><TableHead className={TABLE_CENTER_HEAD_CLASS}>{t("conversionsContactFunnelThConversion")}</TableHead></TableRow></TableHeader><TableBody>{rows.map((row) => { const selected = selectedRowKey === row.key; return <TableRow key={row.key} onClick={() => setSelectedRowKey((current) => current === row.key ? null : row.key)} className={selected ? SELECTED_ROW_CLASS : HOVER_ROW_CLASS}><TableCell className={TABLE_CELL_CLASS}>{row.label}</TableCell><TableCell className={TABLE_CENTER_CLASS}>{fmtNum(row.fromCount)}</TableCell><TableCell className={TABLE_CENTER_CLASS}>{fmtNum(row.reachedCount)}</TableCell><TableCell className={TABLE_CENTER_CLASS}>{fmtNum(row.droppedCount)}</TableCell><TableCell className={TABLE_CENTER_CLASS}>{row.conversionRate === null ? "—" : `${fmtNum(row.conversionRate)}%`}</TableCell></TableRow>; })}</TableBody></Table></div><p className="rounded-md border bg-muted/30 px-3 py-2 text-xs leading-snug text-muted-foreground">{dataQualityNote}</p></div></SectionCard>;
}

function PaymentTypeTable({ rows, t }: { rows: Array<{ category: string; total_records: number; included_records: number; refund_records: number; needs_review_records: number }>; t: (key: string) => string }) {
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  return <SectionCard title={t("conversionsPaymentTypeStructureTitle")} description={t("conversionsPaymentTypeStructureDesc")} noPadding><p className="px-4 pb-1 pt-2 text-xs text-muted-foreground">{t("conversionsPaymentTypeStructureHelper")}</p><Table className="w-full table-fixed"><colgroup><col /><col style={{ width: 86 }} /><col style={{ width: 104 }} /><col style={{ width: 86 }} /><col style={{ width: 110 }} /></colgroup><TableHeader><TableRow><TableHead className={TABLE_HEAD_CLASS}>{t("conversionsPaymentTypeThType")}</TableHead><TableHead className={TABLE_NUM_HEAD_CLASS}>{t("conversionsPaymentTypeThTotal")}</TableHead><TableHead className={TABLE_NUM_HEAD_CLASS}>{t("conversionsPaymentTypeThIncluded")}</TableHead><TableHead className={TABLE_NUM_HEAD_CLASS}>{t("conversionsPaymentTypeThRefund")}</TableHead><TableHead className={TABLE_NUM_HEAD_CLASS}>{t("conversionsPaymentTypeThNeedsReview")}</TableHead></TableRow></TableHeader><TableBody>{rows.map((row, idx) => { const labelKey = getPaymentCategoryLabelKey(row.category); const rowKey = `${row.category}-${idx}`; const selected = selectedRowKey === rowKey; return <TableRow key={rowKey} onClick={() => setSelectedRowKey((current) => current === rowKey ? null : rowKey)} className={selected ? SELECTED_ROW_CLASS : HOVER_ROW_CLASS}><TableCell className={TABLE_CELL_CLASS}>{labelKey ? t(labelKey) : row.category}</TableCell><TableCell className={TABLE_NUM_CLASS}>{fmtNum(row.total_records)}</TableCell><TableCell className={TABLE_NUM_CLASS}>{fmtNum(row.included_records)}</TableCell><TableCell className={TABLE_NUM_CLASS}>{fmtNum(row.refund_records)}</TableCell><TableCell className={TABLE_NUM_CLASS}>{fmtNum(row.needs_review_records)}</TableCell></TableRow>; })}</TableBody></Table></SectionCard>;
}

function StageTable({ rows, t, lang }: { rows: Row[]; t: (key: string) => string; lang: "uk" | "en" }) {
  const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null);
  return <SectionCard title={t("conversionsStageTableTitle")} description={t("conversionsStageTableDesc")} noPadding><Table className="w-full table-fixed"><colgroup><col /><col style={{ width: 96 }} /><col style={{ width: 178 }} /><col style={{ width: 148 }} /><col style={{ width: 148 }} /></colgroup><TableHeader><TableRow><TableHead className={TABLE_HEAD_CLASS}>{t("conversionsThStage")}</TableHead><TableHead className={TABLE_CENTER_HEAD_CLASS}>{t("conversionsThEvents")}</TableHead><TableHead className={TABLE_CENTER_HEAD_CLASS}>{t("conversionsThUniqueContacts")}</TableHead><TableHead className={TABLE_CENTER_HEAD_CLASS}>{t("conversionsThFirstDate")}</TableHead><TableHead className={TABLE_CENTER_HEAD_CLASS}>{t("conversionsThLastDate")}</TableHead></TableRow></TableHeader><TableBody>{rows.map((row, idx) => { const rowKey = `${String(row.stage ?? "stage")}-${idx}`; const selected = selectedRowKey === rowKey; return <TableRow key={rowKey} onClick={() => setSelectedRowKey((current) => current === rowKey ? null : rowKey)} className={selected ? SELECTED_ROW_CLASS : HOVER_ROW_CLASS}><TableCell className={TABLE_CELL_CLASS}>{getStageLabel(String(row.stage ?? "").toLowerCase(), row.stage_label, lang)}</TableCell><TableCell className={TABLE_CENTER_CLASS}>{fmtNum(Number(row.events_count ?? 0))}</TableCell><TableCell className={TABLE_CENTER_CLASS}>{fmtNum(Number(row.unique_contacts ?? 0))}</TableCell><TableCell className={TABLE_CENTER_CLASS}>{formatShortDate(row.first_date)}</TableCell><TableCell className={TABLE_CENTER_CLASS}>{formatShortDate(row.last_date)}</TableCell></TableRow>; })}</TableBody></Table></SectionCard>;
}

function computeAggregates(stageEvents: Row[], paymentRecordsRows: Row[], paymentLines: Row[]) {
  const byStage = new Map<string, { count: number; contacts: Set<string>; first: string | null; last: string | null }>();
  const bookingPhones = new Set<string>();
  for (const row of stageEvents) {
    const stage = String(row.stage ?? "").toLowerCase();
    if (!stage) continue;
    const item = byStage.get(stage) ?? { count: 0, contacts: new Set<string>(), first: null, last: null };
    item.count += 1;
    const contact = String(row.contact_key ?? "");
    if (contact) item.contacts.add(contact);
    const metricDate = String(row.metric_date ?? "");
    if (metricDate) {
      if (!item.first || metricDate < item.first) item.first = metricDate;
      if (!item.last || metricDate > item.last) item.last = metricDate;
    }
    if (stage === "booking") {
      const phone = String(row.phone_key ?? "");
      if (phone) bookingPhones.add(phone);
    }
    byStage.set(stage, item);
  }

  const goodPayments = isGoodPaymentRecord;
  const paymentPhones = new Set<string>();
  const payerSet = new Set<string>();
  let activePaymentRows = 0, refundPaymentRows = 0, needsReviewPaymentRows = 0, fullPaymentRows = 0, installmentRows = 0, depositRows = 0, additionalPaymentRows = 0, debtTotal = 0, tariffTotal = 0;
  const paymentCategoryCounts = new Map<string, { total_records: number; included_records: number; refund_records: number; needs_review_records: number }>();

  for (const row of paymentRecordsRows) {
    const status = String(row.sale_status_norm ?? "").toLowerCase();
    if (status === "active") activePaymentRows++;
    if (status === "refund") refundPaymentRows++;
    if (status === "needs_review") needsReviewPaymentRows++;
    const paymentCategory = String(row.payment_category ?? "").toLowerCase() || "unknown";
    const categoryStats = paymentCategoryCounts.get(paymentCategory) ?? { total_records: 0, included_records: 0, refund_records: 0, needs_review_records: 0 };
    categoryStats.total_records += 1;
    if (status === "refund") categoryStats.refund_records += 1;
    else if (status === "needs_review") categoryStats.needs_review_records += 1;
    else categoryStats.included_records += 1;
    paymentCategoryCounts.set(paymentCategory, categoryStats);
    const customer = String(row.customer_key ?? "");
    if (customer) payerSet.add(customer);
    if (goodPayments(row)) {
      const category = String(row.payment_category ?? "").toLowerCase();
      if (category === "full_payment") fullPaymentRows++;
      if (category === "installment") installmentRows++;
      if (category === "deposit") depositRows++;
      if (category === "additional_payment") additionalPaymentRows++;
      debtTotal += toNumber(row.debt_amount) ?? 0;
      tariffTotal += toNumber(row.tariff_price) ?? 0;
      const phone = String(row.phone_key ?? "");
      if (phone) paymentPhones.add(phone);
    }
  }

  let collectedUsdTotal = 0;
  let collectedUahTotal = 0;
  for (const row of paymentLines) {
    if (goodPayments(row)) {
      collectedUsdTotal += toNumber(row.amount_usd) ?? 0;
      collectedUahTotal += toNumber(row.amount_uah) ?? 0;
    }
  }

  const matchedPhones = [...bookingPhones].filter((phone) => paymentPhones.has(phone)).length;
  const stageRows = [...byStage.entries()].map(([stage, value]) => ({ stage, stage_label: stage, events_count: value.count, unique_contacts: value.contacts.size, first_date: value.first, last_date: value.last })).sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage));
  const paymentCategoryRank: Record<string, number> = { full_payment: 1, installment: 2, deposit: 3, additional_payment: 4, unknown: 5, other: 6 };
  const paymentCategoryRows = [...paymentCategoryCounts.entries()].map(([category, counts]) => ({ category, ...counts })).sort((a, b) => (paymentCategoryRank[a.category] ?? 100) - (paymentCategoryRank[b.category] ?? 100) || a.category.localeCompare(b.category));

  return { stageRows, paymentLinesCount: paymentLines.length, registrations: byStage.get("registration")?.count ?? 0, questionnaires: byStage.get("questionnaire")?.count ?? 0, applications: byStage.get("application")?.count ?? 0, bookings: byStage.get("booking")?.count ?? 0, stageUnique: { registration: byStage.get("registration")?.contacts.size ?? 0, questionnaire: byStage.get("questionnaire")?.contacts.size ?? 0, application: byStage.get("application")?.contacts.size ?? 0, booking: byStage.get("booking")?.contacts.size ?? 0 }, paymentRecords: paymentRecordsRows.length, uniquePayers: payerSet.size, activePaymentRows, refundPaymentRows, needsReviewPaymentRows, fullPaymentRows, installmentRows, depositRows, additionalPaymentRows, debtTotal, tariffTotal, paymentCategoryRows, collectedUsdTotal, collectedUahTotal, bookingPhones: bookingPhones.size, paymentPhones: paymentPhones.size, matchedPhones, paymentsWithoutBooking: paymentPhones.size - matchedPhones, bookingsWithoutPayment: bookingPhones.size - matchedPhones };
}

function computeContactLevelFunnel(stageEvents: Row[], paymentRecordsRows: Row[], lang: "uk" | "en"): ContactLevelFunnelRow[] {
  const stageDates: ContactStageDates = { registration: new Map(), questionnaire: new Map(), application: new Map(), booking: new Map(), payment: new Map() };

  for (const row of stageEvents) {
    const stage = String(row.stage ?? "").toLowerCase() as FunnelStage;
    if (stage !== "registration" && stage !== "questionnaire" && stage !== "application" && stage !== "booking") continue;
    const contactId = getStableContactId(row);
    const metricDate = normalizeMetricDate(row.metric_date);
    if (contactId && metricDate) setEarliestStageDate(stageDates[stage], contactId, metricDate);
  }

  for (const row of paymentRecordsRows) {
    if (!isGoodPaymentRecord(row)) continue;
    const contactId = getPaymentContactId(row);
    const metricDate = normalizeMetricDate(row.metric_date);
    if (contactId && metricDate) setEarliestStageDate(stageDates.payment, contactId, metricDate);
  }

  const labels = {
    registration_to_questionnaire: { uk: "Реєстрація → Анкета", en: "Registration → Questionnaire" },
    questionnaire_to_application: { uk: "Анкета → Заявка", en: "Questionnaire → Application" },
    application_to_booking: { uk: "Заявка → Бронювання", en: "Application → Booking" },
    booking_to_payment: { uk: "Бронювання → Платіж", en: "Booking → Payment" },
    registration_to_payment: { uk: "Реєстрація → Платіж", en: "Registration → Payment" },
  };
  const transitions = [
    { key: "registration_to_questionnaire", from: stageDates.registration, to: stageDates.questionnaire },
    { key: "questionnaire_to_application", from: stageDates.questionnaire, to: stageDates.application },
    { key: "application_to_booking", from: stageDates.application, to: stageDates.booking },
    { key: "booking_to_payment", from: stageDates.booking, to: stageDates.payment },
    { key: "registration_to_payment", from: stageDates.registration, to: stageDates.payment },
  ] as const;

  return transitions.map(({ key, from, to }) => {
    const fromCount = from.size;
    const reachedCount = [...from.entries()].filter(([contactId, fromDate]) => {
      const toDate = to.get(contactId);
      return Boolean(toDate && toDate >= fromDate);
    }).length;
    return { key, label: labels[key][lang], fromCount, reachedCount, droppedCount: fromCount - reachedCount, conversionRate: fromCount === 0 ? null : (reachedCount / fromCount) * 100 };
  });
}

function setEarliestStageDate(stage: Map<string, string>, contactId: string, metricDate: string) {
  const current = stage.get(contactId);
  if (!current || metricDate < current) stage.set(contactId, metricDate);
}

function normalizeMetricDate(value: Row[string]) {
  if (!value) return null;
  const raw = String(value).trim();
  if (!raw) return null;
  const parsed = new Date(raw);
  if (!Number.isNaN(parsed.getTime())) return format(parsed, "yyyy-MM-dd");
  return raw.slice(0, 10);
}

function getStableContactId(row: Row) { return firstNonEmpty(row.contact_key, row.customer_key, row.phone_key); }
function getPaymentContactId(row: Row) { return firstNonEmpty(row.customer_key, row.phone_key); }
function firstNonEmpty(...values: Array<Row[string]>) { for (const value of values) { const normalized = String(value ?? "").trim(); if (normalized) return normalized; } return null; }
function isGoodPaymentRecord(row: Row) { return !["refund", "needs_review"].includes(String(row.sale_status_norm ?? "").toLowerCase()); }

async function readView(viewName: string, scopedByWorkspace: boolean, from?: string, to?: string): Promise<Row[]> { let query = supabase.from(viewName).select("*"); if (scopedByWorkspace) query = query.eq("workspace_id", WORKSPACE_ID); if (from && to) query = query.gte("metric_date", from).lte("metric_date", to); const res = await query; if (res.error) throw new Error(`[Conversions][readView] Failed to read ${viewName}: ${res.error.message}`); return (res.data ?? []) as Row[]; }
async function readViewPaged(viewName: string, scopedByWorkspace: boolean, from?: string, to?: string, orderBy: string[] = []): Promise<Row[]> { const pageSize = 1000; const maxRows = 50000; const rows: Row[] = []; for (let fromIndex = 0; fromIndex < maxRows; fromIndex += pageSize) { const toIndex = fromIndex + pageSize - 1; let query = supabase.from(viewName).select("*"); if (scopedByWorkspace) query = query.eq("workspace_id", WORKSPACE_ID); if (from && to) query = query.gte("metric_date", from).lte("metric_date", to); for (const orderColumn of orderBy) query = query.order(orderColumn, { ascending: true }); const res = await query.range(fromIndex, toIndex); if (res.error) throw new Error(`[Conversions][readViewPaged] Failed to read ${viewName} rows ${fromIndex}-${toIndex}: ${res.error.message}`); const page = (res.data ?? []) as Row[]; rows.push(...page); if (page.length < pageSize) return rows; } console.warn(`[Conversions] Reached max rows cap (${maxRows}) for ${viewName}. Results may be truncated.`); return rows; }
function filterMeaningfulContextRows(rows: Row[]) { return rows.filter((row) => { const client = String(row.client_name ?? "").trim(); const project = String(row.project_name ?? "").trim(); const funnel = String(row.funnel_name ?? "").trim(); const isEmpty = (value: string) => value === "" || value === "—"; return !(isEmpty(client) && isEmpty(project) && isEmpty(funnel)); }); }
function MetricCard({ label, value, helper, percent, raw, delta, align }: { label: string; value: unknown; helper?: ReactNode; percent?: boolean; raw?: boolean; delta?: Delta; align?: boolean }) { const formatted = raw ? String(value ?? "—") : formatMetric(value as Row[string], Boolean(percent)); const labelClass = align ? "min-h-[2.75rem] text-xs text-muted-foreground" : "text-xs text-muted-foreground"; const deltaClass = delta?.tone === "positive" ? "text-emerald-600" : delta?.tone === "negative" ? "text-red-600" : "text-muted-foreground"; return <div className="flex h-full flex-col rounded border p-3"><p className={labelClass}>{label}</p><p className="mt-1 text-xl font-semibold num">{formatted}</p>{delta ? <div className="mt-1 min-h-[2rem] space-y-0.5"><p className={`text-xs font-medium ${deltaClass}`}>{delta.text}</p><p className="text-[10px] text-muted-foreground">vs попередній період</p></div> : align ? <div className="mt-1 min-h-[2rem]" /> : null}{helper ? <div className="mt-1 text-xs leading-snug text-muted-foreground">{helper}</div> : null}</div>; }
function RatioHelper({ counts, ratio, lang }: { counts: string; ratio: number | null; lang: "uk" | "en" }) { const note = lang === "uk" ? "Понад 100%: у вибраному періоді наступних подій більше, ніж попередніх. Для переходів конкретних контактів дивись блок «Воронка по контактах»." : "Above 100%: the selected period has more next-stage events than previous-stage events. For specific contact transitions, see the Contact-level funnel block."; return <><p>{counts}</p>{ratio !== null && ratio > 100 ? <p className="mt-1 text-xs text-muted-foreground">{note}</p> : null}</>; }
function safePct(num: number, den: number) { if (!den) return null; return (num / den) * 100; }
function parseDate(value: unknown): Date | null { if (!value) return null; const d = new Date(String(value)); return Number.isNaN(d.getTime()) ? null : d; }
function toNumber(value: unknown): number | null { if (typeof value === "number" && Number.isFinite(value)) return value; if (typeof value === "string" && value.trim() !== "") { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : null; } return null; }
function formatMetric(value: Row[string], isPercent: boolean) { const n = toNumber(value); if (n == null) return "—"; return isPercent ? `${fmtNum(n)}%` : fmtNum(n); }
function money(value: unknown, currency: "USD" | "UAH", lang: "uk" | "en") { const n = toNumber(value); if (n == null) return "—"; return new Intl.NumberFormat(lang === "uk" ? "uk-UA" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n); }
function buildDelta(current: number | null, comparison: number | null, compareDisplay: "percent" | "absolute", showDelta: boolean, isPercentMetric = false): Delta | undefined { if (!showDelta) return undefined; if (current == null || comparison == null) return { text: "немає бази", tone: "neutral" }; const absolute = current - comparison; const tone = absolute > 0 ? "positive" : absolute < 0 ? "negative" : "neutral"; if (compareDisplay === "percent") { if (comparison === 0) return { text: current === 0 ? "0.0%" : "немає бази", tone: "neutral" }; const percent = (absolute / Math.abs(comparison)) * 100; return { text: `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`, tone }; } const valueText = isPercentMetric ? `${Math.abs(absolute).toFixed(1)} п.п.` : fmtNum(Math.abs(absolute)); if (absolute > 0) return { text: `+${valueText}`, tone }; if (absolute < 0) return { text: `-${valueText}`, tone }; return { text: isPercentMetric ? "0.0 п.п." : "0", tone }; }
function buildMoneyDelta(current: number | null, comparison: number | null, currency: "USD" | "UAH", lang: "uk" | "en", compareDisplay: "percent" | "absolute", showDelta: boolean): Delta | undefined { if (!showDelta) return undefined; if (current == null || comparison == null) return { text: "немає бази", tone: "neutral" }; const absolute = current - comparison; const tone = absolute > 0 ? "positive" : absolute < 0 ? "negative" : "neutral"; if (compareDisplay === "percent") { if (comparison === 0) return { text: current === 0 ? "0.0%" : "немає бази", tone: "neutral" }; const percent = (absolute / Math.abs(comparison)) * 100; return { text: `${percent > 0 ? "+" : ""}${percent.toFixed(1)}%`, tone }; } const valueText = money(Math.abs(absolute), currency, lang); if (absolute > 0) return { text: `+${valueText}`, tone }; if (absolute < 0) return { text: `-${valueText}`, tone }; return { text: money(0, currency, lang), tone }; }
function getStageLabel(stage: string, fallback: unknown, lang: "uk" | "en") { const mapped: Record<string, { uk: string; en: string }> = { registration: { uk: "Реєстрації", en: "Registrations" }, questionnaire: { uk: "Анкети", en: "Questionnaires" }, application: { uk: "Заявки", en: "Applications" }, booking: { uk: "Бронювання", en: "Bookings" }, sale: { uk: "Платежі", en: "Payments" }, payment: { uk: "Платежі", en: "Payments" } }; const known = mapped[stage]; if (known) return known[lang]; return String(fallback ?? "—"); }
function getPaymentCategoryLabelKey(category: string) { switch (category) { case "full_payment": return "conversionsPaymentCategoryFull"; case "installment": return "conversionsPaymentCategoryInstallment"; case "deposit": return "conversionsPaymentCategoryDeposit"; case "additional_payment": return "conversionsPaymentCategoryAdditional"; case "unknown": return "conversionsPaymentCategoryUnknown"; case "other": return "conversionsPaymentCategoryOther"; default: return null; } }
function formatShortDate(value: unknown) { if (value == null || String(value).trim() === "") return "—"; const raw = String(value); const parsed = new Date(raw); if (Number.isNaN(parsed.getTime())) return raw; const day = String(parsed.getUTCDate()).padStart(2, "0"); const month = String(parsed.getUTCMonth() + 1).padStart(2, "0"); const year = parsed.getUTCFullYear(); const currentYear = new Date().getUTCFullYear(); return year === currentYear ? `${day}.${month}` : `${day}.${month}.${year}`; }
function Empty({ text }: { text: string }) { return <p className="rounded border p-3 text-sm text-muted-foreground">{text}</p>; }
function FriendlyTable({ rows, columns, empty }: { rows: Row[]; columns: { key: string; label: string }[]; empty: string }) { const [selectedRowKey, setSelectedRowKey] = useState<string | null>(null); if (!rows.length) return <Empty text={empty} />; return <Table className="w-full table-fixed"><TableHeader><TableRow>{columns.map((c) => <TableHead className={TABLE_HEAD_CLASS} key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((row, idx) => { const rowKey = `${idx}`; const selected = selectedRowKey === rowKey; return <TableRow key={rowKey} onClick={() => setSelectedRowKey((current) => current === rowKey ? null : rowKey)} className={selected ? SELECTED_ROW_CLASS : HOVER_ROW_CLASS}>{columns.map((c) => <TableCell className={TABLE_CELL_CLASS} key={c.key}>{String(row[c.key] ?? "—")}</TableCell>)}</TableRow>; })}</TableBody></Table>; }
