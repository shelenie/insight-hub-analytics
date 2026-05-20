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
    {!session ? <Msg t="Sign in to view import production data." /> : query.isЗавантаження ? <Msg t="Завантаження import production data…" /> : null}
    {fullyUnavailable ? <Msg t="Import production data is unavailable." /> : null}
    <SectionCard title="Latest import/sync status" description="Latest import and sync status" noPadding><Rows rows={query.data?.health.rows ?? []} cols={["source_name", "source_type", "status", "last_sync_at", "rows_received", "rows_inserted", "rows_failed"]} empty="No import activity has been recorded yet." /></SectionCard>
    <SectionCard title="Import error summary" description="Recent import issues" noPadding><Rows rows={query.data?.errors.rows ?? []} cols={["source_name", "error_type", "error_count", "last_error_at"]} empty="No import errors." /></SectionCard>
    <SectionCard title="Mapping status" description="Import mapping status" noPadding><Rows rows={query.data?.mappings.rows ?? []} cols={["source_name", "mapping_status", "updated_at"]} empty="No mapping rows." /></SectionCard>
    <SectionCard title="Recent alerts" description="Recent alerts" noPadding><Rows rows={query.data?.alerts.rows ?? []} cols={["severity", "title", "status", "created_at"]} empty="No stale/failed import alerts." /></SectionCard>
  </div></DashboardLayout>;
}

function Rows({ rows, cols, empty }: { rows: Row[]; cols: string[]; empty: string }) { if (!rows.length) return <Msg t={empty} />; return <Table><TableHeader><TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 100).map((r, i) => <TableRow key={i}>{cols.map((c) => <TableCell key={c}>{String(r[c] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table>; }
const Msg = ({ t }: { t: string }) => <p className="rounded border p-3 text-sm text-muted-foreground">{t}</p>;
async function read(view: string) { const res = await supabase.from(view).select("*").eq("workspace_id", WORKSPACE_ID).limit(200); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }
