import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FUNCTION_NAME = "binding-create-or-update";
const PERMISSION_ERROR_MESSAGE = "Insufficient workspace role for manual binding management";
const ARCHIVED_TARGET_ERROR_MESSAGE = "Cannot create a binding for archived client, project, or funnel";
const VALIDATION_ERROR_MESSAGE = "Invalid binding target IDs";

type BindingType = "source" | "ad_account";
type RequestBody = {
  workspace_id?: string;
  binding_type?: BindingType;
  binding_id?: string | null;
  source_id?: string | null;
  ad_account_id?: string | null;
  client_id?: string | null;
  project_id?: string | null;
  funnel_id?: string | null;
  mapping_status?: string | null;
  binding_status?: string | null;
  confidence?: number | null;
  binding_method?: string | null;
  notes?: string | null;
  metadata?: Record<string, unknown> | null;
  is_primary?: boolean | null;
};
type AccessPayload = Record<string, unknown>;
type AccessResult = {
  role: string;
  allowed: boolean | null;
  reason: string | null;
  keys: string[];
  signature: "function-aware" | "legacy";
};
type TargetCheck = { ok: boolean; status: number; error: string; code: string; details?: Record<string, unknown> };

type AdAccountRow = {
  id: string;
  workspace_id: string | null;
  status: string | null;
  platform: string | null;
  ad_platform_connection_id: string | null;
  external_account_id: string | null;
  external_account_name: string | null;
};

type SourceEntity = {
  source_kind: string;
  source_table: string | null;
  source_id: string;
  source_external_id: string | null;
  source_name: string | null;
};

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function toObject(payload: unknown): AccessPayload | null {
  if (!payload) return null;
  if (Array.isArray(payload)) {
    const first = payload[0];
    return first && typeof first === "object" ? (first as AccessPayload) : null;
  }
  return typeof payload === "object" ? (payload as AccessPayload) : null;
}

function pickString(data: AccessPayload | null, keys: string[]): string | null {
  if (!data) return null;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

function pickBoolean(data: AccessPayload | null, keys: string[]): boolean | null {
  if (!data) return null;
  for (const key of keys) {
    const value = data[key];
    if (typeof value === "boolean") return value;
  }
  return null;
}

function normalizeAccess(data: unknown, signature: AccessResult["signature"]): AccessResult {
  const normalized = toObject(data);
  return {
    role: (pickString(normalized, ["role", "actor_role", "result_role", "result_actor_role", "workspace_role", "resolved_role"]) ?? "").toLowerCase(),
    allowed: pickBoolean(normalized, ["allowed", "result_allowed", "is_allowed"]),
    reason: pickString(normalized, ["reason", "result_reason", "error", "message"]),
    keys: normalized ? Object.keys(normalized) : [],
    signature,
  };
}

function isMissingRpcSignatureError(error: { code?: string; message?: string; details?: string; hint?: string } | null | undefined) {
  if (!error) return false;
  const text = [error.code, error.message, error.details, error.hint].filter(Boolean).join(" ").toLowerCase();
  return (
    text.includes("pgrst202") ||
    (text.includes("could not find") && text.includes("check_edge_function_access_by_email")) ||
    (text.includes("function") && text.includes("check_edge_function_access_by_email") && text.includes("does not exist")) ||
    (text.includes("function") && text.includes("check_edge_function_access_by_email") && text.includes("not found"))
  );
}

async function resolveAccess(adminClient: any, workspaceId: string, actorEmail: string | undefined) {
  const functionAwareResult = await adminClient.rpc("check_edge_function_access_by_email", {
    p_workspace_id: workspaceId,
    p_function_name: FUNCTION_NAME,
    p_actor_email: actorEmail,
  });

  if (!functionAwareResult.error) {
    return { access: normalizeAccess(functionAwareResult.data, "function-aware"), error: null };
  }

  if (!isMissingRpcSignatureError(functionAwareResult.error)) {
    return { access: null, error: functionAwareResult.error, attemptedFallback: false };
  }

  const legacyResult = await adminClient.rpc("check_edge_function_access_by_email", {
    p_user_email: actorEmail,
    p_workspace_id: workspaceId,
  });

  if (legacyResult.error) {
    return {
      access: null,
      error: legacyResult.error,
      attemptedFallback: true,
      firstError: functionAwareResult.error,
    };
  }

  return { access: normalizeAccess(legacyResult.data, "legacy"), error: null, attemptedFallback: true };
}

function cleanId(value: string | null | undefined) {
  const id = String(value ?? "").trim();
  return id || null;
}

async function checkTarget(adminClient: any, table: string, id: string | null, workspaceId: string) {
  if (!id) return null;
  const { data, error } = await adminClient
    .from(table)
    .select("id, workspace_id, status")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    return {
      ok: false,
      status: 400,
      error: VALIDATION_ERROR_MESSAGE,
      code: "target_lookup_failed",
      details: { table, id, message: error.message },
    };
  }

  if (!data) {
    return {
      ok: false,
      status: 400,
      error: VALIDATION_ERROR_MESSAGE,
      code: "target_not_found",
      details: { table, id },
    };
  }

  if (data.workspace_id && data.workspace_id !== workspaceId) {
    return {
      ok: false,
      status: 400,
      error: VALIDATION_ERROR_MESSAGE,
      code: "target_workspace_mismatch",
      details: { table, id },
    };
  }

  if (String(data.status ?? "").toLowerCase() === "archived") {
    return {
      ok: false,
      status: 409,
      error: ARCHIVED_TARGET_ERROR_MESSAGE,
      code: "archived_target",
      details: { table, id },
    };
  }

  return null;
}

