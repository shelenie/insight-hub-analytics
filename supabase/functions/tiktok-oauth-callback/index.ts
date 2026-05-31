import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const APP_URL = "https://shelenie.github.io/insight-hub-analytics";
const TIKTOK_TOKEN_URL = "https://business-api.tiktok.com/open_api/v1.3/oauth2/access_token/";
const DEFAULT_OAUTH_STATE_RPC = "consume_ad_platform_oauth_state";
const DEFAULT_AUDIT_RPC = "record_ad_platform_oauth_audit";
const DEFAULT_STORE_CONNECTION_RPC = "store_ad_platform_oauth_connection";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type JsonObject = Record<string, unknown>;

type OAuthState = {
  id?: string;
  workspace_id?: string;
  user_id?: string;
  redirect_uri?: string;
  code_verifier?: string;
  metadata?: JsonObject | null;
};

type TokenDiagnostics = {
  token_response_top_level_keys: string[];
  has_access_token: boolean;
  has_refresh_token: boolean;
  has_expires_in: boolean;
  has_refresh_expires_in: boolean;
  tiktok_code: string | number | null;
  tiktok_message: string | null;
  tiktok_request_id: string | null;
};

function htmlPage(title: string, message: string, status = 200) {
  return new Response(`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(title)}</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: #f8fafc; color: #0f172a; }
    main { width: min(92vw, 560px); border: 1px solid #e2e8f0; border-radius: 24px; background: #fff; padding: 32px; box-shadow: 0 24px 60px rgba(15, 23, 42, 0.08); }
    h1 { margin: 0 0 12px; font-size: clamp(1.6rem, 4vw, 2.1rem); line-height: 1.15; }
    p { margin: 0 0 24px; color: #475569; line-height: 1.6; }
    a { display: inline-flex; align-items: center; justify-content: center; border-radius: 999px; background: #0f172a; color: #fff; padding: 12px 18px; font-weight: 700; text-decoration: none; }
    a:focus-visible { outline: 3px solid #94a3b8; outline-offset: 3px; }
  </style>
</head>
<body>
  <main>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <a href="${APP_URL}">Return to Insight Hub</a>
  </main>
</body>
</html>`, {
    status,
    headers: { ...corsHeaders, "Content-Type": "text/html; charset=utf-8" },
  });
}

function escapeHtml(value: string) {
  return value.replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#39;");
}

function asObject(value: unknown): JsonObject | null {
  return value && typeof value === "object" && !Array.isArray(value) ? value as JsonObject : null;
}

function nestedObject(payload: JsonObject, key: string): JsonObject | null {
  return asObject(payload[key]);
}

function hasTokenResponseField(payload: JsonObject, key: string) {
  const data = nestedObject(payload, "data");
  return payload[key] != null || data?.[key] != null;
}

function pickString(payload: JsonObject | null | undefined, keys: string[]) {
  if (!payload) return null;
  for (const key of keys) {
    const value = payload[key];
    if (typeof value === "string" && value.trim()) return value;
  }
  return null;
}

function sanitizeTokenResponse(payload: unknown): TokenDiagnostics {
  const response = asObject(payload) ?? {};
  const data = nestedObject(response, "data");
  return {
    token_response_top_level_keys: Object.keys(response).sort(),
    has_access_token: hasTokenResponseField(response, "access_token"),
    has_refresh_token: hasTokenResponseField(response, "refresh_token"),
    has_expires_in: hasTokenResponseField(response, "expires_in"),
    has_refresh_expires_in: hasTokenResponseField(response, "refresh_expires_in"),
    tiktok_code: typeof response.code === "string" || typeof response.code === "number" ? response.code : null,
    tiktok_message: typeof response.message === "string" ? response.message : null,
    tiktok_request_id: pickString(response, ["request_id", "log_id"]) ?? pickString(data, ["request_id", "log_id"]),
  };
}

function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function tiktokClientKey() {
  return Deno.env.get("TIKTOK_CLIENT_KEY") ?? Deno.env.get("TIKTOK_APP_ID") ?? Deno.env.get("TIKTOK_CLIENT_ID") ?? "";
}

function tiktokClientSecret() {
  return Deno.env.get("TIKTOK_CLIENT_SECRET") ?? Deno.env.get("TIKTOK_APP_SECRET") ?? "";
}

function rpcName(envName: string, fallback: string) {
  return Deno.env.get(envName) ?? fallback;
}

async function loadOAuthState(adminClient: ReturnType<typeof createClient>, state: string): Promise<OAuthState | null> {
  const { data, error } = await adminClient.rpc(rpcName("AD_PLATFORM_OAUTH_STATE_RPC", DEFAULT_OAUTH_STATE_RPC), {
    p_platform: "tiktok_ads",
    p_state: state,
  });
  if (error) throw error;
  return asObject(data) as OAuthState | null;
}

async function recordAudit(adminClient: ReturnType<typeof createClient>, action: string, metadata: JsonObject, stateRow?: OAuthState | null) {
  const { error } = await adminClient.rpc(rpcName("AD_PLATFORM_OAUTH_AUDIT_RPC", DEFAULT_AUDIT_RPC), {
    p_action: action,
    p_platform: "tiktok_ads",
    p_workspace_id: stateRow?.workspace_id ?? null,
    p_user_id: stateRow?.user_id ?? null,
    p_metadata: metadata,
  });
  if (error) console.warn("[tiktok-oauth-callback] audit rpc failed", { action, message: error.message, metadata_keys: Object.keys(metadata).sort() });
}

