import { ReactNode, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/auth/AuthProvider";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
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
type GenericRow = Record<string, unknown>;

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

const PRIMARY_FIELDS = ["title", "request_type", "status", "requested_actor_email", "result_summary", "confidence", "created_at", "processed_at", "error_message"] as const;
const DETAILS_FIELDS = ["input_payload", "ai_result", "metadata"] as const;

export default function Assistant() {
  const { session } = useAuth();
  const { capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);
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
  const canUseAi = capabilities.can_use_ai_helper;
  const runDisabled = !session || runMutation.isPending || roleLoading || !canUseAi;

  return (
    <DashboardLayout title="AI Assistant" subtitle="Production helper panel for read-only operational insights">
      <div className="space-y-4">
        {session && historyError ? (
          <SectionCard title="AI data unavailable" description="Backend returned an error for AI helper views">
            <p className="text-sm text-muted-foreground">Some AI helper records are currently unavailable.</p>
            <details className="mt-2 text-xs text-muted-foreground">
              <summary className="cursor-pointer">Technical details</summary>
              <p className="mt-2 break-words">{historyError.message}</p>
            </details>
          </SectionCard>
        ) : null}

        <SectionCard title="Request history" description="Source: v_ai_helper_requests_recent">
          <HistoryRows rows={requestsQuery.data ?? []} emptyText="No recent AI helper requests found." />
        </SectionCard>

        <SectionCard title="Insights history" description="Source: v_ai_helper_insights_recent">
          <HistoryRows rows={insightsQuery.data ?? []} emptyText="No recent AI helper insights found." />
        </SectionCard>

        <SectionCard title="AI health / status" description="Source: v_ai_helper_health">
          <HistoryRows rows={healthQuery.data ?? []} emptyText="No AI helper health records found." />
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

function HistoryRows({ rows, emptyText }: { rows: GenericRow[]; emptyText: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  return <div className="space-y-3">{rows.map((row, index) => <HistoryCard key={index} row={row} />)}</div>;
}

function HistoryCard({ row }: { row: GenericRow }) {
  const primary = PRIMARY_FIELDS.filter((field) => field in row);
  const detailFields = DETAILS_FIELDS.filter((field) => field in row);
  const extras = Object.entries(row).filter(([key]) => !PRIMARY_FIELDS.includes(key as never) && !DETAILS_FIELDS.includes(key as never));

  return (
    <div className="rounded-md border border-border/70 bg-card/60 p-3 text-xs">
      <div className="space-y-1.5">
        {primary.map((field) => (
          <DisplayField key={field} label={field} value={row[field]} />
        ))}
      </div>

      {detailFields.map((field) => (
        <details key={field} className="mt-2 rounded-md border border-border/50 bg-card/40 p-2">
          <summary className="cursor-pointer font-medium">{field}</summary>
          <div className="mt-2"><SafeValue value={row[field]} /></div>
        </details>
      ))}

      {extras.length > 0 ? (
        <details className="mt-2 rounded-md border border-border/50 bg-card/40 p-2">
          <summary className="cursor-pointer font-medium">Additional fields</summary>
          <div className="mt-2 space-y-1.5">{extras.map(([k, v]) => <DisplayField key={k} label={k} value={v} />)}</div>
        </details>
      ) : null}
    </div>
  );
}

function DisplayField({ label, value }: { label: string; value: unknown }) {
  return (
    <div>
      <span className="font-medium">{label}:</span> <SafeValue value={value} inline />
    </div>
  );
}

function SafeValue({ value, inline = false }: { value: unknown; inline?: boolean }) {
  if (value === null || value === undefined) return <span>—</span>;
  if (typeof value === "string" || typeof value === "number" || typeof value === "boolean") return <span>{String(value)}</span>;

  const content = JSON.stringify(value, null, 2);
  if (inline) return <span className="font-mono text-[11px] text-muted-foreground">[structured data]</span>;
  return <pre className="max-h-64 overflow-auto whitespace-pre-wrap rounded bg-background/60 p-2 text-[11px]">{content}</pre>;
}

function firstString(record: Record<string, unknown>, keys: string[]) {
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) return value;
  }
  return null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
