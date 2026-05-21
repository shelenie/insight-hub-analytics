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
        read("v_unified_ads_performance_daily"),
        read("v_unified_ads_performance_summary"),
        read("v_ad_account_bindings"),
        read("v_ai_ads_anomaly_candidates"),
        read("v_ads_connector_health"),
      ]);
      return { daily, summary, bindings, anomalies, health };
    },
  });

  const summaryRows = useMemo(() => (query.data?.summary.rows ?? []).filter((r) => `${r.campaign_name ?? ""}`.toLowerCase().includes(queryText.toLowerCase())), [query.data, queryText]);
  const totals = useMemo(() => summaryRows.reduce((acc, row) => {
    acc.spend += Number(row.spend ?? 0);
    acc.clicks += Number(row.clicks ?? 0);
    acc.leads += Number(row.leads ?? 0);
    acc.reach += Number(row.reach ?? 0);
    return acc;
  }, { spend: 0, clicks: 0, leads: 0, reach: 0 }), [summaryRows]);
  const cpc = totals.clicks > 0 ? totals.spend / totals.clicks : null;
  const cpl = totals.leads > 0 ? totals.spend / totals.leads : null;
  const connectorStatus = String(query.data?.health.rows[0]?.ads_connector_status ?? query.data?.health.rows[0]?.status ?? "");

  return <DashboardLayout title={t("campaignsTitle")} subtitle={t("campaignsSubtitle")}><div className="space-y-4"><FilterBar extra={<Input value={queryText} onChange={(e) => setQueryText(e.target.value)} placeholder={t("searchPlaceholder")} className="h-8 w-[240px] text-xs" />} freshness={{ source: "v_unified_ads_performance_daily", status: "fresh", lastSync: "live" }} />
    {!session ? <Msg t="Sign in to view campaigns production data." /> : query.isLoading ? <Msg t="Завантаження даних кампаній…" /> : null}
    {connectorStatus === "no_active_connections" ? <Msg t="Показані імпортовані рекламні дані. API-конектори можна підключити пізніше для автоматичного оновлення." /> : null}
    <SectionCard title="Підсумок реклами" description="Зведені метрики імпортованого трафіку" noPadding>
      <Kpi rows={[{ label: "Витрати", value: fmtCurrency(totals.spend) }, { label: "Кліки", value: fmtNum(totals.clicks) }, { label: "Ліди", value: fmtNum(totals.leads) }, { label: "Охоплення", value: fmtNum(totals.reach) }, { label: "CPC", value: cpc == null ? "—" : fmtCurrency(cpc) }, { label: "CPL", value: cpl == null ? "—" : fmtCurrency(cpl) }]} />
    </SectionCard>
    <SectionCard title="Кампанії" description="Ефективність кампаній" noPadding>
      {(query.data?.summary.unavailableReason || summaryRows.length === 0) ? <Msg t="Рекламні дані поки не знайдені. Перевірте імпорт трафіку або підключення джерел." /> : <Table><TableHeader><TableRow><TableHead>Кампанія</TableHead><TableHead>Перша дата</TableHead><TableHead>Остання дата</TableHead><TableHead className="text-right">Витрати</TableHead><TableHead className="text-right">Кліки</TableHead><TableHead className="text-right">Ліди</TableHead><TableHead className="text-right">Охоплення</TableHead><TableHead className="text-right">CPC</TableHead><TableHead className="text-right">CPL</TableHead><TableHead>Джерело</TableHead></TableRow></TableHeader><TableBody>{summaryRows.slice(0, 200).map((r, i) => <TableRow key={i}><TableCell>{String(r.campaign_name ?? "—")}</TableCell><TableCell>{String(r.first_date ?? "—")}</TableCell><TableCell>{String(r.last_date ?? "—")}</TableCell><TableCell className="text-right num">{currency(r.spend)}</TableCell><TableCell className="text-right num">{val(r.clicks)}</TableCell><TableCell className="text-right num">{val(r.leads)}</TableCell><TableCell className="text-right num">{val(r.reach)}</TableCell><TableCell className="text-right num">{currency(r.cpc)}</TableCell><TableCell className="text-right num">{currency(r.cpl)}</TableCell><TableCell>{String(r.source_layer ?? "—")}</TableCell></TableRow>)}</TableBody></Table>}
    </SectionCard>
    <SectionCard title="Стан звʼязків" description="Підключені рекламні акаунти (опційно)" noPadding><Simple rows={query.data?.bindings.rows ?? []} columns={["platform", "ad_account_name", "mapping_status", "binding_status", "updated_at"]} empty="Додаткові дані про звʼязки недоступні." /></SectionCard>
    <SectionCard title="Аномалії" description="Потенційні аномалії кампаній (опційно)" noPadding><Simple rows={query.data?.anomalies.rows ?? []} columns={["severity", "title", "reason", "created_at"]} empty="Додаткові дані про аномалії недоступні." /></SectionCard>
  </div></DashboardLayout>;
}
const Msg = ({ t }: { t: string }) => <p className="rounded border p-3 text-sm text-muted-foreground">{t}</p>;
const val = (v: Row[string]) => typeof v === "number" ? fmtNum(v) : "—";
const currency = (v: Row[string]) => typeof v === "number" ? fmtCurrency(v) : "—";
function Kpi({ rows }: { rows: { label: string; value: string }[] }) { return <Table><TableHeader><TableRow><TableHead>Показник</TableHead><TableHead className="text-right">Значення</TableHead></TableRow></TableHeader><TableBody>{rows.map((r) => <TableRow key={r.label}><TableCell>{r.label}</TableCell><TableCell className="text-right num">{r.value}</TableCell></TableRow>)}</TableBody></Table>; }
function Simple({ rows, columns, empty }: { rows: Row[]; columns: string[]; empty: string }) { if (!rows.length) return <Msg t={empty} />; return <Table><TableHeader><TableRow>{columns.map((c) => <TableHead key={c}>{c}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((r, i) => <TableRow key={i}>{columns.map((c) => <TableCell key={c}>{String(r[c] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table>; }
async function read(viewName: string) { const res = await supabase.from(viewName).select("*").eq("workspace_id", WORKSPACE_ID).limit(500); return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null }; }
