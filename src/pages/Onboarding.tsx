import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "@/hooks/use-toast";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";
import { DeveloperDetails } from "@/components/common/DeveloperDetails";
import { RefreshCw } from "lucide-react";

type OnboardingRow = Record<string, string | number | boolean | null>;

type HierarchySummary = {
  clientKey: string;
  clientName: string;
  projects: Map<string, { projectName: string; funnels: Set<string> }>;
};

type OnboardingData = {
  hierarchy: OnboardingRow[];
  clients: OnboardingRow[];
  projects: OnboardingRow[];
  funnels: OnboardingRow[];
  health: OnboardingRow[];
};

type ClientForm = { client_id: string; name: string; code: string; status: string };
type ProjectForm = { project_id: string; client_id: string; name: string; code: string; status: string };
type FunnelForm = { funnel_id: string; client_id: string; project_id: string; name: string; code: string; status: string };

type SelectOption = { value: string; label: string; clientId?: string; clientName?: string; projectId?: string; projectName?: string; code?: string };

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
const UNNAMED_LABELS = {
  client: "Клієнт без назви — перевірити джерело даних",
  project: "Проєкт без назви — перевірити джерело даних",
  funnel: "Воронка без назви — перевірити джерело даних",
} as const;
const UNNAMED_LABEL_VALUES = new Set<string>(Object.values(UNNAMED_LABELS));

const PLACEHOLDER_PATTERNS = ["test agency", "test client", "northstar digital clinic", "evergreen growth program", "main webinar funnel", "placeholder", "demo", "mock", "test_upload", "backend_test"];
function isPlaceholderRow(row: OnboardingRow) { const text = Object.values(row).join(" ").toLowerCase(); return PLACEHOLDER_PATTERNS.some((p) => text.includes(p)); }
function filterRows(rows: OnboardingRow[]) { return rows.filter((r) => !isPlaceholderRow(r)); }

const emptyClientForm: ClientForm = { client_id: "", name: "", code: "", status: "active" };
const emptyProjectForm: ProjectForm = { project_id: "", client_id: "", name: "", code: "", status: "active" };
const emptyFunnelForm: FunnelForm = { funnel_id: "", client_id: "", project_id: "", name: "", code: "", status: "active" };

const statusOptions = [
  { value: "active", label: "Активно" },
  { value: "inactive", label: "Неактивно" },
  { value: "archived", label: "Архівовано" },
];

const ADS_SUBNAV_TRIGGER_CLASS =
  "h-10 whitespace-nowrap rounded-lg border border-transparent px-4 text-sm font-semibold transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm";

const columnLabels: Record<string, string> = {
  name: "Назва",
  client_code: "Код клієнта",
  status: "Статус",
  created_at: "Створено",
  updated_at: "Оновлено",
  client_name: "Клієнт",
  project_code: "Код проєкту",
  project_name: "Проєкт",
  funnel_code: "Код воронки",
};

