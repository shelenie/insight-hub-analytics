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

const FUNCTION_NAME = "tiktok-oauth-start";

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

function optionalEnv(name: string, fallback: string): string {
  return Deno.env.get(name) ?? fallback;
}

function getTikTokAppId(actorMode: ActorContext["mode"]): string {
  const appId =
    Deno.env.get("TIKTOK_APP_ID") ??
    Deno.env.get("TIKTOK_CLIENT_KEY");

  if (appId) return appId;

  if (actorMode === "backend_test") {
    return "backend_test_tiktok_app_id";
  }

  throw new Error("Missing required env: TIKTOK_APP_ID or TIKTOK_CLIENT_KEY");
}

function getTikTokRedirectUri(supabaseUrl: string): string {
  return optionalEnv(
    "TIKTOK_REDIRECT_URI",
    `${supabaseUrl}/functions/v1/tiktok-oauth-callback`,
  );
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

  if (error) console.error("Audit log write failed:", error);
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

    if (!expectedBackendTestSecret || providedBackendTestSecret !== expectedBackendTestSecret) {
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
      },
    );

    if (error) throw new Error(`Access checker failed: ${error.message}`);

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
      },
    );

    if (error) throw new Error(`Access checker failed: ${error.message}`);

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

  if (!workspaceId) {
    return jsonResponse(400, {
      ok: false,
      error: "workspace_id is required.",
    });
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

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
      action: "tiktok_oauth_start_permission_check_failed",
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
      action: "tiktok_oauth_start_denied",
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

  const tiktokAppId = getTikTokAppId(actor.mode);
  const tiktokRedirectUri = getTikTokRedirectUri(supabaseUrl);
  const tiktokApiVersion = optionalEnv("TIKTOK_API_VERSION", "v1.3");

  const scopes = [
    "advertiser.read",
    "campaign.read",
    "adgroup.read",
    "ad.read",
    "report.read",
  ];

  let stateToken = "backend_test_state_not_for_real_tiktok_oauth";

  await writeAuditLog({
    supabaseAdmin,
    workspaceId,
    actor,
    action: "tiktok_oauth_start_started",
    severity: "info",
    metadata: {
      backend_test_only: actor.mode === "backend_test",
      return_url: body.return_url ?? null,
      api_version: tiktokApiVersion,
      scopes,
      request_metadata: body.metadata ?? {},
    },
  });

  if (actor.mode !== "backend_test") {
    const { data, error } = await supabaseAdmin.rpc("create_ad_oauth_state", {
      p_workspace_id: workspaceId,
      p_platform: "tiktok_ads",
      p_redirect_uri: tiktokRedirectUri,
      p_scopes: scopes,
      p_actor_user_id: actor.user_id,
      p_actor_email: actor.email,
      p_actor_role: actor.role,
      p_metadata: {
        source: FUNCTION_NAME,
        return_url: body.return_url ?? null,
        api_version: tiktokApiVersion,
      },
    });

    if (error || !data) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "tiktok_oauth_start_failed",
        severity: "error",
        metadata: {
          step: "create_ad_oauth_state",
          error: error?.message ?? "state_token_missing",
        },
      });

      return jsonResponse(500, {
        ok: false,
        error: "Could not create TikTok OAuth state.",
        details: error?.message ?? null,
      });
    }

    stateToken = data;
  }

  const authorizationUrl = new URL("https://business-api.tiktok.com/portal/auth");

  authorizationUrl.searchParams.set("app_id", tiktokAppId);
  authorizationUrl.searchParams.set("state", stateToken);
  authorizationUrl.searchParams.set("redirect_uri", tiktokRedirectUri);

  await writeAuditLog({
    supabaseAdmin,
    workspaceId,
    actor,
    action:
      actor.mode === "backend_test"
        ? "tiktok_oauth_start_backend_test_success"
        : "tiktok_oauth_start_success",
    severity: "info",
    metadata: {
      backend_test_only: actor.mode === "backend_test",
      real_oauth_state_created: actor.mode !== "backend_test",
      authorization_url_created: true,
      return_url: body.return_url ?? null,
      api_version: tiktokApiVersion,
      scopes,
    },
  });

  return jsonResponse(200, {
    ok: true,
    function: FUNCTION_NAME,
    mode: actor.mode,
    backend_test_only: actor.mode === "backend_test",
    actor: {
      user_id: actor.user_id,
      email: actor.email,
      role: actor.role,
    },
    workspace_id: workspaceId,
    platform: "tiktok_ads",
    api_version: tiktokApiVersion,
    scopes,
    authorization_url: authorizationUrl.toString(),
    note:
      actor.mode === "backend_test"
        ? "Backend test only. This URL is not for real OAuth because no real oauth_state row was created."
        : "Open this URL to connect TikTok Ads.",
  });
});
