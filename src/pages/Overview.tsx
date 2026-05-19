import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

type SnapshotValue = string | number | boolean | null;
type BackendSnapshotRow = Record<string, SnapshotValue>;
type UiBackendContractRow = Record<string, SnapshotValue>;

const KNOWN_SNAPSHOT_FIELDS = [
  "technical_status",
  "failed_checks",
  "production_backend_status",
  "onboarding_status",
  "binding_status",
  "mapping_review_status",
  "telegram_hitl_status",
  "telegram_production_status",
  "operational_alerts_status",
  "ads_connector_status",
] as const;

export default function Overview() {
  const { session } = useAuth();
  const { role, capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);

  const readinessQuery = useQuery({
    queryKey: ["backend-readiness", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_production_backend_snapshot")
        .select("*")
        .eq("workspace_id", WORKSPACE_ID)
        .maybeSingle();
      if (error) throw error;
      return (data as BackendSnapshotRow | null) ?? null;
    },
  });

  const uiContractQuery = useQuery({
    queryKey: ["ui-backend-contract", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const result = await supabase.from("v_ui_backend_contract").select("*").eq("workspace_id", WORKSPACE_ID).limit(20);
      if (result.error) return { unavailableReason: result.error.message, rows: [] as UiBackendContractRow[] };
      return { unavailableReason: null, rows: (result.data ?? []) as UiBackendContractRow[] };
    },
  });

  return (
    <DashboardLayout title="Overview" subtitle="Production readiness, contract status, and workspace access summary">
      <div className="space-y-4">
        <FilterBar freshness={{ source: "v_production_backend_snapshot", status: "fresh", lastSync: "live" }} />

        <SectionCard title="Backend readiness" description="Source: v_production_backend_snapshot">
          {!session ? (
            <p className="text-sm text-muted-foreground">Sign in to view backend readiness status for this workspace.</p>
          ) : readinessQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading backend readiness…</p>
          ) : readinessQuery.error ? (
            <p className="text-sm text-destructive">Could not load backend readiness: {readinessQuery.error.message}</p>
          ) : !readinessQuery.data ? (
            <p className="text-sm text-muted-foreground">No backend readiness snapshot found for workspace {WORKSPACE_ID}.</p>
          ) : (
            <>
              <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
                {KNOWN_SNAPSHOT_FIELDS.map((field) => (
                  <ReadinessField key={field} label={field} value={readinessQuery.data[field]} />
                ))}
              </div>

              <AdditionalSnapshotFields row={readinessQuery.data} />

              {(readinessQuery.data.ads_connector_status !== undefined || readinessQuery.data.production_backend_status === "ads_setup_required") ? (
                <p className="mt-3 text-xs text-muted-foreground">
                  Ads connector guidance: if <span className="font-medium">ads_connector_status</span> is
                  <span className="font-medium"> no_active_connections</span>, connect a real ads account to activate ads data.
                </p>
              ) : null}
            </>
          )}
          <p className="mt-3 text-xs text-muted-foreground">If <span className="font-medium">production_backend_status</span> is not ready, module actions remain gated.</p>
        </SectionCard>

        <SectionCard title="UI Backend Contract" description="Source: v_ui_backend_contract">
          {!session ? (
            <p className="text-sm text-muted-foreground">Sign in to load UI contract status.</p>
          ) : uiContractQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading UI backend contract…</p>
) : uiContractQuery.data?.unavailableReason ? (
            <div className="rounded-md border border-warning/30 bg-warning-soft p-3 text-sm text-warning-foreground">
              <p>UI backend contract is currently unavailable.</p>
              <details className="mt-2 text-xs text-muted-foreground">
                <summary className="cursor-pointer">Technical details</summary>
                <p className="mt-2 break-words">{uiContractQuery.data.unavailableReason}</p>
              </details>
            </div>
          ) : (uiContractQuery.data?.rows.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">UI backend contract unavailable.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {uiContractQuery.data?.rows.map((row, idx) => (
                <div key={idx} className="rounded-md border border-border/70 bg-card/60 p-2">
                  {Object.entries(row).map(([key, value]) => (
                    <p key={key}><span className="font-medium">{key}:</span> {String(value ?? "—")}</p>
                  ))}
                </div>
              ))}
            </div>
          )}
        </SectionCard>

        <SectionCard title="Module readiness and role summary" description="Pre-live inventory and role-aware capability summary">
          <div className="grid gap-2 text-sm md:grid-cols-2">
            {["Production Readiness", "Onboarding", "Bindings / Mapping", "Telegram / Alerts", "Ads Connectors", "AI Assistant"].map((module) => <p key={module}>✅ {module}</p>)}
          </div>
          <div className="mt-3 rounded-md border border-border/70 bg-muted/30 p-3 text-xs text-muted-foreground">
            {roleLoading ? "Loading workspace role…" : roleError ? "Workspace role unavailable." : <>Current role: <span className="font-medium text-foreground">{role ?? "unknown"}</span><br />Capabilities: {Object.entries(capabilities).filter(([, enabled]) => enabled).map(([name]) => name).join(", ") || "none"}</>}
          </div>
          <p className="mt-3 text-xs text-muted-foreground">Only deferred infra item after live preview: Infra Task 6B (remove Lovable auth wrapper/package after OAuth verification).</p>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

function ReadinessField({ label, value }: { label: string; value: SnapshotValue | undefined }) {
  const displayValue = value === undefined ? "Not provided by current backend snapshot" : value ?? "—";
  return <div className="rounded-md border border-border/70 bg-card/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium break-words">{String(displayValue)}</p></div>;
}

function AdditionalSnapshotFields({ row }: { row: BackendSnapshotRow }) {
  const additional = Object.entries(row).filter(([key]) => !KNOWN_SNAPSHOT_FIELDS.includes(key as (typeof KNOWN_SNAPSHOT_FIELDS)[number]));

  if (additional.length === 0) return null;

  return (
    <div className="mt-3 rounded-md border border-border/70 bg-card/30 p-3">
      <p className="mb-2 text-xs font-medium text-muted-foreground">Additional backend snapshot fields</p>
      <div className="space-y-1 text-xs">
        {additional.map(([key, value]) => (
          <p key={key}><span className="font-medium">{key}:</span> {value ?? "—"}</p>
        ))}
      </div>
    </div>
  );
}
