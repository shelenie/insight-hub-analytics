import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type ActorContext = {
  mode: "telegram_webhook" | "backend_test" | "none";
  user_id: string | null;
  email: string | null;
  role: string | null;
  allowed: boolean;
  reason: string | null;
};

const FUNCTION_NAME = "telegram-webhook";
const DEFAULT_WORKSPACE_ID =
  Deno.env.get("TELEGRAM_DEFAULT_WORKSPACE_ID") ??
  "5ebbe435-fd79-44c3-834e-642e8fba00dc";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-backend-test-secret, x-test-actor-email, x-telegram-bot-api-secret-token",
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

async function sendTelegramMessage(params: {
  chatId: string;
  text: string;
  replyMarkup?: Record<string, unknown>;
}) {
  return telegramApi("sendMessage", {
    chat_id: params.chatId,
    text: params.text,
    parse_mode: "HTML",
    disable_web_page_preview: true,
    ...(params.replyMarkup ? { reply_markup: params.replyMarkup } : {}),
  });
}

async function answerCallbackQuery(params: {
  callbackQueryId: string;
  text: string;
}) {
  return telegramApi("answerCallbackQuery", {
    callback_query_id: params.callbackQueryId,
    text: params.text,
    show_alert: false,
  });
}

function extractMessage(update: any) {
  return update?.message ?? update?.edited_message ?? null;
}

function extractCallback(update: any) {
  return update?.callback_query ?? null;
}

function getChatFromUpdate(update: any) {
  const message = extractMessage(update);
  const callback = extractCallback(update);

  return message?.chat ?? callback?.message?.chat ?? null;
}

function getUserFromUpdate(update: any) {
  const message = extractMessage(update);
  const callback = extractCallback(update);

  return message?.from ?? callback?.from ?? null;
}

function getMessageText(update: any) {
  const message = extractMessage(update);
  return String(message?.text ?? "").trim();
}

function getCallbackData(update: any) {
  const callback = extractCallback(update);
  return String(callback?.data ?? "").trim();
}

function getUpdateId(update: any) {
  return String(update?.update_id ?? crypto.randomUUID());
}

function parseActionCallback(callbackData: string) {
  const [action, token] = callbackData.split(":");

  if (!action || !token) {
    return null;
  }

  if (!["approve", "reject"].includes(action)) {
    return null;
  }

  return {
    action,
    token,
  };
}

async function registerChatFromUpdate(params: {
  supabaseAdmin: any;
  workspaceId: string;
  update: any;
}) {
  const chat = getChatFromUpdate(params.update);
  const user = getUserFromUpdate(params.update);

  if (!chat?.id) {
    throw new Error("Telegram chat_id missing in update.");
  }

  const chatId = String(chat.id);
  const chatType = String(chat.type ?? "unknown");

  const { data, error } = await params.supabaseAdmin.rpc("register_telegram_chat", {
    p_workspace_id: params.workspaceId,
    p_telegram_chat_id: chatId,
    p_chat_type: chatType,
    p_chat_title: chat.title ?? null,
    p_username: user?.username ?? chat.username ?? null,
    p_first_name: user?.first_name ?? null,
    p_last_name: user?.last_name ?? null,
    p_linked_user_id: null,
    p_linked_email: null,
    p_linked_role: null,
    p_can_receive_alerts: true,
    p_can_approve_actions: chatType === "private",
    p_metadata: {
      source: FUNCTION_NAME,
      telegram_user_id: user?.id ? String(user.id) : null,
      registered_at: new Date().toISOString(),
    },
  });

  if (error) throw new Error(`register_telegram_chat failed: ${error.message}`);

  return {
    telegram_chat_row_id: data,
    telegram_chat_id: chatId,
    chat_type: chatType,
  };
}