async function exchangeCodeForToken(code: string, stateRow: OAuthState | null) {
  const clientKey = tiktokClientKey();
  const clientSecret = tiktokClientSecret();
  if (!clientKey || !clientSecret) throw new Error("TikTok OAuth client credentials are not configured");

  const redirectUri = stateRow?.redirect_uri ?? pickString(stateRow?.metadata, ["redirect_uri"]) ?? Deno.env.get("TIKTOK_REDIRECT_URI") ?? undefined;
  const codeVerifier = stateRow?.code_verifier ?? pickString(stateRow?.metadata, ["code_verifier"]);
  const body: JsonObject = {
    app_id: clientKey,
    secret: clientSecret,
    auth_code: code,
    grant_type: "auth_code",
  };
  if (redirectUri) body.redirect_uri = redirectUri;
  if (codeVerifier) body.code_verifier = codeVerifier;

  return await fetch(TIKTOK_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
}

async function storeConnectionWithExistingVaultPattern(adminClient: ReturnType<typeof createClient>, stateRow: OAuthState, tokenPayload: JsonObject, tokenDiagnostics: TokenDiagnostics) {
  if (!tokenDiagnostics.has_refresh_token) throw new Error("Cannot create TikTok connection without refresh token");
  if (!stateRow.workspace_id) throw new Error("OAuth state is missing workspace_id");

  const { error } = await adminClient.rpc(rpcName("AD_PLATFORM_OAUTH_STORE_CONNECTION_RPC", DEFAULT_STORE_CONNECTION_RPC), {
    p_platform: "tiktok_ads",
    p_status: "active",
    p_workspace_id: stateRow.workspace_id,
    p_user_id: stateRow.user_id ?? null,
    p_oauth_state_id: stateRow.id ?? null,
    p_token_payload: tokenPayload,
    p_metadata: {
      provider: "tiktok",
      token_diagnostics: tokenDiagnostics,
    },
  });
  if (error) throw error;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const adminClient = createClient(requiredEnv("SUPABASE_URL"), requiredEnv("SUPABASE_SERVICE_ROLE_KEY"));

  try {
    const url = new URL(req.url);
    const code = url.searchParams.get("code") ?? "";
    const state = url.searchParams.get("state") ?? "";
    const oauthError = url.searchParams.get("error");
    const oauthErrorDescription = url.searchParams.get("error_description");

    if (oauthError) {
      await recordAudit(adminClient, "tiktok_oauth_callback_failed", {
        step: "provider_error",
        provider_error: oauthError,
        provider_error_description: oauthErrorDescription,
      });
      return htmlPage("TikTok Ads connection needs attention", "TikTok did not complete authorization. Please return to Insight Hub and try again after settings are checked.", 400);
    }

    if (!code || !state) {
      await recordAudit(adminClient, "tiktok_oauth_callback_failed", {
        step: "missing_callback_parameters",
        has_code: Boolean(code),
        has_state: Boolean(state),
      });
      return htmlPage("TikTok Ads connection needs attention", "TikTok authorization could not be verified. Please return to Insight Hub and try again.", 400);
    }

    const stateRow = await loadOAuthState(adminClient, state);
    if (!stateRow) {
      await recordAudit(adminClient, "tiktok_oauth_callback_failed", { step: "invalid_state" });
      return htmlPage("TikTok Ads connection needs attention", "TikTok authorization could not be verified. Please return to Insight Hub and try again.", 400);
    }

    const tokenResponse = await exchangeCodeForToken(code, stateRow);
    const tokenPayload = await tokenResponse.json().catch(() => ({}));
    const tokenDiagnostics = sanitizeTokenResponse(tokenPayload);

    console.log("[tiktok-oauth-callback] token exchange diagnostics", {
      http_status: tokenResponse.status,
      ...tokenDiagnostics,
    });

    if (!tokenDiagnostics.has_refresh_token) {
      await recordAudit(adminClient, "tiktok_oauth_callback_missing_refresh_token", {
        step: "missing_refresh_token",
        http_status: tokenResponse.status,
        ...tokenDiagnostics,
      }, stateRow);

      return htmlPage(
        "TikTok Ads connection needs attention",
        "TikTok did not return a refresh token. Please return to Insight Hub and try again after settings are checked.",
        400,
      );
    }

    if (!tokenResponse.ok) {
      await recordAudit(adminClient, "tiktok_oauth_callback_failed", {
        step: "token_exchange_failed",
        http_status: tokenResponse.status,
        ...tokenDiagnostics,
      }, stateRow);
      return htmlPage("TikTok Ads connection needs attention", "TikTok authorization could not be completed. Please return to Insight Hub and try again after settings are checked.", 400);
    }

    await storeConnectionWithExistingVaultPattern(adminClient, stateRow, asObject(tokenPayload) ?? {}, tokenDiagnostics);
    await recordAudit(adminClient, "tiktok_oauth_callback_succeeded", {
      step: "connection_created",
      ...tokenDiagnostics,
    }, stateRow);

    return htmlPage("TikTok Ads connected", "TikTok Ads was connected. You can return to Insight Hub to review the connection.");
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown callback error";
    console.error("[tiktok-oauth-callback] callback failed", { message });
    await recordAudit(adminClient, "tiktok_oauth_callback_failed", { step: "exception", error: message });
    return htmlPage("TikTok Ads connection needs attention", "TikTok authorization could not be completed. Please return to Insight Hub and try again after settings are checked.", 500);
  }
});
