import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  workspace_id?: string;
  request_type?: string;
  context_scope?: string;
  prompt?: string;
  question?: string;
  date_from?: string | null;
  date_to?: string | null;
  platform?: string | null;
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

const FUNCTION_NAME = "ai-helper-run";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-backend-test-secret, x-test-actor-email",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body, null, 2), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
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
  };
}

function defaultContextScope(requestType: string) {
  const map: Record<string, string> = {
    data_quality_summary: "import_health",
    import_health_summary: "import_health",
    import_error_explanation: "import_errors",

    ads_performance_summary: "ads_performance",
    ads_anomaly_explanation: "ads_anomalies",
    ads_health_summary: "ads_health",

    production_readiness_summary: "production_readiness",
    onboarding_summary: "onboarding",
    mapping_review_summary: "mapping_review",
    operational_alerts_summary: "operational_alerts",
    full_production_summary: "full_production",
  };

  return map[requestType] ?? "production_readiness";
}

function isProductionContext(contextScope: string) {
  return [
    "production_readiness",
    "onboarding",
    "mapping_review",
    "operational_alerts",
    "full_production",
  ].includes(contextScope);
}

function isAdsContext(contextScope: string) {
  return ["ads_performance", "ads_anomalies", "ads_health"].includes(contextScope);
}

function safeInsightType(requestType: string) {
  if (requestType.includes("mapping")) return "mapping_issue";
  if (requestType.includes("anomaly")) return "anomaly";
  if (requestType.includes("import")) return "import_issue";
  if (requestType.includes("quality")) return "data_quality";
  return "summary";
}

