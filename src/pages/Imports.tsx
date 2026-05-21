import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, string | number | boolean | null>;

export default function Imports() {
  const { t } = useI18n();
  const { session } = useAuth();
  const query = useQuery({ queryKey: ["imports-page", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => ({
    health: await read("v_import_health"), errors: await read("v_import_error_summary"), mappings: await read("v_file_import_mappings"), fields: await read("v_file_import_mapping_fields"), actions: await read("v_source_action_requests_recent"), sheets: await read("v_google_sheet_source_management"), syncRules: await read("v_scheduled_sync_rules"), alerts: await read("v_alert_events_recent"),
  })});

  const fullyUnavailable = [query.data?.health, query.data?.errors, query.data?.mappings, query.data?.actions].every((d) => d?.unavailableReason);

  return <DashboardLayout title={t("importsTitle")} subtitle={t("importsSubtitle")}><div className="space-y-4">
    {!session ? <Msg t="Увійдіть, щоб переглянути дані імпортів." /> : query.isLoading ? <Msg t="Завантаження даних імпортів…" /> : null}
    {fullyUnavailable ? <Msg t="Дані імпортів тимчасово недоступні." /> : null}
    <SectionCard title="Стан імпортів" description="Останні оновлення та синхронізації" noPadding><Rows rows={query.data?.health.rows ?? []} cols={["source_name", "source_type", "status", "last_sync_at", "rows_received", "rows_inserted", "rows_failed"]} empty="Активність імпортів поки не зафіксована." /></SectionCard>
    <SectionCard title="Помилки імпортів" description="Останні проблеми імпорту" noPadding><Rows rows={query.data?.errors.rows ?? []} cols={["source_name", "error_type", "error_count", "last_error_at"]} empty="Помилок імпорту не знайдено." /></SectionCard>
    <SectionCard title="Стан мапінгу" description="Привʼязка імпортованих полів" noPadding><Rows rows={query.data?.mappings.rows ?? []} cols={["source_name", "mapping_status", "updated_at"]} empty="Рядків мапінгу поки немає." /></SectionCard>
    <SectionCard title="Останні сповіщення" description="Сигнали щодо імпортів" noPadding><Rows rows={query.data?.alerts.rows ?? []} cols={["severity", "title", "status", "created_at"]} empty="Немає сповіщень про помилки імпорту." /></SectionCard>
    {(query.data?.health.rows.length ?? 0) > 0 && (query.data?.mappings.rows.length ?? 0) === 0 ? <Msg t="Імпортовані дані є, але їх потрібно привʼязати до проєкту/воронки або оновити production views." /> : null}
  </div></DashboardLayout>;
}

function Rows({ rows, cols, empty }: { rows: Row[]; cols: string[]; empty: string }) { if (!rows.length) return <Msg t={empty} />; return <Table><TableHeader><TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 100).map((r, i) => <TableRow key={i}>{cols.map((c) => <TableCell key={c}>{String(r[c] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table>; }
const Msg = ({ t }: { t: string }) => <p className="rounded border p-3 text-sm text-muted-foreground">{t}</p>;
async function read(view: string) { const res = await supabase.from(view).select("*").eq("workspace_id", WORKSPACE_ID).limit(200); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }
