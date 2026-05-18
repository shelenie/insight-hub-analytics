import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

type HierarchyRow = Record<string, string | null>;
type NamedRow = { id?: string | null; name?: string | null } & Record<string, string | null>;

export default function Onboarding() {
  const { session } = useAuth();

  const onboardingQuery = useQuery({
    queryKey: ["onboarding-hierarchy"],
    enabled: Boolean(session),
    queryFn: async () => {
      const [hierarchyRes, clientsRes, projectsRes, funnelsRes] = await Promise.all([
        supabase.from("v_onboarding_hierarchy").select("*").order("client_name", { ascending: true }),
        supabase.from("v_clients").select("*").order("name", { ascending: true }),
        supabase.from("v_projects").select("*").order("name", { ascending: true }),
        supabase.from("v_funnels").select("*").order("name", { ascending: true }),
      ]);

      if (hierarchyRes.error) throw hierarchyRes.error;
      if (clientsRes.error) throw clientsRes.error;
      if (projectsRes.error) throw projectsRes.error;
      if (funnelsRes.error) throw funnelsRes.error;

      return {
        hierarchy: (hierarchyRes.data ?? []) as HierarchyRow[],
        clients: (clientsRes.data ?? []) as NamedRow[],
        projects: (projectsRes.data ?? []) as NamedRow[],
        funnels: (funnelsRes.data ?? []) as NamedRow[],
      };
    },
  });

  const grouped = useMemo(() => {
    const byClient = new Map<string, { projects: Map<string, Set<string>> }>();

    for (const row of onboardingQuery.data?.hierarchy ?? []) {
      const clientName = row.client_name ?? "Unnamed client";
      const projectName = row.project_name ?? "Unnamed project";
      const funnelName = row.funnel_name ?? "Unnamed funnel";

      if (!byClient.has(clientName)) {
        byClient.set(clientName, { projects: new Map() });
      }

      const client = byClient.get(clientName)!;
      if (!client.projects.has(projectName)) {
        client.projects.set(projectName, new Set());
      }

      if (row.funnel_name) {
        client.projects.get(projectName)!.add(funnelName);
      }
    }

    return Array.from(byClient.entries());
  }, [onboardingQuery.data]);

  return (
    <DashboardLayout
      title="Onboarding"
      subtitle="Clients, projects, and funnels currently configured in Supabase views"
    >
      <div className="space-y-4">
        <SectionCard title="Onboarding hierarchy" description="Preferred source: v_onboarding_hierarchy">
          {!session ? (
            <p className="text-sm text-muted-foreground">Sign in to view onboarding data.</p>
          ) : onboardingQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading onboarding hierarchy…</p>
          ) : onboardingQuery.error ? (
            <p className="text-sm text-destructive">Could not load onboarding data: {onboardingQuery.error.message}</p>
          ) : (onboardingQuery.data?.hierarchy.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">No clients, projects, or funnels created yet.</p>
          ) : (
            <div className="space-y-3">
              {grouped.map(([clientName, client]) => (
                <div key={clientName} className="rounded-md border border-border/70 bg-card/60 p-3">
                  <p className="text-sm font-semibold text-foreground">{clientName}</p>
                  <div className="mt-2 space-y-2">
                    {Array.from(client.projects.entries()).map(([projectName, funnels]) => (
                      <div key={`${clientName}-${projectName}`} className="rounded-md bg-muted/40 p-2">
                        <p className="text-sm font-medium">{projectName}</p>
                        {funnels.size === 0 ? (
                          <p className="mt-1 text-xs text-muted-foreground">No funnels yet.</p>
                        ) : (
                          <ul className="mt-1 list-disc pl-4 text-xs text-muted-foreground">
                            {Array.from(funnels).map((funnelName) => (
                              <li key={`${clientName}-${projectName}-${funnelName}`}>{funnelName}</li>
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

        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard title="Clients" description="v_clients">
            <SimpleList rows={onboardingQuery.data?.clients ?? []} emptyText="No clients yet." />
          </SectionCard>
          <SectionCard title="Projects" description="v_projects">
            <SimpleList rows={onboardingQuery.data?.projects ?? []} emptyText="No projects yet." />
          </SectionCard>
          <SectionCard title="Funnels" description="v_funnels">
            <SimpleList rows={onboardingQuery.data?.funnels ?? []} emptyText="No funnels yet." />
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}

function SimpleList({ rows, emptyText }: { rows: NamedRow[]; emptyText: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  }

  return (
    <ul className="space-y-1 text-sm text-foreground">
      {rows.map((row, index) => (
        <li key={row.id ?? `${row.name}-${index}`} className="truncate rounded-sm bg-muted/35 px-2 py-1">
          {row.name ?? "Unnamed"}
        </li>
      ))}
    </ul>
  );
}
