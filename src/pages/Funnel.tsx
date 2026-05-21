import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtNum } from "@/lib/format";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, string | number | boolean | null>;
type OptionalViewData = { rows: Row[]; unavailableReason: string | null };

const EMPTY_TEXT = "Дані воронки поки не знайдені. Перевірте імпорт або мапінг джерел.";

export default function Funnel() {
  const { t } = useI18n();
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["funnel-page", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const [stageSummary, conversionSummary] = await Promise.all([
        readOptionalView("v_unified_funnel_stage_summary", true),
        readOptionalView("v_unified_funnel_conversion_summary", true),
      ]);
      return { stageSummary, conversionSummary };
    },
  });

  const conversion = query.data?.conversionSummary.rows[0] ?? null;
  const stageRows = query.data?.stageSummary.rows ?? [];
  const hasData = stageRows.length > 0 || Boolean(conversion);

  const stageKpis = useMemo(() => [
    { label: "Реєстрації", value: conversion?.registrations },
    { label: "Анкети", value: conversion?.questionnaires },
    { label: "Заявки", value: conversion?.applications },
    { label: "Бронювання", value: conversion?.bookings },
  ], [conversion]);

  const conversionKpis = useMemo(() => [
    { label: "Реєстрація → Анкета", value: conversion?.registration_to_questionnaire_pct },
    { label: "Анкета → Заявка", value: conversion?.questionnaire_to_application_pct },
    { label: "Заявка → Бронювання", value: conversion?.application_to_booking_pct },
    { label: "Реєстрація → Бронювання", value: conversion?.registration_to_booking_pct },
  ], [conversion]);

  return (
    <DashboardLayout title={t("funnelTitle")} subtitle={t("funnelSubtitle")}>
      <div className="space-y-4">
        <FilterBar freshness={{ source: "v_unified_funnel_stage_summary", status: "fresh", lastSync: "live" }} />
        {!session ? <Empty text="Sign in to view funnel production data." /> : query.isLoading ? <Empty text="Завантаження даних воронки…" /> : null}

        {!query.isLoading && !hasData ? <Empty text={EMPTY_TEXT} /> : null}

        {hasData ? (
          <>
            <SectionCard title="Ключові етапи" description="Основні показники воронки" noPadding>
              <KpiTable rows={stageKpis} isPercent={false} />
            </SectionCard>

            <SectionCard title="Конверсія між етапами" description="Відсоток переходів" noPadding>
              <KpiTable rows={conversionKpis} isPercent />
            </SectionCard>

            <SectionCard title="Етапи воронки" description="Зведення по імпортованих подіях" noPadding>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Етап</TableHead>
                    <TableHead className="text-right">Події</TableHead>
                    <TableHead className="text-right">Унікальні контакти</TableHead>
                    <TableHead>Перша дата</TableHead>
                    <TableHead>Остання дата</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {stageRows.map((row, idx) => (
                    <TableRow key={idx}>
                      <TableCell>{String(row.stage_label ?? "—")}</TableCell>
                      <TableCell className="text-right num">{fmtNum(Number(row.events_count ?? 0))}</TableCell>
                      <TableCell className="text-right num">{fmtNum(Number(row.unique_contacts ?? 0))}</TableCell>
                      <TableCell>{String(row.first_date ?? "—")}</TableCell>
                      <TableCell>{String(row.last_date ?? "—")}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </SectionCard>
          </>
        ) : null}
      </div>
    </DashboardLayout>
  );
}

function KpiTable({ rows, isPercent }: { rows: { label: string; value: Row[string] }[]; isPercent: boolean }) {
  return (
    <Table>
      <TableHeader><TableRow><TableHead>Показник</TableHead><TableHead className="text-right">Значення</TableHead></TableRow></TableHeader>
      <TableBody>
        {rows.map((row) => (
          <TableRow key={row.label}>
            <TableCell>{row.label}</TableCell>
            <TableCell className="text-right num">{formatMetric(row.value, isPercent)}</TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  );
}

function formatMetric(value: Row[string], isPercent: boolean) {
  if (typeof value !== "number") return "—";
  return isPercent ? `${fmtNum(value)}%` : fmtNum(value);
}

function Empty({ text }: { text: string }) { return <p className="rounded border p-3 text-sm text-muted-foreground">{text}</p>; }

async function readOptionalView(viewName: string, scopedByWorkspace: boolean): Promise<OptionalViewData> {
  let query = supabase.from(viewName).select("*").limit(200);
  if (scopedByWorkspace) query = query.eq("workspace_id", WORKSPACE_ID);
  const result = await query;
  if (result.error) return { rows: [], unavailableReason: result.error.message };
  return { rows: (result.data ?? []) as Row[], unavailableReason: null };
}
