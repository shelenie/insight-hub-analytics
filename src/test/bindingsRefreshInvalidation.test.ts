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

  it("uses a normal dropdown-first ad account binding flow while keeping technical setup secondary", () => {
    expect(source).toContain("+ Привʼязати рекламний акаунт");
    expect(source).toContain("Нова привʼязка рекламного акаунта");
    expect(source).toContain('label="Рекламний акаунт"');
    expect(source).toContain('label="Клієнт"');
    expect(source).toContain('label="Проєкт"');
    expect(source).toContain('label="Воронка"');
    expect(source).toContain("Для цього клієнта ще немає проєктів");
    expect(source).toContain("Для цього проєкту ще немає воронок");
    expect(source).toContain("Технічне налаштування через ID");
    expect(source).toContain("<details");
  });

  it("shows visible manual binding feedback beside the technical setup form", () => {
    expect(source).toContain("Звʼязок рекламного акаунта збережено. Якщо такий active-звʼязок уже існував, його оновлено без створення дубля.");
    expect(source).toContain("Звʼязок джерела збережено.");
    expect(source).toContain('role="status"');
    expect(source).toContain('variant: "success"');
    expect(source).toContain("border-emerald-500/40");
    expect(source).toContain("clearFormFeedback");
    expect(source).toContain("onValueChange={handleTabChange}");
    expect(source).toContain("setForm={updateAdForm}");
    expect(source).toContain("Technical details");
    expect(source).toContain("getBindingActionTechnicalDetails");
  });
});
