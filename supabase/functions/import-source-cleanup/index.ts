import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.8";

const FUNCTION_NAME = "import-source-cleanup";
const FILE_IMPORTS_BUCKET = "file-imports";
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

type Mode = "archive" | "restore" | "cleanup";
type Actor = {
  allowed: boolean;
  user_id: string | null;
  email: string | null;
  role: string | null;
  reason: string | null;
};
type Row = Record<string, any>;

function json(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
function requiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is required`);
  return value;
}
function normalizeAccess(row: any): Actor {
  return {
    allowed: row?.allowed === true || row?.result_allowed === true,
    user_id: row?.actor_user_id ?? row?.result_actor_user_id ?? null,
    email: row?.actor_email ?? row?.result_actor_email ?? null,
    role: row?.actor_role ?? row?.result_actor_role ?? row?.role ?? null,
    reason: row?.reason ?? row?.result_reason ?? null,
  };
}
async function audit(
  supabaseAdmin: any,
  workspaceId: string,
  actor: Actor | null,
  action: string,
  severity: "info" | "warning" | "error",
  metadata: Row,
) {
  const { error } = await supabaseAdmin.from("audit_logs").insert({
    workspace_id: workspaceId,
    actor_user_id: actor?.user_id ?? null,
    actor_role: actor?.role ?? null,
    action,
    entity_type: "edge_function",
    entity_id: FUNCTION_NAME,
    severity,
    metadata: { actor_email: actor?.email ?? null, ...metadata },
  });
  if (error) console.error("Audit log write failed", error);
}
function isMissingColumnError(error: any) {
  const message = String(error?.message ?? error ?? "").toLowerCase();
  return (
    error?.code === "42703" ||
    (message.includes("column") && message.includes("does not exist")) ||
    (message.includes("could not find") && message.includes("column"))
  );
}

async function deleteByColumn(
  client: any,
  table: string,
  column: string,
  value: string | null,
  extra?: Record<string, string>,
) {
  if (!value) return 0;
  let query = client.from(table).delete({ count: "exact" }).eq(column, value);
  for (const [extraColumn, extraValue] of Object.entries(extra ?? {})) {
    query = query.eq(extraColumn, extraValue);
  }
  const { count, error } = await query;
  if (error) {
    if (isMissingColumnError(error)) {
      console.warn(
        `[${FUNCTION_NAME}] skipped ${table}.${column}: ${error.message}`,
      );
      return 0;
    }
    throw new Error(`${table}.${column}: ${error.message}`);
  }
  return count ?? 0;
}

async function deleteRawExternalRows(
  client: any,
  workspaceId: string,
  datasetId: string | null,
  fileAssetId: string | null,
) {
  return (
    (await deleteByColumn(
      client,
      "raw_external_rows",
      "raw_external_dataset_id",
      datasetId,
      { workspace_id: workspaceId },
    )) +
    (await deleteByColumn(
      client,
      "raw_external_rows",
      "dataset_id",
      datasetId,
      { workspace_id: workspaceId },
    )) +
    (await deleteByColumn(
      client,
      "raw_external_rows",
      "file_asset_id",
      fileAssetId,
      { workspace_id: workspaceId },
    ))
  );
}

async function deleteSourceEntityBindings(
  client: any,
  workspaceId: string,
  datasetId: string | null,
) {
  return deleteByColumn(
    client,
    "source_entity_bindings",
    "source_id",
    datasetId,
    {
      workspace_id: workspaceId,
      source_table: "raw_external_datasets",
    },
  );
}

async function deleteImportRejectedRows(
  client: any,
  workspaceId: string,
  fileAssetId: string | null,
  datasetId: string | null,
  importRunId: string | null,
) {
  return (
    (await deleteByColumn(
      client,
      "import_rejected_rows",
      "file_asset_id",
      fileAssetId,
      { workspace_id: workspaceId },
    )) +
    (await deleteByColumn(
      client,
      "import_rejected_rows",
      "source_id",
      datasetId,
      { workspace_id: workspaceId },
    )) +
    (await deleteByColumn(
      client,
      "import_rejected_rows",
      "import_run_id",
      importRunId,
      { workspace_id: workspaceId },
    ))
  );
}

async function deleteImportRunRows(
  client: any,
  table: "import_staging_rows" | "mapping_review_queue",
  workspaceId: string,
  importRunId: string | null,
  sourceNames: string[],
) {
  if (importRunId)
    return deleteByColumn(client, table, "import_run_id", importRunId, {
      workspace_id: workspaceId,
    });

  let deleted = 0;
  for (const sourceName of sourceNames.filter(Boolean)) {
    deleted += await deleteByColumn(client, table, "source_name", sourceName, {
      workspace_id: workspaceId,
    });
  }
  return deleted;
}

async function findImportRunId(
  client: any,
  fileAsset: Row | null,
  dataset: Row | null,
  fileAssetId: string | null,
  datasetId: string | null,
) {
  const direct = fileAsset?.import_run_id ?? dataset?.import_run_id ?? null;
  if (direct) return String(direct);

  const lookups = [
    {
      table: "import_rejected_rows",
      column: "file_asset_id",
      value: fileAssetId,
    },
    { table: "import_rejected_rows", column: "source_id", value: datasetId },
    {
      table: "import_staging_rows",
      column: "file_asset_id",
      value: fileAssetId,
    },
    { table: "raw_external_rows", column: "file_asset_id", value: fileAssetId },
    {
      table: "raw_external_rows",
      column: "raw_external_dataset_id",
      value: datasetId,
    },
    { table: "raw_external_rows", column: "dataset_id", value: datasetId },
  ];

  for (const lookup of lookups) {
    if (!lookup.value) continue;
    const { data, error } = await client
      .from(lookup.table)
      .select("import_run_id")
      .eq(lookup.column, lookup.value)
      .not("import_run_id", "is", null)
      .limit(1)
      .maybeSingle();
    if (error) {
      if (isMissingColumnError(error)) continue;
      throw new Error(`${lookup.table}.${lookup.column}: ${error.message}`);
    }
    if (data?.import_run_id) return String(data.import_run_id);
  }

  return null;
}

function buildSourceNameFallbacks(fileAsset: Row | null, dataset: Row | null) {
  const original = fileAsset?.original_file_name ?? null;
  const datasetName = dataset?.dataset_name ?? null;
  const sheetName = dataset?.sheet_name ?? null;
  return Array.from(
    new Set(
      [
        datasetName,
        original,
        datasetName && sheetName
          ? `file_upload:${datasetName}:${sheetName}`
          : null,
        original && sheetName ? `file_upload:${original}:${sheetName}` : null,
      ].filter(
        (value): value is string =>
          typeof value === "string" && value.trim().length > 0,
      ),
    ),
  );
}
function isFileImportSource(fileAsset: Row | null, dataset: Row | null) {
  const sourceText = [
    fileAsset?.storage_bucket,
    fileAsset?.storage_path,
    fileAsset?.source_type,
    fileAsset?.asset_type,
    dataset?.source_type,
    dataset?.parser_type,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return (
    sourceText.includes(FILE_IMPORTS_BUCKET) ||
    sourceText.includes("manual_file_upload") ||
    sourceText.includes("file") ||
    sourceText.includes("upload")
  );
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST")
    return json(405, { ok: false, error: "Method not allowed. Use POST." });

  const body = await req.json().catch(() => ({}));
  const workspaceId = String(body.workspace_id ?? "");
  const fileAssetId = body.file_asset_id ? String(body.file_asset_id) : null;
  const datasetId = body.raw_external_dataset_id
    ? String(body.raw_external_dataset_id)
    : null;
  const mode = String(body.mode ?? "") as Mode;
  const reason =
    typeof body.reason === "string" ? body.reason.slice(0, 1000) : null;
  const confirm = body.confirm === true;

  if (!workspaceId)
    return json(400, { ok: false, error: "workspace_id is required" });
  if (!fileAssetId && !datasetId)
    return json(400, {
      ok: false,
      error: "file_asset_id or raw_external_dataset_id is required",
    });
  if (!["archive", "restore", "cleanup"].includes(mode))
    return json(400, {
      ok: false,
      error: "mode must be archive, restore, or cleanup",
    });
  if (mode === "cleanup" && !confirm)
    return json(400, { ok: false, error: "Cleanup requires confirm: true" });

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer "))
    return json(401, { ok: false, error: "Missing bearer token" });

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
    global: { headers: { Authorization: authHeader } },
  });
  const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);
  const { data: authData, error: authError } =
    await supabaseAnon.auth.getUser();
  if (authError || !authData.user)
    return json(401, { ok: false, error: "Unauthenticated" });

  const { data: accessData, error: accessError } = await supabaseAdmin.rpc(
    "check_edge_function_access_by_email",
    {
      p_workspace_id: workspaceId,
      p_function_name: FUNCTION_NAME,
      p_actor_email: authData.user.email,
    },
  );
  if (accessError) return json(403, { ok: false, error: accessError.message });
  const actor = normalizeAccess(
    Array.isArray(accessData) ? accessData[0] : accessData,
  );
  const role = String(actor.role ?? "").toLowerCase();
  if (!actor.allowed || !["admin", "superadmin"].includes(role))
    return json(403, {
      ok: false,
      error: "Forbidden. Admin or superadmin role is required.",
      reason: actor.reason,
    });
  if (mode === "cleanup" && role !== "superadmin")
    return json(403, { ok: false, error: "Cleanup requires superadmin role." });

  try {
    let fileAsset: Row | null = null;
    let dataset: Row | null = null;
    if (fileAssetId) {
      const result = await supabaseAdmin
        .from("file_assets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", fileAssetId)
        .maybeSingle();
      if (result.error) throw result.error;
      fileAsset = result.data;
    }
    if (datasetId) {
      const result = await supabaseAdmin
        .from("raw_external_datasets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", datasetId)
        .maybeSingle();
      if (result.error) throw result.error;
      dataset = result.data;
    } else if (fileAssetId) {
      const result = await supabaseAdmin
        .from("raw_external_datasets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("file_asset_id", fileAssetId)
        .limit(1)
        .maybeSingle();
      if (!result.error) dataset = result.data;
    }
    if (!fileAsset && dataset?.file_asset_id) {
      const result = await supabaseAdmin
        .from("file_assets")
        .select("*")
        .eq("workspace_id", workspaceId)
        .eq("id", dataset.file_asset_id)
        .maybeSingle();
      if (!result.error) fileAsset = result.data;
    }
    if (!fileAsset && !dataset)
      return json(404, {
        ok: false,
        error: "File import source was not found in this workspace.",
      });
    if (!isFileImportSource(fileAsset, dataset))
      return json(400, {
        ok: false,
        error:
          "Only file/import uploaded sources can be managed by this action.",
      });

    const resolvedFileAssetId =
      fileAsset?.id ?? dataset?.file_asset_id ?? fileAssetId;
    const resolvedDatasetId = dataset?.id ?? datasetId;
    const resolvedImportRunId = await findImportRunId(
      supabaseAdmin,
      fileAsset,
      dataset,
      resolvedFileAssetId,
      resolvedDatasetId,
    );
    const sourceNameFallbacks = buildSourceNameFallbacks(fileAsset, dataset);
    const storageBucket = fileAsset?.storage_bucket ?? FILE_IMPORTS_BUCKET;
    const storagePath = fileAsset?.storage_path ?? fileAsset?.path ?? null;
    const metadata = {
      workspace_id: workspaceId,
      file_asset_id: resolvedFileAssetId,
      raw_external_dataset_id: resolvedDatasetId,
      original_file_name:
        fileAsset?.original_file_name ?? dataset?.dataset_name ?? null,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      import_run_id: resolvedImportRunId,
      source_name_fallbacks: sourceNameFallbacks,
      mode,
      reason,
      ui_source: body.ui_source ?? "bindings_source_management",
    };

    if (mode === "archive" || mode === "restore") {
      const status = mode === "archive" ? "archived" : "active";
      const parserStatus = mode === "archive" ? "archived" : "parsed";
      const updates: Row = {};
      if (resolvedDatasetId) {
        const result = await supabaseAdmin
          .from("raw_external_datasets")
          .update({ status, updated_at: new Date().toISOString() })
          .eq("workspace_id", workspaceId)
          .eq("id", resolvedDatasetId)
          .select("id");
        if (result.error) throw result.error;
        updates.raw_external_datasets = result.data?.length ?? 0;
      }
      if (resolvedFileAssetId) {
        const result = await supabaseAdmin
          .from("file_assets")
          .update({
            status,
            parser_status: parserStatus,
            updated_at: new Date().toISOString(),
          })
          .eq("workspace_id", workspaceId)
          .eq("id", resolvedFileAssetId)
          .select("id");
        if (result.error) throw result.error;
        updates.file_assets = result.data?.length ?? 0;
      }
      await audit(
        supabaseAdmin,
        workspaceId,
        actor,
        mode === "archive"
          ? "file_import_source_archived"
          : "file_import_source_restored",
        "info",
        { ...metadata, updated_counts: updates },
      );
      return json(200, { ok: true, mode, updated_counts: updates });
    }

    const activeBinding = resolvedDatasetId
      ? await supabaseAdmin
          .from("source_entity_bindings")
          .select("id")
          .eq("workspace_id", workspaceId)
          .eq("source_table", "raw_external_datasets")
          .eq("source_id", resolvedDatasetId)
          .eq("binding_status", "active")
          .limit(1)
      : { data: [], error: null };
    if (activeBinding.error) throw activeBinding.error;
    if (
      (activeBinding.data ?? []).length &&
      !body.confirm_active_binding_cleanup
    )
      return json(409, {
        ok: false,
        error:
          "Source has active production bindings. Confirm destructive cleanup explicitly.",
      });

    if (storagePath) {
      const { error: storageError } = await supabaseAdmin.storage
        .from(storageBucket)
        .remove([storagePath]);
      if (storageError) {
        await audit(
          supabaseAdmin,
          workspaceId,
          actor,
          "file_import_storage_delete_failed",
          "error",
          { ...metadata, error: storageError.message },
        );
        throw storageError;
      }
    }

    const deleted_counts: Row = {};
    deleted_counts.mapping_review_queue = await deleteImportRunRows(
      supabaseAdmin,
      "mapping_review_queue",
      workspaceId,
      resolvedImportRunId,
      sourceNameFallbacks,
    );
    deleted_counts.dataset_field_mappings = await deleteByColumn(
      supabaseAdmin,
      "dataset_field_mappings",
      "dataset_id",
      resolvedDatasetId,
      { workspace_id: workspaceId },
    );
    deleted_counts.import_rejected_rows = await deleteImportRejectedRows(
      supabaseAdmin,
      workspaceId,
      resolvedFileAssetId,
      resolvedDatasetId,
      resolvedImportRunId,
    );
    deleted_counts.import_staging_rows = await deleteImportRunRows(
      supabaseAdmin,
      "import_staging_rows",
      workspaceId,
      resolvedImportRunId,
      sourceNameFallbacks,
    );
    deleted_counts.raw_external_rows = await deleteRawExternalRows(
      supabaseAdmin,
      workspaceId,
      resolvedDatasetId,
      resolvedFileAssetId,
    );
    deleted_counts.source_entity_bindings = await deleteSourceEntityBindings(
      supabaseAdmin,
      workspaceId,
      resolvedDatasetId,
    );
    deleted_counts.raw_external_datasets = await deleteByColumn(
      supabaseAdmin,
      "raw_external_datasets",
      "id",
      resolvedDatasetId,
      { workspace_id: workspaceId },
    );
    deleted_counts.file_assets = await deleteByColumn(
      supabaseAdmin,
      "file_assets",
      "id",
      resolvedFileAssetId,
      { workspace_id: workspaceId },
    );
    await audit(
      supabaseAdmin,
      workspaceId,
      actor,
      "file_import_source_cleaned",
      "info",
      { ...metadata, deleted_counts },
    );
    return json(200, {
      ok: true,
      mode,
      deleted_counts,
      storage_deleted: Boolean(storagePath),
    });
  } catch (error) {
    await audit(
      supabaseAdmin,
      workspaceId,
      actor,
      "file_import_cleanup_failed",
      "error",
      {
        workspace_id: workspaceId,
        file_asset_id: fileAssetId,
        raw_external_dataset_id: datasetId,
        mode,
        reason,
        error: error instanceof Error ? error.message : String(error),
      },
    );
    return json(500, {
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    });
  }
});