export default function Onboarding() {
  const { session } = useAuth();
  const queryClient = useQueryClient();
  const [clientForm, setClientForm] = useState<ClientForm>(emptyClientForm);
  const [projectForm, setProjectForm] = useState<ProjectForm>(emptyProjectForm);
  const [funnelForm, setFunnelForm] = useState<FunnelForm>(emptyFunnelForm);
  const [clientError, setClientError] = useState("");
  const [projectError, setProjectError] = useState("");
  const [funnelError, setFunnelError] = useState("");
  const [lastRefreshedAt, setLastRefreshedAt] = useState<Date | null>(null);
  const { capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);
  const canManageOnboarding = capabilities.can_manage_onboarding;
  const canEditOnboarding = Boolean(session) && canManageOnboarding && !roleLoading;

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

  const clients = useMemo(() => filterRows(onboardingQuery.data?.clients ?? []), [onboardingQuery.data?.clients]);
  const projects = useMemo(() => filterRows(onboardingQuery.data?.projects ?? []), [onboardingQuery.data?.projects]);
  const funnels = useMemo(() => filterRows(onboardingQuery.data?.funnels ?? []), [onboardingQuery.data?.funnels]);
  const healthRows = useMemo(() => filterRows(onboardingQuery.data?.health ?? []), [onboardingQuery.data?.health]);

  const clientOptions = useMemo<SelectOption[]>(() => clients.map((row) => {
    const value = entityId(row, "client_id");
    const name = displayNameForEntity(row, "client");
    const code = asText(row.client_code);
    return value ? { value, label: code ? `${name} (${code})` : name, clientId: value, clientName: name, code } : null;
  }).filter(Boolean) as SelectOption[], [clients]);

  const clientNameById = useMemo(() => new Map(clientOptions.map((option) => [option.value, option.clientName ?? option.label])), [clientOptions]);
  const clientIdByName = useMemo(() => new Map(clientOptions.map((option) => [option.clientName ?? option.label, option.value])), [clientOptions]);
  const projectOptions = useMemo<SelectOption[]>(() => projects.map((row) => {
    const value = entityId(row, "project_id");
    const clientId = referenceId(row, "client_id");
    const clientName = asText(row.client_name) || clientNameById.get(clientId) || UNNAMED_LABELS.client;
    const name = displayNameForEntity(row, "project");
    const code = asText(row.project_code);
    const label = `${clientName} → ${code ? `${name} (${code})` : name}`;
    return value ? { value, label, clientId, clientName, projectId: value, projectName: name, code } : null;
  }).filter(Boolean) as SelectOption[], [clientNameById, projects]);

  const projectIdByName = useMemo(() => new Map(projectOptions.map((option) => [option.projectName ?? option.label, option.value])), [projectOptions]);

  const filteredProjectOptions = useMemo(() => {
    if (!funnelForm.client_id) return projectOptions;
    const selectedClientName = clientNameById.get(funnelForm.client_id);
    return projectOptions.filter((option) => option.clientId === funnelForm.client_id || (selectedClientName && option.clientName === selectedClientName));
  }, [clientNameById, funnelForm.client_id, projectOptions]);

  const dataShapeDiagnostics = useMemo(() => ({
    clients: fieldNames(onboardingQuery.data?.clients ?? []),
    projects: fieldNames(onboardingQuery.data?.projects ?? []),
    funnels: fieldNames(onboardingQuery.data?.funnels ?? []),
    hierarchy: fieldNames(onboardingQuery.data?.hierarchy ?? []),
    health: fieldNames(onboardingQuery.data?.health ?? []),
  }), [onboardingQuery.data]);
  const clientsMissingClientId = clients.length > 0 && clientOptions.length === 0;
  const projectsMissingProjectId = projects.length > 0 && projectOptions.length === 0;

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

  const resetClientForm = () => { setClientForm(emptyClientForm); setClientError(""); };
  const resetProjectForm = () => { setProjectForm(emptyProjectForm); setProjectError(""); };
  const resetFunnelForm = () => { setFunnelForm(emptyFunnelForm); setFunnelError(""); };

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
      resetClientForm();
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
      resetProjectForm();
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
      resetFunnelForm();
      await refreshOnboarding();
    },
    onError: (error: Error) => {
      setFunnelError(error.message);
      toast({ title: "Не вдалося зберегти воронку", description: error.message, variant: "destructive" });
    },
  });

  const hierarchyRows = useMemo(() => filterRows(onboardingQuery.data?.hierarchy ?? []), [onboardingQuery.data?.hierarchy]);

  const groupedHierarchy = useMemo(() => {
    const byClient = new Map<string, HierarchySummary>();
    for (const row of hierarchyRows) {
      const clientName = hierarchyDisplayName(row, "client");
      const projectName = hierarchyDisplayName(row, "project");
      const funnelName = hasFunnelReference(row) ? hierarchyDisplayName(row, "funnel") : "";
      const clientKey = entityId(row, "client_id") || asText(row.client_code) || clientName;
      const projectKey = entityId(row, "project_id") || asText(row.project_code) || `${clientKey}-${projectName}`;

      if (!byClient.has(clientKey)) byClient.set(clientKey, { clientKey, clientName, projects: new Map() });
      const client = byClient.get(clientKey);
      if (!client) continue;
      if (!client.projects.has(projectKey)) client.projects.set(projectKey, { projectName, funnels: new Set() });
      if (funnelName) client.projects.get(projectKey)?.funnels.add(funnelName);
    }
    return Array.from(byClient.values());
  }, [hierarchyRows]);

  const unnamedHierarchySummary = useMemo(() => buildUnnamedHierarchySummary(hierarchyRows), [hierarchyRows]);

  const projectCountByClient = useMemo(() => buildProjectCountByClient(projects, hierarchyRows), [hierarchyRows, projects]);

  const funnelCountByProject = useMemo(() => buildFunnelCountByProject(funnels, hierarchyRows), [funnels, hierarchyRows]);

  const healthDiagnostics = useMemo(() => buildHealthDiagnostics(healthRows, clients, projects, funnels, unnamedHierarchySummary), [clients, funnels, healthRows, projects, unnamedHierarchySummary]);
  const healthCards = useMemo(() => buildHealthCards(healthRows, clients, projects, funnels, healthDiagnostics.hasWarnings), [clients, funnels, healthDiagnostics.hasWarnings, healthRows, projects]);
  const isRefreshing = onboardingQuery.isFetching;
  const refreshLabel = isRefreshing ? "Оновлюємо…" : "Оновити";

  const handleRefresh = async () => {
    await refreshOnboarding();
    setLastRefreshedAt(new Date());
  };

  const headerActions = session && !onboardingQuery.isLoading && !onboardingQuery.error ? <>
    {lastRefreshedAt ? <p className="text-xs text-muted-foreground">Оновлено: {formatDateTime(lastRefreshedAt.toISOString())}</p> : null}
    <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-xs" onClick={handleRefresh} disabled={isRefreshing}>
      <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
      {refreshLabel}
    </Button>
  </> : null;

  return <DashboardLayout title="Онбординг" subtitle="Клієнти, проєкти, воронки та структура робочого простору" actions={headerActions} contentClassName="pt-1 lg:pt-2">
    <div className="space-y-4">
      {!session ? <SectionCard title="Онбординг" description="Потрібен вхід"><p className="text-sm text-muted-foreground">Увійдіть, щоб керувати онбордингом.</p></SectionCard>
        : onboardingQuery.isLoading ? <SectionCard title="Онбординг" description="Завантаження"><p className="text-sm text-muted-foreground">Завантажуємо онбординг…</p></SectionCard>
          : onboardingQuery.error ? <SectionCard title="Онбординг" description="Стан розділу"><p className="text-sm text-destructive">Не вдалося завантажити онбординг.</p><DeveloperDetails title="Technical details"><p className="mt-2 break-words">{onboardingQuery.error.message}</p></DeveloperDetails></SectionCard>
            : <>
              {!roleLoading && roleError ? <NoticeBlock>Доступ тимчасово не підтягнувся. Дії вимкнені.</NoticeBlock> : null}
              {!roleLoading && !canManageOnboarding ? <SectionCard title="Доступ" description="Керування онбордингом"><p className="text-sm text-muted-foreground">У вас немає доступу до керування онбордингом.</p></SectionCard> : null}
              <Tabs defaultValue="overview" className="space-y-2">
              <div className="overflow-x-auto rounded-xl border border-border/70 bg-muted/30 px-2 py-2 shadow-sm">
                <TabsList className="inline-flex h-auto w-max min-w-full items-center justify-start gap-1.5 bg-transparent p-0 text-muted-foreground">
                  <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="overview">Структура</TabsTrigger>
                  <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="clients">Клієнти</TabsTrigger>
                  <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="projects">Проєкти</TabsTrigger>
                  <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="funnels">Воронки</TabsTrigger>
                  <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="health">Стан</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="mt-1"><SectionCard title="Клієнт → Проєкт → Воронка" description="Структура клієнтів, проєктів і воронок">
                {unnamedHierarchySummary.hasUnnamed ? <NoticeBlock>{unnamedHierarchySummary.message} Перевірте джерело даних.</NoticeBlock> : null}
                {unnamedHierarchySummary.hasUnnamed ? <DeveloperDetails title="Ідентифікатори записів без назви"><UnnamedRowsDetails rows={unnamedHierarchySummary.rows} /></DeveloperDetails> : null}
                {groupedHierarchy.length === 0 ? <EmptyMessage>Дані ще не підключені.</EmptyMessage> : <div className="space-y-3">{groupedHierarchy.map((client) => <div key={client.clientKey} className="rounded-md border border-border/70 bg-card/60 p-3"><p className="text-sm font-semibold text-foreground"><DisplayName value={client.clientName} /></p><div className="mt-2 space-y-2">{Array.from(client.projects.entries()).map(([projectKey, project]) => <div key={`${client.clientKey}-${projectKey}`} className="rounded-md bg-muted/40 p-2"><p className="text-sm font-medium"><DisplayName value={project.projectName} /></p>{project.funnels.size === 0 ? <p className="mt-1 text-xs text-muted-foreground">Воронок поки немає.</p> : <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">{Array.from(project.funnels).map((funnelName) => <li key={`${client.clientKey}-${projectKey}-${funnelName}`}><DisplayName value={funnelName} /></li>)}</ul>}</div>)}</div></div>)}</div>}
              </SectionCard></TabsContent>

              <TabsContent value="clients" className="mt-1"><SectionCard title="Клієнти" description="Керування клієнтами">
                <UpsertPanel title="Клієнт" editModeLabel="Редагування клієнта" isEditing={Boolean(clientForm.client_id)} onCancel={resetClientForm} form={clientForm} setForm={setClientForm} isPending={clientMutation.isPending} error={clientError} signedIn={Boolean(session)} canSubmit={canEditOnboarding && Boolean(clientForm.name.trim())} disabled={!canEditOnboarding} submitLabel={clientForm.client_id ? "Зберегти зміни" : "Створити клієнта"} pendingLabel="Зберігаємо клієнта…" onSubmit={() => {
                  if (!clientForm.name.trim()) return setClientError("Вкажіть назву клієнта.");
                  setClientError("");
                  clientMutation.mutate({ client_id: clientForm.client_id || undefined, name: clientForm.name.trim(), code: clientForm.code || undefined, status: clientForm.status || undefined });
                }}>
                  <DeveloperDetails title="Технічні деталі"><p>ID клієнта: {clientForm.client_id || "створиться автоматично"}</p></DeveloperDetails>
                </UpsertPanel>
                <EntityTable rows={clients} columns={["name", "client_code", "status", "created_at", "updated_at"]} countColumnTitle="Проєкти" countForRow={(row) => countForStrictMatches(projectCountByClient, safeClientMatches(row))} emptyText="Записів поки немає." canEdit={canEditOnboarding} canEditRow={(row) => Boolean(entityId(row, "client_id"))} onEdit={(row) => setClientForm({ client_id: entityId(row, "client_id"), name: preferredName(row, "client"), code: asText(row.client_code), status: asText(row.status) || "active" })} />
              </SectionCard></TabsContent>

              <TabsContent value="projects" className="mt-1"><SectionCard title="Проєкти" description="Керування проєктами">
                <UpsertPanel title="Проєкт" compact fieldsBeforeInputs editModeLabel="Редагування проєкту" isEditing={Boolean(projectForm.project_id)} onCancel={resetProjectForm} form={projectForm} setForm={setProjectForm} isPending={projectMutation.isPending} error={projectError} signedIn={Boolean(session)} canSubmit={canEditOnboarding && Boolean(projectForm.name.trim() && projectForm.client_id.trim())} disabled={!canEditOnboarding || clientsMissingClientId || !projectForm.client_id.trim()} submitLabel={projectForm.project_id ? "Зберегти зміни" : "Створити проєкт"} helperText={!projectForm.client_id.trim() ? "Спочатку оберіть клієнта, потім заповніть проєкт." : undefined} pendingLabel="Зберігаємо проєкт…" details={ <DeveloperDetails title="Технічні деталі"><p>ID проєкту: {projectForm.project_id || "створиться автоматично"}</p><p>ID клієнта: {projectForm.client_id || "не обрано"}</p>{clientsMissingClientId ? <p>v_clients не повертає client_id, тому створення/редагування проєктів вимкнене до виправлення джерела даних.</p> : null}</DeveloperDetails> } onSubmit={() => {
                  if (!projectForm.client_id.trim()) return setProjectError("Оберіть клієнта.");
                  if (!projectForm.name.trim()) return setProjectError("Вкажіть назву проєкту.");
                  setProjectError("");
                  projectMutation.mutate({ project_id: projectForm.project_id || undefined, client_id: projectForm.client_id.trim(), name: projectForm.name.trim(), code: projectForm.code || undefined, status: projectForm.status || undefined });
                }}>
                  <SelectField disabled={!canEditOnboarding || projectMutation.isPending || clientsMissingClientId} label="Клієнт" placeholder="Оберіть клієнта" value={projectForm.client_id} options={clientOptions} emptyText="Клієнтів поки немає. Спочатку створіть клієнта." onChange={(value) => setProjectForm((current) => ({ ...current, client_id: value }))} />
                </UpsertPanel>
                <EntityTable rows={projects} columns={["name", "client_name", "project_code", "status"]} countColumnTitle="Воронки" countForRow={(row) => countForStrictMatches(funnelCountByProject, safeProjectMatches(row))} emptyText="Записів поки немає." canEdit={canEditOnboarding} canEditRow={(row) => Boolean(entityId(row, "project_id"))} onEdit={(row) => setProjectForm({ project_id: entityId(row, "project_id"), client_id: referenceId(row, "client_id") || clientIdByName.get(asText(row.client_name)) || "", name: preferredName(row, "project"), code: asText(row.project_code), status: asText(row.status) || "active" })} />
              </SectionCard></TabsContent>

              <TabsContent value="funnels" className="mt-1"><SectionCard title="Воронки" description="Керування воронками">
                <UpsertPanel title="Воронка" compact fieldsBeforeInputs editModeLabel="Редагування воронки" isEditing={Boolean(funnelForm.funnel_id)} onCancel={resetFunnelForm} form={funnelForm} setForm={setFunnelForm} isPending={funnelMutation.isPending} error={funnelError} signedIn={Boolean(session)} canSubmit={canEditOnboarding && Boolean(funnelForm.name.trim() && funnelForm.project_id.trim())} disabled={!canEditOnboarding || projectsMissingProjectId || !funnelForm.project_id.trim()} submitLabel={funnelForm.funnel_id ? "Зберегти зміни" : "Створити воронку"} helperText={!funnelForm.project_id.trim() ? "Спочатку оберіть клієнта і проєкт, потім заповніть воронку." : undefined} pendingLabel="Зберігаємо воронку…" details={ <DeveloperDetails title="Технічні деталі"><p>ID воронки: {funnelForm.funnel_id || "створиться автоматично"}</p><p>ID проєкту: {funnelForm.project_id || "не обрано"}</p>{projectsMissingProjectId ? <p>v_projects не повертає project_id, тому створення/редагування воронок вимкнене до виправлення джерела даних.</p> : null}</DeveloperDetails> } onSubmit={() => {
                  if (!funnelForm.project_id.trim()) return setFunnelError("Оберіть проєкт.");
                  if (!funnelForm.name.trim()) return setFunnelError("Вкажіть назву воронки.");
                  setFunnelError("");
                  funnelMutation.mutate({ funnel_id: funnelForm.funnel_id || undefined, project_id: funnelForm.project_id.trim(), name: funnelForm.name.trim(), code: funnelForm.code || undefined, status: funnelForm.status || undefined });
                }}>
                  <SelectField disabled={!canEditOnboarding || funnelMutation.isPending} label="Клієнт" placeholder="Усі клієнти" value={funnelForm.client_id || "all"} emptyText="Клієнтів поки немає. Спочатку створіть клієнта." options={clientOptions.length ? [{ value: "all", label: "Усі клієнти" }, ...clientOptions] : []} onChange={(value) => setFunnelForm((current) => ({ ...current, client_id: value === "all" ? "" : value, project_id: "" }))} />
                  <SelectField disabled={!canEditOnboarding || funnelMutation.isPending || projectsMissingProjectId} label="Проєкт" placeholder="Оберіть проєкт" value={funnelForm.project_id} options={filteredProjectOptions} onChange={(value) => setFunnelForm((current) => ({ ...current, project_id: value }))} emptyText={funnelForm.client_id ? "У цього клієнта ще немає проєктів." : "Проєктів поки немає. Спочатку створіть проєкт."} />
                </UpsertPanel>
                <EntityTable rows={funnels} columns={["name", "client_name", "project_name", "funnel_code", "status"]} emptyText="Записів поки немає." canEdit={canEditOnboarding} canEditRow={(row) => Boolean(entityId(row, "funnel_id"))} onEdit={(row) => {
                  const projectId = referenceId(row, "project_id") || projectIdByName.get(asText(row.project_name)) || "";
                  const projectOption = projectOptions.find((option) => option.value === projectId);
                  setFunnelForm({ funnel_id: entityId(row, "funnel_id"), client_id: projectOption?.clientId ?? (referenceId(row, "client_id") || clientIdByName.get(asText(row.client_name)) || ""), project_id: projectId, name: preferredName(row, "funnel"), code: asText(row.funnel_code), status: asText(row.status) || "active" });
                }} />
              </SectionCard></TabsContent>

              <TabsContent value="health" className="mt-1"><SectionCard title="Стан онбордингу" description="Короткий стан онбордингу">
                {healthDiagnostics.messages.length ? <NoticeBlock>{healthDiagnostics.messages.join(" ")}</NoticeBlock> : null}
                {healthRows.length === 0 && clients.length === 0 && projects.length === 0 && funnels.length === 0 ? <EmptyMessage>Даних про стан онбордингу поки немає.</EmptyMessage> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{healthCards.map((card) => <div key={card.title} className="rounded-md border border-border/70 bg-card/60 p-4"><p className="text-sm text-muted-foreground">{card.title}</p><p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>{card.description ? <p className="mt-1 text-xs text-muted-foreground">{card.description}</p> : null}</div>)}</div>}
                <DeveloperDetails title="Технічні деталі"><p>workspace_id: {WORKSPACE_ID}</p><p>Видимі активні клієнти / проєкти / воронки: {healthDiagnostics.visible.activeClients} / {healthDiagnostics.visible.activeProjects} / {healthDiagnostics.visible.activeFunnels}</p><p>Health активні клієнти / проєкти / воронки: {healthDiagnostics.backend.activeClients ?? "немає"} / {healthDiagnostics.backend.activeProjects ?? "немає"} / {healthDiagnostics.backend.activeFunnels ?? "немає"}</p><p>Поля v_clients: {formatFieldList(dataShapeDiagnostics.clients)}</p><p>Поля v_projects: {formatFieldList(dataShapeDiagnostics.projects)}</p><p>Поля v_funnels: {formatFieldList(dataShapeDiagnostics.funnels)}</p><p>Поля v_onboarding_hierarchy: {formatFieldList(dataShapeDiagnostics.hierarchy)}</p><p>Поля v_onboarding_health: {formatFieldList(dataShapeDiagnostics.health)}</p><p>Якщо ID відсутні у view, лічильники використовують назви/коди та v_onboarding_hierarchy як fallback.</p><GenericTable rows={healthRows} emptyText="Технічні дані відсутні." /></DeveloperDetails>
              </SectionCard></TabsContent>
            </Tabs></>}
    </div>
  </DashboardLayout>;
}

function UpsertPanel<T extends { name: string; code: string; status: string }>({ title, editModeLabel, isEditing, onCancel, form, setForm, isPending, error, signedIn, canSubmit, disabled, submitLabel, pendingLabel, helperText, onSubmit, children, fieldsBeforeInputs = false, details, compact = false }: { title: string; editModeLabel: string; isEditing: boolean; onCancel: () => void; form: T; setForm: React.Dispatch<React.SetStateAction<T>>; isPending: boolean; error: string; signedIn: boolean; canSubmit: boolean; disabled?: boolean; submitLabel: string; pendingLabel: string; helperText?: string; onSubmit: () => void; children?: React.ReactNode; fieldsBeforeInputs?: boolean; details?: React.ReactNode; compact?: boolean; }) {
  const labels = formLabels(title);
  const inputs = <>
    <FormInputField disabled={disabled || isPending} label={labels.name} value={form.name} onChange={(value) => setForm((current: T) => ({ ...current, name: value }))} />
    <FormInputField disabled={disabled || isPending} label={labels.code} value={form.code} onChange={(value) => setForm((current: T) => ({ ...current, code: value }))} />
    <SelectField disabled={disabled || isPending} label="Статус" placeholder="Оберіть статус" value={form.status || "active"} options={statusOptions} onChange={(value) => setForm((current: T) => ({ ...current, status: value }))} />
  </>;
  return <div className={`${compact ? "mb-3 p-2.5" : "mb-4 p-3"} rounded-md border border-border/70 bg-muted/20`}>
    <div className={`${compact ? "mb-2" : "mb-3"} flex flex-wrap items-center justify-between gap-2`}>
      <p className="text-xs text-muted-foreground">{isEditing ? editModeLabel : createModeLabel(title)}</p>
      {isEditing ? <Button type="button" size="sm" variant="outline" onClick={onCancel}>Скасувати</Button> : null}
    </div>
    <div className={`grid grid-cols-1 items-start ${compact ? "gap-2" : "gap-3"} md:grid-cols-2`}>
      {fieldsBeforeInputs ? children : null}
      {inputs}
      {fieldsBeforeInputs ? null : children}
      {details ? <div className="md:col-span-2">{details}</div> : null}
    </div>
    {helperText ? <p className="mt-2 text-xs text-muted-foreground">{helperText}</p> : null}
    {error ? <p className="mt-2 text-xs text-destructive">{error}</p> : null}
    <div className={`${compact ? "mt-2" : "mt-3"} flex gap-2`}><Button type="button" onClick={onSubmit} disabled={!signedIn || !canSubmit || isPending}>{isPending ? pendingLabel : submitLabel}</Button></div>
  </div>;
}

function FormInputField({ label, value, onChange, disabled = false }: { label: string; value: string; onChange: (value: string) => void; disabled?: boolean }) {
  return <label className="space-y-1"><span className="text-xs font-medium text-muted-foreground">{label}</span><Input className="h-10" disabled={disabled} value={value} onChange={(event) => onChange(event.target.value)} placeholder={label} aria-label={label} /></label>;
}

function SelectField({ label, placeholder, value, options, onChange, emptyText = "Список порожній.", disabled = false }: { label: string; placeholder: string; value: string; options: SelectOption[]; onChange: (value: string) => void; emptyText?: string; disabled?: boolean }) {
  return <div className="space-y-1"><span className="text-xs font-medium text-muted-foreground">{label}</span><Select value={value} onValueChange={onChange} disabled={disabled || options.length === 0}><SelectTrigger className="h-10" aria-label={label}><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.length === 0 ? <SelectItem value="__empty" disabled>{emptyText}</SelectItem> : options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

function EntityTable({ rows, columns, countColumnTitle, countForRow, emptyText, onEdit, canEdit = true, canEditRow }: { rows: OnboardingRow[]; columns: string[]; countColumnTitle?: string; countForRow?: (row: OnboardingRow) => number; emptyText: string; onEdit?: (row: OnboardingRow) => void; canEdit?: boolean; canEditRow?: (row: OnboardingRow) => boolean; }) {
  if (rows.length === 0) return <EmptyMessage>{emptyText}</EmptyMessage>;
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border/70 text-muted-foreground">{columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{columnLabels[column] ?? column}</th>)}{countColumnTitle ? <th className="w-24 px-2 py-2 text-center font-medium">{countColumnTitle}</th> : null}{onEdit ? <th className="w-28 px-2 py-2 text-center font-medium">Дії</th> : null}</tr></thead><tbody>{rows.map((row, index) => <tr key={rowKey(row, columns, index)} className="border-b border-border/40 last:border-0">{columns.map((column) => <td key={`${index}-${column}`} className="px-2 py-2 text-foreground">{formatDisplayCell(row, column)}</td>)}{countColumnTitle ? <td className="w-24 px-2 py-2 text-center tabular-nums text-foreground">{countForRow ? countForRow(row) : "—"}</td> : null}{onEdit ? <td className="w-28 whitespace-nowrap px-2 py-2 text-center"><Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={!canEdit || (canEditRow ? !canEditRow(row) : false)} onClick={() => onEdit(row)}>Редагувати</Button></td> : null}</tr>)}</tbody></table></div>;
}

function GenericTable({ rows, emptyText }: { rows: OnboardingRow[]; emptyText: string }) { if (rows.length === 0) return <EmptyMessage>{emptyText}</EmptyMessage>; const columns = Object.keys(rows[0] ?? {}); if (columns.length === 0) return <EmptyMessage>Дані є, але немає полів для показу.</EmptyMessage>; return <EntityTable rows={rows} columns={columns} emptyText={emptyText} />; }
function EmptyMessage({ children }: { children: React.ReactNode }) { return <p className="text-sm text-muted-foreground">{children}</p>; }
function NoticeBlock({ children }: { children: React.ReactNode }) { return <div className="mb-3 rounded-md border border-amber-200/70 bg-amber-50/80 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">{children}</div>; }
function DisplayName({ value }: { value: string }) { return UNNAMED_LABEL_VALUES.has(value) ? <span className="rounded-full border border-border/70 bg-muted/40 px-1.5 py-0.5 text-xs font-normal italic text-muted-foreground">{value}</span> : <>{value}</>; }
function createModeLabel(title: string) { return title === "Воронка" ? "Нова воронка" : `Новий ${title.toLowerCase()}`; }
function formLabels(title: string) { return ({ Клієнт: { name: "Назва клієнта", code: "Код клієнта (необовʼязково)" }, Проєкт: { name: "Назва проєкту", code: "Код проєкту (необовʼязково)" }, Воронка: { name: "Назва воронки", code: "Код воронки (необовʼязково)" } } as Record<string, { name: string; code: string }>)[title] ?? { name: `Назва ${title.toLowerCase()}`, code: `Код ${title.toLowerCase()} (необовʼязково)` }; }
function asText(value: string | number | boolean | null | undefined) { if (value === null || value === undefined) return ""; return String(value).trim(); }
function entityId(row: OnboardingRow, preferredKey: "client_id" | "project_id" | "funnel_id") { return asText(row[preferredKey]) || asText(row.id); }
function referenceId(row: OnboardingRow, key: string) { return asText(row[key]); }
function preferredName(row: OnboardingRow, entity: "client" | "project" | "funnel") { return asText(row.name ?? row[`${entity}_name`] ?? row[`${entity}_code`]); }
function displayNameForEntity(row: OnboardingRow, entity: "client" | "project" | "funnel") { return preferredName(row, entity) || UNNAMED_LABELS[entity]; }
function hierarchyDisplayName(row: OnboardingRow, entity: "client" | "project" | "funnel") { return asText(row[`${entity}_name`] ?? (entity === "client" ? row.name : undefined) ?? row[`${entity}_code`]) || UNNAMED_LABELS[entity]; }
function hasFunnelReference(row: OnboardingRow) { return ["funnel_id", "funnel_name", "funnel_code"].some((key) => key in row && asText(row[key]) !== ""); }
function hasProjectReference(row: OnboardingRow) { return ["project_id", "project_name", "project_code"].some((key) => key in row && asText(row[key]) !== ""); }
function formatDisplayCell(row: OnboardingRow, column: string) {
  if (column === "name") return <DisplayName value={displayNameForEntity(row, inferEntity(row))} />;
  return formatCell(row[column], column);
}
function inferEntity(row: OnboardingRow): "client" | "project" | "funnel" { if ("funnel_id" in row || "funnel_code" in row) return "funnel"; if ("project_id" in row || "project_code" in row) return "project"; return "client"; }
function formatCell(value: string | number | boolean | null | undefined, column: string) { if (value === null || value === undefined || value === "") return "—"; if (column === "status") return formatStatus(asText(value)); if (column.endsWith("_at") || column.includes("date")) return formatDateTime(value); return String(value); }
function formatStatus(value: string) { return ({ active: "Активно", archived: "Архівовано", inactive: "Неактивно" } as Record<string, string>)[value] ?? value; }
function formatDateTime(value: string | number | boolean) { const date = new Date(String(value)); if (Number.isNaN(date.getTime())) return String(value); return new Intl.DateTimeFormat("uk-UA", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date); }
function rowKey(row: OnboardingRow, columns: string[], index: number) { return `${asText(row.client_id ?? row.project_id ?? row.funnel_id ?? row.id ?? row.client_code ?? row.project_code ?? row.funnel_code ?? row.name ?? columns.map((column) => row[column]).join("-")) || "row"}-${index}`; }
function fieldNames(rows: OnboardingRow[]) { return Array.from(rows.reduce((fields, row) => { Object.keys(row).forEach((field) => fields.add(field)); return fields; }, new Set<string>())).sort(); }
function formatFieldList(fields: string[]) { return fields.length ? fields.join(", ") : "немає даних"; }
function isActive(row: OnboardingRow) { const status = asText(row.status); return !status || status === "active"; }
function rowsWithoutReference(rows: OnboardingRow[], key: string, nameKey: string) { return rows.filter((row) => !asText(row[key]) && !asText(row[nameKey])).length; }
function metricFromHealth(rows: OnboardingRow[], keys: string[]) { for (const row of rows) for (const key of keys) { const value = row[key]; if (typeof value === "number") return value; const parsed = Number(value); if (value !== null && value !== undefined && value !== "" && Number.isFinite(parsed)) return parsed; } return null; }
function textFromHealth(rows: OnboardingRow[], keys: string[]) { for (const row of rows) for (const key of keys) { const value = asText(row[key]); if (value) return value; } return ""; }
function formatHealthStatus(value: string) { return ({ healthy: "Все гаразд", needs_onboarding: "Потрібен онбординг", setup_required: "Потрібне налаштування", warning: "Потрібна увага", error: "Помилка" } as Record<string, string>)[value] ?? (value || "Все гаразд"); }

type StrictMatch = { scope: string; value: string };

type CountMap = Map<string, Set<string>>;

function safeClientMatches(row: OnboardingRow): StrictMatch[] {
  return uniqueMatches([
    matchFromValue("client_id", row.client_id),
    matchFromValue("client_id", row.id),
    matchFromValue("client_code", row.client_code),
    matchFromValue("client_name", row.client_name),
    matchFromValue("client_name", asText(row.name)),
  ]);
}
function safeClientReferenceMatches(row: OnboardingRow): StrictMatch[] {
  return uniqueMatches([
    matchFromValue("client_id", row.client_id),
    matchFromValue("client_code", row.client_code),
    matchFromValue("client_name", row.client_name),
  ]);
}
function safeProjectMatches(row: OnboardingRow): StrictMatch[] {
  return uniqueMatches([
    matchFromValue("project_id", row.project_id),
    matchFromValue("project_id", row.id),
    matchFromValue("project_code", row.project_code),
    matchFromValue("project_name", row.project_name),
    matchFromValue("project_name", asText(row.name)),
  ]);
}
function safeProjectReferenceMatches(row: OnboardingRow): StrictMatch[] {
  return uniqueMatches([
    matchFromValue("project_id", row.project_id),
    matchFromValue("project_code", row.project_code),
    matchFromValue("project_name", row.project_name),
  ]);
}
function matchFromValue(scope: string, value: string | number | boolean | null | undefined): StrictMatch | null {
  const text = asText(value);
  return text ? { scope, value: text } : null;
}
function uniqueMatches(matches: (StrictMatch | null)[]) {
  const seen = new Set<string>();
  return matches.filter((match): match is StrictMatch => {
    const key = countKey(match);
    if (!key || seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}
function countKey(match: StrictMatch | null) { return match ? `${match.scope}:${match.value}` : ""; }
function countForStrictMatches(counts: CountMap, matches: StrictMatch[]) {
  for (const match of matches) {
    const count = counts.get(countKey(match))?.size;
    if (count !== undefined) return count;
  }
  return 0;
}
function addStrictCount(counts: CountMap, matches: StrictMatch[], childKey: string) {
  if (!childKey || matches.length === 0) return;
  for (const match of matches) {
    const key = countKey(match);
    if (!key) continue;
    if (!counts.has(key)) counts.set(key, new Set());
    counts.get(key)?.add(childKey);
  }
}
function addStrictFallbackCount(counts: CountMap, primaryScopes: Set<string>, matches: StrictMatch[], childKey: string) {
  const fallbackMatches = matches.filter((match) => !primaryScopes.has(countKey(match)));
  addStrictCount(counts, fallbackMatches, childKey);
}
function projectKey(row: OnboardingRow) { return asText(row.project_id) || asText(row.id) || asText(row.project_code) || asText(row.project_name) || asText(row.name); }
function funnelKey(row: OnboardingRow) { return asText(row.funnel_id) || asText(row.id) || asText(row.funnel_code) || asText(row.funnel_name) || asText(row.name); }
function buildProjectCountByClient(projects: OnboardingRow[], hierarchyRows: OnboardingRow[]) {
  const counts: CountMap = new Map();
  projects.filter(isActive).forEach((project) => addStrictCount(counts, safeClientReferenceMatches(project), projectKey(project)));
  const primaryScopes = new Set(counts.keys());
  hierarchyRows.filter((row) => isActive(row) && hasProjectReference(row)).forEach((row) => addStrictFallbackCount(counts, primaryScopes, safeClientReferenceMatches(row), projectKey(row)));
  return counts;
}
function buildFunnelCountByProject(funnels: OnboardingRow[], hierarchyRows: OnboardingRow[]) {
  const counts: CountMap = new Map();
  funnels.filter(isActive).forEach((funnel) => addStrictCount(counts, safeProjectReferenceMatches(funnel), funnelKey(funnel)));
  const primaryScopes = new Set(counts.keys());
  hierarchyRows.filter((row) => isActive(row) && hasFunnelReference(row)).forEach((row) => addStrictFallbackCount(counts, primaryScopes, safeProjectReferenceMatches(row), funnelKey(row)));
  return counts;
}

function isUnnamedHierarchy(row: OnboardingRow, entity: "client" | "project" | "funnel") { return !asText(row[`${entity}_name`] ?? (entity === "client" ? row.name : undefined)); }
function buildUnnamedHierarchySummary(rows: OnboardingRow[]) {
  const clientRows = rows.filter((row) => isUnnamedHierarchy(row, "client"));
  const projectRows = rows.filter((row) => hasProjectReference(row) && isUnnamedHierarchy(row, "project"));
  const funnelRows = rows.filter((row) => hasFunnelReference(row) && isUnnamedHierarchy(row, "funnel"));
  const parts = [clientRows.length ? `клієнти — ${clientRows.length}` : "", projectRows.length ? `проєкти — ${projectRows.length}` : "", funnelRows.length ? `воронки — ${funnelRows.length}` : ""].filter(Boolean);
  const detailRows = [...clientRows.map((row) => ({ entity: "client", row })), ...projectRows.map((row) => ({ entity: "project", row })), ...funnelRows.map((row) => ({ entity: "funnel", row }))];
  return { clients: clientRows.length, projects: projectRows.length, funnels: funnelRows.length, hasUnnamed: parts.length > 0, message: parts.length ? `Є записи без назви: ${parts.join(", ")}.` : "", rows: detailRows };
}
function UnnamedRowsDetails({ rows }: { rows: { entity: string; row: OnboardingRow }[] }) {
  if (rows.length === 0) return <p>Записів без назви немає.</p>;
  return <div className="space-y-2">{rows.map(({ entity, row }, index) => <div key={`${entity}-${index}`} className="break-words"><p>Тип: {entity}</p><p>client_id: {asText(row.client_id) || "—"}; project_id: {asText(row.project_id) || "—"}; funnel_id: {asText(row.funnel_id) || "—"}</p><p>client_code: {asText(row.client_code) || "—"}; project_code: {asText(row.project_code) || "—"}; funnel_code: {asText(row.funnel_code) || "—"}</p><p>raw names: client_name={asText(row.client_name ?? row.name) || "—"}; project_name={asText(row.project_name) || "—"}; funnel_name={asText(row.funnel_name) || "—"}</p></div>)}</div>;
}

function buildHealthDiagnostics(healthRows: OnboardingRow[], clients: OnboardingRow[], projects: OnboardingRow[], funnels: OnboardingRow[], unnamed: ReturnType<typeof buildUnnamedHierarchySummary>) {
  const backend = {
    activeClients: metricFromHealth(healthRows, ["active_clients", "clients_active", "client_count", "clients_count"]),
    activeProjects: metricFromHealth(healthRows, ["active_projects", "projects_active", "project_count", "projects_count"]),
    activeFunnels: metricFromHealth(healthRows, ["active_funnels", "funnels_active", "funnel_count", "funnels_count"]),
  };
  const visible = { activeClients: clients.filter(isActive).length, activeProjects: projects.filter(isActive).length, activeFunnels: funnels.filter(isActive).length };
  const projectsWithoutClient = rowsWithoutReference(projects, "client_id", "client_name");
  const funnelsWithoutProject = rowsWithoutReference(funnels, "project_id", "project_name");
  const messages: string[] = [];
  if (unnamed.hasUnnamed) messages.push(`${unnamed.message} Перевірте записи без назви або backend view.`);
  if (backend.activeClients !== null && backend.activeClients !== visible.activeClients) messages.push(`Є розбіжність у даних: Health показує активних клієнтів — ${backend.activeClients}, список клієнтів — ${visible.activeClients}. Перевірте записи без назви або backend view.`);
  if (backend.activeProjects !== null && backend.activeProjects !== visible.activeProjects) messages.push(`Є розбіжність у даних: Health показує активних проєктів — ${backend.activeProjects}, список проєктів — ${visible.activeProjects}. Перевірте записи без назви або backend view.`);
  if (backend.activeFunnels !== null && backend.activeFunnels !== visible.activeFunnels) messages.push(`Є розбіжність у даних: Health показує активних воронок — ${backend.activeFunnels}, список воронок — ${visible.activeFunnels}. Перевірте записи без назви або backend view.`);
  if (projectsWithoutClient) messages.push(`Є проєкти без клієнта — ${projectsWithoutClient}. Перевірте привʼязку або backend view.`);
  if (funnelsWithoutProject) messages.push(`Є воронки без проєкту — ${funnelsWithoutProject}. Перевірте привʼязку або backend view.`);
  return { backend, visible, projectsWithoutClient, funnelsWithoutProject, messages, hasWarnings: messages.length > 0 };
}

function buildHealthCards(healthRows: OnboardingRow[], clients: OnboardingRow[], projects: OnboardingRow[], funnels: OnboardingRow[], forceWarning: boolean) {
  const activeClients = metricFromHealth(healthRows, ["active_clients", "clients_active", "client_count", "clients_count"]) ?? clients.filter(isActive).length;
  const activeProjects = metricFromHealth(healthRows, ["active_projects", "projects_active", "project_count", "projects_count"]) ?? projects.filter(isActive).length;
  const activeFunnels = metricFromHealth(healthRows, ["active_funnels", "funnels_active", "funnel_count", "funnels_count"]) ?? funnels.filter(isActive).length;
  const projectsWithoutClient = metricFromHealth(healthRows, ["projects_without_client", "orphan_projects"]) ?? rowsWithoutReference(projects, "client_id", "client_name");
  const funnelsWithoutProject = metricFromHealth(healthRows, ["funnels_without_project", "orphan_funnels"]) ?? rowsWithoutReference(funnels, "project_id", "project_name");
  const backendStatus = textFromHealth(healthRows, ["status", "health_status", "onboarding_status"]);
  const onboardingStatus = forceWarning || projectsWithoutClient || funnelsWithoutProject ? "Потрібна увага" : formatHealthStatus(backendStatus);
  return [
    { title: "Активні клієнти", value: activeClients },
    { title: "Активні проєкти", value: activeProjects },
    { title: "Активні воронки", value: activeFunnels },
    { title: "Проєкти без клієнта", value: projectsWithoutClient, description: projectsWithoutClient ? "Перевірте привʼязку до клієнта." : "Критичних розривів не знайдено." },
    { title: "Воронки без проєкту", value: funnelsWithoutProject, description: funnelsWithoutProject ? "Перевірте привʼязку до проєкту." : "Критичних розривів не знайдено." },
    { title: "Стан онбордингу", value: onboardingStatus, description: onboardingStatus === "Все гаразд" ? "Основні звʼязки виглядають коректно." : "Є записи, які варто перевірити." },
  ];
}
