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

  const projectCheck = await requireActiveProject(userClient, workspace_id, project_id);
  if (projectCheck.error) return projectCheck.error;
  const client_id = projectCheck.project.client_id;

  if (funnel_id) {
    const { data: existing, error: lookupError } = await userClient
      .from("funnels")
      .select("id, workspace_id, status")
      .eq("id", funnel_id)
      .eq("workspace_id", workspace_id)
      .maybeSingle();
    if (lookupError) return json({ ok: false, error: lookupError.message, code: lookupError.code, action: "lookup_funnel" }, 400);
    if (!existing) return json({ ok: false, error: "Funnel not found in workspace", code: "funnel_not_found" }, 404);
    if (isInactiveStatus(existing.status)) return json({ ok: false, error: "Funnel is inactive", code: "inactive_funnel" }, 409);

    const actor = actorContext(authData.user);
    void actor;
    const patch: Record<string, unknown> = {
      client_id,
      project_id,
      funnel_name: name,
      name,
      updated_at: new Date().toISOString(),
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
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
