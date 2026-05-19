import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
import { KpiGrid } from "@/components/dashboard/KpiCard";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import {
  overviewKpis,
  revenueVsSpend,
  topCampaigns,
  topReportGroups,
  anomalies,
  dataFreshness,
  aiInsights,
  dailyAnalytics,
  importRuns,
  unknownMappings,
  type DailyRow,
} from "@/data/mock";
import { fmtCurrency, fmtNum } from "@/lib/format";
import {
  Area,
  AreaChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Sparkles,
  Download,
  AlertTriangle,
  AlertCircle,
  Info,
  CheckCircle2,
  Clock,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/auth/AuthProvider";
import { useWorkspaceRole } from "@/hooks/useWorkspaceRole";

const WORKSPACE_ID = "5ebbe435-fd79-44c3-834e-642e8fba00dc";

type BackendSnapshotRow = {
  technical_status: string | null;
  failed_checks: number | null;
  production_backend_status: string | null;
  onboarding_status: string | null;
  binding_status: string | null;
  mapping_review_status: string | null;
  telegram_hitl_status: string | null;
  telegram_production_status: string | null;
  operational_alerts_status: string | null;
  ads_connector_status: string | null;
};
type UiBackendContractRow = Record<string, string | number | boolean | null>;

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  boxShadow: "0 4px 12px hsl(222 25% 12% / 0.08)",
};

