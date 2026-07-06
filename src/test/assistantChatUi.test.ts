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

  it("defines suggested prompt and technical details labels in Ukrainian and English", () => {
    expect(translations.assistantPromptAttention.uk).toBe("Що зараз потребує уваги?");
    expect(translations.assistantPromptAttention.en).toBe("What needs attention now?");
    expect(translations.assistantPromptAds.uk).toBe("Поясни стан реклами");
    expect(translations.assistantPromptAds.en).toBe("Explain ads performance");
    expect(translations.assistantPromptDataQuality.uk).toBe("Які є проблеми з якістю даних?");
    expect(translations.assistantPromptDataQuality.en).toBe("What data quality issues exist?");
    expect(translations.assistantPromptImportErrors.uk).toBe("Які імпорти мають помилки?");
    expect(translations.assistantPromptImportErrors.en).toBe("Which imports have errors?");
    expect(translations.assistantPromptMapping.uk).toBe("Що треба перевірити в мапінгу?");
    expect(translations.assistantPromptMapping.en).toBe("What should be reviewed in mapping?");
    expect(translations.assistantPromptOverview.uk).toBe("Дай короткий огляд workspace");
    expect(translations.assistantPromptOverview.en).toBe("Give me a short workspace overview");
    expect(translations.assistantTechnicalDetails.uk).toBe("Технічні деталі");
    expect(translations.assistantTechnicalDetails.en).toBe("Technical details");
  });

  it("keeps backend contract and does not add unsupported fake action labels", () => {
    expect(source).toContain('supabase.functions.invoke("ai-helper-run"');
    expect(source).toContain("request_type: selectedOption.requestType");
    expect(source).toContain("context_scope: selectedOption.contextScope");
    expect(source).not.toMatch(/auto-map|approve|fix data|update binding|sync connector|change role|invite user/i);
  });
});
