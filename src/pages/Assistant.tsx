import { Fragment, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useMutation } from "@tanstack/react-query";
import { Archive, Check, Copy, History, Loader2, Send, Sparkles } from "lucide-react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetDescription, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Textarea } from "@/components/ui/textarea";
import { useAuth } from "@/auth/AuthProvider";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { supabase } from "@/integrations/supabase/client";
import { FriendlyError } from "@/components/common/DeveloperDetails";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { OPTIONS, resolveAssistantContextWithHistory, type ContextOption } from "@/lib/assistantRouting";
import { buildConversationHistory, buildConversationThreadMetadata, type ChatMessage, type ConversationHistoryPayload, type ConversationThreadMetadata } from "@/lib/assistantConversation";
import { parseClientCopySegments, serializeAnswerForWholeCopy, stripLeadingContextLabel } from "@/lib/assistantAnswerParsing";
import { createMessagePreview, createSessionTitle, getRecentHistoryCutoff, groupSessionsByRecency, messageFromRow, optionFromPersistedMetadata, type AiChatMessageRow, type AiChatSession } from "@/lib/assistantChatHistory";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

const SHOW_ASSISTANT_DEV_CONTROLS = false;

const PROMPT_KEYS = ["assistantPromptSevenDayDrop", "assistantPromptCampaignsAttention", "assistantPromptCplIncrease", "assistantPromptDataQuality", "assistantPromptClientSituation", "assistantPromptTeamPriorities"] as const;
const CHAT_COLUMN_CLASS = "mx-auto w-full max-w-4xl";

type SupabaseTableQuery = {
  select: (columns?: string) => SupabaseTableQuery;
  insert: (values: unknown) => SupabaseTableQuery;
  update: (values: unknown) => SupabaseTableQuery;
  eq: (column: string, value: unknown) => SupabaseTableQuery;
  is: (column: string, value: unknown) => SupabaseTableQuery;
  gte: (column: string, value: unknown) => SupabaseTableQuery;
  order: (column: string, options?: { ascending?: boolean }) => SupabaseTableQuery;
  limit: (count: number) => SupabaseTableQuery;
  single: () => Promise<{ data: { id: string }; error: Error | null }>;
  then: PromiseLike<{ data: unknown; error: Error | null }>["then"];
};

type AssistantHistoryClient = {
  from: (table: "ai_chat_sessions" | "ai_chat_messages") => SupabaseTableQuery;
};

const assistantHistoryClient = supabase as unknown as AssistantHistoryClient;

