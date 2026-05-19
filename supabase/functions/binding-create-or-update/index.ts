import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
type BindingType = "source" | "ad_account";
type RequestBody = { workspace_id?: string; binding_type?: BindingType; binding_id?: string | null; source_id?: string | null; ad_account_id?: string | null; client_id?: string | null; project_id?: string | null; funnel_id?: string | null; mapping_status?: string | null; binding_status?: string | null; confidence?: number | null; binding_method?: string | null; notes?: string | null; metadata?: Record<string, unknown> | null; };
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
const binding_type = body.binding_type;
if (!workspace_id || (binding_type !== "source" && binding_type !== "ad_account")) return json({ ok: false, error: "workspace_id and binding_type are required" }, 400);
const { data: accessData, error: accessError } = await adminClient.rpc("check_edge_function_access_by_email", { p_user_email: authData.user.email, p_workspace_id: workspace_id });
if (accessError) return json({ ok: false, error: accessError.message }, 403);
const role = String((accessData as { role?: string } | null)?.role ?? "").toLowerCase();
if (!(role === "admin" || role === "superadmin")) return json({ ok: false, error: "Insufficient role" }, 403);
if (binding_type === "source" && !body.source_id) return json({ ok: false, error: "source_id is required for source bindings" }, 400);
if (binding_type === "ad_account" && !body.ad_account_id) return json({ ok: false, error: "ad_account_id is required for ad account bindings" }, 400);
const rpcName = binding_type === "source" ? "bind_source_entity_to_scope" : "bind_ad_account_to_scope";
const { data, error } = await adminClient.rpc(rpcName, { p_workspace_id: workspace_id, p_binding_id: body.binding_id ?? null, p_source_id: body.source_id ?? null, p_ad_account_id: body.ad_account_id ?? null, p_client_id: body.client_id ?? null, p_project_id: body.project_id ?? null, p_funnel_id: body.funnel_id ?? null, p_mapping_status: body.mapping_status ?? null, p_binding_status: body.binding_status ?? null, p_confidence: body.confidence ?? null, p_binding_method: body.binding_method ?? null, p_notes: body.notes ?? null, p_metadata: body.metadata ?? null });
if (error) { const details = error.message.toLowerCase(); if (details.includes("function") && details.includes("does not exist")) return json({ ok: false, error: "not wired: RPC signature needs confirmation", rpc: rpcName }, 501); return json({ ok: false, error: error.message, rpc: rpcName }, 400); }
return json({ ok: true, rpc: rpcName, result: data });
});
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
