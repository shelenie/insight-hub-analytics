import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import * as XLSX from "https://esm.sh/xlsx@0.18.5";

type ParsedDataset = {
  dataset_name: string;
  sheet_name: string;
  columns: string[];
  rows: Array<{
    row_number: number;
    data: Record<string, unknown>;
    values: unknown[];
  }>;
};

type RequestBody = {
  workspace_id?: string;
  storage_bucket?: string;
  storage_path?: string;
  original_file_name?: string;
  mime_type?: string;
  source_type?: string;
  target_raw_table?: string | null;
  processor_function?: string | null;
  header_row?: number;
  delimiter?: string;
  parse_all_sheets?: boolean;
  sheet_name?: string | null;
  clear_previous?: boolean;
  max_rows_per_sheet?: number;
  max_file_size_bytes?: number;

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

const FUNCTION_NAME = "file-upload-parser";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-backend-test-secret, x-test-actor-email, x-internal-admin-secret",
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

function getExtension(fileNameOrPath: string): string {
  const clean = fileNameOrPath.split("?")[0].split("#")[0];
  const parts = clean.split(".");
  return parts.length > 1 ? parts[parts.length - 1].toLowerCase() : "";
}

function cleanHeader(value: unknown, index: number): string {
  const raw = String(value ?? "").replace(/\uFEFF/g, "").trim();

  if (!raw) {
    return `column_${index + 1}`;
  }

  return raw.replace(/\s+/g, " ").trim();
}

function makeUniqueHeaders(headers: string[]): string[] {
  const seen = new Map<string, number>();

  return headers.map((header) => {
    const base = header || "column";
    const current = seen.get(base) ?? 0;
    seen.set(base, current + 1);

    if (current === 0) {
      return base;
    }

    return `${base}_${current + 1}`;
  });
}

function isEmptyRow(row: unknown[]): boolean {
  return row.every(
    (value) => value === null || value === undefined || String(value).trim() === "",
  );
}

function rowToObject(headers: string[], row: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};

  headers.forEach((header, index) => {
    obj[header] = row[index] ?? null;
  });

  return obj;
}

function parseCsvToRows(text: string, delimiter = ","): unknown[][] {
  const rows: unknown[][] = [];
  let currentRow: string[] = [];
  let currentCell = "";
  let insideQuotes = false;

  for (let i = 0; i < text.length; i += 1) {
    const char = text[i];
    const nextChar = text[i + 1];

    if (char === '"' && insideQuotes && nextChar === '"') {
      currentCell += '"';
      i += 1;
      continue;
    }

    if (char === '"') {
      insideQuotes = !insideQuotes;
      continue;
    }

    if (char === delimiter && !insideQuotes) {
      currentRow.push(currentCell);
      currentCell = "";
      continue;
    }

    if ((char === "\n" || char === "\r") && !insideQuotes) {
      if (char === "\r" && nextChar === "\n") {
        i += 1;
      }

      currentRow.push(currentCell);
      rows.push(currentRow);
      currentRow = [];
      currentCell = "";
      continue;
    }

    currentCell += char;
  }

  currentRow.push(currentCell);

  if (currentRow.length > 1 || String(currentRow[0] ?? "").trim() !== "") {
    rows.push(currentRow);
  }

  return rows;
}

function buildParsedDatasetFromMatrix(
  matrix: unknown[][],
  datasetName: string,
  sheetName: string,
  headerRowNumber: number,
  maxRows: number,
): ParsedDataset {
  const headerRowIndex = Math.max(headerRowNumber - 1, 0);
  const headerRow = matrix[headerRowIndex] ?? [];
  const headers = makeUniqueHeaders(headerRow.map((value, index) => cleanHeader(value, index)));

  const rows = matrix
    .slice(headerRowIndex + 1, headerRowIndex + 1 + maxRows)
    .map((row, index) => {
      const values = Array.isArray(row) ? row : [];
      return {
        row_number: headerRowIndex + index + 2,
        values,
        data: rowToObject(headers, values),
      };
    })
    .filter((row) => !isEmptyRow(row.values));

  return {
    dataset_name: datasetName,
    sheet_name: sheetName,
    columns: headers,
    rows,
  };
}