export default function Overview() {
  const { t, lang } = useI18n();
  const { session } = useAuth();
  const [viewMode, setViewMode] = useState<"summary" | "daily">("summary");
  const [selectedDay, setSelectedDay] = useState<DailyRow | null>(null);
  const { role, capabilities, isLoading: roleLoading, error: roleError } = useWorkspaceRole(WORKSPACE_ID);

  const failedCount = useMemo(() => importRuns.filter((r) => r.status === "failed").length, []);
  const partialCount = useMemo(() => importRuns.filter((r) => r.status === "partial").length, []);
  const lastSuccess = useMemo(() => importRuns.find((r) => r.status === "success"), []);

  const readinessQuery = useQuery({
    queryKey: ["backend-readiness", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase
        .from("v_production_backend_snapshot")
        .select(
          "technical_status, failed_checks, production_backend_status, onboarding_status, binding_status, mapping_review_status, telegram_hitl_status, telegram_production_status, operational_alerts_status, ads_connector_status",
        )
        .eq("workspace_id", WORKSPACE_ID)
        .maybeSingle();

      if (error) throw error;
      return (data as BackendSnapshotRow | null) ?? null;
    },
  });
  const uiContractQuery = useQuery({
    queryKey: ["ui-backend-contract", WORKSPACE_ID],
    enabled: Boolean(session),
    queryFn: async () => {
      const result = await supabase
        .from("v_ui_backend_contract")
        .select("*")
        .eq("workspace_id", WORKSPACE_ID)
        .limit(20);
      if (result.error) return { unavailableReason: result.error.message, rows: [] as UiBackendContractRow[] };
      return { unavailableReason: null, rows: (result.data ?? []) as UiBackendContractRow[] };
    },
  });

  return (
    <DashboardLayout
      title={t("overviewTitle")}
      subtitle={t("overviewSubtitle")}
      sync={{ source: "Meta · GA · CRM", lastSync: "2 min", status: "fresh" }}
      actions={
        <>
          <Button variant="outline" size="sm" className="h-9 gap-1.5 border-border/70 bg-card/60">
            <Download className="h-3.5 w-3.5" />
            {t("export")}
          </Button>
          <Button
            size="sm"
            className="h-9 gap-1.5 bg-gradient-accent text-primary-foreground shadow-card-md hover:opacity-95"
          >
            <Sparkles className="h-3.5 w-3.5" />
            {t("askAi")}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FilterBar
          freshness={{ source: t("lastSync"), status: "fresh", lastSync: "2 min" }}
          showViewMode
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Operational status row */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <OpsCard
            label={t("lastSuccessSync")}
            value={lastSuccess?.startedAt ?? "—"}
            sub={lastSuccess?.source ?? ""}
            icon={<CheckCircle2 className="h-4 w-4 text-success" />}
            tone="success"
          />
          <OpsCard
            label={t("failedImport")}
            value={String(failedCount)}
            sub={failedCount > 0 ? "TikTok Ads · auth" : ""}
            icon={<XCircle className="h-4 w-4 text-destructive" />}
            tone={failedCount > 0 ? "destructive" : "neutral"}
          />
          <OpsCard
            label={t("partialImport")}
            value={String(partialCount)}
            sub={partialCount > 0 ? "Sheets · mapping" : ""}
            icon={<AlertTriangle className="h-4 w-4 text-warning-foreground" />}
            tone={partialCount > 0 ? "warning" : "neutral"}
          />
          <OpsCard
            label={t("unmappedQueue")}
            value={String(unknownMappings.length)}
            sub={t("awaitingReview")}
            icon={<Clock className="h-4 w-4 text-info" />}
            tone="info"
          />
        </div>

        <SectionCard
          title="Backend readiness"
          description="Live production backend snapshot from Supabase"
        >
          {!session ? (
            <p className="text-sm text-muted-foreground">
              Sign in to view backend readiness status for this workspace.
            </p>
          ) : readinessQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading backend readiness…</p>
          ) : readinessQuery.error ? (
            <p className="text-sm text-destructive">
              Could not load backend readiness: {readinessQuery.error.message}
            </p>
          ) : !readinessQuery.data ? (
            <p className="text-sm text-muted-foreground">
              No backend readiness snapshot found for workspace {WORKSPACE_ID}.
            </p>
          ) : (
            <div className="grid grid-cols-1 gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
              <ReadinessField label="technical_status" value={readinessQuery.data.technical_status} />
              <ReadinessField label="failed_checks" value={readinessQuery.data.failed_checks} />
              <ReadinessField label="production_backend_status" value={readinessQuery.data.production_backend_status} />
              <ReadinessField label="onboarding_status" value={readinessQuery.data.onboarding_status} />
              <ReadinessField label="binding_status" value={readinessQuery.data.binding_status} />
              <ReadinessField label="mapping_review_status" value={readinessQuery.data.mapping_review_status} />
              <ReadinessField label="telegram_hitl_status" value={readinessQuery.data.telegram_hitl_status} />
              <ReadinessField label="telegram_production_status" value={readinessQuery.data.telegram_production_status} />
              <ReadinessField label="operational_alerts_status" value={readinessQuery.data.operational_alerts_status} />
              <ReadinessField label="ads_connector_status" value={readinessQuery.data.ads_connector_status} />
            </div>
          )}
        </SectionCard>
        <SectionCard title="UI Backend Contract" description="Source: v_ui_backend_contract">
          {!session ? (
            <p className="text-sm text-muted-foreground">Sign in to load UI contract status.</p>
          ) : uiContractQuery.isLoading ? (
            <p className="text-sm text-muted-foreground">Loading UI backend contract…</p>
          ) : uiContractQuery.data?.unavailableReason ? (
            <p className="text-sm text-muted-foreground">UI backend contract unavailable: {uiContractQuery.data.unavailableReason}</p>
          ) : (uiContractQuery.data?.rows.length ?? 0) === 0 ? (
            <p className="text-sm text-muted-foreground">UI backend contract unavailable.</p>
          ) : (
            <div className="space-y-2 text-xs">
              {uiContractQuery.data?.rows.map((row, idx) => (
                <div key={idx} className="rounded-md border border-border/70 bg-card/60 p-2">
                  {Object.entries(row).map(([key, value]) => <p key={key}><span className="font-medium">{key}:</span> {String(value ?? "—")}</p>)}
                </div>
              ))}
            </div>
          )}
          <div className="mt-2 rounded-md border border-border/70 bg-muted/30 p-2 text-xs text-muted-foreground">{roleLoading ? "Loading workspace role…" : roleError ? "Workspace role unavailable." : <>Current role: <span className="font-medium text-foreground">{role ?? "unknown"}</span><br />Capabilities: {Object.entries(capabilities).filter(([, enabled]) => enabled).map(([name]) => name).join(", ") || "none"}</>}</div>
        </SectionCard>
        <SectionCard title="Frontend module readiness" description="Pre-live UI module inventory and disabled action areas">
          <div className="grid gap-2 text-sm md:grid-cols-2">
            {["Production Readiness", "Onboarding", "Bindings / Mapping", "Telegram / Alerts", "Ads Connectors", "AI Assistant"].map((module) => (
              <p key={module}>✅ {module}</p>
            ))}
          </div>
          <div className="mt-3 rounded-md border border-dashed border-border/70 bg-muted/30 p-3 text-xs">
            <p className="font-medium text-foreground">Known disabled actions (intentional pre-live):</p>
            <ul className="mt-1 list-disc pl-4 text-muted-foreground">
              <li>Onboarding create/edit actions</li>
              <li>Binding create/archive actions</li>
              <li>Mapping approve/reject/send-to-Telegram actions</li>
              <li>Telegram/alert resolve/retry actions</li>
              <li>Manual scheduled sync</li>
            </ul>
          </div>
        </SectionCard>
        <SectionCard title="Action wiring plan before live preview" description="Concrete implementation plan for every currently disabled action">
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-medium">1) Can be wired now (secure frontend-callable function already exists)</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                <li>Ads Connectors: Meta/Google/TikTok connect actions already call secure OAuth start functions.</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">2) Needs new secure Edge Function wrapper</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                <li><span className="font-medium text-foreground">onboarding-client-upsert</span> → backend onboarding upsert path for client create/edit.</li>
                <li><span className="font-medium text-foreground">onboarding-project-upsert</span> → backend onboarding upsert path for project create/edit.</li>
                <li><span className="font-medium text-foreground">onboarding-funnel-upsert</span> → backend onboarding upsert path for funnel create/edit.</li>
                <li><span className="font-medium text-foreground">binding-create-or-update</span> → backend binding mutation path for create/edit and confidence/status updates.</li>
                <li><span className="font-medium text-foreground">binding-archive</span> → backend binding archive/deactivate mutation path.</li>
                <li><span className="font-medium text-foreground">mapping-review-approve</span> → backend approve mapping action path.</li>
                <li><span className="font-medium text-foreground">mapping-review-reject</span> → backend reject mapping action path.</li>
                <li><span className="font-medium text-foreground">mapping-review-send-telegram</span> → backend send-to-Telegram mapping action path.</li>
                <li><span className="font-medium text-foreground">operational-alert-resolve</span> → backend resolve alert mutation path.</li>
                <li><span className="font-medium text-foreground">telegram-outbox-retry</span> → backend retry outbox delivery path.</li>
                <li><span className="font-medium text-foreground">telegram-action-request-open</span> → backend open/create action request path.</li>
                <li><span className="font-medium text-foreground">ads-scheduled-sync-run</span> → backend scheduled sync trigger path for manual run.</li>
              </ul>
            </div>
            <div>
              <p className="font-medium">3) Must wait for live OAuth/manual external-provider testing</p>
              <ul className="mt-1 list-disc pl-5 text-muted-foreground">
                <li>Final end-to-end verification for ads connector OAuth callbacks and external account token health.</li>
                <li>Live Telegram delivery confirmation for pending outbox retry and action request flows.</li>
                <li>Manual provider-side verification of scheduled sync execution across connected ad platforms.</li>
              </ul>
            </div>
            <p className="text-xs text-muted-foreground">Only deferred infra item after live preview: Infra Task 6B (remove Lovable auth wrapper/package after OAuth verification).</p>
          </div>
        </SectionCard>

        {/* KPI grid — premium emphasis on Revenue Fact, ROAS, Sales */}
        <KpiGrid
          kpis={overviewKpis}
          columns={6}
          showDateContext
          accentFirst={false}
          emphasisKeys={["revFact", "roas", "sales"]}
        />


        {viewMode === "summary" ? (
          <>
            {/* Main chart + AI Insights */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <SectionCard
                className="xl:col-span-2"
                title={t("revenueVsSpend")}
                description={t("revenueVsSpendDesc")}
                actions={<LegendDot />}
              >
                <div className="h-[280px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={revenueVsSpend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <defs>
                        <linearGradient id="revG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                          <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                        </linearGradient>
                        <linearGradient id="spendG" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor="hsl(var(--chart-3))" stopOpacity={0.25} />
                          <stop offset="100%" stopColor="hsl(var(--chart-3))" stopOpacity={0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                      <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#revG)" name={t("thRevenue")} />
                      <Area type="monotone" dataKey="spend" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#spendG)" name={t("thSpend")} />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard
                title={t("aiObservations")}
                description={t("aiObservationsDesc")}
                actions={<Sparkles className="h-4 w-4 text-primary" />}
              >
                <ol className="space-y-3">
                  {aiInsights[lang].map((i, idx) => (
                    <li key={idx} className="flex gap-3">
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-primary-soft text-[11px] font-semibold text-primary">
                        {idx + 1}
                      </div>
                      <p className="text-sm leading-relaxed text-foreground/90">{i}</p>
                    </li>
                  ))}
                </ol>
              </SectionCard>
            </div>

            {/* Tables row */}
            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <SectionCard className="xl:col-span-2" title={t("topCampaigns")} description={t("topCampaignsDesc")} noPadding>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>{t("thCampaign")}</TableHead>
                        <TableHead>{t("thProject")}</TableHead>
                        <TableHead className="text-right">{t("thSpend")}</TableHead>
                        <TableHead className="text-right">{t("thRegs")}</TableHead>
                        <TableHead className="text-right">{t("thSales")}</TableHead>
                        <TableHead className="text-right">{t("thRevenue")}</TableHead>
                        <TableHead className="text-right">{t("thRoas")}</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {topCampaigns.map((c) => (
                        <TableRow key={c.campaign}>
                          <TableCell className="font-medium">{c.campaign}</TableCell>
                          <TableCell className="text-muted-foreground">{c.project}</TableCell>
                          <TableCell className="text-right num">{fmtCurrency(c.spend)}</TableCell>
                          <TableCell className="text-right num">{fmtNum(c.regs)}</TableCell>
                          <TableCell className="text-right num">{c.sales}</TableCell>
                          <TableCell className="text-right num">{fmtCurrency(c.revenue)}</TableCell>
                          <TableCell className="text-right num font-semibold">{c.roas.toFixed(2)}x</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              </SectionCard>

              <SectionCard title={t("topGroups")} noPadding>
                <div className="divide-y">
                  {topReportGroups.map((g) => (
                    <div key={g.group} className="flex items-center justify-between gap-3 px-4 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="truncate text-sm font-medium">{g.group}</span>
                          <StatusBadge status={g.status} />
                        </div>
                        <div className="text-xs text-muted-foreground">{g.project}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-sm font-semibold num">{g.roas.toFixed(2)}x</div>
                        <div className="text-[11px] text-muted-foreground num">{fmtCurrency(g.revenue)}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </SectionCard>
            </div>
          </>
        ) : (
          <DailyView lang={lang} onSelect={setSelectedDay} />
        )}

        {/* Bottom row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title={t("recentAnomalies")} description={t("recentAnomaliesDesc")} noPadding>
            <div className="divide-y">
              {anomalies.map((a) => (
                <div key={a.id} className="flex items-start gap-3 px-4 py-3">
                  <div
                    className={
                      "mt-0.5 flex h-7 w-7 shrink-0 items-center justify-center rounded-md " +
                      (a.severity === "critical"
                        ? "bg-destructive-soft text-destructive"
                        : a.severity === "warning"
                        ? "bg-warning-soft text-warning-foreground"
                        : "bg-info-soft text-info")
                    }
                  >
                    {a.severity === "critical" ? (
                      <AlertCircle className="h-4 w-4" />
                    ) : a.severity === "warning" ? (
                      <AlertTriangle className="h-4 w-4" />
                    ) : (
                      <Info className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-medium">{lang === "uk" ? a.titleUk : a.titleEn}</div>
                    <div className="text-xs text-muted-foreground">{lang === "uk" ? a.detailUk : a.detailEn}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-muted-foreground">{a.time}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title={t("dataFreshness")} description={t("dataFreshnessDesc")} noPadding>
            <div className="divide-y">
              {dataFreshness.map((d) => (
                <div key={d.source} className="flex items-center justify-between gap-3 px-4 py-3">
                  <div className="text-sm font-medium">{d.source}</div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground num">{d.lastSync}</span>
                    <StatusBadge status={d.status} />
                  </div>
                </div>
              ))}
            </div>
          </SectionCard>
        </div>
      </div>

      <DayDetailSheet day={selectedDay} onClose={() => setSelectedDay(null)} />
    </DashboardLayout>
  );
}

function ReadinessField({ label, value }: { label: string; value: string | number | null }) {
  return (
    <div className="rounded-md border border-border/70 bg-card/40 p-3">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-medium">{value ?? "—"}</p>
    </div>
  );
}

function DailyView({ lang, onSelect }: { lang: "uk" | "en"; onSelect: (d: DailyRow) => void }) {
  const { t } = useI18n();
  return (
    <>
      <SectionCard title={t("dailyTrend")} description={t("dailyTrendDesc")}>
        <div className="h-[260px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={dailyAnalytics} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
              <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
              <Tooltip contentStyle={tooltipStyle} />
              <Line type="monotone" dataKey="regs" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name={t("thRegs")} />
              <Line type="monotone" dataKey="sales" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name={t("thSales")} />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </SectionCard>

      <SectionCard title={t("dailyBreakdown")} description={t("dailyBreakdownDesc")} noPadding>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("thDay")}</TableHead>
                <TableHead className="text-right">{t("thSpend")}</TableHead>
                <TableHead className="text-right">{t("thClicks")}</TableHead>
                <TableHead className="text-right">{t("thRegs")}</TableHead>
                <TableHead className="text-right">{t("thApps")}</TableHead>
                <TableHead className="text-right">{t("thBookings")}</TableHead>
                <TableHead className="text-right">{t("thViewers")}</TableHead>
                <TableHead className="text-right">{t("thSales")}</TableHead>
                <TableHead className="text-right">{t("thRevenue")}</TableHead>
                <TableHead className="text-right">{t("thCpl")}</TableHead>
                <TableHead className="text-right">{t("thRoas")}</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {dailyAnalytics.map((d) => (
                <TableRow
                  key={d.date}
                  onClick={() => onSelect(d)}
                  className="cursor-pointer hover:bg-muted/40"
                >
                  <TableCell className="font-medium num">{d.date}</TableCell>
                  <TableCell className="text-right num">{fmtCurrency(d.spend)}</TableCell>
                  <TableCell className="text-right num">{fmtNum(d.clicks)}</TableCell>
                  <TableCell className="text-right num">{fmtNum(d.regs)}</TableCell>
                  <TableCell className="text-right num">{fmtNum(d.apps)}</TableCell>
                  <TableCell className="text-right num">{fmtNum(d.bookings)}</TableCell>
                  <TableCell className="text-right num">{fmtNum(d.viewers)}</TableCell>
                  <TableCell className="text-right num">{d.sales}</TableCell>
                  <TableCell className="text-right num">{fmtCurrency(d.revenue)}</TableCell>
                  <TableCell className="text-right num">${d.cpl.toFixed(2)}</TableCell>
                  <TableCell className={`text-right num font-semibold ${d.roas >= 4 ? "text-success" : d.roas < 3 ? "text-destructive" : ""}`}>
                    {d.roas.toFixed(2)}x
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </SectionCard>
    </>
  );
}

function DayDetailSheet({ day, onClose }: { day: DailyRow | null; onClose: () => void }) {
  const { t } = useI18n();
  return (
    <Sheet open={!!day} onOpenChange={(o) => !o && onClose()}>
      <SheetContent className="w-full sm:max-w-md overflow-y-auto">
        {day && (
          <>
            <SheetHeader>
              <SheetTitle className="num">{day.date}</SheetTitle>
              <SheetDescription>{t("dailyBreakdown")}</SheetDescription>
            </SheetHeader>
            <div className="mt-4 grid grid-cols-2 gap-3">
              <DetailItem label={t("kpiSpend")} value={fmtCurrency(day.spend)} />
              <DetailItem label={t("kpiReach")} value={fmtNum(day.reach)} />
              <DetailItem label={t("kpiClicks")} value={fmtNum(day.clicks)} />
              <DetailItem label={t("kpiRegs")} value={fmtNum(day.regs)} />
              <DetailItem label={t("kpiApps")} value={fmtNum(day.apps)} />
              <DetailItem label={t("kpiBookings")} value={fmtNum(day.bookings)} />
              <DetailItem label={t("kpiViewers")} value={fmtNum(day.viewers)} />
              <DetailItem label={t("kpiSales")} value={String(day.sales)} />
              <DetailItem label={t("kpiRevFact")} value={fmtCurrency(day.revenue)} />
              <DetailItem label={t("kpiCpl")} value={`$${day.cpl.toFixed(2)}`} />
              <DetailItem label={t("kpiRoas")} value={`${day.roas.toFixed(2)}x`} highlight />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function DetailItem({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border bg-card p-3 ${highlight ? "border-primary/30 bg-primary-soft/40" : ""}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-base font-semibold num ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function OpsCard({
  label,
  value,
  sub,
  icon,
  tone,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  tone: "success" | "destructive" | "warning" | "info" | "neutral";
}) {
  const accent: Record<string, string> = {
    success: "before:bg-success/70",
    destructive: "before:bg-destructive/80",
    warning: "before:bg-warning/80",
    info: "before:bg-info/70",
    neutral: "before:bg-primary/60",
  };
  return (
    <div
      className={
        "relative overflow-hidden rounded-lg border border-border/70 bg-card-elevated p-3.5 shadow-card " +
        "before:absolute before:left-0 before:top-0 before:h-full before:w-[2px] " +
        accent[tone]
      }
    >
      <div className="flex items-center justify-between gap-2">
        <div className="text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground">
          {label}
        </div>
        {icon}
      </div>
      <div className="mt-1.5 truncate text-[17px] font-semibold leading-none num tracking-[-0.01em]">{value}</div>
      {sub && <div className="mt-1.5 truncate text-[11px] text-muted-foreground">{sub}</div>}
    </div>
  );
}

function KpiInline({ kpi: k }: { kpi: typeof overviewKpis[number] }) {
  const { t } = useI18n();
  const label = k.labelKey ? t(k.labelKey as TranslationKey) : k.label;
  return (
    <div className="rounded-lg border bg-card p-3 shadow-card">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 flex items-baseline justify-between gap-2">
        <div className="text-lg font-semibold num">
          {k.unit === "currency"
            ? fmtCurrency(k.value, { compact: k.value >= 10000 })
            : k.unit === "percent"
            ? `${k.value.toFixed(1)}%`
            : k.hint === "x"
            ? `${k.value.toFixed(2)}x`
            : new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(k.value)}
        </div>
        {k.delta !== undefined && (
          <span
            className={
              "rounded px-1 py-0.5 text-[10px] font-medium num " +
              (k.delta >= 0 ? "bg-success-soft text-success" : "bg-destructive-soft text-destructive")
            }
          >
            {k.delta >= 0 ? "+" : ""}
            {k.delta.toFixed(1)}%
          </span>
        )}
      </div>
    </div>
  );
}

function LegendDot() {
  const { t } = useI18n();
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-chart-1" /> {t("thRevenue")}
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-chart-3" /> {t("thSpend")}
      </span>
    </div>
  );
}
