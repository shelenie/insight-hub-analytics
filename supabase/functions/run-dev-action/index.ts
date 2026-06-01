import { createClient } from "npm:@supabase/supabase-js@2";

type DevAction = "backend_snapshot" | "permission_check" | "debug_backend_test";

type RequestBody = {
  workspace_id?: string;
  action?: DevAction;
  metadata?: Record<string, unknown>;

  backend_test_secret?: string;
  test_actor_email?: string;
};

type ActorContext = {
  mode: "user_jwt" | "backend_test" | "none";
  user_id: string | null;
  email: string | null;
  role: string | null;
  can_run_dev_action: boolean;
  denial_reason?: string | null;
};

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
  if (!value) {
    throw new Error(`Missing required env: ${name}`);
  }
  return value;
}

function normalizeAction(action: unknown): DevAction | null {
  if (action === "backend_snapshot") return "backend_snapshot";
  if (action === "permission_check") return "permission_check";
  if (action === "debug_backend_test") return "debug_backend_test";
  return null;
}

function getProvidedBackendTestSecret(req: Request, body: RequestBody) {
  return (
    body.backend_test_secret ??
    req.headers.get("x-backend-test-secret") ??
    null
  );
}

function getProvidedTestActorEmail(req: Request, body: RequestBody) {
  return (
    body.test_actor_email ??
    req.headers.get("x-test-actor-email") ??
    Deno.env.get("BACKEND_TEST_ACTOR_EMAIL") ??
    "olenashepel.ai@gmail.com"
  );
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

    if (error) {
      throw new Error(`Failed to list users: ${error.message}`);
    }

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

  if (error) {
    throw new Error(`Failed to read workspace role: ${error.message}`);
  }

  return data?.role ?? null;
}

async function writeAuditLog(params: {
  serviceClient: any;
  workspaceId: string;
  actorUserId: string | null;
  actorEmail: string | null;
  actorRole: string | null;
  action: string;
  entityType?: string;
  entityId?: string;
  severity?: "info" | "warning" | "error";
  metadata?: Record<string, unknown>;
}) {
  const { error } = await params.serviceClient.from("audit_logs").insert({
    workspace_id: params.workspaceId,
    actor_user_id: params.actorUserId,
    actor_role: params.actorRole,
    action: params.action,
    entity_type: params.entityType ?? "edge_function",
    entity_id: params.entityId ?? "run-dev-action",
    severity: params.severity ?? "info",
    metadata: {
      actor_email: params.actorEmail,
      ...(params.metadata ?? {}),
    },
  });

  if (error) {
    console.error("Audit log write failed:", error);
  }
}