async function validateTargets(adminClient: any, body: RequestBody, workspaceId: string): Promise<TargetCheck | null> {
  const checks = [
    await checkTarget(adminClient, "clients", cleanId(body.client_id), workspaceId),
    await checkTarget(adminClient, "projects", cleanId(body.project_id), workspaceId),
    await checkTarget(adminClient, "funnels", cleanId(body.funnel_id), workspaceId),
  ];

  return checks.find(Boolean) ?? null;
}

function isInactiveStatus(status: unknown) {
  const normalized = String(status ?? "").trim().toLowerCase();
  return ["archived", "deleted", "disabled", "inactive"].includes(normalized);
}

function sourceLookupError(code: string, sourceId: string, status = 400, message = VALIDATION_ERROR_MESSAGE, details: Record<string, unknown> = { id: sourceId }): TargetCheck {
  return {
    ok: false,
    status,
    error: message,
    code,
    details,
  };
}

async function lookupGoogleSheetTabSource(adminClient: any, sourceId: string, workspaceId: string): Promise<{ source: SourceEntity | null; error: TargetCheck | null }> {
  const { data, error } = await adminClient
    .from("google_sheet_tabs")
    .select("id, workspace_id, status, source_type, target_raw_table, tab_name, source_id")
    .eq("id", sourceId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !data) return { source: null, error: null };
  if (data.workspace_id && data.workspace_id !== workspaceId) return { source: null, error: sourceLookupError("source_workspace_mismatch", sourceId) };
  if (isInactiveStatus(data.status)) {
    return { source: null, error: sourceLookupError("inactive_source", sourceId, 409, "Cannot create a binding for an inactive or archived source", { id: sourceId, status: data.status }) };
  }

  let parentSheet: { spreadsheet_id?: string | null; spreadsheet_name?: string | null } | null = null;
  if (data.source_id) {
    const { data: sheet } = await adminClient
      .from("google_sheet_sources")
      .select("id, spreadsheet_id, spreadsheet_name")
      .eq("id", data.source_id)
      .eq("workspace_id", workspaceId)
      .maybeSingle();
    parentSheet = sheet ?? null;
  }

  const spreadsheetName = parentSheet?.spreadsheet_name ?? null;
  const tabName = data.tab_name ?? null;

  return {
    source: {
      source_kind: data.source_type ?? "google_sheet",
      source_table: data.target_raw_table ?? "google_sheet_tabs",
      source_id: data.id,
      source_external_id: parentSheet?.spreadsheet_id && tabName ? `${parentSheet.spreadsheet_id}:${tabName}` : (parentSheet?.spreadsheet_id ?? data.source_id ?? null),
      source_name: spreadsheetName && tabName ? `google_sheet:${spreadsheetName}:${tabName}` : (tabName ?? spreadsheetName),
    },
    error: null,
  };
}

async function lookupRawExternalDatasetSource(adminClient: any, sourceId: string, workspaceId: string): Promise<{ source: SourceEntity | null; error: TargetCheck | null }> {
  const { data, error } = await adminClient
    .from("raw_external_datasets")
    .select("id, workspace_id, status, source_type, target_raw_table, dataset_name, sheet_name, file_asset_id, parser_type")
    .eq("id", sourceId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !data) return { source: null, error: null };
  if (data.workspace_id && data.workspace_id !== workspaceId) return { source: null, error: sourceLookupError("source_workspace_mismatch", sourceId) };
  if (isInactiveStatus(data.status)) {
    return { source: null, error: sourceLookupError("inactive_source", sourceId, 409, "Cannot create a binding for an inactive or archived source", { id: sourceId, status: data.status }) };
  }

  const datasetName = data.dataset_name ?? null;
  const sheetName = data.sheet_name ?? null;

  return {
    source: {
      source_kind: data.source_type ?? data.parser_type ?? "manual_file_upload",
      source_table: data.target_raw_table ?? "raw_external_datasets",
      source_id: data.id,
      source_external_id: data.file_asset_id ?? data.id,
      source_name: datasetName && sheetName ? `file_upload:${datasetName}:${sheetName}` : (datasetName ?? sheetName),
    },
    error: null,
  };
}

