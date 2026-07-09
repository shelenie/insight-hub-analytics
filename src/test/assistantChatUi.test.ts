import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translations } from "@/i18n/translations";

const source = readFileSync("src/pages/Assistant.tsx", "utf8");

describe("AI Assistant chat UI", () => {
  it("uses i18n keys for primary chat-first visible copy", () => {
    expect(source).toContain('title={t("assistantTitle")}');
    expect(source).toContain('subtitle={t("assistantSubtitle")}');
    expect(source).toContain('t("assistantSafetyNote")');
    expect(source).toContain('placeholder={t("assistantComposerPlaceholder")}');
    expect(source).toContain('t("assistantSend")');
    expect(source).not.toContain('title="AI-асистент"');
    expect(source).not.toContain('Поставте питання по даних робочого простору');
    expect(source).not.toContain('Запитати Insight Hub AI');
    expect(source).not.toContain('Тип запиту');
  });

  it("defines performance marketing suggested prompts and technical details labels in Ukrainian and English", () => {
    expect(translations.assistantPromptSevenDayDrop.uk).toBe("Що просіло за останні 7 днів?");
    expect(translations.assistantPromptSevenDayDrop.en).toBe("What dropped in the last 7 days?");
    expect(translations.assistantPromptCampaignsAttention.uk).toBe("Які кампанії потребують уваги?");
    expect(translations.assistantPromptCampaignsAttention.en).toBe("Which campaigns need attention?");
    expect(translations.assistantPromptCplIncrease.uk).toBe("Чому міг вирости CPL?");
    expect(translations.assistantPromptCplIncrease.en).toBe("Why might CPL have increased?");
    expect(translations.assistantPromptDataQuality.uk).toBe("Де є проблеми з якістю даних?");
    expect(translations.assistantPromptDataQuality.en).toBe("Where are the data quality issues?");
    expect(translations.assistantPromptClientSituation.uk).toBe("Що сказати клієнту по ситуації?");
    expect(translations.assistantPromptClientSituation.en).toBe("What should we tell the client about the situation?");
    expect(translations.assistantPromptTeamPriorities.uk).toBe("Дай пріоритети для команди на сьогодні");
    expect(translations.assistantPromptTeamPriorities.en).toBe("Give the team priorities for today");
    expect(translations.assistantTechnicalDetails.uk).toBe("Технічні деталі");
    expect(translations.assistantWelcomeTitle.uk).toBe("Що хочете проаналізувати?");
    expect(translations.assistantWelcomeTitle.en).toBe("What would you like to analyze?");
    expect(translations.assistantWelcome.uk).toBe("Я допоможу знайти просідання, проблеми з рекламою, якістю даних і підготувати висновки для команди або клієнта.");
    expect(translations.assistantWelcome.en).toBe("I can help find performance drops, ad issues, data quality problems, and prepare insights for the team or client.");
  });

  it("hides visible history UI and defaults to ads health with smart auto-routing", () => {
    expect(source).toContain('function resolveAssistantContext(prompt: string, selectedOption: ContextOption, manualOverrideEnabled: boolean)');
    expect(source).toContain('useState<(typeof OPTIONS)[number]["labelKey"]>("assistantContextAdsHealth")');
    expect(source).toContain('const resolvedOption = resolveAssistantContext(submittedPrompt, selectedOption, manualOverrideEnabled);');
    expect(source).not.toContain('useState<(typeof OPTIONS)[number]["labelKey"]>("assistantContextFullOverview")');
    expect(source).not.toContain("function HistoryPanel");
    expect(source).not.toContain("function HistoryList");
    expect(source).not.toContain("assistantHistoryToggle");
    expect(source).not.toContain("v_ai_helper_requests_recent");

    expect(source).not.toContain("xl:grid-cols-[minmax(0,1fr)_20rem]");
  });
  it("uses advanced analysis mode label and marketing-oriented order", () => {
    expect(translations.assistantContextLabel.uk).toBe("Режим аналізу");
    expect(translations.assistantContextLabel.en).toBe("Analysis mode");
    expect(translations.assistantAdvancedContext.uk).toBe("Змінити контекст");
    expect(translations.assistantManualOverride.en).toBe("Manual testing override");
    const optionsBlock = source.slice(source.indexOf("const OPTIONS = ["), source.indexOf("] as const satisfies readonly ContextOption[];"));
    const optionLabels = Array.from(optionsBlock.matchAll(/labelKey: "([^"]+)"/g)).map((match) => match[1]);
    expect(optionLabels.slice(0, 10)).toEqual([
      "assistantContextAdsHealth",
      "assistantContextAdsPerformance",
      "assistantContextAdsAnomalies",
      "assistantContextFullOverview",
      "assistantContextDataQuality",
      "assistantContextImportStatus",
      "assistantContextMappingReview",
      "assistantContextAlerts",
      "assistantContextClientsFunnels",
      "assistantContextSystemReadiness",
    ]);
    expect(translations.assistantContextFullOverview.en).toBe("Full overview");
    expect(translations.assistantContextAdsAnomalies.en).toBe("Drops / anomalies");
    expect(translations.assistantContextImportStatus.en).toBe("Imports");
    expect(translations.assistantContextMappingReview.en).toBe("Mapping");
  });

  it("renders a lightweight compact composer as the primary action", () => {
    expect(source).not.toContain("<SectionCard");
    expect(source).not.toContain('min-h-[72vh]');
    expect(source).not.toContain('min-h-[calc(100vh-10rem)]');
    expect(source).toContain('ref={textareaRef}');
    expect(source).toContain('rows={1}');
    expect(source).toContain('!min-h-12 max-h-44 resize-none overflow-y-auto');
    expect(source).toContain('border-0 bg-transparent');
    expect(source).toContain('outline-none ring-0 focus:border-0 focus:outline-none focus:ring-0 focus-visible:ring-0');
    expect(source).toContain('focus-within:ring-2 focus-within:ring-primary/20');
    expect(source).toContain('Math.min(textarea.scrollHeight, 176)');
    expect(source).toContain('size="icon"');
    expect(source).toContain('<summary className="cursor-pointer list-none');
    expect(source).toContain('disabled={!manualOverrideEnabled}');
  });

  it("uses one centered chat column for messages, loading, errors, composer, and safety note", () => {
    expect(source).toContain('const CHAT_COLUMN_CLASS = "mx-auto w-full max-w-4xl";');
    expect(source).toContain('<div className={`${CHAT_COLUMN_CLASS} space-y-3`}>');
    expect(source).toContain('<div className={`${CHAT_COLUMN_CLASS} mt-4 sm:mt-5`}>');
    expect(source).toContain('<div className={CHAT_COLUMN_CLASS}><FriendlyError');
    expect(source).toContain('return <div className="flex w-full justify-start"><div className="w-full rounded-2xl rounded-tl-sm border bg-card px-4 py-3 text-sm shadow-sm">');
    expect(source).toContain('return <div className="flex w-full justify-end"><div className="max-w-[82%] rounded-2xl rounded-tr-sm bg-primary');
    expect(source).not.toContain('items-start gap-3');
    expect(source).not.toContain('sm:max-w-[82%]');
    expect(source).not.toContain('max-w-full rounded-2xl px-4 py-3 text-sm sm:max-w-[82%]');
    expect(source).not.toContain('max-w-3xl sm:mt-5');
  });

  it("adds a localized in-page New chat reset action without adding history UI", () => {
    expect(translations.assistantNewChat.uk).toBe("Новий чат");
    expect(translations.assistantNewChat.en).toBe("New chat");
    expect(source).toContain('const resetChat = () => {');
    expect(source).toContain('setMessages([]);');
    expect(source).toContain('setPrompt("");');
    expect(source).toContain('run.reset();');
    expect(source).toContain('const showNewChat = messages.length > 0 || prompt.trim().length > 0 || Boolean(run.error);');
    expect(source).toContain('onClick={resetChat}>{t("assistantNewChat")}');
  });

  it("keeps starter prompts below the composer and hides them after interaction", () => {
    expect(source).toContain('const showStarterPrompts = messages.length === 0 && !run.isPending && prompt.trim().length === 0;');
    expect(source).toContain('{showStarterPrompts ? <StarterPrompts t={t} onPrompt={submitPrompt} disabled={runDisabled} /> : null}');
    expect(source.indexOf('<Textarea ref={textareaRef}')).toBeLessThan(source.indexOf('<StarterPrompts'));
    expect(source).toContain('onClick={() => onPrompt(t(key))}');
    expect(source).toContain('disabled={disabled}');
    expect(source).not.toContain('onPrompt={(value) => setPrompt(value)}');
  });

  it("keeps backend contract and does not add unsupported fake action labels", () => {
    expect(source).toContain('supabase.functions.invoke("ai-helper-run"');
    expect(source).toContain("request_type: option.requestType");
    expect(source).toContain("context_scope: option.contextScope");
    expect(source).not.toMatch(/auto-map|approve mapping|fix data|create bindings|run sync|change users|change role|invite user|update binding/i);
  });
});


