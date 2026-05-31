import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const FUNCTION_NAME = "tiktok-oauth-callback";
const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const APP_URL = "https://shelenie.github.io/insight-hub-analytics";

type JsonRecord = Record<string, unknown>;
type AuditSeverity = "info" | "warning" | "error";

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
    <meta name="viewport" content="width=device-width, initial-scale=1" />
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
        box-shadow: 0 18px 45px rgba(15, 23, 42, 0.08);
      }
      h1 { margin-top: 0; }
      code {
        background: #f3f4f6;
        padding: 2px 6px;
        border-radius: 6px;
      }
      .actions { margin-top: 24px; }
      .button {
        display: inline-block;
        border-radius: 999px;
        background: #111827;
        color: #ffffff;
        font-weight: 700;
        padding: 12px 18px;
        text-decoration: none;
      }
      .button:focus-visible {
        outline: 3px solid #94a3b8;
        outline-offset: 3px;
      }
    </style>
  </head>
  <body>
    <div class="box">
      <h1>${escapeHtml(title)}</h1>
      <p>${message}</p>
      <div class="actions">
        <a class="button" href="${APP_URL}">Return to Insight Hub</a>
      </div>
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

function getTikTokAppId(): string {
  const appId =
    Deno.env.get("TIKTOK_APP_ID") ??
    Deno.env.get("TIKTOK_CLIENT_KEY");

  if (!appId) {
    throw new Error("Missing required env: TIKTOK_APP_ID or TIKTOK_CLIENT_KEY");
  }

  return appId;
}

function getTikTokSecret(): string {
  const secret =
    Deno.env.get("TIKTOK_APP_SECRET") ??
    Deno.env.get("TIKTOK_CLIENT_SECRET");

  if (!secret) {
    throw new Error("Missing required env: TIKTOK_APP_SECRET or TIKTOK_CLIENT_SECRET");
  }

  return secret;
}

function getTikTokRedirectUri(supabaseUrl: string): string {
  return optionalEnv(
    "TIKTOK_REDIRECT_URI",
    `${supabaseUrl}/functions/v1/tiktok-oauth-callback`,
  );
}

function safeErrorText(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error ?? "Unknown error");
}

function asRecord(value: unknown): JsonRecord {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : {};
}

function optionalRecord(value: unknown): JsonRecord | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonRecord : null;
}

function hasValue(record: JsonRecord | null, key: string): boolean {
  return record?.[key] !== undefined && record[key] !== null;
}

function pickString(record: JsonRecord | null, keys: string[]): string | null {
  if (!record) return null;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function sanitizeTikTokTokenDiagnostics(raw: unknown) {
  const response = asRecord(raw);
  const data = optionalRecord(response.data);

  return {
    token_response_top_level_keys: Object.keys(response).sort(),
    token_response_data_keys: data ? Object.keys(data).sort() : [],
    has_access_token: hasValue(data, "access_token") || hasValue(response, "access_token"),
    has_refresh_token: hasValue(data, "refresh_token") || hasValue(response, "refresh_token"),
    has_expires_in: hasValue(data, "expires_in") || hasValue(response, "expires_in"),
    has_access_token_expire_in: hasValue(data, "access_token_expire_in") || hasValue(response, "access_token_expire_in"),
    has_refresh_token_expire_in: hasValue(data, "refresh_token_expire_in") || hasValue(response, "refresh_token_expire_in"),
    has_advertiser_ids: hasValue(data, "advertiser_ids") || hasValue(response, "advertiser_ids"),
    tiktok_code: typeof response.code === "string" || typeof response.code === "number" ? response.code : null,
    tiktok_message: pickString(response, ["message", "msg"]),
    tiktok_request_id: pickString(response, ["request_id", "log_id"]) ?? pickString(data, ["request_id", "log_id"]),
  };
}

function secondsToIso(secondsValue: unknown): string | null {
  const value = Number(secondsValue ?? 0);

  if (!Number.isFinite(value) || value <= 0) {
    return null;
  }

  // TikTok may return either seconds-until-expiry or unix timestamp seconds.
  if (value > 1_000_000_000) {
    return new Date(value * 1000).toISOString();
  }

  return new Date(Date.now() + value * 1000).toISOString();
}

function extractTokenData(raw: unknown) {
  const rawRecord = asRecord(raw);
  const data = optionalRecord(rawRecord.data) ?? rawRecord;

  return {
    code: rawRecord.code ?? 0,
    message: rawRecord.message ?? rawRecord.msg ?? null,
    accessToken: data.access_token ?? rawRecord.access_token ?? null,
    refreshToken: data.refresh_token ?? rawRecord.refresh_token ?? null,
    scope: data.scope ?? rawRecord.scope ?? null,
    advertiserIds: data.advertiser_ids ?? rawRecord.advertiser_ids ?? [],
    accessTokenExpiresAt: secondsToIso(
      data.access_token_expire_in ??
        data.expires_in ??
        rawRecord.access_token_expire_in ??
        rawRecord.expires_in,
    ),
    refreshTokenExpiresAt: secondsToIso(
      data.refresh_token_expire_in ??
        rawRecord.refresh_token_expire_in,
    ),
  };
}

function normalizeStringArray(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value
      .map((item) =>
        typeof item === "string" ? item.trim() : String(item ?? "").trim()
      )
      .filter(Boolean);
  }

  if (typeof value === "string" && value.trim()) {
    return value
      .split(/[\s,]+/)
      .map((item) => item.trim())
      .filter(Boolean);
  }

  return [];
}

