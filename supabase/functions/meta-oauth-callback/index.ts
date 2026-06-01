import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_NAME = "meta-oauth-callback";
const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function htmlResponse(title: string, message: string, status = 200) {
  return new Response(
    `<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>${escapeHtml(title)}</title>
    <style>
      body {
        font-family: system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
        padding: 40px;
        line-height: 1.5;
        background: #f8fafc;
        color: #111827;
      }
      .box {
        max-width: 720px;
        margin: 0 auto;
        border: 1px solid #e5e7eb;
        border-radius: 16px;
        padding: 24px;
        background: #ffffff;
      }
      h1 { margin-top: 0; }
      code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 6px;
      }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>${escapeHtml(title)}</h1>
      <p>${message}</p>
    </div>
  </body>
</html>`,
    {
      status,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
      },
    },
  );
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return Deno.env.get(name) ?? fallback;
}

async function writeAuditLog(params: {
  supabaseAdmin: any;
  workspaceId: string;
  action: string;
  severity?: "info" | "warning" | "error";
  metadata?: Record<string, unknown>;
}) {
  const { error } = await params.supabaseAdmin.from("audit_logs").insert({
    workspace_id: params.workspaceId,
    actor_user_id: null,
    actor_role: null,
    action: params.action,
    entity_type: "edge_function",
    entity_id: FUNCTION_NAME,
    severity: params.severity ?? "info",
    metadata: params.metadata ?? {},
  });

  if (error) console.error("Audit log write failed:", error);
}

function safeErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
}

