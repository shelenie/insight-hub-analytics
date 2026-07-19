import { describe, expect, it } from "vitest";
import fs from "node:fs";
import path from "node:path";
import { filterImportedSources, isUploadedImportSource } from "../pages/Bindings";

const repoRoot = process.cwd();
const edgePath = path.join(repoRoot, "supabase/functions/import-source-cleanup/index.ts");
const bindingsPath = path.join(repoRoot, "src/pages/Bindings.tsx");
const registryMigrationPath = path.join(
  repoRoot,
  "supabase/migrations/20260716_register_import_source_cleanup_edge_function.sql",
);

function edgeSource() {
  return fs.readFileSync(edgePath, "utf8");
}

function functionBody(source: string, name: string) {
  const start = source.indexOf(`function ${name}`) >= 0 ? source.indexOf(`function ${name}`) : source.indexOf(`async function ${name}`);
  expect(start).toBeGreaterThanOrEqual(0);
  const next = source.indexOf("\nasync function ", start + 1);
  const nextPlain = source.indexOf("\nfunction ", start + 1);
  const candidates = [next, nextPlain].filter((value) => value > start);
  const end = candidates.length ? Math.min(...candidates) : source.length;
  return source.slice(start, end);
}

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

  it("keeps archived imported datasets out of active source candidates and exposes source management UI", () => {
    const source = fs.readFileSync(bindingsPath, "utf8");

    expect(source).toContain("!isInactiveStatus(row.status) && !isInternalTestSourceCandidate(row)");
    expect(source).toContain('<SelectItem value="active">');
    expect(source).toContain('<SelectItem value="archived">');
    expect(source).toContain("bindingsImportSourceCleanupConfirmDescription");
    expect(source).toContain("bindingsImportSourceTechnicalDetails");
    expect(source).not.toContain("asText(row.storage_object_path),");
    expect(source).toContain("sourceType: \"google_sheet_source\"");
  });

  it("does not auto-confirm active-bound cleanup from the first cleanup UI action", () => {
    const source = fs.readFileSync(bindingsPath, "utf8");

    expect(source).toContain("active_binding:");
    expect(source).toMatch(/row\.active_binding\s*===\s*true\s*\?\s*"cleanup-active"\s*:\s*"cleanup"/);
    expect(source).toMatch(/mode\s*===\s*"cleanup-active"\s*\?\s*\{\s*confirm_active_binding_cleanup:\s*true\s*\}\s*:\s*\{\}/);
    expect(source).not.toContain('confirm_active_binding_cleanup: mode === "cleanup"');
  });

  it("protects cleanup in the edge function and uses Storage API, not storage.objects SQL", () => {
    const source = edgeSource();

    expect(source).toContain("Missing bearer token");
    expect(source).toContain("Cleanup requires confirm: true");
    expect(source).toContain("Cleanup requires superadmin role");
    expect(source).toContain('if (mode === "cleanup" && role !== "superadmin")');
    expect(source).toContain("Only file/import uploaded sources");
    expect(source).toContain("File import source was not found in this workspace");
    expect(source).toMatch(/storage\s*\.from\(storageBucket\)\s*\.remove\(\[storagePath\]\)/);
    expect(source).not.toMatch(/from\(["']storage\.objects["']\)|delete\s+from\s+storage\.objects/i);
  });

  it("uses table-specific cleanup columns instead of a generic raw_external_dataset_id", () => {
    const source = edgeSource();

    expect(source).toContain('deleteByColumn(\n      supabaseAdmin,\n      "dataset_field_mappings",\n      "dataset_id"');
    expect(source).toMatch(/deleteByColumn\(\s*client,\s*"raw_external_rows",\s*"raw_external_dataset_id",\s*datasetId/s);
    expect(source).toMatch(/deleteByColumn\(\s*client,\s*"raw_external_rows",\s*"dataset_id",\s*datasetId/s);
    expect(source).toMatch(/deleteByColumn\(\s*client,\s*"raw_external_rows",\s*"file_asset_id",\s*fileAssetId/s);
    expect(source).toMatch(/deleteByColumn\(\s*client,\s*"source_entity_bindings",\s*"source_id",\s*datasetId,\s*\{/s);
    expect(source).toContain('source_table: "raw_external_datasets"');
    expect(source).toMatch(/deleteByColumn\(\s*client,\s*"import_rejected_rows",\s*"file_asset_id",\s*fileAssetId/s);
    expect(source).toMatch(/deleteByColumn\(\s*client,\s*"import_rejected_rows",\s*"source_id",\s*datasetId/s);
    expect(source).toMatch(/deleteByColumn\(\s*client,\s*"import_rejected_rows",\s*"import_run_id",\s*importRunId/s);
    expect(source).toMatch(/deleteByColumn\(client, table, "import_run_id", importRunId, \{/);
    expect(source).toMatch(/deleteByColumn\(client, table, "source_name", sourceName, \{/);

    const mappingReviewCleanup = functionBody(source, "deleteImportRunRows");
    const datasetMappingsCleanup = source.slice(source.indexOf('"dataset_field_mappings"') - 120, source.indexOf('"dataset_field_mappings"') + 160);
    const stagingCleanupCall = source.slice(source.indexOf('"import_staging_rows"') - 220, source.indexOf('"import_staging_rows"') + 220);

    expect(mappingReviewCleanup).not.toContain('"raw_external_dataset_id"');
    expect(datasetMappingsCleanup).not.toContain('"raw_external_dataset_id"');
    expect(stagingCleanupCall).not.toContain('"raw_external_dataset_id"');
  });


  it("scopes destructive cleanup deletes by workspace_id", () => {
    const source = edgeSource();

    expect(functionBody(source, "deleteRawExternalRows")).toMatch(/workspace_id:\s*workspaceId/g);
    expect(functionBody(source, "deleteSourceEntityBindings")).toContain("workspace_id: workspaceId");
    expect(functionBody(source, "deleteImportRejectedRows")).toMatch(/workspace_id:\s*workspaceId/g);
    expect(functionBody(source, "deleteImportRunRows")).toMatch(/workspace_id:\s*workspaceId/g);

    const cleanupBlock = source.slice(source.indexOf("const deleted_counts"), source.indexOf("file_import_source_cleaned"));
    for (const table of ["dataset_field_mappings", "raw_external_datasets", "file_assets"]) {
      const tableCall = cleanupBlock.slice(cleanupBlock.indexOf(`"${table}"`) - 80, cleanupBlock.indexOf(`"${table}"`) + 220);
      expect(tableCall).toContain("workspace_id: workspaceId");
    }
  });

  it("resolves import_run_id before deleting staging/review rows", () => {
    const source = edgeSource();
    const resolveIndex = source.indexOf("const resolvedImportRunId = await findImportRunId");
    const cleanupIndex = source.indexOf("deleted_counts.mapping_review_queue");

    expect(resolveIndex).toBeGreaterThanOrEqual(0);
    expect(cleanupIndex).toBeGreaterThan(resolveIndex);
    expect(source).toContain("fileAsset?.import_run_id ?? dataset?.import_run_id");
    expect(source).toContain('.select("import_run_id")');
  });

  it("archives, restores, deletes dependency tables, and audits outcomes", () => {
    const source = edgeSource();

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

  it("registers import-source-cleanup as dangerous/audited admin-access edge function", () => {
    const migration = fs.readFileSync(registryMigrationPath, "utf8");

    expect(migration).toContain("import-source-cleanup");
    expect(migration).toContain("required_min_role = ''admin''");
    expect(migration).toContain("required_permission = ''can_manage_imports''");
    expect(migration).not.toContain("required_permission = null");
    expect(migration).not.toContain("insert_values := insert_values || 'null'");
    expect(migration).toContain("is_dangerous = true");
    expect(migration).toContain("requires_audit_log = true");
    expect(migration).toContain("status = ''active''");
    expect(migration).toContain("5ebbe435-fd79-44c3-834e-642e8fba00dc");
  });
});