export default function Assistant() {
  const { session } = useAuth();
  const { capabilities, isLoading: roleLoading } = useWorkspaceRole(WORKSPACE_ID);
  const { t, lang } = useI18n();
  const [selected] = useState<(typeof OPTIONS)[number]["labelKey"]>("assistantContextAdsHealth");
  const manualOverrideEnabled = SHOW_ASSISTANT_DEV_CONTROLS && false;
  const [prompt, setPrompt] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [currentSessionId, setCurrentSessionId] = useState<string | null>(null);
  const [isHistoryDrawerOpen, setIsHistoryDrawerOpen] = useState(false);
  const [sessions, setSessions] = useState<AiChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const selectedOption = useMemo(() => OPTIONS.find((o) => o.labelKey === selected) ?? OPTIONS[0], [selected]);
  const activeRunId = useRef(0);
  const pendingSessionId = useRef<string | null>(null);
  const isSubmittingRef = useRef(false);
  const sessionCreationPromiseRef = useRef<Promise<string | null> | null>(null);
  const loadSessions = useCallback(async () => {
    if (!session?.user?.id) return;
    setLoadingSessions(true);
    const { data, error } = await assistantHistoryClient
      .from("ai_chat_sessions")
      .select("id, workspace_id, user_id, title, last_message_preview, last_context_label, last_request_type, last_context_scope, created_at, updated_at, archived_at")
      .eq("workspace_id", WORKSPACE_ID)
      .eq("user_id", session.user.id)
      .is("archived_at", null)
      .gte("updated_at", getRecentHistoryCutoff())
      .order("updated_at", { ascending: false })
      .limit(30);
    if (error) {
      console.debug("AI chat history load failed", error);
    } else {
      setSessions((data ?? []) as AiChatSession[]);
    }
    setLoadingSessions(false);
  }, [session?.user?.id]);

  useEffect(() => {
    void loadSessions();
  }, [loadSessions]);

  const ensureSession = async (submittedPrompt: string): Promise<string | null> => {
    if (currentSessionId) return currentSessionId;
    if (sessionCreationPromiseRef.current) return sessionCreationPromiseRef.current;
    if (!session?.user?.id) return null;

    const creationPromise = assistantHistoryClient
      .from("ai_chat_sessions")
      .insert({ workspace_id: WORKSPACE_ID, user_id: session.user.id, title: createSessionTitle(submittedPrompt), last_message_preview: createMessagePreview(submittedPrompt) })
      .select("id")
      .single()
      .then(({ data, error }) => {
        if (error) {
          console.debug("AI chat session create failed", error);
          return null;
        }
        setCurrentSessionId(data.id);
        void loadSessions();
        return data.id as string;
      })
      .finally(() => {
        sessionCreationPromiseRef.current = null;
      });

    sessionCreationPromiseRef.current = creationPromise;
    return creationPromise;
  };

  const saveChatMessage = async (sessionId: string | null, message: ChatMessage) => {
    if (!sessionId || !session?.user?.id) return;
    const { error } = await assistantHistoryClient.from("ai_chat_messages").insert({
      session_id: sessionId,
      workspace_id: WORKSPACE_ID,
      user_id: session.user.id,
      role: message.role,
      text: message.text,
      context_label: message.contextLabel,
      request_type: message.option.requestType,
      context_scope: message.option.contextScope,
      auto_routed: message.autoRouted ?? false,
    });
    if (error) console.debug("AI chat message save failed", error);
  };

  const updateSessionMetadata = async (sessionId: string | null, message: ChatMessage) => {
    if (!sessionId) return;
    const { error } = await assistantHistoryClient
      .from("ai_chat_sessions")
      .update({
        updated_at: new Date().toISOString(),
        last_message_preview: createMessagePreview(message.text),
        last_context_label: message.contextLabel,
        last_request_type: message.option.requestType,
        last_context_scope: message.option.contextScope,
      })
      .eq("id", sessionId)
      .eq("workspace_id", WORKSPACE_ID);
    if (error) console.debug("AI chat session metadata update failed", error);
    void loadSessions();
  };

  const run = useMutation({ mutationFn: async ({ submittedPrompt, option, runId, conversationHistory, threadMetadata, sessionId }: { submittedPrompt: string; option: ContextOption; runId: number; conversationHistory: ConversationHistoryPayload[]; threadMetadata: ConversationThreadMetadata; sessionId: string | null }) => {
    const response = await supabase.functions.invoke("ai-helper-run", { body: { workspace_id: WORKSPACE_ID, request_type: option.requestType, context_scope: option.contextScope, prompt: submittedPrompt, conversation_history: conversationHistory, conversation_thread: threadMetadata } });
    if (response.error) throw response.error;
    return { payload: (response.data ?? {}) as Record<string, unknown>, option, runId, sessionId };
  }, onSuccess: ({ payload, option, runId, sessionId }) => {
    if (runId !== activeRunId.current) return;
    const assistantMessage = { id: `assistant-${Date.now()}`, role: "assistant" as const, text: getAnswerText(payload, t("assistantEmptyAnswer")), contextLabel: `${t("assistantContextPrefix")}: ${t(option.labelKey)}`, option };
    setMessages((current) => [...current, assistantMessage]);
    void saveChatMessage(sessionId ?? pendingSessionId.current, assistantMessage);
    void updateSessionMetadata(sessionId ?? pendingSessionId.current, assistantMessage);
  } });

  const canUseAi = capabilities.can_use_ai_helper;
  useEffect(() => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    textarea.style.height = "auto";
    textarea.style.height = `${Math.min(textarea.scrollHeight, 176)}px`;
  }, [prompt]);

  const runDisabled = !session || run.isPending || roleLoading || !canUseAi;
  const submitPrompt = async (value = prompt) => {
    const submittedPrompt = value.trim();
    if (!submittedPrompt || runDisabled || isSubmittingRef.current) return;
    isSubmittingRef.current = true;
    try {
      const runId = activeRunId.current + 1;
      activeRunId.current = runId;
      const previousAssistantMessage = [...messages].reverse().find((message) => message.role === "assistant") ?? null;
      const previousAssistantOption = previousAssistantMessage?.option ?? null;
      const resolvedOption = resolveAssistantContextWithHistory(submittedPrompt, selectedOption, manualOverrideEnabled, previousAssistantOption);
      const conversationHistory = buildConversationHistory(messages, t);
      const threadMetadata = buildConversationThreadMetadata(messages, previousAssistantMessage, t);
      const autoRouted = !manualOverrideEnabled && resolvedOption.labelKey !== selectedOption.labelKey;
      const userMessage = { id: `user-${Date.now()}`, role: "user" as const, text: submittedPrompt, contextLabel: `${autoRouted ? t("assistantAutoContextPrefix") : t("assistantContextPrefix")}: ${t(resolvedOption.labelKey)}`, option: resolvedOption, autoRouted };
      setMessages((current) => [...current, userMessage]);
      setPrompt("");
      const sessionId = await ensureSession(submittedPrompt);
      pendingSessionId.current = sessionId;
      void saveChatMessage(sessionId, userMessage);
      run.mutate({ submittedPrompt, option: resolvedOption, runId, conversationHistory, threadMetadata, sessionId });
    } finally {
      isSubmittingRef.current = false;
    }
  };

  const resetChat = () => {
    activeRunId.current += 1;
    setMessages([]);
    setCurrentSessionId(null);
    pendingSessionId.current = null;
    sessionCreationPromiseRef.current = null;
    isSubmittingRef.current = false;
    setPrompt("");
    run.reset();
  };



  const loadChatSession = async (sessionId: string) => {
    setLoadingMessages(true);
    const { data, error } = await assistantHistoryClient
      .from("ai_chat_messages")
      .select("id, session_id, workspace_id, user_id, role, text, context_label, request_type, context_scope, auto_routed, created_at")
      .eq("session_id", sessionId)
      .eq("workspace_id", WORKSPACE_ID)
      .order("created_at", { ascending: true });
    if (error) {
      console.debug("AI chat messages load failed", error);
    } else {
      setMessages(((data ?? []) as AiChatMessageRow[]).map((row) => messageFromRow(row, t)));
      setCurrentSessionId(sessionId);
      pendingSessionId.current = sessionId;
      setIsHistoryDrawerOpen(false);
      run.reset();
    }
    setLoadingMessages(false);
  };

  const archiveChatSession = async (sessionId: string) => {
    const { error } = await assistantHistoryClient
      .from("ai_chat_sessions")
      .update({ archived_at: new Date().toISOString() })
      .eq("id", sessionId)
      .eq("workspace_id", WORKSPACE_ID);
    if (error) {
      console.debug("AI chat archive failed", error);
      return;
    }
    setSessions((current) => current.filter((item) => item.id !== sessionId));
    if (currentSessionId === sessionId) resetChat();
  };

  const showStarterPrompts = messages.length === 0 && !run.isPending && prompt.trim().length === 0;
  const showNewChat = messages.length > 0 || prompt.trim().length > 0 || Boolean(run.error);

  return <DashboardLayout title={t("assistantTitle")} subtitle={t("assistantSubtitle")} actions={<div className="flex items-center gap-2"><Button type="button" variant="outline" size="sm" className="rounded-full" onClick={() => { setIsHistoryDrawerOpen(true); void loadSessions(); }}><History className="mr-1.5 h-3.5 w-3.5" />{t("assistantHistory")}</Button>{showNewChat ? <Button type="button" variant="outline" size="sm" className="rounded-full" onClick={resetChat}>{t("assistantNewChat")}</Button> : null}</div>}>
    <ChatHistoryDrawer open={isHistoryDrawerOpen} onOpenChange={setIsHistoryDrawerOpen} sessions={sessions} currentSessionId={currentSessionId} loading={loadingSessions || loadingMessages} onSelect={loadChatSession} onArchive={archiveChatSession} t={t} lang={lang} />
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