async function graphGet(params: {
  apiVersion: string;
  path: string;
  accessToken: string;
  searchParams?: Record<string, string>;
}) {
  const url = new URL(`https://graph.facebook.com/${params.apiVersion}${params.path}`);

  url.searchParams.set("access_token", params.accessToken);

  for (const [key, value] of Object.entries(params.searchParams ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
  });

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

Deno.serve(async (req: Request) => {
  let supabaseAdmin: any = null;

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const metaAppId = requiredEnv("META_APP_ID");
    const metaAppSecret = requiredEnv("META_APP_SECRET");
    const metaRedirectUri = requiredEnv("META_REDIRECT_URI");
    const metaApiVersion = optionalEnv("META_API_VERSION", "v25.0");

    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (req.method !== "GET") {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "meta_oauth_callback_rejected",
        severity: "warning",
        metadata: {
          reason: "method_not_allowed",
          method: req.method,
        },
      });

      return htmlResponse(
        "Meta OAuth callback error",
        "This callback only accepts Meta OAuth redirect requests.",
        405,
      );
    }

    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const metaError = url.searchParams.get("error");
    const metaErrorReason = url.searchParams.get("error_reason");
    const metaErrorDescription = url.searchParams.get("error_description");

    if (metaError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "meta_oauth_callback_cancelled",
        severity: "warning",
        metadata: {
          meta_error: metaError,
          meta_error_reason: metaErrorReason,
          meta_error_description: metaErrorDescription,
          has_state: Boolean(state),
        },
      });

      return htmlResponse(
        "Meta OAuth cancelled",
        `Meta returned an error: <code>${escapeHtml(metaError)}</code>`,
        400,
      );
    }

    if (!state || !code) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "meta_oauth_callback_rejected",
        severity: "warning",
        metadata: {
          reason: "missing_state_or_code",
          has_state: Boolean(state),
          has_code: Boolean(code),
        },
      });

      return htmlResponse(
        "Meta OAuth callback error",
        "Missing required OAuth state or authorization code.",
        400,
      );
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: WORKSPACE_ID,
      action: "meta_oauth_callback_started",
      severity: "info",
      metadata: {
        has_state: true,
        has_code: true,
        api_version: metaApiVersion,
      },
    });

    const tokenUrl = new URL(
      `https://graph.facebook.com/${metaApiVersion}/oauth/access_token`,
    );

    tokenUrl.searchParams.set("client_id", metaAppId);
    tokenUrl.searchParams.set("redirect_uri", metaRedirectUri);
    tokenUrl.searchParams.set("client_secret", metaAppSecret);
    tokenUrl.searchParams.set("code", code);

    const tokenResponse = await fetch(tokenUrl.toString(), {
      method: "GET",
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "meta_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "meta_token_exchange",
          status: tokenResponse.status,
          error: tokenData?.error?.message ?? tokenData?.error ?? null,
          error_type: tokenData?.error?.type ?? null,
          error_code: tokenData?.error?.code ?? null,
        },
      });

      return htmlResponse(
        "Meta token exchange failed",
        "Meta could not complete the token exchange. Please try connecting Meta again.",
        400,
      );
    }

    const accessToken = tokenData.access_token;
    const expiresInSeconds = Number(tokenData.expires_in ?? 0);

    if (!accessToken) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "meta_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "missing_access_token",
        },
      });

      return htmlResponse(
        "Meta OAuth error",
        "Meta did not return an access token.",
        400,
      );
    }

    const tokenExpiresAt =
      expiresInSeconds > 0
        ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
        : null;

    const meResult = await graphGet({
      apiVersion: metaApiVersion,
      path: "/me",
      accessToken,
      searchParams: {
        fields: "id,name,email",
      },
    });

    if (!meResult.ok) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "meta_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "meta_read_me",
          status: meResult.status,
          error: meResult.data?.error?.message ?? null,
          error_code: meResult.data?.error?.code ?? null,
        },
      });

      return htmlResponse(
        "Meta profile read failed",
        "Could not read Meta profile. Please try connecting Meta again.",
        400,
      );
    }

    const businessesResult = await graphGet({
      apiVersion: metaApiVersion,
      path: "/me/businesses",
      accessToken,
      searchParams: {
        fields: "id,name",
        limit: "25",
      },
    });

    const firstBusiness = businessesResult.ok
      ? businessesResult.data?.data?.[0] ?? null
      : null;

    const providerAccountId = meResult.data?.id ?? null;
    const providerAccountEmail = meResult.data?.email ?? meResult.data?.name ?? providerAccountId;
    const providerBusinessId = firstBusiness?.id ?? null;
    const providerBusinessName = firstBusiness?.name ?? null;

    const scopes = String(tokenData.scope ?? "")
      .split(",")
      .flatMap((item) => item.split(" "))
      .map((item) => item.trim())
      .filter(Boolean);

    const { data: connectionRows, error: connectionError } =
      await supabaseAdmin.rpc("complete_meta_ads_oauth_connection", {
        p_state_token: state,
        p_provider_account_id: providerAccountId,
        p_provider_account_email: providerAccountEmail,
        p_provider_business_id: providerBusinessId,
        p_provider_business_name: providerBusinessName,
        p_scopes: scopes,
        p_access_token: accessToken,
        p_token_expires_at: tokenExpiresAt,
        p_token_metadata: {
          token_type: tokenData.token_type ?? null,
          expires_in: tokenData.expires_in ?? null,
          api_version: metaApiVersion,
          meta_user: {
            id: providerAccountId,
            email: meResult.data?.email ?? null,
            name: meResult.data?.name ?? null,
          },
          first_business: firstBusiness,
          businesses_read_ok: businessesResult.ok,
          businesses_error: businessesResult.ok
            ? null
            : businessesResult.data?.error?.message ?? null,
        },
      });

    if (connectionError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "meta_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "complete_meta_ads_oauth_connection",
          provider_account_email: providerAccountEmail,
          provider_business_id: providerBusinessId,
          error: connectionError.message,
          hint: connectionError.hint ?? null,
          code: connectionError.code ?? null,
        },
      });

      return htmlResponse(
        "Could not save Meta connection",
        "Database could not save the Meta connection. Please try again.",
        500,
      );
    }

    const connectionResult = Array.isArray(connectionRows)
      ? connectionRows[0]
      : connectionRows;

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: connectionResult?.workspace_id ?? WORKSPACE_ID,
      action: "meta_oauth_callback_success",
      severity: "info",
      metadata: {
        ad_platform_connection_id:
          connectionResult?.ad_platform_connection_id ?? null,
        provider_account_email: providerAccountEmail,
        provider_account_id: providerAccountId,
        provider_business_id: providerBusinessId,
        provider_business_name: providerBusinessName,
        vault_secret_name: connectionResult?.vault_secret_name ?? null,
        token_expires_at: tokenExpiresAt,
        scopes,
      },
    });

    return htmlResponse(
      "Meta Ads connected",
      `Meta account <strong>${escapeHtml(providerAccountEmail ?? "connected")}</strong> was connected successfully.<br><br>
      You can close this tab and return to the dashboard.<br><br>
      Ad platform connection ID: <code>${escapeHtml(
        connectionResult?.ad_platform_connection_id ?? "unknown",
      )}</code>`,
      200,
    );
  } catch (error) {
    const message = safeErrorText(error);

    if (supabaseAdmin) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "meta_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "unhandled_error",
          error: message,
        },
      });
    }

    return htmlResponse(
      "Meta OAuth callback error",
      "Unexpected callback error. Please try again.",
      500,
    );
  }
});
