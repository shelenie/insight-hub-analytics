import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { translations } from "@/i18n/translations";

const source = readFileSync("src/pages/Onboarding.tsx", "utf8");

describe("Onboarding UI polish", () => {
  it("defines Ukrainian and English i18n keys for admin-facing onboarding copy", () => {
    expect(translations.onboardingSubtitle.uk).toContain("Створіть базову структуру для аналітики");
    expect(translations.onboardingSubtitle.en).toContain("Create the basic analytics structure");
    expect(translations.onboardingNoManageAccess.uk).toBe("Ця дія недоступна для вашої ролі або ще не підключена.");
    expect(translations.onboardingNoManageAccess.en).toBe("This action is not available for your role or is not connected yet.");
  });

  it("keeps technical IDs behind technical details instead of as primary page copy", () => {
    const workspaceIndex = source.indexOf("workspace_id: {WORKSPACE_ID}");
    const detailsIndex = source.lastIndexOf("<DeveloperDetails", workspaceIndex);

    expect(workspaceIndex).toBeGreaterThan(-1);
    expect(detailsIndex).toBeGreaterThan(-1);
    expect(source.slice(detailsIndex, workspaceIndex)).toContain('title={t("onboardingTechnicalDetails")}');
    expect(source).not.toContain('title="ID');
    expect(source).not.toContain('description="ID');
  });

  it("does not expose hardcoded technical fallback errors as primary copy", () => {
    expect(source).not.toContain("Client upsert failed");
    expect(source).not.toContain("Project upsert failed");
    expect(source).not.toContain("Funnel upsert failed");
    expect(translations.onboardingClientUnexpectedResponseError.uk).toBe("Не вдалося зберегти клієнта. Backend не повернув очікувану відповідь.");
    expect(translations.onboardingClientUnexpectedResponseError.en).toBe("Could not save client. The backend did not return the expected response.");
    expect(translations.onboardingProjectUnexpectedResponseError.uk).toBe("Не вдалося зберегти проєкт. Backend не повернув очікувану відповідь.");
    expect(translations.onboardingProjectUnexpectedResponseError.en).toBe("Could not save project. The backend did not return the expected response.");
    expect(translations.onboardingFunnelUnexpectedResponseError.uk).toBe("Не вдалося зберегти воронку. Backend не повернув очікувану відповідь.");
    expect(translations.onboardingFunnelUnexpectedResponseError.en).toBe("Could not save funnel. The backend did not return the expected response.");
  });

  it("does not add fake invite, member, or access management actions and keeps backend function names unchanged", () => {
    expect(source).not.toMatch(/invite|invitation|member|workspace member|user access/i);
    expect(source).toContain("onboarding-client-upsert");
    expect(source).toContain("onboarding-project-upsert");
    expect(source).toContain("onboarding-funnel-upsert");
  });
});