function extractAdvertisers(raw: unknown) {
  const rawRecord = asRecord(raw);
  const data = optionalRecord(rawRecord.data) ?? rawRecord;
  const list =
    data.list ??
    data.advertiser_list ??
    data.advertisers ??
    rawRecord.list ??
    [];

  if (Array.isArray(list)) {
    return list;
  }

  return [];
}

async function writeAuditLog(params: {
  supabaseAdmin: ReturnType<typeof createClient>;
  workspaceId: string;
  action: string;
  severity?: AuditSeverity;
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

  if (error) {
    console.error("Audit log write failed:", error);
  }
}

async function fetchTikTokAccessToken(params: {
  appId: string;
  secret: string;
  authCode: string;
  redirectUri: string;
  apiVersion: string;
}) {
  const response = await fetch(
    `https://business-api.tiktok.com/open_api/${params.apiVersion}/oauth2/access_token/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        app_id: params.appId,
        secret: params.secret,
        auth_code: params.authCode,
        grant_type: "authorization_code",
        redirect_uri: params.redirectUri,
      }),
    },
  );

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function fetchTikTokAdvertisers(params: {
  appId: string;
  secret: string;
  accessToken: string;
  apiVersion: string;
}) {
  const url = new URL(
    `https://business-api.tiktok.com/open_api/${params.apiVersion}/oauth2/advertiser/get/`,
  );

  url.searchParams.set("app_id", params.appId);
  url.searchParams.set("secret", params.secret);

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Access-Token": params.accessToken,
      Accept: "application/json",
    },
  });

  const data = await response.json();

  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

