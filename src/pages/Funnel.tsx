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
      const [stageSummary, conversionSummary, onboarding, bindings] = await Promise.all([
        readOptionalView("v_unified_funnel_stage_summary", true),
        readOptionalView("v_unified_funnel_conversion_summary", true),
        readOptionalView("v_onboarding_hierarchy", true),
        readOptionalView("v_project_data_bindings", true),
      ]);
      return { stageSummary, conversionSummary, onboarding, bindings };
    },
  });

  const conversion = query.data?.conversionSummary.rows[0] ?? null;
  const stageRows = useMemo(() => query.data?.stageSummary.rows ?? [], [query.data?.stageSummary.rows]);
  const hasData = stageRows.length > 0 || Boolean(conversion);

  const getStageCount = useMemo(() => {
    const normalized = new Map<string, number>();
    stageRows.forEach((row) => {
      const key = String(row.stage ?? "").trim().toLowerCase();
      if (!key) return;
      normalized.set(key, Number(row.events_count ?? 0));
    });
    return (stage: string) => normalized.get(stage) ?? null;
  }, [stageRows]);

  const stageKpis = useMemo(() => [
    { label: "Реєстрації", value: conversion?.registrations ?? getStageCount("registration") },
    { label: "Анкети", value: conversion?.questionnaires ?? getStageCount("questionnaire") },
    { label: "Заявки", value: conversion?.applications ?? getStageCount("application") },
    { label: "Бронювання", value: conversion?.bookings ?? getStageCount("booking") },
  ], [conversion, getStageCount]);

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
        {!session ? <Empty text="Увійдіть, щоб переглянути дані воронки." /> : query.isLoading ? <Empty text="Завантаження даних воронки…" /> : null}

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

            <details className="rounded border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Додатково: контекст клієнта / проєкту / воронки</summary>
              <SectionCard title="Контекст клієнта / проєкту / воронки" description="Довідковий контекст для аналізу воронки" noPadding>
                <FriendlyTable rows={query.data?.onboarding.rows ?? []} empty="Додатковий контекст поки недоступний." columns={[
                  { key: "client_name", label: "Клієнт" },
                  { key: "project_name", label: "Проєкт" },
                  { key: "funnel_name", label: "Воронка" },
                  { key: "status", label: "Статус" },
                ]} />
              </SectionCard>
            </details>

            <details className="rounded border">
              <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Додатково: звʼязки даних</summary>
              <SectionCard title="Звʼязки даних" description="Стан джерел і мапінгу даних" noPadding>
                <FriendlyTable rows={query.data?.bindings.rows ?? []} empty="Дані про звʼязки поки недоступні." columns={[
                  { key: "project_name", label: "Проєкт" },
                  { key: "source_name", label: "Джерело" },
                  { key: "mapping_status", label: "Статус мапінгу" },
                  { key: "binding_status", label: "Статус звʼязку" },
                  { key: "updated_at", label: "Оновлено" },
                ]} />
              </SectionCard>
            </details>
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


function FriendlyTable({ rows, columns, empty }: { rows: Row[]; columns: { key: string; label: string }[]; empty: string }) {
  if (!rows.length) return <Empty text={empty} />;
  return <Table><TableHeader><TableRow>{columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((row, idx) => <TableRow key={idx}>{columns.map((c) => <TableCell key={c.key}>{String(row[c.key] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table>;
}
