import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { toast } from "@/hooks/use-toast";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";

type OnboardingRow = Record<string, string | number | boolean | null>;

type HierarchySummary = {
  clientName: string;
  projects: Map<string, Set<string>>;
};

type OnboardingData = {
  hierarchy: OnboardingRow[];
  clients: OnboardingRow[];
  projects: OnboardingRow[];
  funnels: OnboardingRow[];
  health: OnboardingRow[];
};

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

export default function Onboarding() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [clientForm, setClientForm] = useState({ client_id: "", name: "", code: "", status: "active" });
  const [projectForm, setProjectForm] = useState({ project_id: "", client_id: "", name: "", code: "", status: "active" });
  const [funnelForm, setFunnelForm] = useState({ funnel_id: "", project_id: "", name: "", code: "", status: "active" });
  const [clientError, setClientError] = useState("");
  const [projectError, setProjectError] = useState("");
  const [funnelError, setFunnelError] = useState("");
  const { capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);
  const canManageOnboarding = capabilities.can_manage_onboarding;

  const onboardingQuery = useQuery<OnboardingData>({
    queryKey: ["onboarding-management-data", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const [hierarchyRes, clientsRes, projectsRes, funnelsRes, healthRes] = await Promise.all([
        supabase.from("v_onboarding_hierarchy").select("*").eq("workspace_id", WORKSPACE_ID),
        supabase.from("v_clients").select("*").eq("workspace_id", WORKSPACE_ID),
        supabase.from("v_projects").select("*").eq("workspace_id", WORKSPACE_ID),
        supabase.from("v_funnels").select("*").eq("workspace_id", WORKSPACE_ID),
        supabase.from("v_onboarding_health").select("*").eq("workspace_id", WORKSPACE_ID),
      ]);

      if (hierarchyRes.error) throw hierarchyRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (funnelsRes.error) throw funnelsRes.error;
      if (healthRes.error) throw healthRes.error;

      return {
        hierarchy: (hierarchyRes.data ?? []) as OnboardingRow[],
        clients: (clientsRes.data ?? []) as OnboardingRow[],
        projects: (projectsRes.data ?? []) as OnboardingRow[],
        funnels: (funnelsRes.data ?? []) as OnboardingRow[],
        health: (healthRes.data ?? []) as OnboardingRow[],
      };
    },
  });

  const refreshOnboarding = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["onboarding-management-data", WORKSPACE_ID] }),
      queryClient.invalidateQueries({ queryKey: ["v_clients", WORKSPACE_ID] }),
      queryClient.invalidateQueries({ queryKey: ["v_projects", WORKSPACE_ID] }),
      queryClient.invalidateQueries({ queryKey: ["v_funnels", WORKSPACE_ID] }),
      queryClient.invalidateQueries({ queryKey: ["v_onboarding_hierarchy", WORKSPACE_ID] }),
      queryClient.invalidateQueries({ queryKey: ["v_onboarding_health", WORKSPACE_ID] }),
    ]);
  };

  const clientMutation = useMutation({
    mutationFn: async (payload: { client_id?: string; name: string; code?: string; status?: string }) => {
      const { data, error } = await supabase.functions.invoke("onboarding-client-upsert", {
        body: { workspace_id: WORKSPACE_ID, ...payload },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Client upsert failed");
      return data;
    },
    onSuccess: async () => {
      toast({ title: "Client saved", description: "Client create/edit completed successfully." });
      setClientForm({ client_id: "", name: "", code: "", status: "active" });
      setClientError("");
      await refreshOnboarding();
    },
    onError: (error: Error) => {
      setClientError(error.message);
      toast({ title: "Client save failed", description: error.message, variant: "destructive" });
    },
  });

  const projectMutation = useMutation({
    mutationFn: async (payload: { project_id?: string; client_id: string; name: string; code?: string; status?: string }) => {
      const { data, error } = await supabase.functions.invoke("onboarding-project-upsert", {
        body: { workspace_id: WORKSPACE_ID, ...payload },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Project upsert failed");
      return data;
    },
    onSuccess: async () => {
      toast({ title: "Project saved", description: "Project create/edit completed successfully." });
      setProjectForm({ project_id: "", client_id: "", name: "", code: "", status: "active" });
      setProjectError("");
      await refreshOnboarding();
    },
    onError: (error: Error) => {
      setProjectError(error.message);
      toast({ title: "Project save failed", description: error.message, variant: "destructive" });
    },
  });

  const funnelMutation = useMutation({
    mutationFn: async (payload: { funnel_id?: string; project_id: string; name: string; code?: string; status?: string }) => {
      const { data, error } = await supabase.functions.invoke("onboarding-funnel-upsert", {
        body: { workspace_id: WORKSPACE_ID, ...payload },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(data?.error ?? "Funnel upsert failed");
      return data;
    },
    onSuccess: async () => {
      toast({ title: "Funnel saved", description: "Funnel create/edit completed successfully." });
      setFunnelForm({ funnel_id: "", project_id: "", name: "", code: "", status: "active" });
      setFunnelError("");
      await refreshOnboarding();
    },
    onError: (error: Error) => {
      setFunnelError(error.message);
      toast({ title: "Funnel save failed", description: error.message, variant: "destructive" });
    },
  });

  const groupedHierarchy = useMemo(() => {
    const byClient = new Map<string, HierarchySummary>();
    for (const row of onboardingQuery.data?.hierarchy ?? []) {
      const clientName = asText((row.client_name ?? row.name ?? row.title ?? row.client_code) as string | number | boolean | null) || "Unnamed client";
      const projectName = asText((row.project_name ?? row.name ?? row.title ?? row.project_code) as string | number | boolean | null) || "Unnamed project";
      const funnelName = asText((row.funnel_name ?? row.name ?? row.title ?? row.funnel_code) as string | number | boolean | null);
      if (!byClient.has(clientName)) byClient.set(clientName, { clientName, projects: new Map() });
      const client = byClient.get(clientName);
      if (!client) continue;
      if (!client.projects.has(projectName)) client.projects.set(projectName, new Set());
      if (funnelName) client.projects.get(projectName)?.add(funnelName);
    }
    return Array.from(byClient.values());
  }, [onboardingQuery.data?.hierarchy]);

  const projectCountByClient = useMemo(() => new Map(groupedHierarchy.map((g) => [g.clientName, g.projects.size])), [groupedHierarchy]);
  const funnelCountByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of groupedHierarchy) {
      for (const [projectName, funnels] of group.projects.entries()) counts.set(projectName, funnels.size);
    }
    return counts;
  }, [groupedHierarchy]);

  return <DashboardLayout title="Onboarding" subtitle="Manage clients, projects, funnels, hierarchy, and onboarding health from Supabase views">
    <div className="space-y-4">
      {!session ? <SectionCard title="Onboarding" description="Authentication required"><p className="text-sm text-muted-foreground">You are signed out. Sign in to manage onboarding data.</p></SectionCard>
        : onboardingQuery.isLoading ? <SectionCard title="Onboarding" description="Loading data"><p className="text-sm text-muted-foreground">Loading onboarding workspace…</p></SectionCard>
          : onboardingQuery.error ? <SectionCard title="Onboarding" description="Error state"><p className="text-sm text-destructive">This section needs a backend update before it can be shown.</p><details className="mt-2 text-xs text-muted-foreground"><summary>Technical details</summary><p className="mt-2 break-words">{onboardingQuery.error.message}</p></details></SectionCard>
            : <>
              {roleLoading ? <SectionCard title="Permissions" description="Loading role"><p className="text-sm text-muted-foreground">Loading workspace role permissions…</p></SectionCard> : null}
              {!roleLoading && roleError ? <SectionCard title="Permissions" description="Role unavailable"><p className="text-sm text-muted-foreground">Workspace role is unavailable. Write actions are disabled for safety.</p></SectionCard> : null}
              {!roleLoading && !canManageOnboarding ? <SectionCard title="Permissions" description="Onboarding actions"><p className="text-sm text-muted-foreground">You do not have permission to manage onboarding.</p></SectionCard> : null}
              <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Overview / Hierarchy</TabsTrigger><TabsTrigger value="clients">Clients</TabsTrigger><TabsTrigger value="projects">Projects</TabsTrigger><TabsTrigger value="funnels">Funnels</TabsTrigger><TabsTrigger value="health">Health</TabsTrigger>
              </TabsList>

              <TabsContent value="overview"><SectionCard title="Client → Project → Funnel" description="Client, project, and funnel structure">{groupedHierarchy.length === 0 ? <p className="text-sm text-muted-foreground">No clients, projects, or funnels created yet.</p> : <div className="space-y-3">{groupedHierarchy.map((client) => <div key={client.clientName} className="rounded-md border border-border/70 bg-card/60 p-3"><p className="text-sm font-semibold text-foreground">{client.clientName}</p><div className="mt-2 space-y-2">{Array.from(client.projects.entries()).map(([projectName, funnels]) => <div key={`${client.clientName}-${projectName}`} className="rounded-md bg-muted/40 p-2"><p className="text-sm font-medium">{projectName}</p>{funnels.size === 0 ? <p className="mt-1 text-xs text-muted-foreground">No funnels yet.</p> : <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">{Array.from(funnels).map((funnelName) => <li key={`${client.clientName}-${projectName}-${funnelName}`}>{funnelName}</li>)}</ul>}</div>)}</div></div>)}</div>}</SectionCard></TabsContent>

              <TabsContent value="clients"><SectionCard title="Clients" description="Manage client records"><UpsertPanel title="Client" editIdLabel="Client ID (optional for edit)" form={clientForm} setForm={setClientForm} isPending={clientMutation.isPending} error={clientError} signedIn={Boolean(session)} canSubmit={canManageOnboarding && Boolean(clientForm.name.trim())} onSubmit={() => {
                if (!clientForm.name.trim()) return setClientError("Client name is required.");
                setClientError("");
                clientMutation.mutate({ client_id: clientForm.client_id || undefined, name: clientForm.name.trim(), code: clientForm.code || undefined, status: clientForm.status || undefined });
              }} />
                <EntityTable rows={onboardingQuery.data?.clients ?? []} columns={["name", "client_code", "status", "created_at", "updated_at"]} countColumnTitle="Projects" countForRow={(row) => projectCountByClient.get(asText(row.name) || "") ?? 0} emptyText="No clients available." />
              </SectionCard></TabsContent>

              <TabsContent value="projects"><SectionCard title="Projects" description="Manage project records"><UpsertPanel title="Project" parentLabel="Client ID" parentValue={projectForm.client_id} onParentChange={(value) => setProjectForm((p) => ({ ...p, client_id: value }))} editIdLabel="Project ID (optional for edit)" form={projectForm} setForm={setProjectForm} isPending={projectMutation.isPending} error={projectError} signedIn={Boolean(session)} canSubmit={canManageOnboarding && Boolean(projectForm.name.trim() && projectForm.client_id.trim())} onSubmit={() => {
                if (!projectForm.client_id.trim()) return setProjectError("Client ID is required.");
                if (!projectForm.name.trim()) return setProjectError("Project name is required.");
                setProjectError("");
                projectMutation.mutate({ project_id: projectForm.project_id || undefined, client_id: projectForm.client_id.trim(), name: projectForm.name.trim(), code: projectForm.code || undefined, status: projectForm.status || undefined });
              }} />
                <EntityTable rows={onboardingQuery.data?.projects ?? []} columns={["name", "client_name", "project_code", "status"]} countColumnTitle="Funnels" countForRow={(row) => funnelCountByProject.get(asText(row.name) || "") ?? 0} emptyText="No projects available." />
              </SectionCard></TabsContent>

              <TabsContent value="funnels"><SectionCard title="Funnels" description="Manage funnel records"><UpsertPanel title="Funnel" parentLabel="Project ID" parentValue={funnelForm.project_id} onParentChange={(value) => setFunnelForm((f) => ({ ...f, project_id: value }))} editIdLabel="Funnel ID (optional for edit)" form={funnelForm} setForm={setFunnelForm} isPending={funnelMutation.isPending} error={funnelError} signedIn={Boolean(session)} canSubmit={canManageOnboarding && Boolean(funnelForm.name.trim() && funnelForm.project_id.trim())} onSubmit={() => {
                if (!funnelForm.project_id.trim()) return setFunnelError("Project ID is required.");
                if (!funnelForm.name.trim()) return setFunnelError("Funnel name is required.");
                setFunnelError("");
                funnelMutation.mutate({ funnel_id: funnelForm.funnel_id || undefined, project_id: funnelForm.project_id.trim(), name: funnelForm.name.trim(), code: funnelForm.code || undefined, status: funnelForm.status || undefined });
              }} />
                <EntityTable rows={onboardingQuery.data?.funnels ?? []} columns={["name", "client_name", "project_name", "funnel_code", "status"]} emptyText="No funnels available." />
              </SectionCard></TabsContent>

              <TabsContent value="health"><SectionCard title="Onboarding health" description="Onboarding health overview"><GenericTable rows={onboardingQuery.data?.health ?? []} emptyText="No onboarding health records found." /></SectionCard></TabsContent>
            </Tabs></>}
    </div>
  </DashboardLayout>;
}

function UpsertPanel({ title, parentLabel, parentValue, onParentChange, editIdLabel, form, setForm, isPending, error, signedIn, canSubmit, onSubmit }: { title: string; parentLabel?: string; parentValue?: string; onParentChange?: (value: string) => void; editIdLabel: string; form: { name: string; code: string; status: string; [k: string]: string }; setForm: React.Dispatch<React.SetStateAction<{ name: string; code: string; status: string; [k: string]: string }>>; isPending: boolean; error: string; signedIn: boolean; canSubmit: boolean; onSubmit: () => void; }) {
  return <div className="mb-4 rounded-md border border-border/70 bg-muted/20 p-3"><p className="mb-2 text-xs text-muted-foreground">Create/edit actions are checked securely on submit.</p><div className="grid grid-cols-1 gap-2 md:grid-cols-2">
    <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={`${title} name`} aria-label={`${title} name`} />
    <Input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder={`${title} code (optional)`} aria-label={`${title} code`} />
    <Input value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} placeholder="Status (optional)" aria-label={`${title} status`} />
    <Input value={form[Object.keys(form)[0].includes("client") ? "client_id" : Object.keys(form)[0].includes("project") ? "project_id" : "funnel_id"] ?? ""} onChange={(event) => {
      const idKey = title.toLowerCase() === "client" ? "client_id" : title.toLowerCase() === "project" ? "project_id" : "funnel_id";
      setForm((current) => ({ ...current, [idKey]: event.target.value }));
    }} placeholder={editIdLabel} aria-label={editIdLabel} />
    {parentLabel && onParentChange ? <Input value={parentValue ?? ""} onChange={(event) => onParentChange(event.target.value)} placeholder={`${parentLabel} (required)`} aria-label={parentLabel} /> : null}
  </div>
    {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    <div className="mt-3 flex gap-2"><Button type="button" onClick={onSubmit} disabled={!signedIn || !canSubmit || isPending}>{isPending ? `${title} saving…` : `Create / Edit ${title}`}</Button></div>
  </div>;
}

function EntityTable({ rows, columns, countColumnTitle, countForRow, emptyText }: { rows: OnboardingRow[]; columns: string[]; countColumnTitle?: string; countForRow?: (row: OnboardingRow) => number; emptyText: string; }) { if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>; return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border/70 text-muted-foreground">{columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{titleize(column)}</th>)}{countColumnTitle ? <th className="px-2 py-2 font-medium">{countColumnTitle}</th> : null}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${asText(row.id) || asText(row.name) || "row"}-${index}`} className="border-b border-border/40 last:border-0">{columns.map((column) => <td key={`${index}-${column}`} className="px-2 py-2 text-foreground">{formatValue(row[column])}</td>)}{countColumnTitle ? <td className="px-2 py-2 text-foreground">{countForRow ? countForRow(row) : "—"}</td> : null}</tr>)}</tbody></table></div>; }
function GenericTable({ rows, emptyText }: { rows: OnboardingRow[]; emptyText: string }) { if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>; const columns = Object.keys(rows[0] ?? {}); if (columns.length === 0) return <p className="text-sm text-muted-foreground">Health data exists but has no displayable fields.</p>; return <EntityTable rows={rows} columns={columns} emptyText={emptyText} />; }
function asText(value: string | number | boolean | null | undefined) { if (value === null || value === undefined) return ""; return String(value); }
function formatValue(value: string | number | boolean | null | undefined) { if (value === null || value === undefined || value === "") return "—"; return String(value); }
function titleize(value: string) { return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
