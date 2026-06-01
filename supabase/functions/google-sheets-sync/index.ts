import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  workspace_id?: string;
  google_sheet_source_id?: string;
  spreadsheet_id?: string;
  clear_previous_staging?: boolean;
  clear_previous_raw?: boolean;
  rebuild_facts?: boolean;
  run_post_sync_pipeline?: boolean;

  backend_test_secret?: string;
  test_actor_email?: string;
  metadata?: Record<string, unknown>;
};

type ActorContext = {
  mode: "user_jwt" | "backend_test" | "none";
  user_id: string | null;
  email: string | null;
  role: string | null;
  allowed: boolean;
  reason: string | null;
};

const FUNCTION_NAME = "google-sheets-sync";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-backend-test-secret, x-test-actor-email, x-internal-admin-secret",
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
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function cleanHeader(value: unknown, index: number): string {
  const raw = String(value ?? "").trim();

  if (!raw) {
    return `column_${index + 1}`;
  }

  return raw
    .replace(/\uFEFF/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function sheetRange(tabName: string): string {
  const escaped = tabName.replace(/'/g, "''");
  return `'${escaped}'!A:ZZZ`;
}

function buildRowObject(headers: string[], row: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  headers.forEach((header, index) => {
    obj[header] = row[index] ?? null;
  });

  return obj;
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

async function writeAuditLog(params: {
  supabaseAdmin: any;
  workspaceId: string;
  actor: ActorContext | null;
  action: string;
  severity?: "info" | "warning" | "error";
  metadata?: Record<string, unknown>;
}) {
  const { error } = await params.supabaseAdmin.from("audit_logs").insert({
    workspace_id: params.workspaceId,
    actor_user_id: params.actor?.user_id ?? null,
    actor_role: params.actor?.role ?? null,
    action: params.action,
    entity_type: "edge_function",
    entity_id: FUNCTION_NAME,
    severity: params.severity ?? "info",
    metadata: {
      actor_email: params.actor?.email ?? null,
      mode: params.actor?.mode ?? null,
      ...(params.metadata ?? {}),
    },
  });

  if (error) {
    console.error("Audit log write failed:", error);
  }
}

function normalizeAccessRow(row: any) {
  return {
    allowed: row?.allowed === true,
    actor_user_id: row?.result_actor_user_id ?? row?.actor_user_id ?? null,
    actor_email: row?.result_actor_email ?? row?.actor_email ?? null,
    actor_role: row?.result_actor_role ?? row?.actor_role ?? null,
    reason: row?.result_reason ?? row?.reason ?? null,
    required_permission:
      row?.result_required_permission ?? row?.required_permission ?? null,
    required_min_role:
      row?.result_required_min_role ?? row?.required_min_role ?? null,
    allow_backend_test_mode:
      row?.result_allow_backend_test_mode ?? row?.allow_backend_test_mode ?? true,
  };
}

async function getActorContext(params: {
  req: Request;
  body: RequestBody;
  workspaceId: string;
  supabaseAnon: any;
  supabaseAdmin: any;
}): Promise<ActorContext> {
  const { req, body, workspaceId, supabaseAnon, supabaseAdmin } = params;

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
        allowed: false,
        reason: "BACKEND_TEST_MODE_is_not_enabled",
      };
    }

    if (!expectedBackendTestSecret) {
      return {
        mode: "backend_test",
        user_id: null,
        email: null,
        role: null,
        allowed: false,
        reason: "BACKEND_TEST_SECRET_env_is_missing",
      };
    }

    if (providedBackendTestSecret !== expectedBackendTestSecret) {
      return {
        mode: "backend_test",
        user_id: null,
        email: null,
        role: null,
        allowed: false,
        reason: "backend_test_secret_does_not_match",
      };
    }

    const actorEmail = getProvidedTestActorEmail(req, body);

    const { data, error } = await supabaseAdmin.rpc(
      "check_edge_function_access_by_email",
      {
        p_workspace_id: workspaceId,
        p_function_name: FUNCTION_NAME,
        p_actor_email: actorEmail,
      }
    );

    if (error) {
      throw new Error(`Access checker failed: ${error.message}`);
    }

    const access = normalizeAccessRow(Array.isArray(data) ? data[0] : data);

    if (access.allow_backend_test_mode !== true) {
      return {
        mode: "backend_test",
        user_id: access.actor_user_id,
        email: access.actor_email ?? actorEmail,
        role: access.actor_role,
        allowed: false,
        reason: "backend_test_mode_not_allowed_for_this_function",
      };
    }

    return {
      mode: "backend_test",
      user_id: access.actor_user_id,
      email: access.actor_email ?? actorEmail,
      role: access.actor_role,
      allowed: access.allowed,
      reason: access.reason,
    };
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();

    const { data: userData, error: userError } =
      await supabaseAnon.auth.getUser(token);

    if (userError || !userData?.user) {
      return {
        mode: "user_jwt",
        user_id: null,
        email: null,
        role: null,
        allowed: false,
        reason: "invalid_or_expired_user_jwt",
      };
    }

    const { data, error } = await supabaseAdmin.rpc(
      "check_edge_function_access",
      {
        p_workspace_id: workspaceId,
        p_function_name: FUNCTION_NAME,
        p_actor_user_id: userData.user.id,
      }
    );

    if (error) {
      throw new Error(`Access checker failed: ${error.message}`);
    }

    const access = normalizeAccessRow(Array.isArray(data) ? data[0] : data);

    return {
      mode: "user_jwt",
      user_id: userData.user.id,
      email: userData.user.email ?? access.actor_email,
      role: access.actor_role,
      allowed: access.allowed,
      reason: access.reason,
    };
  }

  return {
    mode: "none",
    user_id: null,
    email: null,
    role: null,
    allowed: false,
    reason: "missing_user_jwt_or_backend_test_secret",
  };
}

async function insertStagingRowsInChunks(
  supabaseAdmin: any,
  workspaceId: string,
  rows: Record<string, unknown>[],
  chunkSize = 300
) {
  let inserted = 0;

  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);

    const { data, error } = await supabaseAdmin.rpc(
      "insert_google_sheet_staging_rows",
      {
        p_workspace_id: workspaceId,
        p_rows: chunk,
      }
    );

    if (error) {
      throw new Error(error.message);
    }

    inserted += Number(data ?? 0);
  }

  return inserted;
}

