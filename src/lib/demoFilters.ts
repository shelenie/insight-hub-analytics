export const PLACEHOLDER_PATTERNS = [
  "Test Agency",
  "Test Client",
  "Northstar Digital Clinic",
  "Evergreen Growth Program",
  "Main Webinar Funnel",
  "Placeholder",
  "mock",
  "demo",
  "backend_test",
  "test_upload",
];

const PLACEHOLDER_REGEX = new RegExp(PLACEHOLDER_PATTERNS.map((p) => p.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|"), "i");

export function isPlaceholderText(text: string | null | undefined) {
  if (!text) return false;
  return PLACEHOLDER_REGEX.test(text);
}

export function isPlaceholderRow(row: Record<string, unknown>) {
  return Object.values(row).some((value) => {
    if (typeof value === "string") return isPlaceholderText(value);
    return false;
  });
}

export function filterPlaceholderRows<T extends Record<string, unknown>>(rows: T[] | null | undefined) {
  return (rows ?? []).filter((row) => !isPlaceholderRow(row));
}
