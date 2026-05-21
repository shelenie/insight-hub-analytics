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
import { DeveloperDetails } from "@/components/common/DeveloperDetails";

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

const PLACEHOLDER_PATTERNS = ["test agency","test client","northstar digital clinic","evergreen growth program","main webinar funnel","placeholder","demo","mock","test_upload","backend_test"];
function isPlaceholderRow(row: OnboardingRow) { const text = Object.values(row).join(" ").toLowerCase(); return PLACEHOLDER_PATTERNS.some((p) => text.includes(p)); }
function filterRows(rows: OnboardingRow[]) { return rows.filter((r) => !isPlaceholderRow(r)); }

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
      toast({ title: "Клієнта збережено", description: "Клієнта успішно створено або оновлено." });
      setClientForm({ client_id: "", name: "", code: "", status: "active" });
      setClientError("");
      await refreshOnboarding();
    },
    onError: (error: Error) => {
      setClientError(error.message);
      toast({ title: "Не вдалося зберегти клієнта", description: error.message, variant: "destructive" });
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
      toast({ title: "Проєкт збережено", description: "Проєкт успішно створено або оновлено." });
      setProjectForm({ project_id: "", client_id: "", name: "", code: "", status: "active" });
      setProjectError("");
      await refreshOnboarding();
    },
    onError: (error: Error) => {
      setProjectError(error.message);
      toast({ title: "Не вдалося зберегти проєкт", description: error.message, variant: "destructive" });
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
      toast({ title: "Воронку збережено", description: "Воронку успішно створено або оновлено." });
      setFunnelForm({ funnel_id: "", project_id: "", name: "", code: "", status: "active" });
      setFunnelError("");
      await refreshOnboarding();
    },
    onError: (error: Error) => {
      setFunnelError(error.message);
      toast({ title: "Не вдалося зберегти воронку", description: error.message, variant: "destructive" });
    },
  });

  const groupedHierarchy = useMemo(() => {
    const byClient = new Map<string, HierarchySummary>();
    for (const row of filterRows(onboardingQuery.data?.hierarchy ?? [])) {
      const clientName = asText((row.client_name ?? row.name ?? row.title ?? row.client_code) as string | number | boolean | null) || "Клієнт без назви";
      const projectName = asText((row.project_name ?? row.name ?? row.title ?? row.project_code) as string | number | boolean | null) || "Проєкт без назви";
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

  return <DashboardLayout title="Онбординг" subtitle="Клієнти, проєкти, воронки та структура робочого простору">
    <div className="space-y-4">
      {!session ? <SectionCard title="Онбординг" description="Потрібен вхід"><p className="text-sm text-muted-foreground">Увійдіть, щоб керувати онбордингом.</p></SectionCard>
        : onboardingQuery.isLoading ? <SectionCard title="Онбординг" description="Завантаження"><p className="text-sm text-muted-foreground">Завантажуємо онбординг…</p></SectionCard>
          : onboardingQuery.error ? <SectionCard title="Онбординг" description="Стан розділу"><p className="text-sm text-destructive">Потрібне оновлення backend для цього розділу.</p><DeveloperDetails title="Technical details"><p className="mt-2 break-words">{onboardingQuery.error.message}</p></DeveloperDetails></SectionCard>
            : <>
              {roleLoading ? <SectionCard title="Доступ" description="Перевірка доступу"><p className="text-sm text-muted-foreground">Перевіряємо доступ…</p></SectionCard> : null}
              {!roleLoading && roleError ? <SectionCard title="Доступ" description="Стан доступу"><p className="text-sm text-muted-foreground">Доступ тимчасово не підтягнувся. Дії вимкнені.</p></SectionCard> : null}
              {!roleLoading && !canManageOnboarding ? <SectionCard title="Доступ" description="Керування онбордингом"><p className="text-sm text-muted-foreground">У вас немає доступу до керування онбордингом.</p></SectionCard> : null}
              <Tabs defaultValue="overview" className="space-y-4">
              <TabsList className="w-full justify-start overflow-x-auto">
                <TabsTrigger value="overview">Структура</TabsTrigger><TabsTrigger value="clients">Клієнти</TabsTrigger><TabsTrigger value="projects">Проєкти</TabsTrigger><TabsTrigger value="funnels">Воронки</TabsTrigger><TabsTrigger value="health">Стан</TabsTrigger>
              </TabsList>

              <TabsContent value="overview"><SectionCard title="Клієнт → Проєкт → Воронка" description="Структура клієнтів, проєктів і воронок">{groupedHierarchy.length === 0 ? <p className="text-sm text-muted-foreground">Дані ще не підключені.</p> : <div className="space-y-3">{groupedHierarchy.map((client) => <div key={client.clientName} className="rounded-md border border-border/70 bg-card/60 p-3"><p className="text-sm font-semibold text-foreground">{client.clientName}</p><div className="mt-2 space-y-2">{Array.from(client.projects.entries()).map(([projectName, funnels]) => <div key={`${client.clientName}-${projectName}`} className="rounded-md bg-muted/40 p-2"><p className="text-sm font-medium">{projectName}</p>{funnels.size === 0 ? <p className="mt-1 text-xs text-muted-foreground">Воронок поки немає.</p> : <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">{Array.from(funnels).map((funnelName) => <li key={`${client.clientName}-${projectName}-${funnelName}`}>{funnelName}</li>)}</ul>}</div>)}</div></div>)}</div>}</SectionCard></TabsContent>

              <TabsContent value="clients"><SectionCard title="Клієнти" description="Керування клієнтами"><UpsertPanel title="Клієнт" idKey="client_id" editIdLabel="ID клієнта (для редагування)" form={clientForm} setForm={setClientForm} isPending={clientMutation.isPending} error={clientError} signedIn={Boolean(session)} canSubmit={canManageOnboarding && Boolean(clientForm.name.trim())} onSubmit={() => {
                if (!clientForm.name.trim()) return setClientError("Вкажіть назву клієнта.");
                setClientError("");
                clientMutation.mutate({ client_id: clientForm.client_id || undefined, name: clientForm.name.trim(), code: clientForm.code || undefined, status: clientForm.status || undefined });
              }} />
                <EntityTable rows={filterRows(onboardingQuery.data?.clients ?? [])} columns={["name", "client_code", "status", "created_at", "updated_at"]} countColumnTitle="Проєкти" countForRow={(row) => projectCountByClient.get(asText(row.name) || "") ?? 0} emptyText="Записів поки немає." />
              </SectionCard></TabsContent>

              <TabsContent value="projects"><SectionCard title="Проєкти" description="Керування проєктами"><UpsertPanel title="Проєкт" idKey="project_id" parentLabel="ID клієнта" parentValue={projectForm.client_id} onParentChange={(value) => setProjectForm((p) => ({ ...p, client_id: value }))} editIdLabel="ID проєкту (для редагування)" form={projectForm} setForm={setProjectForm} isPending={projectMutation.isPending} error={projectError} signedIn={Boolean(session)} canSubmit={canManageOnboarding && Boolean(projectForm.name.trim() && projectForm.client_id.trim())} onSubmit={() => {
                if (!projectForm.client_id.trim()) return setProjectError("Вкажіть ID клієнта.");
                if (!projectForm.name.trim()) return setProjectError("Вкажіть назву проєкту.");
                setProjectError("");
                projectMutation.mutate({ project_id: projectForm.project_id || undefined, client_id: projectForm.client_id.trim(), name: projectForm.name.trim(), code: projectForm.code || undefined, status: projectForm.status || undefined });
              }} />
                <EntityTable rows={filterRows(onboardingQuery.data?.projects ?? [])} columns={["name", "client_name", "project_code", "status"]} countColumnTitle="Воронки" countForRow={(row) => funnelCountByProject.get(asText(row.name) || "") ?? 0} emptyText="Записів поки немає." />
              </SectionCard></TabsContent>

              <TabsContent value="funnels"><SectionCard title="Воронки" description="Керування воронками"><UpsertPanel title="Воронка" idKey="funnel_id" parentLabel="ID проєкту" parentValue={funnelForm.project_id} onParentChange={(value) => setFunnelForm((f) => ({ ...f, project_id: value }))} editIdLabel="ID воронки (для редагування)" form={funnelForm} setForm={setFunnelForm} isPending={funnelMutation.isPending} error={funnelError} signedIn={Boolean(session)} canSubmit={canManageOnboarding && Boolean(funnelForm.name.trim() && funnelForm.project_id.trim())} onSubmit={() => {
                if (!funnelForm.project_id.trim()) return setFunnelError("Вкажіть ID проєкту.");
                if (!funnelForm.name.trim()) return setFunnelError("Вкажіть назву воронки.");
                setFunnelError("");
                funnelMutation.mutate({ funnel_id: funnelForm.funnel_id || undefined, project_id: funnelForm.project_id.trim(), name: funnelForm.name.trim(), code: funnelForm.code || undefined, status: funnelForm.status || undefined });
              }} />
                <EntityTable rows={filterRows(onboardingQuery.data?.funnels ?? [])} columns={["name", "client_name", "project_name", "funnel_code", "status"]} emptyText="Записів поки немає." />
              </SectionCard></TabsContent>

              <TabsContent value="health"><SectionCard title="Стан онбордингу" description="Короткий стан онбордингу"><GenericTable rows={filterRows(onboardingQuery.data?.health ?? [])} emptyText="Даних про стан онбордингу поки немає." /></SectionCard></TabsContent>
            </Tabs></>}
    </div>
  </DashboardLayout>;
}

function UpsertPanel({ title, idKey, parentLabel, parentValue, onParentChange, editIdLabel, form, setForm, isPending, error, signedIn, canSubmit, onSubmit }: { title: string; idKey: "client_id" | "project_id" | "funnel_id"; parentLabel?: string; parentValue?: string; onParentChange?: (value: string) => void; editIdLabel: string; form: { name: string; code: string; status: string; [k: string]: string }; setForm: React.Dispatch<React.SetStateAction<{ name: string; code: string; status: string; [k: string]: string }>>; isPending: boolean; error: string; signedIn: boolean; canSubmit: boolean; onSubmit: () => void; }) {
  return <div className="mb-4 rounded-md border border-border/70 bg-muted/20 p-3"><p className="mb-2 text-xs text-muted-foreground">Дії перевіряються перед виконанням.</p><div className="grid grid-cols-1 gap-2 md:grid-cols-2">
    <Input value={form.name} onChange={(event) => setForm((current) => ({ ...current, name: event.target.value }))} placeholder={`Назва ${title.toLowerCase()}`} aria-label={`Назва ${title.toLowerCase()}`} />
    <Input value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} placeholder={`Код ${title.toLowerCase()} (необовʼязково)`} aria-label={`Код ${title.toLowerCase()}`} />
    <Input value={form.status} onChange={(event) => setForm((current) => ({ ...current, status: event.target.value }))} placeholder="Статус (необовʼязково)" aria-label={`${title} status`} />
    <Input value={form[idKey] ?? ""} onChange={(event) => setForm((current) => ({ ...current, [idKey]: event.target.value }))} placeholder={editIdLabel} aria-label={editIdLabel} />
    {parentLabel && onParentChange ? <Input value={parentValue ?? ""} onChange={(event) => onParentChange(event.target.value)} placeholder={parentLabel} aria-label={parentLabel} /> : null}
  </div>
    {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    <div className="mt-3 flex gap-2"><Button type="button" onClick={onSubmit} disabled={!signedIn || !canSubmit || isPending}>{isPending ? `Зберігаємо ${title.toLowerCase()}…` : `Зберегти ${title.toLowerCase()}`}</Button></div>
  </div>;
}

function EntityTable({ rows, columns, countColumnTitle, countForRow, emptyText }: { rows: OnboardingRow[]; columns: string[]; countColumnTitle?: string; countForRow?: (row: OnboardingRow) => number; emptyText: string; }) { if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>; return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border/70 text-muted-foreground">{columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{titleize(column)}</th>)}{countColumnTitle ? <th className="px-2 py-2 font-medium">{countColumnTitle}</th> : null}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${asText(row.id) || asText(row.name) || "row"}-${index}`} className="border-b border-border/40 last:border-0">{columns.map((column) => <td key={`${index}-${column}`} className="px-2 py-2 text-foreground">{formatValue(row[column])}</td>)}{countColumnTitle ? <td className="px-2 py-2 text-foreground">{countForRow ? countForRow(row) : "—"}</td> : null}</tr>)}</tbody></table></div>; }
function GenericTable({ rows, emptyText }: { rows: OnboardingRow[]; emptyText: string }) { if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>; const columns = Object.keys(rows[0] ?? {}); if (columns.length === 0) return <p className="text-sm text-muted-foreground">Дані є, але немає полів для показу.</p>; return <EntityTable rows={rows} columns={columns} emptyText={emptyText} />; }
function asText(value: string | number | boolean | null | undefined) { if (value === null || value === undefined) return ""; return String(value); }
function formatValue(value: string | number | boolean | null | undefined) { if (value === null || value === undefined || value === "") return "—"; return String(value); }
function titleize(value: string) { return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
