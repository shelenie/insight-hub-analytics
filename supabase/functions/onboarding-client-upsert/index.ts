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
  const client_id = String(body.client_id ?? "").trim();
  const name = String(body.client_name ?? body.name ?? "").trim();
  if (!workspace_id || !name) return json({ ok: false, error: "workspace_id and client_name are required" }, 400);

  if (client_id) {
    const { data: existing, error: lookupError } = await userClient
      .from("clients")
      .select("id, workspace_id, status")
      .eq("id", client_id)
      .eq("workspace_id", workspace_id)
      .maybeSingle();
    if (lookupError) return json({ ok: false, error: lookupError.message, code: lookupError.code, action: "lookup_client" }, 400);
    if (!existing) return json({ ok: false, error: "Client not found in workspace", code: "client_not_found" }, 404);
    if (isInactiveStatus(existing.status)) return json({ ok: false, error: "Client is inactive", code: "inactive_client" }, 409);

    const actor = actorContext(authData.user);
    void actor;
    const patch: Record<string, unknown> = {
      name,
      client_name: name,
      updated_at: new Date().toISOString(),
    };
    if ("client_code" in body || "code" in body) patch.client_code = body.client_code ?? body.code;
    if ("status" in body) patch.status = body.status;
    if ("default_currency" in body) patch.default_currency = body.default_currency;
    if ("default_timezone" in body) patch.default_timezone = body.default_timezone;
    if ("website_url" in body) patch.website_url = body.website_url;
    if ("owner_name" in body) patch.owner_name = body.owner_name;
    if ("owner_email" in body) patch.owner_email = body.owner_email;
    if ("notes" in body) patch.notes = body.notes;

    const { data, error } = await userClient
      .from("clients")
      .update(patch)
      .eq("id", client_id)
      .eq("workspace_id", workspace_id)
      .select("id")
      .maybeSingle();
    if (error) return json({ ok: false, error: error.message, code: error.code, action: "update_client" }, 400);
    if (!data) return json({ ok: false, error: "Client update did not match a row", code: "client_not_found" }, 404);
    return json({ ok: true, action: "update_client", client_id: data.id });
  }

  const { data, error } = await userClient.rpc("upsert_client", {
    p_workspace_id: workspace_id,
    p_client_name: name,
    p_client_code: body.client_code ?? body.code ?? null,
    p_status: body.status ?? "active",
    p_default_currency: body.default_currency ?? null,
    p_default_timezone: body.default_timezone ?? null,
    p_website_url: body.website_url ?? null,
    p_owner_name: body.owner_name ?? null,
    p_owner_email: body.owner_email ?? null,
    p_notes: body.notes ?? null,
    p_created_by: null,
    p_created_by_email: null,
    p_metadata: body.metadata ?? null,
  });
  if (error) return json({ ok: false, error: error.message, rpc: "upsert_client" }, 400);
  return json({ ok: true, rpc: "upsert_client", client_id: data });
});

function isInactiveStatus(status: unknown) {
  return inactiveStatuses.has(String(status ?? "").trim().toLowerCase());
}

function actorContext(user: { id: string; email?: string | null; user_metadata?: Record<string, unknown> | null }) {
  return { id: user.id, email: user.email ?? (typeof user.user_metadata?.email === "string" ? user.user_metadata.email : null) };
}

function json(payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}
