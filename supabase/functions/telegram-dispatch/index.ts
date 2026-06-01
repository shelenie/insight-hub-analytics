import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  workspace_id?: string;
  max_messages?: number;
  test_mode?: "mock_dispatch" | "dry_run";
  backend_test_secret?: string;
  test_actor_email?: string;
  metadata?: Record<string, unknown>;
};

type ActorContext = {
  mode: "user_jwt" | "backend_test" | "none";
  user_id: string | null;
  email: string | null;
  role: string | null;
  allowed: boolean;
  reason: string | null;
};

const FUNCTION_NAME = "telegram-dispatch";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-backend-test-secret, x-test-actor-email",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

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

function getProvidedBackendTestSecret(req: Request, body: RequestBody) {
  return body.backend_test_secret ?? req.headers.get("x-backend-test-secret") ?? null;
}

function getProvidedTestActorEmail(req: Request, body: RequestBody) {
  return (
    body.test_actor_email ??
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

async function getActorContext(params: {
  req: Request;
  body: RequestBody;
  workspaceId: string;
  supabaseAnon: any;
  supabaseAdmin: any;
}): Promise<ActorContext> {
  const { req, body, workspaceId, supabaseAnon, supabaseAdmin } = params;

  const authHeader = req.headers.get("Authorization");
  const providedBackendTestSecret = getProvidedBackendTestSecret(req, body);

  const backendTestMode = Deno.env.get("BACKEND_TEST_MODE") ?? "disabled";
  const expectedBackendTestSecret = Deno.env.get("BACKEND_TEST_SECRET") ?? "";

  if (providedBackendTestSecret) {
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

    const actorEmail = getProvidedTestActorEmail(req, body);

    const { data, error } = await supabaseAdmin.rpc(
      "check_edge_function_access_by_email",
      {
        p_workspace_id: workspaceId,
        p_function_name: FUNCTION_NAME,
        p_actor_email: actorEmail,
      },
    );

    if (error) throw new Error(`Access checker failed: ${error.message}`);

    const access = normalizeAccessRow(Array.isArray(data) ? data[0] : data);

    if (access.allow_backend_test_mode !== true) {
      return {
        mode: "backend_test",
        user_id: access.actor_user_id,
        email: access.actor_email ?? actorEmail,
        role: access.actor_role,
        allowed: false,
        reason: "backend_test_mode_not_allowed_for_this_function",
      };
    }

    return {
      mode: "backend_test",
      user_id: access.actor_user_id,
      email: access.actor_email ?? actorEmail,
      role: access.actor_role,
      allowed: access.allowed,
      reason: access.reason,
    };
  }

  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.replace("Bearer ", "").trim();

    const { data: userData, error: userError } =
      await supabaseAnon.auth.getUser(token);

    if (userError || !userData?.user) {
      return {
        mode: "user_jwt",
        user_id: null,
        email: null,
        role: null,
        allowed: false,
        reason: "invalid_or_expired_user_jwt",
      };
    }

    const { data, error } = await supabaseAdmin.rpc(
      "check_edge_function_access",
      {
        p_workspace_id: workspaceId,
        p_function_name: FUNCTION_NAME,
        p_actor_user_id: userData.user.id,
      },
    );

    if (error) throw new Error(`Access checker failed: ${error.message}`);

    const access = normalizeAccessRow(Array.isArray(data) ? data[0] : data);

    return {
      mode: "user_jwt",
      user_id: userData.user.id,
      email: userData.user.email ?? access.actor_email,
      role: access.actor_role,
      allowed: access.allowed,
      reason: access.reason,
    };
  }

  return {
    mode: "none",
    user_id: null,
    email: null,
    role: null,
    allowed: false,
    reason: "missing_user_jwt_or_backend_test_secret",
  };
}

async function telegramApi(method: string, payload: Record<string, unknown>) {
  const botToken = requiredEnv("TELEGRAM_BOT_TOKEN");

  const response = await fetch(`https://api.telegram.org/bot${botToken}/${method}`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok || data?.ok === false) {
    throw new Error(
      `Telegram API ${method} failed: ${response.status} ${
        data?.description ?? JSON.stringify(data)
      }`,
    );
  }

  return data;
}

function buildTelegramPayload(message: any) {
  const payload = message.message_payload ?? {};
  const replyMarkup = payload?.reply_markup ?? null;

  return {
    chat_id: message.telegram_chat_id,
    text: message.message_text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(replyMarkup ? { reply_markup: replyMarkup } : {}),
  };
}

async function runMockDispatch(params: {
  supabaseAdmin: any;
  workspaceId: string;
  actor: ActorContext;
}) {
  let chatRowId: string | null = null;
  let messageId: string | null = null;

  const cleanup = {
    telegram_chats: 0,
    outbox_messages: 0,
  };

  try {
    const { data: registeredChatId, error: chatError } =
      await params.supabaseAdmin.rpc("register_telegram_chat", {
        p_workspace_id: params.workspaceId,
        p_telegram_chat_id: "mock_dispatch_chat_43_2",
        p_chat_type: "private",
        p_chat_title: null,
        p_username: "mock_dispatch_user",
        p_first_name: "Mock",
        p_last_name: null,
        p_linked_user_id: params.actor.user_id,
        p_linked_email: params.actor.email,
        p_linked_role: params.actor.role,
        p_can_receive_alerts: true,
        p_can_approve_actions: true,
        p_metadata: {
          created_by_edge_test: "telegram_dispatch_mock",
        },
      });

    if (chatError) throw new Error(chatError.message);
    chatRowId = registeredChatId;

    const { data: insertedMessage, error: messageError } = await params.supabaseAdmin
      .from("telegram_outbox_messages")
      .insert({
        workspace_id: params.workspaceId,
        telegram_chat_id: "mock_dispatch_chat_43_2",
        event_type: "import_failure_alert",
        severity: "warning",
        priority: 4,
        message_text: "MOCK Telegram dispatch message. Do not send.",
        message_payload: {
          created_by_edge_test: "telegram_dispatch_mock",
        },
        status: "queued",
        related_entity_type: "test",
        related_entity_id: "mock_dispatch_43_2",
        metadata: {
          created_by_edge_test: "telegram_dispatch_mock",
        },
      })
      .select("id")
      .single();

    if (messageError) throw new Error(messageError.message);
    messageId = insertedMessage.id;

    const { data: pendingMessages, error: pendingError } = await params.supabaseAdmin
      .from("v_telegram_outbox_pending")
      .select("*")
      .eq("workspace_id", params.workspaceId)
      .eq("id", messageId)
      .limit(1);

    if (pendingError) throw new Error(pendingError.message);

    const pendingSeen = Array.isArray(pendingMessages) && pendingMessages.length === 1;

    await params.supabaseAdmin
      .from("telegram_outbox_messages")
      .update({
        status: "sent",
        telegram_message_id: "mock_telegram_message_id_43_2",
        sent_at: new Date().toISOString(),
        metadata: {
          created_by_edge_test: "telegram_dispatch_mock",
          mock_dispatch_result: "sent_without_real_telegram_api",
        },
      })
      .eq("id", messageId);

    const { data: updatedMessage, error: updatedError } = await params.supabaseAdmin
      .from("telegram_outbox_messages")
      .select("id,status,telegram_message_id,sent_at")
      .eq("id", messageId)
      .single();

    if (updatedError) throw new Error(updatedError.message);

    const dispatchMarkedSent =
      updatedMessage?.status === "sent" &&
      updatedMessage?.telegram_message_id === "mock_telegram_message_id_43_2" &&
      Boolean(updatedMessage?.sent_at);

    await params.supabaseAdmin
      .from("telegram_outbox_messages")
      .delete()
      .eq("id", messageId);
    cleanup.outbox_messages = 1;

    await params.supabaseAdmin
      .from("telegram_chats")
      .delete()
      .eq("id", chatRowId);
    cleanup.telegram_chats = 1;

    return {
      ok: true,
      test_mode: "mock_dispatch",
      real_telegram_api_called: false,
      pending_message_seen: pendingSeen,
      dispatch_marked_sent: dispatchMarkedSent,
      cleanup,
    };
  } catch (error) {
    if (messageId) {
      await params.supabaseAdmin
        .from("telegram_outbox_messages")
        .delete()
        .eq("id", messageId);
    }

    if (chatRowId) {
      await params.supabaseAdmin
        .from("telegram_chats")
        .delete()
        .eq("id", chatRowId);
    }

    throw error;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return jsonResponse(405, {
      ok: false,
      error: "Method not allowed. Use POST.",
    });
  }

  let body: RequestBody;

  try {
    body = await req.json();
  } catch (_error) {
    return jsonResponse(400, {
      ok: false,
      error: "Invalid JSON body.",
    });
  }

  const workspaceId = body.workspace_id;

  if (!workspaceId) {
    return jsonResponse(400, {
      ok: false,
      error: "workspace_id is required.",
    });
  }

  const maxMessages = Math.max(1, Math.min(Number(body.max_messages ?? 10), 50));

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const supabaseAnonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");

  const authHeader = req.headers.get("Authorization");

  const supabaseAnon = createClient(supabaseUrl, supabaseAnonKey, {
    global: {
      headers: authHeader ? { Authorization: authHeader } : {},
    },
  });

  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let actor: ActorContext;

  try {
    actor = await getActorContext({
      req,
      body,
      workspaceId,
      supabaseAnon,
      supabaseAdmin,
    });
  } catch (error) {
    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor: null,
      action: "telegram_dispatch_permission_check_failed",
      severity: "error",
      metadata: {
        error: error instanceof Error ? error.message : String(error),
      },
    });

    return jsonResponse(500, {
      ok: false,
      error: "Permission check failed.",
      details: error instanceof Error ? error.message : String(error),
    });
  }

  if (!actor.allowed) {
    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "telegram_dispatch_denied",
      severity: "warning",
      metadata: {
        reason: actor.reason,
      },
    });

    return jsonResponse(403, {
      ok: false,
      error: "Forbidden. This action requires admin or superadmin role.",
      function: FUNCTION_NAME,
      mode: actor.mode,
      actor_email: actor.email,
      actor_role: actor.role,
      reason: actor.reason,
    });
  }

  await writeAuditLog({
    supabaseAdmin,
    workspaceId,
    actor,
    action: "telegram_dispatch_started",
    severity: "info",
    metadata: {
      max_messages: maxMessages,
      test_mode: body.test_mode ?? null,
    },
  });

  try {
    if (actor.mode === "backend_test" && body.test_mode === "mock_dispatch") {
      const mockResult = await runMockDispatch({
        supabaseAdmin,
        workspaceId,
        actor,
      });

      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "telegram_dispatch_mock_success",
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
        workspace_id: workspaceId,
        ...mockResult,
      });
    }

    if (body.test_mode === "dry_run") {
      const { data: pendingMessages, error: pendingError } = await supabaseAdmin
        .from("v_telegram_outbox_pending")
        .select("*")
        .eq("workspace_id", workspaceId)
        .limit(maxMessages);

      if (pendingError) throw new Error(pendingError.message);

      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "telegram_dispatch_dry_run_success",
        severity: "info",
        metadata: {
          pending_count: pendingMessages?.length ?? 0,
        },
      });

      return jsonResponse(200, {
        ok: true,
        function: FUNCTION_NAME,
        mode: actor.mode,
        workspace_id: workspaceId,
        dry_run: true,
        pending_count: pendingMessages?.length ?? 0,
        pending_messages: pendingMessages ?? [],
      });
    }

    const { data: pendingMessages, error: pendingError } = await supabaseAdmin
      .from("v_telegram_outbox_pending")
      .select("*")
      .eq("workspace_id", workspaceId)
      .limit(maxMessages);

    if (pendingError) throw new Error(pendingError.message);

    const results: Array<Record<string, unknown>> = [];

    for (const message of pendingMessages ?? []) {
      const result: Record<string, unknown> = {
        message_id: message.id,
        telegram_chat_id: message.telegram_chat_id,
        event_type: message.event_type,
      };

      try {
        await supabaseAdmin
          .from("telegram_outbox_messages")
          .update({
            status: "sending",
          })
          .eq("id", message.id)
          .eq("status", "queued");

        const telegramResult = await telegramApi("sendMessage", buildTelegramPayload(message));

        const telegramMessageId =
          telegramResult?.result?.message_id != null
            ? String(telegramResult.result.message_id)
            : null;

        await supabaseAdmin
          .from("telegram_outbox_messages")
          .update({
            status: "sent",
            telegram_message_id: telegramMessageId,
            sent_at: new Date().toISOString(),
            error_message: null,
          })
          .eq("id", message.id);

        result.status = "sent";
        result.telegram_message_id = telegramMessageId;
      } catch (error) {
        const messageText = error instanceof Error ? error.message : String(error);

        await supabaseAdmin
          .from("telegram_outbox_messages")
          .update({
            status: "failed",
            failed_at: new Date().toISOString(),
            error_message: messageText,
          })
          .eq("id", message.id);

        result.status = "failed";
        result.error = messageText;
      }

      results.push(result);
    }

    const sentCount = results.filter((item) => item.status === "sent").length;
    const failedCount = results.filter((item) => item.status === "failed").length;

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action:
        failedCount > 0
          ? "telegram_dispatch_partial_or_failed"
          : "telegram_dispatch_success",
      severity: failedCount > 0 ? "error" : "info",
      metadata: {
        messages_seen: pendingMessages?.length ?? 0,
        sent_count: sentCount,
        failed_count: failedCount,
        real_telegram_api_called: (pendingMessages?.length ?? 0) > 0,
      },
    });

    return jsonResponse(failedCount > 0 ? 207 : 200, {
      ok: failedCount === 0,
      function: FUNCTION_NAME,
      mode: actor.mode,
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: actor.role,
      },
      workspace_id: workspaceId,
      messages_seen: pendingMessages?.length ?? 0,
      sent_count: sentCount,
      failed_count: failedCount,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "telegram_dispatch_failed",
      severity: "error",
      metadata: {
        error: message,
      },
    });

    return jsonResponse(500, {
      ok: false,
      function: FUNCTION_NAME,
      error: "telegram-dispatch failed.",
      details: message,
    });
  }
});
