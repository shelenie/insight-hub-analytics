import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

type RequestType =
  | "production_readiness_summary"
  | "onboarding_summary"
  | "mapping_review_summary"
  | "operational_alerts_summary"
  | "full_production_summary"
  | "ads_health_summary"
  | "ads_performance_summary"
  | "ads_anomaly_explanation"
  | "data_quality_summary"
  | "import_health_summary"
  | "import_error_explanation";

type ContextScope =
  | "production_readiness"
  | "onboarding"
  | "mapping_review"
  | "operational_alerts"
  | "full_production"
  | "ads_health"
  | "ads_performance"
  | "ads_anomalies"
  | "data_quality"
  | "import_health"
  | "import_errors";

type Option = { label: string; requestType: RequestType; contextScope: ContextScope };
type GenericRow = Record<string, string | number | boolean | null>;

type RunResult = {
  answerText: string | null;
  requestType: string;
  contextScope: string;
  status: string | null;
  createdAt: string | null;
  requestId: string | null;
  insightId: string | null;
  raw: Record<string, unknown>;
};

const OPTIONS: Option[] = [
  { label: "Production readiness summary", requestType: "production_readiness_summary", contextScope: "production_readiness" },
  { label: "Onboarding summary", requestType: "onboarding_summary", contextScope: "onboarding" },
  { label: "Mapping review summary", requestType: "mapping_review_summary", contextScope: "mapping_review" },
  { label: "Operational alerts summary", requestType: "operational_alerts_summary", contextScope: "operational_alerts" },
  { label: "Full production summary", requestType: "full_production_summary", contextScope: "full_production" },
  { label: "Ads health summary", requestType: "ads_health_summary", contextScope: "ads_health" },
  { label: "Ads performance summary", requestType: "ads_performance_summary", contextScope: "ads_performance" },
  { label: "Ads anomaly explanation", requestType: "ads_anomaly_explanation", contextScope: "ads_anomalies" },
  { label: "Data quality summary", requestType: "data_quality_summary", contextScope: "data_quality" },
  { label: "Import health summary", requestType: "import_health_summary", contextScope: "import_health" },
  { label: "Import error explanation", requestType: "import_error_explanation", contextScope: "import_errors" },
];

