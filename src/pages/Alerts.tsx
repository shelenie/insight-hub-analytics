import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { toast } from "@/hooks/use-toast";

type Row = Record<string, string | number | boolean | null>;
const FRIENDLY_COLUMN_LABELS: Record<string, string> = {
  client_name: "Клієнт", project_name: "Проєкт", funnel_name: "Воронка", campaign: "Кампанія", platform: "Платформа", spend: "Витрати", clicks: "Кліки", impressions: "Покази", reach: "Охоплення", ctr: "CTR", cpc: "CPC", cpm: "CPM", status: "Статус", created_at: "Створено", updated_at: "Оновлено", mapping_status: "Статус мапінгу", binding_status: "Статус звʼязку", ad_account_name: "Рекламний акаунт", source_name: "Джерело",
};
const PLACEHOLDER_PATTERNS = ["test agency","test client","northstar digital clinic","evergreen growth program","main webinar funnel","placeholder","demo","mock","test_upload","backend_test"];
function isPlaceholderRow(row: Row) { const text = Object.values(row).join(" ").toLowerCase(); return PLACEHOLDER_PATTERNS.some((p) => text.includes(p)); }
function filterRows(rows: Row[]) { return rows.filter((r) => !isPlaceholderRow(r)); }
type OptionalViewData = { rows: Row[]; unavailableReason: string | null };
type AlertsData = { telegramChats: OptionalViewData; telegramRoutes: OptionalViewData; outboxPending: OptionalViewData; actionRequestsPending: OptionalViewData; telegramHitlHealth: OptionalViewData; telegramHitlProductionHealth: OptionalViewData; operationalAlertsRecent: OptionalViewData; operationalAlertsHealth: OptionalViewData };

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const SECURITY_NOTE = "Telegram and alert actions are checked securely on submit.";

