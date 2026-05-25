import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format } from "date-fns";
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
import { usePreferences } from "@/preferences/PreferencesProvider";

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
  const { compareMode, compareDisplay, setPref } = usePreferences();
  const [queryText, setQueryText] = useState("");
  const [showAll, setShowAll] = useState(false);
  const [selectedProject, setSelectedProject] = useState("all");
  const [selectedGroup, setSelectedGroup] = useState("all");
  const [activeTab, setActiveTab] = useState<"campaigns" | "placements">("campaigns");
  const from = format(date.resolved.from, "yyyy-MM-dd");
  const to = format(date.resolved.to, "yyyy-MM-dd");
  const dateSignature = `${date.mode}:${from}:${to}:${date.preset ?? ""}`;
  const previousDateSignatureRef = useRef(dateSignature);

  useEffect(() => {
    if (previousDateSignatureRef.current !== dateSignature) {
      previousDateSignatureRef.current = dateSignature;
      // Comparison is reset on date changes to avoid stale deltas being shown for a new date selection.
      if (compareMode !== "none") setPref("compareMode", "none");
    }
  }, [dateSignature, compareMode, setPref]);

  const comparisonRange = useMemo(() => {
    if (compareMode === "none") return null;
    // "yesterday" is only meaningful for exact-date mode; range comparisons should use "previous_period".
    if (compareMode === "yesterday" && date.mode !== "exact") return null;
    const days = differenceInCalendarDays(date.resolved.to, date.resolved.from) + 1;
    const comparisonToDate = addDays(date.resolved.from, -1);
    const comparisonFromDate = addDays(comparisonToDate, -(days - 1));
    return {
      from: format(comparisonFromDate, "yyyy-MM-dd"),
      to: format(comparisonToDate, "yyyy-MM-dd"),
    };
  }, [compareMode, date.mode, date.resolved.from, date.resolved.to]);

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
  const placementsQuery = useQuery({
    queryKey: ["campaigns-page-placements", WORKSPACE_ID, from, to],
    enabled: Boolean(session),
    queryFn: async () => readPlacementsDaily(from, to),
  });
  const comparisonQuery = useQuery({
    queryKey: ["campaigns-page-comparison", WORKSPACE_ID, compareMode, comparisonRange?.from, comparisonRange?.to],
    enabled: Boolean(session) && compareMode !== "none" && Boolean(comparisonRange),
    queryFn: async () => readDaily(comparisonRange!.from, comparisonRange!.to),
  });
  const comparisonPlacementsQuery = useQuery({
    queryKey: ["campaigns-page-placements-comparison", WORKSPACE_ID, compareMode, comparisonRange?.from, comparisonRange?.to],
    enabled: Boolean(session) && compareMode !== "none" && Boolean(comparisonRange),
    queryFn: async () => readPlacementsDaily(comparisonRange!.from, comparisonRange!.to),
  });

  const handleRefresh = () => {
    void query.refetch();
    void placementsQuery.refetch();
    if (compareMode !== "none" && comparisonRange) {
      void comparisonQuery.refetch();
      void comparisonPlacementsQuery.refetch();
    }
  };

  const isRefreshing =
    query.isFetching ||
    placementsQuery.isFetching ||
    (compareMode !== "none" && Boolean(comparisonRange) && (comparisonQuery.isFetching || comparisonPlacementsQuery.isFetching));

  const dailyRows = useMemo(() => (query.data?.daily.rows ?? []) as Row[], [query.data?.daily.rows]);
  const placementDailyRows = useMemo(() => (placementsQuery.data?.rows ?? []) as Row[], [placementsQuery.data?.rows]);

  const projectOptions = useMemo(() => buildOptionsFromRows([...dailyRows, ...placementDailyRows], getProjectValue), [dailyRows, placementDailyRows]);
  const groupOptions = useMemo(() => buildOptionsFromRows([...dailyRows, ...placementDailyRows], getGroupValue), [dailyRows, placementDailyRows]);

  const filteredDailyRows = useMemo(
    () => dailyRows.filter((row) => matchesFilters(row, selectedProject, selectedGroup)),
    [dailyRows, selectedProject, selectedGroup],
  );
  const filteredPlacementDailyRows = useMemo(
    () => placementDailyRows.filter((row) => matchesFilters(row, selectedProject, selectedGroup)),
    [placementDailyRows, selectedProject, selectedGroup],
  );
  const comparisonDailyRows = useMemo(() => (comparisonQuery.data?.rows ?? []) as Row[], [comparisonQuery.data?.rows]);
  const comparisonPlacementDailyRows = useMemo(
    () => (comparisonPlacementsQuery.data?.rows ?? []) as Row[],
    [comparisonPlacementsQuery.data?.rows],
  );
  const filteredComparisonDailyRows = useMemo(
    () => comparisonDailyRows.filter((row) => matchesFilters(row, selectedProject, selectedGroup)),
    [comparisonDailyRows, selectedProject, selectedGroup],
  );
  const filteredComparisonPlacementDailyRows = useMemo(
    () => comparisonPlacementDailyRows.filter((row) => matchesFilters(row, selectedProject, selectedGroup)),
    [comparisonPlacementDailyRows, selectedProject, selectedGroup],
  );

  const campaignRows = useMemo(() => aggregateCampaigns(filteredDailyRows), [filteredDailyRows]);
  const searchedCampaignRows = useMemo(
    () => campaignRows.filter((r) => r.campaign_name.toLowerCase().includes(queryText.toLowerCase())),
    [campaignRows, queryText],
  );
  const sortedCampaignRows = useMemo(() => [...searchedCampaignRows].sort((a, b) => b.spend - a.spend), [searchedCampaignRows]);
  const visibleCampaignRows = useMemo(() => (showAll ? sortedCampaignRows.slice(0, 200) : sortedCampaignRows.slice(0, 25)), [showAll, sortedCampaignRows]);
  const placementRows = useMemo(() => aggregatePlacements(filteredPlacementDailyRows), [filteredPlacementDailyRows]);
  const comparisonCampaignRows = useMemo(() => aggregateCampaigns(filteredComparisonDailyRows), [filteredComparisonDailyRows]);
  const comparisonPlacementRows = useMemo(
    () => aggregatePlacements(filteredComparisonPlacementDailyRows),
    [filteredComparisonPlacementDailyRows],
  );
  const searchedPlacementRows = useMemo(() => {
    const queryLower = queryText.toLowerCase();
    return placementRows.filter((r) => r.placement_name.toLowerCase().includes(queryLower) || r.landing_url.toLowerCase().includes(queryLower));
  }, [placementRows, queryText]);
  const sortedPlacementRows = useMemo(() => [...searchedPlacementRows].sort((a, b) => b.spend - a.spend), [searchedPlacementRows]);
  const visiblePlacementRows = useMemo(() => (showAll ? sortedPlacementRows : sortedPlacementRows.slice(0, 25)), [showAll, sortedPlacementRows]);

  const totals = useMemo(
    () =>
      searchedCampaignRows.reduce(
        (acc, row) => {
          acc.spend += row.spend;
          acc.clicks += row.clicks;
          acc.leads += row.leads;
          acc.reach += row.reach;
          return acc;
        },
        { spend: 0, clicks: 0, leads: 0, reach: 0 },
      ),
    [searchedCampaignRows],
  );
  const placementTotals = useMemo(
    () =>
      searchedPlacementRows.reduce(
        (acc, row) => {
          acc.spend += row.spend;
          acc.clicks += row.clicks;
          acc.registrations += row.registrations;
          acc.reach += row.reach;
          return acc;
        },
        { spend: 0, clicks: 0, registrations: 0, reach: 0 },
      ),
    [searchedPlacementRows],
  );
  const comparisonCampaignTotals = useMemo(
    () =>
      comparisonCampaignRows.reduce(
        (acc, row) => {
          acc.spend += row.spend;
          acc.clicks += row.clicks;
          acc.leads += row.leads;
          acc.reach += row.reach;
          return acc;
        },
        { spend: 0, clicks: 0, leads: 0, reach: 0 },
      ),
    [comparisonCampaignRows],
  );
  const comparisonPlacementTotals = useMemo(
    () =>
      comparisonPlacementRows.reduce(
        (acc, row) => {
          acc.spend += row.spend;
          acc.clicks += row.clicks;
          acc.registrations += row.registrations;
          acc.reach += row.reach;
          return acc;
        },
        { spend: 0, clicks: 0, registrations: 0, reach: 0 },
      ),
    [comparisonPlacementRows],
  );
  const showDeltas = compareMode !== "none" && Boolean(comparisonRange);

  const summaryCards = [
    kpi("Витрати", totals.spend, comparisonCampaignTotals.spend, "money", compareDisplay, showDeltas, "neutral"),
    kpi("Ліди", totals.leads, comparisonCampaignTotals.leads, "count", compareDisplay, showDeltas, "higher_good"),
    kpi("CPL", totals.leads > 0 ? totals.spend / totals.leads : null, comparisonCampaignTotals.leads > 0 ? comparisonCampaignTotals.spend / comparisonCampaignTotals.leads : null, "cost_per", compareDisplay, showDeltas, "lower_good"),
    kpi("Кліки", totals.clicks, comparisonCampaignTotals.clicks, "count", compareDisplay, showDeltas, "higher_good"),
    kpi("CPC", totals.clicks > 0 ? totals.spend / totals.clicks : null, comparisonCampaignTotals.clicks > 0 ? comparisonCampaignTotals.spend / comparisonCampaignTotals.clicks : null, "cost_per", compareDisplay, showDeltas, "lower_good"),
    kpi("Охоплення", totals.reach, comparisonCampaignTotals.reach, "count", compareDisplay, showDeltas, "higher_good"),
    kpi("Кампаній", searchedCampaignRows.length, comparisonCampaignRows.length, "count", compareDisplay, showDeltas, "neutral"),
  ];
  const placementSummaryCards = [
    kpi("Витрати", placementTotals.spend, comparisonPlacementTotals.spend, "money", compareDisplay, showDeltas, "neutral"),
    kpi("Реєстрації", placementTotals.registrations, comparisonPlacementTotals.registrations, "count", compareDisplay, showDeltas, "higher_good"),
    kpi("CPL", placementTotals.registrations > 0 ? placementTotals.spend / placementTotals.registrations : null, comparisonPlacementTotals.registrations > 0 ? comparisonPlacementTotals.spend / comparisonPlacementTotals.registrations : null, "cost_per", compareDisplay, showDeltas, "lower_good"),
    kpi("Кліки", placementTotals.clicks, comparisonPlacementTotals.clicks, "count", compareDisplay, showDeltas, "higher_good"),
    kpi("CPC", placementTotals.clicks > 0 ? placementTotals.spend / placementTotals.clicks : null, comparisonPlacementTotals.clicks > 0 ? comparisonPlacementTotals.spend / comparisonPlacementTotals.clicks : null, "cost_per", compareDisplay, showDeltas, "lower_good"),
    kpi("Охоплення", placementTotals.reach, comparisonPlacementTotals.reach, "count", compareDisplay, showDeltas, "higher_good"),
    kpi("Плейсментів", searchedPlacementRows.length, comparisonPlacementRows.length, "count", compareDisplay, showDeltas, "neutral"),
    kpi("Конверсія ленда", placementTotals.clicks > 0 ? (placementTotals.registrations / placementTotals.clicks) * 100 : null, comparisonPlacementTotals.clicks > 0 ? (comparisonPlacementTotals.registrations / comparisonPlacementTotals.clicks) * 100 : null, "rate", compareDisplay, showDeltas, "higher_good"),
  ];

  const filteredBindingsRows = useMemo(
    () => filterPlaceholderRows(query.data?.bindings.rows as Record<string, unknown>[] | undefined) as Row[],
    [query.data?.bindings.rows],
  );
  const filteredAnomaliesRows = useMemo(
    () => filterPlaceholderRows(query.data?.anomalies.rows as Record<string, unknown>[] | undefined) as Row[],
    [query.data?.anomalies.rows],
  );

  const noData = Boolean(session) && !query.isLoading && searchedCampaignRows.length === 0;
  const connectorStatus = String(query.data?.health.rows[0]?.ads_connector_status ?? query.data?.health.rows[0]?.status ?? "");
  const placementsUnavailable = Boolean(placementsQuery.data?.unavailableReason);
  const shouldShowPlacementsData = !placementsQuery.isLoading && !placementsUnavailable && sortedPlacementRows.length > 0;

  return <DashboardLayout title="Кампанії" subtitle="Ефективність рекламних кампаній"><div className="space-y-4"><FilterBar extra={<Input value={queryText} onChange={(e) => { setQueryText(e.target.value); setShowAll(false); }} placeholder={activeTab === "campaigns" ? "Пошук кампанії" : "Пошук плейсменту або URL"} className="h-8 w-[240px] text-xs" />} freshness={{ source: "Імпорт рекламних даних", status: "fresh", lastSync: "live" }} projectOptions={projectOptions} groupOptions={groupOptions} selectedProject={selectedProject} selectedGroup={selectedGroup} onProjectChange={(value) => { setSelectedProject(value); setShowAll(false); }} onGroupChange={(value) => { setSelectedGroup(value); setShowAll(false); }} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
    <div className="inline-flex rounded-lg border p-1">
      <Button variant={activeTab === "campaigns" ? "default" : "ghost"} size="sm" onClick={() => { setActiveTab("campaigns"); setShowAll(false); }}>Кампанії</Button>
      <Button variant={activeTab === "placements" ? "default" : "ghost"} size="sm" onClick={() => { setActiveTab("placements"); setShowAll(false); }}>Плейсменти</Button>
    </div>
    {!session ? <Msg t="Увійдіть, щоб переглянути дані кампаній." /> : query.isLoading ? <Msg t="Завантаження даних кампаній…" /> : null}
    {connectorStatus === "no_active_connections" ? <Msg t="Показані імпортовані рекламні дані. API-конектори можна підключити пізніше для автоматичного оновлення." /> : null}
    {activeTab === "campaigns" && noData ? <Msg t="За вибраний період рекламних даних не знайдено. Змініть період або перевірте імпорт трафіку." /> : null}
    {activeTab === "campaigns" && !noData ? <>
      <SectionCard title="Підсумок реклами" description="Зведені метрики за вибраний період">
        <KpiCards rows={summaryCards} />
      </SectionCard>
      <SectionCard title="Кампанії" description="Ефективність кампаній" noPadding>
        <div className="px-4 pt-4 text-sm text-muted-foreground">Показано {visibleCampaignRows.length} з {sortedCampaignRows.length} кампаній</div>
        <div className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>Кампанія</TableHead><TableHead className="whitespace-nowrap">Період</TableHead><TableHead className="whitespace-nowrap text-right">Витрати</TableHead><TableHead className="whitespace-nowrap text-right">Ліди</TableHead><TableHead className="whitespace-nowrap text-right">CPL</TableHead><TableHead className="whitespace-nowrap text-right">Кліки</TableHead><TableHead className="whitespace-nowrap text-right">CPC</TableHead><TableHead className="whitespace-nowrap text-right">Охоплення</TableHead></TableRow></TableHeader><TableBody>{visibleCampaignRows.map((r, i) => <TableRow key={`${r.campaign_name}-${i}`}><TableCell>{r.campaign_name}</TableCell><TableCell className="whitespace-nowrap">{formatPeriod(r.first_date, r.last_date)}</TableCell><TableCell className="whitespace-nowrap text-right num">{fmtCurrency(r.spend)}</TableCell><TableCell className="whitespace-nowrap text-right num">{fmtNum(r.leads)}</TableCell><TableCell className="whitespace-nowrap text-right num">{formatCostPer(r.cpl)}</TableCell><TableCell className="whitespace-nowrap text-right num">{fmtNum(r.clicks)}</TableCell><TableCell className="whitespace-nowrap text-right num">{formatCostPer(r.cpc)}</TableCell><TableCell className="whitespace-nowrap text-right num">{fmtNum(r.reach)}</TableCell></TableRow>)}</TableBody></Table>
        </div>
        <div className="flex items-center justify-between px-4 pb-4 pt-2 text-sm">
          <span className="text-muted-foreground">Показано {visibleCampaignRows.length} з {sortedCampaignRows.length} кампаній</span>
          {!showAll && sortedCampaignRows.length > 25 ? <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>Показати всі</Button> : null}
        </div>
      </SectionCard>
    </> : <>
      {placementsQuery.isLoading ? <Msg t="Завантаження плейсментів…" /> : null}
      {!placementsQuery.isLoading && placementsUnavailable ? <Msg t="Плейсменти поки недоступні. Кампанії працюють, але дані плейсментів треба перевірити в Supabase." /> : null}
      {!placementsQuery.isLoading && !placementsUnavailable && sortedPlacementRows.length === 0 ? <Msg t="За вибраний період плейсменти не знайдені. Змініть період або перевірте імпорт вкладок з плейсментами." /> : null}
      {shouldShowPlacementsData ? <>
        <SectionCard title="Підсумок плейсментів" description="Зведені метрики за вибраний період"><KpiCards rows={placementSummaryCards} /></SectionCard>
        <SectionCard title="Плейсменти" description="Ефективність плейсментів" noPadding>
        <div className="px-4 pt-4 text-sm text-muted-foreground">Показано {visiblePlacementRows.length} з {sortedPlacementRows.length} плейсментів</div>
        <div className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead>Плейсмент</TableHead><TableHead>URL</TableHead><TableHead className="whitespace-nowrap">Період</TableHead><TableHead className="whitespace-nowrap text-right">Витрати</TableHead><TableHead className="whitespace-nowrap text-right">Реєстрації</TableHead><TableHead className="whitespace-nowrap text-right">CPL</TableHead><TableHead className="whitespace-nowrap text-right">Кліки</TableHead><TableHead className="whitespace-nowrap text-right">CPC</TableHead><TableHead className="whitespace-nowrap text-right">Охоплення</TableHead><TableHead className="whitespace-nowrap text-right">Конверсія ленда</TableHead></TableRow></TableHeader><TableBody>{visiblePlacementRows.map((r, i) => <TableRow key={`${r.placement_name}-${r.landing_url}-${i}`}><TableCell>{r.placement_name || "—"}</TableCell><TableCell>{r.landing_url ? <a href={r.landing_url} target="_blank" rel="noreferrer" className="underline">Відкрити</a> : "—"}</TableCell><TableCell className="whitespace-nowrap">{formatPeriod(r.first_date, r.last_date)}</TableCell><TableCell className="whitespace-nowrap text-right num">{fmtCurrency(r.spend)}</TableCell><TableCell className="whitespace-nowrap text-right num">{fmtNum(r.registrations)}</TableCell><TableCell className="whitespace-nowrap text-right num">{formatCostPer(r.cpl)}</TableCell><TableCell className="whitespace-nowrap text-right num">{fmtNum(r.clicks)}</TableCell><TableCell className="whitespace-nowrap text-right num">{formatCostPer(r.cpc)}</TableCell><TableCell className="whitespace-nowrap text-right num">{fmtNum(r.reach)}</TableCell><TableCell className="whitespace-nowrap text-right num">{r.landing_conversion == null ? "—" : `${(r.landing_conversion * 100).toFixed(1)}%`}</TableCell></TableRow>)}</TableBody></Table>
        </div>
        <div className="flex items-center justify-between px-4 pb-4 pt-2 text-sm">
          <span className="text-muted-foreground">Показано {visiblePlacementRows.length} з {sortedPlacementRows.length} плейсментів</span>
          {!showAll && sortedPlacementRows.length > 25 ? <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>Показати всі</Button> : null}
        </div>
        </SectionCard>
      </> : null}
    </>}
    {filteredBindingsRows.length > 0 ? <details className="rounded border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Додатково: стан звʼязків</summary>
      <SectionCard title="Стан звʼязків" description="Підключені рекламні акаунти (опційно)" noPadding><Simple rows={filteredBindingsRows} columns={[{ key: "platform", label: "Платформа" }, { key: "ad_account_name", label: "Рекламний акаунт" }, { key: "mapping_status", label: "Статус мапінгу" }, { key: "binding_status", label: "Статус звʼязку" }, { key: "updated_at", label: "Оновлено" }]} empty="Додаткові дані про звʼязки недоступні." /></SectionCard>
    </details>
    : null}
    {filteredAnomaliesRows.length > 0 ? <details className="rounded border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">Додатково: аномалії</summary>
      <SectionCard title="Аномалії" description="Потенційні аномалії кампаній (опційно)" noPadding><Simple rows={filteredAnomaliesRows} columns={[{ key: "severity", label: "Рівень" }, { key: "title", label: "Назва" }, { key: "reason", label: "Причина" }, { key: "created_at", label: "Створено" }]} empty="Додаткові дані про аномалії недоступні." /></SectionCard>
    </details>
    : null}
  </div></DashboardLayout>;
}
function aggregatePlacements(rows: Row[]): PlacementAgg[] {
  const map = new Map<string, PlacementAgg>();
  (rows ?? []).forEach((row) => {
    const placement_name = String(row.placement_name ?? "");
    const landing_url = String(row.landing_url ?? "");
    const key = `${placement_name}||${landing_url}`;
    const metricDate = String(row.metric_date ?? "");
    const spend = Number(row.spend ?? 0);
    const reach = Number(row.reach ?? 0);
    const clicks = Number(row.clicks ?? 0);
    const registrations = Number(row.registrations ?? 0);
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

const Msg = ({ t }: { t: string }) => <p className="rounded border p-3 text-sm text-muted-foreground">{t}</p>;

function KpiCards({ rows }: { rows: { label: string; value: string }[] }) {
  const wideCols = rows.length >= 8 ? "xl:grid-cols-8" : rows.length === 7 ? "xl:grid-cols-7" : "xl:grid-cols-6";

  return <div className={`grid grid-cols-2 gap-2 sm:grid-cols-3 md:grid-cols-4 ${wideCols}`}>{rows.map((r) => <div key={r.label} className="rounded-lg border p-2"><div className="truncate text-xs text-muted-foreground">{r.label}</div><div className="mt-1 text-base font-semibold num">{r.value}</div>{"delta" in r && r.delta ? <div className={`mt-1 whitespace-nowrap text-[11px] ${r.delta.tone === "positive" ? "text-emerald-600" : r.delta.tone === "negative" ? "text-red-600" : "text-muted-foreground"}`}>{r.delta.text}</div> : null}</div>)}</div>;
}

type KpiKind = "money" | "count" | "rate" | "cost_per";
type KpiDirection = "higher_good" | "lower_good" | "neutral";
type KpiCard = { label: string; value: string; delta?: { text: string; tone: "positive" | "negative" | "neutral" } };

function kpi(
  label: string,
  current: number | null,
  comparison: number | null,
  kind: KpiKind,
  compareDisplay: "percent" | "absolute",
  showDelta: boolean,
  direction: KpiDirection,
): KpiCard {
  return {
    label,
    value: formatKpiValue(current, kind),
    delta: showDelta ? buildDelta(current, comparison, kind, compareDisplay, direction) : undefined,
  };
}

function formatKpiValue(value: number | null, kind: KpiKind) {
  if (value == null) return "—";
  if (kind === "money") return fmtCurrency(value);
  if (kind === "cost_per") return formatCostPer(value);
  if (kind === "rate") return `${value.toFixed(1)}%`;
  return fmtNum(value);
}

function buildDelta(
  current: number | null,
  comparison: number | null,
  kind: KpiKind,
  compareDisplay: "percent" | "absolute",
  direction: KpiDirection,
) {
  if (current == null || comparison == null) return { text: "—", tone: "neutral" as const };
  const absolute = current - comparison;
  const percent = comparison === 0 ? null : (absolute / comparison) * 100;
  const tone = resolveDeltaTone(absolute, direction);
  if (compareDisplay === "percent") {
    if (percent == null) return { text: "—", tone: "neutral" as const };
    const sign = percent > 0 ? "+" : "";
    return { text: `${sign}${percent.toFixed(1)}%`, tone };
  }
  const sign = absolute > 0 ? "+" : "";
  if (kind === "money") return { text: formatSignedCurrency(absolute), tone };
  if (kind === "cost_per") return { text: formatSignedCostPer(absolute), tone };
  if (kind === "rate") return { text: `${sign}${absolute.toFixed(1)} п.п.`, tone };
  return { text: `${sign}${fmtNum(absolute)}`, tone };
}

function resolveDeltaTone(absolute: number, direction: KpiDirection): "positive" | "negative" | "neutral" {
  if (absolute === 0 || direction === "neutral") return "neutral";
  if (direction === "higher_good") return absolute > 0 ? "positive" : "negative";
  return absolute > 0 ? "negative" : "positive";
}

function formatSignedCurrency(value: number) {
  const base = fmtCurrency(Math.abs(value));
  if (value > 0) return `+${base}`;
  if (value < 0) return `-${base}`;
  return base;
}

function formatCostPer(value: number | null) {
  if (value == null) return "—";
  return `$${value.toFixed(2)}`;
}

function formatSignedCostPer(value: number) {
  const base = `$${Math.abs(value).toFixed(2)}`;
  if (value > 0) return `+${base}`;
  if (value < 0) return `-${base}`;
  return base;
}

function readField(row: Row, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value == null) continue;
    const text = String(value).trim();
    if (text) return text;
  }
  return null;
}

function getProjectValue(row: Row) {
  return readField(row, ["project_name", "project", "client_project_name", "funnel_name", "project_id"]);
}

function getGroupValue(row: Row) {
  return readField(row, ["ad_set_name", "adset_name", "ad_set", "ad_group_name", "group_name", "report_group", "traffic_group", "group_id"]);
}

function buildOptionsFromRows(rows: Row[], getter: (row: Row) => string | null) {
  const map = new Map<string, { id: string; label: string }>();
  rows.forEach((row) => {
    const value = getter(row);
    if (!value) return;
    if (!map.has(value)) map.set(value, { id: value, label: value });
  });
  return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "uk"));
}

function matchesFilters(row: Row, selectedProject: string, selectedGroup: string) {
  const project = getProjectValue(row);
  const group = getGroupValue(row);
  const projectMatch = selectedProject === "all" || project === selectedProject;
  const groupMatch = selectedGroup === "all" || group === selectedGroup;
  return projectMatch && groupMatch;
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
async function readPlacementsDaily(from: string, to: string) {
  const res = await supabase
    .from("v_unified_placements_performance_daily")
    .select("*")
    .eq("workspace_id", WORKSPACE_ID)
    .gte("metric_date", from)
    .lte("metric_date", to)
    .limit(10000);

  return { rows: (res.data ?? []) as Row[], unavailableReason: res.error?.message ?? null };
}
