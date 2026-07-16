import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { filterImportedSources, isUploadedImportSource } from "../pages/Bindings";

const repoRoot = process.cwd();
const edgePath = path.join(repoRoot, "supabase/functions/import-source-cleanup/index.ts");
const bindingsPath = path.join(repoRoot, "src/pages/Bindings.tsx");

describe("import source management", () => {
  it("filters active and archived uploaded/imported sources", () => {
    const rows = [
      { id: "active", source_type: "manual_file_upload", status: "active" },
      { id: "archived", source_type: "manual_file_upload", status: "archived" },
    ];

    expect(filterImportedSources(rows, "active").map((row) => row.id)).toEqual(["active"]);
    expect(filterImportedSources(rows, "archived").map((row) => row.id)).toEqual(["archived"]);
    expect(filterImportedSources(rows, "all").map((row) => row.id)).toEqual(["active", "archived"]);
  });

  it("recognizes only file import sources for management", () => {
    expect(isUploadedImportSource({ source_type: "manual_file_upload" })).toBe(true);
    expect(isUploadedImportSource({ source_type: "google_sheet" })).toBe(false);
  });

  it("keeps archived imported datasets out of active source candidates", () => {
    const source = fs.readFileSync(bindingsPath, "utf8");

    expect(source).toContain("!isInactiveStatus(row.status) && !isInternalTestSourceCandidate(row)");
    expect(source).toContain("Активні");
    expect(source).toContain("Архівні");
    expect(source).toContain("Це видалить записи імпорту з бази та фізичний файл із Supabase Storage. Дію не можна скасувати.");
    expect(source).toContain("sourceType: \"google_sheet_source\"");
  });

  it("protects cleanup in the edge function and uses Storage API, not storage.objects SQL", () => {
    const source = fs.readFileSync(edgePath, "utf8");

    expect(source).toContain("Missing bearer token");
    expect(source).toContain("Cleanup requires confirm: true");
    expect(source).toContain("Cleanup requires superadmin role");
    expect(source).toContain("Only file/import uploaded sources");
    expect(source).toContain("File import source was not found in this workspace");
    expect(source).toMatch(/storage\s*\.from\(storageBucket\)\s*\.remove\(\[storagePath\]\)/);
    expect(source).not.toMatch(/from\(["']storage\.objects["']\)|delete\s+from\s+storage\.objects/i);
  });

  it("archives, restores, deletes dependency tables, and audits outcomes", () => {
    const source = fs.readFileSync(edgePath, "utf8");

    for (const action of [
      "file_import_source_archived",
      "file_import_source_restored",
      "file_import_source_cleaned",
      "file_import_storage_delete_failed",
      "file_import_cleanup_failed",
    ]) {
      expect(source).toContain(action);
    }

    for (const table of [
      "mapping_review_queue",
      "dataset_field_mappings",
      "import_rejected_rows",
      "import_staging_rows",
      "raw_external_rows",
      "source_entity_bindings",
      "raw_external_datasets",
      "file_assets",
    ]) {
      expect(source).toContain(table);
    }
  });
});