function parseWorkbook(
  arrayBuffer: ArrayBuffer,
  options: {
    originalFileName: string;
    headerRowNumber: number;
    parseAllSheets: boolean;
    requestedSheetName?: string | null;
    maxRowsPerSheet: number;
  },
): ParsedDataset[] {
  const workbook = XLSX.read(arrayBuffer, {
    type: "array",
    cellDates: true,
  });

  const sheetNames = options.parseAllSheets
    ? workbook.SheetNames
    : [options.requestedSheetName || workbook.SheetNames[0]];

  const datasets: ParsedDataset[] = [];

  for (const sheetName of sheetNames) {
    const sheet = workbook.Sheets[sheetName];

    if (!sheet) continue;

    const matrix = XLSX.utils.sheet_to_json(sheet, {
      header: 1,
      defval: null,
      blankrows: false,
      raw: false,
    }) as unknown[][];

    datasets.push(
      buildParsedDatasetFromMatrix(
        matrix,
        `${options.originalFileName} / ${sheetName}`,
        sheetName,
        options.headerRowNumber,
        options.maxRowsPerSheet,
      ),
    );
  }

  return datasets;
}

function parseTextFile(
  text: string,
  options: {
    originalFileName: string;
    headerRowNumber: number;
    delimiter: string;
    maxRowsPerSheet: number;
  },
): ParsedDataset[] {
  const matrix = parseCsvToRows(text, options.delimiter);

  return [
    buildParsedDatasetFromMatrix(
      matrix,
      options.originalFileName,
      "CSV",
      options.headerRowNumber,
      options.maxRowsPerSheet,
    ),
  ];
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
    required_permission:
      row?.result_required_permission ?? row?.required_permission ?? null,
    required_min_role:
      row?.result_required_min_role ?? row?.required_min_role ?? null,
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

  if (error) {
    console.error("Audit log write failed:", error);
  }
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

    if (!expectedBackendTestSecret) {
      return {
        mode: "backend_test",
        user_id: null,
        email: null,
        role: null,
        allowed: false,
        reason: "BACKEND_TEST_SECRET_env_is_missing",
      };
    }

    if (providedBackendTestSecret !== expectedBackendTestSecret) {
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

    if (error) {
      throw new Error(`Access checker failed: ${error.message}`);
    }

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

    if (error) {
      throw new Error(`Access checker failed: ${error.message}`);
    }

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

async function insertDatasetRowsInChunks(
  supabaseAdmin: any,
  params: {
    workspaceId: string;
    fileAssetId: string;
    datasetId: string;
    originalFileName: string;
    storageBucket: string;
    storagePath: string;
    sourceType: string;
    targetRawTable: string | null;
    processorFunction: string | null;
    dataset: ParsedDataset;
  },
  chunkSize = 300,
): Promise<number> {
  let inserted = 0;

  for (let i = 0; i < params.dataset.rows.length; i += chunkSize) {
    const chunk = params.dataset.rows.slice(i, i + chunkSize).map((row) => ({
      source_name: `file_upload:${params.originalFileName}:${params.dataset.sheet_name}`,
      row_number: row.row_number,
      row_data: {
        source: FUNCTION_NAME,
        file_asset_id: params.fileAssetId,
        storage_bucket: params.storageBucket,
        storage_path: params.storagePath,
        original_file_name: params.originalFileName,
        dataset_name: params.dataset.dataset_name,
        sheet_name: params.dataset.sheet_name,
        source_type: params.sourceType,
        target_raw_table: params.targetRawTable,
        processor_function: params.processorFunction,
        row_number: row.row_number,
        headers: params.dataset.columns,
        values: row.values,
        data: row.data,
        parsed_at: new Date().toISOString(),
      },
    }));

    const { data, error } = await supabaseAdmin.rpc(
      "insert_file_dataset_row_chunk",
      {
        p_workspace_id: params.workspaceId,
        p_file_asset_id: params.fileAssetId,
        p_raw_external_dataset_id: params.datasetId,
        p_rows: chunk,
      },
    );

    if (error) {
      throw new Error(error.message);
    }

    inserted += Number(data ?? 0);
  }

  return inserted;
}

Deno.serve(async (req) => {
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
      error: "Invalid JSON body",
    });
  }

  const workspaceId = body.workspace_id;
  const storageBucket = body.storage_bucket ?? "file-imports";
  const storagePath = body.storage_path;

  if (!workspaceId) {
    return jsonResponse(400, {
      ok: false,
      error: "workspace_id is required",
    });
  }

  if (!storagePath) {
    return jsonResponse(400, {
      ok: false,
      error: "storage_path is required",
    });
  }

  const supabaseUrl = requiredEnv("SUPABASE_URL");
  const serviceRoleKey = requiredEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = requiredEnv("SUPABASE_ANON_KEY");

  const authHeader = req.headers.get("Authorization");

  const supabaseAnon = createClient(supabaseUrl, anonKey, {
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
      action: "file_upload_parser_permission_check_failed",
      severity: "error",
      metadata: {
        storage_bucket: storageBucket,
        storage_path: storagePath,
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
      action: "file_upload_parser_denied",
      severity: "warning",
      metadata: {
        reason: actor.reason,
        storage_bucket: storageBucket,
        storage_path: storagePath,
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

  const originalFileName =
    body.original_file_name ??
    (storagePath ? storagePath.split("/").pop() : "uploaded-file");

  const mimeType = body.mime_type ?? null;
  const sourceType = body.source_type ?? "manual_file_upload";
  const targetRawTable = body.target_raw_table ?? null;
  const processorFunction = body.processor_function ?? null;
  const headerRowNumber = Number(body.header_row ?? 1);
  const delimiter = body.delimiter ?? ",";
  const parseAllSheets = body.parse_all_sheets ?? true;
  const requestedSheetName = body.sheet_name ?? null;
  const clearPrevious = body.clear_previous ?? true;
  const maxRowsPerSheet = Number(body.max_rows_per_sheet ?? 50000);
  const maxFileSizeBytes = Number(body.max_file_size_bytes ?? 15000000);
  const extension = getExtension(originalFileName || storagePath);

  if (!["csv", "tsv", "txt", "xlsx", "xls"].includes(extension)) {
    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "file_upload_parser_failed",
      severity: "error",
      metadata: {
        step: "unsupported_file_type",
        storage_bucket: storageBucket,
        storage_path: storagePath,
        original_file_name: originalFileName,
        file_extension: extension,
      },
    });

    return jsonResponse(400, {
      ok: false,
      error: "Unsupported file type. Supported: csv, tsv, txt, xlsx, xls.",
      file_extension: extension,
    });
  }

  await writeAuditLog({
    supabaseAdmin,
    workspaceId,
    actor,
    action: "file_upload_parser_started",
    severity: "info",
    metadata: {
      storage_bucket: storageBucket,
      storage_path: storagePath,
      original_file_name: originalFileName,
      mime_type: mimeType,
      source_type: sourceType,
      target_raw_table: targetRawTable,
      processor_function: processorFunction,
      header_row: headerRowNumber,
      delimiter,
      parse_all_sheets: parseAllSheets,
      requested_sheet_name: requestedSheetName,
      clear_previous: clearPrevious,
      max_rows_per_sheet: maxRowsPerSheet,
      request_metadata: body.metadata ?? {},
    },
  });

  let fileAssetId: string | null = null;

  try {
    const { data: downloadedFile, error: downloadError } =
      await supabaseAdmin.storage.from(storageBucket).download(storagePath);

    if (downloadError || !downloadedFile) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "file_upload_parser_failed",
        severity: "error",
        metadata: {
          step: "download_file_from_storage",
          storage_bucket: storageBucket,
          storage_path: storagePath,
          error: downloadError?.message ?? "downloaded_file_missing",
        },
      });

      return jsonResponse(404, {
        ok: false,
        error: "Could not download file from Storage",
        details: downloadError?.message ?? null,
        storage_bucket: storageBucket,
        storage_path: storagePath,
      });
    }

    const fileSizeBytes = downloadedFile.size;

    if (fileSizeBytes > maxFileSizeBytes) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "file_upload_parser_failed",
        severity: "error",
        metadata: {
          step: "file_too_large",
          storage_bucket: storageBucket,
          storage_path: storagePath,
          file_size_bytes: fileSizeBytes,
          max_file_size_bytes: maxFileSizeBytes,
        },
      });

      return jsonResponse(413, {
        ok: false,
        error: "File is too large for parser limits",
        file_size_bytes: fileSizeBytes,
        max_file_size_bytes: maxFileSizeBytes,
      });
    }

    const { data: fileSession, error: sessionError } = await supabaseAdmin.rpc(
      "create_file_asset_parse_session",
      {
        p_payload: {
          workspace_id: workspaceId,
          storage_bucket: storageBucket,
          storage_path: storagePath,
          original_file_name: originalFileName,
          mime_type: mimeType,
          file_extension: extension,
          file_size_bytes: fileSizeBytes,
          metadata: {
            source: FUNCTION_NAME,
            parse_all_sheets: parseAllSheets,
            requested_sheet_name: requestedSheetName,
            header_row: headerRowNumber,
            delimiter,
            target_raw_table: targetRawTable,
            processor_function: processorFunction,
            actor_email: actor.email,
            actor_role: actor.role,
            mode: actor.mode,
          },
        },
      },
    );

    if (sessionError || !fileSession?.file_asset_id) {
      await writeAuditLog({
        supabaseAdmin,
        workspaceId,
        actor,
        action: "file_upload_parser_failed",
        severity: "error",
        metadata: {
          step: "create_file_asset_parse_session",
          storage_bucket: storageBucket,
          storage_path: storagePath,
          error: sessionError?.message ?? "file_asset_id_missing",
          hint: sessionError?.hint ?? null,
          code: sessionError?.code ?? null,
        },
      });

      return jsonResponse(500, {
        ok: false,
        error: "Could not create file asset parse session",
        details: sessionError?.message ?? null,
        hint: sessionError?.hint ?? null,
        code: sessionError?.code ?? null,
      });
    }

    fileAssetId = fileSession.file_asset_id as string;

    if (clearPrevious) {
      const { error: clearError } = await supabaseAdmin.rpc(
        "clear_file_asset_parsed_data",
        {
          p_workspace_id: workspaceId,
          p_file_asset_id: fileAssetId,
        },
      );

      if (clearError) {
        throw new Error(clearError.message);
      }
    }

    let datasets: ParsedDataset[] = [];

    if (["xlsx", "xls"].includes(extension)) {
      const arrayBuffer = await downloadedFile.arrayBuffer();

      datasets = parseWorkbook(arrayBuffer, {
        originalFileName,
        headerRowNumber,
        parseAllSheets,
        requestedSheetName,
        maxRowsPerSheet,
      });
    } else {
      const text = await downloadedFile.text();
      const actualDelimiter = extension === "tsv" ? "\t" : delimiter;

      datasets = parseTextFile(text, {
        originalFileName,
        headerRowNumber,
        delimiter: actualDelimiter,
        maxRowsPerSheet,
      });
    }

    if (datasets.length === 0) {
      throw new Error("No datasets found in file");
    }

    const datasetResults: Array<Record<string, unknown>> = [];
    let totalRowsInserted = 0;
    let maxColumnsCount = 0;

    for (const dataset of datasets) {
      maxColumnsCount = Math.max(maxColumnsCount, dataset.columns.length);

      const { data: datasetId, error: datasetError } = await supabaseAdmin.rpc(
        "create_raw_external_dataset_for_file",
        {
          p_workspace_id: workspaceId,
          p_file_asset_id: fileAssetId,
          p_dataset_name: dataset.dataset_name,
          p_sheet_name: dataset.sheet_name,
          p_source_type: sourceType,
          p_target_raw_table: targetRawTable,
          p_processor_function: processorFunction,
          p_parser_type: FUNCTION_NAME,
          p_columns: dataset.columns,
          p_sample_rows: dataset.rows.slice(0, 5).map((row) => row.data),
          p_config: {
            original_file_name: originalFileName,
            storage_bucket: storageBucket,
            storage_path: storagePath,
            header_row: headerRowNumber,
            rows_detected: dataset.rows.length,
            actor_email: actor.email,
            actor_role: actor.role,
            mode: actor.mode,
          },
        },
      );

      if (datasetError || !datasetId) {
        throw new Error(datasetError?.message ?? "Could not create raw external dataset");
      }

      const insertedRows = await insertDatasetRowsInChunks(
        supabaseAdmin,
        {
          workspaceId,
          fileAssetId,
          datasetId,
          originalFileName,
          storageBucket,
          storagePath,
          sourceType,
          targetRawTable,
          processorFunction,
          dataset,
        },
        300,
      );

      totalRowsInserted += insertedRows;

      datasetResults.push({
        dataset_id: datasetId,
        dataset_name: dataset.dataset_name,
        sheet_name: dataset.sheet_name,
        columns_count: dataset.columns.length,
        rows_inserted: insertedRows,
      });
    }

    const { data: finishResult, error: finishError } = await supabaseAdmin.rpc(
      "finish_file_asset_parse_edge",
      {
        p_payload: {
          file_asset_id: fileAssetId,
          workspace_id: workspaceId,
          status: "parsed",
          parser_status: "success",
          rows_count: totalRowsInserted,
          datasets_count: datasets.length,
          columns_count: maxColumnsCount,
          error_message: null,
          metadata: {
            function: FUNCTION_NAME,
            dataset_results: datasetResults,
            parsed_at: new Date().toISOString(),
            actor_email: actor.email,
            actor_role: actor.role,
            mode: actor.mode,
          },
        },
      },
    );

    if (finishError) {
      throw new Error(finishError.message);
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "file_upload_parser_success",
      severity: "info",
      metadata: {
        file_asset_id: fileAssetId,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        original_file_name: originalFileName,
        file_extension: extension,
        file_size_bytes: fileSizeBytes,
        datasets_count: datasets.length,
        rows_inserted: totalRowsInserted,
        columns_count: maxColumnsCount,
      },
    });

    return jsonResponse(200, {
      ok: true,
      function: FUNCTION_NAME,
      status: "success",
      mode: actor.mode,
      actor: {
        user_id: actor.user_id,
        email: actor.email,
        role: actor.role,
      },
      workspace_id: workspaceId,
      file_asset_id: fileAssetId,
      storage_bucket: storageBucket,
      storage_path: storagePath,
      original_file_name: originalFileName,
      file_extension: extension,
      file_size_bytes: fileSizeBytes,
      datasets_count: datasets.length,
      rows_inserted: totalRowsInserted,
      columns_count: maxColumnsCount,
      dataset_results: datasetResults,
      finish_result: finishResult,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);

    if (fileAssetId) {
      await supabaseAdmin.rpc("finish_file_asset_parse_edge", {
        p_payload: {
          file_asset_id: fileAssetId,
          workspace_id: workspaceId,
          status: "failed",
          parser_status: "failed",
          rows_count: 0,
          datasets_count: 0,
          columns_count: 0,
          error_message: message,
          metadata: {
            function: FUNCTION_NAME,
            failed_at: new Date().toISOString(),
            actor_email: actor.email,
            actor_role: actor.role,
            mode: actor.mode,
          },
        },
      });
    }

    await writeAuditLog({
      supabaseAdmin,
      workspaceId,
      actor,
      action: "file_upload_parser_failed",
      severity: "error",
      metadata: {
        step: "parse_or_insert_file_data",
        file_asset_id: fileAssetId,
        storage_bucket: storageBucket,
        storage_path: storagePath,
        error: message,
      },
    });

    return jsonResponse(500, {
      ok: false,
      function: FUNCTION_NAME,
      status: "failed",
      workspace_id: workspaceId,
      file_asset_id: fileAssetId,
      error: message,
    });
  }
});
