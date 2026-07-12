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
  const project_id = String(body.project_id ?? "").trim();
  const client_id = String(body.client_id ?? "");
  const name = String(body.project_name ?? body.name ?? "").trim();
  if (!workspace_id || !client_id || !name) return json({ ok: false, error: "workspace_id, client_id, and project_name are required" }, 400);

  if (project_id) {
    const { data: existing, error: lookupError } = await userClient
      .from("projects")
      .select("id, workspace_id, client_id, status, metadata")
      .eq("id", project_id)
      .eq("workspace_id", workspace_id)
      .maybeSingle();
    if (lookupError) return json({ ok: false, error: lookupError.message, code: lookupError.code, action: "lookup_project" }, 400);
    if (!existing) return json({ ok: false, error: "Project not found in workspace", code: "project_not_found" }, 404);
    if (client_id !== existing.client_id) {
      return json({ ok: false, error: "Project reparent requires a dedicated action", code: "project_reparent_requires_dedicated_action" }, 409);
    }
    const clientCheck = await requireActiveClient(userClient, workspace_id, client_id);
    if (clientCheck.error) return clientCheck.error;

    const actor = actorContext(authData.user);
    const now = new Date().toISOString();
    const patch: Record<string, unknown> = {
      name,
      project_name: name,
      updated_at: now,
      metadata: mergeAuditMetadata(existing.metadata, body.metadata, actor, "onboarding-project-upsert", now),
    };
    if ("project_code" in body || "code" in body) patch.project_code = body.project_code ?? body.code;
    if ("status" in body) patch.status = body.status;
    if ("business_model" in body) patch.business_model = body.business_model;
    if ("primary_offer" in body) patch.primary_offer = body.primary_offer;
    if ("default_currency" in body) patch.default_currency = body.default_currency;
    if ("default_timezone" in body) patch.default_timezone = body.default_timezone;
    if ("owner_name" in body) patch.owner_name = body.owner_name;
    if ("owner_email" in body) patch.owner_email = body.owner_email;
    if ("notes" in body) patch.notes = body.notes;

    const { data, error } = await userClient
      .from("projects")
      .update(patch)
      .eq("id", project_id)
      .eq("workspace_id", workspace_id)
      .select("id")
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message, code: error.code, action: "update_project" }, 400);
    if (!data) return json({ ok: false, error: "Project update did not match a row", code: "project_not_found" }, 404);
    return json({ ok: true, action: "update_project", project_id: data.id });
  }

  const clientCheck = await requireActiveClient(userClient, workspace_id, client_id);
  if (clientCheck.error) return clientCheck.error;

  const { data, error } = await userClient.rpc("upsert_project", {
    p_workspace_id: workspace_id,
    p_client_id: client_id,
    p_project_name: name,
    p_project_code: body.project_code ?? body.code ?? null,
    p_status: body.status ?? "active",
    p_business_model: body.business_model ?? null,
    p_primary_offer: body.primary_offer ?? null,
    p_default_currency: body.default_currency ?? null,
    p_default_timezone: body.default_timezone ?? null,
    p_owner_name: body.owner_name ?? null,
    p_owner_email: body.owner_email ?? null,
    p_notes: body.notes ?? null,
    p_created_by: null,
    p_created_by_email: null,
    p_metadata: body.metadata ?? null,
  });
  if (error) return json({ ok: false, error: error.message, rpc: "upsert_project" }, 400);
  return json({ ok: true, rpc: "upsert_project", project_id: data });
});
async function requireActiveClient(userClient: any, workspace_id: string, client_id: string): Promise<{ error: Response | null }> {
  const { data, error } = await userClient
    .from("clients")
    .select("id, workspace_id, status")
    .eq("id", client_id)
    .eq("workspace_id", workspace_id)
    .maybeSingle();
  if (error) return { error: json({ ok: false, error: error.message, code: error.code, action: "lookup_client" }, 400) };
  if (!data) return { error: json({ ok: false, error: "Client not found in workspace", code: "client_not_found" }, 404) };
  if (isInactiveStatus(data.status)) return { error: json({ ok: false, error: "Client is inactive", code: "inactive_client" }, 409) };
  return { error: null };
}
function isInactiveStatus(status: unknown) { return inactiveStatuses.has(String(status ?? "").trim().toLowerCase()); }
function actorContext(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }) { return { id: user.id, email: user.email ?? (typeof user.user_metadata?.email === "string" ? user.user_metadata.email : null) }; }
function isPlainObject(value: unknown): value is Record<string, unknown> { return Boolean(value) && typeof value === "object" && !Array.isArray(value); }
function mergeAuditMetadata(existing: unknown, requested: unknown, actor: { id: string; email: string | null }, updatedVia: string, updatedAt: string) {
  const safeExisting = isPlainObject(existing) ? existing : {};
  const safeRequested = isPlainObject(requested) ? requested : {};
  return { ...safeExisting, ...safeRequested, updated_by: actor.id, updated_by_email: actor.email, updated_via: updatedVia, updated_at: updatedAt };
}
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
