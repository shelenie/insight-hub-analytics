import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/AdsConnectors.tsx"), "utf8");

describe("AdsConnectors ad account status filter", () => {
  it("defaults the connected ad accounts list to active bindings only", () => {
    expect(source).toContain('useState<AdAccountBindingStatusFilter>("active")');
    expect(source).toContain('if (filter === "active") return isActiveAccountBinding(row);');
    expect(source).toContain("matchesAdAccountBindingStatusFilter(row, statusFilter)");
  });

  it("provides explicit archived/paused and all filter options", () => {
    expect(source).toContain('type AdAccountBindingStatusFilter = "active" | "archived" | "all";');
    expect(source).toContain('setStatusFilter("archived")');
    expect(source).toContain('setStatusFilter("all")');
    expect(source).toContain("isArchivedOrPausedAccount(row)");
  });

  it("keeps ready account counts restricted to active non-test bindings", () => {
    expect(source).toContain("isActiveAccountBinding(row) && !hasTestBindingMarker(row)");
  });
});
