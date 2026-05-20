import { useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { DeveloperDetails, FriendlyError } from "@/components/common/DeveloperDetails";
const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const OPTIONS = [{ label: "Загальний підсумок", requestType: "full_production_summary", contextScope: "full_production" }, { label: "Огляд кампаній", requestType: "ads_performance_summary", contextScope: "ads_performance" }];
export default function Assistant() {
  const { session } = useAuth();
  const [selected, setSelected] = useState(OPTIONS[0].requestType);
  const [prompt, setPrompt] = useState("");
  const [latest, setLatest] = useState<Record<string, unknown> | null>(null);
  const selectedOption = useMemo(() => OPTIONS.find((o) => o.requestType === selected) ?? OPTIONS[0], [selected]);
  const requests = useQuery({ queryKey: ["ai-helper-requests", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => (await supabase.from("v_ai_helper_requests_recent").select("*").eq("workspace_id", WORKSPACE_ID).limit(20)).data ?? [] });
  const run = useMutation({ mutationFn: async () => {
    const response = await supabase.functions.invoke("ai-helper-run", { body: { workspace_id: WORKSPACE_ID, request_type: selectedOption.requestType, context_scope: selectedOption.contextScope, prompt } });
    if (response.error) throw response.error;
    return (response.data ?? {}) as Record<string, unknown>;
  }, onSuccess: (r) => { setLatest(r); void requests.refetch(); } });
  return <DashboardLayout title="AI Assistant" subtitle="Ваш AI-помічник">
    <div className="space-y-4">
      <SectionCard title="Ask Insight Hub AI">
        <p className="text-xs text-muted-foreground mb-2">Question type</p>
        <Select value={selected} onValueChange={setSelected}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent>{OPTIONS.map((o) => <SelectItem key={o.requestType} value={o.requestType}>{o.label}</SelectItem>)}</SelectContent></Select>
        <p className="text-xs text-muted-foreground mt-3 mb-2">Your question</p>
        <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-24" placeholder="Поставте запитання про дані, кампанії або аномалії." />
        <Button className="mt-3" onClick={() => run.mutate()} disabled={!session || run.isPending}>{run.isPending ? "Processing…" : "Ask AI"}</Button>
        {run.error ? <FriendlyError message="Could not load this section yet." technical={run.error.message} /> : null}
      </SectionCard>
      <SectionCard title="Latest answer">{!latest ? <p className="text-sm text-muted-foreground">No AI runs yet in this session.</p> : <div className="space-y-2 text-sm whitespace-pre-wrap">{String(latest.answer ?? latest.summary ?? latest.response ?? latest.text ?? "No answer text returned")}</div>}</SectionCard>
      <SectionCard title="Previous AI answers">{(requests.data ?? []).length === 0 ? <p className="text-sm text-muted-foreground">No previous AI answers yet.</p> : <ul className="space-y-2">{(requests.data ?? []).map((r: Record<string, unknown>, i: number) => <li key={i} className="rounded border p-2 text-sm">{String(r.title ?? r.result_summary ?? r.status ?? "AI response")}</li>)}</ul>}</SectionCard>
      <DeveloperDetails>{latest ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(latest, null, 2)}</pre> : null}</DeveloperDetails>
    </div>
  </DashboardLayout>;
}
