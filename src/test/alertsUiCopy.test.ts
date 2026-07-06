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
    expect(source).toContain("const firstOpenAlert = openAlerts[0];");
    expect(source).toContain("alertsRecentHistoryTitle");
  });

  it("has key Ukrainian and English translations for tabs and sections", () => {
    expect(translations.alertsTabOverview.uk).toBe("Огляд");
    expect(translations.alertsTabOverview.en).toBe("Overview");
    expect(translations.alertsTabHealth.uk).toBe("Стан");
    expect(translations.alertsTabHealth.en).toBe("Health");
    expect(translations.alertsTabRoutes.uk).toBe("Правила");
    expect(translations.alertsTabRoutes.en).toBe("Rules");
    expect(translations.alertsRoutesTitle.uk).toBe("Правила сповіщень");
    expect(translations.alertsRoutesTitle.en).toBe("Notification rules");
    expect(translations.alertsQueueEmptyTitle.uk).toBe("Немає повідомлень у черзі.");
    expect(translations.alertsQueueEmptyTitle.en).toBe("No messages are waiting in the queue.");
    expect(translations.alertsConfirmationsEmptyTitle.uk).toBe("Немає запитів на підтвердження.");
    expect(translations.alertsConfirmationsEmptyTitle.en).toBe("No confirmation requests.");
    expect(translations.alertsPageHelper.uk).toContain("системні сповіщення");
    expect(translations.alertsEventBackupFailure.uk).toBe("Помилка резервного копіювання");
    expect(translations.alertsEventRestoreFailure.uk).toBe("Помилка відновлення");
  });

  it("does not render the default security note during happy-path usage", () => {
    expect(source).toContain("statusMessage ? <p");
    expect(source).not.toContain("statusMessage ?? t(\"alertsSecurityNote\")");
    expect(source).not.toContain("useState<string>(t(\"alertsSecurityNote\"))");
    expect(source).not.toContain("roleLoading ? <p className=\"mb-4 text-xs text-muted-foreground\">{t(\"alertsCheckingAccess\")}");
  });

  it("keeps friendly route and technical health labels available", () => {
    expect(source).toContain("formatRouteName");
    expect(source).toContain("alertsTechnicalActiveChats");
    expect(translations.alertsProductionHealthTechnical.uk).toBe("Технічні деталі робочого стану");
    expect(translations.alertsRecentHistoryTitle.en).toBe("Recent alert history");
  });
});
