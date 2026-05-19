import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
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
  const body = await req.json();
  const workspace_id = String(body.workspace_id ?? "");
  const project_id = String(body.project_id ?? "");
  const name = String(body.name ?? "").trim();
  if (!workspace_id || !project_id || !name) return json({ ok: false, error: "workspace_id, project_id, and name are required" }, 400);
  const { data: accessData, error: accessError } = await adminClient.rpc("check_edge_function_access_by_email", { p_user_email: authData.user.email, p_workspace_id: workspace_id });
  if (accessError) return json({ ok: false, error: accessError.message }, 403);
  const role = String((accessData as { role?: string } | null)?.role ?? "").toLowerCase();
  if (!(role === "admin" || role === "superadmin")) return json({ ok: false, error: "Insufficient role" }, 403);
  const { data, error } = await adminClient.rpc("upsert_funnel", {
    p_workspace_id: workspace_id, p_funnel_id: body.funnel_id ?? null, p_project_id: project_id, p_name: name, p_code: body.code ?? null, p_status: body.status ?? null, p_metadata: body.metadata ?? null,
  });
  if (error) return json({ ok: false, error: error.message }, 400);
  return json({ ok: true, funnel: data, funnel_id: (data as { id?: string } | null)?.id ?? body.funnel_id ?? null });
});
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
