import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_NAME = "google-ads-oauth-callback";
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

Deno.serve(async (req: Request) => {
  let supabaseAdmin: any = null;

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    const googleAdsClientId =
      Deno.env.get("GOOGLE_ADS_CLIENT_ID") ??
      Deno.env.get("GOOGLE_CLIENT_ID");

    const googleAdsClientSecret =
      Deno.env.get("GOOGLE_ADS_CLIENT_SECRET") ??
      Deno.env.get("GOOGLE_CLIENT_SECRET");

    if (!googleAdsClientId) {
      throw new Error("Missing required env: GOOGLE_ADS_CLIENT_ID or GOOGLE_CLIENT_ID");
    }

    if (!googleAdsClientSecret) {
      throw new Error("Missing required env: GOOGLE_ADS_CLIENT_SECRET or GOOGLE_CLIENT_SECRET");
    }

    const googleAdsRedirectUri = optionalEnv(
      "GOOGLE_ADS_REDIRECT_URI",
      `${supabaseUrl}/functions/v1/google-ads-oauth-callback`,
    );

    const googleAdsLoginCustomerId =
      Deno.env.get("GOOGLE_ADS_LOGIN_CUSTOMER_ID") ?? null;

    const googleAdsDeveloperToken =
      Deno.env.get("GOOGLE_ADS_DEVELOPER_TOKEN") ?? null;

    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (req.method !== "GET") {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_ads_oauth_callback_rejected",
        severity: "warning",
        metadata: {
          reason: "method_not_allowed",
          method: req.method,
        },
      });

      return htmlResponse(
        "Google Ads OAuth callback error",
        "This callback only accepts Google OAuth redirect requests.",
        405,
      );
    }

    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const googleError = url.searchParams.get("error");
    const googleErrorDescription = url.searchParams.get("error_description");

    if (googleError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_ads_oauth_callback_cancelled",
        severity: "warning",
        metadata: {
          google_error: googleError,
          google_error_description: googleErrorDescription,
          has_state: Boolean(state),
        },
      });

      return htmlResponse(
        "Google Ads OAuth cancelled",
        `Google returned an error: <code>${escapeHtml(googleError)}</code>`,
        400,
      );
    }

    if (!state || !code) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_ads_oauth_callback_rejected",
        severity: "warning",
        metadata: {
          reason: "missing_state_or_code",
          has_state: Boolean(state),
          has_code: Boolean(code),
        },
      });

      return htmlResponse(
        "Google Ads OAuth callback error",
        "Missing required OAuth state or authorization code.",
        400,
      );
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: WORKSPACE_ID,
      action: "google_ads_oauth_callback_started",
      severity: "info",
      metadata: {
        has_state: true,
        has_code: true,
      },
    });

    const tokenResponse = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        code,
        client_id: googleAdsClientId,
        client_secret: googleAdsClientSecret,
        redirect_uri: googleAdsRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_ads_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "google_token_exchange",
          status: tokenResponse.status,
          error: tokenData?.error ?? null,
          error_description: tokenData?.error_description ?? null,
        },
      });

      return htmlResponse(
        "Google Ads token exchange failed",
        "Google could not complete the token exchange. Please try connecting Google Ads again.",
        400,
      );
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;
    const expiresInSeconds = Number(tokenData.expires_in ?? 0);

    if (!accessToken) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_ads_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "missing_access_token",
        },
      });

      return htmlResponse(
        "Google Ads OAuth error",
        "Google did not return an access token.",
        400,
      );
    }

    if (!refreshToken) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_ads_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "missing_refresh_token",
        },
      });

      return htmlResponse(
        "Google Ads refresh token missing",
        "Google did not return a refresh token. Reconnect Google Ads with consent prompt or revoke previous access and try again.",
        400,
      );
    }

    const tokenExpiresAt =
      expiresInSeconds > 0
        ? new Date(Date.now() + expiresInSeconds * 1000).toISOString()
        : null;

    const userInfoResponse = await fetch(
      "https://openidconnect.googleapis.com/v1/userinfo",
      {
        headers: {
          Authorization: `Bearer ${accessToken}`,
        },
      },
    );

    const userInfo = await userInfoResponse.json();

    if (!userInfoResponse.ok) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_ads_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "google_userinfo",
          status: userInfoResponse.status,
          error: userInfo?.error ?? null,
        },
      });

      return htmlResponse(
        "Google user info failed",
        "Could not read Google user profile. Please try connecting Google Ads again.",
        400,
      );
    }

    const providerAccountId = userInfo.sub ?? null;
    const providerAccountEmail = userInfo.email ?? providerAccountId;

    const scopes = String(tokenData.scope ?? "")
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean);

    const { data: connectionRows, error: connectionError } =
      await supabaseAdmin.rpc("complete_google_ads_oauth_connection", {
        p_state_token: state,
        p_provider_account_id: providerAccountId,
        p_provider_account_email: providerAccountEmail,
        p_manager_customer_id: googleAdsLoginCustomerId,
        p_login_customer_id: googleAdsLoginCustomerId,
        p_scopes: scopes,
        p_access_token: accessToken,
        p_refresh_token: refreshToken,
        p_token_expires_at: tokenExpiresAt,
        p_token_metadata: {
          token_type: tokenData.token_type ?? null,
          expires_in: tokenData.expires_in ?? null,
          scope: tokenData.scope ?? null,
          google_user: {
            id: providerAccountId,
            email: userInfo.email ?? null,
            name: userInfo.name ?? null,
            picture: userInfo.picture ?? null,
          },
          google_ads: {
            login_customer_id: googleAdsLoginCustomerId,
            developer_token_configured: Boolean(googleAdsDeveloperToken),
          },
        },
      });

    if (connectionError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_ads_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "complete_google_ads_oauth_connection",
          provider_account_email: providerAccountEmail,
          error: connectionError.message,
          hint: connectionError.hint ?? null,
          code: connectionError.code ?? null,
        },
      });

      return htmlResponse(
        "Could not save Google Ads connection",
        "Database could not save the Google Ads connection. Please try again.",
        500,
      );
    }

    const connectionResult = Array.isArray(connectionRows)
      ? connectionRows[0]
      : connectionRows;

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: connectionResult?.workspace_id ?? WORKSPACE_ID,
      action: "google_ads_oauth_callback_success",
      severity: "info",
      metadata: {
        ad_platform_connection_id:
          connectionResult?.ad_platform_connection_id ?? null,
        provider_account_email: providerAccountEmail,
        provider_account_id: providerAccountId,
        manager_customer_id: connectionResult?.manager_customer_id ?? googleAdsLoginCustomerId,
        login_customer_id: connectionResult?.login_customer_id ?? googleAdsLoginCustomerId,
        vault_secret_name: connectionResult?.vault_secret_name ?? null,
        token_expires_at: tokenExpiresAt,
        developer_token_configured: Boolean(googleAdsDeveloperToken),
        scopes,
      },
    });

    return htmlResponse(
      "Google Ads connected",
      `Google account <strong>${escapeHtml(providerAccountEmail ?? "connected")}</strong> was connected for Google Ads.<br><br>
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
        action: "google_ads_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "unhandled_error",
          error: message,
        },
      });
    }

    return htmlResponse(
      "Google Ads OAuth callback error",
      "Unexpected callback error. Please try again.",
      500,
    );
  }
});
