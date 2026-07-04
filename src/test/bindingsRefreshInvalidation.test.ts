import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = readFileSync(resolve(process.cwd(), "src/pages/Bindings.tsx"), "utf8");

describe("Bindings refresh invalidation", () => {
  it("refreshes Ads connectors data after binding actions", () => {
    const refreshStart = source.indexOf("const refreshBindings = async () =>");
    const refreshEnd = source.indexOf("const handleRefresh", refreshStart);
    const refreshSource = source.slice(refreshStart, refreshEnd);

    expect(refreshSource).toContain('query.refetch()');
    expect(refreshSource).toContain('["ads-connectors-workspace", WORKSPACE_ID]');
  });
});
