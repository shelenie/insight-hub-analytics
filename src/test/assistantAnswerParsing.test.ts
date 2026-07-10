import { describe, expect, it } from "vitest";
import { parseClientCopySegments, stripLeadingContextLabel } from "@/lib/assistantAnswerParsing";

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
});
