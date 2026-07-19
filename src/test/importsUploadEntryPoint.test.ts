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
const dashboardLayout = readFileSync(
  "src/components/layout/DashboardLayout.tsx",
  "utf8",
);
const importsPage = readFileSync("src/pages/Imports.tsx", "utf8");
const globalCss = readFileSync("src/index.css", "utf8");

describe("Imports production upload entry point", () => {
  it("moves Imports to Admin navigation after Data Bindings and before Ads Connectors", () => {
    const analyticsStart = sidebar.indexOf('labelKey: "sidebarAnalytics"');
    const analyticsEnd = sidebar.indexOf(
      'labelKey: "sidebarAdmin"',
      analyticsStart,
    );
    const analytics = sidebar.slice(analyticsStart, analyticsEnd);
    expect(analytics).not.toContain('url: "/imports"');

    const adminStart = sidebar.indexOf('labelKey: "sidebarAdmin"');
    const adminEnd = sidebar.indexOf('labelKey: "sidebarAi"', adminStart);
    const admin = sidebar.slice(adminStart, adminEnd);
    expect(admin.indexOf('url: "/bindings"')).toBeLessThan(
      admin.indexOf('url: "/imports"'),
    );
    expect(admin.indexOf('url: "/imports"')).toBeLessThan(
      admin.indexOf('url: "/ads-connectors"'),
    );

    const searchStart = dashboardLayout.indexOf('path: "/onboarding"');
    const search = dashboardLayout.slice(
      searchStart,
      dashboardLayout.indexOf('path: "/assistant"', searchStart),
    );
    expect(search.indexOf('path: "/bindings"')).toBeLessThan(
      search.indexOf('path: "/imports"'),
    );
    expect(search.indexOf('path: "/imports"')).toBeLessThan(
      search.indexOf('path: "/ads-connectors"'),
    );
  });

  it("renders production upload card copy while keeping monitoring sections", () => {
    expect(importsPage).toContain('title: "Завантажити файл"');
    expect(importsPage).toContain('title: "Upload file"');
    expect(importsPage).toContain(
      "Upload client-provided files here and monitor import quality",
    );
    expect(importsPage).toContain('title: "Стан імпортів"');
    expect(importsPage).toContain('title: "Помилки імпорту"');
    expect(importsPage).toContain('title: "Стан мапінгу"');
    expect(importsPage).toContain('title: "Операційні сигнали"');
    expect(importsPage).toContain('title: "Що перевірити"');
  });

  it("rejects unsupported and oversized files before upload", () => {
    expect(
      validateImportFile(
        new File(["ok"], "client.pdf", { type: "application/pdf" }),
      ),
    ).toBe("unsupported");
    expect(
      validateImportFile(
        new File(
          [new Uint8Array(MAX_IMPORT_FILE_SIZE_BYTES + 1)],
          "client.csv",
        ),
      ),
    ).toBe("too_large");
    expect(validateImportFile(new File(["ok"], "client.xlsx"))).toBeNull();
  });

  it("builds stable workspace storage paths", () => {
    const path = buildImportStoragePath(
      "Client Report July 2026.xlsx",
      new Date("2026-07-15T12:00:00.000Z"),
    );
    expect(path).toBe(
      `workspace_${WORKSPACE_ID}/uploads/2026-07-15T12-00-00-000Z-Client-Report-July-2026.xlsx`,
    );
  });

  it("normalizes snake_case and camelCase parser responses", () => {
    expect(
      normalizeUploadResult(
        {
          original_file_name: "analytics_hub_test_leads_upload.csv",
          datasets_count: 1,
          rows_inserted: "6",
          columns_count: 10,
        },
        "fallback.csv",
      ),
    ).toEqual({
      original_file_name: "analytics_hub_test_leads_upload.csv",
      datasets_count: 1,
      rows_inserted: 6,
      columns_count: 10,
    });

    expect(
      normalizeUploadResult(
        {
          original_file_name: "",
          datasetsCount: "1",
          rowsInserted: 6,
          columnsCount: "10",
        },
        "fallback.csv",
      ),
    ).toEqual({
      original_file_name: "fallback.csv",
      datasets_count: 1,
      rows_inserted: 6,
      columns_count: 10,
    });
  });

  it("keeps upload loading state inside try/finally after parser success or unexpected frontend errors", () => {
    const uploadStart = importsPage.indexOf("setIsUploading(true)");
    const uploadEnd = importsPage.indexOf(
      "const actions = buildActions",
      uploadStart,
    );
    const uploadFlow = importsPage.slice(uploadStart, uploadEnd);

    expect(uploadFlow).toContain("try {");
    expect(uploadFlow).toContain(
      "setUploadResult(normalizeUploadResult(parser.data, selectedFile.name))",
    );
    expect(uploadFlow).toContain("setSelectedFile(null)");
    expect(uploadFlow).toContain('fileInputRef.current.value = ""');
    expect(uploadFlow).toContain("} catch (error) {");
    expect(uploadFlow).toContain("kind: uploadStage");
    expect(uploadFlow).toContain("technicalDetails: getErrorMessage(error)");
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
    for (const rawLabel of [
      "Auto / Unknown",
      "Traffic",
      "Registrations",
      "Applications / Leads",
      "Bookings",
      "Questionnaires",
      "Sales",
      "Viewers",
    ]) {
      expect(sourceOptions).not.toContain(`labelUk: "${rawLabel}"`);
    }

    expect(importsPage).toContain('parseAllSheetsOn: "On"');
    expect(importsPage).toContain('parseAllSheetsOff: "Off"');
  });

  it("uses custom app file picker copy instead of native browser labels", () => {
    expect(importsPage).toContain('chooseFile: "Обрати файл"');
    expect(importsPage).toContain('noFileSelected: "Файл ще не обрано"');
    expect(importsPage).toContain('chooseFile: "Choose file"');
    expect(importsPage).toContain('noFileSelected: "No file selected"');
    expect(importsPage).toContain('className="sr-only"');
    expect(importsPage).toContain("{ui.upload.chooseFile}");
    expect(importsPage).toContain("{ui.upload.noFileSelected}");
  });

  it("protects DashboardLayout wrappers from page-level horizontal overflow without global body hiding", () => {
    expect(dashboardLayout).toContain(
      '<SidebarProvider className="max-w-full overflow-x-clip">',
    );
    expect(dashboardLayout).toContain(
      'className="flex min-h-screen w-full max-w-full overflow-x-clip bg-background bg-hero"',
    );
    expect(dashboardLayout).toContain(
      'className="flex min-h-screen min-w-0 max-w-full flex-1 flex-col overflow-x-clip"',
    );
    expect(dashboardLayout).toContain(
      'className="sticky top-0 z-30 flex h-12 max-w-full items-center gap-2 overflow-x-clip',
    );
    expect(dashboardLayout).toContain(
      'className="max-w-full min-w-0 overflow-x-clip border-b',
    );
    expect(dashboardLayout).toContain(
      '"flex-1 max-w-full min-w-0 overflow-x-hidden p-4 lg:p-6 animate-fade-in"',
    );

    expect(globalCss).toContain(`html,
  body,
  #root {
    width: 100%;
    max-width: 100%;
    overflow-x: hidden;
  }`);
  });

  it("uses a controlled responsive upload grid instead of flex-wrap", () => {
    const formStart = importsPage.indexOf(
      'className="grid w-full min-w-0 grid-cols-1 gap-x-3 gap-y-2 md:grid-cols-2 lg:grid-cols-3 lg:items-start"',
    );
    const form = importsPage.slice(
      formStart,
      importsPage.indexOf("</form>", formStart),
    );

    expect(formStart).toBeGreaterThanOrEqual(0);
    expect(form).toContain("grid-cols-1");
    expect(form).toContain("md:grid-cols-2");
    expect(form).toContain("lg:grid-cols-3");
    expect(form).toContain("w-full");
    expect(form).not.toContain("w-fit");
    expect(form).not.toContain("minmax(220px,1fr)");
    expect(form).toContain("grid-rows-[1rem_2.5rem_auto_auto]");
    expect(form).toContain("md:col-span-2");
    expect(form).not.toContain("xl:grid-cols-[230px_150px_180px_230px_270px]");
    expect(form).toContain('aria-hidden="true"');
    expect(form).toContain(
      'className="h-10 w-full max-w-full gap-2 text-center leading-tight"',
    );
    expect(form).toContain("truncate");
    expect(form).not.toContain("flex max-w-full min-w-0 flex-wrap gap-x-3 gap-y-2");
    expect(form).not.toContain("whitespace-nowrap");
  });

  it("adds min-width and max-width guards around imports page wrappers and KPI grids", () => {
    expect(importsPage).toContain('className="max-w-full min-w-0 space-y-4"');
    expect(importsPage).toContain(
      'className="grid max-w-full min-w-0 gap-3 sm:grid-cols-2 xl:grid-cols-3"',
    );
    expect(importsPage).toContain(
      'className="grid max-w-full min-w-0 gap-4 xl:grid-cols-[minmax(0,1fr)_minmax(280px,320px)]"',
    );
  });

  it("adds an accessible clear-file control and resets file upload UI state", () => {
    expect(importsPage).toContain('clearFile: "Очистити файл"');
    expect(importsPage).toContain('clearFile: "Clear file"');
    expect(importsPage).toContain(
      "const fileInputRef = useRef<HTMLInputElement | null>(null)",
    );
    expect(importsPage).toContain("aria-label={ui.upload.clearFile}");
    expect(importsPage).toContain(
      "inline-flex h-6 max-w-full min-w-0 items-center gap-1 rounded-full",
    );
    expect(importsPage).toContain(
      'className="min-w-0 flex-1 truncate leading-none"',
    );
    expect(importsPage).toContain("title={selectedFile.name}");
    expect(importsPage).toContain(
      "inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full",
    );

    const clearStart = importsPage.indexOf("const handleClearFile = () => {");
    const clearHandler = importsPage.slice(
      clearStart,
      importsPage.indexOf("};", clearStart) + 2,
    );
    expect(clearHandler).toContain("setSelectedFile(null)");
    expect(clearHandler).toContain("setUploadError(null)");
    expect(clearHandler).toContain("setUploadResult(null)");
    expect(clearHandler).toContain('fileInputRef.current.value = ""');
  });

  it("keeps success feedback compact with right-side actions and dismiss behavior", () => {
    expect(importsPage).toContain('dismissSuccess: "Закрити"');
    expect(importsPage).toContain('dismissSuccess: "Dismiss"');
    expect(importsPage).toContain("function UploadSuccess({");
    expect(importsPage).toContain("onDismiss,");
    expect(importsPage).toContain("aria-label={ui.upload.dismissSuccess}");
    expect(importsPage).toContain(
      'className="mt-3 max-w-full min-w-0 rounded-lg',
    );
    expect(importsPage).toContain(
      'className="mt-0.5 max-w-full min-w-0 truncate text-xs text-muted-foreground"',
    );
    expect(importsPage).toContain(
      'className="flex shrink-0 items-center justify-end gap-1"',
    );
    expect(importsPage).toContain('className="min-w-0"');
    expect(importsPage).toContain('className="flex min-w-0 items-center gap-2"');
    expect(importsPage).toContain(
      'className="h-7 max-w-full min-w-0 px-2 text-xs"',
    );
    expect(importsPage).toContain(
      'className="flex min-w-0 max-w-full items-center"',
    );
    expect(importsPage).toContain(
      "inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full",
    );

    const dismissStart = importsPage.indexOf(
      "const handleDismissUploadSuccess = () => {",
    );
    const dismissHandler = importsPage.slice(
      dismissStart,
      importsPage.indexOf("};", dismissStart) + 2,
    );
    expect(dismissHandler).toContain("setUploadResult(null)");
    expect(dismissHandler).not.toContain("setSelectedFile");
    expect(dismissHandler).not.toContain("fileInputRef.current.value");
  });

  it("uses Supabase Storage bucket and file-upload-parser payload contract", () => {
    expect(FILE_IMPORTS_BUCKET).toBe("file-imports");
    expect(FILE_UPLOAD_PARSER_FUNCTION).toBe("file-upload-parser");
    expect(importsPage).toContain(".from(FILE_IMPORTS_BUCKET)");
    expect(importsPage).toContain(".upload(storagePath, selectedFile");
    expect(importsPage).toContain("supabase.functions.invoke(");
    expect(importsPage).toContain("FILE_UPLOAD_PARSER_FUNCTION");
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
    expect(importsPage).toContain("to={`${ROUTES.bindings}?tab=source`}");
  });
});
