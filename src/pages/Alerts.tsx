import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

type Row = Record<string, string | number | boolean | null>;
type OptionalViewData = { rows: Row[]; unavailableReason: string | null };

type AlertsData = {
  telegramChats: OptionalViewData;
  telegramRoutes: OptionalViewData;
  outboxPending: OptionalViewData;
  actionRequestsPending: OptionalViewData;
  telegramHitlHealth: OptionalViewData;
  telegramHitlProductionHealth: OptionalViewData;
  operationalAlertsRecent: OptionalViewData;
  operationalAlertsHealth: OptionalViewData;
};

const ACTIONS_DISABLED_MESSAGE = "Alert and Telegram actions require a secure backend action.";
const MISSING_SECURE_WRAPPERS = [
  "resolve_operational_alert",
  "retry_telegram_outbox_message",
  "open_telegram_action_request",
] as const;

export default function Alerts() {
  const { session } = useAuth();

  const query = useQuery<AlertsData>({
    queryKey: ["telegram-alerts-workspace"],
    enabled: Boolean(session),
    queryFn: async () => {
      const [telegramChats, telegramRoutes, outboxPending, actionRequestsPending, telegramHitlHealth, telegramHitlProductionHealth, operationalAlertsRecent, operationalAlertsHealth] = await Promise.all([
        readOptionalView("v_telegram_chats"),
        readOptionalView("v_telegram_notification_routes"),
        readOptionalView("v_telegram_outbox_pending"),
        readOptionalView("v_telegram_action_requests_pending"),
        readOptionalView("v_telegram_hitl_health"),
        readOptionalView("v_telegram_hitl_production_health"),
        readOptionalView("v_operational_alerts_recent"),
        readOptionalView("v_operational_alerts_health"),
      ]);

      return {
        telegramChats,
        telegramRoutes,
        outboxPending,
        actionRequestsPending,
        telegramHitlHealth,
        telegramHitlProductionHealth,
        operationalAlertsRecent,
        operationalAlertsHealth,
      };
    },
  });

  return (
    <DashboardLayout title="Telegram / Alerts" subtitle="Inspect Telegram routing, pending work queues, operational alerts, and HITL health.">
      {!session ? (
        <SectionCard title="Telegram / Alerts" description="Authentication required">
          <p className="text-sm text-muted-foreground">You are signed out. Sign in to access Telegram and operational alerts data.</p>
        </SectionCard>
      ) : query.isLoading ? (
        <SectionCard title="Telegram / Alerts" description="Loading data">
          <p className="text-sm text-muted-foreground">Loading alerts workspace…</p>
        </SectionCard>
      ) : query.error ? (
        <SectionCard title="Telegram / Alerts" description="Error state">
          <p className="text-sm text-destructive">Could not load alerts workspace: {query.error.message}</p>
        </SectionCard>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="chats">Telegram Chats</TabsTrigger>
            <TabsTrigger value="routes">Notification Routes</TabsTrigger>
            <TabsTrigger value="outbox">Pending Outbox</TabsTrigger>
            <TabsTrigger value="action-requests">Pending Action Requests</TabsTrigger>
            <TabsTrigger value="alerts">Operational Alerts</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <SectionCard title="Overview" description="High-level queue and health snapshot">
              <ul className="grid gap-2 text-sm md:grid-cols-2">
                <li>Telegram chats: <strong>{query.data?.telegramChats.rows.length ?? 0}</strong></li>
                <li>Notification routes: <strong>{query.data?.telegramRoutes.rows.length ?? 0}</strong></li>
                <li>Pending outbox messages: <strong>{query.data?.outboxPending.rows.length ?? 0}</strong></li>
                <li>Pending action requests: <strong>{query.data?.actionRequestsPending.rows.length ?? 0}</strong></li>
                <li>Recent operational alerts: <strong>{query.data?.operationalAlertsRecent.rows.length ?? 0}</strong></li>
              </ul>
            </SectionCard>
          </TabsContent>

          <TabsContent value="chats">
            <SectionCard title="Telegram Chats" description="Source: v_telegram_chats">
              <KnownColumnsTable rows={query.data?.telegramChats.rows ?? []} columns={[
                "chat_title", "chat_name", "title", "name", "chat_type", "type", "chat_id", "status", "created_at", "updated_at",
              ]} emptyText="No Telegram chats found." />
              <UnavailableHint data={query.data?.telegramChats} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="routes">
            <SectionCard title="Notification Routes" description="Source: v_telegram_notification_routes">
              <KnownColumnsTable rows={query.data?.telegramRoutes.rows ?? []} columns={[
                "route_name", "route_type", "route", "destination_chat", "destination_chat_id", "chat_id", "event_type", "enabled", "status",
              ]} emptyText="No notification routes found." />
              <UnavailableHint data={query.data?.telegramRoutes} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="outbox">
            <SectionCard title="Pending Outbox" description="Source: v_telegram_outbox_pending">
              <KnownColumnsTable rows={query.data?.outboxPending.rows ?? []} columns={[
                "message_type", "status", "destination_chat", "destination_chat_id", "chat_id", "created_at", "error", "error_message",
              ]} emptyText="No pending outbox messages found." />
              <DisabledActions actionLabels={["Retry message"]} />
              <UnavailableHint data={query.data?.outboxPending} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="action-requests">
            <SectionCard title="Pending Action Requests" description="Source: v_telegram_action_requests_pending">
              <KnownColumnsTable rows={query.data?.actionRequestsPending.rows ?? []} columns={[
                "action_type", "status", "requested_by", "requested_by_user", "created_at", "related_object", "related_object_id", "object_type",
              ]} emptyText="No pending action requests found." />
              <DisabledActions actionLabels={["Open action request"]} />
              <UnavailableHint data={query.data?.actionRequestsPending} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="alerts">
            <SectionCard title="Operational Alerts" description="Source: v_operational_alerts_recent">
              <KnownColumnsTable rows={query.data?.operationalAlertsRecent.rows ?? []} columns={[
                "alert_type", "severity", "status", "title", "message", "created_at", "resolved_at",
              ]} emptyText="No operational alerts found." />
              <DisabledActions actionLabels={["Resolve alert"]} />
              <UnavailableHint data={query.data?.operationalAlertsRecent} />
            </SectionCard>
          </TabsContent>

          <TabsContent value="health">
            <div className="space-y-4">
              <OptionalViewCard title="Telegram HITL Health" viewName="v_telegram_hitl_health" data={query.data?.telegramHitlHealth} />
              <OptionalViewCard title="Telegram HITL Production Health" viewName="v_telegram_hitl_production_health" data={query.data?.telegramHitlProductionHealth} />
              <OptionalViewCard title="Operational Alerts Health" viewName="v_operational_alerts_health" data={query.data?.operationalAlertsHealth} />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </DashboardLayout>
  );
}

function DisabledActions({ actionLabels }: { actionLabels: string[] }) {
  return (
    <div className="mt-4 rounded-md border border-dashed border-border/70 bg-muted/30 p-3">
      <div className="flex flex-wrap gap-2">
        {actionLabels.map((actionLabel) => (
          <Button key={actionLabel} type="button" disabled variant="outline">{actionLabel}</Button>
        ))}
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{ACTIONS_DISABLED_MESSAGE}</p>
      <p className="mt-1 text-xs text-muted-foreground">Missing secure wrappers: {MISSING_SECURE_WRAPPERS.join(", ")}.</p>
    </div>
  );
}

function UnavailableHint({ data }: { data: OptionalViewData | undefined }) {
  if (!data?.unavailableReason) return null;
  return <p className="mt-2 text-xs text-muted-foreground">This view is partially unavailable: {data.unavailableReason}</p>;
}

async function readOptionalView(viewName: string): Promise<OptionalViewData> {
  const result = await supabase.from(viewName).select("*");
  if (result.error) {
    return { rows: [], unavailableReason: result.error.message };
  }
  return { rows: (result.data ?? []) as Row[], unavailableReason: null };
}

function OptionalViewCard({ title, viewName, data }: { title: string; viewName: string; data: OptionalViewData | undefined }) {
  return (
    <SectionCard title={title} description={`Source: ${viewName}`}>
      {data?.unavailableReason ? (
        <p className="text-sm text-muted-foreground">Unavailable: {data.unavailableReason}</p>
      ) : (
        <GenericTable rows={data?.rows ?? []} emptyText="No records found." />
      )}
    </SectionCard>
  );
}

function KnownColumnsTable({ rows, columns, emptyText }: { rows: Row[]; columns: string[]; emptyText: string }) {
  const availableColumns = columns.filter((column) => rows.some((row) => row[column] !== undefined));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  if (availableColumns.length === 0) return <GenericTable rows={rows} emptyText={emptyText} />;
  return <GenericDataTable rows={rows} columns={availableColumns} />;
}

function GenericTable({ rows, emptyText }: { rows: Row[]; emptyText: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const columns = Object.keys(rows[0] ?? {});
  if (columns.length === 0) return <p className="text-sm text-muted-foreground">Data exists but has no displayable fields.</p>;
  return <GenericDataTable rows={rows} columns={columns} />;
}

function GenericDataTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border/70 text-muted-foreground">{columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{titleize(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${index}-${row.id ?? "row"}`} className="border-b border-border/40 last:border-0">{columns.map((column) => <td key={`${index}-${column}`} className="px-2 py-2 text-foreground">{formatValue(row[column])}</td>)}</tr>)}</tbody></table></div>;
}

function titleize(value: string) { return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function formatValue(value: string | number | boolean | null | undefined) { return value === null || value === undefined || value === "" ? "—" : String(value); }
