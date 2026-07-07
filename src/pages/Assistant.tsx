import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Send, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
const CHAT_COLUMN_CLASS = "mx-auto w-full max-w-4xl";

export default function Assistant() {
  const { session } = useAuth();
  const { capabilities, isLoading: roleLoading } = useWorkspaceRole(WORKSPACE_ID);
  const { t } = useI18n();
  const [selected, setSelected] = useState<(typeof OPTIONS)[number]["labelKey"]>("assistantContextFullOverview");
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const selectedOption = useMemo(() => OPTIONS.find((o) => o.labelKey === selected) ?? OPTIONS[0], [selected]);
  const activeRunId = useRef(0);
  const run = useMutation({ mutationFn: async ({ submittedPrompt, option, runId }: { submittedPrompt: string; option: ContextOption; runId: number }) => {
    const response = await supabase.functions.invoke("ai-helper-run", { body: { workspace_id: WORKSPACE_ID, request_type: option.requestType, context_scope: option.contextScope, prompt: submittedPrompt } });
    if (response.error) throw response.error;
    return { payload: (response.data ?? {}) as Record<string, unknown>, option, runId };
  }, onSuccess: ({ payload, option, runId }) => {
    if (runId !== activeRunId.current) return;
    setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", text: getAnswerText(payload, t("assistantEmptyAnswer")), contextLabel: t(option.labelKey) }]);
  } });

  const canUseAi = capabilities.can_use_ai_helper;
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 176)}px`;
  }, [prompt]);

  const runDisabled = !session || run.isPending || roleLoading || !canUseAi;
  const submitPrompt = (value = prompt) => {
    const submittedPrompt = value.trim();
    if (!submittedPrompt || runDisabled) return;
    const runId = activeRunId.current + 1;
    activeRunId.current = runId;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text: submittedPrompt, contextLabel: t(selectedOption.labelKey) }]);
    setPrompt("");
    run.mutate({ submittedPrompt, option: selectedOption, runId });
  };

  const resetChat = () => {
    activeRunId.current += 1;
    setMessages([]);
    setPrompt("");
    run.reset();
  };

  const showStarterPrompts = messages.length === 0 && !run.isPending && prompt.trim().length === 0;
  const showNewChat = messages.length > 0 || prompt.trim().length > 0 || Boolean(run.error);

  return <DashboardLayout title={t("assistantTitle")} subtitle={t("assistantSubtitle")}>
    <div className="mx-auto flex w-full max-w-5xl flex-col px-1">
      <div className="mb-3 flex justify-end">
        {showNewChat ? <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={resetChat}>{t("assistantNewChat")}</Button> : null}
      </div>
      <div className="flex flex-col justify-start pt-1 sm:pt-2 lg:pt-3">
        <div className={`${CHAT_COLUMN_CLASS} space-y-3`}>
          {messages.length === 0 ? <Welcome t={t} /> : messages.map((message) => <MessageBubble key={message.id} message={message} />)}
          {run.isPending ? <div className="rounded-2xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground shadow-sm">{t("assistantThinking")}</div> : null}
          {run.error ? <div className={CHAT_COLUMN_CLASS}><FriendlyError message={t("assistantError")} technical={run.error.message} /></div> : null}
          {!roleLoading && !canUseAi ? <p className="rounded-2xl bg-muted/50 p-3 text-sm text-muted-foreground shadow-sm">{t("assistantNoAccess")}</p> : null}
        </div>
        <div className={`${CHAT_COLUMN_CLASS} mt-4 sm:mt-5`}>
          <div className="rounded-[1.75rem] border border-border/40 bg-card/95 p-2 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 transition focus-within:border-primary/35 focus-within:ring-2 focus-within:ring-primary/20">
            <Textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={1} className="!min-h-12 max-h-44 resize-none overflow-y-auto border-0 bg-transparent px-3 py-3 text-base leading-6 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:ring-0 sm:text-sm" placeholder={t("assistantComposerPlaceholder")} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submitPrompt(); }} />
            <div className="flex items-center justify-between gap-2 px-1 pb-1 pt-1">
              <Select value={selected} onValueChange={(v: (typeof OPTIONS)[number]["labelKey"]) => setSelected(v)}><SelectTrigger aria-label={t("assistantContextLabel")} className="h-8 max-w-[13rem] rounded-full border-border/50 bg-background/75 px-3 text-xs shadow-none"><SelectValue /></SelectTrigger><SelectContent>{OPTIONS.map((o) => <SelectItem key={`${o.requestType}-${o.contextScope}-${o.labelKey}`} value={o.labelKey}>{t(o.labelKey)}</SelectItem>)}</SelectContent></Select>
              <Button size="icon" className="h-9 w-9 shrink-0 rounded-full" aria-label={run.isPending ? t("assistantSending") : t("assistantSend")} onClick={() => submitPrompt()} disabled={runDisabled || !prompt.trim()}><Send className="h-4 w-4" /></Button>
            </div>
          </div>
          {showStarterPrompts ? <StarterPrompts t={t} onPrompt={submitPrompt} disabled={runDisabled} /> : null}
          <p className="mt-3 px-2 text-center text-xs text-muted-foreground">{t("assistantSafetyNote")}</p>
        </div>
      </div>
    </div>
  </DashboardLayout>;
}

function Welcome({ t }: { t: (key: TranslationKey) => string }) {
  return <div className="mx-auto flex max-w-3xl flex-col items-center justify-start text-center"><div className="mb-2 rounded-full bg-primary/10 p-3 text-primary shadow-sm"><Sparkles className="h-6 w-6" /></div><h2 className="text-2xl font-semibold tracking-tight sm:text-3xl">{t("assistantWelcomeTitle")}</h2><p className="mt-2 max-w-2xl text-sm leading-6 text-muted-foreground">{t("assistantWelcome")}</p></div>;
}

function StarterPrompts({ t, onPrompt, disabled }: { t: (key: TranslationKey) => string; onPrompt: (value: string) => void; disabled: boolean }) {
  return <div className="mt-3 grid w-full gap-2 sm:grid-cols-2">{PROMPT_KEYS.map((key) => <button key={key} type="button" onClick={() => onPrompt(t(key))} disabled={disabled} className="rounded-full border border-border/45 bg-background/75 px-4 py-2 text-left text-sm font-medium shadow-sm shadow-foreground/5 transition hover:border-primary/35 hover:bg-primary/5 disabled:cursor-not-allowed disabled:opacity-50">{t(key)}</button>)}</div>;
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === "user";
  return <div className={`flex w-full ${isUser ? "justify-end" : "justify-start"}`}><div className={`max-w-full rounded-2xl px-4 py-3 text-sm sm:max-w-[82%] ${isUser ? "rounded-tr-sm bg-primary text-primary-foreground" : "rounded-tl-sm border bg-card shadow-sm"}`}><p className="mb-1 text-[11px] opacity-75">{message.contextLabel}</p>{isUser ? <p className="whitespace-pre-wrap">{message.text}</p> : <AiAnswer text={message.text} />}</div></div>;
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
