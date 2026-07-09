import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Check, Copy, Send, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/auth/AuthProvider";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import { FriendlyError } from "@/components/common/DeveloperDetails";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { OPTIONS, resolveAssistantContextWithHistory, type ContextOption } from "@/lib/assistantRouting";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

const SHOW_ASSISTANT_DEV_CONTROLS = false;

const PROMPT_KEYS = ["assistantPromptSevenDayDrop", "assistantPromptCampaignsAttention", "assistantPromptCplIncrease", "assistantPromptDataQuality", "assistantPromptClientSituation", "assistantPromptTeamPriorities"] as const;
const CHAT_COLUMN_CLASS = "mx-auto w-full max-w-4xl";

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  text: string;
  contextLabel: string;
  option: ContextOption;
  autoRouted?: boolean;
};

type ConversationHistoryPayload = {
  role: "user" | "assistant";
  text: string;
  context_label: string;
  option_label: string;
  request_type: string;
  context_scope: string;
};

export default function Assistant() {
  const { session } = useAuth();
  const { capabilities, isLoading: roleLoading } = useWorkspaceRole(WORKSPACE_ID);
  const { t } = useI18n();
  const [selected] = useState<(typeof OPTIONS)[number]["labelKey"]>("assistantContextAdsHealth");
  const manualOverrideEnabled = SHOW_ASSISTANT_DEV_CONTROLS && false;
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const selectedOption = useMemo(() => OPTIONS.find((o) => o.labelKey === selected) ?? OPTIONS[0], [selected]);
  const activeRunId = useRef(0);
  const run = useMutation({ mutationFn: async ({ submittedPrompt, option, runId, conversationHistory }: { submittedPrompt: string; option: ContextOption; runId: number; conversationHistory: ConversationHistoryPayload[] }) => {
    const response = await supabase.functions.invoke("ai-helper-run", { body: { workspace_id: WORKSPACE_ID, request_type: option.requestType, context_scope: option.contextScope, prompt: submittedPrompt, conversation_history: conversationHistory } });
    if (response.error) throw response.error;
    return { payload: (response.data ?? {}) as Record<string, unknown>, option, runId };
  }, onSuccess: ({ payload, option, runId }) => {
    if (runId !== activeRunId.current) return;
    setMessages((current) => [...current, { id: `assistant-${Date.now()}`, role: "assistant", text: getAnswerText(payload, t("assistantEmptyAnswer")), contextLabel: `${t("assistantContextPrefix")}: ${t(option.labelKey)}`, option }]);
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
    const previousAssistantOption = [...messages].reverse().find((message) => message.role === "assistant")?.option ?? null;
    const resolvedOption = resolveAssistantContextWithHistory(submittedPrompt, selectedOption, manualOverrideEnabled, previousAssistantOption);
    const conversationHistory = buildConversationHistory(messages, t);
    const autoRouted = !manualOverrideEnabled && resolvedOption.labelKey !== selectedOption.labelKey;
    setMessages((current) => [...current, { id: `user-${Date.now()}`, role: "user", text: submittedPrompt, contextLabel: `${autoRouted ? t("assistantAutoContextPrefix") : t("assistantContextPrefix")}: ${t(resolvedOption.labelKey)}`, option: resolvedOption, autoRouted }]);
    setPrompt("");
    run.mutate({ submittedPrompt, option: resolvedOption, runId, conversationHistory });
  };

  const resetChat = () => {
    activeRunId.current += 1;
    setMessages([]);
    setPrompt("");
    run.reset();
  };

  const showStarterPrompts = messages.length === 0 && !run.isPending && prompt.trim().length === 0;
  const showNewChat = messages.length > 0 || prompt.trim().length > 0 || Boolean(run.error);

  return <DashboardLayout title={t("assistantTitle")} subtitle={t("assistantSubtitle")} actions={showNewChat ? <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={resetChat}>{t("assistantNewChat")}</Button> : null}>
    <div className="mx-auto flex w-full max-w-5xl flex-col px-1">
      <div className="flex flex-col justify-start pt-1 sm:pt-2 lg:pt-3">
        <div className={`${CHAT_COLUMN_CLASS} space-y-3`}>
          {messages.length === 0 ? <Welcome t={t} /> : messages.map((message) => <MessageBubble key={message.id} message={message} />)}
          {run.isPending ? <div className="rounded-2xl bg-muted/50 px-4 py-3 text-sm text-muted-foreground shadow-sm">{t("assistantThinking")}</div> : null}
          {run.error ? <div className={CHAT_COLUMN_CLASS}><FriendlyError message={t("assistantError")} technical={run.error.message} /></div> : null}
          {!roleLoading && !canUseAi ? <p className="rounded-2xl bg-muted/50 p-3 text-sm text-muted-foreground shadow-sm">{t("assistantNoAccess")}</p> : null}
        </div>
        <div className={`${CHAT_COLUMN_CLASS} mt-4 sm:mt-5`}>
          <div className="rounded-2xl border border-border/40 bg-card/95 p-2 shadow-lg shadow-foreground/5 ring-1 ring-foreground/5 transition focus-within:border-primary/35 focus-within:ring-2 focus-within:ring-primary/20">
            <Textarea ref={textareaRef} value={prompt} onChange={(e) => setPrompt(e.target.value)} rows={1} className="!min-h-12 max-h-44 resize-none overflow-y-auto border-0 bg-transparent px-3 py-3 text-base leading-6 shadow-none outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:ring-0 sm:text-sm" placeholder={t("assistantComposerPlaceholder")} onKeyDown={(event) => { if (event.key === "Enter" && (event.metaKey || event.ctrlKey)) submitPrompt(); }} />
            <div className="flex items-center justify-between gap-2 px-1 pb-1 pt-1">
              <div className="flex min-w-0 flex-1 items-center gap-2">
                <span className="truncate rounded-full bg-muted/70 px-3 py-1 text-xs text-muted-foreground">{t("assistantAutoRoutingBadge")}</span>
              </div>
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

  if (isUser) {
    return <div className="flex w-full justify-end"><div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-primary px-4 py-3 text-sm text-primary-foreground"><p className="whitespace-pre-wrap">{message.text}</p><p className="mt-2 text-[10px] text-primary-foreground/65">{message.contextLabel}</p></div></div>;
  }

  return <div className="flex w-full justify-start"><div className="w-full rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm shadow-sm"><p className="mb-2 inline-flex rounded-full bg-muted/70 px-2.5 py-1 text-[11px] text-muted-foreground">{message.contextLabel}</p><AiAnswer text={message.text} /><AssistantMessageActions message={message} /></div></div>;
}

function buildConversationHistory(messages: ChatMessage[], t: (key: TranslationKey) => string): ConversationHistoryPayload[] {
  return messages.slice(-4).map((message) => ({
    role: message.role,
    text: message.text.slice(0, 1200),
    context_label: message.contextLabel,
    option_label: t(message.option.labelKey),
    request_type: message.option.requestType,
    context_scope: message.option.contextScope,
  }));
}

function getAnswerText(payload: Record<string, unknown>, fallback: string) {
  return String(payload.answer ?? payload.summary ?? payload.response ?? payload.text ?? "") || fallback;
}

function AssistantMessageActions({ message }: { message: ChatMessage }) {
  const { t } = useI18n();
  const [copied, setCopied] = useState(false);
  const copyAnswer = async () => {
    await navigator.clipboard.writeText(message.text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return <div className="mt-3 flex items-center gap-2 border-t pt-2"><Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-2 text-xs" onClick={copyAnswer}>{copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}{copied ? t("assistantCopied") : t("assistantCopy")}</Button></div>;
}

function AiAnswer({ text }: { text: string }) {
  const blocks = parseMarkdownBlocks(text);
  return <div className="space-y-3 text-sm leading-relaxed">{blocks.map((block, i) => {
    if (block.type === "heading") return <h3 key={i} className="pt-1 font-semibold tracking-tight">{renderBold(block.items[0])}</h3>;
    if (block.type === "bullets") return <ul key={i} className="list-disc space-y-1 pl-5">{block.items.map((item, j) => <li key={j}>{renderBold(item)}</li>)}</ul>;
    if (block.type === "numbers") return <ol key={i} className="list-decimal space-y-1 pl-5">{block.items.map((item, j) => <li key={j}>{renderBold(item)}</li>)}</ol>;
    return <p key={i}>{renderBold(block.items.join(" "))}</p>;
  })}</div>;
}

type MarkdownBlock = { type: "heading" | "paragraph" | "bullets" | "numbers"; items: string[] };

function parseMarkdownBlocks(text: string): MarkdownBlock[] {
  const blocks: MarkdownBlock[] = [];
  const safeLines = text.split(/\r?\n/).map((line) => line.trim()).filter((line) => line && !/^\s*[{}[\]],?\s*$/.test(line));

  for (const line of safeLines) {
    const heading = line.match(/^#{1,3}\s+(.+)$/);
    const bullet = line.match(/^(?:[-*•])\s+(.+)$/);
    const number = line.match(/^\d+[.)]\s+(.+)$/);
    const previous = blocks[blocks.length - 1];

    if (heading) {
      blocks.push({ type: "heading", items: [heading[1]] });
    } else if (bullet) {
      if (previous?.type === "bullets") previous.items.push(bullet[1]);
      else blocks.push({ type: "bullets", items: [bullet[1]] });
    } else if (number) {
      if (previous?.type === "numbers") previous.items.push(number[1]);
      else blocks.push({ type: "numbers", items: [number[1]] });
    } else if (previous?.type === "paragraph") {
      previous.items.push(line);
    } else {
      blocks.push({ type: "paragraph", items: [line] });
    }
  }

  return blocks;
}

function renderBold(text: string) {
  return text.split(/(\*\*[^*]+\*\*)/g).map((part, i) => part.startsWith("**") && part.endsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>);
}
