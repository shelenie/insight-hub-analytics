import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { useAuth } from "@/auth/AuthProvider";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";

type Row = Record<string, string | number | boolean | null>;
type OptionalViewData = { rows: Row[]; unavailableReason: string | null };

type BindingsData = {
  sourceBindings: Row[];
  adAccountBindings: Row[];
  projectDataBindings: Row[];
  mappingReviewQueue: Row[];
  bindingHealth: Row[];
  mappingReviewHealth: OptionalViewData;
  mappingReviewActionsRecent: OptionalViewData;
  telegramHitlHealth: OptionalViewData;
};

const MAPPING_ACTIONS_MESSAGE = "Mapping actions require a secure backend action.";
const MISSING_SECURE_WRAPPERS = [
  "send_mapping_review_to_telegram",
  "approve_mapping_review",
  "reject_mapping_review",
] as const;

export default function Bindings() {
  const { session } = useAuth();

  const query = useQuery<BindingsData>({
    queryKey: ["bindings-mapping-workspace"],
    enabled: Boolean(session),
    queryFn: async () => {
      const [sourceRes, adRes, projectRes, queueRes, healthRes] = await Promise.all([
        supabase.from("v_source_entity_bindings").select("*").order("updated_at", { ascending: false }),
        supabase.from("v_ad_account_bindings").select("*").order("updated_at", { ascending: false }),
        supabase.from("v_project_data_bindings").select("*").order("updated_at", { ascending: false }),
        supabase.from("v_mapping_review_queue").select("*").order("created_at", { ascending: false }),
        supabase.from("v_binding_health").select("*"),
      ]);

      if (sourceRes.error) throw sourceRes.error;
      if (adRes.error) throw adRes.error;
      if (projectRes.error) throw projectRes.error;
      if (queueRes.error) throw queueRes.error;
      if (healthRes.error) throw healthRes.error;

      const [mappingReviewHealth, mappingReviewActionsRecent, telegramHitlHealth] = await Promise.all([
        readOptionalView("v_mapping_review_health"),
        readOptionalView("v_mapping_review_actions_recent"),
        readOptionalView("v_telegram_hitl_production_health"),
      ]);

      return {
        sourceBindings: (sourceRes.data ?? []) as Row[],
        adAccountBindings: (adRes.data ?? []) as Row[],
        projectDataBindings: (projectRes.data ?? []) as Row[],
        mappingReviewQueue: (queueRes.data ?? []) as Row[],
        bindingHealth: (healthRes.data ?? []) as Row[],
        mappingReviewHealth,
        mappingReviewActionsRecent,
        telegramHitlHealth,
      };
    },
  });

  return (
    <DashboardLayout title="Bindings / Mapping" subtitle="Inspect source and ad account bindings, mapping review queue, and binding health">
      {!session ? (
        <SectionCard title="Bindings / Mapping" description="Authentication required">
          <p className="text-sm text-muted-foreground">You are signed out. Sign in to access bindings and mapping review data.</p>
        </SectionCard>
      ) : query.isLoading ? (
        <SectionCard title="Bindings / Mapping" description="Loading data">
          <p className="text-sm text-muted-foreground">Loading bindings workspace…</p>
        </SectionCard>
      ) : query.error ? (
        <SectionCard title="Bindings / Mapping" description="Error state">
          <p className="text-sm text-destructive">Could not load bindings workspace: {query.error.message}</p>
        </SectionCard>
      ) : (
        <Tabs defaultValue="overview" className="space-y-4">
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="source">Source Bindings</TabsTrigger>
            <TabsTrigger value="ad-account">Ad Account Bindings</TabsTrigger>
            <TabsTrigger value="project-data">Project Data Bindings</TabsTrigger>
            <TabsTrigger value="mapping-review">Mapping Review Queue</TabsTrigger>
            <TabsTrigger value="health">Health</TabsTrigger>
          </TabsList>

          <TabsContent value="overview">
            <SectionCard title="Bindings Overview" description="Operational snapshot across binding views">
              <ul className="grid gap-2 text-sm md:grid-cols-2">
                <li>Source bindings: <strong>{query.data?.sourceBindings.length ?? 0}</strong></li>
                <li>Ad account bindings: <strong>{query.data?.adAccountBindings.length ?? 0}</strong></li>
                <li>Project data bindings: <strong>{query.data?.projectDataBindings.length ?? 0}</strong></li>
                <li>Pending mapping reviews: <strong>{query.data?.mappingReviewQueue.length ?? 0}</strong></li>
              </ul>
            </SectionCard>
          </TabsContent>

          <TabsContent value="source">
            <SectionCard title="Source Bindings" description="Source: v_source_entity_bindings">
              <KnownColumnsTable rows={query.data?.sourceBindings ?? []} columns={[
                "source_name","source_kind","platform","client_name","project_name","funnel_name","mapping_status","binding_status","confidence","binding_method","created_at","updated_at",
              ]} emptyText="No source bindings found." />
            </SectionCard>
          </TabsContent>

          <TabsContent value="ad-account">
            <SectionCard title="Ad Account Bindings" description="Source: v_ad_account_bindings">
              <KnownColumnsTable rows={query.data?.adAccountBindings ?? []} columns={[
                "ad_account_name","external_account_id","platform","client_name","project_name","funnel_name","mapping_status","binding_status","confidence","binding_method","created_at","updated_at",
              ]} emptyText="No ad account bindings found." />
            </SectionCard>
          </TabsContent>

          <TabsContent value="project-data">
            <SectionCard title="Project Data Bindings" description="Source: v_project_data_bindings">
              <KnownColumnsTable rows={query.data?.projectDataBindings ?? []} columns={[
                "client_name","project_name","funnel_name","source_name","ad_account_name","platform","source_kind","binding_type","mapping_status","health_status","binding_status",
              ]} emptyText="No project data bindings found." />
            </SectionCard>
          </TabsContent>

          <TabsContent value="mapping-review">
            <SectionCard title="Mapping Review Queue" description="Source: v_mapping_review_queue">
              <KnownColumnsTable rows={query.data?.mappingReviewQueue ?? []} columns={[
                "source_name","ad_account_name","proposed_client_name","proposed_project_name","proposed_funnel_name","confidence","mapping_status","binding_method","reason","details","created_at",
              ]} emptyText="No pending mapping reviews found." />
              <div className="mt-4 rounded-md border border-dashed border-border/70 bg-muted/30 p-3">
                <div className="flex flex-wrap gap-2">
                  <Button type="button" disabled>Send to Telegram for approval</Button>
                  <Button type="button" variant="outline" disabled>Approve</Button>
                  <Button type="button" variant="destructive" disabled>Reject</Button>
                </div>
                <p className="mt-2 text-xs text-muted-foreground">{MAPPING_ACTIONS_MESSAGE}</p>
                <p className="mt-1 text-xs text-muted-foreground">Missing secure wrappers: {MISSING_SECURE_WRAPPERS.join(", ")}.</p>
              </div>
            </SectionCard>
          </TabsContent>

          <TabsContent value="health">
            <div className="space-y-4">
              <SectionCard title="Binding Health" description="Source: v_binding_health">
                <GenericTable rows={query.data?.bindingHealth ?? []} emptyText="No binding health records found." />
              </SectionCard>
              <OptionalViewCard title="Mapping Review Health" viewName="v_mapping_review_health" data={query.data?.mappingReviewHealth} />
              <OptionalViewCard title="Mapping Review Actions (Recent)" viewName="v_mapping_review_actions_recent" data={query.data?.mappingReviewActionsRecent} />
              <OptionalViewCard title="Telegram HITL Production Health" viewName="v_telegram_hitl_production_health" data={query.data?.telegramHitlHealth} />
            </div>
          </TabsContent>
        </Tabs>
      )}
    </DashboardLayout>
  );
}

