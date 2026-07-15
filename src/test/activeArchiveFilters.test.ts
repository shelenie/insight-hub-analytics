import { describe, expect, it } from "vitest";
import { buildStatusMap, filterByOperationalStatus, filterProjectBindings } from "@/lib/activeArchiveFilters";

describe("active/archive frontend filters", () => {
  const rows = [
    { id: "active", name: "Active", status: "active" },
    { id: "inactive", name: "Inactive", status: "inactive" },
    { id: "archived", name: "Archived", status: "archived" },
  ];

  it("Onboarding clients/projects/funnels default active filter hides archived and inactive rows", () => {
    expect(filterByOperationalStatus(rows, "active").map((row) => row.id)).toEqual(["active"]);
  });

  it("Onboarding archived and all filters can show archived rows", () => {
    expect(filterByOperationalStatus(rows, "archived").map((row) => row.id)).toEqual(["archived"]);
    expect(filterByOperationalStatus(rows, "all").map((row) => row.id)).toEqual(["active", "inactive", "archived"]);
  });

  const maps = {
    clients: buildStatusMap([{ client_id: "c1", status: "active" }, { client_id: "c2", status: "archived" }], ["client_id"]),
    projects: buildStatusMap([{ project_id: "p1", status: "active" }, { project_id: "p2", status: "archived" }], ["project_id"]),
    funnels: buildStatusMap([{ funnel_id: "f1", status: "active" }, { funnel_id: "f2", status: "archived" }], ["funnel_id"]),
  };
  const bindings = [
    { id: "active", binding_status: "active", client_id: "c1", project_id: "p1", funnel_id: "f1" },
    { id: "archived-binding", binding_status: "archived", client_id: "c1", project_id: "p1", funnel_id: "f1" },
    { id: "archived-client", binding_status: "active", client_id: "c2", project_id: "p1", funnel_id: "f1" },
    { id: "archived-project", binding_status: "active", client_id: "c1", project_id: "p2", funnel_id: "f1" },
    { id: "archived-funnel", binding_status: "active", client_id: "c1", project_id: "p1", funnel_id: "f2" },
  ];

  it("Bindings project bindings default hides archived binding_status and archived hierarchy rows", () => {
    expect(filterProjectBindings(bindings, "active", maps).map((row) => row.id)).toEqual(["active"]);
  });

  it("Bindings project bindings archived filter shows archived binding_status and archived hierarchy rows", () => {
    expect(filterProjectBindings(bindings, "archived", maps).map((row) => row.id)).toEqual([
      "archived-binding",
      "archived-client",
      "archived-project",
      "archived-funnel",
    ]);
  });

  it("Bindings Overview project context count can use the active-only project binding rows", () => {
    expect(filterProjectBindings(bindings, "active", maps)).toHaveLength(1);
  });
});
