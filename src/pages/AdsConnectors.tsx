import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "@/hooks/use-toast";

type Primitive = string | number | boolean | null;
type Row = Record<string, Primitive | Primitive[] | Record<string, unknown>>;
type OptionalViewData = { rows: Row[]; unavailableReason: string | null };
type ConnectorKey = "meta" | "google" | "tiktok";
type ConnectorState = { loading: boolean; error: string | null };
type SyncRunState = { loading: boolean; error: string | null; success: string | null; details: Record<string, unknown> | null };

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

const CONNECTOR_FN: Record<ConnectorKey, string> = {
  meta: "meta-oauth-start",
  google: "google-ads-oauth-start",
  tiktok: "tiktok-oauth-start",
};

export default function AdsConnectors() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const { capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);
  const canManage = capabilities.can_manage_bindings;
  const [connectorState, setConnectorState] = useState<Record<ConnectorKey, ConnectorState>>({
    meta: { loading: false, error: null },
    google: { loading: false, error: null },
    tiktok: { loading: false, error: null },
  });

  const [syncRunState, setSyncRunState] = useState<SyncRunState>({
    loading: false,
    error: null,
    success: null,
    details: null,
  });

  const query = useQuery({
    queryKey: ["ads-connectors-workspace", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const [readiness, snapshot, adBindings, syncRules, syncDue, adsSummary, adsDaily, adsAnomalies, fbHealth, fbForms, fbLeads, fbSyncRuns] = await Promise.all([
        readOptionalView("v_production_backend_readiness"),
        readOptionalView("v_production_backend_snapshot"),
        readOptionalView("v_ad_account_bindings"),
        readOptionalView("v_ads_scheduled_sync_rules"),
        readOptionalView("v_ads_scheduled_sync_due"),
        readOptionalView("v_ai_ads_summary_context"),
        readOptionalView("v_ai_ads_daily_context"),
        readOptionalView("v_ai_ads_anomaly_candidates"),
        readOptionalView("v_facebook_lead_ads_health"),
        readOptionalView("v_facebook_lead_forms"),
        readOptionalView("v_facebook_leads_recent"),
        readOptionalView("v_facebook_lead_sync_runs_recent"),
      ]);

      return { readiness, snapshot, adBindings, syncRules, syncDue, adsSummary, adsDaily, adsAnomalies, fbHealth, fbForms, fbLeads, fbSyncRuns };
    },
  });

  const overview = useMemo(() => ({
    readiness: query.data?.readiness.rows[0],
    snapshot: query.data?.snapshot.rows[0],
    adsHealth: query.data?.adsSummary.rows[0] ?? query.data?.adsAnomalies.rows[0],
  }), [query.data]);


  const runScheduledSync = async () => {
    setSyncRunState({ loading: true, error: null, success: null, details: null });
    const { data, error } = await supabase.functions.invoke("ads-scheduled-sync-run", {
      body: { workspace_id: WORKSPACE_ID },
    });

    if (error) {
      setSyncRunState({ loading: false, error: error.message, success: null, details: null });
      toast({ title: "Scheduled sync failed", description: error.message, variant: "destructive" });
      return;
    }

    const details = toObject(data);
    const message =
      readString(details, "message") ??
      readString(details, "status") ??
      "Scheduled sync submitted securely.";

    setSyncRunState({ loading: false, error: null, success: message, details });
    toast({ title: "Scheduled sync submitted", description: message });

    await Promise.all([
      query.refetch(),
      queryClient.invalidateQueries({ queryKey: ["ads-connectors-workspace", WORKSPACE_ID] }),
      queryClient.invalidateQueries({ queryKey: ["ads-health"] }),
      queryClient.invalidateQueries({ queryKey: ["scheduled-sync"] }),
      queryClient.invalidateQueries({ queryKey: ["ads-readiness"] }),
    ]);
  };

  const connect = async (connector: ConnectorKey) => {
    setConnectorState((prev) => ({ ...prev, [connector]: { loading: true, error: null } }));
    const { data, error } = await supabase.functions.invoke(CONNECTOR_FN[connector], {
      body: { workspace_id: WORKSPACE_ID },
    });

    if (error) {
      setConnectorState((prev) => ({ ...prev, [connector]: { loading: false, error: error.message } }));
      return;
    }

    const payload = toObject(data);
    const url = readString(payload, "authorization_url") ?? readString(payload, "authorizationUrl") ?? readString(payload, "url");
    if (!url) {
      setConnectorState((prev) => ({ ...prev, [connector]: { loading: false, error: "OAuth URL was not returned by the secure edge function." } }));
      return;
    }

    window.location.href = url;
  };

  return (
    <DashboardLayout title="Ads Connectors" subtitle="Manage ads OAuth connections, account bindings, scheduled sync, and ads health context.">
      {!session ? (
        <SectionCard title="Ads Connectors" description="Authentication required">
          <p className="text-sm text-muted-foreground">You are signed out. Sign in to access Ads Connectors.</p>
        </SectionCard>
      ) : query.isLoading ? (
        <SectionCard title="Ads Connectors" description="Loading data">
          <p className="text-sm text-muted-foreground">Loading ads connectors workspace…</p>
        </SectionCard>
      ) : query.error ? (
        <SectionCard title="Ads Connectors" description="Error state">
          <p className="text-sm text-destructive">Could not load ads connectors workspace: {query.error.message}</p>
        </SectionCard>
      ) : (
        <>
        {roleLoading ? <p className="text-xs text-muted-foreground">Loading workspace role permissions…</p> : null}
        {!roleLoading && !canManage ? <p className="text-xs text-muted-foreground">You do not have permission to manage ads connectors.</p> : null}
        {!roleLoading && roleError ? <p className="text-xs text-muted-foreground">Workspace role unavailable. Write actions are disabled for safety.</p> : null}
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="connections">Connections</TabsTrigger>
            <TabsTrigger value="ad-accounts">Ad Accounts</TabsTrigger>
            <TabsTrigger value="scheduled-sync">Scheduled Sync</TabsTrigger>
            <TabsTrigger value="facebook-lead-ads">Facebook Lead Ads</TabsTrigger>
            <TabsTrigger value="ads-health">Ads Health</TabsTrigger>
            <TabsTrigger value="recent-issues">Recent Issues</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <SectionCard title="Overview" description="Connector and ads health snapshot">
              <div className="grid gap-3 text-sm md:grid-cols-2 lg:grid-cols-3">
                <ReadinessField label="ads_connector_status" value={readString(overview.snapshot, "ads_connector_status")} />
                <ReadinessField label="production_backend_status" value={readString(overview.snapshot, "production_backend_status") ?? readString(overview.readiness, "production_backend_status")} />
                <ReadinessField label="latest_ads_health" value={formatValue(overview.adsHealth)} />
              </div>
              {readString(overview.snapshot, "ads_connector_status") === "no_active_connections" && (
                <p className="mt-3 text-sm text-muted-foreground">Connect a real ads account to activate ads data.</p>
              )}
            </SectionCard>
          </TabsContent>

          <TabsContent value="connections"><SectionCard title="Connections" description="Use secure OAuth start edge functions.">
            <div className="grid gap-3 md:grid-cols-2">
              <ConnectorCard name="Meta Ads" description="Connect via secure Meta OAuth start function." state={connectorState.meta} onConnect={() => void connect("meta")} canManage={canManage} />
              <ConnectorCard name="Google Ads" description="Connect via secure Google Ads OAuth start function." state={connectorState.google} onConnect={() => void connect("google")} canManage={canManage} />
              <ConnectorCard name="TikTok Ads" description="Connect via secure TikTok OAuth start function." state={connectorState.tiktok} onConnect={() => void connect("tiktok")} canManage={canManage} />
              <div className="rounded-md border border-border/70 p-3 text-sm">
                <p className="font-medium">Facebook Lead Ads</p>
                <p className="mt-1 text-muted-foreground">Uses Meta Ads connection in the current backend model.</p>
                <Button type="button" className="mt-3" disabled>Managed through Meta Ads connection</Button>
              </div>
            </div>
          </SectionCard></TabsContent>

          <TabsContent value="ad-accounts"><SectionCard title="Ad Accounts" description="Connected ad accounts">
            <OptionalKnownColumns data={query.data?.adBindings} columns={["platform", "ad_account_name", "external_account_id", "client_name", "project_name", "funnel_name", "mapping_status", "binding_status", "confidence", "created_at", "updated_at"]} emptyText="No ad account bindings found." />
          </SectionCard></TabsContent>

          <TabsContent value="scheduled-sync"><SectionCard title="Scheduled Sync" description="Scheduled sync status">
            <div className="space-y-4">
              <OptionalKnownColumns data={query.data?.syncRules} columns={["platform", "cadence", "schedule", "status", "last_run_at", "next_run_at", "updated_at"]} emptyText="No scheduled sync rules found." />
              <OptionalKnownColumns data={query.data?.syncDue} columns={["platform", "status", "last_run_at", "next_run_at", "due_status", "is_due"]} emptyText="No scheduled sync due records found." />
              <div className="rounded-md border border-dashed border-border/70 bg-muted/30 p-3">
                <Button type="button" onClick={() => void runScheduledSync()} disabled={!session || !canManage || !capabilities.can_run_ads_scheduled_sync || syncRunState.loading}>
                  {syncRunState.loading ? "Running scheduled sync…" : "Run scheduled sync"}
                </Button>
                <p className="mt-2 text-xs text-muted-foreground">Scheduled sync is checked securely on submit.</p>
                {syncRunState.success && <p className="mt-2 text-xs text-emerald-700">{syncRunState.success}</p>}
                {syncRunState.error && <p className="mt-2 text-xs text-destructive">{syncRunState.error}</p>}
                {syncRunState.details && (
                  <pre className="mt-2 overflow-x-auto rounded bg-background p-2 text-xs text-muted-foreground">
                    {JSON.stringify(syncRunState.details, null, 2)}
                  </pre>
                )}
              </div>
            </div>
          </SectionCard></TabsContent>

          <TabsContent value="facebook-lead-ads"><div className="space-y-4">
            <OptionalViewCard title="Lead Ads Health" viewName="v_facebook_lead_ads_health" data={query.data?.fbHealth} emptyText="No Facebook Lead Ads health records found." />
            <OptionalViewCard title="Lead Forms" viewName="v_facebook_lead_forms" data={query.data?.fbForms} emptyText="No Facebook lead forms found." />
            <OptionalViewCard title="Recent Leads" viewName="v_facebook_leads_recent" data={query.data?.fbLeads} emptyText="No recent Facebook leads found." />
            <OptionalViewCard title="Sync Runs (Recent)" viewName="v_facebook_lead_sync_runs_recent" data={query.data?.fbSyncRuns} emptyText="No recent Facebook lead sync runs found." />
          </div></TabsContent>

          <TabsContent value="ads-health"><div className="space-y-4">
            <OptionalViewCard title="Ads Summary Context" viewName="v_ai_ads_summary_context" data={query.data?.adsSummary} emptyText="No ads summary context records found." />
            <OptionalViewCard title="Ads Daily Context" viewName="v_ai_ads_daily_context" data={query.data?.adsDaily} emptyText="No ads daily context records found." />
            <OptionalViewCard title="Ads Anomaly Candidates" viewName="v_ai_ads_anomaly_candidates" data={query.data?.adsAnomalies} emptyText="No ads anomaly candidates found." />
          </div></TabsContent>

          <TabsContent value="recent-issues"><SectionCard title="Recent Issues / Empty states" description="Partial availability and connector issues">
            <ul className="list-disc space-y-1 pl-5 text-sm text-muted-foreground">
              {collectUnavailableViews(query.data).length === 0 ? <li>No unavailable optional views detected.</li> : collectUnavailableViews(query.data).map((item) => <li key={item}>{item}</li>)}
              {Object.entries(connectorState).map(([connector, state]) => state.error ? <li key={connector}>{connector}: {state.error}</li> : null)}
            </ul>
          </SectionCard></TabsContent>
        </Tabs>
        </>
      )}
    </DashboardLayout>
  );
}

