import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCurrency, fmtNum } from "@/lib/format";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, string | number | boolean | null>;
type OptionalViewData = { rows: Row[]; unavailableReason: string | null };

export default function Funnel() {
  const { t } = useI18n();
  const { session } = useAuth();

  const query = useQuery({
    queryKey: ["funnel-page", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const [events, bindings, onboarding, adsSummary] = await Promise.all([
        readOptionalView("v_funnel_events", true),
        readOptionalView("v_project_data_bindings", true),
        readOptionalView("v_onboarding_hierarchy", true),
        readOptionalView("v_ads_performance_summary", true),
      ]);
      return { events, bindings, onboarding, adsSummary };
    },
  });

  const stageCounts = useMemo(() => {
    const rows = query.data?.events.rows ?? [];
    const map = new Map<string, number>();
    rows.forEach((row) => {
      const stage = String(row.event_name ?? row.stage_name ?? row.funnel_stage ?? "unknown");
      const count = Number(row.event_count ?? row.count ?? 1);
      map.set(stage, (map.get(stage) ?? 0) + count);
    });
    return Array.from(map.entries()).map(([stage, count]) => ({ stage, count }));
  }, [query.data]);

  return (
    <DashboardLayout title={t("funnelTitle")} subtitle={t("funnelSubtitle")}>
      <div className="space-y-4">
        <FilterBar freshness={{ source: "v_funnel_events", status: "fresh", lastSync: "live" }} />
        {!session ? <Empty text="Sign in to view funnel production data." /> : query.isLoading ? <Empty text="Завантаження funnel production data…" /> : null}
        {query.data?.events.unavailableReason ? <Empty text="Could not load this section yet." /> : null}

        <SectionCard title="Funnel stage / event counts" description="Stage conversion overview" noPadding>
          {stageCounts.length === 0 ? <Empty text="No funnel data yet. Connect a source or import data to see this report." /> : (
            <Table><TableHeader><TableRow><TableHead>Stage / event</TableHead><TableHead className="text-right">Count</TableHead></TableRow></TableHeader><TableBody>{stageCounts.map((s) => <TableRow key={s.stage}><TableCell>{s.stage}</TableCell><TableCell className="text-right num">{fmtNum(s.count)}</TableCell></TableRow>)}</TableBody></Table>
          )}
        </SectionCard>

        <SectionCard title="Client / project / funnel hierarchy" description="Client, project, and funnel structure" noPadding>
          <SimpleRows rows={query.data?.onboarding.rows ?? []} emptyText="Hierarchy data is unavailable or empty." columns={["client_name", "project_name", "funnel_name", "status"]} />
        </SectionCard>

        <SectionCard title="Binding status" description="Project data connections" noPadding>
          <SimpleRows rows={query.data?.bindings.rows ?? []} emptyText="Binding status is unavailable or empty." columns={["project_name", "mapping_status", "binding_status", "updated_at"]} />
        </SectionCard>

        <SectionCard title="Ads summary linked to funnel" description="Sales performance summary" noPadding>
          <SimpleRows rows={query.data?.adsSummary.rows ?? []} emptyText="Ads summary is unavailable or empty." columns={["platform", "campaign_name", "spend", "clicks", "impressions"]} />
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

function SimpleRows({ rows, columns, emptyText }: { rows: Row[]; columns: string[]; emptyText: string }) {
  if (rows.length === 0) return <Empty text={emptyText} />;
  return <Table><TableHeader><TableRow>{columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((row, idx) => <TableRow key={idx}>{columns.map((c) => <TableCell key={c}>{formatValue(row[c], c)}</TableCell>)}</TableRow>)}</TableBody></Table>;
}

function formatValue(value: Row[string], key: string) {
  if (value == null) return "—";
  if (typeof value === "number" && ["spend", "revenue"].includes(key)) return fmtCurrency(value);
  if (typeof value === "number") return fmtNum(value);
  return String(value);
}

function Empty({ text }: { text: string }) { return <p className="p-4 text-sm text-muted-foreground">{text}</p>; }

async function readOptionalView(viewName: string, scopedByWorkspace: boolean): Promise<OptionalViewData> {
  let query = supabase.from(viewName).select("*").limit(200);
  if (scopedByWorkspace) query = query.eq("workspace_id", WORKSPACE_ID);
  const result = await query;
  if (result.error) return { rows: [], unavailableReason: result.error.message };
  return { rows: (result.data ?? []) as Row[], unavailableReason: null };
}
