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
    const [summary, daily] = await Promise.all([read("v_unified_sales_performance_summary"), read("v_unified_sales_performance_daily")]);
    return { summary, daily };
  }});

  const totals = (query.data?.summary.rows ?? []).reduce((acc, row) => ({
    sales_count: acc.sales_count + Number(row.sales_count ?? 0),
    first_payment_usd: acc.first_payment_usd + Number(row.first_payment_usd ?? 0),
    first_payment_uah: acc.first_payment_uah + Number(row.first_payment_uah ?? 0),
    second_payment_usd: acc.second_payment_usd + Number(row.second_payment_usd ?? 0),
    second_payment_uah: acc.second_payment_uah + Number(row.second_payment_uah ?? 0),
    total_payment_usd: acc.total_payment_usd + Number(row.total_payment_usd ?? 0),
    total_payment_uah: acc.total_payment_uah + Number(row.total_payment_uah ?? 0),
  }), { sales_count: 0, first_payment_usd: 0, first_payment_uah: 0, second_payment_usd: 0, second_payment_uah: 0, total_payment_usd: 0, total_payment_uah: 0 });

  return <DashboardLayout title={t("salesTitle")} subtitle={t("salesSubtitle")}><div className="space-y-4"><FilterBar freshness={{ source: "v_unified_sales_performance_summary", status: "fresh", lastSync: "live" }} />
    {!session ? <Msg t="Увійдіть, щоб переглянути дані продажів." /> : query.isLoading ? <Msg t="Завантаження даних продажів…" /> : null}
    <SectionCard title="Підсумок продажів" description="Огляд ефективності продажів" noPadding>
      {(query.data?.summary.rows ?? []).length === 0 ? <Msg t="Продажі поки не знайдені. Перевірте імпорт продажів." /> : <Kpi rows={[{ label: "Продажі", value: fmtNum(totals.sales_count) }, { label: "Перші платежі USD", value: fmtCurrency(totals.first_payment_usd) }, { label: "Перші платежі UAH", value: fmtCurrency(totals.first_payment_uah) }, { label: "Другі платежі USD", value: fmtCurrency(totals.second_payment_usd) }, { label: "Другі платежі UAH", value: fmtCurrency(totals.second_payment_uah) }, { label: "Загалом USD", value: fmtCurrency(totals.total_payment_usd) }, { label: "Загалом UAH", value: fmtCurrency(totals.total_payment_uah) }]} />}
    </SectionCard>
    <SectionCard title="Продажі за кампаніями" description="Зведення по кампаніях" noPadding>
      <Rows rows={query.data?.summary.rows ?? []} empty="Продажі поки не знайдені. Перевірте імпорт продажів." cols={["Кампанія", "Перша дата", "Остання дата", "Продажі", "Перші платежі USD", "Перші платежі UAH", "Другі платежі USD", "Другі платежі UAH", "Загалом USD", "Загалом UAH", "Джерело"]} keys={["campaign_name", "first_date", "last_date", "sales_count", "first_payment_usd", "first_payment_uah", "second_payment_usd", "second_payment_uah", "total_payment_usd", "total_payment_uah", "source_layer"]} />
    </SectionCard>
    <SectionCard title="Продажі по днях" description="Щоденні продажі" noPadding>
      <Rows rows={query.data?.daily.rows ?? []} empty="Продажі поки не знайдені. Перевірте імпорт продажів." cols={["Дата", "Кампанія", "Продажі", "Загалом USD", "Загалом UAH"]} keys={["sale_date", "campaign_name", "sales_count", "total_payment_usd", "total_payment_uah"]} />
    </SectionCard>
  </div></DashboardLayout>;
}

function Rows({ rows, cols, keys, empty }: { rows: Row[]; cols: string[]; keys: string[]; empty: string }) { if (!rows.length) return <Msg t={empty} />; return <Table><TableHeader><TableRow>{cols.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 200).map((r, i) => <TableRow key={i}>{keys.map((k) => <TableCell key={k} className="num">{fmt(r[k], k)}</TableCell>)}</TableRow>)}</TableBody></Table>; }
function Kpi({ rows }: { rows: { label: string; value: string }[] }) { return <Table><TableHeader><TableRow><TableHead>Показник</TableHead><TableHead className="text-right">Значення</TableHead></TableRow></TableHeader><TableBody>{rows.map((r) => <TableRow key={r.label}><TableCell>{r.label}</TableCell><TableCell className="text-right num">{r.value}</TableCell></TableRow>)}</TableBody></Table>; }
function fmt(v: Row[string], key: string) { if (typeof v !== "number") return String(v ?? "—"); if (key.includes("payment")) return fmtCurrency(v); return fmtNum(v); }
const Msg = ({ t }: { t: string }) => <p className="rounded border p-3 text-sm text-muted-foreground">{t}</p>;
async function read(view: string) { const res = await supabase.from(view).select("*").eq("workspace_id", WORKSPACE_ID).limit(500); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }
