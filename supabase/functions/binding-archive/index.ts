import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
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
  const binding_type = String(body.binding_type ?? "");
  const binding_id = String(body.binding_id ?? "");
  if (!workspace_id || !binding_id || (binding_type !== "source" && binding_type !== "ad_account")) return json({ ok: false, error: "workspace_id, binding_type, binding_id are required" }, 400);
  const { data, error } = await userClient.rpc("archive_binding", {
    p_workspace_id: workspace_id,
    p_binding_type: binding_type,
    p_binding_id: binding_id,
    p_metadata: body.metadata ?? null,
  });
  if (error) return json({ ok: false, error: error.message.includes("does not exist") ? "not wired: RPC signature needs confirmation" : error.message, rpc: "archive_binding" }, error.message.includes("does not exist") ? 501 : 400);
  return json({ ok: true, rpc: "archive_binding", result: data });
});
