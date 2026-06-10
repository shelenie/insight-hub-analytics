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
};
type AccessPayload = Record<string, unknown>;
type TargetCheck = { ok: boolean; status: number; error: string; code: string; details?: Record<string, unknown> };

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

async function resolveAccess(adminClient: any, workspaceId: string, actorEmail: string | undefined) {
  const { data, error } = await adminClient.rpc("check_edge_function_access_by_email", {
    p_workspace_id: workspaceId,
    p_function_name: FUNCTION_NAME,
    p_actor_email: actorEmail,
  });

  if (error) return { access: null, error };

  const normalized = toObject(data);
  return {
    access: {
      role: (pickString(normalized, ["role", "actor_role", "result_role", "result_actor_role", "workspace_role", "resolved_role"]) ?? "").toLowerCase(),
      allowed: pickBoolean(normalized, ["allowed", "result_allowed", "is_allowed"]),
      reason: pickString(normalized, ["reason", "result_reason", "error", "message"]),
      keys: normalized ? Object.keys(normalized) : [],
    },
    error: null,
  };
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

  const { access, error: accessError } = await resolveAccess(adminClient, workspace_id, authData.user.email);
  if (accessError) {
    return json({ ok: false, error: accessError.message, code: "access_check_failed" }, 403);
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

  const rpcName = binding_type === "source" ? "bind_source_entity_to_scope" : "bind_ad_account_to_scope";
  const { data, error } = await adminClient.rpc(rpcName, {
    p_workspace_id: workspace_id,
    p_binding_id: body.binding_id ?? null,
    p_source_id: cleanId(body.source_id),
    p_ad_account_id: cleanId(body.ad_account_id),
    p_client_id: cleanId(body.client_id),
    p_project_id: cleanId(body.project_id),
    p_funnel_id: cleanId(body.funnel_id),
    p_mapping_status: body.mapping_status ?? null,
    p_binding_status: body.binding_status ?? null,
    p_confidence: body.confidence ?? null,
    p_binding_method: body.binding_method ?? null,
    p_notes: body.notes ?? null,
    p_metadata: body.metadata ?? null,
  });

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
