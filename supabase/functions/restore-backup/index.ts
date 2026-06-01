import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const DEFAULT_TABLES = [
  "workspaces",
  "workspace_members",
  "profiles",
  "source_connections",
  "oauth_connections",
  "google_sheet_sources",
  "google_sheet_tabs",
  "sync_jobs",
  "sync_run_logs",
  "import_staging_rows",
  "ad_traffic_raw",
  "registrations_raw",
  "applications_raw",
  "bookings_raw",
  "questionnaires_raw",
  "raw_sales",
  "viewers_webstars_raw",
  "viewers_vebi_raw",
  "fact_daily",
  "fact_campaigns",
  "fact_sales",
  "fact_placements",
  "manual_data_corrections",
  "correction_allowed_fields",
  "backup_runs",
  "backup_files",
];

const RESTORE_ORDER = [
  "workspaces",
  "profiles",
  "workspace_members",
  "source_connections",
  "oauth_connections",
  "google_sheet_sources",
  "google_sheet_tabs",
  "sync_jobs",
  "sync_run_logs",
  "import_staging_rows",
  "ad_traffic_raw",
  "registrations_raw",
  "applications_raw",
  "bookings_raw",
  "questionnaires_raw",
  "raw_sales",
  "viewers_webstars_raw",
  "viewers_vebi_raw",
  "fact_daily",
  "fact_campaigns",
  "fact_sales",
  "fact_placements",
  "manual_data_corrections",
  "correction_allowed_fields",
  "backup_runs",
  "backup_files",
];

const SYSTEM_TABLES = new Set([
  "workspaces",
  "workspace_members",
  "profiles",
  "backup_runs",
  "backup_files",
  "oauth_connections",
]);

const ALLOWED_TABLES = new Set(DEFAULT_TABLES);

type BackupFileRow = {
  backup_run_id: string;
  workspace_id: string;
  backup_status: string;
  storage_bucket: string;
  storage_prefix: string;
  table_name: string;
  storage_path: string;
  rows_count: number;
  file_format: string;
  file_size_bytes: number | null;
};

type LoadedBackupFile = {
  table_name: string;
  file: BackupFileRow;
  rows: unknown[];
};

