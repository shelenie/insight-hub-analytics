import { Fragment, useMemo, useState } from "react";
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
// types omitted for brevity
const OPTIONS = [
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
] as const;

export default function Assistant() {
  const { session } = useAuth();
  const { role, capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);
  const [selected, setSelected] = useState<(typeof OPTIONS)[number]["requestType"]>(OPTIONS[0].requestType);
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

  return <DashboardLayout title="AI-асистент" subtitle="Поставте питання по даних робочого простору">
    <div className="space-y-4">
      <SectionCard title="Запитати Insight Hub AI">
        <p className="text-xs text-muted-foreground mb-2">Тип запиту</p>
        <Select value={selected} onValueChange={(v: (typeof OPTIONS)[number]["requestType"]) => setSelected(v)}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OPTIONS.map((o) => <SelectItem key={o.requestType} value={o.requestType}>{o.label}</SelectItem>)}</SelectContent></Select>
        <p className="text-xs text-muted-foreground mt-3 mb-2">Ваше питання</p>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-24" placeholder="Запитайте про тренди, аномалії, якість даних, імпорти або готовність системи." />
        <Button className="mt-3" onClick={() => run.mutate()} disabled={runDisabled}>{run.isPending ? "Обробляємо…" : "Запитати AI"}</Button>
        {!roleLoading && !canUseAi ? <p className="mt-2 text-sm text-muted-foreground">You do not have access to this AI action.</p> : null}
        {run.error ? <FriendlyError message="Цей розділ поки недоступний." technical={run.error.message} /> : null}
      </SectionCard>

      <SectionCard title="Остання відповідь">{!latest ? <p className="text-sm text-muted-foreground">У цій сесії ще немає відповідей AI.</p> : <AiAnswer text={String(latest.answer ?? latest.summary ?? latest.response ?? latest.text ?? "") || "Відповідь поки відсутня."} />}</SectionCard>
      <SectionCard title="Попередні відповіді AI">{(requests.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">Попередніх відповідей ще немає.</p> : <div className="space-y-2">{(requests.data ?? []).map((r: Record<string, unknown>, i: number) => <div key={i} className="rounded border p-3 text-sm"><p className="font-medium">{String(r.title ?? "Відповідь AI")}</p>{r.result_summary ? <p className="mt-1 text-muted-foreground">{String(r.result_summary)}</p> : null}{r.created_at ? <p className="mt-1 text-xs text-muted-foreground">{new Date(String(r.created_at)).toLocaleString()}</p> : null}{String(r.status ?? "") === "completed" ? <p className="mt-1 text-xs text-emerald-700">Готово</p> : null}<DeveloperDetails><pre className="max-h-48 overflow-auto whitespace-pre-wrap">{JSON.stringify(r, null, 2)}</pre></DeveloperDetails></div>)}</div>}</SectionCard>

      <DeveloperDetails>
        <p>Role: {role ?? "unknown"}</p>
        <p>Capabilities: {JSON.stringify(capabilities)}</p>
        {roleError ? <p className="break-words">Role error: {roleError.message}</p> : null}
        {latest ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(latest, null, 2)}</pre> : null}
      </DeveloperDetails>
    </div>
  </DashboardLayout>;
}

function AiAnswer({ text }: { text: string }) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  const blocks: Array<{ type: "p" | "li"; text: string }> = [];
  for (const line of lines) {
    if (/^(?:[-*]|\d+\.)\s+/.test(line)) blocks.push({ type: "li", text: line.replace(/^(?:[-*]|\d+\.)\s+/, "") });
    else blocks.push({ type: "p", text: line });
  }
  const li = blocks.filter((b) => b.type === "li");
  const p = blocks.filter((b) => b.type === "p");
  return <div className="space-y-2 text-sm">{p.map((b, i) => <p key={i}>{renderBold(b.text)}</p>)}{li.length ? <ul className="list-disc pl-5">{li.map((b, i) => <li key={i}>{renderBold(b.text)}</li>)}</ul> : null}</div>;
}

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}
