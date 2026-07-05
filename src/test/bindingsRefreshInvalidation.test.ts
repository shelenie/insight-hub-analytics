import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  resolve(process.cwd(), "src/pages/Bindings.tsx"),
  "utf8",
);
const translationsSource = readFileSync(
  resolve(process.cwd(), "src/i18n/translations.ts"),
  "utf8",
);

describe("Bindings page ad account behavior", () => {
  it("refreshes Ads connectors data after binding actions", () => {
    const refreshStart = source.indexOf("const refreshBindings = async () =>");
    const refreshEnd = source.indexOf("const handleRefresh", refreshStart);
    const refreshSource = source.slice(refreshStart, refreshEnd);

    expect(refreshSource).toContain("query.refetch()");
    expect(refreshSource).toContain(
      '["ads-connectors-workspace", WORKSPACE_ID]',
    );
  });

  it("defaults the Ad Accounts tab to active bindings with explicit historical filters", () => {
    expect(source).toContain(
      'useState<AdAccountBindingStatusFilter>("active")',
    );
    expect(source).toContain(
      "matchesAdAccountBindingStatusFilter(row, adAccountStatusFilter)",
    );
    expect(source).toContain(
      'if (filter === "active") return isActiveBinding(row);',
    );
    expect(source).toContain(
      'if (filter === "archived") return isArchivedOrPausedBinding(row);',
    );
    expect(source).toContain("onValueChange={(value) =>");
    expect(source).toContain("setAdAccountStatusFilter(");
    expect(source).toContain('value="archived"');
    expect(source).toContain('t("bindingsStatusArchivedPaused")');
    expect(translationsSource).toContain("Archived/paused");
    expect(source).toContain('value="all"');
    expect(source).toContain('t("bindingsStatusAll")');
    expect(source).not.toContain(
      'variant={adAccountStatusFilter === "active" ? "secondary" : "ghost"}',
    );
  });

  it("merges the ad account section header and controls without a separate helper toolbar card", () => {
    const tabStart = source.indexOf('<TabsContent value="ad-account"');
    const tableStart = source.indexOf("<AdAccountsBusinessTable", tabStart);
    const adAccountTabSource = source.slice(tabStart, tableStart);

    expect(adAccountTabSource).toContain("<SectionCard noPadding>");
    expect(adAccountTabSource).toContain('t("bindingsAdAccountsTitle")');
    expect(adAccountTabSource).toContain('t("bindingsAdAccountsDescription")');
    expect(translationsSource).toContain(
      'bindingsAdAccountsTitle: { uk: "Рекламні акаунти", en: "Ad accounts" }',
    );
    expect(translationsSource).toContain(
      "Manage ad account bindings to clients, projects, and funnels. IDs are passed automatically.",
    );
    expect(adAccountTabSource).not.toContain(
      "Оберіть акаунт, клієнта, проєкт і воронку — ID передаються автоматично.",
    );
    expect(adAccountTabSource).toContain('t("bindingsStatusLabel")');
    expect(adAccountTabSource).toContain("sm:w-[14.5rem]");
    expect(adAccountTabSource).toContain("lg:shrink-0");
    expect(adAccountTabSource).toContain('t("bindingsCreateAdAccountButton")');
    expect(adAccountTabSource).not.toContain(
      "rounded-lg border border-border/60 bg-muted/20",
    );
    expect(adAccountTabSource).not.toContain('className="space-y-1"');
    expect(adAccountTabSource).not.toContain(
      ">\n                        Статус\n                      </label>",
    );
  });
  it("routes Data Bindings admin copy through the bilingual i18n dictionary", () => {
    [
      "bindingsTabOverview",
      "bindingsTabSources",
      "bindingsTabAdAccounts",
      "bindingsOverviewTitle",
      "bindingsOverviewFilesTitle",
      "bindingsOverviewFilesDescription",
      "bindingsSourcesTitle",
      "bindingsSourcesDescription",
      "bindingsSourcesEmpty",
      "bindingsProjectBindingsTitle",
      "bindingsProjectBindingsDescription",
      "bindingsMappingReviewTitle",
      "bindingsMappingReviewDescription",
      "bindingsMappingReviewEmptyTitle",
      "bindingsMappingReviewEmptyDescription",
      "bindingsHealthTitle",
      "bindingsHealthDescription",
    ].forEach((key) => expect(source).toContain(`t("${key}")`));

    expect(translationsSource).toContain(
      'bindingsOverviewFilesTitle: { uk: "Файли й таблиці", en: "Files and tables" }',
    );
    expect(translationsSource).toContain(
      "Google Sheets, CSV/import files, CRM exports, and external tables without ad accounts.",
    );
    expect(translationsSource).toContain(
      "Non-ad sources: Google Sheets, CSV/import files, CRM exports, and external tables.",
    );
    expect(translationsSource).toContain(
      "No files or tables are connected yet. Ad accounts are managed in a separate tab.",
    );
    expect(translationsSource).toContain(
      'bindingsProjectBindingsTitle: { uk: "Привʼязки до проєктів", en: "Project bindings" }',
    );
    expect(translationsSource).toContain(
      "All sources already connected to clients, projects, and funnels. This is a consolidated read-only view of existing bindings.",
    );
    expect(translationsSource).toContain(
      'bindingsMappingReviewTitle: { uk: "Мапінг на перевірку", en: "Mapping review" }',
    );
    expect(translationsSource).toContain(
      "Sources that the system could not confidently bind automatically will appear here.",
    );
    expect(translationsSource).toContain("No bindings require review.");
    expect(translationsSource).toContain(
      "When the system finds an unknown or unconfirmed source, it will appear here.",
    );
    expect(translationsSource).toContain(
      'bindingsHealthTitle: { uk: "Стан мапінгу та підтверджень", en: "Mapping and confirmation status" }',
    );
    expect(translationsSource).toContain(
      "Production status of the mapping queue, Telegram confirmations, and errors.",
    );
  });

  it("uses a searchable combobox-first ad account binding flow while keeping technical setup secondary", () => {
    expect(source).toContain('t("bindingsCreateAdAccountButton")');
    expect(source).toContain('t("bindingsAdDrawerCreateTitle")');
    expect(source).toContain('t("bindingsAdDrawerEditTitle")');
    expect(source).toContain("<Sheet");
    expect(source).toContain("<SheetContent");
    expect(source).toContain('side="right"');
    expect(source).toContain('role="combobox"');
    expect(source).toContain("CommandInput");
    expect(source).toContain("filterComboboxOptions");
    expect(source).toContain("comboboxSearchValue(option)");
    expect(source).toContain('label={t("bindingsSelectAdAccountLabel")}');
    expect(source).toContain('label={t("bindingsSelectClientLabel")}');
    expect(source).toContain('label={t("bindingsSelectProjectLabel")}');
    expect(source).toContain('label={t("bindingsSelectFunnelLabel")}');
    expect(source).toContain('t("bindingsProjectEmptyForClient")');
    expect(source).toContain('t("bindingsFunnelEmptyForProject")');
    expect(source).toContain('t("bindingsTechnicalSummary")');
    expect(source).toContain("<details");
  });

  it("opens ad account binding in a sheet without rendering the form inline above the table", () => {
    const tabStart = source.indexOf('<TabsContent value="ad-account"');
    const tableStart = source.indexOf("<AdAccountsBusinessTable", tabStart);
    const technicalStart = source.indexOf("<AdminBindingForm", tableStart);
    const adAccountTabSource = source.slice(tabStart, technicalStart);

    expect(adAccountTabSource).toContain("<Sheet");
    expect(adAccountTabSource).toContain("<SheetContent");
    expect(adAccountTabSource).toContain("setNormalAdForm(EMPTY_AD_FORM)");
    expect(adAccountTabSource).toContain('setAdFormMode("create")');
    expect(adAccountTabSource).toContain("setAdFormOpen(true)");
    expect(adAccountTabSource).toContain("setNormalAdFeedback(null)");
    expect(adAccountTabSource).toContain("<AdAccountsBusinessTable");
    expect(adAccountTabSource).toContain('t("bindingsAdAccountsTitle")');
    expect(adAccountTabSource).not.toContain(
      "mb-4 rounded-xl border border-primary/20",
    );
  });

  it("uses an auto-dismissing toast for normal ad account save success and clears the form", () => {
    expect(source).toContain("const EMPTY_AD_FORM");
    expect(source).toContain("includeTechnicalDetails: false");
    expect(source).toContain("setNormalAdForm(EMPTY_AD_FORM)");
    expect(source).toContain("setAdFormOpen(false)");
    expect(source).toContain('import { toast } from "@/hooks/use-toast";');
    expect(source).toContain("toast({");
    expect(source).toContain("hasMatchingActiveAdBinding");
    expect(source).toContain('t("bindingsToastUpdatedTitle")');
    expect(source).toContain('t("bindingsToastUpdatedDescription")');
    expect(source).toContain('t("bindingsToastCreatedTitle")');
    expect(source).toContain('t("bindingsToastCreatedDescription")');
    expect(source).toContain("border-emerald-500/50 bg-emerald-50");
    expect(source).toContain("duration: 5000");
    expect(source).not.toContain("normalAdSuccess");
    expect(source).not.toContain("setNormalAdSuccess");
    expect(source).toContain('normalAdFeedback?.variant === "error"');
    expect(source).toContain("successFeedback: false");
    expect(source).not.toContain("feedback={formFeedback.ad_account}");
  });

  it("keeps normal drawer state separate from technical UUID form state", () => {
    expect(source).toContain(
      "const [normalAdForm, setNormalAdForm] = useState(EMPTY_AD_FORM)",
    );
    expect(source).toContain(
      "const [technicalAdForm, setTechnicalAdForm] = useState(EMPTY_AD_FORM)",
    );
    expect(source).toContain("const [normalAdFeedback, setNormalAdFeedback]");
    expect(source).toContain(
      "const [technicalAdFeedback, setTechnicalAdFeedback]",
    );
    expect(source).toContain("updateNormalAdForm");
    expect(source).toContain("updateTechnicalAdForm");
    expect(source).toContain("form={normalAdForm}");
    expect(source).toContain("form={technicalAdForm}");
    expect(source).toContain("feedback={technicalAdFeedback}");
    expect(source).toContain("feedbackHandler: setTechnicalAdFeedback");
    expect(source).not.toContain(
      "const [adForm, setAdForm] = useState(EMPTY_AD_FORM)",
    );
    expect(source).not.toContain("formFeedback.ad_account");
  });

  it("shows visible manual binding feedback beside the technical setup form", () => {
    expect(source).toContain('t("bindingsAdSavedIdempotent")');
    expect(source).toContain('t("bindingsSourceSaved")');
    expect(source).toContain('role="status"');
    expect(source).toContain('variant: "success"');
    expect(source).toContain("border-emerald-500/40");
    expect(source).toContain("clearFormFeedback");
    expect(source).toContain("onValueChange={handleTabChange}");
    expect(source).toContain("setForm={updateTechnicalAdForm}");
    expect(source).toContain("feedback={technicalAdFeedback}");
    expect(source).toContain("Technical details");
    expect(source).toContain("getBindingActionTechnicalDetails");
  });
});
