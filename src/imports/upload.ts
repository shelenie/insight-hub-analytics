export const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
export const FILE_IMPORTS_BUCKET = "file-imports";
export const FILE_UPLOAD_PARSER_FUNCTION = "file-upload-parser";
export const MAX_IMPORT_FILE_SIZE_BYTES = 15 * 1024 * 1024;
export const ALLOWED_IMPORT_EXTENSIONS = [".csv", ".tsv", ".txt", ".xlsx", ".xls"] as const;

export type ImportSourceType =
  | "manual_file_upload"
  | "traffic"
  | "registrations"
  | "applications"
  | "bookings"
  | "questionnaires"
  | "sales"
  | "viewers";

export function validateImportFile(file: File): "unsupported" | "too_large" | null {
  const extension = getFileExtension(file.name);
  if (!ALLOWED_IMPORT_EXTENSIONS.includes(extension as (typeof ALLOWED_IMPORT_EXTENSIONS)[number])) return "unsupported";
  if (file.size > MAX_IMPORT_FILE_SIZE_BYTES) return "too_large";
  return null;
}

export function buildImportStoragePath(fileName: string, date = new Date()): string {
  return `workspace_${WORKSPACE_ID}/uploads/${date.toISOString().replace(/[:.]/g, "-")}-${sanitizeImportFileName(fileName)}`;
}

function sanitizeImportFileName(fileName: string): string {
  const extension = getFileExtension(fileName);
  const base = fileName.slice(0, extension ? -extension.length : undefined).replace(/[^a-zA-Z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 80) || "upload";
  return `${base}${extension}`;
}

function getFileExtension(fileName: string): string {
  const match = fileName.toLowerCase().match(/\.[^.]+$/);
  return match?.[0] ?? "";
}