function ChatHistoryDrawer({ open, onOpenChange, sessions, currentSessionId, loading, onSelect, onArchive, t, lang }: { open: boolean; onOpenChange: (open: boolean) => void; sessions: AiChatSession[]; currentSessionId: string | null; loading: boolean; onSelect: (sessionId: string) => void; onArchive: (sessionId: string) => void; t: (key: TranslationKey) => string; lang: "uk" | "en" }) {
  const grouped = groupSessionsByRecency(sessions);
  const groups = [
    { title: t("assistantHistoryGroupToday"), items: grouped.today },
    { title: t("assistantHistoryGroupYesterday"), items: grouped.yesterday },
    { title: t("assistantHistoryGroupLastSevenDays"), items: grouped.lastSevenDays },
    { title: t("assistantHistoryGroupEarlier"), items: grouped.earlier },
  ];

  return <Sheet open={open} onOpenChange={onOpenChange}>
    <SheetContent side="right" className="flex w-full flex-col gap-0 p-0 sm:max-w-md">
      <SheetHeader className="border-b px-5 py-4 text-left">
        <SheetTitle>{t("assistantHistoryTitle")}</SheetTitle>
        <SheetDescription>{t("assistantHistorySubtitle")}</SheetDescription>
      </SheetHeader>
      <div className="flex-1 overflow-y-auto px-4 py-4">
        {loading ? <div className="flex items-center gap-2 rounded-2xl bg-muted/50 px-3 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" />{t("assistantHistoryLoading")}</div> : null}
        {!loading && sessions.length === 0 ? <p className="rounded-2xl border border-dashed bg-muted/30 px-4 py-6 text-center text-sm text-muted-foreground">{t("assistantHistoryEmpty")}</p> : null}
        <div className="space-y-5">
          {groups.map((group) => group.items.length > 0 ? <section key={group.title} className="space-y-2">
            <h3 className="px-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">{group.title}</h3>
            <div className="space-y-2">
              {group.items.map((session) => <div key={session.id} className={`group rounded-2xl border p-3 shadow-sm transition ${currentSessionId === session.id ? "border-primary/45 bg-primary/5" : "border-border/50 bg-card hover:border-primary/25 hover:bg-muted/25"}`}>
                <button type="button" className="w-full text-left" onClick={() => onSelect(session.id)}>
                  <div className="flex items-start justify-between gap-3">
                    <p className="line-clamp-1 text-sm font-medium text-foreground">{session.title}</p>
                    <time className="shrink-0 text-[11px] text-muted-foreground">{formatSessionTime(session.updated_at, lang)}</time>
                  </div>
                  {session.last_message_preview ? <p className="mt-1 line-clamp-1 text-xs text-muted-foreground">{session.last_message_preview}</p> : null}
                  {getSessionContextLabel(session, t) ? <p className="mt-2 inline-flex max-w-full truncate rounded-full bg-muted/70 px-2 py-0.5 text-[10px] text-muted-foreground">{getSessionContextLabel(session, t)}</p> : null}
                </button>
                <div className="mt-2 flex justify-end">
                  <Button type="button" variant="ghost" size="sm" className="h-7 rounded-full px-2 text-[11px] text-muted-foreground" onClick={() => onArchive(session.id)}><Archive className="mr-1 h-3 w-3" />{t("assistantHistoryArchive")}</Button>
                </div>
              </div>)}
            </div>
          </section> : null)}
        </div>
      </div>
    </SheetContent>
  </Sheet>;
}