Deno.serve(async (req: Request) => {
  let supabaseAdmin: ReturnType<typeof createClient> | null = null;

  try {
    const supabaseUrl = requiredEnv("SUPABASE_URL");
    const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

    supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

    if (req.method !== "GET") {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "tiktok_oauth_callback_rejected",
        severity: "warning",
        metadata: {
          reason: "method_not_allowed",
          method: req.method,
        },
      });

      return htmlResponse(
        "TikTok OAuth callback error",
        "This callback only accepts TikTok OAuth redirect requests.",
        405,
      );
    }

    const url = new URL(req.url);

    const state = url.searchParams.get("state");
    const code =
      url.searchParams.get("auth_code") ??
      url.searchParams.get("code");

    const tiktokError =
      url.searchParams.get("error") ??
      url.searchParams.get("error_code");

    const tiktokErrorDescription =
      url.searchParams.get("error_description") ??
      url.searchParams.get("message");

    if (tiktokError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "tiktok_oauth_callback_cancelled",
        severity: "warning",
        metadata: {
          tiktok_error: tiktokError,
          tiktok_error_description: tiktokErrorDescription,
          has_state: Boolean(state),
        },
      });

      return htmlResponse(
        "TikTok OAuth cancelled",
        `TikTok returned an error: <code>${escapeHtml(tiktokError)}</code>`,
        400,
      );
    }

    if (!state || !code) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "tiktok_oauth_callback_rejected",
        severity: "warning",
        metadata: {
          reason: "missing_state_or_code",
          has_state: Boolean(state),
          has_code: Boolean(code),
        },
      });

      return htmlResponse(
        "TikTok OAuth callback error",
        "Missing required OAuth state or authorization code.",
        400,
      );
    }

    const tiktokAppId = getTikTokAppId();
    const tiktokSecret = getTikTokSecret();
    const tiktokApiVersion = optionalEnv("TIKTOK_API_VERSION", "v1.3");
    const tiktokRedirectUri = getTikTokRedirectUri(supabaseUrl);

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: WORKSPACE_ID,
      action: "tiktok_oauth_callback_started",
      severity: "info",
      metadata: {
        has_state: true,
        has_code: true,
        api_version: tiktokApiVersion,
      },
    });

    const tokenResult = await fetchTikTokAccessToken({
      appId: tiktokAppId,
      secret: tiktokSecret,
      authCode: code,
      redirectUri: tiktokRedirectUri,
      apiVersion: tiktokApiVersion,
    });

    const tokenData = extractTokenData(tokenResult.data);
    const tokenDiagnostics = sanitizeTikTokTokenDiagnostics(tokenResult.data);

    console.log("TikTok token exchange diagnostics", {
      status: tokenResult.status,
      ...tokenDiagnostics,
    });

    const accessToken = typeof tokenData.accessToken === "string" &&
        tokenData.accessToken.trim()
      ? tokenData.accessToken
      : null;

    if (!tokenResult.ok || String(tokenData.code) !== "0" || !accessToken) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "tiktok_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "tiktok_token_exchange",
          status: tokenResult.status,
          ...tokenDiagnostics,
        },
      });

      return htmlResponse(
        "TikTok token exchange failed",
        "TikTok could not complete the token exchange. Please try connecting TikTok Ads again.",
        400,
      );
    }

    const advertiserIds = normalizeStringArray(tokenData.advertiserIds);

    if (advertiserIds.length === 0) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "tiktok_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "missing_advertiser_ids",
          status: tokenResult.status,
          ...tokenDiagnostics,
        },
      });

      return htmlResponse(
        "TikTok token exchange failed",
        "TikTok did not return any advertiser accounts. Please try connecting TikTok Ads again.",
        400,
      );
    }

    const refreshToken = typeof tokenData.refreshToken === "string" &&
        tokenData.refreshToken.trim()
      ? tokenData.refreshToken
      : null;

    if (!refreshToken) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "tiktok_oauth_callback_refresh_token_missing_but_continuing",
        severity: "warning",
        metadata: {
          step: "missing_refresh_token",
          status: tokenResult.status,
          advertiser_ids_count: advertiserIds.length,
          ...tokenDiagnostics,
        },
      });
    }

    const advertisersResult = await fetchTikTokAdvertisers({
      appId: tiktokAppId,
      secret: tiktokSecret,
      accessToken,
      apiVersion: tiktokApiVersion,
    });

    const advertisers = advertisersResult.ok
      ? extractAdvertisers(advertisersResult.data)
      : [];

    const firstAdvertiser = optionalRecord(advertisers[0]) ?? null;

    const advertiserId =
      firstAdvertiser?.advertiser_id ??
      firstAdvertiser?.advertiserId ??
      advertiserIds[0] ??
      Deno.env.get("TIKTOK_ADVERTISER_ID") ??
      null;

    const advertiserName =
      firstAdvertiser?.advertiser_name ??
      firstAdvertiser?.advertiserName ??
      firstAdvertiser?.name ??
      advertiserId ??
      null;

    const scopes = Array.isArray(tokenData.scope)
      ? tokenData.scope
      : String(tokenData.scope ?? "")
          .split(/[,\s]+/)
          .map((item) => item.trim())
          .filter(Boolean);

    const { data: connectionRows, error: connectionError } =
      await supabaseAdmin.rpc("complete_tiktok_ads_oauth_connection", {
        p_state_token: state,
        p_provider_account_id: advertiserId,
        p_provider_account_email: null,
        p_advertiser_id: advertiserId,
        p_advertiser_name: advertiserName,
        p_scopes: scopes,
        p_access_token: accessToken,
        p_refresh_token: refreshToken,
        p_token_expires_at: tokenData.accessTokenExpiresAt,
        p_refresh_token_expires_at: tokenData.refreshTokenExpiresAt,
        p_token_metadata: {
          api_version: tiktokApiVersion,
          token_type: refreshToken
            ? "access_and_refresh_token"
            : "access_token_only",
          refresh_token_returned: Boolean(refreshToken),
          access_token_returned: true,
          advertiser_ids_count: advertiserIds.length,
          token_response_top_level_keys:
            tokenDiagnostics.token_response_top_level_keys,
          token_response_data_keys: tokenDiagnostics.token_response_data_keys,
          tiktok_code: tokenDiagnostics.tiktok_code,
          tiktok_message: tokenDiagnostics.tiktok_message,
          tiktok_request_id: tokenDiagnostics.tiktok_request_id,
          warning: refreshToken ? null : "tiktok_did_not_return_refresh_token",
          token_response: {
            code: tokenData.code,
            message: tokenData.message,
            scope: tokenData.scope,
            advertiser_ids: advertiserIds,
            access_token_expires_at: tokenData.accessTokenExpiresAt,
            refresh_token_expires_at: tokenData.refreshTokenExpiresAt,
            diagnostics: tokenDiagnostics,
          },
          advertisers_read_ok: advertisersResult.ok,
          advertisers_status: advertisersResult.status,
          first_advertiser: firstAdvertiser,
          advertisers_count: advertisers.length,
          advertisers_error: advertisersResult.ok
            ? null
            : asRecord(advertisersResult.data).message ??
              asRecord(advertisersResult.data).msg ??
              null,
        },
      });

    if (connectionError) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "tiktok_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "complete_tiktok_ads_oauth_connection",
          advertiser_id: advertiserId,
          advertiser_name: advertiserName,
          error: connectionError.message,
          hint: connectionError.hint ?? null,
          code: connectionError.code ?? null,
        },
      });

      return htmlResponse(
        "Could not save TikTok Ads connection",
        "Database could not save the TikTok Ads connection. Please try again.",
        500,
      );
    }

    const connectionResult = Array.isArray(connectionRows)
      ? connectionRows[0]
      : connectionRows;
    const connectionRecord = optionalRecord(connectionResult);

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: String(connectionRecord?.workspace_id ?? WORKSPACE_ID),
      action: "tiktok_oauth_callback_success",
      severity: "info",
      metadata: {
        ad_platform_connection_id:
          connectionRecord?.ad_platform_connection_id ?? null,
        advertiser_id: advertiserId,
        advertiser_name: advertiserName,
        vault_secret_name: connectionRecord?.vault_secret_name ?? null,
        token_expires_at: tokenData.accessTokenExpiresAt,
        refresh_token_expires_at: tokenData.refreshTokenExpiresAt,
        token_type: refreshToken
          ? "access_and_refresh_token"
          : "access_token_only",
        refresh_token_returned: Boolean(refreshToken),
        advertisers_count: advertisers.length,
        scopes,
      },
    });

    return htmlResponse(
      "TikTok Ads connected",
      "TikTok Ads account was connected. You can return to Insight Hub.",
      200,
    );
  } catch (error) {
    const message = safeErrorText(error);

    if (supabaseAdmin) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        action: "tiktok_oauth_callback_failed",
        severity: "error",
        metadata: {
          step: "unhandled_error",
          error: message,
        },
      });
    }

    return htmlResponse(
      "TikTok OAuth callback error",
      "Unexpected callback error. Please try again.",
      500,
    );
  }
});
