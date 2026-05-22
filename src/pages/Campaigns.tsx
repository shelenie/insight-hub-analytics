import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCurrency, fmtNum } from "@/lib/format";
import { filterPlaceholderRows } from "@/lib/demoFilters";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useDateFilter } from "@/filters/DateContext";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";
type Row = Record<string, string | number | boolean | null>;

type CampaignAgg = {
  campaign_name: string;
  first_date: string;
  last_date: string;
  spend: number;
  clicks: number;
  leads: number;
  reach: number;
  cpc: number | null;
  cpl: number | null;
};

export default function Campaigns() {
  const { session } = useAuth();
  const date = useDateFilter();
  const [queryText, setQueryText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const from = format(date.resolved.from, "yyyy-MM-dd");
  const to = format(date.resolved.to, "yyyy-MM-dd");

  const query = useQuery({
    queryKey: ["campaigns-page", WORKSPACE_ID, from, to],
    enabled: Boolean(session),
    queryFn: async () => {
      const [daily, bindings, anomalies, health] = await Promise.all([
        readDaily(from, to),
        read("v_ad_account_bindings"),
        read("v_ai_ads_anomaly_candidates"),
        read("v_ads_connector_health"),
      ]);
      return { daily, bindings, anomalies, health };
    },
  });

  const campaignRows = useMemo(() => aggregateCampaigns(query.data?.daily.rows ?? []), [query.data?.daily.rows]);
  const searchedRows = useMemo(
    () => campaignRows.filter((r) => r.campaign_name.toLowerCase().includes(queryText.toLowerCase())),
    [campaignRows, queryText],
  );
  const sortedRows = useMemo(() => [...searchedRows].sort((a, b) => b.spend - a.spend), [searchedRows]);
  const visibleRows = useMemo(() => (showAll ? sortedRows.slice(0, 200) : sortedRows.slice(0, 25)), [showAll, sortedRows]);

  const totals = useMemo(
    () =>
      searchedRows.reduce(
        (acc, row) => {
          acc.spend += row.spend;
          acc.clicks += row.clicks;
          acc.leads += row.leads;
          acc.reach += row.reach;
          return acc;
        },
        { spend: 0, clicks: 0, leads: 0, reach: 0 },
      ),
    [searchedRows],
  );

  const summaryCards = [
    { label: "Витрати", value: fmtCurrency(totals.spend) },
    { label: "Ліди", value: fmtNum(totals.leads) },
    { label: "CPL", value: totals.leads > 0 ? fmtCurrency(totals.spend / totals.leads) : "—" },
    { label: "Кліки", value: fmtNum(totals.clicks) },
    { label: "CPC", value: totals.clicks > 0 ? fmtCurrency(totals.spend / totals.clicks) : "—" },
    { label: "Охоплення", value: fmtNum(totals.reach) },
    { label: "Кампаній", value: fmtNum(searchedRows.length) },
  ];

  const filteredBindingsRows = useMemo(
    () => filterPlaceholderRows(query.data?.bindings.rows as Record<string, unknown>[] | undefined) as Row[],
    [query.data?.bindings.rows],
  );
  const filteredAnomaliesRows = useMemo(
    () => filterPlaceholderRows(query.data?.anomalies.rows as Record<string, unknown>[] | undefined) as Row[],
    [query.data?.anomalies.rows],
  );

  const noData = Boolean(session) && !query.isLoading && searchedRows.length === 0;
  const connectorStatus = String(query.data?.health.rows[0]?.ads_connector_status ?? query.data?.health.rows[0]?.status ?? "");

  return <DashboardLayout title="Кампанії" subtitle="Ефективність рекламних кампаній"><div className="space-y-4"><FilterBar extra={<Input value={queryText} onChange={(e) => { setQueryText(e.target.value); setShowAll(false); }} placeholder="Пошук кампанії" className="h-8 w-[240px] text-xs" />} freshness={{ source: "Імпорт рекламних даних", status: "fresh", lastSync: "live" }} />
    {!session ? <Msg t="Увійдіть, щоб переглянути дані кампаній." /> : query.isLoading ? <Msg t="Завантаження даних кампаній…" /> : null}
    {connectorStatus === "no_active_connections" ? <Msg t="Показані імпортовані рекламні дані. API-конектори можна підключити пізніше для автоматичного оновлення." /> : null}
    {noData ? <Msg t="За вибраний період рекламних даних не знайдено. Змініть період або перевірте імпорт трафіку." /> : <>
      <SectionCard title="Підсумок реклами" description="Зведені метрики за вибраний період">
        <KpiCards rows={summaryCards} />
      </SectionCard>
      <SectionCard title="Кампанії" description="Ефективність кампаній" noPadding>
        <div className="px-4 pt-4 text-sm text-muted-foreground">Показано {visibleRows.length} з {sortedRows.length} кампаній</div>
        <Table><TableHeader><TableRow><TableHead>Кампанія</TableHead><TableHead>Період</TableHead><TableHead className="text-right">Витрати</TableHead><TableHead className="text-right">Ліди</TableHead><TableHead className="text-right">CPL</TableHead><TableHead className="text-right">Кліки</TableHead><TableHead className="text-right">CPC</TableHead><TableHead className="text-right">Охоплення</TableHead></TableRow></TableHeader><TableBody>{visibleRows.map((r, i) => <TableRow key={`${r.campaign_name}-${i}`}><TableCell>{r.campaign_name}</TableCell><TableCell>{formatPeriod(r.first_date, r.last_date)}</TableCell><TableCell className="text-right num">{fmtCurrency(r.spend)}</TableCell><TableCell className="text-right num">{fmtNum(r.leads)}</TableCell><TableCell className="text-right num">{r.cpl == null ? "—" : fmtCurrency(r.cpl)}</TableCell><TableCell className="text-right num">{fmtNum(r.clicks)}</TableCell><TableCell className="text-right num">{r.cpc == null ? "—" : fmtCurrency(r.cpc)}</TableCell><TableCell className="text-right num">{fmtNum(r.reach)}</TableCell></TableRow>)}</TableBody></Table>
        <div className="flex items-center justify-between px-4 pb-4 pt-2 text-sm">
          <span className="text-muted-foreground">Показано {visibleRows.length} з {sortedRows.length} кампаній</span>
          {!showAll && sortedRows.length > 25 ? <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>Показати всі</Button> : null}
        </div>
      </SectionCard>
    </>}
    <details className="rounded border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Додатково: стан звʼязків</summary>
      <SectionCard title="Стан звʼязків" description="Підключені рекламні акаунти (опційно)" noPadding><Simple rows={filteredBindingsRows} columns={[{ key: "platform", label: "Платформа" }, { key: "ad_account_name", label: "Рекламний акаунт" }, { key: "mapping_status", label: "Статус мапінгу" }, { key: "binding_status", label: "Статус звʼязку" }, { key: "updated_at", label: "Оновлено" }]} empty="Додаткові дані про звʼязки недоступні." /></SectionCard>
    </details>
    <details className="rounded border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Додатково: аномалії</summary>
      <SectionCard title="Аномалії" description="Потенційні аномалії кампаній (опційно)" noPadding><Simple rows={filteredAnomaliesRows} columns={[{ key: "severity", label: "Рівень" }, { key: "title", label: "Назва" }, { key: "reason", label: "Причина" }, { key: "created_at", label: "Створено" }]} empty="Додаткові дані про аномалії недоступні." /></SectionCard>
    </details>
  </div></DashboardLayout>;
}

const Msg = ({ t }: { t: string }) => <p className="rounded border p-3 text-sm text-muted-foreground">{t}</p>;

function KpiCards({ rows }: { rows: { label: string; value: string }[] }) {
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">{rows.map((r) => <div key={r.label} className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{r.label}</div><div className="mt-1 text-lg font-semibold num">{r.value}</div></div>)}</div>;
}

function formatPeriod(firstDate: string, lastDate: string) {
  if (!firstDate && !lastDate) return "—";
  if (firstDate === lastDate) return firstDate;
  return `${firstDate} — ${lastDate}`;
}

function aggregateCampaigns(rows: Row[]): CampaignAgg[] {
  const map = new Map<string, CampaignAgg>();
  rows.forEach((row) => {
    const campaign_name = String(row.campaign_name ?? "");
    if (!campaign_name) return;
    const metricDate = String(row.metric_date ?? "");
    const spend = Number(row.spend ?? 0);
    const clicks = Number(row.clicks ?? 0);
    const leads = Number(row.leads ?? 0);
    const reach = Number(row.reach ?? 0);

    const existing = map.get(campaign_name);
    if (!existing) {
      map.set(campaign_name, {
        campaign_name,
        first_date: metricDate,
        last_date: metricDate,
        spend,
        clicks,
        leads,
        reach,
        cpc: null,
        cpl: null,
      });
      return;
    }

    existing.first_date = !existing.first_date || metricDate < existing.first_date ? metricDate : existing.first_date;
    existing.last_date = !existing.last_date || metricDate > existing.last_date ? metricDate : existing.last_date;
    existing.spend += spend;
    existing.clicks += clicks;
    existing.leads += leads;
    existing.reach += reach;
  });

  return Array.from(map.values()).map((r) => ({ ...r, cpc: r.clicks > 0 ? r.spend / r.clicks : null, cpl: r.leads > 0 ? r.spend / r.leads : null }));
}

function Simple({ rows, columns, empty }: { rows: Row[]; columns: { key: string; label: string }[]; empty: string }) { if (!rows.length) return <Msg t={empty} />; return <Table><TableHeader><TableRow>{columns.map((c) => <TableHead key={c.key}>{c.label}</TableHead>)}</TableRow></TableHeader><TableBody>{rows.slice(0, 50).map((r, i) => <TableRow key={i}>{columns.map((c) => <TableCell key={c.key}>{String(r[c.key] ?? "—")}</TableCell>)}</TableRow>)}</TableBody></Table>; }

async function read(viewName: string) {
  const res = await supabase.from(viewName).select("*").eq("workspace_id", WORKSPACE_ID).limit(500);
  return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null };
}

async function readDaily(from: string, to: string) {
  const res = await supabase
    .from("v_unified_ads_performance_daily")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .gte("metric_date", from)
    .lte("metric_date", to)
    .limit(5000);

  return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null };
}