async function lookupGoogleSheetSource(adminClient: any, sourceId: string, workspaceId: string): Promise<{ source: SourceEntity | null; error: TargetCheck | null }> {
  const { data, error } = await adminClient
    .from("google_sheet_sources")
    .select("id, workspace_id, status, spreadsheet_id, spreadsheet_name")
    .eq("id", sourceId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error || !data) return { source: null, error: null };
  if (data.workspace_id && data.workspace_id !== workspaceId) return { source: null, error: sourceLookupError("source_workspace_mismatch", sourceId) };
  if (isInactiveStatus(data.status)) {
    return { source: null, error: sourceLookupError("inactive_source", sourceId, 409, "Cannot create a binding for an inactive or archived source", { id: sourceId, status: data.status }) };
  }

  return {
    source: {
      source_kind: "google_sheet",
      source_table: "google_sheet_sources",
      source_id: data.id,
      source_external_id: data.spreadsheet_id ?? null,
      source_name: data.spreadsheet_name ?? null,
    },
    error: null,
  };
}

async function getActiveSourceEntity(adminClient: any, sourceId: string, workspaceId: string): Promise<{ source: SourceEntity | null; error: TargetCheck | null }> {
  const lookups = [lookupGoogleSheetTabSource, lookupRawExternalDatasetSource, lookupGoogleSheetSource];

  for (const lookup of lookups) {
    const result = await lookup(adminClient, sourceId, workspaceId);
    if (result.error || result.source) return result;
  }

  return { source: null, error: sourceLookupError("source_not_found", sourceId) };
}

async function getActiveAdAccount(adminClient: any, adAccountId: string, workspaceId: string): Promise<{ adAccount: AdAccountRow | null; error: TargetCheck | null }> {
  const { data, error } = await adminClient
    .from("ad_accounts")
    .select("id, workspace_id, status, platform, ad_platform_connection_id, external_account_id, external_account_name")
    .eq("id", adAccountId)
    .eq("workspace_id", workspaceId)
    .maybeSingle();

  if (error) {
    return {
      adAccount: null,
      error: {
        ok: false,
        status: 400,
        error: VALIDATION_ERROR_MESSAGE,
        code: "ad_account_lookup_failed",
        details: { id: adAccountId, message: error.message },
      },
    };
  }

  if (!data) {
    return {
      adAccount: null,
      error: {
        ok: false,
        status: 400,
        error: VALIDATION_ERROR_MESSAGE,
        code: "ad_account_not_found",
        details: { id: adAccountId },
      },
    };
  }

  const adAccount = data as AdAccountRow;
  if (adAccount.workspace_id && adAccount.workspace_id !== workspaceId) {
    return {
      adAccount: null,
      error: {
        ok: false,
        status: 400,
        error: VALIDATION_ERROR_MESSAGE,
        code: "ad_account_workspace_mismatch",
        details: { id: adAccountId },
      },
    };
  }

  if (String(adAccount.status ?? "").toLowerCase() !== "active") {
    return {
      adAccount: null,
      error: {
        ok: false,
        status: 409,
        error: "Cannot create a binding for an inactive ad account",
        code: "inactive_ad_account",
        details: { id: adAccountId, status: adAccount.status },
      },
    };
  }

  if (!adAccount.platform) {
    return {
      adAccount: null,
      error: {
        ok: false,
        status: 400,
        error: VALIDATION_ERROR_MESSAGE,
        code: "ad_account_platform_missing",
        details: { id: adAccountId },
      },
    };
  }

  return { adAccount, error: null };
}