export default function Alerts() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);
  const canManage = capabilities.can_manage_telegram_alerts;
  const [statusMessage, setStatusMessage] = useState<string>(SECURITY_NOTE);
  const [pendingAction, setPendingAction] = useState<string>("");
  const [selectedActionRequest, setSelectedActionRequest] = useState<Row | null>(null);

  const query = useQuery<AlertsData>({
    queryKey: ["telegram-alerts-workspace", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const [telegramChats, telegramRoutes, outboxPending, actionRequestsPending, telegramHitlHealth, telegramHitlProductionHealth, operationalAlertsRecent, operationalAlertsHealth] = await Promise.all([
        readOptionalView("v_telegram_chats"), readOptionalView("v_telegram_notification_routes"), readOptionalView("v_telegram_outbox_pending"), readOptionalView("v_telegram_action_requests_pending"), readOptionalView("v_telegram_hitl_health"), readOptionalView("v_telegram_hitl_production_health"), readOptionalView("v_operational_alerts_recent"), readOptionalView("v_operational_alerts_health"),
      ]);
      return { telegramChats, telegramRoutes, outboxPending, actionRequestsPending, telegramHitlHealth, telegramHitlProductionHealth, operationalAlertsRecent, operationalAlertsHealth };
    },
  });

  const firstOutbox = useMemo(() => query.data?.outboxPending.rows[0], [query.data?.outboxPending.rows]);
  const firstActionRequest = useMemo(() => query.data?.actionRequestsPending.rows[0], [query.data?.actionRequestsPending.rows]);
  const firstAlert = useMemo(() => query.data?.operationalAlertsRecent.rows[0], [query.data?.operationalAlertsRecent.rows]);

  const refreshAlerts = async () => { await query.refetch(); await Promise.all([queryClient.invalidateQueries({ queryKey: ["telegram-alerts-workspace", WORKSPACE_ID] }), queryClient.invalidateQueries({ queryKey: ["v_telegram_outbox_pending", WORKSPACE_ID] }), queryClient.invalidateQueries({ queryKey: ["v_telegram_action_requests_pending", WORKSPACE_ID] }), queryClient.invalidateQueries({ queryKey: ["v_operational_alerts_recent", WORKSPACE_ID] }), queryClient.invalidateQueries({ queryKey: ["v_operational_alerts_health", WORKSPACE_ID] }), queryClient.invalidateQueries({ queryKey: ["v_telegram_hitl_health", WORKSPACE_ID] }), queryClient.invalidateQueries({ queryKey: ["v_telegram_hitl_production_health", WORKSPACE_ID] })]); };

  const runAction = async (key: string, fn: () => Promise<{ data: unknown; error: { message: string } | null }>) => {
    setPendingAction(key); setStatusMessage("");
    const { data, error } = await fn();
    setPendingAction("");
    if (error) { setStatusMessage(error.message); toast({ title: "Action failed", description: error.message, variant: "destructive" }); return; }
    const result = data as { ok?: boolean; error?: string } | null;
    if (!result?.ok) { const message = result?.error ?? "Action failed"; setStatusMessage(message); toast({ title: "Action failed", description: message, variant: "destructive" }); return; }
    setStatusMessage("Action completed successfully."); toast({ title: "Success", description: "Telegram/alert action completed." }); await refreshAlerts();
  };

  return <DashboardLayout title="Telegram / Сповіщення" subtitle="Telegram-підтвердження, черга повідомлень і операційні сповіщення">
    <p className="mb-4 text-xs text-muted-foreground">{statusMessage}</p>{roleLoading ? <p className="mb-4 text-xs text-muted-foreground">Перевіряємо права доступу…</p> : null}{!roleLoading && !canManage ? <p className="mb-4 text-xs text-muted-foreground">У вас немає доступу до керування сповіщеннями Telegram.</p> : null}{!roleLoading && roleError ? <p className="mb-4 text-xs text-muted-foreground">Роль робочого простору тимчасово недоступна. Дії вимкнено з міркувань безпеки.</p> : null}
    {!session ? <SectionCard title="Telegram / Сповіщення" description="Authentication required"><p className="text-sm text-muted-foreground">Ви вийшли з системи. Увійдіть to access Telegram and operational alerts data.</p></SectionCard>
      : query.isLoading ? <SectionCard title="Telegram / Сповіщення" description="Завантаження data"><p className="text-sm text-muted-foreground">Завантаження alerts workspace…</p></SectionCard>
        : query.error ? <SectionCard title="Telegram / Сповіщення" description="Error state"><p className="text-sm text-destructive">Не вдалося завантажити розділ сповіщень.</p></SectionCard>
          : <Tabs defaultValue="overview" className="space-y-4"><TabsList className="w-full justify-start overflow-x-auto"><TabsTrigger value="overview">Огляд</TabsTrigger><TabsTrigger value="chats">Telegram-чати</TabsTrigger><TabsTrigger value="routes">Маршрути</TabsTrigger><TabsTrigger value="outbox">Черга повідомлень</TabsTrigger><TabsTrigger value="action-requests">Запити на підтвердження</TabsTrigger><TabsTrigger value="alerts">Сповіщення</TabsTrigger><TabsTrigger value="health">Стан</TabsTrigger></TabsList>
            <TabsContent value="overview"><SectionCard title="Overview" description="High-level queue and health snapshot"><ul className="grid gap-2 text-sm md:grid-cols-2"><li>Telegram chats: <strong>{query.data?.telegramChats.rows.length ?? 0}</strong></li><li>Notification routes: <strong>{query.data?.telegramRoutes.rows.length ?? 0}</strong></li><li>Pending outbox messages: <strong>{query.data?.outboxPending.rows.length ?? 0}</strong></li><li>Pending action requests: <strong>{query.data?.actionRequestsPending.rows.length ?? 0}</strong></li><li>Recent operational alerts: <strong>{query.data?.operationalAlertsRecent.rows.length ?? 0}</strong></li><li>Telegram status: <strong>{query.data?.telegramChats.rows.length ? "Connected group(s) detected" : "No connected Telegram groups detected"}</strong></li></ul></SectionCard></TabsContent>
            <TabsContent value="chats"><SectionCard title="Telegram Chats" description="Connected chats"><KnownColumnsTable rows={filterRows(query.data?.telegramChats.rows ?? [])} columns={["chat_title", "chat_name", "title", "name", "chat_type", "type", "chat_id", "status", "created_at", "updated_at"]} emptyText="No Telegram chats found." /><UnavailableHint data={query.data?.telegramChats} /></SectionCard></TabsContent>
            <TabsContent value="routes"><SectionCard title="Notification Routes" description="Notification destinations"><KnownColumnsTable rows={filterRows(query.data?.telegramRoutes.rows ?? [])} columns={["route_name", "route_type", "route", "destination_chat", "destination_chat_id", "chat_id", "event_type", "enabled", "status"]} emptyText="No notification routes found." /><UnavailableHint data={query.data?.telegramRoutes} /></SectionCard></TabsContent>
            <TabsContent value="outbox"><SectionCard title="Pending Outbox" description="Messages waiting to send"><KnownColumnsTable rows={filterRows(query.data?.outboxPending.rows ?? [])} columns={["message_type", "status", "destination_chat", "destination_chat_id", "chat_id", "created_at", "error", "error_message"]} emptyText="No pending outbox messages found." /><div className="mt-4 rounded-md border border-dashed border-border/70 bg-muted/30 p-3"><div className="flex flex-wrap gap-2"><Button type="button" variant="outline" disabled={!session || !canManage || !getOutboxMessageId(firstOutbox) || pendingAction === "retry-outbox"} onClick={() => { const outboxId = getOutboxMessageId(firstOutbox); if (!outboxId) return setStatusMessage("Missing outbox_message_id on the selected row."); void runAction("retry-outbox", () => supabase.functions.invoke("telegram-outbox-retry", { body: { workspace_id: WORKSPACE_ID, outbox_message_id: outboxId } })); }}>{pendingAction === "retry-outbox" ? "Retrying…" : "Retry message"}</Button></div></div><UnavailableHint data={query.data?.outboxPending} /></SectionCard></TabsContent>
            <TabsContent value="action-requests"><SectionCard title="Pending Action Requests" description="Requests pending review"><KnownColumnsTable rows={filterRows(query.data?.actionRequestsPending.rows ?? [])} columns={["action_type", "status", "requested_by", "requested_by_user", "created_at", "related_object", "related_object_id", "object_type"]} emptyText="No pending action requests found." /><div className="mt-4 rounded-md border border-dashed border-border/70 bg-muted/30 p-3"><div className="flex flex-wrap gap-2"><Button type="button" disabled={!session || !firstActionRequest || pendingAction === "open-action-request"} onClick={() => {
              if (!firstActionRequest) return setStatusMessage("No action request row available to open.");
              setPendingAction("open-action-request");
              setSelectedActionRequest(firstActionRequest);
              setStatusMessage("Action request details opened.");
              toast({ title: "Opened", description: "Action request details panel updated." });
              setPendingAction("");
            }}>{pendingAction === "open-action-request" ? "Opening…" : "Open action request"}</Button></div>{selectedActionRequest ? <div className="mt-3 rounded border border-border/60 bg-background p-3"><p className="mb-2 text-xs font-medium text-muted-foreground">Selected action request details</p><GenericDataTable rows={[selectedActionRequest]} columns={Object.keys(selectedActionRequest)} /></div> : <p className="mt-2 text-xs text-muted-foreground">Open an action request to view details inline.</p>}</div><UnavailableHint data={query.data?.actionRequestsPending} /></SectionCard></TabsContent>
            <TabsContent value="alerts"><SectionCard title="Operational Alerts" description="Current operational alerts"><KnownColumnsTable rows={filterRows(query.data?.operationalAlertsRecent.rows ?? [])} columns={["alert_type", "severity", "status", "title", "message", "created_at", "resolved_at"]} emptyText="No open alerts." /><div className="mt-4 rounded-md border border-dashed border-border/70 bg-muted/30 p-3"><div className="flex flex-wrap gap-2"><Button type="button" disabled={!session || !canManage || !getAlertId(firstAlert) || pendingAction === "resolve-alert"} onClick={() => { const alertId = getAlertId(firstAlert); if (!alertId) return setStatusMessage("Missing alert_id on the selected row."); void runAction("resolve-alert", () => supabase.functions.invoke("operational-alert-resolve", { body: { workspace_id: WORKSPACE_ID, alert_id: alertId } })); }}>{pendingAction === "resolve-alert" ? "Resolving…" : "Resolve alert"}</Button></div></div><UnavailableHint data={query.data?.operationalAlertsRecent} /></SectionCard></TabsContent>
            <TabsContent value="health"><div className="space-y-4"><OptionalViewCard title="Telegram HITL Health" viewName="v_telegram_hitl_health" data={query.data?.telegramHitlHealth} /><OptionalViewCard title="Telegram HITL Production Health" viewName="v_telegram_hitl_production_health" data={query.data?.telegramHitlProductionHealth} /><OptionalViewCard title="Operational Alerts Health" viewName="v_operational_alerts_health" data={query.data?.operationalAlertsHealth} /></div></TabsContent>
          </Tabs>}
  </DashboardLayout>;
}
const getOutboxMessageId = (row: Row | undefined) => String(row?.outbox_message_id ?? row?.id ?? row?.message_id ?? "");
const getAlertId = (row: Row | undefined) => String(row?.alert_id ?? row?.id ?? "");
function UnavailableHint({ data }: { data: OptionalViewData | undefined }) { if (!data?.unavailableReason) return null; return <p className="mt-2 text-xs text-muted-foreground">Цей розділ поки недоступний.</p>; }
async function readOptionalView(viewName: string): Promise<OptionalViewData> { const result = await supabase.from(viewName).select("*"); if (result.error) return { rows: [], unavailableReason: result.error.message }; return { rows: (result.data ?? []) as Row[], unavailableReason: null }; }
function OptionalViewCard({ title, viewName, data }: { title: string; viewName: string; data: OptionalViewData | undefined }) { return <SectionCard title={title} description="Details">{data?.unavailableReason ? <p className="text-sm text-muted-foreground">Цей розділ поки недоступний.</p> : <GenericTable rows={data?.rows ?? []} emptyText="Записів поки немає." />}</SectionCard>; }
function KnownColumnsTable({ rows, columns, emptyText }: { rows: Row[]; columns: string[]; emptyText: string }) { const availableColumns = columns.filter((column) => rows.some((row) => row[column] !== undefined)); if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>; if (availableColumns.length === 0) return <GenericTable rows={rows} emptyText={emptyText} />; return <GenericDataTable rows={rows} columns={availableColumns} />; }
function GenericTable({ rows, emptyText }: { rows: Row[]; emptyText: string }) { if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>; const columns = Object.keys(rows[0] ?? {}); if (columns.length === 0) return <p className="text-sm text-muted-foreground">Дані є, але немає полів для відображення.</p>; return <GenericDataTable rows={rows} columns={columns} />; }
function GenericDataTable({ rows, columns }: { rows: Row[]; columns: string[] }) { return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border/70 text-muted-foreground">{columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{friendlyLabel(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${index}-${row.id ?? "row"}`} className="border-b border-border/40 last:border-0">{columns.map((column) => <td key={`${index}-${column}`} className="px-2 py-2 text-foreground">{formatValue(row[column])}</td>)}</tr>)}</tbody></table></div>; }
function titleize(value: string) { return FRIENDLY_COLUMN_LABELS[value.toLowerCase()] ?? value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function formatValue(value: string | number | boolean | null | undefined) { return value === null || value === undefined || value === "" ? "—" : String(value); }
