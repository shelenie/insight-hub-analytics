import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  workspace_id?: string;
  return_url?: string;

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

const FUNCTION_NAME = "google-oauth-start";

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

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const googleClientId = requiredEnv("GOOGLE_CLIENT_ID");
  const googleRedirectUri = requiredEnv("GOOGLE_REDIRECT_URI");

  const authHeader = req.headers.get("Authorization");

  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
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
      action: "google_oauth_start_permission_check_failed",
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
      action: "google_oauth_start_denied",
      severity: "warning",
      metadata: {
        reason: actor.reason,
        return_url: body.return_url ?? null,
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

  const scopes = [
    "openid",
    "email",
    "profile",
    "https://www.googleapis.com/auth/spreadsheets.readonly",
    "https://www.googleapis.com/auth/drive.metadata.readonly",
  ];

  await writeAuditLog({
    supabaseAdmin,
    workspaceId,
    actor,
    action: "google_oauth_start_started",
    severity: "info",
    metadata: {
      return_url: body.return_url ?? null,
      scopes,
      request_metadata: body.metadata ?? {},
    },
  });

  if (actor.mode === "backend_test") {
    const testAuthorizationUrl = new URL("https://accounts.google.com/o/oauth2/v2/auth");

    testAuthorizationUrl.searchParams.set("client_id", googleClientId);
    testAuthorizationUrl.searchParams.set("redirect_uri", googleRedirectUri);
    testAuthorizationUrl.searchParams.set("response_type", "code");
    testAuthorizationUrl.searchParams.set("scope", scopes.join(" "));
    testAuthorizationUrl.searchParams.set("state", "backend_test_state_not_for_real_oauth");
    testAuthorizationUrl.searchParams.set("access_type", "offline");
    testAuthorizationUrl.searchParams.set("prompt", "consent");
    testAuthorizationUrl.searchParams.set("include_granted_scopes", "true");

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "google_oauth_start_backend_test_success",
      severity: "info",
      metadata: {
        backend_test_only: true,
        authorization_url_created: true,
        real_oauth_state_created: false,
      },
    });

    return jsonResponse(200, {
      ok: true,
      function: FUNCTION_NAME,
      mode: actor.mode,
      backend_test_only: true,
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: actor.role,
      },
      workspace_id: workspaceId,
      authorization_url: testAuthorizationUrl.toString(),
      note: "Backend test only. This URL is not for real OAuth because no real oauth_state row was created.",
    });
  }

  try {
    const { data: userData, error: userError } = await supabaseAnon.auth.getUser();

    if (userError || !userData?.user) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_oauth_start_failed",
        severity: "error",
        metadata: {
          step: "read_authenticated_user",
          error: userError?.message ?? "user_not_found",
        },
      });

      return jsonResponse(401, {
        ok: false,
        error: "Could not read authenticated user",
        details: userError?.message ?? null,
      });
    }

    const { data: stateToken, error: stateError } = await supabaseAnon.rpc(
      "create_oauth_state",
      {
        p_workspace_id: workspaceId,
        p_provider: "google",
        p_redirect_uri: googleRedirectUri,
        p_scopes: scopes,
        p_metadata: {
          source: FUNCTION_NAME,
          return_url: body.return_url ?? null,
          user_email: userData.user.email ?? null,
        },
      }
    );

    if (stateError || !stateToken) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "google_oauth_start_failed",
        severity: "error",
        metadata: {
          step: "create_oauth_state",
          error: stateError?.message ?? "state_token_missing",
        },
      });

      return jsonResponse(500, {
        ok: false,
        error: "Could not create OAuth state",
        details: stateError?.message ?? null,
      });
    }

    const params = new URLSearchParams({
      client_id: googleClientId,
      redirect_uri: googleRedirectUri,
      response_type: "code",
      scope: scopes.join(" "),
      state: stateToken,
      access_type: "offline",
      prompt: "consent",
      include_granted_scopes: "true",
    });

    const authorizationUrl =
      `https://accounts.google.com/o/oauth2/v2/auth?${params.toString()}`;

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "google_oauth_start_success",
      severity: "info",
      metadata: {
        real_oauth_state_created: true,
        authorization_url_created: true,
        return_url: body.return_url ?? null,
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
      user: {
        id: userData.user.id,
        email: userData.user.email,
      },
      workspace_id: workspaceId,
      authorization_url: authorizationUrl,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "google_oauth_start_failed",
      severity: "error",
      metadata: {
        step: "unhandled_error",
        error: message,
      },
    });

    return jsonResponse(500, {
      ok: false,
      error: "google-oauth-start failed.",
      details: message,
    });
  }
});
