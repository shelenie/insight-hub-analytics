import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  workspace_id?: string;
  ad_platform_connection_id?: string | null;
  ad_account_id?: string | null;

  date_from?: string;
  date_to?: string;
  level?: "campaign" | "adset" | "ad";
  sync_mode?: "manual" | "scheduled" | "backfill";
  fetch_accounts?: boolean;
  fetch_insights?: boolean;

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

type MetaAdAccount = {
  id: string;
  account_id?: string;
  name?: string;
  currency?: string;
  timezone_name?: string;
  account_status?: number;
};

const FUNCTION_NAME = "meta-ads-sync";

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

function todayIsoDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoIsoDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function normalizeLevel(input: unknown): "campaign" | "adset" | "ad" {
  if (input === "adset" || input === "ad") return input;
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

function sumActions(actions: unknown, actionTypes: string[]) {
  if (!Array.isArray(actions)) return 0;

  return actions.reduce((sum, item: any) => {
    const type = String(item?.action_type ?? "");
    if (!actionTypes.includes(type)) return sum;
    return sum + numberValue(item?.value);
  }, 0);
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

async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function graphGetAll(params: {
  apiVersion: string;
  path: string;
  accessToken: string;
  appSecret: string;
  searchParams?: Record<string, string>;
  maxPages?: number;
}) {
  const rows: any[] = [];
  let page = 0;

  const appsecretProof = await hmacSha256Hex(params.appSecret, params.accessToken);

  let url: string | null = `https://graph.facebook.com/${params.apiVersion}${params.path}`;
  const firstUrl = new URL(url);

  firstUrl.searchParams.set("access_token", params.accessToken);
  firstUrl.searchParams.set("appsecret_proof", appsecretProof);

  for (const [key, value] of Object.entries(params.searchParams ?? {})) {
    firstUrl.searchParams.set(key, value);
  }

  url = firstUrl.toString();

  while (url && page < (params.maxPages ?? 20)) {
    page++;

    const response = await fetch(url, { method: "GET" });
    const data = await response.json();

    if (!response.ok) {
      throw new Error(
        `Meta Graph API error ${response.status}: ${
          data?.error?.message ?? JSON.stringify(data)
        }`,
      );
    }

    if (Array.isArray(data?.data)) {
      rows.push(...data.data);
    }

    url = data?.paging?.next ?? null;
  }

  return rows;
}

function accountStatusFromMeta(accountStatus: unknown) {
  // Meta account_status = 1 usually means active.
  // We keep unknown values as unknown instead of guessing too much.
  return Number(accountStatus) === 1 ? "active" : "unknown";
}

function normalizeAdAccount(row: any): MetaAdAccount {
  return {
    id: row?.id,
    account_id: row?.account_id,
    name: row?.name,
    currency: row?.currency,
    timezone_name: row?.timezone_name,
    account_status: row?.account_status,
  };
}

function normalizeInsightRow(params: {
  row: any;
  account: any;
  level: "campaign" | "adset" | "ad";
}) {
  const row = params.row;
  const account = params.account;

  const leads = sumActions(row.actions, [
    "lead",
    "onsite_conversion.lead_grouped",
    "offsite_conversion.fb_pixel_lead",
  ]);

  const purchases = sumActions(row.actions, [
    "purchase",
    "omni_purchase",
    "offsite_conversion.fb_pixel_purchase",
  ]);

  const revenue = sumActions(row.action_values, [
    "purchase",
    "omni_purchase",
    "offsite_conversion.fb_pixel_purchase",
  ]);

  const externalCampaignId = row.campaign_id ?? null;
  const externalAdsetId = row.adset_id ?? null;
  const externalAdId = row.ad_id ?? null;
  const insightDate = row.date_start ?? row.date_stop ?? null;

  const sourceHash = [
    "meta_ads",
    account.external_account_id,
    insightDate,
    params.level,
    externalCampaignId,
    externalAdsetId,
    externalAdId,
  ].join("|");

  return {
    insight_date: insightDate,
    level: params.level,
    external_campaign_id: externalCampaignId,
    campaign_name: row.campaign_name ?? null,
    external_adset_id: externalAdsetId,
    adset_name: row.adset_name ?? null,
    external_ad_id: externalAdId,
    ad_name: row.ad_name ?? null,
    currency: account.account_currency ?? null,
    spend: String(numberValue(row.spend)),
    impressions: String(integerValue(row.impressions)),
    clicks: String(integerValue(row.clicks)),
    link_clicks: String(Math.round(sumActions(row.actions, ["link_click"]))),
    leads: String(Math.round(leads)),
    purchases: String(Math.round(purchases)),
    revenue: String(numberValue(revenue)),
    conversions: String(Math.round(purchases || leads || 0)),
    source_hash: sourceHash,
    raw_metrics: {
      spend: row.spend ?? null,
      impressions: row.impressions ?? null,
      clicks: row.clicks ?? null,
      actions: row.actions ?? [],
      action_values: row.action_values ?? [],
    },
    raw_dimensions: {
      campaign_id: externalCampaignId,
      campaign_name: row.campaign_name ?? null,
      adset_id: externalAdsetId,
      adset_name: row.adset_name ?? null,
      ad_id: externalAdId,
      ad_name: row.ad_name ?? null,
      account_id: account.external_account_id,
    },
    raw_payload: row,
    metadata: {
      source: FUNCTION_NAME,
      normalized_at: new Date().toISOString(),
    },
  };
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
    const { data: connection, error: connectionError } = await params.supabaseAdmin
      .from("ad_platform_connections")
      .insert({
        workspace_id: params.workspaceId,
        platform: "meta_ads",
        connection_name: "MOCK_META_SYNC_CONNECTION_DO_NOT_USE",
        status: "active",
        provider_account_id: "mock_meta_user",
        provider_account_email: params.actor.email,
        provider_business_id: "mock_business",
        provider_business_name: "Mock Meta Business",
        vault_secret_name: "mock_secret_not_used",
        scopes: ["ads_read", "business_management"],
        metadata: {
          created_by_edge_test: "meta_ads_sync_mock",
        },
      })
      .select("id")
      .single();

    if (connectionError) throw new Error(connectionError.message);
    connectionId = connection.id;

    const { data: upsertedAccountId, error: accountError } =
      await params.supabaseAdmin.rpc("upsert_meta_ad_account", {
        p_workspace_id: params.workspaceId,
        p_ad_platform_connection_id: connectionId,
        p_external_account_id: "act_mock_meta_sync",
        p_external_account_name: "MOCK Meta Account",
        p_account_currency: "USD",
        p_account_timezone: "America/New_York",
        p_status: "active",
        p_metadata: {
          created_by_edge_test: "meta_ads_sync_mock",
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
        p_platform: "meta_ads",
        p_sync_mode: "manual",
        p_date_from: daysAgoIsoDate(2),
        p_date_to: daysAgoIsoDate(1),
        p_actor_user_id: params.actor.user_id,
        p_actor_email: params.actor.email,
        p_actor_role: params.actor.role,
        p_metadata: {
          created_by_edge_test: "meta_ads_sync_mock",
        },
      },
    );

    if (runError) throw new Error(runError.message);
    syncRunId = runId;

    const { data: insertedRows, error: insertError } =
      await params.supabaseAdmin.rpc("insert_meta_ad_raw_insights_batch", {
        p_workspace_id: params.workspaceId,
        p_ad_sync_run_log_id: syncRunId,
        p_ad_platform_connection_id: connectionId,
        p_ad_account_id: adAccountId,
        p_rows: [
          {
            insight_date: daysAgoIsoDate(2),
            level: "campaign",
            external_campaign_id: "mock_campaign_1",
            campaign_name: "MOCK Campaign 1",
            currency: "USD",
            spend: "100.25",
            impressions: "10000",
            clicks: "500",
            link_clicks: "450",
            leads: "25",
            purchases: "2",
            revenue: "600",
            conversions: "2",
            source_hash: "meta_ads_sync_mock_hash_1",
            metadata: {
              created_by_edge_test: "meta_ads_sync_mock",
            },
          },
          {
            insight_date: daysAgoIsoDate(1),
            level: "campaign",
            external_campaign_id: "mock_campaign_2",
            campaign_name: "MOCK Campaign 2",
            currency: "USD",
            spend: "200.50",
            impressions: "20000",
            clicks: "800",
            link_clicks: "700",
            leads: "40",
            purchases: "4",
            revenue: "1200",
            conversions: "4",
            source_hash: "meta_ads_sync_mock_hash_2",
            metadata: {
              created_by_edge_test: "meta_ads_sync_mock",
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
        created_by_edge_test: "meta_ads_sync_mock",
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

    await params.supabaseAdmin.from("ad_sync_run_logs").delete().eq("id", syncRunId);
    cleanup.sync_runs = 1;

    await params.supabaseAdmin.from("ad_accounts").delete().eq("id", adAccountId);
    cleanup.ad_accounts = 1;

    await params.supabaseAdmin
      .from("ad_platform_connections")
      .delete()
      .eq("id", connectionId);
    cleanup.connections = 1;

    return {
      ok: true,
      real_meta_api_called: false,
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
      await params.supabaseAdmin.from("ad_sync_run_logs").delete().eq("id", syncRunId);
    }

    if (adAccountId) {
      await params.supabaseAdmin.from("ad_accounts").delete().eq("id", adAccountId);
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
  const fetchAccounts = body.fetch_accounts ?? true;
  const fetchInsights = body.fetch_insights ?? true;

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const metaAppSecret = requiredEnv("META_APP_SECRET");
  const metaApiVersion = optionalEnv("META_API_VERSION", "v25.0");

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
      action: "meta_ads_sync_permission_check_failed",
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
      action: "meta_ads_sync_denied",
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
    action: "meta_ads_sync_started",
    severity: "info",
    metadata: {
      date_from: dateFrom,
      date_to: dateTo,
      level,
      sync_mode: syncMode,
      fetch_accounts: fetchAccounts,
      fetch_insights: fetchInsights,
      test_mode: body.test_mode ?? null,
    },
  });

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
        action: "meta_ads_sync_mock_success",
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
        action: "meta_ads_sync_dry_run_success",
        severity: "info",
        metadata: {
          real_meta_api_called: false,
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
        real_meta_api_called: false,
      });
    }

    const { data: connectionRows, error: connectionError } = await supabaseAdmin.rpc(
      "get_active_meta_ads_connection_for_workspace",
      {
        p_workspace_id: workspaceId,
        p_ad_platform_connection_id: body.ad_platform_connection_id ?? null,
      },
    );

    if (connectionError) {
      throw new Error(`Could not read Meta connection: ${connectionError.message}`);
    }

    const connection = Array.isArray(connectionRows) ? connectionRows[0] : connectionRows;

    if (!connection?.ad_platform_connection_id) {
      return jsonResponse(404, {
        ok: false,
        error: "Active Meta Ads connection not found. Complete Meta OAuth first.",
      });
    }

    const { data: secretPayload, error: secretError } = await supabaseAdmin.rpc(
      "get_meta_ads_oauth_secret_payload",
      {
        p_vault_secret_name: connection.vault_secret_name,
      },
    );

    if (secretError) {
      throw new Error(`Could not read Meta token: ${secretError.message}`);
    }

    const accessToken = secretPayload?.access_token;

    if (!accessToken) {
      throw new Error("Meta access token missing in Vault payload.");
    }

    let accounts: MetaAdAccount[] = [];
    const accountResults: Array<Record<string, unknown>> = [];
    const syncResults: Array<Record<string, unknown>> = [];

    if (fetchAccounts) {
      const accountRows = await graphGetAll({
        apiVersion: metaApiVersion,
        path: "/me/adaccounts",
        accessToken,
        appSecret: metaAppSecret,
        searchParams: {
          fields: "id,account_id,name,currency,timezone_name,account_status",
          limit: "100",
        },
        maxPages: 20,
      });

      accounts = accountRows.map(normalizeAdAccount).filter((account) => Boolean(account.id));

      for (const account of accounts) {
        const { data: adAccountId, error: accountError } =
          await supabaseAdmin.rpc("upsert_meta_ad_account", {
            p_workspace_id: workspaceId,
            p_ad_platform_connection_id: connection.ad_platform_connection_id,
            p_external_account_id: account.id,
            p_external_account_name: account.name ?? account.id,
            p_account_currency: account.currency ?? null,
            p_account_timezone: account.timezone_name ?? null,
            p_status: accountStatusFromMeta(account.account_status),
            p_metadata: {
              source: FUNCTION_NAME,
              meta_account_id: account.account_id ?? null,
              account_status: account.account_status ?? null,
              synced_at: new Date().toISOString(),
            },
          });

        if (accountError) throw new Error(accountError.message);

        accountResults.push({
          external_account_id: account.id,
          external_account_name: account.name ?? null,
          ad_account_id: adAccountId,
        });
      }
    }

    let dbAccountsQuery = supabaseAdmin
      .from("ad_accounts")
      .select("*")
      .eq("workspace_id", workspaceId)
      .eq("platform", "meta_ads")
      .eq("ad_platform_connection_id", connection.ad_platform_connection_id)
      .eq("is_active", true);

    if (body.ad_account_id) {
      dbAccountsQuery = dbAccountsQuery.eq("id", body.ad_account_id);
    }

    const { data: dbAccounts, error: dbAccountsError } = await dbAccountsQuery;

    if (dbAccountsError) {
      throw new Error(`Could not read DB ad accounts: ${dbAccountsError.message}`);
    }

    if (!fetchInsights) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "meta_ads_sync_success",
        severity: "info",
        metadata: {
          accounts_upserted: accountResults.length,
          insights_synced: false,
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
        accounts_upserted: accountResults.length,
        account_results: accountResults,
        insights_synced: false,
      });
    }

    for (const account of dbAccounts ?? []) {
      const { data: syncRunId, error: runError } = await supabaseAdmin.rpc(
        "start_ad_sync_run",
        {
          p_workspace_id: workspaceId,
          p_ad_sync_job_id: null,
          p_ad_platform_connection_id: connection.ad_platform_connection_id,
          p_ad_account_id: account.id,
          p_platform: "meta_ads",
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
            api_version: metaApiVersion,
          },
        },
      );

      if (runError) throw new Error(runError.message);

      try {
        const fields = [
          "date_start",
          "date_stop",
          "campaign_id",
          "campaign_name",
          "adset_id",
          "adset_name",
          "ad_id",
          "ad_name",
          "spend",
          "impressions",
          "clicks",
          "actions",
          "action_values",
        ].join(",");

        const insightRows = await graphGetAll({
          apiVersion: metaApiVersion,
          path: `/${account.external_account_id}/insights`,
          accessToken,
          appSecret: metaAppSecret,
          searchParams: {
            fields,
            level,
            time_increment: "1",
            time_range: JSON.stringify({
              since: dateFrom,
              until: dateTo,
            }),
            limit: "100",
          },
          maxPages: 50,
        });

        const normalizedRows = insightRows.map((row) =>
          normalizeInsightRow({
            row,
            account,
            level,
          }),
        );

        const { data: insertedRows, error: insertError } =
          await supabaseAdmin.rpc("insert_meta_ad_raw_insights_batch", {
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
          p_rows_received: insightRows.length,
          p_rows_inserted: insertedRows ?? 0,
          p_rows_updated: 0,
          p_rows_failed: 0,
          p_error_message: null,
          p_metadata: {
            source: FUNCTION_NAME,
            level,
            date_from: dateFrom,
            date_to: dateTo,
          },
        });

        syncResults.push({
          ad_account_id: account.id,
          external_account_id: account.external_account_id,
          status: "success",
          sync_run_log_id: syncRunId,
          rows_received: insightRows.length,
          rows_inserted: insertedRows ?? 0,
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

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
          },
        });

        syncResults.push({
          ad_account_id: account.id,
          external_account_id: account.external_account_id,
          status: "failed",
          sync_run_log_id: syncRunId,
          error: message,
        });
      }
    }

    const failedAccounts = syncResults.filter((item) => item.status === "failed");

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action:
        failedAccounts.length > 0
          ? "meta_ads_sync_partial_or_failed"
          : "meta_ads_sync_success",
      severity: failedAccounts.length > 0 ? "error" : "info",
      metadata: {
        connection_id: connection.ad_platform_connection_id,
        accounts_upserted: accountResults.length,
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
      accounts_upserted: accountResults.length,
      account_results: accountResults,
      sync_results: syncResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "meta_ads_sync_failed",
      severity: "error",
      metadata: {
        error: message,
        date_from: dateFrom,
        date_to: dateTo,
        level,
      },
    });

    return jsonResponse(500, {
      ok: false,
      function: FUNCTION_NAME,
      error: "meta-ads-sync failed.",
      details: message,
    });
  }
});
