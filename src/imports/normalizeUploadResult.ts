export type UploadResultSummary = {
  original_file_name: string | null;
  datasets_count: number | null;
  rows_inserted: number | null;
  columns_count: number | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function readResultString(object: Record<string, unknown>, key: string): string | null {
  const value = object[key];
  if (value === null || value === undefined || value === "") return null;
  return String(value);
}

function readResultNumber(object: Record<string, unknown>, key: string): number | null {
  const value = object[key];
  if (value === null || value === undefined || value === "") return null;
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

export function normalizeUploadResult(data: unknown, fallbackName: string): UploadResultSummary {
  const object = isRecord(data) ? data : {};
  return {
    original_file_name: readResultString(object, "original_file_name") ?? fallbackName,
    datasets_count: readResultNumber(object, "datasets_count") ?? readResultNumber(object, "datasetsCount"),
    rows_inserted: readResultNumber(object, "rows_inserted") ?? readResultNumber(object, "rowsInserted"),
    columns_count: readResultNumber(object, "columns_count") ?? readResultNumber(object, "columnsCount"),
  };
}
