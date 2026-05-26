import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtNum } from "@/lib/format";
import { filterPlaceholderRows } from "@/lib/demoFilters";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, string | number | boolean | null>;
type OptionalViewData = { rows: Row[]; unavailableReason: string | null };

const STAGE_ORDER = ["registration", "questionnaire", "application", "booking", "sale", "payment"];

export default function Conversions() {
  const { t, lang } = useI18n();
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["conversions-page", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const [stageSummary, conversionSummary, paymentSummary, matchDiagnostics, onboarding, bindings] = await Promise.all([
        readOptionalView("v_unified_funnel_stage_summary", true),
        readOptionalView("v_unified_funnel_conversion_summary", true),
        readOptionalView("v_unified_funnel_payment_summary", true),
        readOptionalView("v_unified_funnel_match_diagnostics", true),
        readOptionalView("v_onboarding_hierarchy", true),
        readOptionalView("v_project_data_bindings", true),
      ]);
      return { stageSummary, conversionSummary, paymentSummary, matchDiagnostics, onboarding, bindings };
    },
  });

  const conversion = query.data?.conversionSummary.rows[0] ?? null;
  const payment = query.data?.paymentSummary.rows[0] ?? null;
  const diagnostics = query.data?.matchDiagnostics.rows[0] ?? null;
  const stageRows = useMemo(() => query.data?.stageSummary.rows ?? [], [query.data?.stageSummary.rows]);

  const stageByKey = useMemo(() => {
    const m = new Map<string, Row>();
    stageRows.forEach((r) => m.set(String(r.stage ?? "").toLowerCase(), r));
    return m;
  }, [stageRows]);

  const hasData = Boolean(conversion || payment || diagnostics || stageRows.length);
  const filteredOnboardingRows = useMemo(() => filterPlaceholderRows(query.data?.onboarding.rows as Record<string, unknown>[] | undefined) as Row[], [query.data?.onboarding.rows]);
  const filteredBindingsRows = useMemo(() => filterPlaceholderRows(query.data?.bindings.rows as Record<string, unknown>[] | undefined) as Row[], [query.data?.bindings.rows]);

  const stageCards = [
    { key: "registration", label: t("conversionsRegistrations"), count: conversion?.registrations ?? stageByKey.get("registration")?.events_count, unique: stageByKey.get("registration")?.unique_contacts },
    { key: "questionnaire", label: t("conversionsQuestionnaires"), count: conversion?.questionnaires ?? stageByKey.get("questionnaire")?.events_count, unique: stageByKey.get("questionnaire")?.unique_contacts },
    { key: "application", label: t("conversionsApplications"), count: conversion?.applications ?? stageByKey.get("application")?.events_count, unique: stageByKey.get("application")?.unique_contacts },
    { key: "booking", label: t("conversionsBookings"), count: conversion?.bookings ?? stageByKey.get("booking")?.events_count, unique: stageByKey.get("booking")?.unique_contacts },
  ];

  const stageTableRows = [...stageRows].sort((a, b) => STAGE_ORDER.indexOf(String(a.stage ?? "").toLowerCase()) - STAGE_ORDER.indexOf(String(b.stage ?? "").toLowerCase()));

  const conversionCards = [
    { label: t("conversionsRegToQuestionnaire"), value: conversion?.registration_to_questionnaire_pct },
    { label: t("conversionsQuestionnaireToApplication"), value: conversion?.questionnaire_to_application_pct },
    { label: t("conversionsApplicationToBooking"), value: conversion?.application_to_booking_pct },
    { label: t("conversionsRegToBooking"), value: conversion?.registration_to_booking_pct },
    { label: t("conversionsRegToPayment"), value: conversion?.registration_to_sale_pct },
  ];

  return (
    <DashboardLayout title={t("funnelTitle")} subtitle={t("funnelSubtitle")}>
      <div className="space-y-4">
        <p className="inline-flex rounded border px-3 py-1 text-xs text-muted-foreground">{t("conversionsDataStatus")}</p>
        {!session ? <Empty text={t("conversionsSignIn")} /> : query.isLoading ? <Empty text={t("conversionsLoading")} /> : null}
        {!query.isLoading && session && !hasData ? <Empty text={t("conversionsNoData")} /> : null}

        {hasData ? (
          <>
            <SectionCard title={t("conversionsStageSection")} description={t("conversionsStageSectionDesc")}>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-4">
                {stageCards.map((card) => (
                  <MetricCard key={card.key} label={card.label} value={card.count} helper={toNumber(card.unique) != null ? `${t("conversionsUniqueContacts")}: ${fmtNum(toNumber(card.unique) ?? 0)}` : undefined} />
                ))}
              </div>
            </SectionCard>

            <SectionCard title={t("conversionsBetweenStages")} description={t("conversionsBetweenStagesDesc")}>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                {conversionCards.map((card) => <MetricCard key={card.label} label={card.label} value={card.value} percent />)}
              </div>
            </SectionCard>

            <SectionCard title={t("conversionsPaymentsSection")} description={t("conversionsPaymentsSectionDesc")}>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <MetricCard label={t("conversionsPaymentRecords")} value={payment?.payment_rows} />
                <MetricCard label={t("conversionsUniquePayers")} value={payment?.unique_payment_contacts} />
                <MetricCard label={t("conversionsActivePayments")} value={payment?.active_payment_rows} />
                <MetricCard label={t("conversionsFullPayments")} value={payment?.full_payment_rows} />
                <MetricCard label={t("conversionsInstallments")} value={payment?.installment_rows} />
                <MetricCard label={t("conversionsDeposits")} value={payment?.deposit_rows} />
                <MetricCard label={t("conversionsAdditionalPayments")} value={payment?.additional_payment_rows} />
                <MetricCard label={t("conversionsRefunds")} value={payment?.refund_payment_rows} />
                <MetricCard label={t("conversionsNeedsReview")} value={payment?.needs_review_payment_rows} />
                <MetricCard label={t("conversionsCollectedUsd")} value={money(payment?.collected_usd_total, "USD", lang)} raw />
                <MetricCard label={t("conversionsCollectedUah")} value={money(payment?.collected_uah_total, "UAH", lang)} raw />
                <MetricCard label={t("conversionsDebt")} value={money(payment?.debt_total, "USD", lang)} raw />
                <MetricCard label={t("conversionsTariffTotal")} value={money(payment?.tariff_total, "USD", lang)} raw />
              </div>
            </SectionCard>

            <SectionCard title={t("conversionsMatchingTitle")} description={t("conversionsMatchingSubtitle")}>
              <p className="mb-3 text-xs text-muted-foreground">{t("conversionsMatchingExplain")}</p>
              <div className="grid gap-3 md:grid-cols-2 lg:grid-cols-3">
                <MetricCard label={t("conversionsBookingPhones")} value={diagnostics?.unique_booking_phones} />
                <MetricCard label={t("conversionsPaymentPhones")} value={diagnostics?.unique_payment_phones} />
                <MetricCard label={t("conversionsMatchedPhones")} value={diagnostics?.matched_booking_payment_phones} />
                <MetricCard label={t("conversionsBookingToPaymentMatch")} value={diagnostics?.matched_booking_to_payment_pct_by_phone} percent />
                <MetricCard label={t("conversionsPaymentsWithoutBooking")}
 value={diagnostics?.payments_without_booking_phone_match} />
                <MetricCard label={t("conversionsBookingsWithoutPayment")} value={diagnostics?.bookings_without_payment_phone_match} />
                <MetricCard label={t("conversionsRawPaymentsBookingsRatio")} value={conversion?.booking_to_sale_pct} percent />
              </div>
              <p className="mt-3 rounded border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-900 dark:text-amber-100">{t("conversionsRatioWarning")}</p>
            </SectionCard>

            <SectionCard title={t("conversionsStageTableTitle")} description={t("conversionsStageTableDesc")} noPadding>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("conversionsThStage")}</TableHead>
                    <TableHead className="text-right">{t("conversionsThEvents")}</TableHead>
                    <TableHead className="text-right">{t("conversionsThUniqueContacts")}</TableHead>
                    <TableHead>{t("conversionsThFirstDate")}</TableHead>
                    <TableHead>{t("conversionsThLastDate")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stageTableRows.map((row, idx) => {
                    const stage = String(row.stage ?? "").toLowerCase();
                    const label = getStageLabel(stage, row.stage_label, lang);
                    return <TableRow key={idx}><TableCell>{label}</TableCell><TableCell className="text-right num">{formatMetric(row.events_count, false)}</TableCell><TableCell className="text-right num">{formatMetric(row.unique_contacts, false)}</TableCell><TableCell>{formatShortDate(row.first_date)}</TableCell><TableCell>{formatShortDate(row.last_date)}</TableCell></TableRow>;
                  })}
                </TableBody>
              </Table>
            </SectionCard>

            {filteredOnboardingRows.length > 0 ? <details className="rounded border"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("conversionsExtraContext")}</summary><SectionCard title={t("conversionsExtraContext")} noPadding><FriendlyTable rows={filteredOnboardingRows} columns={[{ key: "client_name", label: "client_name" }, { key: "project_name", label: "project_name" }, { key: "funnel_name", label: "funnel_name" }, { key: "status", label: "status" }]} empty={t("conversionsViewUnavailable")} /></SectionCard></details> : null}
            {filteredBindingsRows.length > 0 ? <details className="rounded border"><summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("conversionsExtraBindings")}</summary><SectionCard title={t("conversionsExtraBindings")} noPadding><FriendlyTable rows={filteredBindingsRows} columns={[{ key: "project_name", label: "project_name" }, { key: "source_name", label: "source_name" }, { key: "mapping_status", label: "mapping_status" }, { key: "binding_status", label: "binding_status" }, { key: "updated_at", label: "updated_at" }]} empty={t("conversionsViewUnavailable")} /></SectionCard></details> : null}

            <ViewErrors query={query.data} t={t} />
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function MetricCard({ label, value, helper, percent, raw }: { label: string; value: unknown; helper?: string; percent?: boolean; raw?: boolean }) {
  const formatted = raw ? String(value ?? "—") : formatMetric(value as Row[string], Boolean(percent));
  return <div className="rounded border p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 text-xl font-semibold num">{formatted}</p>{helper ? <p className="mt-1 text-xs text-muted-foreground">{helper}</p> : null}</div>;
}

function toNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() !== "") {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }
  return null;
}

function formatMetric(value: Row[string], isPercent: boolean) {
  const n = toNumber(value);
  if (n == null) return "—";
  return isPercent ? `${fmtNum(n)}%` : fmtNum(n);
}

function money(value: unknown, currency: "USD" | "UAH", lang: "uk" | "en") {
  const n = toNumber(value);
  if (n == null) return "—";
  return new Intl.NumberFormat(lang === "uk" ? "uk-UA" : "en-US", { style: "currency", currency, maximumFractionDigits: 2 }).format(n);
}

function getStageLabel(stage: string, fallback: unknown, lang: "uk" | "en") {
  const mapped: Record<string, { uk: string; en: string }> = {
    registration: { uk: "Реєстрації", en: "Registrations" },
    questionnaire: { uk: "Анкети", en: "Questionnaires" },
    application: { uk: "Заявки", en: "Applications" },
    booking: { uk: "Бронювання", en: "Bookings" },
    sale: { uk: "Платежі", en: "Payments" },
    payment: { uk: "Платежі", en: "Payments" },
  };
  const known = mapped[stage];
  if (known) return known[lang];
  return String(fallback ?? "—");
}

function formatShortDate(value: unknown) {
  if (value == null || String(value).trim() === "") return "—";
  const raw = String(value);
  const parsed = new Date(raw);
  if (Number.isNaN(parsed.getTime())) return raw;
  const day = String(parsed.getUTCDate()).padStart(2, "0");
  const month = String(parsed.getUTCMonth() + 1).padStart(2, "0");
  const year = parsed.getUTCFullYear();
  const currentYear = new Date().getUTCFullYear();
  return year === currentYear ? `${day}.${month}` : `${day}.${month}.${year}`;
}

