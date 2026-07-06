import { Fragment, useMemo, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Bot, Clock, History, Send, Sparkles, User } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/auth/AuthProvider";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import { DeveloperDetails, FriendlyError } from "@/components/common/DeveloperDetails";
import { filterPlaceholderRows } from "@/lib/demoFilters";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

type ContextOption = {
  labelKey: "assistantContextFullOverview" | "assistantContextAdsPerformance" | "assistantContextAdsAnomalies" | "assistantContextDataQuality" | "assistantContextImportStatus" | "assistantContextMappingReview" | "assistantContextAlerts" | "assistantContextClientsFunnels" | "assistantContextAdsHealth" | "assistantContextSystemReadiness";
  requestType: string;
  contextScope: string;
};

type ChatMessage = { id: string; role: "user" | "assistant"; text: string; contextLabel: string };

const OPTIONS = [
  { labelKey: "assistantContextFullOverview", requestType: "full_production_summary", contextScope: "full_production" },
  { labelKey: "assistantContextAdsPerformance", requestType: "ads_performance_summary", contextScope: "ads_performance" },
  { labelKey: "assistantContextAdsAnomalies", requestType: "ads_anomaly_explanation", contextScope: "ads_anomalies" },
  { labelKey: "assistantContextDataQuality", requestType: "data_quality_summary", contextScope: "data_quality" },
  { labelKey: "assistantContextImportStatus", requestType: "import_health_summary", contextScope: "import_health" },
  { labelKey: "assistantContextMappingReview", requestType: "mapping_review_summary", contextScope: "mapping_review" },
  { labelKey: "assistantContextAlerts", requestType: "operational_alerts_summary", contextScope: "operational_alerts" },
  { labelKey: "assistantContextClientsFunnels", requestType: "onboarding_summary", contextScope: "onboarding" },
  { labelKey: "assistantContextAdsHealth", requestType: "ads_health_summary", contextScope: "ads_health" },
  { labelKey: "assistantContextSystemReadiness", requestType: "production_readiness_summary", contextScope: "production_readiness" },
] as const satisfies readonly ContextOption[];

const PROMPT_KEYS = ["assistantPromptSevenDayDrop", "assistantPromptCampaignsAttention", "assistantPromptCplIncrease", "assistantPromptDataQuality", "assistantPromptClientSituation", "assistantPromptTeamPriorities"] as const;

