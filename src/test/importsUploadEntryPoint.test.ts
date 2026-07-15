import { readFileSync } from "node:fs";
import {
  buildImportStoragePath,
  FILE_IMPORTS_BUCKET,
  FILE_UPLOAD_PARSER_FUNCTION,
  MAX_IMPORT_FILE_SIZE_BYTES,
  validateImportFile,
  WORKSPACE_ID,
} from "@/imports/upload";

const sidebar = readFileSync("src/components/layout/AppSidebar.tsx", "utf8");
const dashboardLayout = readFileSync("src/components/layout/DashboardLayout.tsx", "utf8");
const importsPage = readFileSync("src/pages/Imports.tsx", "utf8");

describe("Imports production upload entry point", () => {
  it("moves Imports to Admin navigation after Data Bindings and before Ads Connectors", () => {
    const analyticsStart = sidebar.indexOf('labelKey: "sidebarAnalytics"');
    const analyticsEnd = sidebar.indexOf('labelKey: "sidebarAdmin"', analyticsStart);
    const analytics = sidebar.slice(analyticsStart, analyticsEnd);
    expect(analytics).not.toContain('url: "/imports"');

    const adminStart = sidebar.indexOf('labelKey: "sidebarAdmin"');
    const adminEnd = sidebar.indexOf('labelKey: "sidebarAi"', adminStart);
    const admin = sidebar.slice(adminStart, adminEnd);
    expect(admin.indexOf('url: "/bindings"')).toBeLessThan(admin.indexOf('url: "/imports"'));
    expect(admin.indexOf('url: "/imports"')).toBeLessThan(admin.indexOf('url: "/ads-connectors"'));

    const searchStart = dashboardLayout.indexOf('path: "/onboarding"');
    const search = dashboardLayout.slice(searchStart, dashboardLayout.indexOf('path: "/assistant"', searchStart));
    expect(search.indexOf('path: "/bindings"')).toBeLessThan(search.indexOf('path: "/imports"'));
    expect(search.indexOf('path: "/imports"')).toBeLessThan(search.indexOf('path: "/ads-connectors"'));
  });

  it("renders production upload card copy while keeping monitoring sections", () => {
    expect(importsPage).toContain('title: "Завантажити файл"');
    expect(importsPage).toContain('title: "Upload file"');
    expect(importsPage).toContain('Upload client-provided files here and monitor import quality');
    expect(importsPage).toContain('title: "Стан імпортів"');
    expect(importsPage).toContain('title: "Помилки імпорту"');
    expect(importsPage).toContain('title: "Стан мапінгу"');
    expect(importsPage).toContain('title: "Операційні сигнали"');
    expect(importsPage).toContain('title: "Що перевірити"');
  });

  it("rejects unsupported and oversized files before upload", () => {
    expect(validateImportFile(new File(["ok"], "client.pdf", { type: "application/pdf" }))).toBe("unsupported");
    expect(validateImportFile(new File([new Uint8Array(MAX_IMPORT_FILE_SIZE_BYTES + 1)], "client.csv"))).toBe("too_large");
    expect(validateImportFile(new File(["ok"], "client.xlsx"))).toBeNull();
  });

  it("builds stable workspace storage paths", () => {
    const path = buildImportStoragePath("Client Report July 2026.xlsx", new Date("2026-07-15T12:00:00.000Z"));
    expect(path).toBe(`workspace_${WORKSPACE_ID}/uploads/2026-07-15T12-00-00-000Z-Client-Report-July-2026.xlsx`);
  });

  it("uses Supabase Storage bucket and file-upload-parser payload contract", () => {
    expect(FILE_IMPORTS_BUCKET).toBe("file-imports");
    expect(FILE_UPLOAD_PARSER_FUNCTION).toBe("file-upload-parser");
    expect(importsPage).toContain("supabase.storage.from(FILE_IMPORTS_BUCKET).upload(storagePath, selectedFile");
    expect(importsPage).toContain("supabase.functions.invoke(FILE_UPLOAD_PARSER_FUNCTION");
    expect(importsPage).toContain("workspace_id: WORKSPACE_ID");
    expect(importsPage).toContain("storage_path: storagePath");
    expect(importsPage).toContain("original_file_name: selectedFile.name");
    expect(importsPage).toContain("source_type: sourceType");
    expect(importsPage).toContain("header_row: headerRow");
    expect(importsPage).toContain("parse_all_sheets: parseAllSheets");
  });

  it("shows success summary and Data Bindings CTA", () => {
    expect(importsPage).toContain('successTitle: "Файл оброблено."');
    expect(importsPage).toContain('successTitle: "File processed."');
    expect(importsPage).toContain("result.datasets_count");
    expect(importsPage).toContain("result.rows_inserted");
    expect(importsPage).toContain("to={ROUTES.bindings}");
  });
});
