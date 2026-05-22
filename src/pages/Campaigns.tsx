import { useMemo, useState } from "react";
import { format } from "date-fns";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { fmtCurrency, fmtNum, fmtPercent } from "@/lib/format";
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

type PlacementAgg = {
  placement_name: string;
  landing_url: string;
  first_date: string;
  last_date: string;
  spend: number;
  reach: number;
  clicks: number;
  registrations: number;
  cpm: number | null;
  cpc: number | null;
  cpl: number | null;
  landing_conversion: number | null;
};

export default function Campaigns() {
  const { session } = useAuth();
  const date = useDateFilter();
  const [queryText, setQueryText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [activeTab, setActiveTab] = useState<"campaigns" | "placements">("campaigns");
  const from = format(date.resolved.from, "yyyy-MM-dd");
  const to = format(date.resolved.to, "yyyy-MM-dd");

  const query = useQuery({
    queryKey: ["campaigns-page", WORKSPACE_ID, from, to],
    enabled: Boolean(session),
    queryFn: async () => {
      const [daily, placementsDaily, bindings, anomalies, health] = await Promise.all([
        readDaily(from, to),
        readPlacementsDaily(from, to),
        read("v_ad_account_bindings"),
        read("v_ai_ads_anomaly_candidates"),
        read("v_ads_connector_health"),
      ]);
      return { daily, placementsDaily, bindings, anomalies, health };
    },
  });

  const campaignRows = useMemo(() => aggregateCampaigns(query.data?.daily.rows ?? []), [query.data?.daily.rows]);
  const placementRows = useMemo(() => aggregatePlacements(query.data?.placementsDaily.rows ?? []), [query.data?.placementsDaily.rows]);

  const campaignSearchedRows = useMemo(
    () => campaignRows.filter((r) => r.campaign_name.toLowerCase().includes(queryText.toLowerCase())),
    [campaignRows, queryText],
  );
  const placementSearchedRows = useMemo(
    () =>
      placementRows.filter((r) => {
        const q = queryText.toLowerCase();
        return r.placement_name.toLowerCase().includes(q) || r.landing_url.toLowerCase().includes(q);
      }),
    [placementRows, queryText],
  );

  const campaignSortedRows = useMemo(() => [...campaignSearchedRows].sort((a, b) => b.spend - a.spend), [campaignSearchedRows]);
  const placementSortedRows = useMemo(() => [...placementSearchedRows].sort((a, b) => b.spend - a.spend), [placementSearchedRows]);
  const visibleCampaignRows = useMemo(() => (showAll ? campaignSortedRows.slice(0, 200) : campaignSortedRows.slice(0, 25)), [showAll, campaignSortedRows]);
  const visiblePlacementRows = useMemo(() => (showAll ? placementSortedRows.slice(0, 200) : placementSortedRows.slice(0, 25)), [showAll, placementSortedRows]);

  const campaignTotals = useMemo(
    () =>
      campaignSearchedRows.reduce(
        (acc, row) => {
          acc.spend += row.spend;
          acc.clicks += row.clicks;
          acc.leads += row.leads;
          acc.reach += row.reach;
          return acc;
        },
        { spend: 0, clicks: 0, leads: 0, reach: 0 },
      ),
    [campaignSearchedRows],
  );

  const placementTotals = useMemo(
    () =>
      placementSearchedRows.reduce(
        (acc, row) => {
          acc.spend += row.spend;
          acc.clicks += row.clicks;
          acc.registrations += row.registrations;
          acc.reach += row.reach;
          return acc;
        },
        { spend: 0, clicks: 0, registrations: 0, reach: 0 },
      ),
    [placementSearchedRows],
  );

  const campaignSummaryCards = [
    { label: "Витрати", value: fmtCurrency(campaignTotals.spend) },
    { label: "Ліди", value: fmtNum(campaignTotals.leads) },
    { label: "CPL", value: campaignTotals.leads > 0 ? fmtCurrency(campaignTotals.spend / campaignTotals.leads) : "—" },
    { label: "Кліки", value: fmtNum(campaignTotals.clicks) },
    { label: "CPC", value: campaignTotals.clicks > 0 ? fmtCurrency(campaignTotals.spend / campaignTotals.clicks) : "—" },
    { label: "Охоплення", value: fmtNum(campaignTotals.reach) },
    { label: "Кампаній", value: fmtNum(campaignSearchedRows.length) },
  ];

  const placementSummaryCards = [
    { label: "Витрати", value: fmtCurrency(placementTotals.spend) },
    { label: "Реєстрації", value: fmtNum(placementTotals.registrations) },
    { label: "CPL", value: placementTotals.registrations > 0 ? fmtCurrency(placementTotals.spend / placementTotals.registrations) : "—" },
    { label: "Кліки", value: fmtNum(placementTotals.clicks) },
    { label: "CPC", value: placementTotals.clicks > 0 ? fmtCurrency(placementTotals.spend / placementTotals.clicks) : "—" },
    { label: "Охоплення", value: fmtNum(placementTotals.reach) },
    { label: "Плейсментів", value: fmtNum(placementSearchedRows.length) },
    { label: "Конверсія ленда", value: placementTotals.clicks > 0 ? fmtPercent((placementTotals.registrations / placementTotals.clicks) * 100) : "—" },
  ];

  const filteredBindingsRows = useMemo(
    () => filterPlaceholderRows(query.data?.bindings.rows as Record<string, unknown>[] | undefined) as Row[],
    [query.data?.bindings.rows],
  );
  const filteredAnomaliesRows = useMemo(
    () => filterPlaceholderRows(query.data?.anomalies.rows as Record<string, unknown>[] | undefined) as Row[],
    [query.data?.anomalies.rows],
  );

  const noCampaignData = Boolean(session) && !query.isLoading && campaignSearchedRows.length === 0;
  const noPlacementData = Boolean(session) && !query.isLoading && placementSearchedRows.length === 0;
  const connectorStatus = String(query.data?.health.rows[0]?.ads_connector_status ?? query.data?.health.rows[0]?.status ?? "");

  return <DashboardLayout title="Кампанії" subtitle="Ефективність рекламних кампаній"><div className="space-y-4"><FilterBar extra={<Input value={queryText} onChange={(e) => { setQueryText(e.target.value); setShowAll(false); }} placeholder={activeTab === "campaigns" ? "Пошук кампанії" : "Пошук плейсменту або URL"} className="h-8 w-[240px] text-xs" />} freshness={{ source: "Імпорт рекламних даних", status: "fresh", lastSync: "live" }} />
    <div className="flex items-center gap-2">
      <Button variant={activeTab === "campaigns" ? "default" : "outline"} size="sm" onClick={() => { setActiveTab("campaigns"); setShowAll(false); }}>Кампанії</Button>
      <Button variant={activeTab === "placements" ? "default" : "outline"} size="sm" onClick={() => { setActiveTab("placements"); setShowAll(false); }}>Плейсменти</Button>
    </div>
    {!session ? <Msg t="Увійдіть, щоб переглянути дані кампаній." /> : query.isLoading ? <Msg t="Завантаження даних кампаній…" /> : null}
    {connectorStatus === "no_active_connections" ? <Msg t="Показані імпортовані рекламні дані. API-конектори можна підключити пізніше для автоматичного оновлення." /> : null}

    {activeTab === "campaigns" ? (
      noCampaignData ? <Msg t="За вибраний період рекламних даних не знайдено. Змініть період або перевірте імпорт трафіку." /> : <>
        <SectionCard title="Підсумок реклами" description="Зведені метрики за вибраний період">
          <KpiCards rows={campaignSummaryCards} />
        </SectionCard>
        <SectionCard title="Кампанії" description="Ефективність кампаній" noPadding>
          <div className="px-4 pt-4 text-sm text-muted-foreground">Показано {visibleCampaignRows.length} з {campaignSortedRows.length} кампаній</div>
          <Table><TableHeader><TableRow><TableHead>Кампанія</TableHead><TableHead>Період</TableHead><TableHead className="text-right">Витрати</TableHead><TableHead className="text-right">Ліди</TableHead><TableHead className="text-right">CPL</TableHead><TableHead className="text-right">Кліки</TableHead><TableHead className="text-right">CPC</TableHead><TableHead className="text-right">Охоплення</TableHead></TableRow></TableHeader><TableBody>{visibleCampaignRows.map((r, i) => <TableRow key={`${r.campaign_name}-${i}`}><TableCell>{r.campaign_name}</TableCell><TableCell>{formatPeriod(r.first_date, r.last_date)}</TableCell><TableCell className="text-right num">{fmtCurrency(r.spend)}</TableCell><TableCell className="text-right num">{fmtNum(r.leads)}</TableCell><TableCell className="text-right num">{r.cpl == null ? "—" : fmtCurrency(r.cpl)}</TableCell><TableCell className="text-right num">{fmtNum(r.clicks)}</TableCell><TableCell className="text-right num">{r.cpc == null ? "—" : fmtCurrency(r.cpc)}</TableCell><TableCell className="text-right num">{fmtNum(r.reach)}</TableCell></TableRow>)}</TableBody></Table>
          <div className="flex items-center justify-between px-4 pb-4 pt-2 text-sm">
            <span className="text-muted-foreground">Показано {visibleCampaignRows.length} з {campaignSortedRows.length} кампаній</span>
            {!showAll && campaignSortedRows.length > 25 ? <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>Показати всі</Button> : null}
          </div>
        </SectionCard>
      </>
    ) : (
      noPlacementData ? <Msg t="За вибраний період плейсменти не знайдені. Змініть період або перевірте імпорт вкладок з плейсментами." /> : <>
        <SectionCard title="Підсумок плейсментів" description="Зведені метрики за вибраний період">
          <KpiCards rows={placementSummaryCards} />
        </SectionCard>
        <SectionCard title="Плейсменти" description="Ефективність плейсментів" noPadding>
          <div className="px-4 pt-4 text-sm text-muted-foreground">Показано {visiblePlacementRows.length} з {placementSortedRows.length} плейсментів</div>
          <Table><TableHeader><TableRow><TableHead>Плейсмент</TableHead><TableHead>URL</TableHead><TableHead>Період</TableHead><TableHead className="text-right">Витрати</TableHead><TableHead className="text-right">Реєстрації</TableHead><TableHead className="text-right">CPL</TableHead><TableHead className="text-right">Кліки</TableHead><TableHead className="text-right">CPC</TableHead><TableHead className="text-right">Охоплення</TableHead><TableHead className="text-right">Конверсія ленда</TableHead></TableRow></TableHeader><TableBody>{visiblePlacementRows.map((r, i) => <TableRow key={`${r.placement_name}-${r.landing_url}-${i}`}><TableCell>{r.placement_name}</TableCell><TableCell>{r.landing_url ? <a href={r.landing_url} target="_blank" rel="noreferrer" className="text-primary underline-offset-2 hover:underline">Відкрити</a> : "—"}</TableCell><TableCell>{formatPeriod(r.first_date, r.last_date)}</TableCell><TableCell className="text-right num">{fmtCurrency(r.spend)}</TableCell><TableCell className="text-right num">{fmtNum(r.registrations)}</TableCell><TableCell className="text-right num">{r.cpl == null ? "—" : fmtCurrency(r.cpl)}</TableCell><TableCell className="text-right num">{fmtNum(r.clicks)}</TableCell><TableCell className="text-right num">{r.cpc == null ? "—" : fmtCurrency(r.cpc)}</TableCell><TableCell className="text-right num">{fmtNum(r.reach)}</TableCell><TableCell className="text-right num">{r.landing_conversion == null ? "—" : fmtPercent(r.landing_conversion * 100)}</TableCell></TableRow>)}</TableBody></Table>
          <div className="flex items-center justify-between px-4 pb-4 pt-2 text-sm">
            <span className="text-muted-foreground">Показано {visiblePlacementRows.length} з {placementSortedRows.length} плейсментів</span>
            {!showAll && placementSortedRows.length > 25 ? <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>Показати всі</Button> : null}
          </div>
        </SectionCard>
      </>
    )}
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
  return <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">{rows.map((r) => <div key={r.label} className="rounded-lg border p-3"><div className="text-xs text-muted-foreground">{r.label}</div><div className="mt-1 text-lg font-semibold num">{r.value}</div></div>)}</div>;
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

function aggregatePlacements(rows: Row[]): PlacementAgg[] {
  const map = new Map<string, PlacementAgg>();
  rows.forEach((row) => {
    const placement_name = String(row.placement_name ?? "");
    if (!placement_name) return;
    const landing_url = String(row.landing_url ?? "");
    const metricDate = String(row.metric_date ?? "");
    const spend = Number(row.spend ?? 0);
    const reach = Number(row.reach ?? 0);
    const clicks = Number(row.clicks ?? 0);
    const registrations = Number(row.registrations ?? 0);
    const key = `${placement_name}::${landing_url}`;

    const existing = map.get(key);
    if (!existing) {
      map.set(key, { placement_name, landing_url, first_date: metricDate, last_date: metricDate, spend, reach, clicks, registrations, cpm: null, cpc: null, cpl: null, landing_conversion: null });
      return;
    }

    existing.first_date = !existing.first_date || metricDate < existing.first_date ? metricDate : existing.first_date;
    existing.last_date = !existing.last_date || metricDate > existing.last_date ? metricDate : existing.last_date;
    existing.spend += spend;
    existing.reach += reach;
    existing.clicks += clicks;
    existing.registrations += registrations;
  });

  return Array.from(map.values()).map((r) => ({ ...r, cpm: r.reach > 0 ? (r.spend / r.reach) * 1000 : null, cpc: r.clicks > 0 ? r.spend / r.clicks : null, cpl: r.registrations > 0 ? r.spend / r.registrations : null, landing_conversion: r.clicks > 0 ? r.registrations / r.clicks : null }));
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

async function readPlacementsDaily(from: string, to: string) {
  const res = await supabase
    .from("v_unified_placements_performance_daily")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .gte("metric_date", from)
    .lte("metric_date", to)
    .limit(5000);

  return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null };
}
