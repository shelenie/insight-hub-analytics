import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translations } from "@/i18n/translations";

const source = readFileSync("src/pages/Assistant.tsx", "utf8");
const routingSource = readFileSync("src/lib/assistantRouting.ts", "utf8");
const conversationSource = readFileSync(
  "src/lib/assistantConversation.ts",
  "utf8",
);
const answerParsingSource = readFileSync(
  "src/lib/assistantAnswerParsing.ts",
  "utf8",
);

describe("AI Assistant chat UI", () => {
  it("uses i18n keys for primary chat-first visible copy", () => {
    expect(source).toContain('title={t("assistantTitle")}');
    expect(source).toContain('subtitle={t("assistantSubtitle")}');
    expect(source).toContain('t("assistantSafetyNote")');
    expect(source).toContain('placeholder={t("assistantComposerPlaceholder")}');
    expect(source).toContain('t("assistantSend")');
    expect(source).not.toContain('title="AI-асистент"');
    expect(source).not.toContain("Поставте питання по даних робочого простору");
    expect(source).not.toContain("Запитати Insight Hub AI");
    expect(source).not.toContain("Тип запиту");
  });

  it("defines performance marketing suggested prompts and technical details labels in Ukrainian and English", () => {
    expect(translations.assistantPromptSevenDayDrop.uk).toBe(
      "Що просіло за останні 7 днів?",
    );
    expect(translations.assistantPromptSevenDayDrop.en).toBe(
      "What dropped in the last 7 days?",
    );
    expect(translations.assistantPromptCampaignsAttention.uk).toBe(
      "Які кампанії потребують уваги?",
    );
    expect(translations.assistantPromptCampaignsAttention.en).toBe(
      "Which campaigns need attention?",
    );
    expect(translations.assistantPromptCplIncrease.uk).toBe(
      "Чому міг вирости CPL?",
    );
    expect(translations.assistantPromptCplIncrease.en).toBe(
      "Why might CPL have increased?",
    );
    expect(translations.assistantPromptDataQuality.uk).toBe(
      "Де є проблеми з якістю даних?",
    );
    expect(translations.assistantPromptDataQuality.en).toBe(
      "Where are the data quality issues?",
    );
    expect(translations.assistantPromptClientSituation.uk).toBe(
      "Що сказати клієнту по ситуації?",
    );
    expect(translations.assistantPromptClientSituation.en).toBe(
      "What should we tell the client about the situation?",
    );
    expect(translations.assistantPromptTeamPriorities.uk).toBe(
      "Дай пріоритети для команди на сьогодні",
    );
    expect(translations.assistantPromptTeamPriorities.en).toBe(
      "Give the team priorities for today",
    );
    expect(translations.assistantTechnicalDetails.uk).toBe("Технічні деталі");
    expect(translations.assistantWelcomeTitle.uk).toBe(
      "Що хочете проаналізувати?",
    );
    expect(translations.assistantWelcomeTitle.en).toBe(
      "What would you like to analyze?",
    );
    expect(translations.assistantSubtitle.uk).toBe(
      "AI-асистент для аналітики, реклами, імпортів, якості даних, робочих процесів і загальних питань по системі.",
    );
    expect(translations.assistantSubtitle.en).toBe(
      "AI assistant for analytics, ads, imports, data quality, workflows, and general system questions.",
    );
    expect(translations.assistantWelcome.uk).toBe(
      "Я допоможу з аналітикою, рекламою, імпортами, якістю даних, робочими процесами та загальними питаннями по системі.",
    );
    expect(translations.assistantWelcome.en).toBe(
      "I can help with analytics, ads, imports, data quality, workflows, and general questions about the system.",
    );
    expect(translations.assistantComposerPlaceholder.uk).toBe(
      "Напишіть питання про аналітику, рекламу, імпорти, якість даних, процеси або загальне пояснення…",
    );
    expect(translations.assistantComposerPlaceholder.en).toBe(
      "Ask about analytics, ads, imports, data quality, workflows, or a general explanation…",
    );
    expect(translations.assistantThinking.uk).toBe("AI готує відповідь…");
    expect(translations.assistantThinking.en).toBe(
      "AI is preparing an answer…",
    );
  });

  it("uses persistent drawer history UI and defaults to general mode with smart auto-routing", () => {
    expect(routingSource).toContain("export function resolveAssistantContext(");
    expect(routingSource).toContain(
      "export function resolveAssistantContextWithHistory(",
    );
    expect(source).toContain("assistantContextGeneral");
    expect(source).toContain("resolveAssistantContextWithHistory");
    expect(source).not.toContain(
      'useState<(typeof OPTIONS)[number]["labelKey"]>("assistantContextFullOverview")',
    );
    expect(source).toContain("function ChatHistoryDrawer");
    expect(source).toContain('t("assistantHistoryTitle")');
    expect(source).toContain('t("assistantHistoryRecentSubtitle")');
    expect(source).toContain('t("assistantHistoryArchiveSubtitle")');
    expect(source).not.toContain("v_ai_helper_requests_recent");

    expect(source).not.toContain("xl:grid-cols-[minmax(0,1fr)_20rem]");
  });
  it("keeps analysis mode labels for hidden developer controls and marketing-oriented order", () => {
    expect(translations.assistantContextLabel.uk).toBe("Режим аналізу");
    expect(translations.assistantContextLabel.en).toBe("Analysis mode");
    expect(translations.assistantAdvancedContext.uk).toBe("Змінити контекст");
    expect(translations.assistantManualOverride.uk).toBe(
      "Ручний режим лише для тестування",
    );
    const optionsBlock = routingSource.slice(
      routingSource.indexOf("const OPTIONS = ["),
      routingSource.indexOf("] as const satisfies readonly ContextOption[];"),
    );
    const optionLabels = Array.from(
      optionsBlock.matchAll(/labelKey: "([^"]+)"/g),
    ).map((match) => match[1]);
    expect(optionLabels.slice(0, 10)).toEqual([
      "assistantContextGeneral",
      "assistantContextAdsHealth",
      "assistantContextAdsPerformance",
      "assistantContextAdsAnomalies",
      "assistantContextFullOverview",
      "assistantContextDataQuality",
      "assistantContextImportStatus",
      "assistantContextMappingReview",
      "assistantContextAlerts",
      "assistantContextClientsFunnels",
    ]);
    expect(translations.assistantContextFullOverview.en).toBe("Full overview");
    expect(translations.assistantContextAdsAnomalies.en).toBe(
      "Drops / anomalies",
    );
    expect(translations.assistantContextImportStatus.en).toBe("Imports");
    expect(translations.assistantContextMappingReview.en).toBe("Mapping");
  });

  it("renders a lightweight compact composer as the primary action", () => {
    expect(source).not.toContain("<SectionCard");
    expect(source).not.toContain("min-h-[72vh]");
    expect(source).not.toContain("min-h-[calc(100vh-10rem)]");
    expect(source).toContain("ref={textareaRef}");
    expect(source).toContain("rows={1}");
    expect(source).toContain("!min-h-12 max-h-44 resize-none overflow-y-auto");
    expect(source).toContain("border-0 bg-transparent");
    expect(source).toContain(
      "outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:ring-0",
    );
    expect(source).toContain(
      "focus-within:ring-2 focus-within:ring-primary/20",
    );
    expect(source).toContain("Math.min(textarea.scrollHeight, 176)");
    expect(source).toContain('size="icon"');
    expect(source).toContain('className="h-9 w-9 shrink-0 rounded-full"');
    expect(source).toContain("rounded-2xl border border-border/40 bg-card/95");
    expect(source).not.toContain("rounded-[1.75rem]");
    expect(source).not.toContain(
      '<summary className="cursor-pointer list-none',
    );
    expect(source).not.toContain("disabled={!manualOverrideEnabled}");
  });

  it("uses one centered chat column for messages, loading, errors, composer, and safety note", () => {
    expect(source).toContain(
      'const CHAT_COLUMN_CLASS = "mx-auto w-full max-w-4xl";',
    );
    expect(source).toContain(
      "<div className={`${CHAT_COLUMN_CLASS} space-y-3`}>",
    );
    expect(source).toContain(
      "<div className={`${CHAT_COLUMN_CLASS} mt-4 sm:mt-5`}>",
    );
    expect(source).toContain("<FriendlyError");
    expect(source).toContain(
      "rounded-tl-sm border bg-card px-4 py-3 text-sm shadow-sm",
    );
    expect(source).toContain(
      "max-w-[82%] rounded-2xl rounded-tr-sm bg-primary",
    );
    expect(source).toContain('{t("assistantAutoRoutingBadge")}');
    expect(source).not.toContain(
      '{t("assistantAutoRoutingBadge")}: {t(selectedOption.labelKey)}',
    );
    expect(source).not.toContain("mt-2 text-[10px] text-primary-foreground/65");
    expect(source).not.toContain(
      '<p className="mb-1 text-[11px] opacity-75">{message.contextLabel}</p><p className="whitespace-pre-wrap">{message.text}</p>',
    );
    expect(source).not.toContain("items-start gap-3");
    expect(source).not.toContain("sm:max-w-[82%]");
    expect(source).not.toContain(
      "max-w-full rounded-2xl px-4 py-3 text-sm sm:max-w-[82%]",
    );
    expect(source).not.toContain("max-w-3xl sm:mt-5");
  });

  it("adds localized header actions for history and New chat reset", () => {
    expect(translations.assistantNewChat.uk).toBe("Новий чат");
    expect(translations.assistantNewChat.en).toBe("New chat");
    expect(source).toContain("const resetChat = () => {");
    expect(source).toContain("setMessages([]);");
    expect(source).toContain('setPrompt("");');
    expect(source).toContain("run.reset();");
    expect(source).toContain("const showNewChat =");
    expect(source).toContain('t("assistantHistory")');
    expect(source).toContain("setIsHistoryDrawerOpen(true)");
    expect(source).toContain("assistantNewChat");
    expect(translations.assistantHistory.en).toBe("History");
    expect(translations.assistantHistoryTitle.en).toBe("Chat history");
    expect(translations.assistantHistoryRecentSubtitle.en).toBe("Last 14 days");
    expect(translations.assistantHistoryArchiveSubtitle.en).toBe("Archived chats");
    expect(translations.assistantHistoryArchiveSubtitle.uk).not.toBe("Останні 14 днів");
    expect(translations.assistantHistoryLoading.en).toBe("Loading history…");
    expect(translations.assistantHistoryEmpty.en).toBe(
      "Recent AI Assistant chats will appear here.",
    );
    expect(translations.assistantHistoryGroupToday.en).toBe("Today");
    expect(translations.assistantHistoryGroupYesterday.en).toBe("Yesterday");
    expect(translations.assistantHistoryGroupLastSevenDays.en).toBe(
      "Last 7 days",
    );
    expect(translations.assistantHistoryGroupEarlier.en).toBe("Earlier");
    expect(translations.assistantHistoryArchive.en).toBe("Archive");
    expect(translations.assistantHistoryRestore.en).toBe("Restore");
    expect(translations.assistantHistoryRename.en).toBe("Rename");
    expect(translations.assistantHistoryRename.uk).toBe("Перейменувати");
    expect(translations.assistantHistoryRenameTitle.en).toBe("Chat title");
    expect(translations.assistantHistoryRenameSave.en).toBe("Save");
    expect(translations.assistantHistoryRenameCancel.en).toBe("Cancel");
    expect(translations.assistantHistoryRenamePlaceholder.en).toBe(
      "Enter chat title",
    );
    expect(translations.assistantHistoryNoAiAnswer.uk).toBe("Без відповіді AI");
    expect(translations.assistantHistoryNoAiAnswer.en).toBe("No AI answer");
    expect(translations.assistantHistoryDelete.uk).toBe("Видалити");
    expect(translations.assistantHistoryDelete.en).toBe("Delete");
    expect(translations.assistantHistoryDeleteConfirmTitle.uk).toBe("Видалити чат назавжди?");
    expect(translations.assistantHistoryDeleteConfirmDescription.en).toBe("This action cannot be undone. The chat and its messages will be deleted.");
    expect(translations.assistantHistoryDeleteConfirm.en).toBe("Delete permanently");
  });

  it("keeps starter prompts below the composer and hides them after interaction", () => {
    expect(source).toContain("const showStarterPrompts =");
    expect(source).toContain("showStarterPrompts");
    expect(source).toContain("<StarterPrompts");
    expect(source.indexOf("<Textarea ref={textareaRef}")).toBeLessThan(
      source.indexOf("<StarterPrompts"),
    );
    expect(source).toContain("onClick={() => onPrompt(t(key))}");
    expect(source).toContain("disabled={disabled}");
    expect(source).toContain('className="mt-6 grid w-full gap-2 sm:grid-cols-2"');
    expect(source).not.toContain("onPrompt={(value) => setPrompt(value)}");
  });


  it("cleans stored drawer previews at render time and keeps archive delete behind confirmation", () => {
    expect(source).toContain("cleanAssistantTextForPreview(session.last_message_preview)");
    expect(source).toContain("{cleanedPreview}");
    expect(source).not.toContain("{session.last_message_preview}");
    expect(source).toContain('view === "archive" ? (');
    expect(source).toContain('setDeleteSessionId(session.id)');
    expect(source).toContain('<Dialog');
    expect(source).toContain('t("assistantHistoryDeleteConfirmTitle")');
    expect(source).toContain('await onDelete(sessionId)');
  });

  it("keeps backend contract and does not add unsupported fake action labels", () => {
    expect(source).toContain('supabase.functions.invoke("ai-helper-run"');
    expect(source).toContain("request_type: option.requestType");
    expect(source).toContain("context_scope: option.contextScope");
    expect(source).not.toMatch(
      /auto-map|approve mapping|fix data|create bindings|run sync|change users|change role|invite user|update binding/i,
    );
  });
});

