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
    expect(translations.assistantTechnicalDetails.en).toBe("Technical details");
  });

  it("hides Auto as a context option, defaults to full overview, and keeps history secondary", () => {
    expect(source).not.toMatch(/labelKey:\s*"[^"]*Auto"/);
    expect(source).toContain('useState<(typeof OPTIONS)[number]["labelKey"]>("assistantContextFullOverview")');
    expect(source).toContain('rows.slice(0, 3)');
    expect(source).toContain("function HistoryPanel");
    expect(source).toContain("<details className=");
    expect(source).not.toContain("xl:grid-cols-[minmax(0,1fr)_20rem]");
  });
  it("uses the requested analysis mode label and marketing-oriented order", () => {
    expect(translations.assistantContextLabel.uk).toBe("Режим аналізу");
    expect(translations.assistantContextLabel.en).toBe("Analysis mode");
    const optionsBlock = source.slice(source.indexOf("const OPTIONS = ["), source.indexOf("] as const satisfies readonly ContextOption[];"));
    const optionLabels = Array.from(optionsBlock.matchAll(/labelKey: "([^"]+)"/g)).map((match) => match[1]);
    expect(optionLabels.slice(0, 10)).toEqual([
      "assistantContextFullOverview",
      "assistantContextAdsPerformance",
      "assistantContextAdsAnomalies",
      "assistantContextDataQuality",
      "assistantContextImportStatus",
      "assistantContextMappingReview",
      "assistantContextAlerts",
      "assistantContextClientsFunnels",
      "assistantContextAdsHealth",
      "assistantContextSystemReadiness",
    ]);
    expect(translations.assistantContextFullOverview.en).toBe("Full overview");
    expect(translations.assistantContextAdsAnomalies.en).toBe("Drops / anomalies");
    expect(translations.assistantContextImportStatus.en).toBe("Imports");
    expect(translations.assistantContextMappingReview.en).toBe("Mapping");
  });

  it("keeps backend contract and does not add unsupported fake action labels", () => {
    expect(source).toContain('supabase.functions.invoke("ai-helper-run"');
    expect(source).toContain("request_type: selectedOption.requestType");
    expect(source).toContain("context_scope: selectedOption.contextScope");
    expect(source).not.toMatch(/auto-map|approve|fix data|update binding|sync connector|change role|invite user/i);
  });
});
