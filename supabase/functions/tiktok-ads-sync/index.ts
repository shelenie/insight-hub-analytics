import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  workspace_id?: string;
  ad_platform_connection_id?: string | null;
  ad_account_id?: string | null;
  advertiser_id?: string | null;

  date_from?: string;
  date_to?: string;
  level?: "campaign" | "adgroup" | "ad";
  sync_mode?: "manual" | "scheduled" | "backfill";
  fetch_advertisers?: boolean;
  fetch_metrics?: boolean;

  test_mode?: "dry_run" | "mock_sync";

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

type TokenAuditMetadata = {
  token_mode: string | null;
  has_access_token: boolean;
  has_refresh_token: boolean;
  refresh_token_returned: boolean | null;
  used_access_token_directly: boolean;
  reconnect_required?: boolean;
};

const FUNCTION_NAME = "tiktok-ads-sync";
const TIKTOK_RECONNECT_MESSAGE =
  "TikTok access token expired. Reconnect TikTok Ads.";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-backend-test-secret, x-test-actor-email",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

class TikTokApiError extends Error {
  status: number;
  tiktokCode: unknown;

  constructor(message: string, status: number, tiktokCode: unknown) {
    super(message);
    this.name = "TikTokApiError";
    this.status = status;
    this.tiktokCode = tiktokCode;
  }
}

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

function getTikTokAppId(): string {
  const appId =
    Deno.env.get("TIKTOK_APP_ID") ?? Deno.env.get("TIKTOK_CLIENT_KEY");

  if (!appId) {
    throw new Error("Missing required env: TIKTOK_APP_ID or TIKTOK_CLIENT_KEY");
  }

  return appId;
}

function getTikTokSecret(): string {
  const secret =
    Deno.env.get("TIKTOK_APP_SECRET") ?? Deno.env.get("TIKTOK_CLIENT_SECRET");

  if (!secret) {
    throw new Error(
      "Missing required env: TIKTOK_APP_SECRET or TIKTOK_CLIENT_SECRET",
    );
  }

  return secret;
}

function daysAgoIsoDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeLevel(input: unknown): "campaign" | "adgroup" | "ad" {
  if (input === "adgroup" || input === "ad") return input;
  return "campaign";
}

function numberValue(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? num : 0;
}

function integerValue(value: unknown) {
  const num = Number(value ?? 0);
  return Number.isFinite(num) ? Math.round(num) : 0;
}

