import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type Role = "member" | "admin" | "superadmin";
type AccessPayload = Record<string, unknown>;

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function capabilitiesForRole(role: Role) {
  const isAdmin = role === "admin" || role === "superadmin";
  const isSuperadmin = role === "superadmin";

  return {
    can_read: true,
    can_manage_onboarding: isAdmin,
    can_manage_bindings: isAdmin,
    can_manage_mapping_review: isAdmin,
    can_manage_telegram_alerts: isAdmin,
    can_run_ads_scheduled_sync: isAdmin,
    can_use_ai_helper: true,
    can_manage_backup_restore: isSuperadmin,
    can_run_dev_actions: isSuperadmin,
  };
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

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "Missing bearer token" }, 401);

  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const serviceRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";

  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(url, serviceRole);

  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ ok: false, error: "Unauthenticated" }, 401);

  const body = await req.json().catch(() => ({}));
  const workspace_id = String((body as { workspace_id?: string }).workspace_id ?? "");
  if (!workspace_id) return json({ ok: false, error: "workspace_id is required" }, 400);

  const { data: accessData, error: accessError } = await adminClient.rpc("check_edge_function_access_by_email", {
    p_workspace_id: workspace_id,
    p_function_name: "ai-helper-run",
    p_actor_email: authData.user.email,
  });

  if (accessError) return json({ ok: false, error: accessError.message }, 403);

  const normalized = toObject(accessData);
  const normalizedRole = (pickString(normalized, ["role", "actor_role", "result_role", "result_actor_role", "workspace_role", "resolved_role"]) ?? "").toLowerCase();
  const normalizedAllowed = pickBoolean(normalized, ["allowed", "result_allowed", "is_allowed"]);
  const normalizedReason = pickString(normalized, ["reason", "result_reason", "error", "message"]);

  console.log("[workspace-role-info] access resolved", {
    user_email: authData.user.email,
    workspace_id,
    available_keys: normalized ? Object.keys(normalized) : [],
    normalized_role: normalizedRole || null,
    normalized_allowed: normalizedAllowed,
  });

  if (normalizedAllowed === false) {
    return json({ ok: false, error: normalizedReason || "Access denied" }, 403);
  }

  if (!(normalizedRole === "member" || normalizedRole === "admin" || normalizedRole === "superadmin")) {
    return json({
      ok: false,
      error: "Unable to resolve valid workspace role",
      available_keys: normalized ? Object.keys(normalized) : [],
      normalized_allowed: normalizedAllowed,
      normalized_reason: normalizedReason,
    }, 403);
  }

  const roleValue = normalizedRole as Role;
  const is_member = roleValue === "member";
  const is_admin = roleValue === "admin" || roleValue === "superadmin";
  const is_superadmin = roleValue === "superadmin";

  return json({
    ok: true,
    role: roleValue,
    is_member,
    is_admin,
    is_superadmin,
    capabilities: capabilitiesForRole(roleValue),
  });
});
