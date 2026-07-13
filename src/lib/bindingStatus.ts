export type BindingStatusRow = Record<string, unknown>;

export function getBindingStatus(row: BindingStatusRow) {
  return String(row.binding_status ?? row.status ?? "")
    .trim()
    .toLowerCase();
}

export function isActiveBinding(row: BindingStatusRow) {
  return getBindingStatus(row) === "active";
}

export function isArchivedBinding(row: BindingStatusRow) {
  return getBindingStatus(row) === "archived";
}

export function isPausedBinding(row: BindingStatusRow) {
  return getBindingStatus(row) === "paused";
}

export function canRestoreBinding(row: BindingStatusRow) {
  return isArchivedBinding(row);
}

export function matchesBindingStatusFilter(row: BindingStatusRow, filter: "active" | "archived" | "all") {
  if (filter === "active") return isActiveBinding(row);
  if (filter === "archived") return isArchivedBinding(row);
  return true;
}
