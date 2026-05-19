import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

type BackendSnapshotRow = {
  technical_status: string | null;
  failed_checks: number | null;
  production_backend_status: string | null;
  onboarding_status: string | null;
  binding_status: string | null;
  mapping_review_status: string | null;
  telegram_hitl_status: string | null;
  telegram_production_status: string | null;
  operational_alerts_status: string | null;
  ads_connector_status: string | null;
};
type UiBackendContractRow = Record<string, string | number | boolean | null>;

export default function Overview() {
  const { session } = useAuth();
  const { role, capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);

  const readinessQuery = useQuery({
    queryKey: ["backend-readiness", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_production_backend_snapshot")
        .select("technical_status, failed_checks, production_backend_status, onboarding_status, binding_status, mapping_review_status, telegram_hitl_status, telegram_production_status, operational_alerts_status, ads_connector_status")
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
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <ReadinessField label="technical_status" value={readinessQuery.data.technical_status} />
              <ReadinessField label="failed_checks" value={readinessQuery.data.failed_checks} />
              <ReadinessField label="production_backend_status" value={readinessQuery.data.production_backend_status} />
              <ReadinessField label="onboarding_status" value={readinessQuery.data.onboarding_status} />
              <ReadinessField label="binding_status" value={readinessQuery.data.binding_status} />
              <ReadinessField label="mapping_review_status" value={readinessQuery.data.mapping_review_status} />
              <ReadinessField label="telegram_hitl_status" value={readinessQuery.data.telegram_hitl_status} />
              <ReadinessField label="telegram_production_status" value={readinessQuery.data.telegram_production_status} />
              <ReadinessField label="operational_alerts_status" value={readinessQuery.data.operational_alerts_status} />
              <ReadinessField label="ads_connector_status" value={readinessQuery.data.ads_connector_status} />
            </div>
          )}
          <p className="mt-3 text-xs text-muted-foreground">If <span className="font-medium">production_backend_status</span> is not ready, module actions remain gated. For <span className="font-medium">ads_connector_status=no_active_connections</span>: Connect a real ads account to activate ads data.</p>
        </SectionCard>

        <SectionCard title="UI Backend Contract" description="Source: v_ui_backend_contract">
          {!session ? (
            <p className="text-sm text-muted-foreground">Sign in to load UI contract status.</p>
          ) : uiContractQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading UI backend contract…</p>
          ) : uiContractQuery.data?.unavailableReason ? (
            <p className="text-sm text-muted-foreground">UI backend contract unavailable: {uiContractQuery.data.unavailableReason}</p>
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

function ReadinessField({ label, value }: { label: string; value: string | number | null }) {
  return <div className="rounded-md border border-border/70 bg-card/40 p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="font-medium">{value ?? "—"}</p></div>;
}
