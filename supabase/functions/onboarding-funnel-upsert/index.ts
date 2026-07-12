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
  const project_id = String(body.project_id ?? "");
  const name = String(body.funnel_name ?? body.name ?? "").trim();
  if (!workspace_id || !project_id || !name) return json({ ok: false, error: "workspace_id, project_id, and funnel_name are required" }, 400);
  const { data, error } = await userClient.rpc("upsert_funnel", {
    p_workspace_id: workspace_id,
    p_project_id: project_id,
    p_funnel_name: name,
    p_funnel_code: body.funnel_code ?? body.code ?? null,
    p_status: body.status ?? "active",
    p_funnel_type: body.funnel_type ?? null,
    p_stage: body.stage ?? null,
    p_primary_goal: body.primary_goal ?? null,
    p_owner_name: body.owner_name ?? null,
    p_owner_email: body.owner_email ?? null,
    p_start_date: body.start_date ?? null,
    p_end_date: body.end_date ?? null,
    p_notes: body.notes ?? null,
    p_created_by: null,
    p_created_by_email: null,
    p_metadata: body.metadata ?? null,
  });
  if (error) return json({ ok: false, error: error.message, rpc: "upsert_funnel" }, 400);
  return json({ ok: true, rpc: "upsert_funnel", funnel_id: data });
});
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
