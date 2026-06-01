import { createClient } from "npm:@supabase/supabase-js@2";

type RestoreMode = "preview" | "restore";

type RequestBody = {
  workspace_id?: string;
  backup_run_id?: string;
  restore_mode?: RestoreMode;
  tables?: string[];
  metadata?: Record<string, unknown>;

  backend_test_secret?: string;
  test_actor_email?: string;
};

type ActorContext = {
  mode: "user_jwt" | "backend_test" | "none";
  user_id: string | null;
  email: string | null;
  role: string | null;
  can_run_backup_restore: boolean;
  denial_reason?: string | null;
};

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const BACKUP_BUCKET = "app-backups";

const ALLOWED_RESTORE_TABLES = [
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

const DEFAULT_SAFE_RESTORE_TABLES = ["import_staging_rows"];

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-backend-test-secret, x-test-actor-email",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function getProvidedBackendTestSecret(req: Request, body: RequestBody) {
  return body.backend_test_secret ?? req.headers.get("x-backend-test-secret") ?? null;
}

function getProvidedTestActorEmail(req: Request, body: RequestBody) {
  return (
    body.test_actor_email ??
    req.headers.get("x-test-actor-email") ??
    Deno.env.get("BACKEND_TEST_ACTOR_EMAIL") ??
    "olenashepel.ai@gmail.com"
  );
}

function normalizeRestoreMode(input: unknown): RestoreMode {
  if (input === "restore") return "restore";
  return "preview";
}

function normalizeTables(input: unknown, restoreMode: RestoreMode): string[] {
  if (!Array.isArray(input) || input.length === 0) {
    return restoreMode === "restore" ? DEFAULT_SAFE_RESTORE_TABLES : ALLOWED_RESTORE_TABLES;
  }

  const requested = input
    .filter((item) => typeof item === "string")
    .map((item) => item.trim())
    .filter(Boolean);

  const invalid = requested.filter((table) => !ALLOWED_RESTORE_TABLES.includes(table));

  if (invalid.length > 0) {
    throw new Error(`Invalid restore tables requested: ${invalid.join(", ")}`);
  }

  if (restoreMode === "restore") {
    const unsafe = requested.filter((table) => !DEFAULT_SAFE_RESTORE_TABLES.includes(table));

    if (unsafe.length > 0) {
      throw new Error(
        `Real restore is currently allowed only for safe tables: ${DEFAULT_SAFE_RESTORE_TABLES.join(", ")}. Requested unsafe tables: ${unsafe.join(", ")}`,
      );
    }
  }

  return [...new Set(requested)];
}

async function findUserByEmail(serviceClient: any, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  let page = 1;
  const perPage = 100;

  while (page <= 20) {
    const { data, error } = await serviceClient.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) throw new Error(`Failed to list users: ${error.message}`);

    const users = data?.users ?? [];
    const found = users.find(
      (user: any) => (user.email ?? "").toLowerCase() === normalizedEmail,
    );

    if (found) return found;

    if (users.length < perPage) break;
    page++;
  }

  return null;
}

async function getWorkspaceRoleByUserId(params: {
  serviceClient: any;
  workspaceId: string;
  userId: string;
}) {
  const { data, error } = await params.serviceClient
    .from("workspace_members")
    .select("role")
    .eq("workspace_id", params.workspaceId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) throw new Error(`Failed to read workspace role: ${error.message}`);

  return data?.role ?? null;
}

async function writeAuditLog(params: {
  serviceClient: any;
  workspaceId: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  severity?: "info" | "warning" | "error";
  metadata?: Record<string, unknown>;
}) {
  const { error } = await params.serviceClient.from("audit_logs").insert({
    workspace_id: params.workspaceId,
    actor_user_id: params.actorUserId,
    actor_role: params.actorRole,
    action: params.action,
    entity_type: "edge_function",
    entity_id: "restore-backup",
    severity: params.severity ?? "info",
    metadata: {
      actor_email: params.actorEmail,
      ...(params.metadata ?? {}),
    },
  });

  if (error) console.error("Audit log write failed:", error);
}