async function readOptionalView(viewName: string): Promise<OptionalViewData> {
  const result = await supabase.from(viewName).select("*").eq("workspace_id", WORKSPACE_ID).limit(200);
  if (result.error) return { rows: [], unavailableReason: result.error.message };
  return { rows: ((result.data ?? []) as Row[]), unavailableReason: null };
}

function ReadinessField({ label, value }: { label: string; value: string | null | undefined }) {
  return <div className="rounded-md border border-border/70 bg-card/60 p-3"><p className="text-xs uppercase tracking-wide text-muted-foreground">{label}</p><p className="mt-1 font-medium">{value ?? "Unavailable"}</p></div>;
}
function ConnectorCard({ name, description, state, onConnect, canManage }: { name: string; description: string; state: ConnectorState; onConnect: () => void; canManage: boolean }) {
  return <div className="rounded-md border border-border/70 p-3 text-sm"><p className="font-medium">{name}</p><p className="mt-1 text-muted-foreground">{description}</p><Button type="button" className="mt-3" onClick={onConnect} disabled={state.loading || !canManage}>{state.loading ? "Connecting…" : "Connect"}</Button>{state.error && <p className="mt-2 text-xs text-destructive">{state.error}</p>}</div>;
}
function OptionalViewCard({ title, viewName, data, emptyText }: { title: string; viewName: string; data: OptionalViewData | undefined; emptyText: string }) {
  return <SectionCard title={title} description="Details">{data?.unavailableReason ? <p className="text-sm text-muted-foreground">Unavailable: {data.unavailableReason}</p> : <GenericTable rows={data?.rows ?? []} emptyText={emptyText} />}</SectionCard>;
}
function OptionalKnownColumns({ data, columns, emptyText }: { data: OptionalViewData | undefined; columns: string[]; emptyText: string }) {
  if (!data) return <p className="text-sm text-muted-foreground">Unavailable.</p>;
  if (data.unavailableReason) return <p className="text-sm text-muted-foreground">Unavailable: {data.unavailableReason}</p>;
  const filtered = columns.filter((column) => data.rows.some((row) => row[column] !== undefined));
  return filtered.length === 0 ? <GenericTable rows={data.rows} emptyText={emptyText} /> : <GenericDataTable rows={data.rows} columns={filtered} />;
}
function GenericTable({ rows, emptyText }: { rows: Row[]; emptyText: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const columns = Object.keys(rows[0] ?? {});
  if (columns.length === 0) return <p className="text-sm text-muted-foreground">Data exists but has no displayable fields.</p>;
  return <GenericDataTable rows={rows} columns={columns} />;
}
function GenericDataTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border/70 text-muted-foreground">{columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{titleize(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${index}-${String(row.id ?? "row")}`} className="border-b border-border/40 last:border-0">{columns.map((column) => <td key={`${index}-${column}`} className="px-2 py-2 text-foreground">{formatValue(row[column])}</td>)}</tr>)}</tbody></table></div>;
}
function titleize(value: string) { return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function formatValue(value: unknown): string { if (value === null || value === undefined || value === "") return "—"; return typeof value === "object" ? JSON.stringify(value) : String(value); }
function toObject(value: unknown): Record<string, unknown> { return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : {}; }
function readString(row: Row | Record<string, unknown> | undefined, key: string): string | null { const value = row?.[key]; return typeof value === "string" ? value : null; }

function collectUnavailableViews(data: { [k: string]: OptionalViewData } | undefined): string[] {
  if (!data) return [];
  return Object.entries(data)
    .filter(([, value]) => value && typeof value === "object" && "unavailableReason" in value && value.unavailableReason)
    .map(([name, value]) => `${name}: ${value.unavailableReason}`);
}
