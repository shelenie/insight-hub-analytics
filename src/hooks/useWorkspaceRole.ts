import { useCallback, useEffect, useState } from "react";
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

export function useWorkspaceRole(workspaceId: string) {
  const { session } = useAuth();
  const [role, setRole] = useState<WorkspaceRole | null>(null);
  const [capabilities, setCapabilities] = useState<WorkspaceCapabilities>(NO_CAPABILITIES);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const refetch = useCallback(async () => {
    if (!session || !workspaceId) {
      setRole(null);
      setCapabilities(NO_CAPABILITIES);
      setError(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setError(null);

    const { data, error: invokeError } = await supabase.functions.invoke<RoleResponse>("workspace-role-info", {
      body: { workspace_id: workspaceId },
    });

    if (invokeError) {
      setRole(null);
      setCapabilities(NO_CAPABILITIES);
      setError("Role unavailable");
      setIsLoading(false);
      return;
    }

    if (!data?.ok || !data.role) {
      setRole(null);
      setCapabilities(NO_CAPABILITIES);
      setError(data?.error ?? "Role unavailable");
      setIsLoading(false);
      return;
    }

    setRole(data.role);
    setCapabilities({ ...NO_CAPABILITIES, ...(data.capabilities ?? {}) });
    setIsLoading(false);
  }, [session, workspaceId]);

  useEffect(() => {
    void refetch();
  }, [refetch]);

  return { role, capabilities, isLoading, error, refetch };
}
