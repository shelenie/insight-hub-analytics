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

export default function Sales() {
  const { t } = useI18n();
  const { session } = useAuth();
  const query = useQuery({ queryKey: ["sales-page", WORKSPACE_ID], enabled: Boolean(session), queryFn: async () => {
    const [summary, daily, funnel, onboarding] = await Promise.all([read("v_sales_performance_summary"), read("v_sales_performance_daily"), read("v_funnel_events"), read("v_onboarding_hierarchy")]);
    return { summary, daily, funnel, onboarding };
  }});

  const unavailable = query.data?.summary.unavailableReason && query.data?.daily.unavailableReason;

  return <DashboardLayout title={t("salesTitle")} subtitle={t("salesSubtitle")}><div className="space-y-4"><FilterBar freshness={{ source: "v_sales_performance_summary", status: "fresh", lastSync: "live" }} />
    {!session ? <Msg t="Sign in to view sales production data." /> : query.isLoading ? <Msg t="Завантаження sales production data…" /> : null}
    {unavailable ? <Msg t="Sales production data is unavailable." /> : null}
    <SectionCard title="Підсумок продажів" description="Огляд ефективності продажів" noPadding><Rows rows={query.data?.summary.rows ?? []} empty="No sales data is available yet." cols={["revenue", "sales_count", "conversion_rate", "project_name", "client_name"]} /></SectionCard>
    <SectionCard title="Продажі по днях" description="Динаміка продажів по днях" noPadding><Rows rows={query.data?.daily.rows ?? []} empty="No sales daily rows." cols={["date", "revenue", "sales_count", "conversion_rate"]} /></SectionCard>
    <SectionCard title="Контекст воронки / проєкту" description="Контекст воронки та онбордингу" noPadding><Rows rows={(query.data?.onboarding.rows ?? []).slice(0, 20)} empty="No funnel/project/client context rows." cols={["client_name", "project_name", "funnel_name"]} /></SectionCard>
  </div></DashboardLayout>;
}
function Rows({ rows, cols, empty }: { rows: Row[]; cols: string[]; empty: string }) { if (!rows.length) return <Msg t={empty} />; return <Table><TableHeader><TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 100).map((r, i) => <TableRow key={i}>{cols.map((c) => <TableCell key={c} className="num">{fmt(r[c], c)}</TableCell>)}</TableRow>)}</TableBody></Table>; }
function fmt(v: Row[string], key: string) { if (typeof v !== "number") return String(v ?? "—"); if (key.includes("revenue")) return fmtCurrency(v); return fmtNum(v); }
const Msg = ({ t }: { t: string }) => <p className="rounded border p-3 text-sm text-muted-foreground">{t}</p>;
async function read(view: string) { const res = await supabase.from(view).select("*").eq("workspace_id", WORKSPACE_ID).limit(200); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }
