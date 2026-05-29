import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, differenceInCalendarDays, format, isValid, parseISO } from "date-fns";
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
import { useI18n } from "@/i18n/I18nProvider";

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

type SourceDiagnosticsData = {
  factCount: number;
  performanceCount: number;
  missing: string[];
  unavailableReason: string | null;
};

export default function Campaigns() {
  const { session } = useAuth();
  const date = useDateFilter();
  const { compareMode, compareDisplay, setPref } = usePreferences();
  const { t } = useI18n();
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
  const sourceDiagnosticsQuery = useQuery({
    queryKey: ["campaigns-page-source-diagnostics", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => readSourceDiagnostics(),
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

  const dataBoundsQuery = useQuery({
    queryKey: ["campaigns-page-data-bounds", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => readCampaignsDataBounds(),
  });

  useEffect(() => {
    const bounds = dataBoundsQuery.data;
    if (bounds?.from && bounds?.to) {
      date.setDataBounds({ from: parseISO(bounds.from), to: parseISO(bounds.to) });
      return;
    }
    date.setDataBounds(null);
  }, [dataBoundsQuery.data, date]);

  useEffect(() => () => {
    date.setDataBounds(null);
  }, [date]);

  const handleRefresh = () => {
    void query.refetch();
    void placementsQuery.refetch();
    void sourceDiagnosticsQuery.refetch();
    if (compareMode !== "none" && comparisonRange) {
      void comparisonQuery.refetch();
      void comparisonPlacementsQuery.refetch();
    }
  };

  const isRefreshing =
    query.isFetching ||
    placementsQuery.isFetching ||
    sourceDiagnosticsQuery.isFetching ||
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
    kpi(t("kpiSpend"), totals.spend, comparisonCampaignTotals.spend, "money", compareDisplay, showDeltas, "neutral"),
    kpi(t("kpiLeads"), totals.leads, comparisonCampaignTotals.leads, "count", compareDisplay, showDeltas, "higher_good"),
    kpi("CPL", totals.leads > 0 ? totals.spend / totals.leads : null, comparisonCampaignTotals.leads > 0 ? comparisonCampaignTotals.spend / comparisonCampaignTotals.leads : null, "cost_per", compareDisplay, showDeltas, "lower_good"),
    kpi(t("kpiClicks"), totals.clicks, comparisonCampaignTotals.clicks, "count", compareDisplay, showDeltas, "higher_good"),
    kpi("CPC", totals.clicks > 0 ? totals.spend / totals.clicks : null, comparisonCampaignTotals.clicks > 0 ? comparisonCampaignTotals.spend / comparisonCampaignTotals.clicks : null, "cost_per", compareDisplay, showDeltas, "lower_good"),
    kpi(t("kpiReach"), totals.reach, comparisonCampaignTotals.reach, "count", compareDisplay, showDeltas, "higher_good"),
    kpi(t("kpiCampaigns"), searchedCampaignRows.length, comparisonCampaignRows.length, "count", compareDisplay, showDeltas, "neutral"),
  ];
  const placementSummaryCards = [
    kpi(t("kpiSpend"), placementTotals.spend, comparisonPlacementTotals.spend, "money", compareDisplay, showDeltas, "neutral"),
    kpi(t("kpiRegistrations"), placementTotals.registrations, comparisonPlacementTotals.registrations, "count", compareDisplay, showDeltas, "higher_good"),
    kpi("CPL", placementTotals.registrations > 0 ? placementTotals.spend / placementTotals.registrations : null, comparisonPlacementTotals.registrations > 0 ? comparisonPlacementTotals.spend / comparisonPlacementTotals.registrations : null, "cost_per", compareDisplay, showDeltas, "lower_good"),
    kpi(t("kpiClicks"), placementTotals.clicks, comparisonPlacementTotals.clicks, "count", compareDisplay, showDeltas, "higher_good"),
    kpi("CPC", placementTotals.clicks > 0 ? placementTotals.spend / placementTotals.clicks : null, comparisonPlacementTotals.clicks > 0 ? comparisonPlacementTotals.spend / comparisonPlacementTotals.clicks : null, "cost_per", compareDisplay, showDeltas, "lower_good"),
    kpi(t("kpiReach"), placementTotals.reach, comparisonPlacementTotals.reach, "count", compareDisplay, showDeltas, "higher_good"),
    kpi(t("kpiPlacements"), searchedPlacementRows.length, comparisonPlacementRows.length, "count", compareDisplay, showDeltas, "neutral"),
    kpi(t("kpiLandingConversion"), placementTotals.clicks > 0 ? (placementTotals.registrations / placementTotals.clicks) * 100 : null, comparisonPlacementTotals.clicks > 0 ? (comparisonPlacementTotals.registrations / comparisonPlacementTotals.clicks) * 100 : null, "rate", compareDisplay, showDeltas, "higher_good"),
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

  return <DashboardLayout title={t("campaignsTitle")} subtitle={t("campaignsSubtitle")}><div className="space-y-4"><FilterBar extra={<Input value={queryText} onChange={(e) => { setQueryText(e.target.value); setShowAll(false); }} placeholder={activeTab === "campaigns" ? t("campaignsSearchCampaign") : t("campaignsSearchPlacement")} className="h-8 w-[240px] text-xs" />} freshness={{ source: t("campaignsFreshnessSource"), status: "fresh", lastSync: "live" }} projectOptions={projectOptions} groupOptions={groupOptions} selectedProject={selectedProject} selectedGroup={selectedGroup} onProjectChange={(value) => { setSelectedProject(value); setShowAll(false); }} onGroupChange={(value) => { setSelectedGroup(value); setShowAll(false); }} onRefresh={handleRefresh} isRefreshing={isRefreshing} />
    <div className="inline-flex rounded-lg border p-1">
      <Button variant={activeTab === "campaigns" ? "default" : "ghost"} size="sm" onClick={() => { setActiveTab("campaigns"); setShowAll(false); }}>{t("campaignsTabCampaigns")}</Button>
      <Button variant={activeTab === "placements" ? "default" : "ghost"} size="sm" onClick={() => { setActiveTab("placements"); setShowAll(false); }}>{t("campaignsTabPlacements")}</Button>
    </div>
    {!session ? <Msg t={t("campaignsLoginRequired")} /> : query.isLoading ? <Msg t={t("campaignsLoading")} /> : null}
    {connectorStatus === "no_active_connections" ? <Msg t={t("campaignsImportedDataNotice")} /> : null}
    {activeTab === "campaigns" && noData ? <Msg t={t("campaignsNoData")} /> : null}
    {activeTab === "campaigns" && !noData ? <>
      <SectionCard title={t("campaignsAdSummaryTitle")} description={t("campaignsAdSummaryDescription")}>
        <KpiCards rows={summaryCards} />
      </SectionCard>
      <SectionCard title={t("campaignsTitle")} description={t("campaignsTableDescription")} noPadding>
        <div className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead className="whitespace-nowrap py-2 text-[10px] leading-tight tracking-normal">{t("tableCampaign")}</TableHead><TableHead className="whitespace-nowrap py-2 text-[10px] leading-tight tracking-normal">{t("tablePeriod")}</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">{t("tableSpend")}</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">{t("tableLeads")}</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">CPL</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">{t("tableClicks")}</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">CPC</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">{t("tableReachShort")}</TableHead></TableRow></TableHeader><TableBody>{visibleCampaignRows.map((r, i) => <TableRow key={`${r.campaign_name}-${i}`}><TableCell className="max-w-[360px] truncate py-2 text-sm" title={r.campaign_name}>{r.campaign_name}</TableCell><TableCell className="whitespace-nowrap py-2 text-sm">{formatPeriod(r.first_date, r.last_date)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{fmtCurrency(r.spend)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{fmtNum(r.leads)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{formatCostPer(r.cpl)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{fmtNum(r.clicks)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{formatCostPer(r.cpc)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{fmtNum(r.reach)}</TableCell></TableRow>)}</TableBody></Table>
        </div>
        <div className="flex items-center justify-between px-4 pb-4 pt-2 text-sm">
          <span className="text-muted-foreground">{t("campaignsShown")} {visibleCampaignRows.length} {t("campaignsOf")} {sortedCampaignRows.length} {t("campaignsCountCampaigns")}</span>
          {!showAll && sortedCampaignRows.length > 25 ? <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>{t("campaignsShowAll")}</Button> : null}
        </div>
      </SectionCard>
    </> : <>
      {placementsQuery.isLoading ? <Msg t={t("placementsLoading")} /> : null}
      {!placementsQuery.isLoading && placementsUnavailable ? <Msg t={t("placementsUnavailable")} /> : null}
      {!placementsQuery.isLoading && !placementsUnavailable && sortedPlacementRows.length === 0 ? <Msg t={t("placementsNoData")} /> : null}
      {shouldShowPlacementsData ? <>
        <SectionCard title={t("campaignsPlacementsSummaryTitle")} description={t("campaignsPlacementsSummaryDescription")}><KpiCards rows={placementSummaryCards} /></SectionCard>
        <SectionCard title={t("placementsTableTitle")} description={t("placementsTableDescription")} noPadding>
        <div className="overflow-x-auto">
          <Table><TableHeader><TableRow><TableHead className="whitespace-nowrap py-2 text-[10px] leading-tight tracking-normal">{t("tablePlacement")}</TableHead><TableHead className="whitespace-nowrap py-2 text-[10px] leading-tight tracking-normal">{t("tableUrl")}</TableHead><TableHead className="whitespace-nowrap py-2 text-[10px] leading-tight tracking-normal">{t("tablePeriod")}</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">{t("tableSpend")}</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">{t("tableRegs")}</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">CPL</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">{t("tableClicks")}</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">CPC</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">{t("tableReachShort")}</TableHead><TableHead className="whitespace-nowrap py-2 text-right text-[10px] leading-tight tracking-normal">{t("tableLandingConvShort")}</TableHead></TableRow></TableHeader><TableBody>{visiblePlacementRows.map((r, i) => <TableRow key={`${r.placement_name}-${r.landing_url}-${i}`}><TableCell className="max-w-[360px] truncate py-2 text-sm" title={r.placement_name || "—"}>{r.placement_name || "—"}</TableCell><TableCell className="whitespace-nowrap py-2 text-sm">{r.landing_url ? <a href={r.landing_url} target="_blank" rel="noreferrer" className="underline">{t("tableOpen")}</a> : "—"}</TableCell><TableCell className="whitespace-nowrap py-2 text-sm">{formatPeriod(r.first_date, r.last_date)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{fmtCurrency(r.spend)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{fmtNum(r.registrations)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{formatCostPer(r.cpl)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{fmtNum(r.clicks)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{formatCostPer(r.cpc)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{fmtNum(r.reach)}</TableCell><TableCell className="whitespace-nowrap py-2 text-right text-sm num">{r.landing_conversion == null ? "—" : `${(r.landing_conversion * 100).toFixed(1)}%`}</TableCell></TableRow>)}</TableBody></Table>
        </div>
        <div className="flex items-center justify-between px-4 pb-4 pt-2 text-sm">
          <span className="text-muted-foreground">{t("campaignsShown")} {visiblePlacementRows.length} {t("campaignsOf")} {sortedPlacementRows.length} {t("campaignsCountPlacements")}</span>
          {!showAll && sortedPlacementRows.length > 25 ? <Button variant="outline" size="sm" onClick={() => setShowAll(true)}>{t("campaignsShowAll")}</Button> : null}
        </div>
        </SectionCard>
      </> : null}
      {session ? <SourceDiagnostics data={sourceDiagnosticsQuery.data} isLoading={sourceDiagnosticsQuery.isLoading} t={t} /> : null}
    </>}
    {filteredBindingsRows.length > 0 ? <details className="rounded border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("campaignsExtraBindings")}</summary>
      <SectionCard title={t("campaignsBindingsTitle")} description={t("campaignsBindingsDescription")} noPadding><Simple rows={filteredBindingsRows} columns={[{ key: "platform", label: t("tablePlatform") }, { key: "ad_account_name", label: t("tableAdAccount") }, { key: "mapping_status", label: t("tableMappingStatus") }, { key: "binding_status", label: t("tableBindingStatus") }, { key: "updated_at", label: t("tableUpdatedAt") }]} empty={t("bindingsEmpty")} /></SectionCard>
    </details>
    : null}
    {filteredAnomaliesRows.length > 0 ? <details className="rounded border">
      <summary className="cursor-pointer px-4 py-3 text-sm font-medium">{t("campaignsExtraAnomalies")}</summary>
      <SectionCard title={t("campaignsAnomaliesTitle")} description={t("campaignsAnomaliesDescription")} noPadding><Simple rows={filteredAnomaliesRows} columns={[{ key: "severity", label: t("tableSeverity") }, { key: "title", label: t("tableTitle") }, { key: "reason", label: t("tableReason") }, { key: "created_at", label: t("tableCreatedAt") }]} empty={t("anomaliesEmpty")} /></SectionCard>
    </details>
    : null}
  </div></DashboardLayout>;
}
type Translate = ReturnType<typeof useI18n>["t"];

function SourceDiagnostics({ data, isLoading, t }: { data?: SourceDiagnosticsData; isLoading: boolean; t: Translate }) {
  const rows = [
    kpi(t("sourceDiagnosticsRawFactPlacements"), data?.factCount ?? null, null, "count", "absolute", false, "neutral"),
    kpi(t("sourceDiagnosticsPerformancePlacements"), data?.performanceCount ?? null, null, "count", "absolute", false, "neutral"),
    kpi(t("sourceDiagnosticsMissingFromPerformance"), data?.missing.length ?? null, null, "count", "absolute", false, "neutral"),
  ];

  return (
    <SectionCard title={t("sourceDiagnosticsTitle")} description={t("sourceDiagnosticsDescription")} noPadding>
      <div className="space-y-3 p-4">
        <div className="inline-flex rounded-full border px-2.5 py-1 text-xs font-medium text-muted-foreground">
          {t("sourceDiagnosticsScope")}
        </div>
        {isLoading ? <Msg t={t("sourceDiagnosticsLoading")} /> : null}
        {!isLoading && data?.unavailableReason ? <Msg t={`${t("sourceDiagnosticsUnavailable")} ${data.unavailableReason}`} /> : null}
        {!isLoading && data && !data.unavailableReason ? (
          <>
            <KpiCards rows={rows} />
            {data.missing.length > 0 ? (
              <div className="overflow-x-auto rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="whitespace-nowrap py-2 text-[10px] leading-tight tracking-normal">{t("tableSource")}</TableHead>
                      <TableHead className="whitespace-nowrap py-2 text-[10px] leading-tight tracking-normal">{t("tableStatus")}</TableHead>
                      <TableHead className="whitespace-nowrap py-2 text-[10px] leading-tight tracking-normal">{t("tableNote")}</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {data.missing.map((source) => (
                      <TableRow key={source}>
                        <TableCell className="whitespace-nowrap py-2 text-sm font-medium">{source}</TableCell>
                        <TableCell className="whitespace-nowrap py-2 text-sm">{t("sourceDiagnosticsStatus")}</TableCell>
                        <TableCell className="py-2 text-sm text-muted-foreground">{t("sourceDiagnosticsNote")}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            ) : (
              <Msg t={t("sourceDiagnosticsEmpty")} />
            )}
          </>
        ) : null}
      </div>
    </SectionCard>
  );
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
  const first = parseISO(firstDate);
  const last = parseISO(lastDate);
  if (!isValid(first) || !isValid(last)) {
    if (firstDate === lastDate) return firstDate || "—";
    return `${firstDate || "—"} — ${lastDate || "—"}`;
  }
  if (firstDate === lastDate) return format(first, "dd.MM");
  if (format(first, "yyyy") === format(last, "yyyy")) {
    return `${format(first, "dd.MM")} — ${format(last, "dd.MM")}`;
  }
  return `${format(first, "dd.MM.yyyy")} — ${format(last, "dd.MM.yyyy")}`;
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

async function readSourceDiagnostics(): Promise<SourceDiagnosticsData> {
  const [fact, performance] = await Promise.all([
    readPlacementNames("fact_placements"),
    readPlacementNames("placement_performance_raw"),
  ]);
  const unavailableReason = [fact.unavailableReason, performance.unavailableReason].filter(Boolean).join(" ") || null;

  if (unavailableReason) {
    return { factCount: 0, performanceCount: 0, missing: [], unavailableReason };
  }

  const factNames = buildPlacementNameMap(fact.rows);
  const performanceNames = buildPlacementNameMap(performance.rows);
  const missing = Array.from(factNames.entries())
    .filter(([normalized]) => !performanceNames.has(normalized))
    .map(([, display]) => display)
    .sort((a, b) => a.localeCompare(b, "uk"));

  return {
    factCount: factNames.size,
    performanceCount: performanceNames.size,
    missing,
    unavailableReason: null,
  };
}

async function readPlacementNames(tableName: "fact_placements" | "placement_performance_raw") {
  const pageSize = 1000;
  const maxRows = 50000;
  const rows: Row[] = [];

  for (let from = 0; from < maxRows; from += pageSize) {
    const to = from + pageSize - 1;
    const res = await supabase
      .from(tableName)
      .select("placement_name")
      .eq("workspace_id", WORKSPACE_ID)
      .not("placement_name", "is", null)
      .order("placement_name", { ascending: true })
      .range(from, to);

    if (res.error) return { rows: [] as Row[], unavailableReason: res.error.message };

    const page = (res.data ?? []) as Row[];
    rows.push(...page);
    if (page.length < pageSize) break;
  }

  return { rows, unavailableReason: null };
}

function buildPlacementNameMap(rows: Row[]) {
  const map = new Map<string, string>();
  rows.forEach((row) => {
    const placementName = normalizePlacementName(row.placement_name);
    if (!placementName || map.has(placementName)) return;
    map.set(placementName, placementName);
  });
  return map;
}

function normalizePlacementName(value: Row[string]) {
  if (value == null) return null;
  const text = String(value).trim();
  return text || null;
}

async function readMetricDateBound(viewName: "v_unified_ads_performance_daily" | "v_unified_placements_performance_daily", ascending: boolean) {
  const res = await supabase
    .from(viewName)
    .select("metric_date")
    .eq("workspace_id", WORKSPACE_ID)
    .order("metric_date", { ascending })
    .limit(1);

  if (res.error || !res.data?.length) return null;
  const metricDate = res.data[0]?.metric_date;
  return typeof metricDate === "string" && metricDate ? metricDate : null;
}

async function readCampaignsDataBounds() {
  const [adsMin, adsMax, placementsMin, placementsMax] = await Promise.all([
    readMetricDateBound("v_unified_ads_performance_daily", true),
    readMetricDateBound("v_unified_ads_performance_daily", false),
    readMetricDateBound("v_unified_placements_performance_daily", true),
    readMetricDateBound("v_unified_placements_performance_daily", false),
  ]);

  const mins = [adsMin, placementsMin].filter((value): value is string => Boolean(value));
  const maxs = [adsMax, placementsMax].filter((value): value is string => Boolean(value));

  if (!mins.length || !maxs.length) return null;

  return {
    from: mins.reduce((acc, value) => (value < acc ? value : acc)),
    to: maxs.reduce((acc, value) => (value > acc ? value : acc)),
  };
}