export default function Assistant() {
  const { session } = useAuth();
  const { role, capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);
  const { t, lang } = useI18n();
  const [selected, setSelected] = useState<(typeof OPTIONS)[number]["labelKey"]>("assistantContextFullOverview");
  const [prompt, setPrompt] = useState("");
  const [latest, setLatest] = useState<Record<string, unknown> | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const selectedOption = useMemo(() => OPTIONS.find((o) => o.labelKey === selected) ?? OPTIONS[0], [selected]);
  const requestLabelByType = useMemo(() => Object.fromEntries(OPTIONS.map((o) => [o.requestType, t(o.labelKey)])), [t]);

  const requests = useQuery({ queryKey: ["ai-helper-requests", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => (await supabase.from("v_ai_helper_requests_recent").select("*").eq("workspace_id", WORKSPACE_ID).limit(20)).data ?? [] });
  const run = useMutation({ mutationFn: async (submittedPrompt: string) => {
    const response = await supabase.functions.invoke("ai-helper-run", { body: { workspace_id: WORKSPACE_ID, request_type: selectedOption.requestType, context_scope: selectedOption.contextScope, prompt: submittedPrompt } });
    if (response.error) throw response.error;
    return (response.data ?? {}) as Record<string, unknown>;
  }, onSuccess: (r) => {
    setLatest(r);
    setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", text: getAnswerText(r, t("assistantEmptyAnswer")), contextLabel: t(selectedOption.labelKey) }]);
    void requests.refetch();
  } });

  const canUseAi = capabilities.can_use_ai_helper;
  const runDisabled = !session || run.isPending || roleLoading || !canUseAi;
  const submitPrompt = (value = prompt) => {
    const submittedPrompt = value.trim();
    if (!submittedPrompt || runDisabled) return;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text: submittedPrompt, contextLabel: t(selectedOption.labelKey) }]);
    setPrompt("");
    run.mutate(submittedPrompt);
  };

  return <DashboardLayout title={t("assistantTitle")} subtitle={t("assistantSubtitle")}>
    <div className="mx-auto flex max-w-6xl flex-col gap-3">
      <div className="flex justify-end">
        <HistoryPanel rows={filterPlaceholderRows((requests.data ?? []) as Record<string, unknown>[])} labels={requestLabelByType} t={t} lang={lang} />
      </div>

      <SectionCard className="min-h-[74vh]" contentClassName="flex min-h-[74vh] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-6">
          {messages.length === 0 ? <Welcome t={t} onPrompt={(value) => setPrompt(value)} /> : messages.map((message) => <MessageBubble key={message.id} message={message} />)}
          {run.isPending ? <div className="flex items-start gap-3"><div className="rounded-full bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div><div className="rounded-2xl rounded-tl-sm border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{t("assistantThinking")}</div></div> : null}
          {run.error ? <FriendlyError message={t("assistantError")} technical={run.error.message} /> : null}
          {!roleLoading && !canUseAi ? <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{t("assistantNoAccess")}</p> : null}
        </div>
        <div className="sticky bottom-0 border-t border-border/60 bg-background/95 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="mx-auto max-w-4xl">
            <div className="mb-3 flex flex-wrap items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">{t("assistantContextLabel")}</span>
              <Select value={selected} onValueChange={(v: (typeof OPTIONS)[number]["labelKey"]) => setSelected(v)}><SelectTrigger className="h-8 w-full max-w-[16rem] rounded-full"><SelectValue /></SelectTrigger><SelectContent>{OPTIONS.map((o) => <SelectItem key={`${o.requestType}-${o.contextScope}-${o.labelKey}`} value={o.labelKey}>{t(o.labelKey)}</SelectItem>)}</SelectContent></Select>
            </div>
            <div className="rounded-3xl border bg-card p-2 shadow-sm focus-within:border-primary/50">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder={t("assistantComposerPlaceholder")} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submitPrompt(); }} />
              <div className="flex items-center justify-between gap-3 px-2 pb-1">
                <p className="text-xs text-muted-foreground">{t("assistantSafetyNote")}</p>
                <Button className="shrink-0 rounded-full" onClick={() => submitPrompt()} disabled={runDisabled || !prompt.trim()}><Send className="mr-2 h-4 w-4" />{run.isPending ? t("assistantSending") : t("assistantSend")}</Button>
              </div>
            </div>
          </div>
        </div>
      </SectionCard>

      <DeveloperDetails title={t("assistantTechnicalDetails")}>
        <p>Role: {role ?? "unknown"}</p>
        <p>Capabilities: {JSON.stringify(capabilities)}</p>
        {roleError ? <p className="break-words">Role error: {roleError.message}</p> : null}
        {latest ? <pre className="max-h-64 overflow-auto whitespace-pre-wrap">{JSON.stringify(latest, null, 2)}</pre> : null}
      </DeveloperDetails>
    </div>
  </DashboardLayout>;
}

