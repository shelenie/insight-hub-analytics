import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { DeveloperDetails, FriendlyError } from "@/components/common/DeveloperDetails";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, unknown>;

export default function Overview() {
  const { session } = useAuth();
  const readiness = useQuery({ queryKey: ["backend-readiness", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const { data, error } = await supabase.from("v_production_backend_snapshot").select("*").eq("workspace_id", WORKSPACE_ID).maybeSingle();
    if (error) throw error;
    return (data as Row | null) ?? null;
  }});
  const contract = useQuery({ queryKey: ["ui-backend-contract", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const result = await supabase.from("v_ui_backend_contract").select("*").eq("workspace_id", WORKSPACE_ID).limit(20);
    return { rows: (result.data ?? []) as Row[], unavailableReason: result.error?.message ?? null };
  }});

  const r = readiness.data ?? {};
  const cards = [
    ["System status", r.technical_status === "PASS" ? "System is working" : "System status is being checked"],
    ["Data connection status", Number(r.failed_checks ?? 1) === 0 ? "No technical issues found" : "Some checks still need attention"],
    ["Onboarding status", String(r.onboarding_status ?? "unknown") === "ready" ? "Onboarding data is ready" : "Onboarding setup is in progress"],
    ["Ads data status", String(r.production_backend_status) === "ads_setup_required" ? "Ads accounts still need to be connected" : "Ads data status looks good"],
    ["AI assistant status", String(r.ai_helper_status ?? "ready") === "ready" ? "AI assistant is available" : "AI assistant status is being checked"],
    ["Alerts status", String(r.operational_alerts_status ?? "ready") === "ready" ? "Alerts are active" : "Alerts need attention"],
  ];

  return <DashboardLayout title="Overview" subtitle="Workspace summary">
    <div className="space-y-4">
      {!session ? <SectionCard title="Overview"><p className="text-sm text-muted-foreground">Sign in to view your workspace summary.</p></SectionCard> : readiness.isLoading ? <SectionCard title="Overview"><p className="text-sm text-muted-foreground">Loading dashboard…</p></SectionCard> : null}
      {readiness.error ? <FriendlyError message="Could not load this section yet." technical={readiness.error.message} /> : null}
      {session && !readiness.error && !readiness.isLoading ? <SectionCard title="Workspace health"><div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">{cards.map(([title, desc]) => <div key={title} className="rounded-md border border-border/70 bg-card/40 p-3"><p className="text-xs text-muted-foreground">{title}</p><p className="font-medium">{desc}</p></div>)}</div>{String(r.snapshot_status) === "ads_setup_required" ? <p className="mt-3 text-sm text-muted-foreground">Setup required: connect ads accounts.</p> : null}</SectionCard> : null}
      <DeveloperDetails>
        {contract.data?.unavailableReason ? <p>Developer contract is currently unavailable.</p> : <p>Developer contract loaded: {(contract.data?.rows.length ?? 0)} row(s).</p>}
        {contract.data?.unavailableReason ? <p className="break-words mt-2">{contract.data.unavailableReason}</p> : null}
        <pre className="mt-2 max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify({ readiness: readiness.data, contract: contract.data?.rows ?? [] }, null, 2)}</pre>
      </DeveloperDetails>
    </div>
  </DashboardLayout>;
}
