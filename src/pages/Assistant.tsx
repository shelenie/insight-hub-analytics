import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/auth/AuthProvider";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import { DeveloperDetails, FriendlyError } from "@/components/common/DeveloperDetails";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

type RequestType =
  | "production_readiness_summary" | "onboarding_summary" | "mapping_review_summary" | "operational_alerts_summary"
  | "full_production_summary" | "ads_health_summary" | "ads_performance_summary" | "ads_anomaly_explanation"
  | "data_quality_summary" | "import_health_summary" | "import_error_explanation";

type ContextScope =
  | "production_readiness" | "onboarding" | "mapping_review" | "operational_alerts" | "full_production"
  | "ads_health" | "ads_performance" | "ads_anomalies" | "data_quality" | "import_health" | "import_errors";

const OPTIONS: Array<{ label: string; requestType: RequestType; contextScope: ContextScope }> = [
  { label: "System readiness", requestType: "production_readiness_summary", contextScope: "production_readiness" },
  { label: "Clients and funnels", requestType: "onboarding_summary", contextScope: "onboarding" },
  { label: "Mapping review", requestType: "mapping_review_summary", contextScope: "mapping_review" },
  { label: "Alerts summary", requestType: "operational_alerts_summary", contextScope: "operational_alerts" },
  { label: "Full workspace summary", requestType: "full_production_summary", contextScope: "full_production" },
  { label: "Ads connection health", requestType: "ads_health_summary", contextScope: "ads_health" },
  { label: "Ads performance", requestType: "ads_performance_summary", contextScope: "ads_performance" },
  { label: "Explain ads anomaly", requestType: "ads_anomaly_explanation", contextScope: "ads_anomalies" },
  { label: "Data quality", requestType: "data_quality_summary", contextScope: "data_quality" },
  { label: "Import health", requestType: "import_health_summary", contextScope: "import_health" },
  { label: "Import errors", requestType: "import_error_explanation", contextScope: "import_errors" },
];

export default function Assistant() {
  const { session } = useAuth();
  const { role, capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);
  const [selected, setSelected] = useState<RequestType>(OPTIONS[0].requestType);
  const [prompt, setPrompt] = useState("");
  const [latest, setLatest] = useState<Record<string, unknown> | null>(null);
  const selectedOption = useMemo(() => OPTIONS.find((o) => o.requestType === selected) ?? OPTIONS[0], [selected]);

  const requests = useQuery({ queryKey: ["ai-helper-requests", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => (await supabase.from("v_ai_helper_requests_recent").select("*").eq("workspace_id", WORKSPACE_ID).limit(20)).data ?? [] });
  const run = useMutation({ mutationFn: async () => {
    const response = await supabase.functions.invoke("ai-helper-run", { body: { workspace_id: WORKSPACE_ID, request_type: selectedOption.requestType, context_scope: selectedOption.contextScope, prompt } });
    if (response.error) throw response.error;
    return (response.data ?? {}) as Record<string, unknown>;
  }, onSuccess: (r) => { setLatest(r); void requests.refetch(); } });

  const canUseAi = capabilities.can_use_ai_helper;
  const runDisabled = !session || run.isPending || roleLoading || !canUseAi;

  return <DashboardLayout title="AI Assistant" subtitle="Ask questions about your workspace data">
    <div className="space-y-4">
      <SectionCard title="Ask Insight Hub AI">
        <p className="text-xs text-muted-foreground mb-2">Question type</p>
        <Select value={selected} onValueChange={(v: RequestType) => setSelected(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OPTIONS.map((o) => <SelectItem key={o.requestType} value={o.requestType}>{o.label}</SelectItem>)}</SelectContent></Select>
        <p className="text-xs text-muted-foreground mt-3 mb-2">Your question</p>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-24" placeholder="Ask about trends, anomalies, quality, imports, or readiness." />
        <Button className="mt-3" onClick={() => run.mutate()} disabled={runDisabled}>{run.isPending ? "Processing…" : "Ask AI"}</Button>
        {!roleLoading && !canUseAi ? <p className="mt-2 text-sm text-muted-foreground">You do not have access to this AI action.</p> : null}
        {run.error ? <FriendlyError message="Could not load this section yet." technical={run.error.message} /> : null}
      </SectionCard>

      <SectionCard title="Latest answer">{!latest ? <p className="text-sm text-muted-foreground">No AI runs yet in this session.</p> : <div className="space-y-2 text-sm whitespace-pre-wrap">{String(latest.answer ?? latest.summary ?? latest.response ?? latest.text ?? "No answer text returned")}</div>}</SectionCard>
      <SectionCard title="Previous AI answers">{(requests.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No previous AI answers yet.</p> : <ul className="space-y-2">{(requests.data ?? []).map((r: Record<string, unknown>, i: number) => <li key={i} className="rounded border p-2 text-sm">{String(r.title ?? r.result_summary ?? r.status ?? "AI response")}</li>)}</ul>}</SectionCard>

      <DeveloperDetails>
        <p>Role: {role ?? "unknown"}</p>
        <p>Capabilities: {JSON.stringify(capabilities)}</p>
        {roleError ? <p className="break-words">Role error: {roleError.message}</p> : null}
        {latest ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(latest, null, 2)}</pre> : null}
      </DeveloperDetails>
    </div>
  </DashboardLayout>;
}