function getSessionContextLabel(session: AiChatSession, t: (key: TranslationKey) => string) {
  const option = optionFromPersistedMetadata(session.last_request_type, session.last_context_scope);
  if (session.last_request_type && session.last_context_scope && option.requestType === session.last_request_type && option.contextScope === session.last_context_scope) {
    return `${t("assistantContextPrefix")}: ${t(option.labelKey)}`;
  }
  return session.last_context_label;
}

function formatSessionTime(value: string, lang: "uk" | "en") {
  const locale = lang === "en" ? "en-US" : "uk-UA";
  return new Intl.DateTimeFormat(locale, { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(value));
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

  return <div className="flex w-full justify-start"><div className="w-full rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm shadow-sm"><AiAnswer text={message.text} /><AssistantMessageActions message={message} /></div></div>;
}

function getAnswerText(payload: Record<string, unknown>, fallback: string) {
  const answer = String(payload.answer ?? payload.summary ?? payload.response ?? payload.text ?? "") || fallback;
  return stripLeadingContextLabel(answer);
}

function AssistantMessageActions({ message }: { message: ChatMessage }) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const copyAnswer = async () => {
    await navigator.clipboard.writeText(serializeAnswerForWholeCopy(message.text));
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };

  return <div className="mt-3 flex items-center gap-2 border-t pt-2"><Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-2 text-xs" onClick={copyAnswer}>{copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}{copied ? t("assistantCopied") : t("assistantCopy")}</Button></div>;
}