function Empty({ text }: { text: string }) { return <p className="rounded border p-3 text-sm text-muted-foreground">{text}</p>; }

type QueryViews = {
  stageSummary?: OptionalViewData;
  conversionSummary?: OptionalViewData;
  paymentSummary?: OptionalViewData;
  matchDiagnostics?: OptionalViewData;
};

function ViewErrors({ query, t }: { query: QueryViews | undefined; t: (key: string) => string }) {
  if (!query) return null;
  const messages = [
    ["stage", query.stageSummary?.unavailableReason],
    ["conversion", query.conversionSummary?.unavailableReason],
    ["payment", query.paymentSummary?.unavailableReason],
    ["matching", query.matchDiagnostics?.unavailableReason],
  ].filter(([, msg]) => msg);
  if (!messages.length) return null;
  return <div className="space-y-1 rounded border p-3 text-xs text-muted-foreground">{messages.map(([name]) => <p key={name}>{t("conversionsViewUnavailable")}: {String(name)}</p>)}</div>;
}

async function readOptionalView(viewName: string, scopedByWorkspace: boolean): Promise<OptionalViewData> {
  let query = supabase.from(viewName).select("*").limit(200);
  if (scopedByWorkspace) query = query.eq("workspace_id", WORKSPACE_ID);
  const result = await query;
  if (result.error) return { rows: [], unavailableReason: result.error.message };
  return { rows: (result.data ?? []) as Row[], unavailableReason: null };
}

function FriendlyTable({ rows, columns, empty }: { rows: Row[]; columns: { key: string; label: string }[]; empty: string }) {
  if (!rows.length) return <Empty text={empty} />;
  return <Table><TableHeader><TableRow>{columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((row, idx) => <TableRow key={idx}>{columns.map((c) => <TableCell key={c.key}>{String(row[c.key] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table>;
}
