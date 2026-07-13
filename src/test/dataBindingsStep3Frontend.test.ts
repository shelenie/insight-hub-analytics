import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const bindings = readFileSync("src/pages/Bindings.tsx", "utf8");
const mutations = readFileSync("src/lib/dataBindingsMutations.ts", "utf8");
const edge = readFileSync(
  "supabase/functions/binding-create-or-update/index.ts",
  "utf8",
);
const translations = readFileSync("src/i18n/translations.ts", "utf8");

describe("Step 3 Data Bindings frontend production flow", () => {
  it("loads source candidates only for binding managers with safe fields", () => {
    expect(bindings).toContain(
      'queryKey: ["source-binding-candidates", WORKSPACE_ID]',
    );
    expect(bindings).toContain("enabled: Boolean(session) && canManage");
    expect(bindings).toContain(
      '.select("id, spreadsheet_name, spreadsheet_id, status, is_active")',
    );
    expect(bindings).toContain(
      '.select("id, google_sheet_source_id, source_id, tab_name, source_type, target_raw_table, is_active")',
    );
    expect(bindings).toContain("const activeSheetIds = new Set");
    expect(bindings).toContain(
      "row.is_active !== false && activeSheetIds.has(parentId)",
    );
    expect(bindings).toContain(
      '.select("id, dataset_name, sheet_name, source_type, target_raw_table, status, parser_type")',
    );
    expect(bindings).not.toMatch(
      /secret_ref|access_token|refresh_token|oauth|config_json|storage_path|raw_rows/i,
    );
  });

  it("replaces raw source UUID form with searchable source workflow", () => {
    const sourceTab = bindings.slice(
      bindings.indexOf('<TabsContent value="source"'),
      bindings.indexOf('<TabsContent value="ad-account"'),
    );
    expect(sourceTab).toContain("<SourceBindingCard");
    expect(sourceTab).toContain("<SourceBindingsBusinessTable");
    expect(bindings).toContain('label={t("bindingsSelectSourceLabel")}');
    expect(bindings).toContain('role="combobox"');
    expect(sourceTab).not.toContain("<AdminBindingForm");
    expect(sourceTab).not.toContain('placeholder="source_id"');
  });

  it("implements two-phase selected source rebind and partial-success warning", () => {
    expect(bindings).toContain(
      'supabase.functions.invoke("binding-create-or-update"',
    );
    expect(bindings).toContain('binding_type: "source"');
    expect(bindings).toContain("bindingId: oldBindingId");
    expect(bindings).toContain('bindingType: "source"');
    expect(bindings).toContain("source_rebind_partial");
    expect(bindings).toContain("bindingsSourcePartialRebindWarning");
    expect(bindings).toContain(
      "const newBindingId = extractBindingId(response)",
    );
    expect(bindings).toContain("new_binding_id: newBindingId");
    expect(bindings).not.toContain("new_source_id");
    expect(translations).toContain(
      "The new source binding was saved, but the previous binding could not be archived",
    );
  });

  it("archives exact selected source and ad-account rows through a dialog", () => {
    expect(bindings).toContain("ArchiveBindingDialog");
    expect(bindings).toContain('setArchiveTarget({ row, type: "source" })');
    expect(bindings).toContain('setArchiveTarget({ row, type: "ad_account" })');
    expect(bindings).toContain("handleArchiveSelected");
    expect(bindings).not.toContain("window.confirm");
    expect(bindings).not.toContain("window.prompt");
    expect(translations).toContain(
      "Only this selected binding will be archived",
    );
  });

  it("uses dialogs for onboarding hierarchy creation", () => {
    expect(bindings).toContain("HierarchyCreateDialog");
    expect(bindings).toContain('<Input id="hierarchy-name"');
    expect(bindings).toContain("!name.trim()");
    expect(bindings).toContain('pending === "hierarchy-save"');
    expect(bindings).toContain("setHierarchyError");
    expect(bindings).toContain("result.data!");
  });

  it("keeps separate capability gates for bindings, onboarding, and mapping review", () => {
    expect(bindings).toContain("capabilities.can_manage_bindings");
    expect(bindings).toContain("capabilities.can_manage_onboarding");
    expect(bindings).toContain("capabilities.can_manage_mapping_review");
    expect(bindings).toContain("!canManageMappingReview");
  });

  it("initializes full ad form state and creates ad bindings as not primary by default", () => {
    expect(bindings).toContain(
      'primary_intent: "remove_primary" as PrimaryIntent',
    );
    expect(bindings).toContain('original_is_primary: "false"');
    expect(bindings).toContain("...EMPTY_AD_FORM");
    expect(bindings).toContain("ad_account_id: adAccountId");
    expect(mutations).toContain(
      'if (intent === "remove_primary") return false;',
    );
    expect(mutations).toContain(
      "p_is_primary: primaryIntentValue(input.primaryIntent)",
    );
  });

  it("sends exact selected ad replacement IDs without searching unrelated scopes", () => {
    expect(bindings).toContain("binding_id: getBindingId(row)");
    expect(bindings).toContain(
      "replaceBindingId: sameScope ? null : normalAdForm.binding_id || null",
    );
    expect(bindings).not.toContain(
      "find((binding) => asText(binding.ad_account_id)",
    );
  });

  it("sanitizes normal errors and keeps technical details collapsed", () => {
    expect(bindings).toContain('response.code === "42501"');
    expect(bindings).toContain('response.code === "22023"');
    expect(bindings).toContain('response.code === "PGRST202"');
    expect(bindings).toContain('return t("bindingsActionFailed")');
    expect(bindings).toContain("<details");
    expect(bindings).toContain('t("bindingsTechnicalDetails")');
    expect(translations).toContain(
      'bindingsTechnicalDetails: { uk: "Технічні деталі", en: "Technical details" }',
    );
  });

  it("preserves original primary state for selected source and ad-account rebinds", () => {
    expect(bindings).toContain("function resolvePrimaryForMutation");
    expect(bindings).toContain(
      'return isRebind ? form.original_is_primary === "true" : null;',
    );
    expect(bindings).toContain(
      "original_is_primary: String(Boolean(row.is_primary))",
    );
    expect(bindings).toContain(
      "is_primary: resolvePrimaryForMutation(sourceForm, isRebind)",
    );
    expect(bindings).toContain(
      "primaryIntentForValue(resolvePrimaryForMutation(normalAdForm, isRebind))",
    );
    expect(bindings).toContain('if (value === true) return "make_primary";');
    expect(bindings).toContain('if (value === false) return "remove_primary";');
  });

  it("preserves source resolver canonical identity conventions", () => {
    expect(edge).toContain('source_kind: "google_sheet_source"');
    expect(edge).toContain('source_kind: "google_sheet_tab"');
    expect(edge).toContain('source_kind: "file_dataset"');
    expect(edge).toContain('source_table: "google_sheet_sources"');
    expect(edge).toContain(
      'source_table: data.target_raw_table ?? "google_sheet_tabs"',
    );
    expect(edge).toContain(
      "data.is_active === false || isInactiveStatus(data.status)",
    );
    expect(edge).toContain("google_sheet_source_id ?? data.source_id");
    expect(edge).toContain(
      '.select("id, spreadsheet_id, spreadsheet_name, status, is_active")',
    );
    expect(edge).toContain("if (!parentSheetId)");
    expect(edge).toContain(
      "sheet.is_active === false || isInactiveStatus(sheet.status)",
    );
    expect(edge).toContain("await userClient.rpc(rpcName, rpcPayload)");
    expect(edge).not.toContain("source_kind: data.source_type");
  });
});
