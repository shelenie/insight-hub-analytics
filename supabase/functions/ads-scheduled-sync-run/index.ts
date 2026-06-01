import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

type RequestBody = {
  workspace_id?: string;
  max_rules?: number;
  dry_run?: boolean;
  test_mode?: "mock_orchestrator" | "dry_run";

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

const FUNCTION_NAME = "ads-scheduled-sync-run";

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

function todayUtcDate() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgoUtcDate(days: number) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() - days);
  return date.toISOString().slice(0, 10);
}

function platformToFunctionName(platform: string) {
  if (platform === "meta_ads") return "meta-ads-sync";
  if (platform === "google_ads") return "google-ads-sync";
  if (platform === "tiktok_ads") return "tiktok-ads-sync";
  throw new Error(`Unsupported platform: ${platform}`);
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

async function invokePlatformSync(params: {
  supabaseUrl: string;
  functionName: string;
  workspaceId: string;
  platform: string;
  rule: any;
  dateFrom: string;
  dateTo: string;
  actor: ActorContext;
}) {
  const backendSecret = Deno.env.get("BACKEND_TEST_SECRET");

  if (!backendSecret) {
    throw new Error("BACKEND_TEST_SECRET is required for internal scheduled sync invocation.");
  }

  const response = await fetch(
    `${params.supabaseUrl}/functions/v1/${params.functionName}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-backend-test-secret": backendSecret,
        "x-test-actor-email": params.actor.email ?? "olenashepel.ai@gmail.com",
      },
      body: JSON.stringify({
        workspace_id: params.workspaceId,
        ad_platform_connection_id: params.rule.ad_platform_connection_id ?? null,
        ad_account_id: params.rule.ad_account_id ?? null,
        date_from: params.dateFrom,
        date_to: params.dateTo,
        sync_mode: "scheduled",
        metadata: {
          source: FUNCTION_NAME,
          scheduled_rule_id: params.rule.id,
          platform: params.platform,
        },
      }),
    },
  );

  const data = await response.json().catch(() => ({}));

  return {
    ok: response.ok && data?.ok !== false,
    status: response.status,
    data,
  };
}

async function runMockOrchestrator(params: {
  supabaseAdmin: any;
  workspaceId: string;
  actor: ActorContext;
}) {
  let ruleId: string | null = null;

  const cleanup = {
    scheduled_rules: 0,
    health_snapshots: 0,
  };

  try {
    const { data: createdRuleId, error: ruleError } = await params.supabaseAdmin.rpc(
      "create_ads_scheduled_sync_rule",
      {
        p_workspace_id: params.workspaceId,
        p_platform: "meta_ads",
        p_rule_name: "MOCK Scheduled Ads Sync Rule DO NOT USE",
        p_ad_platform_connection_id: null,
        p_ad_account_id: null,
        p_schedule_type: "daily",
        p_timezone: "UTC",
        p_run_hour: 6,
        p_run_minute: 0,
        p_lookback_days: 7,
        p_created_by: params.actor.user_id,
        p_created_by_email: params.actor.email,
        p_metadata: {
          created_by_edge_test: "ads_scheduled_sync_run_mock",
        },
      },
    );

    if (ruleError) throw new Error(ruleError.message);

    ruleId = createdRuleId;

    await params.supabaseAdmin
      .from("ads_scheduled_sync_rules")
      .update({
        next_run_at: new Date(Date.now() - 60_000).toISOString(),
      })
      .eq("id", ruleId);

    const { data: dueRules, error: dueError } = await params.supabaseAdmin
      .from("v_ads_scheduled_sync_due")
      .select("*")
      .eq("workspace_id", params.workspaceId)
      .eq("id", ruleId)
      .limit(1);

    if (dueError) throw new Error(dueError.message);

    const dueRuleSeen = Array.isArray(dueRules) && dueRules.length === 1;

    const { data: rebuildResult, error: rebuildError } = await params.supabaseAdmin.rpc(
      "rebuild_ads_daily_facts",
      {
        p_workspace_id: params.workspaceId,
        p_date_from: null,
        p_date_to: null,
        p_platform: "meta_ads",
      },
    );

    if (rebuildError) throw new Error(rebuildError.message);

    const { data: healthRows, error: healthError } = await params.supabaseAdmin.rpc(
      "create_ads_health_snapshot",
      {
        p_workspace_id: params.workspaceId,
        p_metadata: {
          created_by_edge_test: "ads_scheduled_sync_run_mock",
          scheduled_rule_id: ruleId,
        },
      },
    );

    if (healthError) throw new Error(healthError.message);

    const healthResult = Array.isArray(healthRows) ? healthRows[0] : healthRows;
    const healthSnapshotId = healthResult?.ads_health_snapshot_id ?? null;

    const { error: markError } = await params.supabaseAdmin.rpc(
      "mark_ads_scheduled_sync_result",
      {
        p_rule_id: ruleId,
        p_status: "success",
        p_metadata: {
          created_by_edge_test: "ads_scheduled_sync_run_mock",
          mock_result: "ok",
        },
      },
    );

    if (markError) throw new Error(markError.message);

    const { data: markedRule, error: markedError } = await params.supabaseAdmin
      .from("ads_scheduled_sync_rules")
      .select("id,last_run_at,next_run_at,metadata")
      .eq("id", ruleId)
      .single();

    if (markedError) throw new Error(markedError.message);

    const markResultSeen =
      Boolean(markedRule?.last_run_at) &&
      markedRule?.metadata?.last_result_status === "success";

    if (healthSnapshotId) {
      await params.supabaseAdmin
        .from("ads_health_snapshots")
        .delete()
        .eq("id", healthSnapshotId);

      cleanup.health_snapshots = 1;
    }

    await params.supabaseAdmin
      .from("ads_scheduled_sync_rules")
      .delete()
      .eq("id", ruleId);

    cleanup.scheduled_rules = 1;

    return {
      ok: true,
      test_mode: "mock_orchestrator",
      real_platform_sync_called: false,
      due_rule_seen: dueRuleSeen,
      rebuild_called: true,
      rebuild_result: rebuildResult,
      health_snapshot_created: Boolean(healthSnapshotId),
      mark_result_seen: markResultSeen,
      cleanup,
    };
  } catch (error) {
    if (ruleId) {
      await params.supabaseAdmin
        .from("ads_health_snapshots")
        .delete()
        .eq("metadata->>scheduled_rule_id", ruleId);

      await params.supabaseAdmin
        .from("ads_scheduled_sync_rules")
        .delete()
        .eq("id", ruleId);
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

  const maxRules = Math.max(1, Math.min(Number(body.max_rules ?? 10), 50));

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
      action: "ads_scheduled_sync_run_permission_check_failed",
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
      action: "ads_scheduled_sync_run_denied",
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
    action: "ads_scheduled_sync_run_started",
    severity: "info",
    metadata: {
      max_rules: maxRules,
      test_mode: body.test_mode ?? null,
      dry_run: body.dry_run ?? false,
    },
  });

  try {
    if (actor.mode === "backend_test" && body.test_mode === "mock_orchestrator") {
      const mockResult = await runMockOrchestrator({
        supabaseAdmin,
        workspaceId,
        actor,
      });

      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "ads_scheduled_sync_run_mock_success",
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

    const { data: dueRules, error: dueRulesError } = await supabaseAdmin
      .from("v_ads_scheduled_sync_due")
      .select("*")
      .eq("workspace_id", workspaceId)
      .limit(maxRules);

    if (dueRulesError) {
      throw new Error(`Could not read due ads sync rules: ${dueRulesError.message}`);
    }

    if (body.dry_run || body.test_mode === "dry_run") {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "ads_scheduled_sync_run_dry_run_success",
        severity: "info",
        metadata: {
          due_rules_count: dueRules?.length ?? 0,
        },
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
        dry_run: true,
        due_rules_count: dueRules?.length ?? 0,
        due_rules: dueRules ?? [],
      });
    }

    const results: Array<Record<string, unknown>> = [];

    for (const rule of dueRules ?? []) {
      const platform = String(rule.platform);
      const functionName = platformToFunctionName(platform);

      const lookbackDays = Math.max(1, Math.min(Number(rule.lookback_days ?? 7), 365));
      const dateFrom = daysAgoUtcDate(lookbackDays);
      const dateTo = daysAgoUtcDate(1);

      const ruleResult: Record<string, unknown> = {
        rule_id: rule.id,
        platform,
        function_name: functionName,
        date_from: dateFrom,
        date_to: dateTo,
      };

      try {
        const syncResult = await invokePlatformSync({
          supabaseUrl,
          functionName,
          workspaceId,
          platform,
          rule,
          dateFrom,
          dateTo,
          actor,
        });

        ruleResult.sync_result = syncResult;

        if (!syncResult.ok) {
          throw new Error(
            `Platform sync failed: ${functionName} responded ${syncResult.status}`,
          );
        }

        if (rule.rebuild_facts_after_sync !== false) {
          const { data: rebuildResult, error: rebuildError } = await supabaseAdmin.rpc(
            "rebuild_ads_daily_facts",
            {
              p_workspace_id: workspaceId,
              p_date_from: dateFrom,
              p_date_to: dateTo,
              p_platform: platform,
            },
          );

          if (rebuildError) throw new Error(rebuildError.message);

          ruleResult.rebuild_result = rebuildResult;
        }

        if (rule.create_health_snapshot_after_sync !== false) {
          const { data: healthResult, error: healthError } = await supabaseAdmin.rpc(
            "create_ads_health_snapshot",
            {
              p_workspace_id: workspaceId,
              p_metadata: {
                source: FUNCTION_NAME,
                scheduled_rule_id: rule.id,
                platform,
              },
            },
          );

          if (healthError) throw new Error(healthError.message);

          ruleResult.health_result = healthResult;
        }

        const { error: markError } = await supabaseAdmin.rpc(
          "mark_ads_scheduled_sync_result",
          {
            p_rule_id: rule.id,
            p_status: "success",
            p_metadata: {
              source: FUNCTION_NAME,
              platform,
              date_from: dateFrom,
              date_to: dateTo,
            },
          },
        );

        if (markError) throw new Error(markError.message);

        ruleResult.status = "success";

        await writeAuditLog({
          supabaseAdmin,
          workspaceId,
          actor,
          action: "ads_scheduled_sync_rule_success",
          severity: "info",
          metadata: {
            rule_id: rule.id,
            platform,
            function_name: functionName,
            date_from: dateFrom,
            date_to: dateTo,
          },
        });
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        ruleResult.status = "failed";
        ruleResult.error = message;

        await supabaseAdmin.rpc("mark_ads_scheduled_sync_result", {
          p_rule_id: rule.id,
          p_status: "failed",
          p_metadata: {
            source: FUNCTION_NAME,
            platform,
            error: message,
          },
        });

        await writeAuditLog({
          supabaseAdmin,
          workspaceId,
          actor,
          action: "ads_scheduled_sync_rule_failed",
          severity: "error",
          metadata: {
            rule_id: rule.id,
            platform,
            function_name: functionName,
            error: message,
          },
        });
      }

      results.push(ruleResult);
    }

    const failedCount = results.filter((item) => item.status === "failed").length;

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action:
        failedCount > 0
          ? "ads_scheduled_sync_run_partial_or_failed"
          : "ads_scheduled_sync_run_success",
      severity: failedCount > 0 ? "error" : "info",
      metadata: {
        rules_seen: dueRules?.length ?? 0,
        rules_processed: results.length,
        failed_count: failedCount,
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
      rules_seen: dueRules?.length ?? 0,
      rules_processed: results.length,
      failed_count: failedCount,
      results,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "ads_scheduled_sync_run_failed",
      severity: "error",
      metadata: {
        error: message,
      },
    });

    return jsonResponse(500, {
      ok: false,
      function: FUNCTION_NAME,
      error: "ads-scheduled-sync-run failed.",
      details: message,
    });
  }
});
