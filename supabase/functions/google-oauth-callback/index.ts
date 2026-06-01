import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_NAME = "google-oauth-callback";
const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

const htmlHeaders = {
  "Content-Type": "text/html; charset=utf-8",
};

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
      headers: htmlHeaders,
    },
  );
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

async function writeAuditLog(params: {
  supabaseAdmin: any;
  workspaceId: string;
  action: string;
  severity?: "info" | "warning" | "error";
  actorUserId?: string | null;
  actorRole?: string | null;
  metadata?: Record<string, unknown>;
}) {
  const { error } = await params.supabaseAdmin.from("audit_logs").insert({
    workspace_id: params.workspaceId,
    actor_user_id: params.actorUserId ?? null,
    actor_role: params.actorRole ?? null,
    action: params.action,
    entity_type: "edge_function",
    entity_id: FUNCTION_NAME,
    severity: params.severity ?? "info",
    metadata: params.metadata ?? {},
  });

  if (error) {
    console.error("Audit log write failed:", error);
  }
}

function safeErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
}

Deno.serve(async (req) => {
  let supabaseAdmin: any = null;

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
    const googleClientId = requiredEnv("GOOGLE_CLIENT_ID");
    const googleClientSecret = requiredEnv("GOOGLE_CLIENT_SECRET");
    const googleRedirectUri = requiredEnv("GOOGLE_REDIRECT_URI");

    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (req.method !== "GET") {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_oauth_callback_rejected",
        severity: "warning",
        metadata: {
          reason: "method_not_allowed",
          method: req.method,
        },
      });

      return htmlResponse(
        "Google OAuth callback error",
        "This callback only accepts Google OAuth redirect requests.",
        405,
      );
    }

    const url = new URL(req.url);
    const state = url.searchParams.get("state");
    const code = url.searchParams.get("code");
    const googleError = url.searchParams.get("error");

    if (googleError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_oauth_callback_cancelled",
        severity: "warning",
        metadata: {
          google_error: googleError,
          has_state: Boolean(state),
        },
      });

      return htmlResponse(
        "Google OAuth cancelled",
        `Google returned an error: <code>${escapeHtml(googleError)}</code>`,
        400,
      );
    }

    if (!state || !code) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_oauth_callback_rejected",
        severity: "warning",
        metadata: {
          reason: "missing_state_or_code",
          has_state: Boolean(state),
          has_code: Boolean(code),
        },
      });

      return htmlResponse(
        "Google OAuth callback error",
        "Missing required OAuth state or authorization code.",
        400,
      );
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: WORKSPACE_ID,
      action: "google_oauth_callback_started",
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
        client_id: googleClientId,
        client_secret: googleClientSecret,
        redirect_uri: googleRedirectUri,
        grant_type: "authorization_code",
      }),
    });

    const tokenData = await tokenResponse.json();

    if (!tokenResponse.ok) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "google_token_exchange",
          status: tokenResponse.status,
          error: tokenData?.error ?? null,
          error_description: tokenData?.error_description ?? null,
        },
      });

      return htmlResponse(
        "Google token exchange failed",
        "Google could not complete the token exchange. Please try connecting Google again.",
        400,
      );
    }

    const accessToken = tokenData.access_token;
    const refreshToken = tokenData.refresh_token;

    if (!accessToken) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "missing_access_token",
        },
      });

      return htmlResponse(
        "Google OAuth error",
        "Google did not return an access token.",
        400,
      );
    }

    if (!refreshToken) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "missing_refresh_token",
        },
      });

      return htmlResponse(
        "Google OAuth refresh token missing",
        "Google did not return a refresh token. Reconnect Google with consent prompt or revoke previous access and try again.",
        400,
      );
    }

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
        action: "google_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "google_userinfo",
          status: userInfoResponse.status,
          error: userInfo?.error ?? null,
        },
      });

      return htmlResponse(
        "Google user info failed",
        "Could not read Google user profile. Please try connecting Google again.",
        400,
      );
    }

    const providerAccountEmail = userInfo.email ?? null;
    const providerAccountId = userInfo.sub ?? providerAccountEmail ?? null;

    const scopes = String(tokenData.scope ?? "")
      .split(" ")
      .map((s) => s.trim())
      .filter(Boolean);

    const { data: connectionResult, error: connectionError } =
      await supabaseAdmin.rpc("complete_google_oauth_connection", {
        p_state_token: state,
        p_provider_account_email: providerAccountEmail,
        p_provider_account_id: providerAccountId,
        p_scopes: scopes,
        p_refresh_token: refreshToken,
        p_token_metadata: {
          token_type: tokenData.token_type ?? null,
          expires_in: tokenData.expires_in ?? null,
          scope: tokenData.scope ?? null,
          google_user: {
            email: providerAccountEmail,
            id: providerAccountId,
            name: userInfo.name ?? null,
            picture: userInfo.picture ?? null,
          },
        },
      });

    if (connectionError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "complete_google_oauth_connection",
          provider_account_email: providerAccountEmail,
          error: connectionError.message,
          hint: connectionError.hint ?? null,
          code: connectionError.code ?? null,
        },
      });

      return htmlResponse(
        "Could not save Google connection",
        "Database could not save the Google connection. Please try again.",
        500,
      );
    }

    const result = Array.isArray(connectionResult)
      ? connectionResult[0]
      : connectionResult;

    const sourceConnectionId = result?.source_connection_id ?? null;
    const oauthConnectionId = result?.oauth_connection_id ?? null;
    const resultWorkspaceId = result?.workspace_id ?? WORKSPACE_ID;

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: resultWorkspaceId,
      action: "google_oauth_callback_success",
      severity: "info",
      metadata: {
        provider_account_email: providerAccountEmail,
        provider_account_id: providerAccountId,
        source_connection_id: sourceConnectionId,
        oauth_connection_id: oauthConnectionId,
        scopes,
      },
    });

    return htmlResponse(
      "Google Sheets connected",
      `Google account <strong>${escapeHtml(providerAccountEmail ?? "connected")}</strong> was connected successfully.<br><br>
      You can close this tab and return to the dashboard.<br><br>
      Source connection ID: <code>${escapeHtml(sourceConnectionId ?? "unknown")}</code>`,
      200,
    );
  } catch (error) {
    const message = safeErrorText(error);

    if (supabaseAdmin) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "google_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "unhandled_error",
          error: message,
        },
      });
    }

    return htmlResponse(
      "Google OAuth callback error",
      "Unexpected callback error. Please try again.",
      500,
    );
  }
});