function getProvidedBackendTestSecret(req: Request, body: RequestBody) {
  return (
    body.backend_test_secret ?? req.headers.get("x-backend-test-secret") ?? null
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

function normalizeAccessRow(row: any) {
  return {
    allowed: row?.allowed === true,
    actor_user_id: row?.result_actor_user_id ?? row?.actor_user_id ?? null,
    actor_email: row?.result_actor_email ?? row?.actor_email ?? null,
    actor_role: row?.result_actor_role ?? row?.actor_role ?? null,
    reason: row?.result_reason ?? row?.reason ?? null,
    allow_backend_test_mode:
      row?.result_allow_backend_test_mode ??
      row?.allow_backend_test_mode ??
      true,
  };
}

function normalizeSecretPayload(payload: unknown): any {
  if (typeof payload === "string") {
    return JSON.parse(payload);
  }
  return payload ?? {};
}

function hasStringValue(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function pickBoolean(value: unknown): boolean | null {
  return typeof value === "boolean" ? value : null;
}

function buildTokenAuditMetadata(params: {
  secretPayload: any;
  connection: any;
  usedAccessTokenDirectly?: boolean;
  reconnectRequired?: boolean;
}): TokenAuditMetadata {
  const tokenMetadata =
    params.secretPayload?.metadata ??
    params.secretPayload?.token_metadata ??
    params.connection?.metadata ??
    {};

  const hasAccessToken = hasStringValue(params.secretPayload?.access_token);
  const hasRefreshToken = hasStringValue(params.secretPayload?.refresh_token);
  const refreshTokenReturned =
    pickBoolean(params.secretPayload?.refresh_token_returned) ??
    pickBoolean(tokenMetadata?.refresh_token_returned) ??
    pickBoolean(params.connection?.refresh_token_returned);

  return {
    token_mode: String(
      params.secretPayload?.token_mode ??
        tokenMetadata?.token_mode ??
        tokenMetadata?.token_type ??
        params.connection?.token_mode ??
        (hasRefreshToken
          ? "access_and_refresh_token"
          : hasAccessToken
            ? "access_token_only"
            : "missing_tokens"),
    ),
    has_access_token: hasAccessToken,
    has_refresh_token: hasRefreshToken,
    refresh_token_returned: refreshTokenReturned,
    used_access_token_directly: params.usedAccessTokenDirectly ?? false,
    ...(params.reconnectRequired ? { reconnect_required: true } : {}),
  };
}

function isTikTokUnauthorizedError(error: unknown) {
  if (error instanceof TikTokApiError) {
    const code = String(error.tiktokCode ?? "").toLowerCase();
    return (
      error.status === 401 ||
      error.status === 403 ||
      code.includes("unauthorized") ||
      code.includes("access_token") ||
      code.includes("token")
    );
  }

  const message = error instanceof Error ? error.message : String(error);
  return /\b(401|403|unauthorized|access[_ -]?token|expired token|token expired)\b/i.test(
    message,
  );
}

function messageForTikTokError(
  error: unknown,
  tokenAuditMetadata: TokenAuditMetadata,
) {
  if (
    tokenAuditMetadata.used_access_token_directly &&
    isTikTokUnauthorizedError(error)
  ) {
    return TIKTOK_RECONNECT_MESSAGE;
  }

  return error instanceof Error ? error.message : String(error);
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

    if (
      !expectedBackendTestSecret ||
      providedBackendTestSecret !== expectedBackendTestSecret
    ) {
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

function secondsToIso(secondsValue: unknown): string | null {
  const value = Number(secondsValue ?? 0);

  if (!Number.isFinite(value) || value <= 0) return null;

  if (value > 1_000_000_000) {
    return new Date(value * 1000).toISOString();
  }

  return new Date(Date.now() + value * 1000).toISOString();
}

async function refreshTikTokAccessToken(params: {
  appId: string;
  secret: string;
  refreshToken: string;
  apiVersion: string;
}) {
  const response = await fetch(
    `https://business-api.tiktok.com/open_api/${params.apiVersion}/oauth2/refresh_token/`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify({
        app_id: params.appId,
        secret: params.secret,
        refresh_token: params.refreshToken,
        grant_type: "refresh_token",
      }),
    },
  );

  const data = await response.json();

  const tokenData = data?.data ?? data ?? {};

  if (!response.ok || data?.code !== 0 || !tokenData.access_token) {
    throw new Error(
      `Could not refresh TikTok access token: ${
        data?.message ?? data?.msg ?? response.status
      }`,
    );
  }

  return {
    accessToken: tokenData.access_token as string,
    accessTokenExpiresAt: secondsToIso(
      tokenData.access_token_expire_in ?? tokenData.expires_in,
    ),
    refreshToken: tokenData.refresh_token ?? params.refreshToken,
    refreshTokenExpiresAt: secondsToIso(tokenData.refresh_token_expire_in),
    raw: data,
  };
}

async function tiktokGet(params: {
  apiVersion: string;
  accessToken: string;
  path: string;
  searchParams?: Record<string, string>;
}) {
  const url = new URL(
    `https://business-api.tiktok.com/open_api/${params.apiVersion}${params.path}`,
  );

  for (const [key, value] of Object.entries(params.searchParams ?? {})) {
    url.searchParams.set(key, value);
  }

  const response = await fetch(url.toString(), {
    method: "GET",
    headers: {
      "Access-Token": params.accessToken,
      Accept: "application/json",
    },
  });

  const data = await response.json();

  if (!response.ok || data?.code !== 0) {
    throw new TikTokApiError(
      `TikTok API error ${response.status}: ${data?.message ?? data?.msg ?? JSON.stringify(data)}`,
      response.status,
      data?.code,
    );
  }

  return data;
}

function extractAdvertisers(raw: any) {
  const data = raw?.data ?? raw ?? {};
  const list = data?.list ?? data?.advertiser_list ?? data?.advertisers ?? [];

  return Array.isArray(list) ? list : [];
}

function dataLevelFromLevel(level: "campaign" | "adgroup" | "ad") {
  if (level === "ad") return "AUCTION_AD";
  if (level === "adgroup") return "AUCTION_ADGROUP";
  return "AUCTION_CAMPAIGN";
}

function normalizeAdvertiser(row: any) {
  const advertiserId =
    row?.advertiser_id ?? row?.advertiserId ?? row?.id ?? null;

  return {
    advertiser_id: advertiserId ? String(advertiserId) : null,
    advertiser_name:
      row?.advertiser_name ??
      row?.advertiserName ??
      row?.name ??
      (advertiserId ? `TikTok Advertiser ${advertiserId}` : null),
    currency: row?.currency ?? null,
    timezone: row?.timezone ?? row?.time_zone ?? null,
  };
}

function normalizeReportRow(params: {
  row: any;
  account: any;
  level: "campaign" | "adgroup" | "ad";
}) {
  const dimensions = params.row?.dimensions ?? {};
  const metrics = params.row?.metrics ?? params.row ?? {};

  const advertiserId =
    dimensions.advertiser_id ??
    params.account.external_account_id ??
    params.account.provider_business_id;

  const insightDate =
    dimensions.stat_time_day ??
    dimensions.date ??
    dimensions.stat_time_hour?.slice?.(0, 10) ??
    null;

  const campaignId = dimensions.campaign_id ?? metrics.campaign_id ?? null;

  const adgroupId =
    dimensions.adgroup_id ??
    dimensions.ad_group_id ??
    metrics.adgroup_id ??
    null;

  const adId = dimensions.ad_id ?? metrics.ad_id ?? null;

  const sourceHash = [
    "tiktok_ads",
    advertiserId,
    insightDate,
    params.level,
    campaignId,
    adgroupId,
    adId,
  ].join("|");

  const conversions =
    numberValue(metrics.conversion) ||
    numberValue(metrics.conversions) ||
    numberValue(metrics.total_complete_payment_rate);

  const revenue =
    numberValue(metrics.total_purchase_value) ||
    numberValue(metrics.purchase_value) ||
    numberValue(metrics.sales) ||
    0;

  return {
    advertiser_id: advertiserId ? String(advertiserId) : null,
    insight_date: insightDate,
    level: params.level,
    external_campaign_id: campaignId ? String(campaignId) : null,
    campaign_name: metrics.campaign_name ?? dimensions.campaign_name ?? null,
    external_adset_id: adgroupId ? String(adgroupId) : null,
    adset_name:
      metrics.adgroup_name ??
      metrics.ad_group_name ??
      dimensions.adgroup_name ??
      null,
    external_ad_id: adId ? String(adId) : null,
    ad_name: metrics.ad_name ?? dimensions.ad_name ?? null,
    currency: params.account.account_currency ?? null,
    spend: String(numberValue(metrics.spend)),
    impressions: String(integerValue(metrics.impressions)),
    clicks: String(integerValue(metrics.clicks)),
    link_clicks: String(integerValue(metrics.clicks)),
    leads: String(integerValue(metrics.leads ?? metrics.conversion)),
    purchases: String(
      integerValue(metrics.complete_payment ?? metrics.purchase),
    ),
    revenue: String(revenue),
    conversions: String(integerValue(conversions)),
    source_hash: sourceHash,
    raw_metrics: metrics,
    raw_dimensions: dimensions,
    raw_payload: params.row,
    metadata: {
      source: FUNCTION_NAME,
      normalized_at: new Date().toISOString(),
    },
  };
}

async function fetchTikTokIntegratedReport(params: {
  apiVersion: string;
  accessToken: string;
  advertiserId: string;
  dateFrom: string;
  dateTo: string;
  level: "campaign" | "adgroup" | "ad";
}) {
  const metrics = [
    "spend",
    "impressions",
    "clicks",
    "conversion",
    "complete_payment",
    "total_purchase_value",
  ];

  const dimensions =
    params.level === "ad"
      ? ["ad_id", "stat_time_day"]
      : params.level === "adgroup"
        ? ["adgroup_id", "stat_time_day"]
        : ["campaign_id", "stat_time_day"];

  const data = await tiktokGet({
    apiVersion: params.apiVersion,
    accessToken: params.accessToken,
    path: "/report/integrated/get/",
    searchParams: {
      advertiser_id: params.advertiserId,
      report_type: "BASIC",
      data_level: dataLevelFromLevel(params.level),
      dimensions: JSON.stringify(dimensions),
      metrics: JSON.stringify(metrics),
      start_date: params.dateFrom,
      end_date: params.dateTo,
      page: "1",
      page_size: "1000",
    },
  });

  const rows = data?.data?.list ?? [];

  return Array.isArray(rows) ? rows : [];
}

async function runMockSync(params: {
  supabaseAdmin: any;
  workspaceId: string;
  actor: ActorContext;
}) {
  let connectionId: string | null = null;
  let adAccountId: string | null = null;
  let syncRunId: string | null = null;

  const cleanup = {
    raw_insights: 0,
    sync_runs: 0,
    ad_accounts: 0,
    connections: 0,
  };

  try {
    const { data: connection, error: connectionError } =
      await params.supabaseAdmin
        .from("ad_platform_connections")
        .insert({
          workspace_id: params.workspaceId,
          platform: "tiktok_ads",
          connection_name: "MOCK_TIKTOK_SYNC_CONNECTION_DO_NOT_USE",
          status: "active",
          provider_account_id: "mock_tiktok_user",
          provider_account_email: params.actor.email,
          provider_business_id: "mock_tiktok_advertiser",
          provider_business_name: "Mock TikTok Advertiser",
          vault_secret_name: "mock_tiktok_secret_not_used",
          scopes: [
            "advertiser.read",
            "campaign.read",
            "adgroup.read",
            "ad.read",
            "report.read",
          ],
          metadata: {
            created_by_edge_test: "tiktok_ads_sync_mock",
            advertiser_id: "mock_tiktok_advertiser",
          },
        })
        .select("id")
        .single();

    if (connectionError) throw new Error(connectionError.message);
    connectionId = connection.id;

    const { data: upsertedAccountId, error: accountError } =
      await params.supabaseAdmin.rpc("upsert_tiktok_advertiser_account", {
        p_workspace_id: params.workspaceId,
        p_ad_platform_connection_id: connectionId,
        p_advertiser_id: "mock_tiktok_advertiser",
        p_advertiser_name: "MOCK TikTok Advertiser",
        p_account_currency: "USD",
        p_account_timezone: "UTC",
        p_status: "active",
        p_metadata: {
          created_by_edge_test: "tiktok_ads_sync_mock",
        },
      });

    if (accountError) throw new Error(accountError.message);
    adAccountId = upsertedAccountId;

    const { data: runId, error: runError } = await params.supabaseAdmin.rpc(
      "start_ad_sync_run",
      {
        p_workspace_id: params.workspaceId,
        p_ad_sync_job_id: null,
        p_ad_platform_connection_id: connectionId,
        p_ad_account_id: adAccountId,
        p_platform: "tiktok_ads",
        p_sync_mode: "manual",
        p_date_from: daysAgoIsoDate(2),
        p_date_to: daysAgoIsoDate(1),
        p_actor_user_id: params.actor.user_id,
        p_actor_email: params.actor.email,
        p_actor_role: params.actor.role,
        p_metadata: {
          created_by_edge_test: "tiktok_ads_sync_mock",
        },
      },
    );

    if (runError) throw new Error(runError.message);
    syncRunId = runId;

    const { data: insertedRows, error: insertError } =
      await params.supabaseAdmin.rpc("insert_tiktok_ads_raw_insights_batch", {
        p_workspace_id: params.workspaceId,
        p_ad_sync_run_log_id: syncRunId,
        p_ad_platform_connection_id: connectionId,
        p_ad_account_id: adAccountId,
        p_rows: [
          {
            advertiser_id: "mock_tiktok_advertiser",
            insight_date: daysAgoIsoDate(2),
            level: "campaign",
            external_campaign_id: "mock_tiktok_campaign_1",
            campaign_name: "MOCK TikTok Campaign 1",
            external_adset_id: "mock_tiktok_adgroup_1",
            adset_name: "MOCK TikTok Ad Group 1",
            currency: "USD",
            spend: "120.25",
            impressions: "12000",
            clicks: "480",
            link_clicks: "430",
            leads: "22",
            purchases: "2",
            revenue: "500",
            conversions: "2",
            source_hash: "tiktok_ads_sync_mock_hash_1",
            metadata: {
              created_by_edge_test: "tiktok_ads_sync_mock",
            },
          },
          {
            advertiser_id: "mock_tiktok_advertiser",
            insight_date: daysAgoIsoDate(1),
            level: "campaign",
            external_campaign_id: "mock_tiktok_campaign_2",
            campaign_name: "MOCK TikTok Campaign 2",
            external_adset_id: "mock_tiktok_adgroup_2",
            adset_name: "MOCK TikTok Ad Group 2",
            currency: "USD",
            spend: "240.50",
            impressions: "24000",
            clicks: "760",
            link_clicks: "690",
            leads: "36",
            purchases: "4",
            revenue: "1000",
            conversions: "4",
            source_hash: "tiktok_ads_sync_mock_hash_2",
            metadata: {
              created_by_edge_test: "tiktok_ads_sync_mock",
            },
          },
        ],
      });

    if (insertError) throw new Error(insertError.message);

    await params.supabaseAdmin.rpc("finish_ad_sync_run", {
      p_ad_sync_run_log_id: syncRunId,
      p_status: "success",
      p_rows_received: 2,
      p_rows_inserted: insertedRows,
      p_rows_updated: 0,
      p_rows_failed: 0,
      p_error_message: null,
      p_metadata: {
        created_by_edge_test: "tiktok_ads_sync_mock",
        test_result: "ok",
      },
    });

    const { count: rawCount } = await params.supabaseAdmin
      .from("ad_raw_insights")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", params.workspaceId)
      .eq("ad_sync_run_log_id", syncRunId);

    await params.supabaseAdmin
      .from("ad_raw_insights")
      .delete()
      .eq("ad_sync_run_log_id", syncRunId);
    cleanup.raw_insights = rawCount ?? 0;

    await params.supabaseAdmin
      .from("ad_sync_run_logs")
      .delete()
      .eq("id", syncRunId);
    cleanup.sync_runs = 1;

    await params.supabaseAdmin
      .from("ad_accounts")
      .delete()
      .eq("id", adAccountId);
    cleanup.ad_accounts = 1;

    await params.supabaseAdmin
      .from("ad_platform_connections")
      .delete()
      .eq("id", connectionId);
    cleanup.connections = 1;

    return {
      ok: true,
      real_tiktok_api_called: false,
      test_mode: "mock_sync",
      rows_inserted: insertedRows,
      raw_rows_seen_before_cleanup: rawCount ?? 0,
      cleanup,
    };
  } catch (error) {
    if (syncRunId) {
      await params.supabaseAdmin
        .from("ad_raw_insights")
        .delete()
        .eq("ad_sync_run_log_id", syncRunId);
      await params.supabaseAdmin
        .from("ad_sync_run_logs")
        .delete()
        .eq("id", syncRunId);
    }

    if (adAccountId) {
      await params.supabaseAdmin
        .from("ad_accounts")
        .delete()
        .eq("id", adAccountId);
    }

    if (connectionId) {
      await params.supabaseAdmin
        .from("ad_platform_connections")
        .delete()
        .eq("id", connectionId);
    }

    throw error;
  }
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

  const dateFrom = body.date_from ?? daysAgoIsoDate(7);
  const dateTo = body.date_to ?? daysAgoIsoDate(1);

  if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    return jsonResponse(400, {
      ok: false,
      error: "date_from and date_to must be YYYY-MM-DD.",
    });
  }

  const level = normalizeLevel(body.level);
  const syncMode = body.sync_mode ?? "manual";
  const fetchAdvertisers = body.fetch_advertisers ?? true;
  const fetchMetrics = body.fetch_metrics ?? true;

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const tiktokApiVersion = optionalEnv("TIKTOK_API_VERSION", "v1.3");

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
      action: "tiktok_ads_sync_permission_check_failed",
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
      action: "tiktok_ads_sync_denied",
      severity: "warning",
      metadata: {
        reason: actor.reason,
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
    action: "tiktok_ads_sync_started",
    severity: "info",
    metadata: {
      date_from: dateFrom,
      date_to: dateTo,
      level,
      sync_mode: syncMode,
      fetch_advertisers: fetchAdvertisers,
      fetch_metrics: fetchMetrics,
      test_mode: body.test_mode ?? null,
      api_version: tiktokApiVersion,
    },
  });

  let tokenAuditMetadata: Partial<TokenAuditMetadata> = {};

  try {
    if (actor.mode === "backend_test" && body.test_mode === "mock_sync") {
      const mockResult = await runMockSync({
        supabaseAdmin,
        workspaceId,
        actor,
      });

      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "tiktok_ads_sync_mock_success",
        severity: "info",
        metadata: mockResult,
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
        ...mockResult,
      });
    }

    if (actor.mode === "backend_test" && body.test_mode === "dry_run") {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "tiktok_ads_sync_dry_run_success",
        severity: "info",
        metadata: {
          real_tiktok_api_called: false,
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
        test_mode: "dry_run",
        real_tiktok_api_called: false,
      });
    }

    const tiktokAppId = getTikTokAppId();
    const tiktokSecret = getTikTokSecret();

    const { data: connectionRows, error: connectionError } =
      await supabaseAdmin.rpc(
        "get_active_tiktok_ads_connection_for_workspace",
        {
          p_workspace_id: workspaceId,
          p_ad_platform_connection_id: body.ad_platform_connection_id ?? null,
        },
      );

    if (connectionError) {
      throw new Error(
        `Could not read TikTok Ads connection: ${connectionError.message}`,
      );
    }

    const connection = Array.isArray(connectionRows)
      ? connectionRows[0]
      : connectionRows;

    if (!connection?.ad_platform_connection_id) {
      return jsonResponse(404, {
        ok: false,
        error:
          "Active TikTok Ads connection not found. Complete TikTok OAuth first.",
      });
    }

    const { data: secretPayloadRaw, error: secretError } =
      await supabaseAdmin.rpc("get_tiktok_ads_oauth_secret_payload", {
        p_vault_secret_name: connection.vault_secret_name,
      });

    if (secretError) {
      throw new Error(
        `Could not read TikTok Ads token: ${secretError.message}`,
      );
    }

    const secretPayload = normalizeSecretPayload(secretPayloadRaw);
    const refreshToken = hasStringValue(secretPayload?.refresh_token)
      ? secretPayload.refresh_token.trim()
      : null;
    const storedAccessToken = hasStringValue(secretPayload?.access_token)
      ? secretPayload.access_token.trim()
      : null;

    tokenAuditMetadata = buildTokenAuditMetadata({
      secretPayload,
      connection,
      usedAccessTokenDirectly: !refreshToken && Boolean(storedAccessToken),
    });

    if (!refreshToken && !storedAccessToken) {
      throw new Error(
        "TikTok access token and refresh token missing in Vault payload. Reconnect TikTok Ads.",
      );
    }

    let accessToken = storedAccessToken;

    if (refreshToken) {
      const refreshedToken = await refreshTikTokAccessToken({
        appId: tiktokAppId,
        secret: tiktokSecret,
        refreshToken,
        apiVersion: tiktokApiVersion,
      });

      accessToken = refreshedToken.accessToken;
      tokenAuditMetadata = {
        ...tokenAuditMetadata,
        used_access_token_directly: false,
      };
    }

    if (!accessToken) {
      throw new Error(
        "TikTok access token missing after token handling. Reconnect TikTok Ads.",
      );
    }

    const accountResults: Array<Record<string, unknown>> = [];
    const syncResults: Array<Record<string, unknown>> = [];

    let advertiserIds: string[] = [];

    if (body.advertiser_id) {
      advertiserIds = [String(body.advertiser_id)];
    } else if (connection.advertiser_id) {
      advertiserIds = [String(connection.advertiser_id)];
    } else if (secretPayload?.advertiser_id) {
      advertiserIds = [String(secretPayload.advertiser_id)];
    }

    if (fetchAdvertisers) {
      try {
        const advertisersRaw = await tiktokGet({
          apiVersion: tiktokApiVersion,
          accessToken,
          path: "/oauth2/advertiser/get/",
          searchParams: {
            app_id: tiktokAppId,
            secret: tiktokSecret,
          },
        });

        const advertisers = extractAdvertisers(advertisersRaw)
          .map(normalizeAdvertiser)
          .filter((item) => Boolean(item.advertiser_id));

        if (advertiserIds.length === 0) {
          advertiserIds = advertisers.map(
            (item) => item.advertiser_id as string,
          );
        }

        for (const advertiser of advertisers) {
          const { data: adAccountId, error: accountError } =
            await supabaseAdmin.rpc("upsert_tiktok_advertiser_account", {
              p_workspace_id: workspaceId,
              p_ad_platform_connection_id: connection.ad_platform_connection_id,
              p_advertiser_id: advertiser.advertiser_id,
              p_advertiser_name: advertiser.advertiser_name,
              p_account_currency: advertiser.currency,
              p_account_timezone: advertiser.timezone,
              p_status: "active",
              p_metadata: {
                source: FUNCTION_NAME,
                synced_at: new Date().toISOString(),
              },
            });

          if (accountError) throw new Error(accountError.message);

          accountResults.push({
            advertiser_id: advertiser.advertiser_id,
            advertiser_name: advertiser.advertiser_name,
            ad_account_id: adAccountId,
          });
        }
      } catch (error) {
        if (
          tokenAuditMetadata.used_access_token_directly &&
          isTikTokUnauthorizedError(error)
        ) {
          tokenAuditMetadata = {
            ...tokenAuditMetadata,
            reconnect_required: true,
          };
        }

        throw new Error(
          messageForTikTokError(
            error,
            tokenAuditMetadata as TokenAuditMetadata,
          ),
        );
      }
    }

    let dbAccountsQuery = supabaseAdmin
      .from("ad_accounts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("platform", "tiktok_ads")
      .eq("ad_platform_connection_id", connection.ad_platform_connection_id)
      .eq("is_active", true);

    if (body.ad_account_id) {
      dbAccountsQuery = dbAccountsQuery.eq("id", body.ad_account_id);
    }

    if (body.advertiser_id) {
      dbAccountsQuery = dbAccountsQuery.eq(
        "external_account_id",
        String(body.advertiser_id),
      );
    }

    const { data: dbAccounts, error: dbAccountsError } = await dbAccountsQuery;

    if (dbAccountsError) {
      throw new Error(
        `Could not read DB TikTok Ads accounts: ${dbAccountsError.message}`,
      );
    }

    if (!fetchMetrics) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "tiktok_ads_sync_success",
        severity: "info",
        metadata: {
          ...tokenAuditMetadata,
          advertisers_upserted: accountResults.length,
          metrics_synced: false,
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
        connection_id: connection.ad_platform_connection_id,
        advertisers_upserted: accountResults.length,
        account_results: accountResults,
        metrics_synced: false,
      });
    }

    for (const account of dbAccounts ?? []) {
      const advertiserId = String(account.external_account_id);

      if (advertiserIds.length > 0 && !advertiserIds.includes(advertiserId)) {
        continue;
      }

      const { data: syncRunId, error: runError } = await supabaseAdmin.rpc(
        "start_ad_sync_run",
        {
          p_workspace_id: workspaceId,
          p_ad_sync_job_id: null,
          p_ad_platform_connection_id: connection.ad_platform_connection_id,
          p_ad_account_id: account.id,
          p_platform: "tiktok_ads",
          p_sync_mode: syncMode,
          p_date_from: dateFrom,
          p_date_to: dateTo,
          p_actor_user_id: actor.user_id,
          p_actor_email: actor.email,
          p_actor_role: actor.role,
          p_metadata: {
            source: FUNCTION_NAME,
            external_account_id: account.external_account_id,
            level,
            api_version: tiktokApiVersion,
            ...tokenAuditMetadata,
          },
        },
      );

      if (runError) throw new Error(runError.message);

      try {
        const reportRows = await fetchTikTokIntegratedReport({
          apiVersion: tiktokApiVersion,
          accessToken,
          advertiserId,
          dateFrom,
          dateTo,
          level,
        });

        const normalizedRows = reportRows.map((row) =>
          normalizeReportRow({
            row,
            account,
            level,
          }),
        );

        const { data: insertedRows, error: insertError } =
          await supabaseAdmin.rpc("insert_tiktok_ads_raw_insights_batch", {
            p_workspace_id: workspaceId,
            p_ad_sync_run_log_id: syncRunId,
            p_ad_platform_connection_id: connection.ad_platform_connection_id,
            p_ad_account_id: account.id,
            p_rows: normalizedRows,
          });

        if (insertError) throw new Error(insertError.message);

        await supabaseAdmin.rpc("finish_ad_sync_run", {
          p_ad_sync_run_log_id: syncRunId,
          p_status: "success",
          p_rows_received: reportRows.length,
          p_rows_inserted: insertedRows ?? 0,
          p_rows_updated: 0,
          p_rows_failed: 0,
          p_error_message: null,
          p_metadata: {
            source: FUNCTION_NAME,
            level,
            date_from: dateFrom,
            date_to: dateTo,
            ...tokenAuditMetadata,
          },
        });

        syncResults.push({
          ad_account_id: account.id,
          external_account_id: account.external_account_id,
          status: "success",
          sync_run_log_id: syncRunId,
          rows_received: reportRows.length,
          rows_inserted: insertedRows ?? 0,
        });
      } catch (error) {
        const accountTokenAuditMetadata = {
          ...tokenAuditMetadata,
          ...(tokenAuditMetadata.used_access_token_directly &&
          isTikTokUnauthorizedError(error)
            ? { reconnect_required: true }
            : {}),
        };
        const message = messageForTikTokError(
          error,
          accountTokenAuditMetadata as TokenAuditMetadata,
        );

        await supabaseAdmin.rpc("finish_ad_sync_run", {
          p_ad_sync_run_log_id: syncRunId,
          p_status: "failed",
          p_rows_received: 0,
          p_rows_inserted: 0,
          p_rows_updated: 0,
          p_rows_failed: 1,
          p_error_message: message,
          p_metadata: {
            source: FUNCTION_NAME,
            level,
            date_from: dateFrom,
            date_to: dateTo,
            ...accountTokenAuditMetadata,
          },
        });

        syncResults.push({
          ad_account_id: account.id,
          external_account_id: account.external_account_id,
          status: "failed",
          sync_run_log_id: syncRunId,
          error: message,
          reconnect_required:
            accountTokenAuditMetadata.reconnect_required ?? false,
        });
      }
    }

    const failedAccounts = syncResults.filter(
      (item) => item.status === "failed",
    );
    const reconnectRequired = syncResults.some(
      (item) => item.reconnect_required === true,
    );

    if (reconnectRequired) {
      tokenAuditMetadata = {
        ...tokenAuditMetadata,
        reconnect_required: true,
      };
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action:
        failedAccounts.length > 0
          ? "tiktok_ads_sync_partial_or_failed"
          : "tiktok_ads_sync_success",
      severity: failedAccounts.length > 0 ? "error" : "info",
      metadata: {
        ...tokenAuditMetadata,
        connection_id: connection.ad_platform_connection_id,
        advertisers_upserted: accountResults.length,
        accounts_synced: syncResults.length,
        failed_accounts: failedAccounts.length,
        date_from: dateFrom,
        date_to: dateTo,
        level,
      },
    });

    return jsonResponse(failedAccounts.length > 0 ? 207 : 200, {
      ok: failedAccounts.length === 0,
      function: FUNCTION_NAME,
      mode: actor.mode,
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: actor.role,
      },
      workspace_id: workspaceId,
      connection_id: connection.ad_platform_connection_id,
      date_from: dateFrom,
      date_to: dateTo,
      level,
      advertisers_upserted: accountResults.length,
      account_results: accountResults,
      sync_results: syncResults,
    });
  } catch (error) {
    const message = messageForTikTokError(
      error,
      tokenAuditMetadata as TokenAuditMetadata,
    );

    if (
      tokenAuditMetadata.used_access_token_directly &&
      isTikTokUnauthorizedError(error)
    ) {
      tokenAuditMetadata = {
        ...tokenAuditMetadata,
        reconnect_required: true,
      };
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "tiktok_ads_sync_failed",
      severity: "error",
      metadata: {
        ...tokenAuditMetadata,
        error: message,
        date_from: dateFrom,
        date_to: dateTo,
        level,
      },
    });

    return jsonResponse(500, {
      ok: false,
      function: FUNCTION_NAME,
      error: "tiktok-ads-sync failed.",
      details: message,
      reconnect_required: tokenAuditMetadata.reconnect_required ?? false,
    });
  }
});
