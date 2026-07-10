import { describe, expect, it } from "vitest";
import { cleanAssistantTextForModelContext, cleanAssistantTextForPreview, parseClientCopySegments, serializeAnswerForWholeCopy, stripLeadingContextLabel } from "@/lib/assistantAnswerParsing";

describe("AI Assistant answer parsing", () => {
  it("strips leading Ukrainian context labels", () => {
    expect(stripLeadingContextLabel("Контекст: Стан рекламних підключень\n\nBody")).toBe("Body");
    expect(stripLeadingContextLabel("Контекст: Ефективність реклами\nBody")).toBe("Body");
  });

  it("strips duplicated leading context labels", () => {
    expect(stripLeadingContextLabel("Контекст: X\n\nКонтекст: X\n\nBody")).toBe("Body");
  });

  it("strips leading English context labels", () => {
    expect(stripLeadingContextLabel("Context: Ads Health\n\nBody")).toBe("Body");
  });

  it("does not strip context mentions later in the answer", () => {
    expect(stripLeadingContextLabel("Body\n\nКонтекст: keep this")).toBe("Body\n\nКонтекст: keep this");
  });

  it("parses client copy markers and keeps internal notes outside", () => {
    const segments = parseClientCopySegments("Intro\n\n[CLIENT_COPY_START]\nClient text only\n[CLIENT_COPY_END]\n\n## Внутрішньо: що перевірити\n- Access");
    expect(segments).toEqual([
      { type: "answer", text: "Intro" },
      { type: "client-copy", text: "Client text only" },
      { type: "answer", text: "## Внутрішньо: що перевірити\n- Access" },
    ]);
  });

  it("serializes whole-answer copy without raw client copy marker lines", () => {
    const serialized = serializeAnswerForWholeCopy("Intro\n\n[CLIENT_COPY_START]\nClient text only\n[CLIENT_COPY_END]\n\n## Внутрішньо: що перевірити\n- Access");

    expect(serialized).not.toContain("[CLIENT_COPY_START]");
    expect(serialized).not.toContain("[CLIENT_COPY_END]");
    expect(serialized).toContain("Client text only");
    expect(serialized).toContain("## Внутрішньо: що перевірити");
    expect(serialized).toContain("- Access");
  });

  it("cleans model context and previews without raw client markers or leading context labels", () => {
    const raw = "Контекст: Стан рекламних підключень\n\nIntro\n[CLIENT_COPY_START]\nClient text\n[CLIENT_COPY_END]\nLater Контекст: keep this";

    expect(cleanAssistantTextForModelContext(raw)).toBe("Intro\nClient text\nLater Контекст: keep this");
    expect(cleanAssistantTextForPreview(raw)).toBe("Intro Client text Later Контекст: keep this");
  });
});