function titleForRequest(requestType: string) {
  const map: Record<string, string> = {
    production_readiness_summary: "Production readiness summary",
    onboarding_summary: "Onboarding summary",
    mapping_review_summary: "Mapping review summary",
    operational_alerts_summary: "Operational alerts summary",
    full_production_summary: "Full production summary",
    ads_health_summary: "Ads health summary",
    ads_performance_summary: "Ads performance summary",
    ads_anomaly_explanation: "Ads anomaly explanation",
    data_quality_summary: "Data quality summary",
    import_health_summary: "Import health summary",
    import_error_explanation: "Import error explanation",
  };

  return map[requestType] ?? "AI helper request";
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

async function createAiRequestDirect(params: {
  supabaseAdmin: any;
  workspaceId: string;
  actor: ActorContext;
  requestType: string;
  contextScope: string;
  prompt: string;
  dateFrom: string | null;
  dateTo: string | null;
  platform: string | null;
  metadata: Record<string, unknown>;
}) {
  const { data, error } = await params.supabaseAdmin
    .from("ai_helper_requests")
    .insert({
      workspace_id: params.workspaceId,
      request_type: params.requestType,
      status: "processing",
      requested_by: params.actor.user_id,
      requested_actor_email: params.actor.email,
      requested_actor_role: params.actor.role,
      title: titleForRequest(params.requestType),
      user_prompt: params.prompt,
      context_scope: params.contextScope,
      allowed_sources: [],
      input_payload: {
        date_from: params.dateFrom,
        date_to: params.dateTo,
        platform: params.platform,
      },
      metadata: {
        ...params.metadata,
        created_via: "ai_helper_run_direct_insert",
        request_type: params.requestType,
        context_scope: params.contextScope,
      },
    })
    .select("id")
    .single();

  if (error) {
    throw new Error(`Direct insert ai_helper_requests failed: ${error.message}`);
  }

  return data.id as string;
}

async function markAiRequestResultDirect(params: {
  supabaseAdmin: any;
  workspaceId: string;
  aiRequestId: string;
  status: "success" | "failed";
  answer: string | null;
  errorMessage: string | null;
  provider: string;
  model: string;
  contextUsed: any;
  metadata: Record<string, unknown>;
}) {
  const { error } = await params.supabaseAdmin
    .from("ai_helper_requests")
    .update({
      status: params.status,
      ai_result:
        params.status === "success"
          ? {
              provider: params.provider,
              model: params.model,
              answer: params.answer,
              context_used: params.contextUsed,
            }
          : null,
      result_summary: params.answer ? params.answer.slice(0, 1000) : null,
      confidence: params.status === "success" ? "medium" : null,
      error_message: params.errorMessage,
      processed_at: new Date().toISOString(),
      metadata: {
        ...params.metadata,
        marked_via: "ai_helper_run_direct_update",
        provider: params.provider,
        model: params.model,
      },
    })
    .eq("workspace_id", params.workspaceId)
    .eq("id", params.aiRequestId);

  if (error) {
    throw new Error(`Direct update ai_helper_requests failed: ${error.message}`);
  }
}

async function createAiInsightDirect(params: {
  supabaseAdmin: any;
  workspaceId: string;
  aiRequestId: string;
  requestType: string;
  contextScope: string;
  answer: string;
  metadata: Record<string, unknown>;
}) {
  const { data, error } = await params.supabaseAdmin
    .from("ai_helper_insights")
    .insert({
      workspace_id: params.workspaceId,
      ai_request_id: params.aiRequestId,
      insight_type: safeInsightType(params.requestType),
      severity: "info",
      status: "open",
      title: titleForRequest(params.requestType),
      summary: params.answer.slice(0, 600),
      explanation: params.answer,
      recommended_action: "Review the AI helper answer before using it for decisions.",
      related_entity_type: "ai_helper_requests",
      related_entity_id: params.aiRequestId,
      source_refs: [],
      confidence: "medium",
      metadata: {
        ...params.metadata,
        created_via: "ai_helper_run_direct_insert",
        original_request_type: params.requestType,
        context_scope: params.contextScope,
      },
    })
    .select("id")
    .single();

  if (error) {
    console.error("Direct insert ai_helper_insights failed:", error);
    return null;
  }

  return data.id as string;
}

async function buildProductionContext(params: {
  supabaseAdmin: any;
  workspaceId: string;
  contextScope: string;
}) {
  const { data, error } = await params.supabaseAdmin.rpc(
    "build_ai_production_context",
    {
      p_workspace_id: params.workspaceId,
      p_context_scope: params.contextScope,
    },
  );

  if (error) {
    throw new Error(`build_ai_production_context failed: ${error.message}`);
  }

  return data;
}

async function buildAdsContext(params: {
  supabaseAdmin: any;
  workspaceId: string;
  contextScope: string;
  dateFrom: string | null;
  dateTo: string | null;
  platform: string | null;
}) {
  const attempts = [
    {
      p_workspace_id: params.workspaceId,
      p_context_scope: params.contextScope,
      p_date_from: params.dateFrom,
      p_date_to: params.dateTo,
      p_platform: params.platform,
    },
    {
      p_workspace_id: params.workspaceId,
      p_context_scope: params.contextScope,
    },
  ];

  for (const payload of attempts) {
    const { data, error } = await params.supabaseAdmin.rpc("build_ai_ads_context", payload);
    if (!error) return data;
  }

  throw new Error("build_ai_ads_context failed for known signatures.");
}

async function buildImportContext(params: {
  supabaseAdmin: any;
  workspaceId: string;
  contextScope: string;
}) {
  const result: Record<string, unknown> = {
    context_scope: params.contextScope,
  };

  const views = [
    ["import_health", "v_import_health"],
    ["import_error_summary", "v_import_error_summary"],
    ["recent_rejected_rows", "v_import_rejected_rows_recent"],
  ];

  for (const [key, view] of views) {
    const { data, error } = await params.supabaseAdmin
      .from(view)
      .select("*")
      .eq("workspace_id", params.workspaceId)
      .limit(20);

    result[key] = error ? { error: error.message } : data;
  }

  return result;
}

async function buildContext(params: {
  supabaseAdmin: any;
  workspaceId: string;
  requestType: string;
  contextScope: string;
  dateFrom: string | null;
  dateTo: string | null;
  platform: string | null;
}) {
  if (isProductionContext(params.contextScope)) {
    return buildProductionContext({
      supabaseAdmin: params.supabaseAdmin,
      workspaceId: params.workspaceId,
      contextScope: params.contextScope,
    });
  }

  if (isAdsContext(params.contextScope)) {
    return buildAdsContext({
      supabaseAdmin: params.supabaseAdmin,
      workspaceId: params.workspaceId,
      contextScope: params.contextScope,
      dateFrom: params.dateFrom,
      dateTo: params.dateTo,
      platform: params.platform,
    });
  }

  return buildImportContext({
    supabaseAdmin: params.supabaseAdmin,
    workspaceId: params.workspaceId,
    contextScope: params.contextScope,
  });
}

function buildSystemPrompt() {
  return [
    "You are an internal analytics production assistant.",
    "Answer in Ukrainian unless the user asks otherwise.",
    "Use only the provided JSON context.",
    "Do not invent data.",
    "Do not expose secrets, tokens, API keys, or private credentials.",
    "Be concise and practical.",
    "Explain what is healthy, what needs setup, and the next action.",
  ].join("\n");
}

function buildUserPrompt(params: {
  requestType: string;
  contextScope: string;
  userPrompt: string;
  context: unknown;
}) {
  return JSON.stringify(
    {
      task: params.requestType,
      context_scope: params.contextScope,
      user_prompt: params.userPrompt,
      context: params.context,
      response_requirements: {
        language: "uk",
        format: "clear_markdown",
        concise: true,
      },
    },
    null,
    2,
  );
}

function extractResponsesText(data: any) {
  if (typeof data?.output_text === "string" && data.output_text.trim()) {
    return data.output_text.trim();
  }

  const parts: string[] = [];

  for (const item of data?.output ?? []) {
    for (const content of item?.content ?? []) {
      if (typeof content?.text === "string") parts.push(content.text);
      if (typeof content?.output_text === "string") parts.push(content.output_text);
    }
  }

  return parts.join("\n").trim();
}

async function callOpenAI(params: {
  systemPrompt: string;
  userPrompt: string;
}) {
  const apiKey = requiredEnv("OPENAI_API_KEY");
  const model = Deno.env.get("OPENAI_MODEL") ?? "gpt-5.5";

  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      input: [
        { role: "system", content: params.systemPrompt },
        { role: "user", content: params.userPrompt },
      ],
      max_output_tokens: 1200,
    }),
  });

  const data = await response.json().catch(() => ({}));
  const text = extractResponsesText(data);

  if (!response.ok || !text) {
    throw new Error(
      `OpenAI responses failed: status=${response.status}; error=${
        data?.error?.message ?? "empty_output"
      }`
    );
  }

  return {
    provider: "openai",
    model,
    answer: text,
    endpoint: "responses",
  };
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

  const requestType = body.request_type ?? "production_readiness_summary";
  const contextScope = body.context_scope ?? defaultContextScope(requestType);
  const userPrompt =
    body.prompt ??
    body.question ??
    "Summarize current backend status and recommend the next action.";

  const dateFrom = body.date_from ?? null;
  const dateTo = body.date_to ?? null;
  const platform = body.platform ?? null;

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
      action: "ai_helper_denied",
      severity: "warning",
      metadata: {
        reason: actor.reason,
        request_type: requestType,
        context_scope: contextScope,
      },
    });

    return jsonResponse(403, {
      ok: false,
      error: "Forbidden.",
      function: FUNCTION_NAME,
      mode: actor.mode,
      actor_email: actor.email,
      actor_role: actor.role,
      reason: actor.reason,
    });
  }

  let aiRequestId: string | null = null;

  await writeAuditLog({
    supabaseAdmin,
    workspaceId,
    actor,
    action: "ai_helper_run_started",
    severity: "info",
    metadata: {
      request_type: requestType,
      context_scope: contextScope,
    },
  });

  try {
    aiRequestId = await createAiRequestDirect({
      supabaseAdmin,
      workspaceId,
      actor,
      requestType,
      contextScope,
      prompt: userPrompt,
      dateFrom,
      dateTo,
      platform,
      metadata: {
        ...(body.metadata ?? {}),
        function_name: FUNCTION_NAME,
        mode: actor.mode,
      },
    });

    const context = await buildContext({
      supabaseAdmin,
      workspaceId,
      requestType,
      contextScope,
      dateFrom,
      dateTo,
      platform,
    });

    const aiResult = await callOpenAI({
      systemPrompt: buildSystemPrompt(),
      userPrompt: buildUserPrompt({
        requestType,
        contextScope,
        userPrompt,
        context,
      }),
    });

    await markAiRequestResultDirect({
      supabaseAdmin,
      workspaceId,
      aiRequestId,
      status: "success",
      answer: aiResult.answer,
      errorMessage: null,
      provider: aiResult.provider,
      model: aiResult.model,
      contextUsed: context,
      metadata: {
        ...(body.metadata ?? {}),
        endpoint: aiResult.endpoint,
        request_type: requestType,
        context_scope: contextScope,
      },
    });

    const insightId = await createAiInsightDirect({
      supabaseAdmin,
      workspaceId,
      aiRequestId,
      requestType,
      contextScope,
      answer: aiResult.answer,
      metadata: {
        ...(body.metadata ?? {}),
        endpoint: aiResult.endpoint,
        request_type: requestType,
        context_scope: contextScope,
      },
    });

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "ai_helper_run_success",
      severity: "info",
      metadata: {
        request_type: requestType,
        context_scope: contextScope,
        provider: aiResult.provider,
        model: aiResult.model,
        endpoint: aiResult.endpoint,
        ai_request_id: aiRequestId,
        insight_id: insightId,
      },
    });

    return jsonResponse(200, {
      ok: true,
      workspace_id: workspaceId,
      mode: actor.mode,
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: actor.role,
      },
      provider: aiResult.provider,
      model: aiResult.model,
      ai_request_id: aiRequestId,
      insight_id: insightId,
      request_type: requestType,
      context_scope: contextScope,
      date_from: dateFrom,
      date_to: dateTo,
      platform,
      answer: aiResult.answer,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (aiRequestId) {
      try {
        await markAiRequestResultDirect({
          supabaseAdmin,
          workspaceId,
          aiRequestId,
          status: "failed",
          answer: null,
          errorMessage: message,
          provider: "openai",
          model: Deno.env.get("OPENAI_MODEL") ?? "gpt-5.5",
          contextUsed: {},
          metadata: {
            request_type: requestType,
            context_scope: contextScope,
            error: message,
          },
        });
      } catch (_updateError) {
        // Do not mask original error.
      }
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "ai_helper_run_failed",
      severity: "error",
      metadata: {
        request_type: requestType,
        context_scope: contextScope,
        ai_request_id: aiRequestId,
        error: message,
      },
    });

    return jsonResponse(500, {
      ok: false,
      function: FUNCTION_NAME,
      error: "ai-helper-run failed.",
      details: message,
      ai_request_id: aiRequestId,
    });
  }
});
