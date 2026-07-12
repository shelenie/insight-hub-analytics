import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
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
  const client_id = String(body.client_id ?? "");
  const name = String(body.project_name ?? body.name ?? "").trim();
  if (!workspace_id || !client_id || !name) return json({ ok: false, error: "workspace_id, client_id, and project_name are required" }, 400);
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
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
