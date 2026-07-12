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
import { useI18n } from "@/i18n/I18nProvider";
import type { Lang, TranslationKey } from "@/i18n/translations";

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
const UNNAMED_LABEL_KEYS = {
  client: "onboardingUnnamedClient",
  project: "onboardingUnnamedProject",
  funnel: "onboardingUnnamedFunnel",
} as const;

const PLACEHOLDER_PATTERNS = ["test agency", "test client", "northstar digital clinic", "evergreen growth program", "main webinar funnel", "placeholder", "demo", "mock", "test_upload", "backend_test"];
function isPlaceholderRow(row: OnboardingRow) { const text = Object.values(row).join(" ").toLowerCase(); return PLACEHOLDER_PATTERNS.some((p) => text.includes(p)); }
function filterRows(rows: OnboardingRow[]) { return rows.filter((r) => !isPlaceholderRow(r)); }

const emptyClientForm: ClientForm = { client_id: "", name: "", code: "", status: "active" };
const emptyProjectForm: ProjectForm = { project_id: "", client_id: "", name: "", code: "", status: "active" };
const emptyFunnelForm: FunnelForm = { funnel_id: "", client_id: "", project_id: "", name: "", code: "", status: "active" };

const ADS_SUBNAV_TRIGGER_CLASS =
  "h-10 whitespace-nowrap rounded-lg border border-transparent px-4 text-sm font-semibold transition-all hover:border-primary/30 hover:bg-primary/10 hover:text-primary data-[state=active]:border-primary/40 data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:shadow-sm";

