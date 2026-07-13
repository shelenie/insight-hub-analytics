import { useCallback } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";

export type WorkspaceRole = "member" | "admin" | "superadmin";

export type WorkspaceCapabilities = {
  can_read: boolean;
  can_manage_onboarding: boolean;
  can_manage_bindings: boolean;
  can_manage_mapping_review: boolean;
  can_manage_telegram_alerts: boolean;
  can_run_ads_scheduled_sync: boolean;
  can_use_ai_helper: boolean;
  can_manage_backup_restore: boolean;
  can_run_dev_actions: boolean;
};

const NO_CAPABILITIES: WorkspaceCapabilities = {
  can_read: false,
  can_manage_onboarding: false,
  can_manage_bindings: false,
  can_manage_mapping_review: false,
  can_manage_telegram_alerts: false,
  can_run_ads_scheduled_sync: false,
  can_use_ai_helper: false,
  can_manage_backup_restore: false,
  can_run_dev_actions: false,
};

type RoleResponse = {
  ok: boolean;
  role?: WorkspaceRole;
  capabilities?: Partial<WorkspaceCapabilities>;
  error?: string;
};

export const workspaceRoleQueryKey = (workspaceId: string, userId: string | undefined) => [
  "workspace-role",
  workspaceId,
  userId ?? "anonymous",
] as const;

async function fetchWorkspaceRole(workspaceId: string): Promise<{ role: WorkspaceRole; capabilities: WorkspaceCapabilities }> {
  const { data, error: invokeError } = await supabase.functions.invoke<RoleResponse>("workspace-role-info", {
    body: { workspace_id: workspaceId },
  });

  if (invokeError) throw new Error(invokeError.message || "Role unavailable");
  if (!data?.ok || !data.role) throw new Error(data?.error ?? "Role unavailable");

  return {
    role: data.role,
    capabilities: { ...NO_CAPABILITIES, ...(data.capabilities ?? {}) },
  };
}

export function useWorkspaceRole(workspaceId: string) {
  const { session } = useAuth();
  const userId = session?.user?.id;
  const query = useQuery({
    queryKey: workspaceRoleQueryKey(workspaceId, userId),
    enabled: Boolean(session && workspaceId && userId),
    queryFn: () => fetchWorkspaceRole(workspaceId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 1,
  });

  const refetch = useCallback(async () => {
    const result = await query.refetch();
    return result;
  }, [query]);

  return {
    role: query.data?.role ?? null,
    capabilities: query.data?.capabilities ?? NO_CAPABILITIES,
    isLoading: query.isLoading || query.isPending,
    error: query.error instanceof Error ? query.error.message : query.error ? "Role unavailable" : null,
    refetch,
  };
}
