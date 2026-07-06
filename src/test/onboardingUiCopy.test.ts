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

  it("does not add fake invite, member, or access management actions", () => {
    expect(source).not.toMatch(/invite|invitation|member|workspace member|user access/i);
    expect(source).toContain("onboarding-client-upsert");
    expect(source).toContain("onboarding-project-upsert");
    expect(source).toContain("onboarding-funnel-upsert");
  });
});
