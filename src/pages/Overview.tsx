import { useMemo, useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { StatusBadge } from "@/components/dashboard/StatusBadge";
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

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  boxShadow: "0 4px 12px hsl(222 25% 12% / 0.08)",
};

export default function Overview() {
  const { t, lang } = useI18n();
  const [viewMode, setViewMode] = useState<"summary" | "daily">("summary");
  const [selectedDay, setSelectedDay] = useState<DailyRow | null>(null);

  const failedCount = useMemo(() => importRuns.filter((r) => r.status === "failed").length, []);
  const partialCount = useMemo(() => importRuns.filter((r) => r.status === "partial").length, []);
  const lastSuccess = useMemo(() => importRuns.find((r) => r.status === "success"), []);

  return (
    <DashboardLayout
      title={t("overviewTitle")}
      subtitle={t("overviewSubtitle")}
      actions={
        <>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            {t("export")}
          </Button>
          <Button size="sm" className="gap-1.5">
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
  const toneClass: Record<typeof tone, string> = {
    success: "",
    destructive: "border-destructive/30",
    warning: "border-warning/30",
    info: "",
    neutral: "",
  } as any;
  return (
    <div className={`rounded-lg border bg-card p-3 shadow-card ${toneClass[tone]}`}>
      <div className="flex items-center justify-between">
        <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {icon}
      </div>
      <div className="mt-1 text-base font-semibold num truncate">{value}</div>
      {sub && <div className="text-[11px] text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}

function KpiInline({ kpi: k }: { kpi: typeof overviewKpis[number] }) {
  const { t } = useI18n();
  const label = k.labelKey ? t(k.labelKey as any) : k.label;
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
