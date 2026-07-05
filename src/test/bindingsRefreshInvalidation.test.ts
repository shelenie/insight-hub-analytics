import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/Bindings.tsx"), "utf8");

describe("Bindings page ad account behavior", () => {
  it("refreshes Ads connectors data after binding actions", () => {
    const refreshStart = source.indexOf("const refreshBindings = async () =>");
    const refreshEnd = source.indexOf("const handleRefresh", refreshStart);
    const refreshSource = source.slice(refreshStart, refreshEnd);

    expect(refreshSource).toContain("query.refetch()");
    expect(refreshSource).toContain('["ads-connectors-workspace", WORKSPACE_ID]');
  });

  it("defaults the Ad Accounts tab to active bindings with explicit historical filters", () => {
    expect(source).toContain('useState<AdAccountBindingStatusFilter>("active")');
    expect(source).toContain("matchesAdAccountBindingStatusFilter(row, adAccountStatusFilter)");
    expect(source).toContain('if (filter === "active") return isActiveBinding(row);');
    expect(source).toContain('if (filter === "archived") return isArchivedOrPausedBinding(row);');
    expect(source).toContain('onValueChange={(value) =>');
    expect(source).toContain('setAdAccountStatusFilter(');
    expect(source).toContain('value="archived"');
    expect(source).toContain('Архівні/призупинені');
    expect(source).toContain('value="all"');
    expect(source).toContain('Усі');
    expect(source).not.toContain('variant={adAccountStatusFilter === "active" ? "secondary" : "ghost"}');
  });


  it("keeps the ad account toolbar compact with stable status select width", () => {
    const tabStart = source.indexOf('<TabsContent value="ad-account"');
    const tableStart = source.indexOf("<AdAccountsBusinessTable", tabStart);
    const adAccountTabSource = source.slice(tabStart, tableStart);

    expect(adAccountTabSource).toContain("lg:grid-cols-[minmax(0,1fr)_auto]");
    expect(adAccountTabSource).toContain("lg:items-center");
    expect(adAccountTabSource).toContain("Оберіть акаунт, клієнта, проєкт і воронку — ID передаються автоматично.");
    expect(adAccountTabSource).toContain("Статус:");
    expect(adAccountTabSource).toContain("sm:w-[14.5rem]");
    expect(adAccountTabSource).toContain("sm:shrink-0");
    expect(adAccountTabSource).not.toContain("lg:items-end");
    expect(adAccountTabSource).not.toContain('className="space-y-1"');
    expect(adAccountTabSource).not.toContain(">\n                        Статус\n                      </label>");
  });

  it("uses a searchable combobox-first ad account binding flow while keeping technical setup secondary", () => {
    expect(source).toContain("+ Привʼязати рекламний акаунт");
    expect(source).toContain("Привʼязати рекламний акаунт");
    expect(source).toContain("Редагувати привʼязку");
    expect(source).toContain("<Sheet");
    expect(source).toContain("<SheetContent");
    expect(source).toContain('side="right"');
    expect(source).toContain('role="combobox"');
    expect(source).toContain("CommandInput");
    expect(source).toContain("filterComboboxOptions");
    expect(source).toContain("comboboxSearchValue(option)");
    expect(source).toContain('label="Рекламний акаунт"');
    expect(source).toContain('label="Клієнт"');
    expect(source).toContain('label="Проєкт"');
    expect(source).toContain('label="Воронка"');
    expect(source).toContain("Для цього клієнта ще немає проєктів");
    expect(source).toContain("Для цього проєкту ще немає воронок");
    expect(source).toContain("Advanced / Технічний режим: налаштування через ID");
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
    expect(adAccountTabSource).not.toContain("<h2");
    expect(adAccountTabSource).not.toContain("mb-4 rounded-xl border border-primary/20");
  });

  it("uses an auto-dismissing toast for normal ad account save success and clears the form", () => {
    expect(source).toContain("const EMPTY_AD_FORM");
    expect(source).toContain("includeTechnicalDetails: false");
    expect(source).toContain("setNormalAdForm(EMPTY_AD_FORM)");
    expect(source).toContain("setAdFormOpen(false)");
    expect(source).toContain('import { toast } from "@/hooks/use-toast";');
    expect(source).toContain("toast({");
    expect(source).toContain("hasMatchingActiveAdBinding");
    expect(source).toContain("Звʼязок оновлено");
    expect(source).toContain("Існуючий active-звʼязок оновлено без створення дубля.");
    expect(source).toContain("Звʼязок створено");
    expect(source).toContain("Рекламний акаунт привʼязано до клієнта, проєкту і воронки.");
    expect(source).toContain("border-emerald-500/50 bg-emerald-50");
    expect(source).toContain("duration: 5000");
    expect(source).not.toContain("normalAdSuccess");
    expect(source).not.toContain("setNormalAdSuccess");
    expect(source).toContain(`feedback={
                        normalAdFeedback?.variant === "error"`);
    expect(source).toContain('successFeedback: false');
    expect(source).not.toContain('feedback={formFeedback.ad_account}');
  });


  it("keeps normal drawer state separate from technical UUID form state", () => {
    expect(source).toContain("const [normalAdForm, setNormalAdForm] = useState(EMPTY_AD_FORM)");
    expect(source).toContain("const [technicalAdForm, setTechnicalAdForm] = useState(EMPTY_AD_FORM)");
    expect(source).toContain("const [normalAdFeedback, setNormalAdFeedback]");
    expect(source).toContain("const [technicalAdFeedback, setTechnicalAdFeedback]");
    expect(source).toContain("updateNormalAdForm");
    expect(source).toContain("updateTechnicalAdForm");
    expect(source).toContain("form={normalAdForm}");
    expect(source).toContain("form={technicalAdForm}");
    expect(source).toContain("feedback={technicalAdFeedback}");
    expect(source).toContain("feedbackHandler: setTechnicalAdFeedback");
    expect(source).not.toContain("const [adForm, setAdForm] = useState(EMPTY_AD_FORM)");
    expect(source).not.toContain("formFeedback.ad_account");
  });

  it("shows visible manual binding feedback beside the technical setup form", () => {
    expect(source).toContain("Звʼязок рекламного акаунта збережено. Якщо такий active-звʼязок уже існував, його оновлено без створення дубля.");
    expect(source).toContain("Звʼязок джерела збережено.");
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
