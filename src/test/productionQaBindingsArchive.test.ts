import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bindings = readFileSync("src/pages/Bindings.tsx", "utf8");
const onboarding = readFileSync("src/pages/Onboarding.tsx", "utf8");
const archiveHelpers = readFileSync("src/lib/onboardingArchiveHelpers.ts", "utf8");
const edge = readFileSync("supabase/functions/binding-create-or-update/index.ts", "utf8");

describe("production QA review fixes", () => {
  it("parses structured source save errors exactly once and shows one global toast", () => {
    const saveBlock = bindings.slice(bindings.indexOf("const saveSourceBinding"), bindings.indexOf("const newBindingId"));
    expect(saveBlock).toContain("const friendlyMessage = await getFriendlyBindingActionError(error, t)");
    expect(saveBlock).toContain('title: t("bindingsSourceSaveErrorTitle")');
    expect(saveBlock).toContain('variant: "error"');
    expect(saveBlock).toContain("duration: 5000");
    expect(saveBlock).not.toContain("error?.message");
    expect(saveBlock).not.toContain("setSourceFeedback");
    expect(saveBlock.match(/getFriendlyBindingActionError\(error, t\)/g)).toHaveLength(1);
  });

  it("maps sources to canonical registry identity and preserves business metadata", () => {
    expect(edge).toContain('source_kind: "google_sheet_source"');
    expect(edge).toContain('source_table: "google_sheet_sources"');
    expect(edge).toContain('source_kind: "google_sheet_tab"');
    expect(edge).toContain('source_table: "google_sheet_tabs"');
    expect(edge).toContain('source_kind: "file_dataset"');
    expect(edge).toContain('source_table: "raw_external_datasets"');
    expect(edge).toContain("source_type: data.source_type ?? null");
    expect(edge).toContain("target_raw_table: data.target_raw_table ?? null");
    expect(edge).toContain("google_sheet_source_id: parentSheetId");
    expect(edge).toContain("parser_type: data.parser_type ?? null");
    expect(edge).toContain("p_metadata: mergeSourceMetadata(body.metadata, source!.metadata)");
    expect(edge).not.toContain("source_kind: data.source_type");
  });

  it("counts only bindings matching SQL coalesce(binding_status, 'active') = 'active'", () => {
    expect(onboarding).toContain("isActiveCascadeBindingStatus(row)");
    expect(archiveHelpers).toContain('String(row.binding_status ?? "")');
    expect(archiveHelpers).toContain('normalized === "" || normalized === "active"');
    expect(archiveHelpers).not.toContain("isInactiveStatus(status || \"active\")");
  });

  it("keeps shared drawer and wheel scrolling behavior without fake compatibility markers", () => {
    expect(bindings).toContain("function BindingDrawerLayout");
    expect(bindings).toContain("function BindingDrawerFooter");
    expect(bindings).toContain('className="max-h-72 overflow-y-auto overscroll-contain"');
    expect(bindings).toContain("onWheel={(event) => event.stopPropagation()}");
    for (const source of [bindings, onboarding, edge]) {
      expect(source).not.toContain("Test compatibility");
      expect(source).not.toContain("compatibility marker");
    }
  });
});
