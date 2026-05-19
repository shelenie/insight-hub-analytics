import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";
const corsHeaders = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type" };
type RequestBody = { workspace_id?: string; outbox_message_id?: string; retry_note?: string | null };

type OutboxRow = { id?: string; workspace_id?: string; status?: string | null; updated_at?: string | null };

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
const outbox_message_id = String(body.outbox_message_id ?? "").trim();
if (!workspace_id || !outbox_message_id) return json({ ok: false, error: "workspace_id and outbox_message_id are required" }, 400);

const { data: accessData, error: accessError } = await adminClient.rpc("check_edge_function_access_by_email", { p_user_email: authData.user.email, p_workspace_id: workspace_id });
if (accessError) return json({ ok: false, error: accessError.message }, 403);
const role = String((accessData as { role?: string } | null)?.role ?? "").toLowerCase();
if (!(role === "admin" || role === "superadmin")) return json({ ok: false, error: "Insufficient role" }, 403);

const rowRes = await adminClient.from("telegram_outbox_messages").select("id,workspace_id,status,updated_at").eq("workspace_id", workspace_id).eq("id", outbox_message_id).maybeSingle();
if (rowRes.error) return json({ ok: false, error: rowRes.error.message }, 400);
const row = rowRes.data as OutboxRow | null;
if (!row) return json({ ok: false, error: "Outbox message not found" }, 404);

const status = String(row.status ?? "").trim().toLowerCase();
if (!status) return json({ ok: false, error: "Outbox message status is missing or unknown" }, 400);
if (status === "sent") return json({ ok: false, error: "Outbox message already sent" }, 400);

const tryUpdate = async (nextStatus: "pending" | "queued") => {
  const payload: Record<string, string> = { status: nextStatus };
  if (row.updated_at !== undefined) payload.updated_at = new Date().toISOString();
  return adminClient.from("telegram_outbox_messages").update(payload).eq("workspace_id", workspace_id).eq("id", outbox_message_id).select("id,status,updated_at").single();
};

let updated = await tryUpdate("pending");
let finalStatus: "pending" | "queued" = "pending";
if (updated.error) {
  updated = await tryUpdate("queued");
  finalStatus = "queued";
}
if (updated.error) return json({ ok: false, error: updated.error.message }, 400);

return json({ ok: true, outbox_message_id, status: finalStatus, result: updated.data });
});

function json(payload: unknown, status = 200) { return new Response(JSON.stringify(payload), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } }); }