async function getActorContext(params: {
  req: Request;
  body: RequestBody;
  workspaceId: string;
  userClient: any;
  serviceClient: any;
}): Promise<ActorContext> {
  const { req, body, workspaceId, userClient, serviceClient } = params;

  const authHeader = req.headers.get("Authorization");
  const providedBackendTestSecret = getProvidedBackendTestSecret(req, body);

  const backendTestMode = Deno.env.get("BACKEND_TEST_MODE") ?? "disabled";
  const expectedBackendTestSecret = Deno.env.get("BACKEND_TEST_SECRET") ?? "";

  if (providedBackendTestSecret) {
    if (backendTestMode !== "enabled") {
      return {
        mode: "backend_test",
        user_id: null,
        email: null,
        role: null,
        can_run_backup_restore: false,
        denial_reason: "BACKEND_TEST_MODE_is_not_enabled",
      };
    }

    if (!expectedBackendTestSecret) {
      return {
        mode: "backend_test",
        user_id: null,
        email: null,
        role: null,
        can_run_backup_restore: false,
        denial_reason: "BACKEND_TEST_SECRET_env_is_missing",
      };
    }

    if (providedBackendTestSecret !== expectedBackendTestSecret) {
      return {
        mode: "backend_test",
        user_id: null,
        email: null,
        role: null,
        can_run_backup_restore: false,
        denial_reason: "backend_test_secret_does_not_match",
      };
    }

    const actorEmail = getProvidedTestActorEmail(req, body);
    const actorUser = await findUserByEmail(serviceClient, actorEmail);

    if (!actorUser?.id) {
      return {
        mode: "backend_test",
        user_id: null,
        email: actorEmail,
        role: null,
        can_run_backup_restore: false,
        denial_reason: "test_actor_email_not_found_in_auth_users",
      };
    }

    const role = await getWorkspaceRoleByUserId({
      serviceClient,
      workspaceId,
      userId: actorUser.id,
    });

    return {
      mode: "backend_test",
      user_id: actorUser.id,
      email: actorEmail,
      role,
      can_run_backup_restore: role === "superadmin",
      denial_reason:
        role === "superadmin"
          ? null
          : "test_actor_is_not_superadmin_in_workspace_members",
    };
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();

    const { data: userData, error: userError } = await userClient.auth.getUser(token);

    if (userError || !userData?.user) {
      return {
        mode: "user_jwt",
        user_id: null,
        email: null,
        role: null,
        can_run_backup_restore: false,
        denial_reason: "invalid_or_expired_user_jwt",
      };
    }

    const { data: permissionsData, error: permissionsError } =
      await userClient.rpc("get_my_workspace_permissions", {
        p_workspace_id: workspaceId,
      });

    if (permissionsError) {
      throw new Error(`Permission RPC failed: ${permissionsError.message}`);
    }

    const permissions = Array.isArray(permissionsData)
      ? permissionsData[0]
      : permissionsData;

    return {
      mode: "user_jwt",
      user_id: userData.user.id,
      email: userData.user.email ?? null,
      role: permissions?.role ?? null,
      can_run_backup_restore: permissions?.can_run_backup_restore === true,
      denial_reason:
        permissions?.can_run_backup_restore === true
          ? null
          : "user_does_not_have_can_run_backup_restore_permission",
    };
  }

  return {
    mode: "none",
    user_id: null,
    email: null,
    role: null,
    can_run_backup_restore: false,
    denial_reason: "missing_user_jwt_or_backend_test_secret",
  };
}

