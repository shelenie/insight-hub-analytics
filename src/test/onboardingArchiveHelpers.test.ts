import { describe, expect, it } from "vitest";
import { countActiveClientDescendants, countActiveProjectDescendants, isActiveCascadeBindingStatus, isInactiveOnboardingStatus } from "@/lib/onboardingArchiveHelpers";

const projects = [
  { project_id: "p1", client_id: "c1", status: "active" },
  { project_id: "p2", client_id: "c1", status: "archived" },
  { project_id: "p3", client_id: "c2", status: "active" },
  { project_id: "p4", client_id: "c1", status: "inactive" },
];

const funnels = [
  { funnel_id: "f1", client_id: "c1", project_id: "p1", status: "active" },
  { funnel_id: "f2", client_id: "c1", project_id: "p1", status: "archived" },
  { funnel_id: "f3", client_id: "c1", project_id: "p2", status: "active" },
  { funnel_id: "f4", client_id: "c2", project_id: "p3", status: "active" },
  { funnel_id: "f5", client_id: "c1", project_id: "p1", status: "disabled" },
];

describe("onboarding archive count helpers", () => {
  it("recognizes inactive onboarding statuses", () => {
    expect(isInactiveOnboardingStatus("archived")).toBe(true);
    expect(isInactiveOnboardingStatus("disabled")).toBe(true);
    expect(isInactiveOnboardingStatus("active")).toBe(false);
  });

  it("counts only active descendants for the selected client", () => {
    expect(countActiveClientDescendants({ clientId: "c1", projects, funnels })).toEqual({ activeProjects: 1, activeFunnels: 2 });
  });

  it("excludes unrelated workspace/client rows and inactive descendants", () => {
    expect(countActiveClientDescendants({ clientId: "c2", projects, funnels })).toEqual({ activeProjects: 1, activeFunnels: 1 });
  });

  it("counts only active funnels for the selected project", () => {
    expect(countActiveProjectDescendants({ projectId: "p1", funnels })).toEqual({ activeFunnels: 1 });
    expect(countActiveProjectDescendants({ projectId: "p2", funnels })).toEqual({ activeFunnels: 1 });
  });

  it("matches cascade RPC binding active semantics exactly", () => {
    expect(isActiveCascadeBindingStatus({ binding_status: "active" })).toBe(true);
    expect(isActiveCascadeBindingStatus({ binding_status: null })).toBe(true);
    expect(isActiveCascadeBindingStatus({ binding_status: "" })).toBe(true);
    expect(isActiveCascadeBindingStatus({ binding_status: "paused" })).toBe(false);
    expect(isActiveCascadeBindingStatus({ binding_status: "pending" })).toBe(false);
    expect(isActiveCascadeBindingStatus({ binding_status: "archived" })).toBe(false);
    expect(isActiveCascadeBindingStatus({ binding_status: "inactive" })).toBe(false);
  });
});
