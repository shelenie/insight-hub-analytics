import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
const inactiveStatuses = new Set(["archived", "inactive", "removed", "deleted", "disabled"]);
Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) return json({ ok: false, error: "Missing bearer token" }, 401);
  const url = Deno.env.get("SUPABASE_URL") ?? "";
  const anon = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  const userClient = createClient(url, anon, { global: { headers: { Authorization: authHeader } } });
  const { data: authData, error: authError } = await userClient.auth.getUser();
  if (authError || !authData.user) return json({ ok: false, error: "Unauthenticated" }, 401);
  const body = await req.json().catch(() => ({}));
  const workspace_id = String(body.workspace_id ?? "");
  const funnel_id = String(body.funnel_id ?? "").trim();
  const project_id = String(body.project_id ?? "");
  const name = String(body.funnel_name ?? body.name ?? "").trim();
  if (!workspace_id || !project_id || !name) return json({ ok: false, error: "workspace_id, project_id, and funnel_name are required" }, 400);

  if (funnel_id) {
    const { data: existing, error: lookupError } = await userClient
      .from("funnels")
      .select("id, workspace_id, project_id, client_id, status, metadata")
      .eq("id", funnel_id)
      .eq("workspace_id", workspace_id)
      .maybeSingle();
    if (lookupError) return json({ ok: false, error: lookupError.message, code: lookupError.code, action: "lookup_funnel" }, 400);
    if (!existing) return json({ ok: false, error: "Funnel not found in workspace", code: "funnel_not_found" }, 404);
    if (project_id !== existing.project_id) {
      return json({ ok: false, error: "Funnel reparent requires a dedicated action", code: "funnel_reparent_requires_dedicated_action" }, 409);
    }
    const requestedStatus = "status" in body ? String(body.status ?? "") : String(existing.status ?? "");
    const archiveTransition = isInactiveStatus(requestedStatus);
    if (archiveTransition) {
      const { data, error } = await userClient["rpc"]("archive_onboarding_funnel_cascade", { p_workspace_id: workspace_id, p_funnel_id: funnel_id, p_status: requestedStatus, p_metadata: body.metadata ?? null });
      if (error) return json({ ok: false, error: friendlyRpcError(error.message), code: stableRpcErrorCode(error.message, "funnel_archive_failed"), rpc: "archive_onboarding_funnel_cascade" }, 400);
      return json({ ok: true, action: "archive_funnel_cascade", funnel_id, cascade: data });
    }
    const projectCheck = await requireActiveProject(userClient, workspace_id, project_id);
    if (projectCheck.error) return projectCheck.error;
    const client_id = projectCheck.project.client_id;

    const actor = actorContext(authData.user);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      client_id,
      project_id,
      funnel_name: name,
      name,
      updated_at: now,
      metadata: mergeAuditMetadata(existing.metadata, body.metadata, actor, "onboarding-funnel-upsert", now),
    };
    if ("funnel_code" in body || "code" in body) patch.funnel_code = body.funnel_code ?? body.code;
    if ("funnel_type" in body) patch.funnel_type = body.funnel_type;
    if ("status" in body) patch.status = body.status;
    if ("traffic_source_notes" in body) patch.traffic_source_notes = body.traffic_source_notes;
    if ("offer_notes" in body) patch.offer_notes = body.offer_notes;
    if ("default_currency" in body) patch.default_currency = body.default_currency;
    if ("default_timezone" in body) patch.default_timezone = body.default_timezone;
    if ("starts_at" in body) patch.starts_at = body.starts_at;
    if ("ends_at" in body) patch.ends_at = body.ends_at;
    if ("notes" in body) patch.notes = body.notes;

    const { data, error } = await userClient
      .from("funnels")
      .update(patch)
      .eq("id", funnel_id)
      .eq("workspace_id", workspace_id)
      .select("id")
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message, code: error.code, action: "update_funnel" }, 400);
    if (!data) return json({ ok: false, error: "Funnel update did not match a row", code: "funnel_not_found" }, 404);
    return json({ ok: true, action: "update_funnel", funnel_id: data.id });
  }

  const projectCheck = await requireActiveProject(userClient, workspace_id, project_id);
  if (projectCheck.error) return projectCheck.error;

  const { data, error } = await userClient.rpc("upsert_funnel", {
    p_workspace_id: workspace_id,
    p_project_id: project_id,
    p_funnel_name: name,
    p_funnel_code: body.funnel_code ?? body.code ?? null,
    p_funnel_type: body.funnel_type ?? null,
    p_status: body.status ?? "active",
    p_traffic_source_notes: body.traffic_source_notes ?? null,
    p_offer_notes: body.offer_notes ?? null,
    p_default_currency: body.default_currency ?? null,
    p_default_timezone: body.default_timezone ?? null,
    p_starts_at: body.starts_at ?? null,
    p_ends_at: body.ends_at ?? null,
    p_notes: body.notes ?? null,
    p_created_by: null,
    p_created_by_email: null,
    p_metadata: body.metadata ?? null,
  });
  if (error) return json({ ok: false, error: error.message, rpc: "upsert_funnel" }, 400);
  return json({ ok: true, rpc: "upsert_funnel", funnel_id: data });
});
async function requireActiveProject(userClient: any, workspace_id: string, project_id: string): Promise<{ project: { client_id: string }; error: Response | null }> {
  const { data, error } = await userClient
    .from("projects")
    .select("id, workspace_id, client_id, status")
    .eq("id", project_id)
    .eq("workspace_id", workspace_id)
    .maybeSingle();
  if (error) return { project: { client_id: "" }, error: json({ ok: false, error: error.message, code: error.code, action: "lookup_project" }, 400) };
  if (!data) return { project: { client_id: "" }, error: json({ ok: false, error: "Project not found in workspace", code: "project_not_found" }, 404) };
  if (isInactiveStatus(data.status)) return { project: { client_id: "" }, error: json({ ok: false, error: "Project is inactive", code: "inactive_project" }, 409) };
  return { project: { client_id: data.client_id }, error: null };
}
function isInactiveStatus(status: unknown) { return inactiveStatuses.has(String(status ?? "").trim().toLowerCase()); }
function actorContext(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }) { return { id: user.id, email: user.email ?? (typeof user.user_metadata?.email === "string" ? user.user_metadata.email : null) }; }
function isPlainObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function mergeAuditMetadata(existing: unknown, requested: unknown, actor: { id: string; email: string | null }, updatedVia: string, updatedAt: string) {
  const safeExisting = isPlainObject(existing) ? existing : {};
  const safeRequested = isPlainObject(requested) ? requested : {};
  return { ...safeExisting, ...safeRequested, updated_by: actor.id, updated_by_email: actor.email, updated_via: updatedVia, updated_at: updatedAt };
}
function friendlyRpcError(message: string) {
  if (message.includes("not found")) return message;
  if (message.includes("requires an inactive status")) return "Archive requires an inactive status.";
  if (message.includes("permission") || message.includes("manage")) return "You do not have permission to archive this onboarding record.";
  return message || "Archive operation failed.";
}
function stableRpcErrorCode(message: string, fallback: string) {
  const lower = message.toLowerCase();
  if (lower.includes("not found")) return "onboarding_entity_not_found";
  if (lower.includes("inactive status")) return "invalid_archive_status";
  if (lower.includes("permission") || lower.includes("manage")) return "onboarding_archive_forbidden";
  return fallback;
}

function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