async function getBackupRun(params: {
  serviceClient: any;
  workspaceId: string;
  backupRunId: string;
}) {
  const { data, error } = await params.serviceClient
    .from("backup_runs")
    .select("*")
    .eq("workspace_id", params.workspaceId)
    .eq("id", params.backupRunId)
    .maybeSingle();

  if (error) throw new Error(`Failed to read backup run: ${error.message}`);
  if (!data) throw new Error(`Backup run not found: ${params.backupRunId}`);

  return data;
}

async function getBackupFile(params: {
  serviceClient: any;
  workspaceId: string;
  backupRunId: string;
  tableName: string;
}) {
  const { data, error } = await params.serviceClient
    .from("backup_files")
    .select("*")
    .eq("workspace_id", params.workspaceId)
    .eq("backup_run_id", params.backupRunId)
    .eq("table_name", params.tableName)
    .eq("status", "success")
    .maybeSingle();

  if (error) throw new Error(`Failed to read backup file for ${params.tableName}: ${error.message}`);

  return data;
}

async function downloadBackupPayload(params: {
  serviceClient: any;
  backupFile: any;
}) {
  const { data, error } = await params.serviceClient.storage
    .from(params.backupFile.storage_bucket ?? BACKUP_BUCKET)
    .download(params.backupFile.storage_path);

  if (error) {
    throw new Error(
      `Failed to download backup file ${params.backupFile.storage_path}: ${error.message}`,
    );
  }

  const text = await data.text();

  try {
    return JSON.parse(text);
  } catch (_error) {
    throw new Error(`Invalid JSON in backup file: ${params.backupFile.storage_path}`);
  }
}

function extractRowsFromBackupPayload(payload: any): unknown[] {
  if (Array.isArray(payload?.rows)) return payload.rows;
  if (Array.isArray(payload)) return payload;
  return [];
}

