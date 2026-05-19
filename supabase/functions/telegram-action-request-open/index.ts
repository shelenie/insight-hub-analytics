import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
type RequestBody = { workspace_id?: string; action_request_id?: string };
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
const body = (await req.json()) as RequestBody;
const workspace_id = String(body.workspace_id ?? "").trim();
const action_request_id = String(body.action_request_id ?? "").trim();
if (!workspace_id || !action_request_id) return json({ ok: false, error: "workspace_id and action_request_id are required" }, 400);
const { data: accessData, error: accessError } = await adminClient.rpc("check_edge_function_access_by_email", { p_user_email: authData.user.email, p_workspace_id: workspace_id });
if (accessError) return json({ ok: false, error: accessError.message }, 403);
const role = String((accessData as { role?: string } | null)?.role ?? "").toLowerCase();
if (!(role === "admin" || role === "superadmin")) return json({ ok: false, error: "Insufficient role" }, 403);
return json({ ok: false, error: "not wired: action request backend function needs confirmation", details: "No confirmed safe backend RPC signature for action request open is present in this repository." }, 501);
});
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
