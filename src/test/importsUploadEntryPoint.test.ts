import { readFileSync } from "node:fs";
import { normalizeUploadResult } from "@/imports/normalizeUploadResult";
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


  it("normalizes snake_case and camelCase parser responses", () => {
    expect(normalizeUploadResult({
      original_file_name: "analytics_hub_test_leads_upload.csv",
      datasets_count: 1,
      rows_inserted: "6",
      columns_count: 10,
    }, "fallback.csv")).toEqual({
      original_file_name: "analytics_hub_test_leads_upload.csv",
      datasets_count: 1,
      rows_inserted: 6,
      columns_count: 10,
    });

    expect(normalizeUploadResult({
      original_file_name: "",
      datasetsCount: "1",
      rowsInserted: 6,
      columnsCount: "10",
    }, "fallback.csv")).toEqual({
      original_file_name: "fallback.csv",
      datasets_count: 1,
      rows_inserted: 6,
      columns_count: 10,
    });
  });

  it("keeps upload loading state inside try/finally after parser success or unexpected frontend errors", () => {
    const uploadStart = importsPage.indexOf("setIsUploading(true)");
    const uploadEnd = importsPage.indexOf("const actions = buildActions", uploadStart);
    const uploadFlow = importsPage.slice(uploadStart, uploadEnd);

    expect(uploadFlow).toContain("try {");
    expect(uploadFlow).toContain("setUploadResult(normalizeUploadResult(parser.data, selectedFile.name))");
    expect(uploadFlow).toContain("} catch (error) {");
    expect(uploadFlow).toContain("setUploadError({ kind: uploadStage, technicalDetails: getErrorMessage(error) })");
    expect(uploadFlow).toContain("} finally {");
    expect(uploadFlow).toContain("setIsUploading(false)");
  });

  it("localizes Ukrainian source labels while keeping switch On/Off labels", () => {
    const sourceOptionsStart = importsPage.indexOf("const SOURCE_TYPE_OPTIONS");
    const sourceOptions = importsPage.slice(
      sourceOptionsStart,
      importsPage.indexOf("];", sourceOptionsStart) + 2,
    );
    expect(sourceOptions).toContain('labelUk: "Авто / невідомо"');
    expect(sourceOptions).toContain('labelUk: "Трафік"');
    expect(sourceOptions).toContain('labelUk: "Реєстрації"');
    expect(sourceOptions).toContain('labelUk: "Заявки / ліди"');
    expect(sourceOptions).toContain('labelUk: "Бронювання"');
    expect(sourceOptions).toContain('labelUk: "Анкети"');
    expect(sourceOptions).toContain('labelUk: "Продажі"');
    expect(sourceOptions).toContain('labelUk: "Глядачі"');
    for (const rawLabel of ["Auto / Unknown", "Traffic", "Registrations", "Applications / Leads", "Bookings", "Questionnaires", "Sales", "Viewers"]) {
      expect(sourceOptions).not.toContain(`labelUk: "${rawLabel}"`);
    }

    const ukUploadCopy = importsPage.slice(importsPage.indexOf('upload: { title: "Завантажити файл"'), importsPage.indexOf("uploadErrors:", importsPage.indexOf('upload: { title: "Завантажити файл"')));
    expect(ukUploadCopy).toContain('parseAllSheetsOn: "On"');
    expect(ukUploadCopy).toContain('parseAllSheetsOff: "Off"');
  });

  it("uses custom app file picker copy instead of native browser labels", () => {
    expect(importsPage).toContain('chooseFile: "Обрати файл"');
    expect(importsPage).toContain('noFileSelected: "Файл ще не обрано"');
    expect(importsPage).toContain('chooseFile: "Choose file"');
    expect(importsPage).toContain('noFileSelected: "No file selected"');
    expect(importsPage).toContain('className="sr-only"');
    expect(importsPage).toContain('{ui.upload.chooseFile}');
    expect(importsPage).toContain('{selectedFile?.name ?? ui.upload.noFileSelected}');
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
