import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ExpectedTab = {
  source_type: string;
  target_raw_table: string;
  processor_function: string;
};

type RequestBody = {
  workspace_id?: string;
  spreadsheet_id?: string;
  spreadsheet_url?: string;

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

const FUNCTION_NAME = "google-sheet-register";

const EXPECTED_TABS: Record<string, ExpectedTab> = {
  "Трафик": {
    source_type: "traffic",
    target_raw_table: "ad_traffic_raw",
    processor_function: "process_ad_traffic_rows",
  },
  "Трафик - БД": {
    source_type: "traffic",
    target_raw_table: "ad_traffic_raw",
    processor_function: "process_ad_traffic_rows",
  },

  "Реги АВ": {
    source_type: "registrations",
    target_raw_table: "registrations_raw",
    processor_function: "process_registrations_rows",
  },
  "Реги АВ - БД": {
    source_type: "registrations",
    target_raw_table: "registrations_raw",
    processor_function: "process_registrations_rows",
  },

  "Заявки": {
    source_type: "applications",
    target_raw_table: "applications_raw",
    processor_function: "process_applications_rows",
  },
  "Заявки - БД": {
    source_type: "applications",
    target_raw_table: "applications_raw",
    processor_function: "process_applications_rows",
  },

  "Брони": {
    source_type: "bookings",
    target_raw_table: "bookings_raw",
    processor_function: "process_bookings_rows",
  },
  "Брони - БД": {
    source_type: "bookings",
    target_raw_table: "bookings_raw",
    processor_function: "process_bookings_rows",
  },

  "Анкеты": {
    source_type: "questionnaires",
    target_raw_table: "questionnaires_raw",
    processor_function: "process_questionnaires_rows",
  },
  "Анкеты - БД": {
    source_type: "questionnaires",
    target_raw_table: "questionnaires_raw",
    processor_function: "process_questionnaires_rows",
  },

  "Продажи": {
    source_type: "sales",
    target_raw_table: "raw_sales",
    processor_function: "process_sales_rows",
  },
  "Продажи - БД": {
    source_type: "sales",
    target_raw_table: "raw_sales",
    processor_function: "process_sales_rows",
  },

  "Зрители Вебстарс": {
    source_type: "viewers_webstars",
    target_raw_table: "viewers_webstars_raw",
    processor_function: "process_viewers_webstars_rows",
  },
  "Зрители - Вебстарс": {
    source_type: "viewers_webstars",
    target_raw_table: "viewers_webstars_raw",
    processor_function: "process_viewers_webstars_rows",
  },

  "Зрители ВЕБИ": {
    source_type: "viewers_vebi",
    target_raw_table: "viewers_vebi_raw",
    processor_function: "process_viewers_vebi_rows",
  },
  "Зрители - ВЕБИ": {
    source_type: "viewers_vebi",
    target_raw_table: "viewers_vebi_raw",
    processor_function: "process_viewers_vebi_rows",
  },
};

const EXPECTED_SOURCE_TYPES = [
  "traffic",
  "registrations",
  "applications",
  "bookings",
  "questionnaires",
  "sales",
  "viewers_webstars",
  "viewers_vebi",
];

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

function getExpectedSourceTypesFromMatchedTabs(matchedTabs: string[]) {
  return [
    ...new Set(
      matchedTabs
        .map((tabName) => EXPECTED_TABS[tabName]?.source_type)
        .filter(Boolean)
    ),
  ];
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
  const spreadsheetId = body.spreadsheet_id;

  if (!workspaceId) {
    return jsonResponse(400, {
      ok: false,
      error: "workspace_id is required",
    });
  }

  if (!spreadsheetId) {
    return jsonResponse(400, {
      ok: false,
      error: "spreadsheet_id is required",
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
      action: "google_sheet_register_permission_check_failed",
      severity: "error",
      metadata: {
        spreadsheet_id: spreadsheetId,
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
      action: "google_sheet_register_denied",
      severity: "warning",
      metadata: {
        reason: actor.reason,
        spreadsheet_id: spreadsheetId,
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

  await writeAuditLog({
    supabaseAdmin,
    workspaceId,
    actor,
    action: "google_sheet_register_started",
    severity: "info",
    metadata: {
      spreadsheet_id: spreadsheetId,
      spreadsheet_url: body.spreadsheet_url ?? null,
      request_metadata: body.metadata ?? {},
    },
  });

  try {
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
        action: "google_sheet_register_failed",
        severity: "error",
        metadata: {
          step: "get_active_google_oauth_connection_for_workspace",
          spreadsheet_id: spreadsheetId,
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
        action: "google_sheet_register_failed",
        severity: "error",
        metadata: {
          step: "active_google_oauth_connection_not_found",
          spreadsheet_id: spreadsheetId,
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
        action: "google_sheet_register_failed",
        severity: "error",
        metadata: {
          step: "get_google_oauth_secret_payload",
          vault_secret_name: oauthConnection.vault_secret_name,
          spreadsheet_id: spreadsheetId,
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
        action: "google_sheet_register_failed",
        severity: "error",
        metadata: {
          step: "refresh_token_not_found",
          spreadsheet_id: spreadsheetId,
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
        action: "google_sheet_register_failed",
        severity: "error",
        metadata: {
          step: "refresh_google_access_token",
          spreadsheet_id: spreadsheetId,
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

    const spreadsheetResponse = await fetch(
      `https://sheets.googleapis.com/v4/spreadsheets/${spreadsheetId}?fields=spreadsheetId,properties.title,sheets.properties.title`,
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      }
    );

    const spreadsheetData = await spreadsheetResponse.json();

    if (!spreadsheetResponse.ok) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheet_register_failed",
        severity: "error",
        metadata: {
          step: "read_google_sheet_metadata",
          spreadsheet_id: spreadsheetId,
          details: spreadsheetData,
        },
      });

      return jsonResponse(400, {
        ok: false,
        error: "Could not read Google Sheet metadata",
        details: spreadsheetData,
      });
    }

    const spreadsheetName = spreadsheetData?.properties?.title ?? "Google Sheet";

    const actualTabs: string[] = Array.isArray(spreadsheetData.sheets)
      ? spreadsheetData.sheets
          .map((sheet: any) => sheet?.properties?.title)
          .filter(Boolean)
      : [];

    const matchedTabs = actualTabs.filter((tab) => EXPECTED_TABS[tab]);

    const matchedSourceTypes = getExpectedSourceTypesFromMatchedTabs(matchedTabs);

    const missingExpectedSourceTypes = EXPECTED_SOURCE_TYPES.filter(
      (sourceType) => !matchedSourceTypes.includes(sourceType)
    );

    const ignoredTabs = actualTabs.filter((tab) => !EXPECTED_TABS[tab]);

    const tabConfigs = matchedTabs.map((tabName) => {
      const mapping = EXPECTED_TABS[tabName];

      return {
        tab_name: tabName,
        header_row: 1,
        source_type: mapping.source_type,
        target_raw_table: mapping.target_raw_table,
        processor_function: mapping.processor_function,
      };
    });

    const { data: registerRows, error: registerError } = await supabaseAdmin.rpc(
      "register_google_sheet_config",
      {
        p_workspace_id: workspaceId,
        p_source_connection_id: oauthConnection.source_connection_id,
        p_oauth_connection_id: oauthConnection.id,
        p_spreadsheet_id: spreadsheetId,
        p_spreadsheet_name: spreadsheetName,
        p_spreadsheet_url:
          body.spreadsheet_url ??
          `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
        p_actual_tabs: actualTabs,
        p_matched_tabs: matchedTabs,
        p_missing_expected_tabs: missingExpectedSourceTypes,
        p_ignored_tabs: ignoredTabs,
        p_tab_configs: tabConfigs,
      }
    );

    if (registerError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_sheet_register_failed",
        severity: "error",
        metadata: {
          step: "register_google_sheet_config",
          spreadsheet_id: spreadsheetId,
          spreadsheet_name: spreadsheetName,
          error: registerError.message,
          hint: registerError.hint ?? null,
          code: registerError.code ?? null,
        },
      });

      return jsonResponse(500, {
        ok: false,
        error: "Could not register Google Sheet config",
        details: registerError.message,
        hint: registerError.hint ?? null,
        code: registerError.code ?? null,
      });
    }

    const registerResult = registerRows?.[0] ?? null;

    const sourceId = registerResult?.google_sheet_source_id ?? null;

    if (sourceId) {
      await supabaseAdmin
        .from("google_sheet_tabs")
        .update({ source_id: sourceId })
        .eq("workspace_id", workspaceId)
        .is("source_id", null);
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "google_sheet_register_success",
      severity: "info",
      metadata: {
        spreadsheet_id: spreadsheetId,
        spreadsheet_name: spreadsheetName,
        google_sheet_source_id: sourceId,
        sync_job_id: registerResult?.sync_job_id ?? null,
        actual_tabs_count: actualTabs.length,
        matched_tabs_count: matchedTabs.length,
        registered_tabs_count: registerResult?.registered_tabs_count ?? 0,
        missing_expected_source_types: missingExpectedSourceTypes,
        ignored_tabs: ignoredTabs,
      },
    });

    return jsonResponse(200, {
      ok: true,
      function: FUNCTION_NAME,
      mode: actor.mode,
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: actor.role,
      },
      workspace_id: workspaceId,
      spreadsheet: {
        id: spreadsheetId,
        name: spreadsheetName,
        source_id: sourceId,
      },
      google_account: oauthConnection.provider_account_email,
      tabs: {
        actual_tabs: actualTabs,
        matched_tabs: matchedTabs,
        registered_tabs_count: registerResult?.registered_tabs_count ?? 0,
        missing_expected_source_types: missingExpectedSourceTypes,
        ignored_tabs: ignoredTabs,
      },
      sync_job_id: registerResult?.sync_job_id ?? null,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "google_sheet_register_failed",
      severity: "error",
      metadata: {
        step: "unhandled_error",
        spreadsheet_id: spreadsheetId,
        error: message,
      },
    });

    return jsonResponse(500, {
      ok: false,
      error: "google-sheet-register failed.",
      details: message,
    });
  }
});