Deno.serve(async (req) => {
  const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers":
      "authorization, x-client-info, apikey, content-type, x-internal-admin-secret",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
  };

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Method not allowed. Use POST.",
      }),
      {
        status: 405,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  const internalSecret = Deno.env.get("EDGE_INTERNAL_ADMIN_SECRET");

  if (!supabaseUrl || !serviceRoleKey) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing required Supabase secrets",
        hasSupabaseUrl: Boolean(supabaseUrl),
        hasServiceRoleKey: Boolean(serviceRoleKey),
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const providedInternalSecret = req.headers.get("x-internal-admin-secret");

  if (!internalSecret || providedInternalSecret !== internalSecret) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Missing or invalid internal admin secret",
      }),
      {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  let body: {
    workspace_id?: string;
    backup_run_id?: string;
    mode?: "preview" | "validate" | "restore";
    tables?: string[];
    confirm_restore?: boolean;
    confirm_restore_code?: string;
    allow_system_tables?: boolean;
  };

  try {
    body = await req.json();
  } catch (_error) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Invalid JSON body",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const workspaceId = body.workspace_id;
  const backupRunId = body.backup_run_id;
  const mode = body.mode ?? "preview";
  const confirmRestore = body.confirm_restore ?? false;
  const confirmRestoreCode = body.confirm_restore_code ?? "";
  const allowSystemTables = body.allow_system_tables ?? false;

  const requestedTables =
    Array.isArray(body.tables) && body.tables.length > 0
      ? body.tables
      : DEFAULT_TABLES;

  if (!workspaceId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "workspace_id is required",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!backupRunId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "backup_run_id is required",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (!["preview", "validate", "restore"].includes(mode)) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Unsupported mode. Use preview, validate, or restore.",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const invalidTables = requestedTables.filter(
    (table) => !ALLOWED_TABLES.has(table)
  );

  if (invalidTables.length > 0) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Some tables are not allowed for restore",
        invalid_tables: invalidTables,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const requestedSystemTables = requestedTables.filter((table) =>
    SYSTEM_TABLES.has(table)
  );

  if (
    mode === "restore" &&
    requestedSystemTables.length > 0 &&
    !allowSystemTables
  ) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          "Restore includes system tables. Set allow_system_tables=true only after preview and explicit approval.",
        system_tables: requestedSystemTables,
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (mode === "restore") {
    const expectedCode = `RESTORE:${backupRunId}`;

    if (!confirmRestore || confirmRestoreCode !== expectedCode) {
      return new Response(
        JSON.stringify({
          ok: false,
          error: "Restore confirmation failed",
          required_confirm_restore: true,
          required_confirm_restore_code: expectedCode,
        }),
        {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        }
      );
    }
  }

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  const { data: restoreRequestId, error: startError } = await supabaseAdmin.rpc(
    "start_restore_request",
    {
      p_workspace_id: workspaceId,
      p_backup_run_id: backupRunId,
      p_restore_mode: mode,
      p_restore_strategy:
        mode === "restore"
          ? "replace_workspace_rows"
          : "preview_only_no_data_changes",
      p_requested_tables: requestedTables,
      p_metadata: {
        function: "restore-backup",
        mode,
        requested_at: new Date().toISOString(),
        confirm_restore: confirmRestore,
        allow_system_tables: allowSystemTables,
      },
    }
  );

  if (startError || !restoreRequestId) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Could not start restore request",
        details: startError?.message ?? null,
        hint: startError?.hint ?? null,
        code: startError?.code ?? null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const { data: backupFilesRaw, error: filesError } = await supabaseAdmin.rpc(
    "get_backup_files_for_restore",
    {
      p_workspace_id: workspaceId,
      p_backup_run_id: backupRunId,
    }
  );

  if (filesError) {
    await supabaseAdmin.rpc("finish_restore_request_edge", {
      p_payload: {
        restore_request_id: restoreRequestId,
        status: "failed",
        error_message: filesError.message,
        metadata: {
          step: "get_backup_files_for_restore",
          error: filesError.message,
        },
      },
    });

    return new Response(
      JSON.stringify({
        ok: false,
        error: "Could not read backup files for restore",
        details: filesError.message,
        hint: filesError.hint ?? null,
        code: filesError.code ?? null,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const backupFiles = (backupFilesRaw ?? []) as BackupFileRow[];
  const backupFilesByTable = new Map(
    backupFiles.map((file) => [file.table_name, file])
  );

  const previewResults: Array<Record<string, unknown>> = [];
  const loadedFiles: LoadedBackupFile[] = [];

  let filesChecked = 0;
  let filesMissing = 0;
  let rowsExpected = 0;
  const validatedTables: string[] = [];

  for (const tableName of requestedTables) {
    const file = backupFilesByTable.get(tableName);

    if (!file) {
      filesMissing += 1;

      previewResults.push({
        table_name: tableName,
        status: "failed",
        error: "Backup file is missing in manifest",
      });

      continue;
    }

    try {
      const { data: downloadedFile, error: downloadError } =
        await supabaseAdmin.storage
          .from(file.storage_bucket)
          .download(file.storage_path);

      if (downloadError || !downloadedFile) {
        filesMissing += 1;

        previewResults.push({
          table_name: tableName,
          status: "failed",
          storage_path: file.storage_path,
          manifest_rows_count: file.rows_count,
          file_format: file.file_format,
          file_size_bytes: file.file_size_bytes,
          error: downloadError?.message ?? "Could not download backup file",
        });

        continue;
      }

      const fileText = await downloadedFile.text();
      const parsed = JSON.parse(fileText);
      const actualRows = Array.isArray(parsed?.rows) ? parsed.rows : [];

      filesChecked += 1;
      rowsExpected += actualRows.length;
      validatedTables.push(tableName);

      loadedFiles.push({
        table_name: tableName,
        file,
        rows: actualRows,
      });

      previewResults.push({
        table_name: tableName,
        status: "success",
        storage_path: file.storage_path,
        manifest_rows_count: file.rows_count,
        actual_rows_count: actualRows.length,
        file_format: file.file_format,
        file_size_bytes: file.file_size_bytes,
      });
    } catch (error) {
      filesMissing += 1;

      previewResults.push({
        table_name: tableName,
        status: "failed",
        storage_path: file.storage_path,
        manifest_rows_count: file.rows_count,
        file_format: file.file_format,
        file_size_bytes: file.file_size_bytes,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  if (filesMissing > 0) {
    const { data: finishResult } = await supabaseAdmin.rpc(
      "finish_restore_request_edge",
      {
        p_payload: {
          restore_request_id: restoreRequestId,
          status: "failed",
          validated_tables: validatedTables,
          restored_tables: [],
          files_checked: filesChecked,
          files_missing: filesMissing,
          rows_expected: rowsExpected,
          rows_restored: 0,
          error_message: "Some backup files are missing or invalid",
          preview_result: {
            mode,
            backup_run_id: backupRunId,
            table_results: previewResults,
          },
          restore_result: {},
          metadata: {
            function: "restore-backup",
            mode,
            finished_at: new Date().toISOString(),
          },
        },
      }
    );

    return new Response(
      JSON.stringify({
        ok: false,
        function: "restore-backup",
        mode,
        status: "failed",
        workspace_id: workspaceId,
        backup_run_id: backupRunId,
        restore_request_id: restoreRequestId,
        finish_result: finishResult,
        tables_requested: requestedTables.length,
        validated_tables: validatedTables.length,
        files_checked: filesChecked,
        files_missing: filesMissing,
        rows_expected: rowsExpected,
        rows_restored: 0,
        data_changed: false,
        table_results: previewResults,
      }),
      {
        status: 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  if (mode !== "restore") {
    const { data: finishResult } = await supabaseAdmin.rpc(
      "finish_restore_request_edge",
      {
        p_payload: {
          restore_request_id: restoreRequestId,
          status: "success",
          validated_tables: validatedTables,
          restored_tables: [],
          files_checked: filesChecked,
          files_missing: filesMissing,
          rows_expected: rowsExpected,
          rows_restored: 0,
          error_message: null,
          preview_result: {
            mode,
            backup_run_id: backupRunId,
            table_results: previewResults,
          },
          restore_result: {},
          metadata: {
            function: "restore-backup",
            mode,
            finished_at: new Date().toISOString(),
          },
        },
      }
    );

    return new Response(
      JSON.stringify({
        ok: true,
        function: "restore-backup",
        mode,
        status: "success",
        workspace_id: workspaceId,
        backup_run_id: backupRunId,
        restore_request_id: restoreRequestId,
        finish_result: finishResult,
        tables_requested: requestedTables.length,
        validated_tables: validatedTables.length,
        files_checked: filesChecked,
        files_missing: filesMissing,
        rows_expected: rowsExpected,
        rows_restored: 0,
        data_changed: false,
        table_results: previewResults,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  const loadedByTable = new Map(
    loadedFiles.map((item) => [item.table_name, item])
  );

  const orderedRestoreTables = RESTORE_ORDER.filter((table) =>
    requestedTables.includes(table)
  );

  const restoreResults: Array<Record<string, unknown>> = [];
  const restoredTables: string[] = [];
  let rowsRestored = 0;
  let restoreFailed = false;

  for (const tableName of orderedRestoreTables) {
    const loaded = loadedByTable.get(tableName);

    if (!loaded) {
      restoreFailed = true;

      restoreResults.push({
        table_name: tableName,
        status: "failed",
        error: "Validated backup file not loaded",
      });

      break;
    }

    const { data: restoreTableResult, error: restoreTableError } =
      await supabaseAdmin.rpc("restore_table_from_json_rows", {
        p_workspace_id: workspaceId,
        p_table_name: tableName,
        p_rows: loaded.rows,
        p_strategy: "replace_workspace_rows",
      });

    if (restoreTableError) {
      restoreFailed = true;

      restoreResults.push({
        table_name: tableName,
        status: "failed",
        error: restoreTableError.message,
        hint: restoreTableError.hint ?? null,
        code: restoreTableError.code ?? null,
      });

      break;
    }

    const restoredCount = Number(restoreTableResult?.rows_restored ?? 0);
    rowsRestored += restoredCount;
    restoredTables.push(tableName);

    restoreResults.push({
      table_name: tableName,
      status: "success",
      rows_restored: restoredCount,
      result: restoreTableResult,
    });
  }

  const finalStatus = restoreFailed ? "failed" : "success";

  const { data: finishResult, error: finishError } = await supabaseAdmin.rpc(
    "finish_restore_request_edge",
    {
      p_payload: {
        restore_request_id: restoreRequestId,
        status: finalStatus,
        validated_tables: validatedTables,
        restored_tables: restoredTables,
        files_checked: filesChecked,
        files_missing: filesMissing,
        rows_expected: rowsExpected,
        rows_restored: rowsRestored,
        error_message: restoreFailed ? "One or more tables failed during restore" : null,
        preview_result: {
          mode,
          backup_run_id: backupRunId,
          table_results: previewResults,
        },
        restore_result: {
          mode,
          backup_run_id: backupRunId,
          table_results: restoreResults,
        },
        metadata: {
          function: "restore-backup",
          mode,
          data_changed: true,
          finished_at: new Date().toISOString(),
        },
      },
    }
  );

  if (finishError) {
    return new Response(
      JSON.stringify({
        ok: false,
        error: "Restore completed but restore request could not be finished",
        details: finishError.message,
        hint: finishError.hint ?? null,
        code: finishError.code ?? null,
        restore_request_id: restoreRequestId,
        table_results: restoreResults,
      }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }

  return new Response(
    JSON.stringify({
      ok: !restoreFailed,
      function: "restore-backup",
      mode,
      status: finalStatus,
      workspace_id: workspaceId,
      backup_run_id: backupRunId,
      restore_request_id: restoreRequestId,
      finish_result: finishResult,
      tables_requested: requestedTables.length,
      validated_tables: validatedTables.length,
      restored_tables: restoredTables.length,
      files_checked: filesChecked,
      files_missing: filesMissing,
      rows_expected: rowsExpected,
      rows_restored: rowsRestored,
      data_changed: true,
      preview_results: previewResults,
      restore_results: restoreResults,
    }),
    {
      status: restoreFailed ? 500 : 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    }
  );
});