export default function Onboarding() {
  const { session } = useAuth();
  const { t, lang } = useI18n();
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
  const statusOptions = [
    { value: "active", label: t("onboardingStatusActive") },
    { value: "inactive", label: t("onboardingStatusInactive") },
    { value: "archived", label: t("onboardingStatusArchived") },
  ];

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
    const name = displayNameForEntity(row, "client", t);
    const code = asText(row.client_code);
    return value ? { value, label: code ? `${name} (${code})` : name, clientId: value, clientName: name, code } : null;
  }).filter(Boolean) as SelectOption[], [clients, t]);

  const clientNameById = useMemo(() => new Map(clientOptions.map((option) => [option.value, option.clientName ?? option.label])), [clientOptions]);
  const clientIdByName = useMemo(() => new Map(clientOptions.map((option) => [option.clientName ?? option.label, option.value])), [clientOptions]);
  const projectOptions = useMemo<SelectOption[]>(() => projects.map((row) => {
    const value = entityId(row, "project_id");
    const clientId = referenceId(row, "client_id");
    const clientName = asText(row.client_name) || clientNameById.get(clientId) || t(UNNAMED_LABEL_KEYS.client);
    const name = displayNameForEntity(row, "project", t);
    const code = asText(row.project_code);
    const label = `${clientName} → ${code ? `${name} (${code})` : name}`;
    return value ? { value, label, clientId, clientName, projectId: value, projectName: name, code } : null;
  }).filter(Boolean) as SelectOption[], [clientNameById, projects, t]);

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
      if (!data?.ok) throw new Error(t("onboardingClientUnexpectedResponseError"));
      return data;
    },
    onSuccess: async () => {
      toast({ title: t("onboardingClientSavedTitle"), description: t("onboardingClientSavedDescription") });
      resetClientForm();
      await refreshOnboarding();
    },
    onError: (error: Error) => {
      setClientError(error.message);
      toast({ title: t("onboardingClientSaveError"), description: error.message, variant: "destructive" });
    },
  });

  const projectMutation = useMutation({
    mutationFn: async (payload: { project_id?: string; client_id: string; name: string; code?: string; status?: string }) => {
      const { data, error } = await supabase.functions.invoke("onboarding-project-upsert", {
        body: { workspace_id: WORKSPACE_ID, ...payload },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(t("onboardingProjectUnexpectedResponseError"));
      return data;
    },
    onSuccess: async () => {
      toast({ title: t("onboardingProjectSavedTitle"), description: t("onboardingProjectSavedDescription") });
      resetProjectForm();
      await refreshOnboarding();
    },
    onError: (error: Error) => {
      setProjectError(error.message);
      toast({ title: t("onboardingProjectSaveError"), description: error.message, variant: "destructive" });
    },
  });

  const funnelMutation = useMutation({
    mutationFn: async (payload: { funnel_id?: string; project_id: string; name: string; code?: string; status?: string }) => {
      const { data, error } = await supabase.functions.invoke("onboarding-funnel-upsert", {
        body: { workspace_id: WORKSPACE_ID, ...payload },
      });
      if (error) throw error;
      if (!data?.ok) throw new Error(t("onboardingFunnelUnexpectedResponseError"));
      return data;
    },
    onSuccess: async () => {
      toast({ title: t("onboardingFunnelSavedTitle"), description: t("onboardingFunnelSavedDescription") });
      resetFunnelForm();
      await refreshOnboarding();
    },
    onError: (error: Error) => {
      setFunnelError(error.message);
      toast({ title: t("onboardingFunnelSaveError"), description: error.message, variant: "destructive" });
    },
  });

  const hierarchyRows = useMemo(() => filterRows(onboardingQuery.data?.hierarchy ?? []), [onboardingQuery.data?.hierarchy]);

  const groupedHierarchy = useMemo(() => {
    const byClient = new Map<string, HierarchySummary>();
    for (const row of hierarchyRows) {
      const clientName = hierarchyDisplayName(row, "client", t);
      const projectName = hierarchyDisplayName(row, "project", t);
      const funnelName = hasFunnelReference(row) ? hierarchyDisplayName(row, "funnel", t) : "";
      const clientKey = entityId(row, "client_id") || asText(row.client_code) || clientName;
      const projectKey = entityId(row, "project_id") || asText(row.project_code) || `${clientKey}-${projectName}`;

      if (!byClient.has(clientKey)) byClient.set(clientKey, { clientKey, clientName, projects: new Map() });
      const client = byClient.get(clientKey);
      if (!client) continue;
      if (!client.projects.has(projectKey)) client.projects.set(projectKey, { projectName, funnels: new Set() });
      if (funnelName) client.projects.get(projectKey)?.funnels.add(funnelName);
    }
    return Array.from(byClient.values());
  }, [hierarchyRows, t]);

  const unnamedHierarchySummary = useMemo(() => buildUnnamedHierarchySummary(hierarchyRows, t), [hierarchyRows, t]);

  const projectCountByClient = useMemo(() => buildProjectCountByClient(projects, hierarchyRows), [hierarchyRows, projects]);

  const funnelCountByProject = useMemo(() => buildFunnelCountByProject(funnels, hierarchyRows), [funnels, hierarchyRows]);

  const healthDiagnostics = useMemo(() => buildHealthDiagnostics(healthRows, clients, projects, funnels, unnamedHierarchySummary, t), [clients, funnels, healthRows, projects, unnamedHierarchySummary, t]);
  const healthCards = useMemo(() => buildHealthCards(healthRows, clients, projects, funnels, healthDiagnostics.hasWarnings, t), [clients, funnels, healthDiagnostics.hasWarnings, healthRows, projects, t]);
  const isRefreshing = onboardingQuery.isFetching;
  const refreshLabel = isRefreshing ? t("onboardingRefreshing") : t("refresh");

  const handleRefresh = async () => {
    await refreshOnboarding();
    setLastRefreshedAt(new Date());
  };

  const headerActions = session && !onboardingQuery.isLoading && !onboardingQuery.error ? <>
    {lastRefreshedAt ? <p className="text-xs text-muted-foreground">{t("onboardingUpdated")}: {formatDateTime(lastRefreshedAt.toISOString(), lang)}</p> : null}
    <Button type="button" size="sm" variant="outline" className="h-8 shrink-0 gap-1.5 text-xs" onClick={handleRefresh} disabled={isRefreshing}>
      <RefreshCw className={`h-3.5 w-3.5 ${isRefreshing ? "animate-spin" : ""}`} />
      {refreshLabel}
    </Button>
  </> : null;

  return <DashboardLayout title={t("onboardingTitle")} subtitle={t("onboardingSubtitle")} actions={headerActions} contentClassName="pt-1 lg:pt-2">
    <div className="space-y-4">
      {!session ? <SectionCard title={t("onboardingTitle")} description={t("onboardingLoginRequiredTitle")}><p className="text-sm text-muted-foreground">{t("onboardingLoginRequiredMessage")}</p></SectionCard>
        : onboardingQuery.isLoading ? <SectionCard title={t("onboardingTitle")} description={t("onboardingLoadingTitle")}><p className="text-sm text-muted-foreground">{t("onboardingLoadingMessage")}</p></SectionCard>
          : onboardingQuery.error ? <SectionCard title={t("onboardingTitle")} description={t("onboardingErrorTitle")}><p className="text-sm text-destructive">{t("onboardingLoadError")}</p><DeveloperDetails title={t("onboardingTechnicalDetails")}><p className="mt-2 break-words">{onboardingQuery.error.message}</p></DeveloperDetails></SectionCard>
            : <>
              {!roleLoading && roleError ? <NoticeBlock>{t("onboardingRoleUnavailable")}</NoticeBlock> : null}
              {!roleLoading && !canManageOnboarding ? <SectionCard title={t("onboardingAccessTitle")} description={t("onboardingAccessDescription")}><p className="text-sm text-muted-foreground">{t("onboardingNoManageAccess")}</p></SectionCard> : null}
              <Tabs defaultValue="overview" className="space-y-2">
              <div className="overflow-x-auto rounded-xl border border-border/70 bg-muted/30 px-2 py-2 shadow-sm">
                <TabsList className="inline-flex h-auto w-max min-w-full items-center justify-start gap-1.5 bg-transparent p-0 text-muted-foreground">
                  <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="overview">{t("onboardingTabStructure")}</TabsTrigger>
                  <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="clients">{t("onboardingTabClients")}</TabsTrigger>
                  <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="projects">{t("onboardingTabProjects")}</TabsTrigger>
                  <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="funnels">{t("onboardingTabFunnels")}</TabsTrigger>
                  <TabsTrigger className={ADS_SUBNAV_TRIGGER_CLASS} value="health">{t("onboardingTabHealth")}</TabsTrigger>
                </TabsList>
              </div>

              <TabsContent value="overview" className="mt-1"><SectionCard title={t("onboardingStructureTitle")} description={t("onboardingStructureDescription")}>
                {unnamedHierarchySummary.hasUnnamed ? <NoticeBlock>{unnamedHierarchySummary.message} {t("onboardingCheckSource")}</NoticeBlock> : null}
                {unnamedHierarchySummary.hasUnnamed ? <DeveloperDetails title={t("onboardingTechnicalDetails")}><UnnamedRowsDetails rows={unnamedHierarchySummary.rows} t={t} /></DeveloperDetails> : null}
                {groupedHierarchy.length === 0 ? <EmptyMessage>{t("onboardingStructureEmpty")}</EmptyMessage> : <div className="space-y-3">{groupedHierarchy.map((client) => <div key={client.clientKey} className="rounded-md border border-border/70 bg-card/60 p-3"><p className="text-sm font-semibold text-foreground"><DisplayName value={client.clientName} /></p><div className="mt-2 space-y-2">{Array.from(client.projects.entries()).map(([projectKey, project]) => <div key={`${client.clientKey}-${projectKey}`} className="rounded-md bg-muted/40 p-2"><p className="text-sm font-medium"><DisplayName value={project.projectName} /></p>{project.funnels.size === 0 ? <p className="mt-1 text-xs text-muted-foreground">{t("onboardingNoFunnelsYet")}</p> : <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">{Array.from(project.funnels).map((funnelName) => <li key={`${client.clientKey}-${projectKey}-${funnelName}`}><DisplayName value={funnelName} /></li>)}</ul>}</div>)}</div></div>)}</div>}
              </SectionCard></TabsContent>

              <TabsContent value="clients" className="mt-1"><SectionCard title={t("onboardingClientsTitle")} description={t("onboardingClientsDescription")}>
                <UpsertPanel title={t("onboardingClient")} editModeLabel={t("onboardingEditClient")} isEditing={Boolean(clientForm.client_id)} onCancel={resetClientForm} form={clientForm} setForm={setClientForm} isPending={clientMutation.isPending} error={clientError} signedIn={Boolean(session)} canSubmit={canEditOnboarding && Boolean(clientForm.name.trim())} disabled={!canEditOnboarding} submitLabel={clientForm.client_id ? t("onboardingSaveChanges") : t("onboardingCreateClient")} pendingLabel={t("onboardingSavingClient")} statusOptions={statusOptions} t={t} onSubmit={() => {
                  if (!clientForm.name.trim()) return setClientError(t("onboardingNameRequiredClient"));
                  setClientError("");
                  clientMutation.mutate({ client_id: clientForm.client_id || undefined, name: clientForm.name.trim(), code: clientForm.code || undefined, status: clientForm.status || undefined });
                }}>
                  <DeveloperDetails title={t("onboardingTechnicalDetails")}><p>{t("onboardingClientId")}: {clientForm.client_id || t("onboardingAutoCreated")}</p></DeveloperDetails>
                </UpsertPanel>
                <EntityTable rows={clients} columns={["name", "client_code", "status", "created_at", "updated_at"]} countColumnTitle={t("onboardingProjectsCount")} countForRow={(row) => countForStrictMatches(projectCountByClient, safeClientMatches(row))} emptyText={t("onboardingRecordsEmpty")} canEdit={canEditOnboarding} canEditRow={(row) => Boolean(entityId(row, "client_id"))} t={t} lang={lang} onEdit={(row) => setClientForm({ client_id: entityId(row, "client_id"), name: preferredName(row, "client"), code: asText(row.client_code), status: asText(row.status) || "active" })} />
              </SectionCard></TabsContent>

              <TabsContent value="projects" className="mt-1"><SectionCard title={t("onboardingProjectsTitle")} description={t("onboardingProjectsDescription")}>
                <UpsertPanel title={t("onboardingProject")} compact fieldsBeforeInputs editModeLabel={t("onboardingEditProject")} isEditing={Boolean(projectForm.project_id)} onCancel={resetProjectForm} form={projectForm} setForm={setProjectForm} isPending={projectMutation.isPending} error={projectError} signedIn={Boolean(session)} canSubmit={canEditOnboarding && Boolean(projectForm.name.trim() && projectForm.client_id.trim())} disabled={!canEditOnboarding || clientsMissingClientId || !projectForm.client_id.trim()} submitLabel={projectForm.project_id ? t("onboardingSaveChanges") : t("onboardingCreateProject")} helperText={!projectForm.client_id.trim() ? t("onboardingChooseClientFirst") : undefined} pendingLabel={t("onboardingSavingProject")} details={ <DeveloperDetails title={t("onboardingTechnicalDetails")}><p>{t("onboardingProjectId")}: {projectForm.project_id || t("onboardingAutoCreated")}</p><p>{t("onboardingClientId")}: {projectForm.client_id || t("onboardingNotSelected")}</p>{clientsMissingClientId ? <p>{t("onboardingClientIdMissing")}</p> : null}</DeveloperDetails> } statusOptions={statusOptions} t={t} onSubmit={() => {
                  if (!projectForm.client_id.trim()) return setProjectError(t("onboardingChooseClientError"));
                  if (!projectForm.name.trim()) return setProjectError(t("onboardingNameRequiredProject"));
                  setProjectError("");
                  projectMutation.mutate({ project_id: projectForm.project_id || undefined, client_id: projectForm.client_id.trim(), name: projectForm.name.trim(), code: projectForm.code || undefined, status: projectForm.status || undefined });
                }}>
                  <SelectField disabled={!canEditOnboarding || projectMutation.isPending || clientsMissingClientId || Boolean(projectForm.project_id)} label={t("onboardingClient")} placeholder={t("onboardingSelectClient")} value={projectForm.client_id} options={clientOptions} emptyText={t("onboardingClientsEmptyCreateFirst")} onChange={(value) => setProjectForm((current) => ({ ...current, client_id: value }))} />
                </UpsertPanel>
                <EntityTable rows={projects} columns={["name", "client_name", "project_code", "status"]} countColumnTitle={t("onboardingFunnelsCount")} countForRow={(row) => countForStrictMatches(funnelCountByProject, safeProjectMatches(row))} emptyText={t("onboardingRecordsEmpty")} canEdit={canEditOnboarding} canEditRow={(row) => Boolean(entityId(row, "project_id"))} t={t} lang={lang} onEdit={(row) => setProjectForm({ project_id: entityId(row, "project_id"), client_id: referenceId(row, "client_id") || clientIdByName.get(asText(row.client_name)) || "", name: preferredName(row, "project"), code: asText(row.project_code), status: asText(row.status) || "active" })} />
              </SectionCard></TabsContent>

              <TabsContent value="funnels" className="mt-1"><SectionCard title={t("onboardingFunnelsTitle")} description={t("onboardingFunnelsDescription")}>
                <UpsertPanel title={t("onboardingFunnel")} compact fieldsBeforeInputs editModeLabel={t("onboardingEditFunnel")} isEditing={Boolean(funnelForm.funnel_id)} onCancel={resetFunnelForm} form={funnelForm} setForm={setFunnelForm} isPending={funnelMutation.isPending} error={funnelError} signedIn={Boolean(session)} canSubmit={canEditOnboarding && Boolean(funnelForm.name.trim() && funnelForm.project_id.trim())} disabled={!canEditOnboarding || projectsMissingProjectId || !funnelForm.project_id.trim()} submitLabel={funnelForm.funnel_id ? t("onboardingSaveChanges") : t("onboardingCreateFunnel")} helperText={!funnelForm.project_id.trim() ? t("onboardingChooseProjectFirst") : undefined} pendingLabel={t("onboardingSavingFunnel")} details={ <DeveloperDetails title={t("onboardingTechnicalDetails")}><p>{t("onboardingFunnelId")}: {funnelForm.funnel_id || t("onboardingAutoCreated")}</p><p>{t("onboardingProjectId")}: {funnelForm.project_id || t("onboardingNotSelected")}</p>{projectsMissingProjectId ? <p>{t("onboardingProjectIdMissing")}</p> : null}</DeveloperDetails> } statusOptions={statusOptions} t={t} onSubmit={() => {
                  if (!funnelForm.project_id.trim()) return setFunnelError(t("onboardingChooseProjectError"));
                  if (!funnelForm.name.trim()) return setFunnelError(t("onboardingNameRequiredFunnel"));
                  setFunnelError("");
                  funnelMutation.mutate({ funnel_id: funnelForm.funnel_id || undefined, project_id: funnelForm.project_id.trim(), name: funnelForm.name.trim(), code: funnelForm.code || undefined, status: funnelForm.status || undefined });
                }}>
                  <SelectField disabled={!canEditOnboarding || funnelMutation.isPending || Boolean(funnelForm.funnel_id)} label={t("onboardingClient")} placeholder={t("onboardingAllClients")} value={funnelForm.client_id || "all"} emptyText={t("onboardingClientsEmptyCreateFirst")} options={clientOptions.length ? [{ value: "all", label: t("onboardingAllClients") }, ...clientOptions] : []} onChange={(value) => setFunnelForm((current) => ({ ...current, client_id: value === "all" ? "" : value, project_id: "" }))} />
                  <SelectField disabled={!canEditOnboarding || funnelMutation.isPending || projectsMissingProjectId || Boolean(funnelForm.funnel_id)} label={t("onboardingProject")} placeholder={t("onboardingSelectProject")} value={funnelForm.project_id} options={filteredProjectOptions} onChange={(value) => setFunnelForm((current) => ({ ...current, project_id: value }))} emptyText={funnelForm.client_id ? t("onboardingClientProjectsEmpty") : t("onboardingProjectsEmptyCreateFirst")} />
                </UpsertPanel>
                <EntityTable rows={funnels} columns={["name", "client_name", "project_name", "funnel_code", "status"]} emptyText={t("onboardingRecordsEmpty")} canEdit={canEditOnboarding} canEditRow={(row) => Boolean(entityId(row, "funnel_id"))} t={t} lang={lang} onEdit={(row) => {
                  const projectId = referenceId(row, "project_id") || projectIdByName.get(asText(row.project_name)) || "";
                  const projectOption = projectOptions.find((option) => option.value === projectId);
                  setFunnelForm({ funnel_id: entityId(row, "funnel_id"), client_id: projectOption?.clientId ?? (referenceId(row, "client_id") || clientIdByName.get(asText(row.client_name)) || ""), project_id: projectId, name: preferredName(row, "funnel"), code: asText(row.funnel_code), status: asText(row.status) || "active" });
                }} />
              </SectionCard></TabsContent>

              <TabsContent value="health" className="mt-1"><SectionCard title={t("onboardingHealthTitle")} description={t("onboardingHealthDescription")}>
                {healthDiagnostics.messages.length ? <NoticeBlock>{healthDiagnostics.messages.join(" ")}</NoticeBlock> : null}
                {healthRows.length === 0 && clients.length === 0 && projects.length === 0 && funnels.length === 0 ? <EmptyMessage>{t("onboardingHealthEmpty")}</EmptyMessage> : <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">{healthCards.map((card) => <div key={card.title} className="rounded-md border border-border/70 bg-card/60 p-4"><p className="text-sm text-muted-foreground">{card.title}</p><p className="mt-2 text-2xl font-semibold text-foreground">{card.value}</p>{card.description ? <p className="mt-1 text-xs text-muted-foreground">{card.description}</p> : null}</div>)}</div>}
                <DeveloperDetails title={t("onboardingTechnicalDetails")}><p>workspace_id: {WORKSPACE_ID}</p><p>{t("onboardingVisibleCounts")}: {healthDiagnostics.visible.activeClients} / {healthDiagnostics.visible.activeProjects} / {healthDiagnostics.visible.activeFunnels}</p><p>{t("onboardingHealthCounts")}: {healthDiagnostics.backend.activeClients ?? t("onboardingNoData")} / {healthDiagnostics.backend.activeProjects ?? t("onboardingNoData")} / {healthDiagnostics.backend.activeFunnels ?? t("onboardingNoData")}</p><p>{t("onboardingFieldsClients")}: {formatFieldList(dataShapeDiagnostics.clients, t)}</p><p>{t("onboardingFieldsProjects")}: {formatFieldList(dataShapeDiagnostics.projects, t)}</p><p>{t("onboardingFieldsFunnels")}: {formatFieldList(dataShapeDiagnostics.funnels, t)}</p><p>{t("onboardingFieldsHierarchy")}: {formatFieldList(dataShapeDiagnostics.hierarchy, t)}</p><p>{t("onboardingFieldsHealth")}: {formatFieldList(dataShapeDiagnostics.health, t)}</p><p>{t("onboardingFallbackNote")}</p><GenericTable rows={healthRows} emptyText={t("onboardingTechnicalDataEmpty")} t={t} lang={lang} /></DeveloperDetails>
              </SectionCard></TabsContent>
            </Tabs></>}
    </div>
  </DashboardLayout>;
}

function UpsertPanel<T extends { name: string; code: string; status: string }>({ title, editModeLabel, isEditing, onCancel, form, setForm, isPending, error, signedIn, canSubmit, disabled, submitLabel, pendingLabel, helperText, onSubmit, children, fieldsBeforeInputs = false, details, compact = false, statusOptions, t }: { title: string; editModeLabel: string; isEditing: boolean; onCancel: () => void; form: T; setForm: React.Dispatch<React.SetStateAction<T>>; isPending: boolean; error: string; signedIn: boolean; canSubmit: boolean; disabled?: boolean; submitLabel: string; pendingLabel: string; helperText?: string; onSubmit: () => void; children?: React.ReactNode; fieldsBeforeInputs?: boolean; details?: React.ReactNode; compact?: boolean; statusOptions: SelectOption[]; t: (key: TranslationKey) => string; }) {
  const labels = formLabels(title, t);
  const inputs = <>
    <FormInputField disabled={disabled || isPending} label={labels.name} value={form.name} onChange={(value) => setForm((current: T) => ({ ...current, name: value }))} />
    <FormInputField disabled={disabled || isPending} label={labels.code} value={form.code} onChange={(value) => setForm((current: T) => ({ ...current, code: value }))} />
    <SelectField disabled={disabled || isPending} label={t("onboardingStatusLabel")} placeholder={t("onboardingChooseStatus")} value={form.status || "active"} options={statusOptions} onChange={(value) => setForm((current: T) => ({ ...current, status: value }))} />
  </>;
  return <div className={`${compact ? "mb-3 p-2.5" : "mb-4 p-3"} rounded-md border border-border/70 bg-muted/20`}>
    <div className={`${compact ? "mb-2" : "mb-3"} flex min-h-8 flex-wrap items-center justify-between gap-2`}>
      <p className="text-xs text-muted-foreground">{isEditing ? editModeLabel : createModeLabel(title)}</p>
      <div className="shrink-0">
        <Button
          type="button"
          size="sm"
          variant="outline"
          className={isEditing ? undefined : "invisible pointer-events-none"}
          aria-hidden={!isEditing}
          tabIndex={isEditing ? 0 : -1}
          onClick={onCancel}
        >
          {t("onboardingCancel")}
        </Button>
      </div>
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

function SelectField({ label, placeholder, value, options, onChange, emptyText, disabled = false }: { label: string; placeholder: string; value: string; options: SelectOption[]; onChange: (value: string) => void; emptyText?: string; disabled?: boolean }) {
  const resolvedEmptyText = emptyText ?? "—";
  return <div className="space-y-1"><span className="text-xs font-medium text-muted-foreground">{label}</span><Select value={value} onValueChange={onChange} disabled={disabled || options.length === 0}><SelectTrigger className="h-10" aria-label={label}><SelectValue placeholder={placeholder} /></SelectTrigger><SelectContent>{options.length === 0 ? <SelectItem value="__empty" disabled>{resolvedEmptyText}</SelectItem> : options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent></Select></div>;
}

function EntityTable({ rows, columns, countColumnTitle, countForRow, emptyText, onEdit, canEdit = true, canEditRow, t, lang }: { rows: OnboardingRow[]; columns: string[]; countColumnTitle?: string; countForRow?: (row: OnboardingRow) => number; emptyText: string; onEdit?: (row: OnboardingRow) => void; canEdit?: boolean; canEditRow?: (row: OnboardingRow) => boolean; t: (key: TranslationKey) => string; lang: Lang; }) {
  if (rows.length === 0) return <EmptyMessage>{emptyText}</EmptyMessage>;
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border/70 text-muted-foreground">{columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{columnLabel(column, t)}</th>)}{countColumnTitle ? <th className="w-24 px-2 py-2 text-center font-medium">{countColumnTitle}</th> : null}{onEdit ? <th className="w-28 px-2 py-2 text-center font-medium">{t("onboardingActions")}</th> : null}</tr></thead><tbody>{rows.map((row, index) => <tr key={rowKey(row, columns, index)} className="border-b border-border/40 last:border-0">{columns.map((column) => <td key={`${index}-${column}`} className="px-2 py-2 text-foreground">{formatDisplayCell(row, column, t, lang)}</td>)}{countColumnTitle ? <td className="w-24 px-2 py-2 text-center tabular-nums text-foreground">{countForRow ? countForRow(row) : "—"}</td> : null}{onEdit ? <td className="w-28 whitespace-nowrap px-2 py-2 text-center"><Button type="button" size="sm" variant="ghost" className="h-8 px-2 text-xs" disabled={!canEdit || (canEditRow ? !canEditRow(row) : false)} onClick={() => onEdit(row)}>{t("onboardingEdit")}</Button></td> : null}</tr>)}</tbody></table></div>;
}

function columnLabel(column: string, t: (key: TranslationKey) => string) {
  return ({
    name: t("onboardingName"),
    client_code: t("onboardingClientCode"),
    status: t("onboardingStatusLabel"),
    created_at: t("onboardingCreatedAt"),
    updated_at: t("onboardingUpdatedAt"),
    client_name: t("onboardingClient"),
    project_code: t("onboardingProjectCode"),
    project_name: t("onboardingProject"),
    funnel_code: t("onboardingFunnelCode"),
  } as Record<string, string>)[column] ?? column;
}

function GenericTable({ rows, emptyText, t, lang }: { rows: OnboardingRow[]; emptyText: string; t: (key: TranslationKey) => string; lang: Lang }) { if (rows.length === 0) return <EmptyMessage>{emptyText}</EmptyMessage>; const columns = Object.keys(rows[0] ?? {}); if (columns.length === 0) return <EmptyMessage>{t("onboardingNoDisplayFields")}</EmptyMessage>; return <EntityTable rows={rows} columns={columns} emptyText={emptyText} t={t} lang={lang} />; }
function EmptyMessage({ children }: { children: React.ReactNode }) { return <p className="text-sm text-muted-foreground">{children}</p>; }
function NoticeBlock({ children }: { children: React.ReactNode }) { return <div className="mb-3 rounded-md border border-amber-200/70 bg-amber-50/80 p-3 text-sm text-amber-900 dark:border-amber-900/40 dark:bg-amber-950/20 dark:text-amber-200">{children}</div>; }
function DisplayName({ value }: { value: string }) { return value.includes("без назви") || value.includes("Unnamed") ? <span className="rounded-full border border-border/70 bg-muted/40 px-1.5 py-0.5 text-xs font-normal italic text-muted-foreground">{value}</span> : <>{value}</>; }
function createModeLabel(title: string) { return title; }
function formLabels(title: string, t: (key: TranslationKey) => string) {
  if (title === t("onboardingClient")) return { name: t("onboardingClientName"), code: `${t("onboardingClientCode")} (${t("onboardingOptionalCode")})` };
  if (title === t("onboardingProject")) return { name: t("onboardingProjectName"), code: `${t("onboardingProjectCode")} (${t("onboardingOptionalCode")})` };
  return { name: t("onboardingFunnelName"), code: `${t("onboardingFunnelCode")} (${t("onboardingOptionalCode")})` };
}
function asText(value: string | number | boolean | null | undefined) { if (value === null || value === undefined) return ""; return String(value).trim(); }
function entityId(row: OnboardingRow, preferredKey: "client_id" | "project_id" | "funnel_id") { return asText(row[preferredKey]) || asText(row.id); }
function referenceId(row: OnboardingRow, key: string) { return asText(row[key]); }
function preferredName(row: OnboardingRow, entity: "client" | "project" | "funnel") { return asText(row.name ?? row[`${entity}_name`] ?? row[`${entity}_code`]); }
function displayNameForEntity(row: OnboardingRow, entity: "client" | "project" | "funnel", t: (key: TranslationKey) => string) { return preferredName(row, entity) || t(UNNAMED_LABEL_KEYS[entity]); }
function hierarchyDisplayName(row: OnboardingRow, entity: "client" | "project" | "funnel", t: (key: TranslationKey) => string) { return asText(row[`${entity}_name`] ?? (entity === "client" ? row.name : undefined) ?? row[`${entity}_code`]) || t(UNNAMED_LABEL_KEYS[entity]); }
function hasFunnelReference(row: OnboardingRow) { return ["funnel_id", "funnel_name", "funnel_code"].some((key) => key in row && asText(row[key]) !== ""); }
function hasProjectReference(row: OnboardingRow) { return ["project_id", "project_name", "project_code"].some((key) => key in row && asText(row[key]) !== ""); }
function formatDisplayCell(row: OnboardingRow, column: string, t: (key: TranslationKey) => string, lang: Lang) {
  if (column === "name") return <DisplayName value={displayNameForEntity(row, inferEntity(row), t)} />;
  return formatCell(row[column], column, t, lang);
}
function inferEntity(row: OnboardingRow): "client" | "project" | "funnel" { if ("funnel_id" in row || "funnel_code" in row) return "funnel"; if ("project_id" in row || "project_code" in row) return "project"; return "client"; }
function formatCell(value: string | number | boolean | null | undefined, column: string, t: (key: TranslationKey) => string, lang: Lang) { if (value === null || value === undefined || value === "") return "—"; if (column === "status") return formatStatus(asText(value), t); if (column.endsWith("_at") || column.includes("date")) return formatDateTime(value, lang); return String(value); }
function formatStatus(value: string, t: (key: TranslationKey) => string) { return ({ active: t("onboardingStatusActive"), archived: t("onboardingStatusArchived"), inactive: t("onboardingStatusInactive") } as Record<string, string>)[value] ?? value; }
function formatDateTime(value: string | number | boolean, lang: Lang = "uk") { const date = new Date(String(value)); if (Number.isNaN(date.getTime())) return String(value); return new Intl.DateTimeFormat(lang === "uk" ? "uk-UA" : "en-US", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" }).format(date); }
function rowKey(row: OnboardingRow, columns: string[], index: number) { return `${asText(row.client_id ?? row.project_id ?? row.funnel_id ?? row.id ?? row.client_code ?? row.project_code ?? row.funnel_code ?? row.name ?? columns.map((column) => row[column]).join("-")) || "row"}-${index}`; }
function fieldNames(rows: OnboardingRow[]) { return Array.from(rows.reduce((fields, row) => { Object.keys(row).forEach((field) => fields.add(field)); return fields; }, new Set<string>())).sort(); }
function formatFieldList(fields: string[], t: (key: TranslationKey) => string) { return fields.length ? fields.join(", ") : t("onboardingNoData"); }
function isActive(row: OnboardingRow) { const status = asText(row.status); return !status || status === "active"; }
function rowsWithoutReference(rows: OnboardingRow[], key: string, nameKey: string) { return rows.filter((row) => !asText(row[key]) && !asText(row[nameKey])).length; }
function metricFromHealth(rows: OnboardingRow[], keys: string[]) { for (const row of rows) for (const key of keys) { const value = row[key]; if (typeof value === "number") return value; const parsed = Number(value); if (value !== null && value !== undefined && value !== "" && Number.isFinite(parsed)) return parsed; } return null; }
function textFromHealth(rows: OnboardingRow[], keys: string[]) { for (const row of rows) for (const key of keys) { const value = asText(row[key]); if (value) return value; } return ""; }
function formatHealthStatus(value: string, t: (key: TranslationKey) => string) { return ({ healthy: t("onboardingHealthOk"), needs_onboarding: t("onboardingHealthNeedsOnboarding"), setup_required: t("onboardingHealthSetupRequired"), warning: t("onboardingHealthNeedsAttention"), error: t("onboardingHealthError") } as Record<string, string>)[value] ?? (value || t("onboardingHealthOk")); }

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
function buildUnnamedHierarchySummary(rows: OnboardingRow[], t: (key: TranslationKey) => string) {
  const clientRows = rows.filter((row) => isUnnamedHierarchy(row, "client"));
  const projectRows = rows.filter((row) => hasProjectReference(row) && isUnnamedHierarchy(row, "project"));
  const funnelRows = rows.filter((row) => hasFunnelReference(row) && isUnnamedHierarchy(row, "funnel"));
  const parts = [clientRows.length ? `${t("onboardingClientsLower")} — ${clientRows.length}` : "", projectRows.length ? `${t("onboardingProjectsLower")} — ${projectRows.length}` : "", funnelRows.length ? `${t("onboardingFunnelsLower")} — ${funnelRows.length}` : ""].filter(Boolean);
  const detailRows = [...clientRows.map((row) => ({ entity: "client", row })), ...projectRows.map((row) => ({ entity: "project", row })), ...funnelRows.map((row) => ({ entity: "funnel", row }))];
  return { clients: clientRows.length, projects: projectRows.length, funnels: funnelRows.length, hasUnnamed: parts.length > 0, message: parts.length ? `${t("onboardingUnnamedWarningPrefix")}: ${parts.join(", ")}.` : "", rows: detailRows };
}
function UnnamedRowsDetails({ rows, t }: { rows: { entity: string; row: OnboardingRow }[]; t: (key: TranslationKey) => string }) {
  if (rows.length === 0) return <p>{t("onboardingUnnamedRecordsEmpty")}</p>;
  return <div className="space-y-2">{rows.map(({ entity, row }, index) => <div key={`${entity}-${index}`} className="break-words"><p>{t("onboardingDetailType")}: {entity}</p><p>client_id: {asText(row.client_id) || "—"}; project_id: {asText(row.project_id) || "—"}; funnel_id: {asText(row.funnel_id) || "—"}</p><p>client_code: {asText(row.client_code) || "—"}; project_code: {asText(row.project_code) || "—"}; funnel_code: {asText(row.funnel_code) || "—"}</p><p>{t("onboardingRawNames")}: client_name={asText(row.client_name ?? row.name) || "—"}; project_name={asText(row.project_name) || "—"}; funnel_name={asText(row.funnel_name) || "—"}</p></div>)}</div>;
}

function buildHealthDiagnostics(healthRows: OnboardingRow[], clients: OnboardingRow[], projects: OnboardingRow[], funnels: OnboardingRow[], unnamed: ReturnType<typeof buildUnnamedHierarchySummary>, t: (key: TranslationKey) => string) {
  const backend = {
    activeClients: metricFromHealth(healthRows, ["active_clients", "clients_active", "client_count", "clients_count"]),
    activeProjects: metricFromHealth(healthRows, ["active_projects", "projects_active", "project_count", "projects_count"]),
    activeFunnels: metricFromHealth(healthRows, ["active_funnels", "funnels_active", "funnel_count", "funnels_count"]),
  };
  const visible = { activeClients: clients.filter(isActive).length, activeProjects: projects.filter(isActive).length, activeFunnels: funnels.filter(isActive).length };
  const projectsWithoutClient = rowsWithoutReference(projects, "client_id", "client_name");
  const funnelsWithoutProject = rowsWithoutReference(funnels, "project_id", "project_name");
  const messages: string[] = [];
  if (unnamed.hasUnnamed) messages.push(`${unnamed.message} ${t("onboardingCheckUnnamedOrView")}`);
  if (backend.activeClients !== null && backend.activeClients !== visible.activeClients) messages.push(`${t("onboardingHealthMismatch")} Health: ${backend.activeClients}; ${t("onboardingActiveClients")}: ${visible.activeClients}. ${t("onboardingCheckUnnamedOrView")}`);
  if (backend.activeProjects !== null && backend.activeProjects !== visible.activeProjects) messages.push(`${t("onboardingHealthMismatch")} Health: ${backend.activeProjects}; ${t("onboardingActiveProjects")}: ${visible.activeProjects}. ${t("onboardingCheckUnnamedOrView")}`);
  if (backend.activeFunnels !== null && backend.activeFunnels !== visible.activeFunnels) messages.push(`${t("onboardingHealthMismatch")} Health: ${backend.activeFunnels}; ${t("onboardingActiveFunnels")}: ${visible.activeFunnels}. ${t("onboardingCheckUnnamedOrView")}`);
  if (projectsWithoutClient) messages.push(`${t("onboardingProjectsWithoutClientMessage")} ${projectsWithoutClient}. ${t("onboardingCheckBindingOrView")}`);
  if (funnelsWithoutProject) messages.push(`${t("onboardingFunnelsWithoutProjectMessage")} ${funnelsWithoutProject}. ${t("onboardingCheckBindingOrView")}`);
  return { backend, visible, projectsWithoutClient, funnelsWithoutProject, messages, hasWarnings: messages.length > 0 };
}

function buildHealthCards(healthRows: OnboardingRow[], clients: OnboardingRow[], projects: OnboardingRow[], funnels: OnboardingRow[], forceWarning: boolean, t: (key: TranslationKey) => string) {
  const activeClients = metricFromHealth(healthRows, ["active_clients", "clients_active", "client_count", "clients_count"]) ?? clients.filter(isActive).length;
  const activeProjects = metricFromHealth(healthRows, ["active_projects", "projects_active", "project_count", "projects_count"]) ?? projects.filter(isActive).length;
  const activeFunnels = metricFromHealth(healthRows, ["active_funnels", "funnels_active", "funnel_count", "funnels_count"]) ?? funnels.filter(isActive).length;
  const projectsWithoutClient = metricFromHealth(healthRows, ["projects_without_client", "orphan_projects"]) ?? rowsWithoutReference(projects, "client_id", "client_name");
  const funnelsWithoutProject = metricFromHealth(healthRows, ["funnels_without_project", "orphan_funnels"]) ?? rowsWithoutReference(funnels, "project_id", "project_name");
  const backendStatus = textFromHealth(healthRows, ["status", "health_status", "onboarding_status"]);
  const onboardingStatus = forceWarning || projectsWithoutClient || funnelsWithoutProject ? t("onboardingHealthNeedsAttention") : formatHealthStatus(backendStatus, t);
  return [
    { title: t("onboardingActiveClients"), value: activeClients },
    { title: t("onboardingActiveProjects"), value: activeProjects },
    { title: t("onboardingActiveFunnels"), value: activeFunnels },
    { title: t("onboardingProjectsWithoutClient"), value: projectsWithoutClient, description: projectsWithoutClient ? t("onboardingCheckClientLink") : t("onboardingNoCriticalGaps") },
    { title: t("onboardingFunnelsWithoutProject"), value: funnelsWithoutProject, description: funnelsWithoutProject ? t("onboardingCheckProjectLink") : t("onboardingNoCriticalGaps") },
    { title: t("onboardingHealthTitle"), value: onboardingStatus, description: onboardingStatus === t("onboardingHealthOk") ? t("onboardingLinksLookCorrect") : t("onboardingRecordsNeedReview") },
  ];
}