async function logInboundUpdate(params: {
  supabaseAdmin: any;
  workspaceId: string;
  update: any;
}) {
  const chat = getChatFromUpdate(params.update);
  const user = getUserFromUpdate(params.update);
  const callback = extractCallback(params.update);

  const { data, error } = await params.supabaseAdmin.rpc("log_telegram_inbound_update", {
    p_workspace_id: params.workspaceId,
    p_telegram_update_id: getUpdateId(params.update),
    p_telegram_chat_id: chat?.id ? String(chat.id) : null,
    p_telegram_user_id: user?.id ? String(user.id) : null,
    p_username: user?.username ?? null,
    p_message_text: getMessageText(params.update) || null,
    p_callback_query_id: callback?.id ? String(callback.id) : null,
    p_callback_data: callback?.data ? String(callback.data) : null,
    p_raw_payload: params.update,
    p_metadata: {
      source: FUNCTION_NAME,
    },
  });

  if (error) throw new Error(`log_telegram_inbound_update failed: ${error.message}`);

  return data;
}

async function handleStartCommand(params: {
  supabaseAdmin: any;
  workspaceId: string;
  update: any;
}) {
  const registered = await registerChatFromUpdate(params);

  await sendTelegramMessage({
    chatId: registered.telegram_chat_id,
    text:
      "✅ <b>Telegram підключено.</b>\n\n" +
      "Цей чат може отримувати operational alerts для Insight Hub:\n" +
      "• import failures\n" +
      "• stale imports\n" +
      "• unknown mapping confirmations\n" +
      "• ads/source sync issues",
  });

  return {
    handled: true,
    action: "start_registered_chat",
    ...registered,
  };
}

async function handleCallback(params: {
  supabaseAdmin: any;
  workspaceId: string;
  update: any;
}) {
  const callback = extractCallback(params.update);

  if (!callback?.id) {
    return {
      handled: false,
      reason: "missing_callback_id",
    };
  }

  const callbackData = getCallbackData(params.update);
  const parsed = parseActionCallback(callbackData);

  if (!parsed) {
    await answerCallbackQuery({
      callbackQueryId: String(callback.id),
      text: "Unknown action.",
    });

    return {
      handled: false,
      reason: "unknown_callback_data",
      callback_data: callbackData,
    };
  }

  const user = getUserFromUpdate(params.update);
  const resolution = parsed.action === "approve" ? "approve" : "reject";

  const { error } = await params.supabaseAdmin.rpc("resolve_telegram_action_request", {
    p_workspace_id: params.workspaceId,
    p_action_token: parsed.token,
    p_resolution: resolution,
    p_resolved_by_telegram_user_id: user?.id ? String(user.id) : null,
    p_resolved_by_username: user?.username ?? null,
    p_resolution_payload: {
      callback_query_id: String(callback.id),
      callback_data: callbackData,
      resolved_from: FUNCTION_NAME,
    },
  });

  if (error) {
    await answerCallbackQuery({
      callbackQueryId: String(callback.id),
      text: "Could not resolve action.",
    });

    throw new Error(`resolve_telegram_action_request failed: ${error.message}`);
  }

  await answerCallbackQuery({
    callbackQueryId: String(callback.id),
    text: parsed.action === "approve" ? "Approved." : "Rejected.",
  });

  const chat = getChatFromUpdate(params.update);

  if (chat?.id) {
    await sendTelegramMessage({
      chatId: String(chat.id),
      text:
        parsed.action === "approve"
          ? "✅ Action approved."
          : "❌ Action rejected.",
    });
  }

  return {
    handled: true,
    action: "callback_resolved_action_request",
    resolution,
    action_token: parsed.token,
  };
}

