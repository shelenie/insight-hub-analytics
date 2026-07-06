import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { translations } from "@/i18n/translations";

const source = readFileSync("src/pages/Alerts.tsx", "utf8");

describe("Telegram / Alerts UI polish", () => {
  it("keeps raw Edge Function non-2xx copy out of the primary UI source", () => {
    expect(source).not.toContain("Edge Function returned a non-2xx status code");
  });

  it("hides empty-state action buttons unless rows exist", () => {
    expect(source).toContain("queuedOutboxRows.length > 0 ?");
    expect(source).toContain("firstActionRequest ?");
  });

  it("does not use resolved alerts as close-button targets", () => {
    expect(source).toContain("const firstOpenAlert = alerts.find((row) => !isResolvedAlert(row));");
    expect(source).toContain("alertsAlreadyResolved");
  });

  it("has key Ukrainian and English translations for tabs and sections", () => {
    expect(translations.alertsTabOverview.uk).toBe("Огляд");
    expect(translations.alertsTabOverview.en).toBe("Overview");
    expect(translations.alertsTabHealth.uk).toBe("Стан");
    expect(translations.alertsTabHealth.en).toBe("Health");
    expect(translations.alertsQueueEmptyTitle.uk).toBe("Немає повідомлень у черзі.");
    expect(translations.alertsQueueEmptyTitle.en).toBe("No messages are waiting in the queue.");
    expect(translations.alertsConfirmationsEmptyTitle.uk).toBe("Немає запитів на підтвердження.");
    expect(translations.alertsConfirmationsEmptyTitle.en).toBe("No confirmation requests.");
  });
});