function AiAnswer({ text }: { text: string }) {
  const segments = parseClientCopySegments(text);
  return <div className="space-y-3 text-sm leading-relaxed">{segments.map((segment, segmentIndex) => {
    if (segment.type === "client-copy") return <ClientCopyBlock key={segmentIndex} text={segment.text} />;

    const blocks = parseMarkdownBlocks(segment.text);
    return <Fragment key={segmentIndex}>{blocks.map((block, i) => {
    if (block.type === "heading") return <h3 key={i} className="pt-1 font-semibold tracking-tight">{renderBold(block.items[0])}</h3>;
    if (block.type === "bullets") return <ul key={i} className="list-disc space-y-1 pl-5">{block.items.map((item, j) => <li key={j}>{renderBold(item)}</li>)}</ul>;
    if (block.type === "numbers") return <ol key={i} className="list-decimal space-y-1 pl-5">{block.items.map((item, j) => <li key={j}>{renderBold(item)}</li>)}</ol>;
    return <p key={i}>{renderBold(block.items.join(" "))}</p>;
    })}</Fragment>;
  })}</div>;
}

function ClientCopyBlock({ text }: { text: string }) {
  const { t, lang } = useI18n();
  const [copied, setCopied] = useState(false);
  const copyClientText = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    window.setTimeout(() => setCopied(false), 1600);
  };
  const blocks = parseMarkdownBlocks(text);

  return <div className="rounded-2xl border border-primary/20 bg-primary/5 p-3 shadow-sm">
    <div className="mb-2 flex items-center justify-between gap-3">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Текст для клієнта</p>
      <Button type="button" variant="ghost" size="sm" className="h-8 rounded-full px-2 text-xs" aria-label="Скопіювати текст для клієнта" onClick={copyClientText}>{copied ? <Check className="mr-1 h-3.5 w-3.5" /> : <Copy className="mr-1 h-3.5 w-3.5" />}{copied ? t("assistantCopied") : t("assistantCopy")}</Button>
    </div>
    <div className="space-y-2">{blocks.map((block, i) => {
      if (block.type === "heading") return <h4 key={i} className="font-semibold tracking-tight">{renderBold(block.items[0])}</h4>;
      if (block.type === "bullets") return <ul key={i} className="list-disc space-y-1 pl-5">{block.items.map((item, j) => <li key={j}>{renderBold(item)}</li>)}</ul>;
      if (block.type === "numbers") return <ol key={i} className="list-decimal space-y-1 pl-5">{block.items.map((item, j) => <li key={j}>{renderBold(item)}</li>)}</ol>;
      return <p key={i}>{renderBold(block.items.join(" "))}</p>;
    })}</div>
  </div>;
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
