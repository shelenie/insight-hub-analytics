import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCurrency, fmtNum } from "@/lib/format";
import { useI18n } from "@/i18n/I18nProvider";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, string | number | boolean | null>;

export default function Campaigns() {
  const { t } = useI18n();
  const { session } = useAuth();
  const [queryText, setQueryText] = useState("");
  const query = useQuery({
    queryKey: ["campaigns-page", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const [daily, summary, bindings, anomalies, health] = await Promise.all([
        read("v_ads_performance_daily"), read("v_ads_performance_summary"), read("v_ad_account_bindings"), read("v_ai_ads_anomaly_candidates"), read("v_ads_connector_health"),
      ]);
      return { daily, summary, bindings, anomalies, health };
    },
  });

  const rows = useMemo(() => (query.data?.daily.rows ?? []).filter((r) => `${r.campaign_name ?? r.campaign_id ?? ""}`.toLowerCase().includes(queryText.toLowerCase())), [query.data, queryText]);
  const connectorStatus = String(query.data?.health.rows[0]?.ads_connector_status ?? query.data?.health.rows[0]?.status ?? "");

  return <DashboardLayout title={t("campaignsTitle")} subtitle={t("campaignsSubtitle")}><div className="space-y-4"><FilterBar extra={<Input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder={t("searchPlaceholder")} className="h-8 w-[240px] text-xs" />} freshness={{ source: "v_ads_performance_daily", status: "fresh", lastSync: "live" }} />
    {!session ? <Msg t="Sign in to view campaigns production data." /> : query.isLoading ? <Msg t="Loading campaigns production data…" /> : null}
    {connectorStatus === "no_active_connections" ? <Msg t="Connect a real ads account to activate ads data." /> : null}
    <SectionCard title="Campaign metrics" description="Campaign performance metrics" noPadding>
      {(query.data?.daily.unavailableReason) ? <Msg t="No campaign data is available yet." /> : <Table><TableHeader><TableRow><TableHead>platform</TableHead><TableHead>campaign</TableHead><TableHead className="text-right">spend</TableHead><TableHead className="text-right">clicks</TableHead><TableHead className="text-right">impressions/reach</TableHead><TableHead className="text-right">CTR</TableHead><TableHead className="text-right">CPC</TableHead><TableHead className="text-right">CPM</TableHead></TableRow></TableHeader><TableBody>{rows.slice(0, 100).map((r, i) => <TableRow key={i}><TableCell>{String(r.platform ?? "—")}</TableCell><TableCell>{String(r.campaign_name ?? r.campaign_id ?? "—")}</TableCell><TableCell className="text-right num">{val(r.spend, true)}</TableCell><TableCell className="text-right num">{val(r.clicks)}</TableCell><TableCell className="text-right num">{val(r.impressions ?? r.reach)}</TableCell><TableCell className="text-right num">{val(r.ctr)}</TableCell><TableCell className="text-right num">{val(r.cpc, true)}</TableCell><TableCell className="text-right num">{val(r.cpm, true)}</TableCell></TableRow>)}</TableBody></Table>}
    </SectionCard>
    <SectionCard title="Mapping / binding status" description="Connected ad accounts" noPadding><Simple rows={query.data?.bindings.rows ?? []} columns={["platform", "ad_account_name", "mapping_status", "binding_status", "updated_at"]} empty="Binding status unavailable." /></SectionCard>
    <SectionCard title="Anomaly candidates" description="Campaign anomalies" noPadding><Simple rows={query.data?.anomalies.rows ?? []} columns={["severity", "title", "reason", "created_at"]} empty="No anomaly candidates." /></SectionCard>
  </div></DashboardLayout>;
}
const Msg = ({ t }: { t: string }) => <p className="rounded border p-3 text-sm text-muted-foreground">{t}</p>;
const val = (v: Row[string], currency?: boolean) => typeof v === "number" ? (currency ? fmtCurrency(v) : fmtNum(v)) : "—";
function Simple({ rows, columns, empty }: { rows: Row[]; columns: string[]; empty: string }) { if (!rows.length) return <Msg t={empty} />; return <Table><TableHeader><TableRow>{columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((r, i) => <TableRow key={i}>{columns.map((c) => <TableCell key={c}>{String(r[c] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table>; }
async function read(viewName: string) { const res = await supabase.from(viewName).select("*").eq("workspace_id", WORKSPACE_ID).limit(200); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }
