export type StatusFilter = "active" | "archived" | "all";
export type FilterRow = Record<string, string | number | boolean | null | undefined>;

export function asFilterText(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

export function isExactlyActiveStatus(status: string | number | boolean | null | undefined) {
  return asFilterText(status) === "active";
}

export function filterByOperationalStatus<T extends FilterRow>(rows: T[], filter: StatusFilter) {
  if (filter === "all") return rows;
  return rows.filter((row) => asFilterText(row.status) === filter);
}

export function buildStatusMap(rows: FilterRow[], idKeys: string[]) {
  const map = new Map<string, string>();
  for (const row of rows) {
    const status = asFilterText(row.status);
    for (const key of idKeys) {
      const id = asFilterText(row[key]);
      if (id && !map.has(id)) map.set(id, status);
    }
  }
  return map;
}

export type ProjectBindingStatusMaps = {
  clients: Map<string, string>;
  projects: Map<string, string>;
  funnels: Map<string, string>;
};

export function isActiveProjectBinding(row: FilterRow, maps: ProjectBindingStatusMaps) {
  return asFilterText(row.binding_status) === "active"
    && maps.clients.get(asFilterText(row.client_id)) === "active"
    && maps.projects.get(asFilterText(row.project_id)) === "active"
    && maps.funnels.get(asFilterText(row.funnel_id)) === "active";
}

export function isArchivedProjectBinding(row: FilterRow, maps: ProjectBindingStatusMaps) {
  return asFilterText(row.binding_status) === "archived"
    || maps.clients.get(asFilterText(row.client_id)) === "archived"
    || maps.projects.get(asFilterText(row.project_id)) === "archived"
    || maps.funnels.get(asFilterText(row.funnel_id)) === "archived";
}

export function filterProjectBindings<T extends FilterRow>(rows: T[], filter: StatusFilter, maps: ProjectBindingStatusMaps) {
  if (filter === "all") return rows;
  if (filter === "archived") return rows.filter((row) => isArchivedProjectBinding(row, maps));
  return rows.filter((row) => isActiveProjectBinding(row, maps));
}