export default function Assistant() {
  const { session } = useAuth();
  const [selected, setSelected] = useState<RequestType>("production_readiness_summary");
  const [prompt, setPrompt] = useState("");
  const [latest, setLatest] = useState<RunResult | null>(null);

  const selectedOption = useMemo(() => OPTIONS.find((option) => option.requestType === selected) ?? OPTIONS[0], [selected]);

  const requestsQuery = useQuery<GenericRow[]>({
    queryKey: ["ai-helper-requests", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const result = await supabase.from("v_ai_helper_requests_recent").select("*").eq("workspace_id", WORKSPACE_ID).limit(100);
      if (result.error) throw result.error;
      return (result.data ?? []) as GenericRow[];
    },
  });

  const insightsQuery = useQuery<GenericRow[]>({
    queryKey: ["ai-helper-insights", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const result = await supabase.from("v_ai_helper_insights_recent").select("*").eq("workspace_id", WORKSPACE_ID).limit(100);
      if (result.error) throw result.error;
      return (result.data ?? []) as GenericRow[];
    },
  });

  const healthQuery = useQuery<GenericRow[]>({
    queryKey: ["ai-helper-health", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const result = await supabase.from("v_ai_helper_health").select("*").eq("workspace_id", WORKSPACE_ID).limit(20);
      if (result.error) throw result.error;
      return (result.data ?? []) as GenericRow[];
    },
  });

  const runMutation = useMutation({
    mutationFn: async (): Promise<RunResult> => {
      const response = await supabase.functions.invoke("ai-helper-run", {
        body: {
          workspace_id: WORKSPACE_ID,
          request_type: selectedOption.requestType,
          context_scope: selectedOption.contextScope,
          prompt,
        },
      });
      if (response.error) throw response.error;

      const payload = isRecord(response.data) ? response.data : {};
      return {
        answerText: firstString(payload, ["answer", "summary", "response", "text", "message"]),
        requestType: firstString(payload, ["request_type"]) ?? selectedOption.requestType,
        contextScope: firstString(payload, ["context_scope"]) ?? selectedOption.contextScope,
        status: firstString(payload, ["status"]),
        createdAt: firstString(payload, ["created_at", "createdAt"]),
        requestId: firstString(payload, ["request_id", "id"]),
        insightId: firstString(payload, ["insight_id"]),
        raw: payload,
      };
    },
    onSuccess: (result) => {
      setLatest(result);
      void requestsQuery.refetch();
      void insightsQuery.refetch();
      void healthQuery.refetch();
    },
  });

  const historyError = requestsQuery.error ?? insightsQuery.error ?? healthQuery.error;
  const runDisabled = !session || runMutation.isPending;

  return (
    <DashboardLayout title="AI Assistant" subtitle="Production helper panel for read-only operational insights">
      <div className="space-y-4">
        {!session ? (
          <SectionCard title="Signed out" description="Authentication required">
            <p className="text-sm text-muted-foreground">You are signed out. Sign in to run AI helper requests and view AI history.</p>
          </SectionCard>
        ) : null}

        <SectionCard title="AI action panel" description="Helper-only actions. No backend mutation actions are available.">
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Request type</p>
              <Select value={selected} onValueChange={(value: RequestType) => setSelected(value)}>
                <SelectTrigger>
                  <SelectValue placeholder="Select request type" />
                </SelectTrigger>
                <SelectContent>
                  {OPTIONS.map((option) => (
                    <SelectItem key={option.requestType} value={option.requestType}>{option.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground">Context scope: <span className="font-mono">{selectedOption.contextScope}</span></p>
            </div>
            <div className="space-y-2">
              <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Prompt / input</p>
              <Textarea value={prompt} onChange={(event) => setPrompt(event.target.value)} placeholder="Ask the AI helper to summarize, explain anomalies, or highlight operational issues." className="min-h-24" />
              <Button onClick={() => runMutation.mutate()} disabled={runDisabled}>
                {runMutation.isPending ? "Running…" : "Run ai-helper-run"}
              </Button>
              {runMutation.error ? <p className="text-sm text-destructive">Run failed: {runMutation.error.message}</p> : null}
            </div>
          </div>
        </SectionCard>

        <SectionCard title="Latest answer" description="Last response from ai-helper-run">
          {!latest ? (
            <p className="text-sm text-muted-foreground">No AI runs yet in this session.</p>
          ) : (
            <div className="space-y-2 text-sm">
              <p><span className="font-medium">Answer:</span> {latest.answerText ?? "No answer text returned"}</p>
              <p><span className="font-medium">Request type:</span> {latest.requestType}</p>
              <p><span className="font-medium">Context scope:</span> {latest.contextScope}</p>
              <p><span className="font-medium">Status:</span> {latest.status ?? "Unknown"}</p>
              <p><span className="font-medium">Created:</span> {latest.createdAt ?? "Unknown"}</p>
              <p><span className="font-medium">Request ID:</span> {latest.requestId ?? "N/A"}</p>
              <p><span className="font-medium">Insight ID:</span> {latest.insightId ?? "N/A"}</p>
            </div>
          )}
        </SectionCard>

        {session && (requestsQuery.isLoading || insightsQuery.isLoading || healthQuery.isLoading) ? (
          <SectionCard title="Loading" description="Loading AI helper data">
            <p className="text-sm text-muted-foreground">Loading request history, insights history, and health status…</p>
          </SectionCard>
        ) : null}

        {session && historyError ? (
          <SectionCard title="Error" description="Could not load all AI helper data">
            <p className="text-sm text-destructive">{historyError.message}</p>
          </SectionCard>
        ) : null}

        <SectionCard title="Request history" description="Source: v_ai_helper_requests_recent">
          <GenericRows rows={requestsQuery.data ?? []} emptyText="No recent AI helper requests found." />
        </SectionCard>

        <SectionCard title="Insights history" description="Source: v_ai_helper_insights_recent">
          <GenericRows rows={insightsQuery.data ?? []} emptyText="No recent AI helper insights found." />
        </SectionCard>

        <SectionCard title="AI health / status" description="Source: v_ai_helper_health">
          <GenericRows rows={healthQuery.data ?? []} emptyText="No AI helper health records found." />
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

function GenericRows({ rows, emptyText }: { rows: GenericRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="space-y-3">
      {rows.map((row, index) => (
        <div key={index} className="rounded-md border border-border/70 bg-card/60 p-3">
          {Object.entries(row).map(([key, value]) => (
            <p key={key} className="text-xs">
              <span className="font-medium">{key}:</span> {formatValue(value)}
            </p>
          ))}
        </div>
      ))}
    </div>
  );
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

function formatValue(value: string | number | boolean | null) {
  return value === null ? "null" : String(value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
