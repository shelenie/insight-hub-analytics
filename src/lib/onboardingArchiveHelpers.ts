export type OnboardingArchiveRow = Record<string, string | number | boolean | null | undefined>;

const INACTIVE_STATUSES = new Set(["archived", "inactive", "removed", "deleted", "disabled"]);

export function isInactiveOnboardingStatus(status: unknown) {
  return INACTIVE_STATUSES.has(String(status ?? "").trim().toLowerCase());
}

export function countActiveClientDescendants(input: {
  clientId: string;
  projects: OnboardingArchiveRow[];
  funnels: OnboardingArchiveRow[];
}) {
  const activeProjects = input.projects.filter((row) => referenceId(row, "client_id") === input.clientId && !isInactiveOnboardingStatus(row.status)).length;
  const activeFunnels = input.funnels.filter((row) => referenceId(row, "client_id") === input.clientId && !isInactiveOnboardingStatus(row.status)).length;
  return { activeProjects, activeFunnels };
}

export function countActiveProjectDescendants(input: {
  projectId: string;
  funnels: OnboardingArchiveRow[];
}) {
  return {
    activeFunnels: input.funnels.filter((row) => referenceId(row, "project_id") === input.projectId && !isInactiveOnboardingStatus(row.status)).length,
  };
}

function referenceId(row: OnboardingArchiveRow, field: string) {
  const value = row[field];
  return typeof value === "string" ? value : "";
}