function sharedBindingRpcPayload(body: RequestBody, workspaceId: string, createdBy: string, createdByEmail: string | null | undefined) {
  return {
    p_workspace_id: workspaceId,
    p_client_id: cleanId(body.client_id),
    p_project_id: cleanId(body.project_id),
    p_funnel_id: cleanId(body.funnel_id),
    p_mapping_status: body.mapping_status ?? "confirmed",
    p_binding_method: body.binding_method ?? "manual",
    p_confidence: body.confidence ?? 1.0,
    p_notes: body.notes ?? null,
    p_created_by: createdBy,
    p_created_by_email: createdByEmail ?? null,
    p_metadata: body.metadata ?? {},
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "Missing bearer token", code: "missing_bearer_token" }, 401);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(url, serviceRole);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ ok: false, error: "Unauthenticated", code: "unauthenticated" }, 401);

  const body = (await req.json().catch(() => ({}))) as RequestBody;
  const workspace_id = cleanId(body.workspace_id);
  const binding_type = body.binding_type;
  if (!workspace_id || (binding_type !== "source" && binding_type !== "ad_account")) {
    return json({ ok: false, error: "workspace_id and binding_type are required", code: "invalid_payload" }, 400);
  }

  const { access, error: accessError, attemptedFallback } = await resolveAccess(adminClient, workspace_id, authData.user.email);
  if (accessError) {
    return json({ ok: false, error: accessError.message, code: "access_check_failed", attempted_legacy_fallback: attemptedFallback === true }, 403);
  }

  if (access?.allowed === false) {
    return json({ ok: false, error: access.reason || PERMISSION_ERROR_MESSAGE, code: "permission_denied", role: access.role || null }, 403);
  }

  if (!(access?.role === "admin" || access?.role === "superadmin")) {
    return json({ ok: false, error: PERMISSION_ERROR_MESSAGE, code: "insufficient_role", role: access?.role || null, access_keys: access?.keys ?? [] }, 403);
  }

  if (binding_type === "source" && !cleanId(body.source_id)) {
    return json({ ok: false, error: "source_id is required for source bindings", code: "invalid_payload" }, 400);
  }
  if (binding_type === "ad_account" && !cleanId(body.ad_account_id)) {
    return json({ ok: false, error: "ad_account_id is required for ad account bindings", code: "invalid_payload" }, 400);
  }

  const targetError = await validateTargets(adminClient, body, workspace_id);
  if (targetError) return json({ ok: false, error: targetError.error, code: targetError.code, details: targetError.details }, targetError.status);

  const sharedPayload = sharedBindingRpcPayload(body, workspace_id, authData.user.id, authData.user.email);
  let rpcName = "bind_source_entity_to_scope";
  let rpcPayload: Record<string, unknown>;

  if (binding_type === "source") {
    const sourceId = cleanId(body.source_id);
    const { source, error: sourceError } = await getActiveSourceEntity(adminClient, sourceId!, workspace_id);
    if (sourceError) return json({ ok: false, error: sourceError.error, code: sourceError.code, details: sourceError.details }, sourceError.status);

    rpcPayload = {
      ...sharedPayload,
      p_source_kind: source!.source_kind,
      p_source_table: source!.source_table,
      p_source_id: source!.source_id,
      p_source_external_id: source!.source_external_id,
      p_source_name: source!.source_name,
      p_is_primary: typeof body.is_primary === "boolean" ? body.is_primary : false,
    };
  } else {
    const adAccountId = cleanId(body.ad_account_id);
    const { adAccount, error: adAccountError } = await getActiveAdAccount(adminClient, adAccountId!, workspace_id);
    if (adAccountError) return json({ ok: false, error: adAccountError.error, code: adAccountError.code, details: adAccountError.details }, adAccountError.status);

    rpcName = "bind_ad_account_to_scope";
    rpcPayload = {
      ...sharedPayload,
      p_platform: adAccount!.platform,
      p_ad_platform_connection_id: adAccount!.ad_platform_connection_id,
      p_ad_account_id: adAccount!.id,
      p_external_account_id: adAccount!.external_account_id,
      p_external_account_name: adAccount!.external_account_name,
      p_is_primary: typeof body.is_primary === "boolean" ? body.is_primary : false,
    };
  }

  const { data, error } = await adminClient.rpc(rpcName, rpcPayload);

  if (error) {
    const details = error.message.toLowerCase();
    if (details.includes("function") && details.includes("does not exist")) {
      return json({ ok: false, error: "not wired: RPC signature needs confirmation", code: "rpc_not_wired", rpc: rpcName }, 501);
    }
    if (details.includes("archiv")) {
      return json({ ok: false, error: ARCHIVED_TARGET_ERROR_MESSAGE, code: "archived_target", rpc: rpcName }, 409);
    }
    return json({ ok: false, error: error.message, code: "rpc_failed", rpc: rpcName }, 400);
  }

  return json({ ok: true, rpc: rpcName, result: data });
});