async function readOptionalView(viewName: string): Promise<OptionalViewData> {
  const result = await supabase.from(viewName).select("*");
  if (result.error) {
    return { rows: [], unavailableReason: result.error.message };
  }
  return { rows: (result.data ?? []) as Row[], unavailableReason: null };
}

function OptionalViewCard({ title, viewName, data }: { title: string; viewName: string; data: OptionalViewData | undefined }) {
  return (
    <SectionCard title={title} description={`Source: ${viewName}`}>
      {data?.unavailableReason ? (
        <p className="text-sm text-muted-foreground">Unavailable: {data.unavailableReason}</p>
      ) : (
        <GenericTable rows={data?.rows ?? []} emptyText="No records found." />
      )}
    </SectionCard>
  );
}

function KnownColumnsTable({ rows, columns, emptyText }: { rows: Row[]; columns: string[]; emptyText: string }) {
  const availableColumns = columns.filter((column) => rows.some((row) => row[column] !== undefined));
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  if (availableColumns.length === 0) return <GenericTable rows={rows} emptyText={emptyText} />;
  return <GenericDataTable rows={rows} columns={availableColumns} />;
}

function GenericTable({ rows, emptyText }: { rows: Row[]; emptyText: string }) {
  if (rows.length === 0) return <p className="text-sm text-muted-foreground">{emptyText}</p>;
  const columns = Object.keys(rows[0] ?? {});
  if (columns.length === 0) return <p className="text-sm text-muted-foreground">Data exists but has no displayable fields.</p>;
  return <GenericDataTable rows={rows} columns={columns} />;
}

function GenericDataTable({ rows, columns }: { rows: Row[]; columns: string[] }) {
  return <div className="overflow-x-auto"><table className="min-w-full text-left text-sm"><thead><tr className="border-b border-border/70 text-muted-foreground">{columns.map((column) => <th key={column} className="px-2 py-2 font-medium">{titleize(column)}</th>)}</tr></thead><tbody>{rows.map((row, index) => <tr key={`${index}-${row.id ?? "row"}`} className="border-b border-border/40 last:border-0">{columns.map((column) => <td key={`${index}-${column}`} className="px-2 py-2 text-foreground">{formatValue(row[column])}</td>)}</tr>)}</tbody></table></div>;
}

function titleize(value: string) { return value.split("_").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" "); }
function formatValue(value: string | number | boolean | null | undefined) { return value === null || value === undefined || value === "" ? "—" : String(value); }
