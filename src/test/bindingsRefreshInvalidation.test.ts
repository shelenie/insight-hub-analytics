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
    expect(source).toContain('setAdAccountStatusFilter("archived")');
    expect(source).toContain('setAdAccountStatusFilter("all")');
  });
});