async function restoreTableRows(params: {
  serviceClient: any;
  workspaceId: string;
  tableName: string;
  rows: any[];
}) {
  const { serviceClient, workspaceId, tableName, rows } = params;

  const deleteColumn = tableName === "workspaces" ? "id" : "workspace_id";

  const { error: deleteError } = await serviceClient
    .from(tableName)
    .delete()
    .eq(deleteColumn, workspaceId);

  if (deleteError) {
    throw new Error(`Failed to delete existing rows from ${tableName}: ${deleteError.message}`);
  }

  if (rows.length === 0) {
    return 0;
  }

  const chunkSize = 500;
  let inserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const { error: insertError } = await serviceClient.from(tableName).insert(chunk);

    if (insertError) {
      throw new Error(`Failed to insert rows into ${tableName}: ${insertError.message}`);
    }

    inserted += chunk.length;
  }

  return inserted;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      ok: false,
      error: "Method not allowed. Use POST.",
    });
  }

  let body: RequestBody;

  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse(400, {
      ok: false,
      error: "Invalid JSON body.",
    });
  }

  const workspaceId = body.workspace_id ?? WORKSPACE_ID;

  if (workspaceId !== WORKSPACE_ID) {
    return jsonResponse(400, {
      ok: false,
      error: "Invalid workspace_id for this backend environment.",
      expected_workspace_id: WORKSPACE_ID,
      received_workspace_id: workspaceId,
    });
  }

  if (!body.backup_run_id) {
    return jsonResponse(400, {
      ok: false,
      error: "backup_run_id is required.",
    });
  }

  const restoreMode = normalizeRestoreMode(body.restore_mode);

  let requestedTables: string[];

  try {
    requestedTables = normalizeTables(body.tables, restoreMode);
  } catch (error) {
    return jsonResponse(400, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const authHeader = req.headers.get("Authorization");

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  let actor: ActorContext;

  try {
    actor = await getActorContext({
      req,
      body,
      workspaceId,
      userClient,
      serviceClient,
    });
  } catch (error) {
    await writeAuditLog({
      serviceClient,
      workspaceId,
      actorUserId: null,
      actorEmail: null,
      actorRole: null,
      action: "restore_backup_permission_check_failed",
      severity: "error",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return jsonResponse(500, {
      ok: false,
      error: "Permission check failed.",
      details: error instanceof Error ? error.message : String(error),
    });
  }

  if (!actor.can_run_backup_restore || actor.role !== "superadmin") {
    await writeAuditLog({
      serviceClient,
      workspaceId,
      actorUserId: actor.user_id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "restore_backup_denied",
      severity: "warning",
      metadata: {
        mode: actor.mode,
        restore_mode: restoreMode,
        backup_run_id: body.backup_run_id,
        required_role: "superadmin",
        actual_role: actor.role,
        denial_reason: actor.denial_reason,
      },
    });

    return jsonResponse(403, {
      ok: false,
      error: "Forbidden. This action requires superadmin role.",
      mode: actor.mode,
      required_role: "superadmin",
      actual_role: actor.role,
      actor_email: actor.email,
      denial_reason: actor.denial_reason,
    });
  }

  const restoreRequestId = crypto.randomUUID();
  const startedAt = new Date().toISOString();

  const { error: insertRequestError } = await serviceClient
    .from("restore_requests")
    .insert({
      id: restoreRequestId,
      workspace_id: workspaceId,
      backup_run_id: body.backup_run_id,
      status: "running",
      restore_mode: restoreMode,
      trigger_source: "edge_function",
      actor_user_id: actor.user_id,
      actor_email: actor.email,
      actor_role: actor.role,
      mode: actor.mode,
      tables_requested: requestedTables,
      metadata: body.metadata ?? {},
      started_at: startedAt,
    });

  if (insertRequestError) {
    return jsonResponse(500, {
      ok: false,
      error: "Failed to create restore request.",
      details: insertRequestError.message,
    });
  }

  await writeAuditLog({
    serviceClient,
    workspaceId,
    actorUserId: actor.user_id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "restore_backup_started",
    severity: "info",
    metadata: {
      mode: actor.mode,
      restore_request_id: restoreRequestId,
      backup_run_id: body.backup_run_id,
      restore_mode: restoreMode,
      tables_requested: requestedTables,
    },
  });

  const validatedTables: string[] = [];
  const restoredTables: string[] = [];
  const failedTables: string[] = [];
  const fileResults: unknown[] = [];

  let filesChecked = 0;
  let filesMissing = 0;
  let rowsExpected = 0;
  let rowsRestored = 0;

  try {
    const backupRun = await getBackupRun({
      serviceClient,
      workspaceId,
      backupRunId: body.backup_run_id,
    });

    if (backupRun.status !== "success") {
      throw new Error(`Backup run is not successful. Current status: ${backupRun.status}`);
    }

    for (const tableName of requestedTables) {
      try {
        const backupFile = await getBackupFile({
          serviceClient,
          workspaceId,
          backupRunId: body.backup_run_id,
          tableName,
        });

        if (!backupFile) {
          filesMissing += 1;
          failedTables.push(tableName);

          fileResults.push({
            table_name: tableName,
            ok: false,
            status: "missing_backup_file",
            rows_expected: 0,
            rows_restored: 0,
          });

          continue;
        }

        filesChecked += 1;

        const payload = await downloadBackupPayload({
          serviceClient,
          backupFile,
        });

        const rows = extractRowsFromBackupPayload(payload);

        rowsExpected += rows.length;
        validatedTables.push(tableName);

        if (restoreMode === "restore") {
          const inserted = await restoreTableRows({
            serviceClient,
            workspaceId,
            tableName,
            rows,
          });

          rowsRestored += inserted;
          restoredTables.push(tableName);

          fileResults.push({
            table_name: tableName,
            ok: true,
            status: "restored",
            storage_path: backupFile.storage_path,
            rows_expected: rows.length,
            rows_restored: inserted,
          });
        } else {
          fileResults.push({
            table_name: tableName,
            ok: true,
            status: "validated_preview_only",
            storage_path: backupFile.storage_path,
            rows_expected: rows.length,
            rows_restored: 0,
          });
        }
      } catch (tableError) {
        failedTables.push(tableName);

        fileResults.push({
          table_name: tableName,
          ok: false,
          status: "failed",
          error: tableError instanceof Error ? tableError.message : String(tableError),
          rows_expected: 0,
          rows_restored: 0,
        });
      }
    }

    const finalStatus = failedTables.length === 0 ? "success" : "failed";
    const dataChanged = restoreMode === "restore" && rowsRestored > 0;

    const { error: updateRequestError } = await serviceClient
      .from("restore_requests")
      .update({
        status: finalStatus,
        tables_validated: validatedTables,
        tables_restored: restoredTables,
        tables_failed: failedTables,
        files_checked: filesChecked,
        files_missing: filesMissing,
        rows_expected: rowsExpected,
        rows_restored: rowsRestored,
        data_changed: dataChanged,
        completed_at: new Date().toISOString(),
        error_message:
          failedTables.length > 0
            ? `Failed tables: ${failedTables.join(", ")}`
            : null,
        metadata: {
          ...(body.metadata ?? {}),
          file_results: fileResults,
        },
      })
      .eq("id", restoreRequestId);

    if (updateRequestError) {
      throw new Error(`Failed to update restore request: ${updateRequestError.message}`);
    }

    await writeAuditLog({
      serviceClient,
      workspaceId,
      actorUserId: actor.user_id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action:
        restoreMode === "preview"
          ? "restore_backup_preview_success"
          : "restore_backup_real_success",
      severity: "info",
      metadata: {
        mode: actor.mode,
        restore_request_id: restoreRequestId,
        backup_run_id: body.backup_run_id,
        restore_mode: restoreMode,
        status: finalStatus,
        tables_requested: requestedTables,
        tables_validated: validatedTables,
        tables_restored: restoredTables,
        tables_failed: failedTables,
        files_checked: filesChecked,
        files_missing: filesMissing,
        rows_expected: rowsExpected,
        rows_restored: rowsRestored,
        data_changed: dataChanged,
      },
    });

    return jsonResponse(finalStatus === "success" ? 200 : 500, {
      ok: finalStatus === "success",
      mode: actor.mode,
      workspace_id: workspaceId,
      restore_request_id: restoreRequestId,
      backup_run_id: body.backup_run_id,
      restore_mode: restoreMode,
      status: finalStatus,
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: actor.role,
      },
      data_changed: dataChanged,
      files_checked: filesChecked,
      files_missing: filesMissing,
      rows_expected: rowsExpected,
      rows_restored: rowsRestored,
      tables_requested: requestedTables,
      tables_validated: validatedTables,
      tables_restored: restoredTables,
      tables_failed: failedTables,
      file_results: fileResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await serviceClient
      .from("restore_requests")
      .update({
        status: "failed",
        tables_validated: validatedTables,
        tables_restored: restoredTables,
        tables_failed: failedTables.length > 0 ? failedTables : requestedTables,
        files_checked: filesChecked,
        files_missing: filesMissing,
        rows_expected: rowsExpected,
        rows_restored: rowsRestored,
        data_changed: restoreMode === "restore" && rowsRestored > 0,
        completed_at: new Date().toISOString(),
        error_message: message,
      })
      .eq("id", restoreRequestId);

    await writeAuditLog({
      serviceClient,
      workspaceId,
      actorUserId: actor.user_id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "restore_backup_failed",
      severity: "error",
      metadata: {
        mode: actor.mode,
        restore_request_id: restoreRequestId,
        backup_run_id: body.backup_run_id,
        restore_mode: restoreMode,
        error: message,
      },
    });

    return jsonResponse(500, {
      ok: false,
      error: "restore-backup failed.",
      details: message,
      restore_request_id: restoreRequestId,
    });
  }
});
