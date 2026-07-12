import { supabase } from "@/integrations/supabase/client";

export type PrimaryIntent = "unchanged" | "make_primary" | "remove_primary";

export type SafeMutationError = {
  message: string;
  code?: string;
  action: string;
  rpc?: string;
};

function primaryIntentValue(intent: PrimaryIntent): boolean | null {
  if (intent === "make_primary") return true;
  if (intent === "remove_primary") return false;
  return null;
}

function toSafeError(error: { message?: string; code?: string } | null, action: string, rpc: string): SafeMutationError | null {
  if (!error) return null;
  return { action, rpc, code: error.code, message: error.message ?? "Mutation failed" };
}

export async function manageAdAccountBinding(input: {
  workspaceId: string;
  adAccountId: string;
  clientId: string;
  projectId: string;
  funnelId: string;
  primaryIntent: PrimaryIntent;
  notes?: string | null;
  replaceBindingId?: string | null;
  metadata?: Record<string, unknown> | null;
}) {
  const rpc = "manage_ad_account_binding";
  const { data, error } = await supabase.rpc(rpc as never, {
    p_workspace_id: input.workspaceId,
    p_ad_account_id: input.adAccountId,
    p_client_id: input.clientId,
    p_project_id: input.projectId,
    p_funnel_id: input.funnelId,
    p_mapping_status: "confirmed",
    p_is_primary: primaryIntentValue(input.primaryIntent),
    p_notes: input.notes ?? null,
    p_replace_binding_id: input.replaceBindingId ?? null,
    p_metadata: input.metadata ?? null,
  } as never);
  return { data: data as string | null, error: toSafeError(error, "manage_ad_account_binding", rpc) };
}

export async function archiveBinding(input: {
  workspaceId: string;
  bindingType: "source" | "ad_account";
  bindingId: string;
  metadata?: Record<string, unknown> | null;
}) {
  const rpc = "archive_binding";
  const { data, error } = await supabase.rpc(rpc as never, {
    p_workspace_id: input.workspaceId,
    p_binding_type: input.bindingType,
    p_binding_id: input.bindingId,
    p_metadata: input.metadata ?? null,
  } as never);
  return { data: data as boolean | null, error: toSafeError(error, "archive_binding", rpc) };
}

export async function upsertClient(input: { workspaceId: string; clientName: string; clientCode?: string | null; status?: string | null }) {
  const rpc = "upsert_client";
  const { data, error } = await supabase.rpc(rpc as never, {
    p_workspace_id: input.workspaceId,
    p_client_name: input.clientName,
    p_client_code: input.clientCode ?? null,
    p_status: input.status ?? "active",
    p_industry: null,
    p_region: null,
    p_owner_name: null,
    p_owner_email: null,
    p_notes: null,
    p_created_by: null,
    p_created_by_email: null,
    p_metadata: null,
  } as never);
  return { data: data as string | null, error: toSafeError(error, "upsert_client", rpc) };
}

export async function upsertProject(input: { workspaceId: string; clientId: string; projectName: string; projectCode?: string | null; status?: string | null }) {
  const rpc = "upsert_project";
  const { data, error } = await supabase.rpc(rpc as never, {
    p_workspace_id: input.workspaceId,
    p_client_id: input.clientId,
    p_project_name: input.projectName,
    p_project_code: input.projectCode ?? null,
    p_status: input.status ?? "active",
    p_project_type: null,
    p_start_date: null,
    p_end_date: null,
    p_owner_name: null,
    p_owner_email: null,
    p_notes: null,
    p_created_by: null,
    p_created_by_email: null,
    p_metadata: null,
  } as never);
  return { data: data as string | null, error: toSafeError(error, "upsert_project", rpc) };
}

export async function upsertFunnel(input: { workspaceId: string; projectId: string; funnelName: string; funnelCode?: string | null; status?: string | null }) {
  const rpc = "upsert_funnel";
  const { data, error } = await supabase.rpc(rpc as never, {
    p_workspace_id: input.workspaceId,
    p_project_id: input.projectId,
    p_funnel_name: input.funnelName,
    p_funnel_code: input.funnelCode ?? null,
    p_status: input.status ?? "active",
    p_funnel_type: null,
    p_stage: null,
    p_primary_goal: null,
    p_owner_name: null,
    p_owner_email: null,
    p_start_date: null,
    p_end_date: null,
    p_notes: null,
    p_created_by: null,
    p_created_by_email: null,
    p_metadata: null,
  } as never);
  return { data: data as string | null, error: toSafeError(error, "upsert_funnel", rpc) };
}
