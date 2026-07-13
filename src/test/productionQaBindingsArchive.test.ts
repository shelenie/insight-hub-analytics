import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bindings = readFileSync("src/pages/Bindings.tsx", "utf8");
const onboarding = readFileSync("src/pages/Onboarding.tsx", "utf8");
const translations = readFileSync("src/i18n/translations.ts", "utf8");

describe("production QA binding and archive fixes", () => {
  it("shows source save failures as one global semantic error toast without duplicate persistent drawer feedback", () => {
    expect(bindings).toContain('title: t("bindingsSourceSaveErrorTitle")');
    expect(bindings).toContain('variant: "error"');
    expect(bindings).toContain("duration: 5000");
    const failureBlock = bindings.slice(
      bindings.indexOf("const saveSourceBinding"),
      bindings.indexOf("const newBindingId"),
    );
    expect(failureBlock).not.toContain("setSourceFeedback");
    expect(bindings).toContain("source_entity_bindings_source_kind_check");
    expect(translations).toContain("Check the source type");
  });

  it("uses one shared drawer layout with scrollable body and padded sticky footer for source and ad account drawers", () => {
    expect(bindings).toContain("function BindingDrawerLayout");
    expect(bindings).toContain("function BindingDrawerFooter");
    expect(bindings.match(/<BindingDrawerLayout/g)?.length).toBe(2);
    expect(bindings).toContain(
      "overflow-y-auto overscroll-contain px-6 py-5 pb-28",
    );
    expect(bindings).toContain("sticky bottom-0");
    expect(bindings).toContain("env(safe-area-inset-bottom)");
  });

  it("lets BindingSelect wheel-scroll its internal list without bubbling to the drawer", () => {
    expect(bindings).toContain(
      'className="max-h-72 overflow-y-auto overscroll-contain"',
    );
    expect(bindings).toContain("onWheel={(event) => event.stopPropagation()}");
  });

  it("uses AlertDialog for onboarding archive and shows separate scoped source/ad binding counts", () => {
    expect(onboarding).not.toContain("window.confirm");
    expect(onboarding).toContain("function ArchiveConfirmDialog");
    expect(onboarding).toContain("onboardingArchiveActiveSourceBindings");
    expect(onboarding).toContain("onboardingArchiveActiveAdAccountBindings");
    expect(onboarding).toContain('scope === "client"');
    expect(onboarding).toContain('referenceId(row, "client_id") === id');
    expect(onboarding).toContain('scope === "project"');
    expect(onboarding).toContain('referenceId(row, "project_id") === id');
    expect(onboarding).toContain('referenceId(row, "funnel_id") === id');
  });
});
