import { Fragment, useMemo, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Bot, Send, Sparkles, User } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/auth/AuthProvider";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import { FriendlyError } from "@/components/common/DeveloperDetails";
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
  const { capabilities, isLoading: roleLoading } = useWorkspaceRole(WORKSPACE_ID);
  const { t } = useI18n();
  const [selected, setSelected] = useState<(typeof OPTIONS)[number]["labelKey"]>("assistantContextFullOverview");
  const [prompt, setPrompt] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const selectedOption = useMemo(() => OPTIONS.find((o) => o.labelKey === selected) ?? OPTIONS[0], [selected]);
  const run = useMutation({ mutationFn: async (submittedPrompt: string) => {
    const response = await supabase.functions.invoke("ai-helper-run", { body: { workspace_id: WORKSPACE_ID, request_type: selectedOption.requestType, context_scope: selectedOption.contextScope, prompt: submittedPrompt } });
    if (response.error) throw response.error;
    return (response.data ?? {}) as Record<string, unknown>;
  }, onSuccess: (r) => {
    setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", text: getAnswerText(r, t("assistantEmptyAnswer")), contextLabel: t(selectedOption.labelKey) }]);
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
      <SectionCard className="min-h-[72vh]" contentClassName="flex min-h-[72vh] flex-col p-0">
        <div className="flex-1 space-y-4 overflow-y-auto p-4 sm:p-5 lg:p-6">
          {messages.length === 0 ? <Welcome t={t} onPrompt={(value) => setPrompt(value)} /> : messages.map((message) => <MessageBubble key={message.id} message={message} />)}
          {run.isPending ? <div className="flex items-start gap-3"><div className="rounded-full bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div><div className="rounded-2xl rounded-tl-sm border bg-muted/40 px-4 py-3 text-sm text-muted-foreground">{t("assistantThinking")}</div></div> : null}
          {run.error ? <FriendlyError message={t("assistantError")} technical={run.error.message} /> : null}
          {!roleLoading && !canUseAi ? <p className="rounded-md border bg-muted/40 p-3 text-sm text-muted-foreground">{t("assistantNoAccess")}</p> : null}
        </div>
        <div className="sticky bottom-0 border-t border-border/60 bg-background/95 p-4 shadow-sm backdrop-blur sm:p-5">
          <div className="mx-auto max-w-4xl">
            <div className="rounded-3xl border bg-card p-2 shadow-sm focus-within:border-primary/50">
              <Textarea value={prompt} onChange={(e) => setPrompt(e.target.value)} className="min-h-20 resize-none border-0 bg-transparent shadow-none focus-visible:ring-0" placeholder={t("assistantComposerPlaceholder")} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submitPrompt(); }} />
              <div className="flex flex-col gap-2 px-2 pb-1 sm:flex-row sm:items-center sm:justify-between">
                <Select value={selected} onValueChange={(v: (typeof OPTIONS)[number]["labelKey"]) => setSelected(v)}><SelectTrigger aria-label={t("assistantContextLabel")} className="h-8 w-full rounded-full text-xs sm:w-[14rem]"><SelectValue /></SelectTrigger><SelectContent>{OPTIONS.map((o) => <SelectItem key={`${o.requestType}-${o.contextScope}-${o.labelKey}`} value={o.labelKey}>{t(o.labelKey)}</SelectItem>)}</SelectContent></Select>
                <Button className="shrink-0 rounded-full" onClick={() => submitPrompt()} disabled={runDisabled || !prompt.trim()}><Send className="mr-2 h-4 w-4" />{run.isPending ? t("assistantSending") : t("assistantSend")}</Button>
              </div>
            </div>
            <p className="mt-2 px-2 text-center text-xs text-muted-foreground">{t("assistantSafetyNote")}</p>
          </div>
        </div>
      </SectionCard>
    </div>
  </DashboardLayout>;
}

function Welcome({ t, onPrompt }: { t: (key: TranslationKey) => string; onPrompt: (value: string) => void }) {
  return <div className="mx-auto flex min-h-[42vh] max-w-3xl flex-col items-center justify-center py-6 text-center sm:py-8 lg:py-10"><div className="mb-3 rounded-full bg-primary/10 p-3 text-primary"><Sparkles className="h-6 w-6" /></div><h2 className="text-2xl font-semibold">{t("assistantWelcomeTitle")}</h2><p className="mt-2 max-w-2xl text-sm text-muted-foreground">{t("assistantWelcome")}</p><div className="mt-6 grid w-full gap-2 sm:grid-cols-2">{PROMPT_KEYS.map((key) => <button key={key} type="button" onClick={() => onPrompt(t(key))} className="rounded-xl border bg-card p-3 text-left text-sm font-medium transition hover:border-primary/50 hover:bg-primary/5">{t(key)}</button>)}</div></div>;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return <div className={`flex items-start gap-3 ${isUser ? "justify-end" : "justify-start"}`}>{!isUser ? <div className="rounded-full bg-primary/10 p-2 text-primary"><Bot className="h-4 w-4" /></div> : null}<div className={`max-w-[82%] rounded-2xl px-4 py-3 text-sm ${isUser ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm border bg-card"}`}><p className="mb-1 text-[11px] opacity-75">{message.contextLabel}</p>{isUser ? <p className="whitespace-pre-wrap">{message.text}</p> : <AiAnswer text={message.text} />}</div>{isUser ? <div className="rounded-full bg-muted p-2 text-muted-foreground"><User className="h-4 w-4" /></div> : null}</div>;
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