describe("AI Assistant smart routing and answer UX", () => {
  it("keeps deterministic named routing signals and guarded anomaly routing", () => {
    expect(routingSource).toContain("dataQualitySignal");
    expect(routingSource).toContain("importSignal");
    expect(routingSource).toContain("adsHealthSignal");
    expect(routingSource).toContain("performanceSignal");
    expect(routingSource).toContain("anomalySignal");
    expect(routingSource).toContain("metricSignal");
    expect(routingSource).toContain("timeWindowSignal");
    expect(routingSource).toContain("clientCommunicationSignal");
    expect(routingSource).toContain("mappingSignal");
    expect(routingSource).toContain("signals.anomalySignal &&");
    expect(routingSource).toContain("signals.adsSignal ||");
    expect(routingSource).toContain("signals.metricSignal ||");
    expect(routingSource).toContain("signals.timeWindowSignal ||");
  });


  it("treats automatic routing as routing source rather than difference from default", async () => {
    const { OPTIONS, resolveAssistantContext } =
      await import("@/lib/assistantRouting");
    const defaultOption =
      OPTIONS.find((option) => option.labelKey === "assistantContextGeneral") ??
      OPTIONS[0];

    expect(resolveAssistantContext("Що таке CPL?", defaultOption, false)).toMatchObject({
      requestType: "general_assistant",
      contextScope: "general",
    });
    expect(resolveAssistantContext("Чому немає свіжих рекламних даних?", defaultOption, false)).toMatchObject({
      requestType: "ads_health_summary",
      contextScope: "ads_health",
    });
    expect(resolveAssistantContext("Чому немає свіжих рекламних даних?", defaultOption, true)).toBe(defaultOption);

    expect(source).toContain("const autoRouted = !manualOverrideEnabled");
    expect(source).not.toContain("resolvedOption.labelKey !== selectedOption.labelKey");
  });

  it("routes live-tested Ukrainian prompts to the intended assistant contexts", async () => {
    const { OPTIONS, resolveAssistantContext } =
      await import("@/lib/assistantRouting");
    const defaultOption =
      OPTIONS.find((option) => option.labelKey === "assistantContextGeneral") ??
      OPTIONS[0];
    const route = (prompt: string) =>
      resolveAssistantContext(prompt, defaultOption, false).labelKey;

    expect(route("Тест історії чату")).toBe("assistantContextGeneral");
    expect(route("Просто тест")).toBe("assistantContextGeneral");
    expect(route("Що таке CPL?")).toBe("assistantContextGeneral");
    expect(route("Поясни простими словами, що таке RLS")).toBe(
      "assistantContextGeneral",
    );
    expect(route("Як краще назвати цей чат?")).toBe("assistantContextGeneral");

    expect(route("Чому немає свіжих рекламних даних?")).toBe(
      "assistantContextAdsHealth",
    );
    expect(route("Чому немає даних по рекламі?")).toBe(
      "assistantContextAdsHealth",
    );
    expect(route("Чому не синхронізуються рекламні дані?")).toBe(
      "assistantContextAdsHealth",
    );
    expect(route("Які акаунти треба привʼязати?")).toBe(
      "assistantContextAdsHealth",
    );
    expect(route("Що зі станом рекламних підключень?")).toBe(
      "assistantContextAdsHealth",
    );
    expect(route("Чому Google Ads не дає дані?")).toBe(
      "assistantContextAdsHealth",
    );
    expect(route("Впав доступ до Google Ads")).toBe(
      "assistantContextAdsHealth",
    );
    expect(route("Чи працює live API?")).toBe("assistantContextAdsHealth");

    expect(route("У мене впав сайт")).toBe("assistantContextSystemReadiness");
    expect(route("Сайт не відкривається після deploy")).toBe("assistantContextSystemReadiness");
    expect(route("GitHub Pages не оновився після merge")).toBe("assistantContextSystemReadiness");
    expect(route("Edge Function повертає 500")).toBe("assistantContextSystemReadiness");
    expect(route("Supabase повертає 401")).toBe("assistantContextSystemReadiness");
    expect(route("Помилка 403 у Supabase")).toBe("assistantContextSystemReadiness");
    expect(route("Білий екран після оновлення")).toBe("assistantContextSystemReadiness");
    expect(route("API не відповідає")).toBe("assistantContextSystemReadiness");
    expect(route("Supabase permission denied")).toBe("assistantContextSystemReadiness");
    expect(route("Google Ads permission denied")).toBe("assistantContextAdsHealth");

    expect(route("Які кампанії потребують уваги?")).toBe(
      "assistantContextAdsPerformance",
    );
    expect(route("Які кампанії мають високий CPL?")).toBe(
      "assistantContextAdsPerformance",
    );
    expect(route("Де зливаються витрати?")).toBe(
      "assistantContextAdsPerformance",
    );
    expect(route("Проаналізуй кампанії")).toBe(
      "assistantContextAdsPerformance",
    );
    expect(route("Які кампанії ефективні?")).toBe(
      "assistantContextAdsPerformance",
    );
    expect(route("Де поганий CPL?")).toBe("assistantContextAdsPerformance");
    expect(route("Де найбільші витрати?")).toBe(
      "assistantContextAdsPerformance",
    );

    expect(route("Що просіло за останні 7 днів?")).toBe(
      "assistantContextAdsAnomalies",
    );
    expect(route("Що впало за останній тиждень?")).toBe(
      "assistantContextAdsAnomalies",
    );
    expect(route("Де просіли ліди?")).toBe("assistantContextAdsAnomalies");
    expect(route("Чому різко виріс CPL?")).toBe("assistantContextAdsAnomalies");
    expect(route("CPL spike")).toBe("assistantContextAdsAnomalies");
    expect(route("campaign drop")).toBe("assistantContextAdsAnomalies");
    expect(route("last 7 days drop")).toBe("assistantContextAdsAnomalies");

    expect(route("Де є проблеми з якістю даних?")).toBe(
      "assistantContextDataQuality",
    );
    expect(route("Де проблеми з якістю даних?")).toBe(
      "assistantContextDataQuality",
    );
    expect(route("Щось дивне з імпортами")).toBe("assistantContextDataQuality");
    expect(route("Зросла кількість помилок імпорту")).toBe(
      "assistantContextDataQuality",
    );
    expect(route("Зросла кількість rejected rows")).toBe(
      "assistantContextDataQuality",
    );
    expect(route("Проблеми з імпортами")).toBe("assistantContextDataQuality");

    expect(route("У мене впав сайт")).toBe("assistantContextSystemReadiness");
    expect(route("Впав доступ до Google Ads")).not.toBe(
      "assistantContextAdsAnomalies",
    );
    expect(route("Зросла кількість помилок імпорту")).not.toBe(
      "assistantContextAdsAnomalies",
    );
  });

  it("sends compact conversation history and reuses previous assistant context for continuation", async () => {
    const {
      OPTIONS,
      resolveAssistantContextWithHistory,
      isContinuationPrompt,
    } = await import("@/lib/assistantRouting");
    const defaultOption =
      OPTIONS.find((option) => option.labelKey === "assistantContextGeneral") ??
      OPTIONS[0];
    const previousAnomaly =
      OPTIONS.find(
        (option) => option.labelKey === "assistantContextAdsAnomalies",
      ) ?? OPTIONS[0];

    expect(isContinuationPrompt("продовжи попередню відповідь")).toBe(true);
    expect(
      resolveAssistantContextWithHistory(
        "продовжи попередню відповідь",
        defaultOption,
        false,
        previousAnomaly,
      ).labelKey,
    ).toBe("assistantContextAdsAnomalies");
    expect(source).toContain("conversation_history: conversationHistory");
    expect(conversationSource).toContain("CONVERSATION_HISTORY_MAX_MESSAGES");
    expect(conversationSource).toContain("CONVERSATION_HISTORY_TEXT_BUDGET");
    expect(conversationSource).toContain(
      "request_type: message.option.requestType",
    );
    expect(conversationSource).toContain(
      "context_scope: message.option.contextScope",
    );
  });

  it("builds budgeted visible-thread conversation history beyond a four-message limit", async () => {
    const { OPTIONS } = await import("@/lib/assistantRouting");
    const { buildConversationHistory } =
      await import("@/lib/assistantConversation");
    const option =
      OPTIONS.find(
        (item) => item.labelKey === "assistantContextAdsPerformance",
      ) ?? OPTIONS[0];
    const t = ((key: string) => key) as Parameters<
      typeof buildConversationHistory
    >[1];
    const messages = Array.from({ length: 9 }, (_, index) => ({
      id: `message-${index}`,
      role: index % 2 === 0 ? ("user" as const) : ("assistant" as const),
      text: `${index === 7 ? "latest-assistant " : "older "}${"x".repeat(index === 7 ? 7000 : 1800)}`,
      contextLabel: `Контекст ${index}`,
      option,
    }));

    const history = buildConversationHistory(messages, t);

    expect(history.length).toBeGreaterThan(4);
    expect(history.length).toBeLessThanOrEqual(12);
    expect(
      history.reduce((sum, item) => sum + item.text.length, 0),
    ).toBeLessThanOrEqual(15000);
    expect(history.at(-2)?.role).toBe("assistant");
    expect(history.at(-2)?.text.length).toBeGreaterThan(history[0].text.length);
    expect(history[0]).toHaveProperty("request_type", option.requestType);
    expect(history[0]).toHaveProperty("context_scope", option.contextScope);
  });

  it("includes compact thread metadata in assistant requests", () => {
    expect(source).toContain("conversation_thread: threadMetadata");
    expect(conversationSource).toContain("previous_assistant_context_scope");
    expect(conversationSource).toContain("previous_assistant_request_type");
    expect(conversationSource).toContain("previous_assistant_label");
    expect(conversationSource).toContain("current_thread_has_history");
  });

  it("hides manual context override from normal composer UI", () => {
    expect(routingSource).toContain(
      "if (manualOverrideEnabled) return selectedOption",
    );
    expect(source).toContain("const SHOW_ASSISTANT_DEV_CONTROLS = false");
    expect(source).not.toContain("assistantAdvancedContext");
    expect(source).not.toContain("assistantManualOverride");
    expect(source).not.toContain("disabled={!manualOverrideEnabled}");
    expect(source).not.toContain("SelectTrigger");
  });

  it("reuses previous assistant context for natural thread follow-ups while preserving strong new intent routing", async () => {
    const {
      OPTIONS,
      resolveAssistantContextWithHistory,
      isThreadFollowUpPrompt,
    } = await import("@/lib/assistantRouting");
    const defaultOption =
      OPTIONS.find((option) => option.labelKey === "assistantContextGeneral") ??
      OPTIONS[0];
    const previousPerformance =
      OPTIONS.find(
        (option) => option.labelKey === "assistantContextAdsPerformance",
      ) ?? OPTIONS[0];
    const route = (prompt: string) =>
      resolveAssistantContextWithHistory(
        prompt,
        defaultOption,
        false,
        previousPerformance,
      ).labelKey;

    expect(isThreadFollowUpPrompt("розпиши детальніше")).toBe(true);
    expect(route("розпиши детальніше")).toBe("assistantContextAdsPerformance");
    expect(route("а чому так?")).toBe("assistantContextAdsPerformance");
    expect(route("що перевірити першим?")).toBe(
      "assistantContextAdsPerformance",
    );
    expect(route("сформулюй клієнту")).toBe("assistantContextAdsPerformance");
    expect(route("а що з Meta?")).toBe("assistantContextAdsPerformance");

    expect(route("Де є проблеми з якістю даних?")).toBe(
      "assistantContextDataQuality",
    );
    expect(route("Які кампанії потребують уваги?")).toBe(
      "assistantContextAdsPerformance",
    );
    expect(route("Що просіло за останні 7 днів?")).toBe(
      "assistantContextAdsAnomalies",
    );
    expect(route("Чому немає свіжих рекламних даних?")).toBe(
      "assistantContextAdsHealth",
    );
    expect(route("Тест історії чату")).toBe("assistantContextGeneral");
  });


  it("keeps system diagnostics thread follow-ups while allowing clear new intents", async () => {
    const { OPTIONS, resolveAssistantContextWithHistory } =
      await import("@/lib/assistantRouting");
    const defaultOption =
      OPTIONS.find((option) => option.labelKey === "assistantContextGeneral") ??
      OPTIONS[0];
    const previousSystem =
      OPTIONS.find(
        (option) => option.labelKey === "assistantContextSystemReadiness",
      ) ?? OPTIONS[0];
    const route = (prompt: string) =>
      resolveAssistantContextWithHistory(
        prompt,
        defaultOption,
        false,
        previousSystem,
      ).labelKey;

    expect(route("що перевірити першим?")).toBe("assistantContextSystemReadiness");
    expect(route("а чому так?")).toBe("assistantContextSystemReadiness");
    expect(route("сформулюй клієнту")).toBe("assistantContextSystemReadiness");
    expect(route("а що з Supabase?")).toBe("assistantContextSystemReadiness");
    expect(route("а що з GitHub Pages?")).toBe("assistantContextSystemReadiness");

    expect(route("чому немає свіжих рекламних даних?")).toBe("assistantContextAdsHealth");
    expect(route("що таке CPL?")).toBe("assistantContextGeneral");
  });

  it("shows resolved context badges and copy actions for assistant answers", () => {
    expect(source).toContain("assistantContextPrefix");
    expect(source).toContain("assistantAutoContextPrefix");
    expect(translations.assistantAutoContextPrefix.uk).toBe("Автоконтекст");
    expect(translations.assistantAutoRoutingBadge.uk).toBe(
      "AI сам обере режим",
    );
    expect(translations.assistantContextSystemReadiness.uk).toBe(
      "Системна діагностика",
    );
    expect(translations.assistantContextSystemReadiness.en).toBe(
      "System diagnostics",
    );
    expect(translations.assistantAutoRoutingBadge.en).toBe(
      "AI will choose the mode",
    );
    expect(source).toContain("serializeAnswerForWholeCopy(message.text)");
    expect(source).not.toContain("navigator.clipboard.writeText(message.text)");
    expect(source).toContain("navigator.clipboard.writeText(text)");
    expect(source).toContain("ClientCopyBlock");
    expect(source).toContain("parseClientCopySegments");
    expect(source).toContain('t("assistantClientCopyTitle")');
    expect(source).toContain('aria-label={t("assistantClientCopyCopyLabel")}');
    expect(source).not.toContain("Текст для клієнта");
    expect(source).not.toContain("Скопіювати текст для клієнта");
    expect(translations.assistantClientCopyTitle.uk).toBe("Текст для клієнта");
    expect(translations.assistantClientCopyTitle.en).toBe("Client text");
    expect(translations.assistantClientCopyCopyLabel.uk).toBe(
      "Скопіювати текст для клієнта",
    );
    expect(translations.assistantClientCopyCopyLabel.en).toBe(
      "Copy client text",
    );
    expect(answerParsingSource).toContain("CLIENT_COPY_START");
    expect(answerParsingSource).toContain("CLIENT_COPY_END");
    expect(source).toContain("assistantCopy");
    expect(source).toContain("assistantCopied");
    expect(translations.assistantCopy.uk).toBe("Скопіювати");
    expect(translations.assistantCopied.en).toBe("Copied");
  });

  it("groups markdown bullet and numbered lists in lightweight answer renderer", () => {
    expect(source).toContain("function parseMarkdownBlocks");
    expect(source).toContain('previous?.type === "bullets"');
    expect(source).toContain('previous?.type === "numbers"');
    expect(source).toContain('className="list-disc space-y-1 pl-5"');
    expect(source).toContain('className="list-decimal space-y-1 pl-5"');
  });
});
