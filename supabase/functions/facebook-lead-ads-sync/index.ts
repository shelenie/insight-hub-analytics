import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  workspace_id?: string;
  ad_platform_connection_id?: string | null;
  facebook_lead_form_id?: string | null;
  form_id?: string | null;
  page_id?: string | null;

  date_from?: string;
  date_to?: string;
  sync_mode?: "manual" | "scheduled" | "backfill";
  fetch_forms?: boolean;
  fetch_leads?: boolean;
  max_forms?: number;

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

const FUNCTION_NAME = "facebook-lead-ads-sync";

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

function daysAgoIsoDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function isIsoDate(value: string) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value);
}

function isoDateToTimestampStart(value: string) {
  return `${value}T00:00:00.000Z`;
}

function isoDateToTimestampEnd(value: string) {
  return `${value}T23:59:59.999Z`;
}

function unixSeconds(value: string) {
  return Math.floor(new Date(value).getTime() / 1000);
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

function normalizeSecretPayload(payload: unknown): any {
  if (typeof payload === "string") {
    return JSON.parse(payload);
  }

  return payload ?? {};
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

function fieldValue(fieldMap: Record<string, string>, names: string[]) {
  for (const name of names) {
    const value = fieldMap[name];
    if (value) return value;
  }

  return null;
}

function normalizeFieldData(fieldData: any[]) {
  const map: Record<string, string> = {};

  for (const item of fieldData ?? []) {
    const name = String(item?.name ?? "").toLowerCase().trim();
    const values = Array.isArray(item?.values) ? item.values : [];

    if (!name) continue;

    map[name] = values.map((value) => String(value)).join(", ");
  }

  const fullName = fieldValue(map, [
    "full_name",
    "fullname",
    "name",
    "your_name",
    "first_and_last_name",
  ]);

  const email = fieldValue(map, [
    "email",
    "email_address",
    "work_email",
  ]);

  const phone = fieldValue(map, [
    "phone",
    "phone_number",
    "mobile_phone_number",
    "mobile",
  ]);

  let firstName = fieldValue(map, ["first_name", "firstname"]);
  let lastName = fieldValue(map, ["last_name", "lastname"]);

  if (!firstName && fullName) {
    const parts = fullName.split(" ").filter(Boolean);
    firstName = parts[0] ?? null;
    lastName = parts.slice(1).join(" ") || lastName;
  }

  return {
    map,
    full_name: fullName,
    first_name: firstName,
    last_name: lastName,
    email,
    phone,
  };
}

function normalizeLeadCreatedTime(value: unknown) {
  if (!value) return null;

  const date = new Date(String(value));

  if (Number.isNaN(date.getTime())) {
    return null;
  }

  return date.toISOString();
}

async function runMockSync(params: {
  supabaseAdmin: any;
  workspaceId: string;
  actor: ActorContext;
}) {
  let connectionId: string | null = null;
  let formId: string | null = null;
  let leadRecordId: string | null = null;
  let syncRunId: string | null = null;

  const cleanup = {
    leads: 0,
    sync_runs: 0,
    forms: 0,
    connections: 0,
  };

  try {
    await params.supabaseAdmin
      .from("facebook_lead_records")
      .delete()
      .eq("workspace_id", params.workspaceId)
      .eq("external_lead_id", "mock_fb_lead_ads_sync_lead");

    await params.supabaseAdmin
      .from("facebook_lead_forms")
      .delete()
      .eq("workspace_id", params.workspaceId)
      .eq("form_id", "mock_fb_lead_ads_sync_form");

    const { data: connection, error: connectionError } = await params.supabaseAdmin
      .from("ad_platform_connections")
      .insert({
        workspace_id: params.workspaceId,
        platform: "meta_ads",
        connection_name: "MOCK_FACEBOOK_LEAD_ADS_CONNECTION_DO_NOT_USE",
        status: "active",
        provider_account_id: "mock_meta_user_leads",
        provider_account_email: params.actor.email,
        provider_business_id: "mock_meta_business_leads",
        provider_business_name: "Mock Meta Business Leads",
        vault_secret_name: "mock_meta_lead_ads_secret_not_used",
        scopes: ["ads_read", "business_management", "leads_retrieval"],
        metadata: {
          created_by_edge_test: "facebook_lead_ads_sync_mock",
        },
      })
      .select("id")
      .single();

    if (connectionError) throw new Error(connectionError.message);
    connectionId = connection.id;

    const { data: createdFormId, error: formError } =
      await params.supabaseAdmin.rpc("upsert_facebook_lead_form", {
        p_workspace_id: params.workspaceId,
        p_ad_platform_connection_id: connectionId,
        p_page_id: "mock_fb_page",
        p_page_name: "MOCK Facebook Page",
        p_form_id: "mock_fb_lead_ads_sync_form",
        p_form_name: "MOCK Lead Form",
        p_status: "active",
        p_client_id: null,
        p_project_id: null,
        p_funnel_id: null,
        p_metadata: {
          created_by_edge_test: "facebook_lead_ads_sync_mock",
        },
      });

    if (formError) throw new Error(formError.message);
    formId = createdFormId;

    const { data: runId, error: runError } = await params.supabaseAdmin.rpc(
      "start_facebook_lead_sync_run",
      {
        p_workspace_id: params.workspaceId,
        p_ad_platform_connection_id: connectionId,
        p_facebook_lead_form_id: formId,
        p_sync_mode: "manual",
        p_date_from: isoDateToTimestampStart(daysAgoIsoDate(1)),
        p_date_to: isoDateToTimestampEnd(daysAgoIsoDate(0)),
        p_actor_user_id: params.actor.user_id,
        p_actor_email: params.actor.email,
        p_actor_role: params.actor.role,
        p_metadata: {
          created_by_edge_test: "facebook_lead_ads_sync_mock",
        },
      },
    );

    if (runError) throw new Error(runError.message);
    syncRunId = runId;

    const { data: leadRows, error: leadError } =
      await params.supabaseAdmin.rpc("upsert_facebook_lead_record", {
        p_workspace_id: params.workspaceId,
        p_ad_platform_connection_id: connectionId,
        p_facebook_lead_form_id: formId,
        p_external_lead_id: "mock_fb_lead_ads_sync_lead",
        p_page_id: "mock_fb_page",
        p_page_name: "MOCK Facebook Page",
        p_form_id: "mock_fb_lead_ads_sync_form",
        p_form_name: "MOCK Lead Form",
        p_lead_created_time: new Date().toISOString(),
        p_full_name: "Mock Lead",
        p_first_name: "Mock",
        p_last_name: "Lead",
        p_email: "mock.lead@example.com",
        p_phone: "+15550001111",
        p_campaign_id: "mock_campaign",
        p_campaign_name: "MOCK Campaign",
        p_adset_id: "mock_adset",
        p_adset_name: "MOCK Adset",
        p_ad_id: "mock_ad",
        p_ad_name: "MOCK Ad",
        p_field_data: {
          email: "mock.lead@example.com",
          phone: "+15550001111",
        },
        p_raw_payload: {
          source: "mock_sync",
        },
        p_metadata: {
          created_by_edge_test: "facebook_lead_ads_sync_mock",
        },
      });

    if (leadError) throw new Error(leadError.message);

    const leadResult = Array.isArray(leadRows) ? leadRows[0] : leadRows;
    leadRecordId = leadResult?.facebook_lead_record_id ?? null;

    await params.supabaseAdmin.rpc("finish_facebook_lead_sync_run", {
      p_sync_run_id: syncRunId,
      p_status: "success",
      p_forms_seen: 1,
      p_leads_received: 1,
      p_leads_inserted: 1,
      p_leads_updated: 0,
      p_leads_failed: 0,
      p_error_message: null,
      p_metadata: {
        created_by_edge_test: "facebook_lead_ads_sync_mock",
        test_result: "ok",
      },
    });

    const { count: leadCount } = await params.supabaseAdmin
      .from("facebook_lead_records")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", params.workspaceId)
      .eq("external_lead_id", "mock_fb_lead_ads_sync_lead");

    await params.supabaseAdmin
      .from("facebook_lead_records")
      .delete()
      .eq("id", leadRecordId);
    cleanup.leads = leadCount ?? 0;

    await params.supabaseAdmin
      .from("facebook_lead_sync_run_logs")
      .delete()
      .eq("id", syncRunId);
    cleanup.sync_runs = 1;

    await params.supabaseAdmin
      .from("facebook_lead_forms")
      .delete()
      .eq("id", formId);
    cleanup.forms = 1;

    await params.supabaseAdmin
      .from("ad_platform_connections")
      .delete()
      .eq("id", connectionId);
    cleanup.connections = 1;

    return {
      ok: true,
      real_meta_api_called: false,
      test_mode: "mock_sync",
      forms_seen: 1,
      leads_received: 1,
      leads_inserted: 1,
      cleanup,
    };
  } catch (error) {
    if (leadRecordId) {
      await params.supabaseAdmin
        .from("facebook_lead_records")
        .delete()
        .eq("id", leadRecordId);
    }

    if (syncRunId) {
      await params.supabaseAdmin
        .from("facebook_lead_sync_run_logs")
        .delete()
        .eq("id", syncRunId);
    }

    if (formId) {
      await params.supabaseAdmin
        .from("facebook_lead_forms")
        .delete()
        .eq("id", formId);
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
  const dateTo = body.date_to ?? daysAgoIsoDate(0);

  if (!isIsoDate(dateFrom) || !isIsoDate(dateTo)) {
    return jsonResponse(400, {
      ok: false,
      error: "date_from and date_to must be YYYY-MM-DD.",
    });
  }

  const syncMode = body.sync_mode ?? "manual";
  const fetchForms = body.fetch_forms ?? true;
  const fetchLeads = body.fetch_leads ?? true;
  const maxForms = Math.max(1, Math.min(Number(body.max_forms ?? 50), 200));

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
      action: "facebook_lead_ads_sync_permission_check_failed",
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
      action: "facebook_lead_ads_sync_denied",
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
    action: "facebook_lead_ads_sync_started",
    severity: "info",
    metadata: {
      date_from: dateFrom,
      date_to: dateTo,
      sync_mode: syncMode,
      fetch_forms: fetchForms,
      fetch_leads: fetchLeads,
      test_mode: body.test_mode ?? null,
      api_version: metaApiVersion,
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
        action: "facebook_lead_ads_sync_mock_success",
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
        action: "facebook_lead_ads_sync_dry_run_success",
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

    const { data: secretPayloadRaw, error: secretError } = await supabaseAdmin.rpc(
      "get_meta_ads_oauth_secret_payload",
      {
        p_vault_secret_name: connection.vault_secret_name,
      },
    );

    if (secretError) {
      throw new Error(`Could not read Meta token: ${secretError.message}`);
    }

    const secretPayload = normalizeSecretPayload(secretPayloadRaw);
    const userAccessToken = secretPayload?.access_token;

    if (!userAccessToken) {
      throw new Error("Meta access token missing in Vault payload.");
    }

    const runStart = isoDateToTimestampStart(dateFrom);
    const runEnd = isoDateToTimestampEnd(dateTo);

    const { data: syncRunId, error: runError } = await supabaseAdmin.rpc(
      "start_facebook_lead_sync_run",
      {
        p_workspace_id: workspaceId,
        p_ad_platform_connection_id: connection.ad_platform_connection_id,
        p_facebook_lead_form_id: null,
        p_sync_mode: syncMode,
        p_date_from: runStart,
        p_date_to: runEnd,
        p_actor_user_id: actor.user_id,
        p_actor_email: actor.email,
        p_actor_role: actor.role,
        p_metadata: {
          source: FUNCTION_NAME,
          api_version: metaApiVersion,
        },
      },
    );

    if (runError) throw new Error(runError.message);

    let formsSeen = 0;
    let leadsReceived = 0;
    let leadsInserted = 0;
    let leadsUpdated = 0;
    let leadsFailed = 0;

    const formResults: Array<Record<string, unknown>> = [];
    const leadResults: Array<Record<string, unknown>> = [];

    try {
      const pages = await graphGetAll({
        apiVersion: metaApiVersion,
        path: "/me/accounts",
        accessToken: userAccessToken,
        appSecret: metaAppSecret,
        searchParams: {
          fields: "id,name,access_token",
          limit: "100",
        },
        maxPages: 10,
      });

      const formsToSync: Array<{
        page_id: string;
        page_name: string | null;
        page_access_token: string | null;
        form_id: string;
        form_name: string | null;
        status: string | null;
      }> = [];

      if (fetchForms) {
        for (const page of pages) {
          if (body.page_id && String(page.id) !== String(body.page_id)) continue;

          const pageAccessToken = page.access_token ?? userAccessToken;

          const pageForms = await graphGetAll({
            apiVersion: metaApiVersion,
            path: `/${page.id}/leadgen_forms`,
            accessToken: pageAccessToken,
            appSecret: metaAppSecret,
            searchParams: {
              fields: "id,name,status,leads_count",
              limit: "100",
            },
            maxPages: 10,
          });

          for (const form of pageForms) {
            if (body.form_id && String(form.id) !== String(body.form_id)) continue;

            formsToSync.push({
              page_id: String(page.id),
              page_name: page.name ?? null,
              page_access_token: pageAccessToken,
              form_id: String(form.id),
              form_name: form.name ?? null,
              status: String(form.status ?? "active").toLowerCase(),
            });
          }
        }
      } else if (body.form_id) {
        formsToSync.push({
          page_id: body.page_id ?? "unknown",
          page_name: null,
          page_access_token: userAccessToken,
          form_id: body.form_id,
          form_name: null,
          status: "active",
        });
      }

      for (const form of formsToSync.slice(0, maxForms)) {
        formsSeen++;

        const { data: fbFormId, error: formError } =
          await supabaseAdmin.rpc("upsert_facebook_lead_form", {
            p_workspace_id: workspaceId,
            p_ad_platform_connection_id: connection.ad_platform_connection_id,
            p_page_id: form.page_id,
            p_page_name: form.page_name,
            p_form_id: form.form_id,
            p_form_name: form.form_name,
            p_status: form.status === "active" ? "active" : "unknown",
            p_client_id: null,
            p_project_id: null,
            p_funnel_id: null,
            p_metadata: {
              source: FUNCTION_NAME,
              synced_at: new Date().toISOString(),
            },
          });

        if (formError) throw new Error(formError.message);

        formResults.push({
          facebook_lead_form_id: fbFormId,
          page_id: form.page_id,
          form_id: form.form_id,
          form_name: form.form_name,
        });

        if (!fetchLeads) continue;

        try {
          const leads = await graphGetAll({
            apiVersion: metaApiVersion,
            path: `/${form.form_id}/leads`,
            accessToken: form.page_access_token ?? userAccessToken,
            appSecret: metaAppSecret,
            searchParams: {
              fields:
                "id,created_time,field_data,ad_id,ad_name,adset_id,adset_name,campaign_id,campaign_name,form_id",
              since: String(unixSeconds(runStart)),
              until: String(unixSeconds(runEnd)),
              limit: "100",
            },
            maxPages: 50,
          });

          leadsReceived += leads.length;

          for (const lead of leads) {
            try {
              const normalized = normalizeFieldData(lead.field_data ?? []);

              const { data: leadRows, error: leadError } =
                await supabaseAdmin.rpc("upsert_facebook_lead_record", {
                  p_workspace_id: workspaceId,
                  p_ad_platform_connection_id: connection.ad_platform_connection_id,
                  p_facebook_lead_form_id: fbFormId,
                  p_external_lead_id: String(lead.id),
                  p_page_id: form.page_id,
                  p_page_name: form.page_name,
                  p_form_id: form.form_id,
                  p_form_name: form.form_name,
                  p_lead_created_time: normalizeLeadCreatedTime(lead.created_time),
                  p_full_name: normalized.full_name,
                  p_first_name: normalized.first_name,
                  p_last_name: normalized.last_name,
                  p_email: normalized.email,
                  p_phone: normalized.phone,
                  p_campaign_id: lead.campaign_id ?? null,
                  p_campaign_name: lead.campaign_name ?? null,
                  p_adset_id: lead.adset_id ?? null,
                  p_adset_name: lead.adset_name ?? null,
                  p_ad_id: lead.ad_id ?? null,
                  p_ad_name: lead.ad_name ?? null,
                  p_field_data: normalized.map,
                  p_raw_payload: lead,
                  p_metadata: {
                    source: FUNCTION_NAME,
                    synced_at: new Date().toISOString(),
                  },
                });

              if (leadError) throw new Error(leadError.message);

              const leadResult = Array.isArray(leadRows) ? leadRows[0] : leadRows;
              const operation = leadResult?.operation ?? "unknown";

              if (operation === "inserted") leadsInserted++;
              if (operation === "updated") leadsUpdated++;

              leadResults.push({
                external_lead_id: lead.id,
                form_id: form.form_id,
                operation,
              });
            } catch (leadError) {
              leadsFailed++;

              leadResults.push({
                external_lead_id: lead.id ?? null,
                form_id: form.form_id,
                operation: "failed",
                error: leadError instanceof Error ? leadError.message : String(leadError),
              });
            }
          }
        } catch (formLeadError) {
          leadsFailed++;

          leadResults.push({
            form_id: form.form_id,
            operation: "form_leads_failed",
            error:
              formLeadError instanceof Error
                ? formLeadError.message
                : String(formLeadError),
          });
        }
      }

      await supabaseAdmin.rpc("finish_facebook_lead_sync_run", {
        p_sync_run_id: syncRunId,
        p_status: leadsFailed > 0 ? "failed" : "success",
        p_forms_seen: formsSeen,
        p_leads_received: leadsReceived,
        p_leads_inserted: leadsInserted,
        p_leads_updated: leadsUpdated,
        p_leads_failed: leadsFailed,
        p_error_message: leadsFailed > 0 ? "Some forms/leads failed during sync." : null,
        p_metadata: {
          source: FUNCTION_NAME,
          form_results_count: formResults.length,
          lead_results_count: leadResults.length,
        },
      });

      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action:
          leadsFailed > 0
            ? "facebook_lead_ads_sync_partial_or_failed"
            : "facebook_lead_ads_sync_success",
        severity: leadsFailed > 0 ? "error" : "info",
        metadata: {
          sync_run_id: syncRunId,
          forms_seen: formsSeen,
          leads_received: leadsReceived,
          leads_inserted: leadsInserted,
          leads_updated: leadsUpdated,
          leads_failed: leadsFailed,
          real_meta_api_called: true,
        },
      });

      return jsonResponse(leadsFailed > 0 ? 207 : 200, {
        ok: leadsFailed === 0,
        function: FUNCTION_NAME,
        mode: actor.mode,
        actor: {
          user_id: actor.user_id,
          email: actor.email,
          role: actor.role,
        },
        workspace_id: workspaceId,
        sync_run_id: syncRunId,
        real_meta_api_called: true,
        forms_seen: formsSeen,
        leads_received: leadsReceived,
        leads_inserted: leadsInserted,
        leads_updated: leadsUpdated,
        leads_failed: leadsFailed,
        form_results: formResults,
        lead_results: leadResults.slice(0, 50),
      });
    } catch (syncError) {
      const message = syncError instanceof Error ? syncError.message : String(syncError);

      await supabaseAdmin.rpc("finish_facebook_lead_sync_run", {
        p_sync_run_id: syncRunId,
        p_status: "failed",
        p_forms_seen: formsSeen,
        p_leads_received: leadsReceived,
        p_leads_inserted: leadsInserted,
        p_leads_updated: leadsUpdated,
        p_leads_failed: leadsFailed + 1,
        p_error_message: message,
        p_metadata: {
          source: FUNCTION_NAME,
          error_step: "real_sync",
        },
      });

      throw syncError;
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "facebook_lead_ads_sync_failed",
      severity: "error",
      metadata: {
        error: message,
        date_from: dateFrom,
        date_to: dateTo,
      },
    });

    return jsonResponse(500, {
      ok: false,
      function: FUNCTION_NAME,
      error: "facebook-lead-ads-sync failed.",
      details: message,
    });
  }
});