describe("AI Assistant smart routing and answer UX", () => {
  it("routes ads freshness questions to ads health instead of full production by default", () => {
    expect(source).toContain("свіжих даних");
    expect(source).toContain("assistantContextAdsHealth");
    expect(source).toContain("ads_health_summary");
    expect(source).toContain("ads_health");
    expect(source).toContain("if (isAds && isFreshness) return option(\"assistantContextAdsHealth\")");
  });

  it("routes campaign performance and anomaly prompts to specialized ads contexts", () => {
    expect(source).toContain("if (isAds && isPerformance) return option(\"assistantContextAdsPerformance\")");
    expect(source).toContain("ads_performance_summary");
    expect(source).toContain("if (isAds && isAnomaly) return option(\"assistantContextAdsAnomalies\")");
    expect(source).toContain("ads_anomaly_explanation");
  });

  it("keeps manual override only as an advanced control", () => {
    expect(source).toContain("if (manualOverrideEnabled) return selectedOption");
    expect(source).toContain("assistantAdvancedContext");
    expect(source).toContain("assistantManualOverride");
    expect(source).toContain("disabled={!manualOverrideEnabled}");
  });

  it("shows resolved context badges and copy actions for assistant answers", () => {
    expect(source).toContain("assistantContextPrefix");
    expect(source).toContain("assistantAutoContextPrefix");
    expect(source).toContain("navigator.clipboard.writeText(message.text)");
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
