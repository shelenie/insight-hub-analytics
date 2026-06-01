import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ActorContext = {
  mode: "webhook" | "backend_test" | "none";
  user_id: string | null;
  email: string | null;
  role: string | null;
  allowed: boolean;
  reason: string | null;
};

const FUNCTION_NAME = "facebook-lead-webhook";
const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-backend-test-secret, x-test-actor-email, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

function textResponse(status: number, body: string) {
  return new Response(body, {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "text/plain; charset=utf-8",
    },
  });
}

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function requiredEnv(name: string): string {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env: ${name}`);
  return value;
}

function optionalEnv(name: string, fallback: string): string {
  return Deno.env.get(name) ?? fallback;
}

function getProvidedBackendTestSecret(req: Request, body?: any) {
  return body?.backend_test_secret ?? req.headers.get("x-backend-test-secret") ?? null;
}

function getProvidedTestActorEmail(req: Request, body?: any) {
  return (
    body?.test_actor_email ??
    req.headers.get("x-test-actor-email") ??
    Deno.env.get("BACKEND_TEST_ACTOR_EMAIL") ??
    "olenashepel.ai@gmail.com"
  );
}

function normalizeAccessRow(row: any) {
  return {
    allowed: row?.allowed === true,
    actor_user_id: row?.result_actor_user_id ?? row?.actor_user_id ?? null,
    actor_email: row?.result_actor_email ?? row?.actor_email ?? null,
    actor_role: row?.result_actor_role ?? row?.actor_role ?? null,
    reason: row?.result_reason ?? row?.reason ?? null,
    allow_backend_test_mode:
      row?.result_allow_backend_test_mode ?? row?.allow_backend_test_mode ?? true,
  };
}

async function writeAuditLog(params: {
  supabaseAdmin: any;
  workspaceId: string;
  actor: ActorContext | null;
  action: string;
  severity?: "info" | "warning" | "error";
  metadata?: Record<string, unknown>;
}) {
  const { error } = await params.supabaseAdmin.from("audit_logs").insert({
    workspace_id: params.workspaceId,
    actor_user_id: params.actor?.user_id ?? null,
    actor_role: params.actor?.role ?? null,
    action: params.action,
    entity_type: "edge_function",
    entity_id: FUNCTION_NAME,
    severity: params.severity ?? "info",
    metadata: {
      actor_email: params.actor?.email ?? null,
      mode: params.actor?.mode ?? null,
      ...(params.metadata ?? {}),
    },
  });

  if (error) console.error("Audit log write failed:", error);
}

async function getBackendTestActor(params: {
  req: Request;
  body: any;
  workspaceId: string;
  supabaseAdmin: any;
}): Promise<ActorContext> {
  const providedBackendTestSecret = getProvidedBackendTestSecret(params.req, params.body);

  if (!providedBackendTestSecret) {
    return {
      mode: "none",
      user_id: null,
      email: null,
      role: null,
      allowed: false,
      reason: "missing_backend_test_secret",
    };
  }

  const backendTestMode = Deno.env.get("BACKEND_TEST_MODE") ?? "disabled";
  const expectedBackendTestSecret = Deno.env.get("BACKEND_TEST_SECRET") ?? "";

  if (backendTestMode !== "enabled") {
    return {
      mode: "backend_test",
      user_id: null,
      email: null,
      role: null,
      allowed: false,
      reason: "BACKEND_TEST_MODE_is_not_enabled",
    };
  }

  if (!expectedBackendTestSecret || providedBackendTestSecret !== expectedBackendTestSecret) {
    return {
      mode: "backend_test",
      user_id: null,
      email: null,
      role: null,
      allowed: false,
      reason: "backend_test_secret_does_not_match",
    };
  }

  const actorEmail = getProvidedTestActorEmail(params.req, params.body);

  const { data, error } = await params.supabaseAdmin.rpc(
    "check_edge_function_access_by_email",
    {
      p_workspace_id: params.workspaceId,
      p_function_name: FUNCTION_NAME,
      p_actor_email: actorEmail,
    },
  );

  if (error) throw new Error(`Access checker failed: ${error.message}`);

  const access = normalizeAccessRow(Array.isArray(data) ? data[0] : data);

  return {
    mode: "backend_test",
    user_id: access.actor_user_id,
    email: access.actor_email ?? actorEmail,
    role: access.actor_role,
    allowed: access.allowed,
    reason: access.reason,
  };
}

function timingSafeEqualHex(a: string, b: string) {
  if (a.length !== b.length) return false;

  let result = 0;

  for (let i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }

  return result === 0;
}

async function hmacSha256Hex(secret: string, message: string) {
  const encoder = new TextEncoder();

  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );

  const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(message));

  return Array.from(new Uint8Array(signature))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

async function verifyMetaSignature(params: {
  req: Request;
  rawBody: string;
  appSecret: string;
}) {
  const signatureHeader = params.req.headers.get("x-hub-signature-256");

  if (!signatureHeader || !signatureHeader.startsWith("sha256=")) {
    return {
      ok: false,
      reason: "missing_x_hub_signature_256",
    };
  }

  const providedSignature = signatureHeader.replace("sha256=", "").trim();
  const expectedSignature = await hmacSha256Hex(params.appSecret, params.rawBody);

  return {
    ok: timingSafeEqualHex(providedSignature, expectedSignature),
    reason: timingSafeEqualHex(providedSignature, expectedSignature)
      ? "ok"
      : "signature_mismatch",
  };
}

function extractLeadgenEvents(payload: any) {
  const events: Array<{
    page_id: string | null;
    form_id: string | null;
    leadgen_id: string | null;
    event_type: string;
    raw_change: any;
  }> = [];

  const entries = Array.isArray(payload?.entry) ? payload.entry : [];

  for (const entry of entries) {
    const pageIdFromEntry = entry?.id ? String(entry.id) : null;
    const changes = Array.isArray(entry?.changes) ? entry.changes : [];

    for (const change of changes) {
      const field = String(change?.field ?? "leadgen");
      const value = change?.value ?? {};

      const pageId =
        value?.page_id ??
        value?.pageId ??
        pageIdFromEntry ??
        null;

      const formId =
        value?.form_id ??
        value?.formId ??
        null;

      const leadgenId =
        value?.leadgen_id ??
        value?.leadgenId ??
        value?.lead_id ??
        value?.leadId ??
        null;

      events.push({
        page_id: pageId ? String(pageId) : null,
        form_id: formId ? String(formId) : null,
        leadgen_id: leadgenId ? String(leadgenId) : null,
        event_type: field,
        raw_change: change,
      });
    }
  }

  return events;
}

async function runMockWebhook(params: {
  supabaseAdmin: any;
  workspaceId: string;
  actor: ActorContext;
}) {
  let eventId: string | null = null;

  const cleanup = {
    webhook_events: 0,
  };

  const mockPayload = {
    object: "page",
    entry: [
      {
        id: "mock_page_webhook",
        time: Math.floor(Date.now() / 1000),
        changes: [
          {
            field: "leadgen",
            value: {
              page_id: "mock_page_webhook",
              form_id: "mock_form_webhook",
              leadgen_id: "mock_leadgen_webhook",
              created_time: Math.floor(Date.now() / 1000),
            },
          },
        ],
      },
    ],
  };

  try {
    await params.supabaseAdmin
      .from("facebook_lead_webhook_events")
      .delete()
      .eq("workspace_id", params.workspaceId)
      .eq("leadgen_id", "mock_leadgen_webhook");

    const { data: createdEventId, error: eventError } =
      await params.supabaseAdmin.rpc("log_facebook_lead_webhook_event", {
        p_workspace_id: params.workspaceId,
        p_ad_platform_connection_id: null,
        p_event_type: "leadgen",
        p_page_id: "mock_page_webhook",
        p_form_id: "mock_form_webhook",
        p_leadgen_id: "mock_leadgen_webhook",
        p_raw_payload: mockPayload,
        p_metadata: {
          created_by_edge_test: "facebook_lead_webhook_mock",
          actor_email: params.actor.email,
        },
      });

    if (eventError) throw new Error(eventError.message);

    eventId = createdEventId;

    const { count: eventCount } = await params.supabaseAdmin
      .from("facebook_lead_webhook_events")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", params.workspaceId)
      .eq("leadgen_id", "mock_leadgen_webhook");

    await params.supabaseAdmin
      .from("facebook_lead_webhook_events")
      .delete()
      .eq("id", eventId);

    cleanup.webhook_events = eventCount ?? 0;

    return {
      ok: true,
      real_meta_webhook_called: false,
      test_mode: "mock_webhook",
      events_logged: eventCount ?? 0,
      cleanup,
    };
  } catch (error) {
    if (eventId) {
      await params.supabaseAdmin
        .from("facebook_lead_webhook_events")
        .delete()
        .eq("id", eventId);
    }

    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  if (req.method === "GET") {
    const verifyToken = Deno.env.get("FACEBOOK_LEAD_WEBHOOK_VERIFY_TOKEN");

    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && challenge && verifyToken && token === verifyToken) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        actor: {
          mode: "webhook",
          user_id: null,
          email: null,
          role: null,
          allowed: true,
          reason: "meta_webhook_verified",
        },
        action: "facebook_lead_webhook_verified",
        severity: "info",
        metadata: {
          mode,
          has_challenge: true,
        },
      });

      return textResponse(200, challenge);
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: WORKSPACE_ID,
      actor: null,
      action: "facebook_lead_webhook_verify_failed",
      severity: "warning",
      metadata: {
        reason: "verify_token_mismatch_or_missing_params",
        mode,
        has_token: Boolean(token),
        has_challenge: Boolean(challenge),
        verify_token_configured: Boolean(verifyToken),
      },
    });

    return textResponse(403, "Forbidden");
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      ok: false,
      error: "Method not allowed. Use GET or POST.",
    });
  }

  const rawBody = await req.text();

  let body: any;

  try {
    body = rawBody ? JSON.parse(rawBody) : {};
  } catch (_error) {
    await writeAuditLog({
      supabaseAdmin,
      workspaceId: WORKSPACE_ID,
      actor: null,
      action: "facebook_lead_webhook_rejected",
      severity: "warning",
      metadata: {
        reason: "invalid_json",
      },
    });

    return jsonResponse(400, {
      ok: false,
      error: "Invalid JSON body.",
    });
  }

  try {
    if (body?.test_mode === "mock_webhook") {
      const actor = await getBackendTestActor({
        req,
        body,
        workspaceId: WORKSPACE_ID,
        supabaseAdmin,
      });

      if (!actor.allowed) {
        await writeAuditLog({
          supabaseAdmin,
          workspaceId: WORKSPACE_ID,
          actor,
          action: "facebook_lead_webhook_backend_test_denied",
          severity: "warning",
          metadata: {
            reason: actor.reason,
          },
        });

        return jsonResponse(403, {
          ok: false,
          error: "Forbidden. Backend test requires admin or superadmin role.",
          reason: actor.reason,
        });
      }

      const mockResult = await runMockWebhook({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        actor,
      });

      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        actor,
        action: "facebook_lead_webhook_mock_success",
        severity: "info",
        metadata: mockResult,
      });

      return jsonResponse(200, {
        ok: true,
        function: FUNCTION_NAME,
        mode: actor.mode,
        actor: {
          user_id: actor.user_id,
          email: actor.email,
          role: actor.role,
        },
        workspace_id: WORKSPACE_ID,
        ...mockResult,
      });
    }

    const metaAppSecret = requiredEnv("META_APP_SECRET");

    const signatureCheck = await verifyMetaSignature({
      req,
      rawBody,
      appSecret: metaAppSecret,
    });

    if (!signatureCheck.ok) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: WORKSPACE_ID,
        actor: null,
        action: "facebook_lead_webhook_signature_failed",
        severity: "warning",
        metadata: {
          reason: signatureCheck.reason,
        },
      });

      return jsonResponse(403, {
        ok: false,
        error: "Invalid webhook signature.",
        reason: signatureCheck.reason,
      });
    }

    const events = extractLeadgenEvents(body);

    let loggedEvents = 0;
    const eventResults: Array<Record<string, unknown>> = [];

    for (const event of events) {
      const { data: eventId, error: eventError } =
        await supabaseAdmin.rpc("log_facebook_lead_webhook_event", {
          p_workspace_id: WORKSPACE_ID,
          p_ad_platform_connection_id: null,
          p_event_type: event.event_type,
          p_page_id: event.page_id,
          p_form_id: event.form_id,
          p_leadgen_id: event.leadgen_id,
          p_raw_payload: {
            full_payload: body,
            change: event.raw_change,
          },
          p_metadata: {
            source: FUNCTION_NAME,
            received_at: new Date().toISOString(),
            signature_verified: true,
          },
        });

      if (eventError) {
        eventResults.push({
          status: "failed",
          leadgen_id: event.leadgen_id,
          error: eventError.message,
        });
      } else {
        loggedEvents++;
        eventResults.push({
          status: "logged",
          event_id: eventId,
          leadgen_id: event.leadgen_id,
          page_id: event.page_id,
          form_id: event.form_id,
        });
      }
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: WORKSPACE_ID,
      actor: {
        mode: "webhook",
        user_id: null,
        email: null,
        role: null,
        allowed: true,
        reason: "signature_verified",
      },
      action: "facebook_lead_webhook_received",
      severity: "info",
      metadata: {
        events_found: events.length,
        events_logged: loggedEvents,
      },
    });

    return jsonResponse(200, {
      ok: true,
      function: FUNCTION_NAME,
      mode: "webhook",
      workspace_id: WORKSPACE_ID,
      events_found: events.length,
      events_logged: loggedEvents,
      event_results: eventResults,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: WORKSPACE_ID,
      actor: null,
      action: "facebook_lead_webhook_failed",
      severity: "error",
      metadata: {
        error: message,
      },
    });

    return jsonResponse(500, {
      ok: false,
      function: FUNCTION_NAME,
      error: "facebook-lead-webhook failed.",
      details: message,
    });
  }
});