async function buildBackendTestDebug(params: {
  req: Request;
  body: RequestBody;
  workspaceId: string;
  serviceClient: any;
}) {
  const { req, body, workspaceId, serviceClient } = params;

  const backendTestMode = Deno.env.get("BACKEND_TEST_MODE") ?? "disabled";
  const expectedBackendTestSecret = Deno.env.get("BACKEND_TEST_SECRET") ?? "";
  const providedBackendTestSecret = getProvidedBackendTestSecret(req, body);
  const actorEmail = getProvidedTestActorEmail(req, body);

  const secretMatches =
    Boolean(providedBackendTestSecret) &&
    Boolean(expectedBackendTestSecret) &&
    providedBackendTestSecret === expectedBackendTestSecret;

  let actorUserFound = false;
  let actorUserId: string | null = null;
  let actorRole: string | null = null;
  let canRunDevAction = false;
  let lookupError: string | null = null;

  if (secretMatches) {
    try {
      const actorUser = await findUserByEmail(serviceClient, actorEmail);

      if (actorUser?.id) {
        actorUserFound = true;
        actorUserId = actorUser.id;

        actorRole = await getWorkspaceRoleByUserId({
          serviceClient,
          workspaceId,
          userId: actorUser.id,
        });

        canRunDevAction = actorRole === "superadmin";
      }
    } catch (error) {
      lookupError = error instanceof Error ? error.message : String(error);
    }
  }

  let denialReason: string | null = null;

  if (backendTestMode !== "enabled") {
    denialReason = "BACKEND_TEST_MODE_is_not_enabled";
  } else if (!expectedBackendTestSecret) {
    denialReason = "BACKEND_TEST_SECRET_env_is_missing";
  } else if (!providedBackendTestSecret) {
    denialReason = "backend_test_secret_was_not_provided";
  } else if (!secretMatches) {
    denialReason = "backend_test_secret_does_not_match";
  } else if (!actorUserFound) {
    denialReason = "test_actor_email_not_found_in_auth_users";
  } else if (actorRole !== "superadmin") {
    denialReason = "test_actor_is_not_superadmin_in_workspace_members";
  }

  return {
    ok: denialReason === null,
    action: "debug_backend_test",
    workspace_id: workspaceId,
    debug: {
      backend_test_mode: backendTestMode,
      backend_test_secret_env_exists: expectedBackendTestSecret.length > 0,
      backend_test_secret_provided: Boolean(providedBackendTestSecret),
      backend_test_secret_matches: secretMatches,
      test_actor_email: actorEmail,
      actor_user_found_in_auth_users: actorUserFound,
      actor_user_id: actorUserId,
      actor_workspace_role: actorRole,
      can_run_dev_action: canRunDevAction,
      denial_reason: denialReason,
      lookup_error: lookupError,
    },
  };
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

  // IMPORTANT:
  // Backend test path goes first.
  // Supabase Dashboard can attach Authorization automatically,
  // so body.backend_test_secret must have priority during backend-only tests.
  if (providedBackendTestSecret) {
    if (backendTestMode !== "enabled") {
      return {
        mode: "backend_test",
        user_id: null,
        email: null,
        role: null,
        can_run_dev_action: false,
        denial_reason: "BACKEND_TEST_MODE_is_not_enabled",
      };
    }

    if (!expectedBackendTestSecret) {
      return {
        mode: "backend_test",
        user_id: null,
        email: null,
        role: null,
        can_run_dev_action: false,
        denial_reason: "BACKEND_TEST_SECRET_env_is_missing",
      };
    }

    if (providedBackendTestSecret !== expectedBackendTestSecret) {
      return {
        mode: "backend_test",
        user_id: null,
        email: null,
        role: null,
        can_run_dev_action: false,
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
        can_run_dev_action: false,
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
      can_run_dev_action: role === "superadmin",
      denial_reason:
        role === "superadmin"
          ? null
          : "test_actor_is_not_superadmin_in_workspace_members",
    };
  }

  // Production path: real user JWT
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();

    const { data: userData, error: userError } = await userClient.auth.getUser(
      token,
    );

    if (userError || !userData?.user) {
      return {
        mode: "user_jwt",
        user_id: null,
        email: null,
        role: null,
        can_run_dev_action: false,
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
      can_run_dev_action: permissions?.can_run_dev_action === true,
      denial_reason:
        permissions?.can_run_dev_action === true
          ? null
          : "user_does_not_have_can_run_dev_action_permission",
    };
  }

  return {
    mode: "none",
    user_id: null,
    email: null,
    role: null,
    can_run_dev_action: false,
    denial_reason: "missing_user_jwt_or_backend_test_secret",
  };
}

async function safeCount(
  serviceClient: any,
  tableName: string,
  workspaceId: string,
  workspaceColumn = "workspace_id",
) {
  try {
    const { count, error } = await serviceClient
      .from(tableName)
      .select("*", { count: "exact", head: true })
      .eq(workspaceColumn, workspaceId);

    if (error) {
      return {
        table: tableName,
        ok: false,
        count: null,
        error: error.message,
      };
    }

    return {
      table: tableName,
      ok: true,
      count: count ?? 0,
      error: null,
    };
  } catch (error) {
    return {
      table: tableName,
      ok: false,
      count: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function safeLatest(
  serviceClient: any,
  tableName: string,
  workspaceId: string,
  columns: string,
  workspaceColumn = "workspace_id",
) {
  try {
    const { data, error } = await serviceClient
      .from(tableName)
      .select(columns)
      .eq(workspaceColumn, workspaceId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (error) {
      return {
        table: tableName,
        ok: false,
        data: null,
        error: error.message,
      };
    }

    return {
      table: tableName,
      ok: true,
      data,
      error: null,
    };
  } catch (error) {
    return {
      table: tableName,
      ok: false,
      data: null,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function buildBackendSnapshot(params: {
  serviceClient: any;
  workspaceId: string;
}) {
  const { serviceClient, workspaceId } = params;

  const tableCounts = await Promise.all([
    safeCount(serviceClient, "workspaces", workspaceId, "id"),
    safeCount(serviceClient, "workspace_members", workspaceId),
    safeCount(serviceClient, "source_connections", workspaceId),
    safeCount(serviceClient, "oauth_connections", workspaceId),
    safeCount(serviceClient, "google_sheet_sources", workspaceId),
    safeCount(serviceClient, "google_sheet_tabs", workspaceId),
    safeCount(serviceClient, "sync_jobs", workspaceId),
    safeCount(serviceClient, "sync_run_logs", workspaceId),
    safeCount(serviceClient, "import_staging_rows", workspaceId),
    safeCount(serviceClient, "ad_traffic_raw", workspaceId),
    safeCount(serviceClient, "registrations_raw", workspaceId),
    safeCount(serviceClient, "applications_raw", workspaceId),
    safeCount(serviceClient, "bookings_raw", workspaceId),
    safeCount(serviceClient, "questionnaires_raw", workspaceId),
    safeCount(serviceClient, "raw_sales", workspaceId),
    safeCount(serviceClient, "viewers_webstars_raw", workspaceId),
    safeCount(serviceClient, "viewers_vebi_raw", workspaceId),
    safeCount(serviceClient, "backup_runs", workspaceId),
    safeCount(serviceClient, "backup_files", workspaceId),
    safeCount(serviceClient, "audit_logs", workspaceId),
  ]);

  const latestSync = await safeLatest(
    serviceClient,
    "sync_run_logs",
    workspaceId,
    "id, status, rows_received, rows_inserted, rows_failed, created_at",
  );

  const latestBackup = await safeLatest(
    serviceClient,
    "backup_runs",
    workspaceId,
    "id, status, tables_requested, tables_exported, files_count, rows_exported, created_at",
  );

  const latestAudit = await safeLatest(
    serviceClient,
    "audit_logs",
    workspaceId,
    "id, action, actor_role, severity, created_at",
  );

  const failedChecks = tableCounts.filter((item: any) => !item.ok);

  const criticalTables = [
    "workspaces",
    "workspace_members",
    "google_sheet_sources",
    "sync_run_logs",
    "import_staging_rows",
    "backup_runs",
    "audit_logs",
  ];

  const criticalFailures = failedChecks.filter((item: any) =>
    criticalTables.includes(item.table),
  );

  return {
    workspace_id: workspaceId,
    snapshot_type: "backend_snapshot",
    generated_at: new Date().toISOString(),

    production_security: {
      jwt_supported: true,
      backend_test_mode: Deno.env.get("BACKEND_TEST_MODE") ?? "disabled",
      required_role: "superadmin",
      service_role_used_only_server_side: true,
      audit_logging_enabled: true,
    },

    readiness: {
      can_connect_future_frontend: true,
      backend_only_testable: true,
      fully_ready_for_production:
        criticalFailures.length === 0 && failedChecks.length === 0,
      critical_blockers: criticalFailures.length,
      warning_blockers: failedChecks.length - criticalFailures.length,
      data_validation_passed: criticalFailures.length === 0,
      failed_checks: failedChecks.length,
    },

    latest_sync: latestSync,
    latest_backup: latestBackup,
    latest_audit: latestAudit,

    table_counts: tableCounts,
    failed_checks: failedChecks,
  };
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

  const workspaceId = body.workspace_id;
  const action = normalizeAction(body.action);

  if (!workspaceId) {
    return jsonResponse(400, {
      ok: false,
      error: "workspace_id is required.",
    });
  }

  if (!action) {
    return jsonResponse(400, {
      ok: false,
      error: "Invalid or missing action.",
      allowed_actions: [
        "debug_backend_test",
        "permission_check",
        "backend_snapshot",
      ],
    });
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
  const supabaseServiceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const authHeader = req.headers.get("Authorization");

  const userClient = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader
        ? {
            Authorization: authHeader,
          }
        : {},
    },
  });

  const serviceClient = createClient(supabaseUrl, supabaseServiceRoleKey);

  if (action === "debug_backend_test") {
    const debugResult = await buildBackendTestDebug({
      req,
      body,
      workspaceId,
      serviceClient,
    });

    return jsonResponse(200, debugResult);
  }

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
      action: "run_dev_action_permission_check_failed",
      severity: "error",
      metadata: {
        edge_function: "run-dev-action",
        requested_action: action,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return jsonResponse(500, {
      ok: false,
      error: "Permission check failed.",
      details: error instanceof Error ? error.message : String(error),
    });
  }

  if (!actor.can_run_dev_action || actor.role !== "superadmin") {
    await writeAuditLog({
      serviceClient,
      workspaceId,
      actorUserId: actor.user_id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "run_dev_action_denied",
      severity: "warning",
      metadata: {
        edge_function: "run-dev-action",
        requested_action: action,
        mode: actor.mode,
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

  await writeAuditLog({
    serviceClient,
    workspaceId,
    actorUserId: actor.user_id,
    actorEmail: actor.email,
    actorRole: actor.role,
    action: "run_dev_action_started",
    severity: "info",
    metadata: {
      edge_function: "run-dev-action",
      requested_action: action,
      mode: actor.mode,
      request_metadata: body.metadata ?? {},
    },
  });

  try {
    if (action === "permission_check") {
      await writeAuditLog({
        serviceClient,
        workspaceId,
        actorUserId: actor.user_id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "run_dev_action_permission_check_success",
        severity: "info",
        metadata: {
          edge_function: "run-dev-action",
          mode: actor.mode,
        },
      });

      return jsonResponse(200, {
        ok: true,
        action,
        workspace_id: workspaceId,
        mode: actor.mode,
        actor: {
          user_id: actor.user_id,
          email: actor.email,
          role: actor.role,
          can_run_dev_action: actor.can_run_dev_action,
        },
      });
    }

    if (action === "backend_snapshot") {
      const snapshot = await buildBackendSnapshot({
        serviceClient,
        workspaceId,
      });

      await writeAuditLog({
        serviceClient,
        workspaceId,
        actorUserId: actor.user_id,
        actorEmail: actor.email,
        actorRole: actor.role,
        action: "run_dev_action_backend_snapshot_success",
        severity: "info",
        metadata: {
          edge_function: "run-dev-action",
          mode: actor.mode,
          readiness: snapshot.readiness,
        },
      });

      return jsonResponse(200, {
        ok: true,
        action,
        workspace_id: workspaceId,
        mode: actor.mode,
        actor: {
          user_id: actor.user_id,
          email: actor.email,
          role: actor.role,
        },
        result: snapshot,
      });
    }

    return jsonResponse(400, {
      ok: false,
      error: "Unsupported action.",
    });
  } catch (error) {
    await writeAuditLog({
      serviceClient,
      workspaceId,
      actorUserId: actor.user_id,
      actorEmail: actor.email,
      actorRole: actor.role,
      action: "run_dev_action_failed",
      severity: "error",
      metadata: {
        edge_function: "run-dev-action",
        requested_action: action,
        mode: actor.mode,
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return jsonResponse(500, {
      ok: false,
      error: "run-dev-action failed.",
      details: error instanceof Error ? error.message : String(error),
    });
  }
});