Deno.serve(async (req) => {
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
      error: "Invalid JSON body",
    });
  }

  const workspaceId = body.workspace_id;

  if (!workspaceId) {
    return jsonResponse(400, {
      ok: false,
      error: "workspace_id is required",
    });
  }

  const googleSheetSourceId = body.google_sheet_source_id ?? null;
  const spreadsheetIdFromBody = body.spreadsheet_id ?? null;

  if (!googleSheetSourceId && !spreadsheetIdFromBody) {
    return jsonResponse(400, {
      ok: false,
      error: "google_sheet_source_id or spreadsheet_id is required",
    });
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const googleClientId = requiredEnv("GOOGLE_CLIENT_ID");
  const googleClientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");

  const authHeader = req.headers.get("Authorization");

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let actor: ActorContext;

  try {
    actor = await getActorContext({
      req,
      body,
      workspaceId,
      supabaseAnon,
      supabaseAdmin,
    });
  } catch (error) {
    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor: null,
      action: "google_sheets_sync_permission_check_failed",
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

  if (!actor.allowed) {
    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "google_sheets_sync_denied",
      severity: "warning",
      metadata: {
        reason: actor.reason,
        google_sheet_source_id: googleSheetSourceId,
        spreadsheet_id: spreadsheetIdFromBody,
      },
    });

    return jsonResponse(403, {
      ok: false,
      error: "Forbidden. This action requires admin or superadmin role.",
      function: FUNCTION_NAME,
      mode: actor.mode,
      actor_email: actor.email,
      actor_role: actor.role,
      reason: actor.reason,
    });
  }

  const clearPreviousStaging = body.clear_previous_staging ?? true;
  const clearPreviousRaw = body.clear_previous_raw ?? true;
  const rebuildFacts = body.rebuild_facts ?? true;
  const runPostSyncPipeline = body.run_post_sync_pipeline ?? true;

  await writeAuditLog({
    supabaseAdmin,
    workspaceId,
    actor,
    action: "google_sheets_sync_started",
    severity: "info",
    metadata: {
      google_sheet_source_id: googleSheetSourceId,
      spreadsheet_id: spreadsheetIdFromBody,
      clear_previous_staging: clearPreviousStaging,
      clear_previous_raw: clearPreviousRaw,
      rebuild_facts: rebuildFacts,
      run_post_sync_pipeline: runPostSyncPipeline,
      request_metadata: body.metadata ?? {},
    },
  });

  try {
    const { data: sheetSourceRows, error: sourceError } = await supabaseAdmin.rpc(
      "get_google_sheet_source_for_sync",
      {
        p_workspace_id: workspaceId,
        p_google_sheet_source_id: googleSheetSourceId,
        p_spreadsheet_id: spreadsheetIdFromBody,
      }
    );

    if (sourceError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheets_sync_failed",
        severity: "error",
        metadata: {
          step: "get_google_sheet_source_for_sync",
          error: sourceError.message,
          hint: sourceError.hint ?? null,
          code: sourceError.code ?? null,
        },
      });

      return jsonResponse(500, {
        ok: false,
        error: "Could not read Google Sheet source via RPC",
        details: sourceError.message,
        hint: sourceError.hint ?? null,
        code: sourceError.code ?? null,
      });
    }

    const sheetSource = sheetSourceRows?.[0] ?? null;

    if (!sheetSource) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheets_sync_failed",
        severity: "error",
        metadata: {
          step: "sheet_source_not_found",
          google_sheet_source_id: googleSheetSourceId,
          spreadsheet_id: spreadsheetIdFromBody,
        },
      });

      return jsonResponse(404, {
        ok: false,
        error: "Google Sheet source not found",
        workspace_id: workspaceId,
        google_sheet_source_id: googleSheetSourceId,
        spreadsheet_id: spreadsheetIdFromBody,
      });
    }

    const { data: oauthRows, error: oauthError } = await supabaseAdmin.rpc(
      "get_active_google_oauth_connection_for_workspace",
      {
        p_workspace_id: workspaceId,
      }
    );

    if (oauthError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheets_sync_failed",
        severity: "error",
        metadata: {
          step: "get_active_google_oauth_connection_for_workspace",
          error: oauthError.message,
          hint: oauthError.hint ?? null,
          code: oauthError.code ?? null,
        },
      });

      return jsonResponse(500, {
        ok: false,
        error: "Could not read Google OAuth connection via RPC",
        details: oauthError.message,
        hint: oauthError.hint ?? null,
        code: oauthError.code ?? null,
      });
    }

    const oauthConnection = oauthRows?.[0] ?? null;

    if (!oauthConnection?.vault_secret_name) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheets_sync_failed",
        severity: "error",
        metadata: {
          step: "active_google_oauth_connection_not_found",
          google_sheet_source_id: sheetSource.id,
        },
      });

      return jsonResponse(404, {
        ok: false,
        error: "Active Google OAuth connection not found for this workspace",
        workspace_id: workspaceId,
      });
    }

    const { data: secretPayloadRaw, error: secretError } = await supabaseAdmin.rpc(
      "get_google_oauth_secret_payload",
      {
        p_vault_secret_name: oauthConnection.vault_secret_name,
      }
    );

    if (secretError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheets_sync_failed",
        severity: "error",
        metadata: {
          step: "get_google_oauth_secret_payload",
          vault_secret_name: oauthConnection.vault_secret_name,
          error: secretError.message,
          hint: secretError.hint ?? null,
          code: secretError.code ?? null,
        },
      });

      return jsonResponse(500, {
        ok: false,
        error: "Could not read Google token from Vault",
        vault_secret_name: oauthConnection.vault_secret_name,
        details: secretError.message,
        hint: secretError.hint ?? null,
        code: secretError.code ?? null,
      });
    }

    const secretPayload =
      typeof secretPayloadRaw === "string"
        ? JSON.parse(secretPayloadRaw)
        : secretPayloadRaw;

    const refreshToken = secretPayload?.refresh_token;

    if (!refreshToken) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheets_sync_failed",
        severity: "error",
        metadata: {
          step: "refresh_token_not_found",
        },
      });

      return jsonResponse(500, {
        ok: false,
        error: "Refresh token not found in Vault payload",
      });
    }

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: googleClientId,
        client_secret: googleClientSecret,
        refresh_token: refreshToken,
        grant_type: "refresh_token",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok || !tokenData.access_token) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheets_sync_failed",
        severity: "error",
        metadata: {
          step: "refresh_google_access_token",
          details: tokenData,
        },
      });

      return jsonResponse(400, {
        ok: false,
        error: "Could not refresh Google access token",
        details: tokenData,
      });
    }

    const accessToken = tokenData.access_token as string;

    const { data: tabs, error: tabsError } = await supabaseAdmin.rpc(
      "get_google_sheet_tabs_for_sync",
      {
        p_workspace_id: workspaceId,
        p_google_sheet_source_id: sheetSource.id,
      }
    );

    if (tabsError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheets_sync_failed",
        severity: "error",
        metadata: {
          step: "get_google_sheet_tabs_for_sync",
          error: tabsError.message,
          hint: tabsError.hint ?? null,
          code: tabsError.code ?? null,
        },
      });

      return jsonResponse(500, {
        ok: false,
        error: "Could not read Google Sheet tabs via RPC",
        details: tabsError.message,
        hint: tabsError.hint ?? null,
        code: tabsError.code ?? null,
      });
    }

    if (!tabs || tabs.length === 0) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheets_sync_failed",
        severity: "error",
        metadata: {
          step: "no_active_google_sheet_tabs",
          google_sheet_source_id: sheetSource.id,
        },
      });

      return jsonResponse(404, {
        ok: false,
        error: "No active Google Sheet tabs found for this source",
        google_sheet_source_id: sheetSource.id,
      });
    }

    const { data: syncJob } = await supabaseAdmin
      .from("sync_jobs")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("source_connection_id", sheetSource.source_connection_id)
      .eq("job_type", "pull_google_sheet")
      .limit(1)
      .maybeSingle();

    const { data: syncRunLogId, error: startRunError } = await supabaseAdmin.rpc(
      "start_sync_run",
      {
        p_workspace_id: workspaceId,
        p_source_connection_id: sheetSource.source_connection_id,
        p_sync_job_id: syncJob?.id ?? null,
        p_metadata: {
          function: FUNCTION_NAME,
          mode: "full_pipeline",
          access_mode: actor.mode,
          actor_email: actor.email,
          actor_role: actor.role,
          google_sheet_source_id: sheetSource.id,
          spreadsheet_id: sheetSource.spreadsheet_id,
          spreadsheet_name: sheetSource.spreadsheet_name,
        },
      }
    );

    if (startRunError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheets_sync_failed",
        severity: "error",
        metadata: {
          step: "start_sync_run",
          error: startRunError.message,
          hint: startRunError.hint ?? null,
          code: startRunError.code ?? null,
        },
      });

      return jsonResponse(500, {
        ok: false,
        error: "Could not start sync run",
        details: startRunError.message,
        hint: startRunError.hint ?? null,
        code: startRunError.code ?? null,
      });
    }

    let clearedRows = 0;

    if (clearPreviousStaging) {
      const { data: deletedCount, error: clearError } = await supabaseAdmin.rpc(
        "clear_google_sheet_staging_rows",
        {
          p_workspace_id: workspaceId,
          p_google_sheet_source_id: sheetSource.id,
        }
      );

      if (clearError) {
        await supabaseAdmin.rpc("finish_sync_run", {
          p_sync_run_log_id: syncRunLogId,
          p_status: "failed",
          p_rows_received: 0,
          p_rows_inserted: 0,
          p_rows_updated: 0,
          p_rows_failed: 0,
          p_error_message: clearError.message,
          p_metadata: {
            step: "clear_previous_staging",
            google_sheet_source_id: sheetSource.id,
          },
        });

        await writeAuditLog({
          supabaseAdmin,
          workspaceId,
          actor,
          action: "google_sheets_sync_failed",
          severity: "error",
          metadata: {
            step: "clear_previous_staging",
            sync_run_log_id: syncRunLogId,
            google_sheet_source_id: sheetSource.id,
            error: clearError.message,
            hint: clearError.hint ?? null,
            code: clearError.code ?? null,
          },
        });

        return jsonResponse(500, {
          ok: false,
          error: "Could not clear previous staging rows via RPC",
          details: clearError.message,
          hint: clearError.hint ?? null,
          code: clearError.code ?? null,
        });
      }

      clearedRows = Number(deletedCount ?? 0);
    }

    const tabResults: Array<Record<string, unknown>> = [];
    let totalRowsReceived = 0;
    let totalRowsInserted = 0;
    let totalRowsFailed = 0;

    for (const tab of tabs) {
      const range = tab.range_a1 || sheetRange(tab.tab_name);

      const valuesResponse = await fetch(
        `https://sheets.googleapis.com/v4/spreadsheets/${sheetSource.spreadsheet_id}/values/${encodeURIComponent(range)}?majorDimension=ROWS`,
        {
          headers: {
            Authorization: `Bearer ${accessToken}`,
          },
        }
      );

      const valuesData = await valuesResponse.json();

      if (!valuesResponse.ok) {
        totalRowsFailed += 1;

        tabResults.push({
          tab_name: tab.tab_name,
          status: "failed",
          error: valuesData,
        });

        continue;
      }

      const values: unknown[][] = Array.isArray(valuesData.values)
        ? valuesData.values
        : [];

      if (values.length === 0) {
        tabResults.push({
          tab_name: tab.tab_name,
          status: "empty",
          rows_received: 0,
          rows_inserted: 0,
        });

        continue;
      }

      const headerRowIndex = Math.max(Number(tab.header_row ?? 1) - 1, 0);
      const headerRow = values[headerRowIndex] ?? [];
      const headers = headerRow.map((value, index) => cleanHeader(value, index));

      const dataRows = values.slice(headerRowIndex + 1);
      totalRowsReceived += dataRows.length;

      const stagingRows = dataRows
        .map((row, index) => {
          const rowObject = buildRowObject(headers, row);

          const isEmptyRow = Object.values(rowObject).every(
            (value) => value === null || String(value).trim() === ""
          );

          if (isEmptyRow) {
            return null;
          }

          return {
            source_name: `google_sheet:${sheetSource.spreadsheet_name}:${tab.tab_name}`,
            row_number: index + headerRowIndex + 2,
            row_data: {
              google_sheet_source_id: sheetSource.id,
              google_sheet_tab_id: tab.id,
              spreadsheet_id: sheetSource.spreadsheet_id,
              spreadsheet_name: sheetSource.spreadsheet_name,
              tab_name: tab.tab_name,
              source_type: tab.source_type,
              target_raw_table: tab.target_raw_table,
              processor_function: tab.processor_function,
              row_number: index + headerRowIndex + 2,
              headers,
              values: row,
              data: rowObject,
              synced_at: new Date().toISOString(),
            },
          };
        })
        .filter(Boolean) as Record<string, unknown>[];

      try {
        const inserted = await insertStagingRowsInChunks(
          supabaseAdmin,
          workspaceId,
          stagingRows,
          300
        );

        totalRowsInserted += inserted;

        tabResults.push({
          tab_name: tab.tab_name,
          status: "success",
          source_type: tab.source_type,
          target_raw_table: tab.target_raw_table,
          rows_received: dataRows.length,
          rows_inserted: inserted,
        });
      } catch (error) {
        totalRowsFailed += stagingRows.length;

        tabResults.push({
          tab_name: tab.tab_name,
          status: "failed",
          source_type: tab.source_type,
          target_raw_table: tab.target_raw_table,
          rows_received: dataRows.length,
          rows_inserted: 0,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    let postSyncPipelineResult: unknown = null;
    let postSyncPipelineOk = true;

    if (runPostSyncPipeline && totalRowsFailed === 0) {
      const { data: pipelineResult, error: pipelineError } =
        await supabaseAdmin.rpc("run_google_sheet_post_sync_pipeline", {
          p_workspace_id: workspaceId,
          p_google_sheet_source_id: sheetSource.id,
          p_clear_previous_raw: clearPreviousRaw,
          p_rebuild_facts: rebuildFacts,
        });

      if (pipelineError) {
        postSyncPipelineOk = false;
        postSyncPipelineResult = {
          ok: false,
          error: pipelineError.message,
          hint: pipelineError.hint ?? null,
          code: pipelineError.code ?? null,
        };
      } else {
        postSyncPipelineResult = pipelineResult;
        postSyncPipelineOk = Boolean(pipelineResult?.ok);
      }
    }

    const finalStatus =
      totalRowsFailed > 0 || !postSyncPipelineOk ? "failed" : "success";

    const { error: finishRunError } = await supabaseAdmin.rpc("finish_sync_run", {
      p_sync_run_log_id: syncRunLogId,
      p_status: finalStatus,
      p_rows_received: totalRowsReceived,
      p_rows_inserted: totalRowsInserted,
      p_rows_updated: 0,
      p_rows_failed: totalRowsFailed,
      p_error_message:
        totalRowsFailed > 0
          ? "Some tabs failed during Google Sheets sync"
          : !postSyncPipelineOk
            ? "Post-sync pipeline failed"
            : null,
      p_metadata: {
        google_sheet_source_id: sheetSource.id,
        spreadsheet_id: sheetSource.spreadsheet_id,
        spreadsheet_name: sheetSource.spreadsheet_name,
        cleared_previous_staging_rows: clearedRows,
        tab_results: tabResults,
        post_sync_pipeline: postSyncPipelineResult,
        actor_email: actor.email,
        actor_role: actor.role,
        mode: actor.mode,
      },
    });

    if (finishRunError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheets_sync_failed",
        severity: "error",
        metadata: {
          step: "finish_sync_run",
          sync_run_log_id: syncRunLogId,
          error: finishRunError.message,
          hint: finishRunError.hint ?? null,
          code: finishRunError.code ?? null,
          rows_received: totalRowsReceived,
          rows_inserted: totalRowsInserted,
          rows_failed: totalRowsFailed,
        },
      });

      return jsonResponse(500, {
        ok: false,
        error: "Sync completed but could not finish sync run log",
        details: finishRunError.message,
        hint: finishRunError.hint ?? null,
        code: finishRunError.code ?? null,
        rows_received: totalRowsReceived,
        rows_inserted: totalRowsInserted,
        rows_failed: totalRowsFailed,
        tab_results: tabResults,
        post_sync_pipeline: postSyncPipelineResult,
      });
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action:
        finalStatus === "success"
          ? "google_sheets_sync_success"
          : "google_sheets_sync_failed",
      severity: finalStatus === "success" ? "info" : "error",
      metadata: {
        sync_run_log_id: syncRunLogId,
        google_sheet_source_id: sheetSource.id,
        spreadsheet_id: sheetSource.spreadsheet_id,
        spreadsheet_name: sheetSource.spreadsheet_name,
        status: finalStatus,
        cleared_previous_staging_rows: clearedRows,
        rows_received: totalRowsReceived,
        rows_inserted: totalRowsInserted,
        rows_failed: totalRowsFailed,
        tabs_processed: tabResults.length,
        post_sync_pipeline_ok: postSyncPipelineOk,
      },
    });

    return jsonResponse(totalRowsFailed === 0 && postSyncPipelineOk ? 200 : 500, {
      ok: totalRowsFailed === 0 && postSyncPipelineOk,
      function: FUNCTION_NAME,
      status: finalStatus,
      mode: actor.mode,
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: actor.role,
      },
      workspace_id: workspaceId,
      google_sheet_source_id: sheetSource.id,
      spreadsheet_id: sheetSource.spreadsheet_id,
      spreadsheet_name: sheetSource.spreadsheet_name,
      sync_run_log_id: syncRunLogId,
      cleared_previous_staging_rows: clearedRows,
      rows_received: totalRowsReceived,
      rows_inserted: totalRowsInserted,
      rows_failed: totalRowsFailed,
      tabs_processed: tabResults.length,
      tab_results: tabResults,
      post_sync_pipeline: postSyncPipelineResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "google_sheets_sync_failed",
      severity: "error",
      metadata: {
        step: "unhandled_error",
        error: message,
      },
    });

    return jsonResponse(500, {
      ok: false,
      error: "google-sheets-sync failed.",
      details: message,
    });
  }
});