async function runMockWebhook(params: {
  supabaseAdmin: any;
  workspaceId: string;
  actor: ActorContext;
}) {
  let chatRowId: string | null = null;
  let inboundUpdateId: string | null = null;
  let actionRequestId: string | null = null;
  let actionToken: string | null = null;

  const cleanup = {
    telegram_chats: 0,
    inbound_updates: 0,
    action_requests: 0,
  };

  try {
    const mockUpdate = {
      update_id: 420001,
      message: {
        message_id: 1,
        date: Math.floor(Date.now() / 1000),
        text: "/start",
        chat: {
          id: "mock_telegram_chat_42_2",
          type: "private",
          first_name: "Mock",
          username: "mock_telegram_user",
        },
        from: {
          id: "mock_telegram_user_42_2",
          is_bot: false,
          first_name: "Mock",
          username: "mock_telegram_user",
        },
      },
    };

    const { data: registeredChatId, error: chatError } =
      await params.supabaseAdmin.rpc("register_telegram_chat", {
        p_workspace_id: params.workspaceId,
        p_telegram_chat_id: "mock_telegram_chat_42_2",
        p_chat_type: "private",
        p_chat_title: null,
        p_username: "mock_telegram_user",
        p_first_name: "Mock",
        p_last_name: null,
        p_linked_user_id: params.actor.user_id,
        p_linked_email: params.actor.email,
        p_linked_role: params.actor.role,
        p_can_receive_alerts: true,
        p_can_approve_actions: true,
        p_metadata: {
          created_by_edge_test: "telegram_webhook_mock",
        },
      });

    if (chatError) throw new Error(chatError.message);
    chatRowId = registeredChatId;

    const { data: loggedUpdateId, error: inboundError } =
      await params.supabaseAdmin.rpc("log_telegram_inbound_update", {
        p_workspace_id: params.workspaceId,
        p_telegram_update_id: "mock_update_42_2",
        p_telegram_chat_id: "mock_telegram_chat_42_2",
        p_telegram_user_id: "mock_telegram_user_42_2",
        p_username: "mock_telegram_user",
        p_message_text: "/start",
        p_callback_query_id: null,
        p_callback_data: null,
        p_raw_payload: mockUpdate,
        p_metadata: {
          created_by_edge_test: "telegram_webhook_mock",
        },
      });

    if (inboundError) throw new Error(inboundError.message);
    inboundUpdateId = loggedUpdateId;

    const { data: actionRows, error: actionError } =
      await params.supabaseAdmin.rpc("create_telegram_action_request", {
        p_workspace_id: params.workspaceId,
        p_action_type: "mapping_confirmation",
        p_title: "MOCK Mapping Confirmation",
        p_description: "Mock confirmation created by telegram-webhook backend test.",
        p_proposed_payload: {
          source: "mock",
          suggested_project: "Mock Project",
        },
        p_telegram_chat_id: "mock_telegram_chat_42_2",
        p_related_entity_type: "test",
        p_related_entity_id: "mock_entity_42_2",
        p_requested_by: params.actor.user_id,
        p_requested_by_email: params.actor.email,
        p_requested_by_role: params.actor.role,
        p_expires_at: new Date(Date.now() + 86400_000).toISOString(),
        p_metadata: {
          created_by_edge_test: "telegram_webhook_mock",
        },
      });

    if (actionError) throw new Error(actionError.message);

    const action = Array.isArray(actionRows) ? actionRows[0] : actionRows;
    actionRequestId = action?.telegram_action_request_id ?? null;
    actionToken = action?.action_token ?? null;

    if (!actionRequestId || !actionToken) {
      throw new Error("Mock action request was not created correctly.");
    }

    const { error: resolveError } = await params.supabaseAdmin.rpc(
      "resolve_telegram_action_request",
      {
        p_workspace_id: params.workspaceId,
        p_action_token: actionToken,
        p_resolution: "approve",
        p_resolved_by_telegram_user_id: "mock_telegram_user_42_2",
        p_resolved_by_username: "mock_telegram_user",
        p_resolution_payload: {
          source: "telegram_webhook_mock",
        },
      },
    );

    if (resolveError) throw new Error(resolveError.message);

    await params.supabaseAdmin
      .from("telegram_action_requests")
      .delete()
      .eq("id", actionRequestId);
    cleanup.action_requests = 1;

    await params.supabaseAdmin
      .from("telegram_inbound_updates")
      .delete()
      .eq("id", inboundUpdateId);
    cleanup.inbound_updates = 1;

    await params.supabaseAdmin
      .from("telegram_chats")
      .delete()
      .eq("id", chatRowId);
    cleanup.telegram_chats = 1;

    return {
      ok: true,
      test_mode: "mock_webhook",
      real_telegram_api_called: false,
      chat_registered: true,
      inbound_update_logged: true,
      action_request_created: true,
      action_request_resolved: true,
      cleanup,
    };
  } catch (error) {
    if (actionRequestId) {
      await params.supabaseAdmin
        .from("telegram_action_requests")
        .delete()
        .eq("id", actionRequestId);
    }

    if (inboundUpdateId) {
      await params.supabaseAdmin
        .from("telegram_inbound_updates")
        .delete()
        .eq("id", inboundUpdateId);
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

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

  let body: any;

  try {
    body = await req.json();
  } catch (_error) {
    await writeAuditLog({
      supabaseAdmin,
      workspaceId: DEFAULT_WORKSPACE_ID,
      actor: null,
      action: "telegram_webhook_rejected",
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
        workspaceId: DEFAULT_WORKSPACE_ID,
        supabaseAdmin,
      });

      if (!actor.allowed) {
        await writeAuditLog({
          supabaseAdmin,
          workspaceId: DEFAULT_WORKSPACE_ID,
          actor,
          action: "telegram_webhook_backend_test_denied",
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
        workspaceId: DEFAULT_WORKSPACE_ID,
        actor,
      });

      await writeAuditLog({
        supabaseAdmin,
        workspaceId: DEFAULT_WORKSPACE_ID,
        actor,
        action: "telegram_webhook_mock_success",
        severity: "info",
        metadata: mockResult,
      });

      return jsonResponse(200, {
        ok: true,
        function: FUNCTION_NAME,
        workspace_id: DEFAULT_WORKSPACE_ID,
        mode: actor.mode,
        actor: {
          user_id: actor.user_id,
          email: actor.email,
          role: actor.role,
        },
        ...mockResult,
      });
    }

    const expectedSecret = requiredEnv("TELEGRAM_WEBHOOK_SECRET");
    const receivedSecret = req.headers.get("x-telegram-bot-api-secret-token");

    if (!receivedSecret || receivedSecret !== expectedSecret) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId: DEFAULT_WORKSPACE_ID,
        actor: null,
        action: "telegram_webhook_secret_failed",
        severity: "warning",
        metadata: {
          has_secret_header: Boolean(receivedSecret),
        },
      });

      return jsonResponse(403, {
        ok: false,
        error: "Invalid Telegram webhook secret.",
      });
    }

    const inboundUpdateId = await logInboundUpdate({
      supabaseAdmin,
      workspaceId: DEFAULT_WORKSPACE_ID,
      update: body,
    });

    const messageText = getMessageText(body);
    const callback = extractCallback(body);

    let handlerResult: Record<string, unknown> = {
      handled: false,
      reason: "no_supported_handler",
    };

    if (messageText === "/start" || messageText.startsWith("/start ")) {
      handlerResult = await handleStartCommand({
        supabaseAdmin,
        workspaceId: DEFAULT_WORKSPACE_ID,
        update: body,
      });
    } else if (callback) {
      handlerResult = await handleCallback({
        supabaseAdmin,
        workspaceId: DEFAULT_WORKSPACE_ID,
        update: body,
      });
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: DEFAULT_WORKSPACE_ID,
      actor: {
        mode: "telegram_webhook",
        user_id: null,
        email: null,
        role: null,
        allowed: true,
        reason: "telegram_secret_verified",
      },
      action: "telegram_webhook_received",
      severity: "info",
      metadata: {
        telegram_update_id: getUpdateId(body),
        inbound_update_id: inboundUpdateId,
        message_text: messageText || null,
        callback_data: getCallbackData(body) || null,
        ...handlerResult,
      },
    });

    return jsonResponse(200, {
      ok: true,
      function: FUNCTION_NAME,
      workspace_id: DEFAULT_WORKSPACE_ID,
      telegram_update_id: getUpdateId(body),
      inbound_update_id: inboundUpdateId,
      ...handlerResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await writeAuditLog({
      supabaseAdmin,
      workspaceId: DEFAULT_WORKSPACE_ID,
      actor: null,
      action: "telegram_webhook_failed",
      severity: "error",
      metadata: {
        error: message,
      },
    });

    return jsonResponse(500, {
      ok: false,
      function: FUNCTION_NAME,
      error: "telegram-webhook failed.",
      details: message,
    });
  }
});
