import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

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

const MISSING_SECURE_WRAPPERS = {
  client: "Client create/edit requires a secure backend action.",
  project: "Project create/edit requires a secure backend action.",
  funnel: "Funnel create/edit requires a secure backend action.",
} as const;

export default function Onboarding() {
  const { session } = useAuth();

  const onboardingQuery = useQuery<OnboardingData>({
    queryKey: ["onboarding-management-data"],
    enabled: Boolean(session),
    queryFn: async () => {
      const [hierarchyRes, clientsRes, projectsRes, funnelsRes, healthRes] = await Promise.all([
        supabase.from("v_onboarding_hierarchy").select("*").order("client_name", { ascending: true }),
        supabase.from("v_clients").select("*").order("name", { ascending: true }),
        supabase.from("v_projects").select("*").order("name", { ascending: true }),
        supabase.from("v_funnels").select("*").order("name", { ascending: true }),
        supabase.from("v_onboarding_health").select("*"),
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

  const groupedHierarchy = useMemo(() => {
    const byClient = new Map<string, HierarchySummary>();

    for (const row of onboardingQuery.data?.hierarchy ?? []) {
      const clientName = asText(row.client_name) || "Unnamed client";
      const projectName = asText(row.project_name) || "Unnamed project";
      const funnelName = asText(row.funnel_name);

      if (!byClient.has(clientName)) {
        byClient.set(clientName, { clientName, projects: new Map() });
      }

      const client = byClient.get(clientName);
      if (!client) continue;

      if (!client.projects.has(projectName)) {
        client.projects.set(projectName, new Set());
      }

      if (funnelName) {
        client.projects.get(projectName)?.add(funnelName);
      }
    }

    return Array.from(byClient.values());
  }, [onboardingQuery.data?.hierarchy]);

  const projectCountByClient = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of groupedHierarchy) {
      counts.set(group.clientName, group.projects.size);
    }
    return counts;
  }, [groupedHierarchy]);

  const funnelCountByProject = useMemo(() => {
    const counts = new Map<string, number>();
    for (const group of groupedHierarchy) {
      for (const [projectName, funnels] of group.projects.entries()) {
        counts.set(projectName, funnels.size);
      }
    }
    return counts;
  }, [groupedHierarchy]);

  return (
    <DashboardLayout
      title="Onboarding"
      subtitle="Manage clients, projects, funnels, hierarchy, and onboarding health from Supabase views"
    >
      <div className="space-y-4">
        {!session ? (
          <SectionCard title="Onboarding" description="Authentication required">
            <p className="text-sm text-muted-foreground">You are signed out. Sign in to manage onboarding data.</p>
          </SectionCard>
        ) : onboardingQuery.isLoading ? (
          <SectionCard title="Onboarding" description="Loading data">
            <p className="text-sm text-muted-foreground">Loading onboarding workspace…</p>
          </SectionCard>
        ) : onboardingQuery.error ? (
          <SectionCard title="Onboarding" description="Error state">
            <p className="text-sm text-destructive">Could not load onboarding data: {onboardingQuery.error.message}</p>
          </SectionCard>
        ) : (
          <Tabs defaultValue="overview" className="space-y-4">
            <TabsList className="w-full justify-start overflow-x-auto">
              <TabsTrigger value="overview">Overview / Hierarchy</TabsTrigger>
              <TabsTrigger value="clients">Clients</TabsTrigger>
              <TabsTrigger value="projects">Projects</TabsTrigger>
              <TabsTrigger value="funnels">Funnels</TabsTrigger>
              <TabsTrigger value="health">Health</TabsTrigger>
            </TabsList>

            <TabsContent value="overview">
              <SectionCard title="Client → Project → Funnel" description="Source: v_onboarding_hierarchy">
                {groupedHierarchy.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No clients, projects, or funnels created yet.</p>
                ) : (
                  <div className="space-y-3">
                    {groupedHierarchy.map((client) => (
                      <div key={client.clientName} className="rounded-md border border-border/70 bg-card/60 p-3">
                        <p className="text-sm font-semibold text-foreground">{client.clientName}</p>
                        <div className="mt-2 space-y-2">
                          {Array.from(client.projects.entries()).map(([projectName, funnels]) => (
                            <div key={`${client.clientName}-${projectName}`} className="rounded-md bg-muted/40 p-2">
                              <p className="text-sm font-medium">{projectName}</p>
                              {funnels.size === 0 ? (
                                <p className="mt-1 text-xs text-muted-foreground">No funnels yet.</p>
                              ) : (
                                <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                                  {Array.from(funnels).map((funnelName) => (
                                    <li key={`${client.clientName}-${projectName}-${funnelName}`}>{funnelName}</li>
                                  ))}
                                </ul>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </SectionCard>
            </TabsContent>

            <TabsContent value="clients">
              <SectionCard title="Clients" description="Source: v_clients">
                <DisabledManagementActions
                  createLabel="Create Client"
                  editLabel="Edit Client"
                  message={MISSING_SECURE_WRAPPERS.client}
                />
                <EntityTable
                  rows={onboardingQuery.data?.clients ?? []}
                  columns={[
                    "name",
                    "client_code",
                    "status",
                    "created_at",
                    "updated_at",
                  ]}
                  countColumnTitle="Projects"
                  countForRow={(row) => projectCountByClient.get(asText(row.name) || "") ?? 0}
                  emptyText="No clients available."
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="projects">
              <SectionCard title="Projects" description="Source: v_projects">
                <DisabledManagementActions
                  createLabel="Create Project"
                  editLabel="Edit Project"
                  message={MISSING_SECURE_WRAPPERS.project}
                />
                <EntityTable
                  rows={onboardingQuery.data?.projects ?? []}
                  columns={[
                    "name",
                    "client_name",
                    "project_code",
                    "status",
                  ]}
                  countColumnTitle="Funnels"
                  countForRow={(row) => funnelCountByProject.get(asText(row.name) || "") ?? 0}
                  emptyText="No projects available."
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="funnels">
              <SectionCard title="Funnels" description="Source: v_funnels">
                <DisabledManagementActions
                  createLabel="Create Funnel"
                  editLabel="Edit Funnel"
                  message={MISSING_SECURE_WRAPPERS.funnel}
                />
                <EntityTable
                  rows={onboardingQuery.data?.funnels ?? []}
                  columns={[
                    "name",
                    "client_name",
                    "project_name",
                    "funnel_code",
                    "status",
                  ]}
                  emptyText="No funnels available."
                />
              </SectionCard>
            </TabsContent>

            <TabsContent value="health">
              <SectionCard title="Onboarding health" description="Source: v_onboarding_health">
                <GenericTable rows={onboardingQuery.data?.health ?? []} emptyText="No onboarding health records found." />
              </SectionCard>
            </TabsContent>
          </Tabs>
        )}
      </div>
    </DashboardLayout>
  );
}

function DisabledManagementActions({
  createLabel,
  editLabel,
  message,
}: {
  createLabel: string;
  editLabel: string;
  message: string;
}) {
  return (
    <div className="mb-4 rounded-md border border-dashed border-border/70 bg-muted/30 p-3">
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
        <Input disabled value="Name / code / status fields are shown after secure wrapper is available" aria-label="Disabled management form" />
        <div className="flex gap-2">
          <Button type="button" disabled>{createLabel}</Button>
          <Button type="button" variant="outline" disabled>{editLabel}</Button>
        </div>
      </div>
      <p className="mt-2 text-xs text-muted-foreground">{message}</p>
    </div>
  );
}

function EntityTable({
  rows,
  columns,
  countColumnTitle,
  countForRow,
  emptyText,
}: {
  rows: OnboardingRow[];
  columns: string[];
  countColumnTitle?: string;
  countForRow?: (row: OnboardingRow) => number;
  emptyText: string;
}) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="min-w-full text-left text-sm">
        <thead>
          <tr className="border-b border-border/70 text-muted-foreground">
            {columns.map((column) => (
              <th key={column} className="px-2 py-2 font-medium">{titleize(column)}</th>
            ))}
            {countColumnTitle ? <th className="px-2 py-2 font-medium">{countColumnTitle}</th> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, index) => (
            <tr key={`${asText(row.id) || asText(row.name) || "row"}-${index}`} className="border-b border-border/40 last:border-0">
              {columns.map((column) => (
                <td key={`${index}-${column}`} className="px-2 py-2 text-foreground">
                  {formatValue(row[column])}
                </td>
              ))}
              {countColumnTitle ? <td className="px-2 py-2 text-foreground">{countForRow ? countForRow(row) : "—"}</td> : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function GenericTable({ rows, emptyText }: { rows: OnboardingRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  const columns = Object.keys(rows[0] ?? {});
  if (columns.length === 0) {
    return <p className="text-sm text-muted-foreground">Health data exists but has no displayable fields.</p>;
  }

  return <EntityTable rows={rows} columns={columns} emptyText={emptyText} />;
}

function asText(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined) return "";
  return String(value);
}

function formatValue(value: string | number | boolean | null | undefined) {
  if (value === null || value === undefined || value === "") return "—";
  return String(value);
}

function titleize(value: string) {
  return value
    .split("_")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}