function Welcome({ t, onPrompt }: { t: (key: TranslationKey) => string; onPrompt: (value: string) => void }) {
  return <div className="mx-auto flex max-w-3xl flex-col items-center py-10 text-center"><div className="mb-4 rounded-full bg-primary/10 p-3 text-primary"><Sparkles className="h-6 w-6" /></div><h2 className="text-2xl font-semibold">{t("assistantWelcomeTitle")}</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("assistantWelcome")}</p><p className="mt-3 max-w-2xl text-xs text-muted-foreground/80">{t("assistantSafetyNote")}</p><div className="mt-6 grid w-full gap-2 sm:grid-cols-2">{PROMPT_KEYS.map((key) => <button key={key} type="button" onClick={() => onPrompt(t(key))} className="rounded-xl border bg-card p-3 text-left text-sm font-medium transition hover:border-primary/50 hover:bg-primary/5">{t(key)}</button>)}</div></div>;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return <div className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}>{!isUser ? <div className="rounded-full bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div> : null}<div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${isUser ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm border bg-card"}`}><p className="mb-1 text-[11px] opacity-75">{message.contextLabel}</p>{isUser ? <p className="whitespace-pre-wrap">{message.text}</p> : <AiAnswer text={message.text} />}</div>{isUser ? <div className="rounded-full bg-muted p-2 text-muted-foreground"><User className="h-4 w-4" /></div> : null}</div>;
}

function HistoryPanel({ rows, labels, t, lang }: { rows: Record<string, unknown>[]; labels: Record<string, string>; t: (key: TranslationKey) => string; lang: "uk" | "en" }) {
  return <details className="group relative z-10"><summary className="flex cursor-pointer list-none items-center gap-2 rounded-full border bg-background px-4 py-2 text-sm font-medium text-muted-foreground shadow-sm transition hover:border-primary/40 hover:text-foreground"><History className="h-4 w-4" />{t("assistantHistoryToggle")}</summary><div className="absolute right-0 mt-2 w-[min(24rem,calc(100vw-2rem))] rounded-2xl border bg-card p-4 shadow-xl"><div className="mb-3"><p className="font-medium">{t("assistantHistoryTitle")}</p><p className="text-xs text-muted-foreground">{t("assistantHistoryDescription")}</p></div><HistoryList rows={rows} labels={labels} t={t} lang={lang} /></div></details>;
}

function HistoryList({ rows, labels, t, lang }: { rows: Record<string, unknown>[]; labels: Record<string, string>; t: (key: TranslationKey) => string; lang: "uk" | "en" }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{t("assistantHistoryEmpty")}</p>;
  return <div className="space-y-2">{rows.slice(0, 3).map((r, i) => { const title = String(r.title ?? t("assistantHistoryDefaultTitle")); const requestType = typeof r.request_type === "string" ? labels[r.request_type] ?? r.request_type : t("assistantContextFullOverview"); const status = String(r.status ?? r.state ?? "saved"); return <div key={i} className="rounded-lg border p-3 text-sm"><p className="font-medium">{title}</p><p className="mt-1 text-xs text-muted-foreground">{requestType}</p>{r.created_at ? <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground"><Clock className="h-3 w-3" />{new Date(String(r.created_at)).toLocaleString(lang === "uk" ? "uk-UA" : "en-US")}</p> : null}<p className="mt-1 text-xs text-muted-foreground">{status === "failed" ? t("assistantHistoryFailed") : t("assistantHistorySaved")}</p><DeveloperDetails title={t("assistantTechnicalDetails")}><pre className="max-h-48 overflow-auto whitespace-pre-wrap">{JSON.stringify(r, null, 2)}</pre></DeveloperDetails></div>; })}</div>;
}

function getAnswerText(payload: Record<string, unknown>, fallback: string) {
  return String(payload.answer ?? payload.summary ?? payload.response ?? payload.text ?? "") || fallback;
}

function AiAnswer({ text }: { text: string }) {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("{") && !l.endsWith("}"));
  return <div className="space-y-2 text-sm leading-relaxed">{lines.map((line, i) => {
    if (/^##\s+/.test(line)) return <p key={i} className="font-semibold">{renderBold(line.replace(/^##\s+/, ""))}</p>;
    if (/^(?:[-*•])\s+/.test(line)) return <ul key={i} className="list-disc pl-5"><li>{renderBold(line.replace(/^(?:[-*•])\s+/, ""))}</li></ul>;
    return <p key={i}>{renderBold(line)}</p>;
  })}</div>;
}

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}
