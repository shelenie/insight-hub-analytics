import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import {
  funnelSteps,
  salesPlanFact,
  dailyAnalytics,
  type DailyRow,
} from "@/data/mock";
import { fmtCurrency, fmtNum } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  Legend,
} from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription,
} from "@/components/ui/sheet";
import {
  MousePointerClick, UserPlus, Users, FileText, Inbox, CalendarCheck,
  ShoppingBag, DollarSign, TrendingUp, GitBranch,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";
import { ReactNode } from "react";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function Funnel() {
  const { t, lang } = useI18n();
  const [viewMode, setViewMode] = useState<"summary" | "daily">("summary");
  const [selectedDay, setSelectedDay] = useState<DailyRow | null>(null);

  // Aggregates from mock daily rows — stand in for the resolved date range.
  const totals = dailyAnalytics.reduce(
    (acc, d) => ({
      spend: acc.spend + d.spend,
      clicks: acc.clicks + d.clicks,
      regs: acc.regs + d.regs,
      apps: acc.apps + d.apps,
      bookings: acc.bookings + d.bookings,
      viewers: acc.viewers + d.viewers,
      sales: acc.sales + d.sales,
      revenue: acc.revenue + d.revenue,
    }),
    { spend: 0, clicks: 0, regs: 0, apps: 0, bookings: 0, viewers: 0, sales: 0, revenue: 0 },
  );
  const blendedRoas = totals.revenue / totals.spend;

  return (
    <DashboardLayout title={t("funnelTitle")} subtitle={t("funnelSubtitle")}>
      <div className="space-y-4">
        <FilterBar
          freshness={{ source: "fact_daily", status: "fresh", lastSync: "5 min" }}
          showViewMode
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        {/* Block grid — the requested 9 working blocks */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
          <BlockCard icon={<MousePointerClick className="h-3.5 w-3.5" />} label={t("blockTraffic")}     value={fmtNum(totals.clicks)}  hint={`${fmtCurrency(totals.spend)} ${t("kpiSpend").toLowerCase()}`} />
          <BlockCard icon={<UserPlus className="h-3.5 w-3.5" />}          label={t("blockRegs")}        value={fmtNum(totals.regs)}    hint={`CPL $${(totals.spend/totals.regs).toFixed(2)}`} />
          <BlockCard icon={<Users className="h-3.5 w-3.5" />}             label={t("blockViewers")}     value={fmtNum(totals.viewers)} hint={`${((totals.viewers/totals.bookings)*100).toFixed(0)}% ${lang === "uk" ? "з броней" : "of bookings"}`} />
          <BlockCard icon={<FileText className="h-3.5 w-3.5" />}          label={t("blockApps")}        value={fmtNum(totals.apps)}    hint={`${((totals.apps/totals.regs)*100).toFixed(0)}% ${lang === "uk" ? "з реєстр." : "of regs"}`} />
          <BlockCard icon={<Inbox className="h-3.5 w-3.5" />}             label={t("blockBookings")}    value={fmtNum(totals.bookings)} hint={`${((totals.bookings/totals.apps)*100).toFixed(0)}% ${lang === "uk" ? "з анкет" : "of surveys"}`} />
          <BlockCard icon={<CalendarCheck className="h-3.5 w-3.5" />}     label={t("blockReservations")} value={fmtNum(totals.bookings)} hint={lang === "uk" ? "Підтверджені слоти" : "Confirmed slots"} />
          <BlockCard icon={<ShoppingBag className="h-3.5 w-3.5" />}       label={t("blockSales")}       value={fmtNum(totals.sales)}   hint={`${((totals.sales/totals.viewers)*100).toFixed(0)}% ${lang === "uk" ? "з глядачів" : "of viewers"}`} />
          <BlockCard icon={<DollarSign className="h-3.5 w-3.5" />}        label={t("blockRevenue")}     value={fmtCurrency(totals.revenue)} hint={`${lang==="uk"?"План":"Plan"} ${fmtCurrency(480000)}`} accent />
          <BlockCard icon={<TrendingUp className="h-3.5 w-3.5" />}        label={t("blockRoas")}        value={`${blendedRoas.toFixed(2)}x`} hint={lang === "uk" ? "Сумарний ROAS" : "Blended ROAS"} accent />
          <BlockCard icon={<GitBranch className="h-3.5 w-3.5" />}         label={t("conversionFlow")}   value={`${((totals.sales/totals.clicks)*100).toFixed(2)}%`} hint={lang === "uk" ? "Клік → Продаж" : "Click → Sale"} />
        </div>

        {viewMode === "summary" ? (
          <>
            {/* Conversion flow — full width */}
            <SectionCard title={t("conversionFlow")} description={t("conversionFlowDesc")}>
              <div className="space-y-2">
                {funnelSteps.map((s, i) => {
                  const widthPct = (s.value / funnelSteps[0].value) * 100;
                  return (
                    <div key={s.step} className="grid grid-cols-12 items-center gap-3">
                      <div className="col-span-12 lg:col-span-2 text-sm font-medium">
                        {lang === "uk" ? s.stepUk : s.step}
                      </div>
                      <div className="col-span-9 lg:col-span-7">
                        <div className="relative h-7 overflow-hidden rounded-md bg-muted">
                          <div className="h-full rounded-md bg-primary/85 transition-all" style={{ width: `${widthPct}%` }} />
                        </div>
                      </div>
                      <div className="col-span-2 lg:col-span-2 text-right text-sm font-semibold num">{fmtNum(s.value)}</div>
                      <div className="col-span-1 lg:col-span-1 text-right text-xs text-muted-foreground num">
                        {i === 0 ? "—" : `${s.conv.toFixed(1)}%`}
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>

            <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
              <SectionCard className="xl:col-span-2" title={t("dailyTrend")} description={t("dailyTrendDesc")}>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={dailyAnalytics} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="date" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <Tooltip contentStyle={tooltipStyle} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Line type="monotone" dataKey="regs" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name={t("kpiRegs")} />
                      <Line type="monotone" dataKey="sales" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} name={t("kpiSales")} />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>

              <SectionCard title={t("planVsFact")} description={t("weekly")}>
                <div className="h-[260px]">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={salesPlanFact} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                      <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                      <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                      <Legend wrapperStyle={{ fontSize: 12 }} />
                      <Bar dataKey="plan" fill="hsl(var(--muted-foreground) / 0.45)" radius={[4, 4, 0, 0]} />
                      <Bar dataKey="fact" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              </SectionCard>
            </div>
          </>
        ) : (
          <DailyTable onSelect={setSelectedDay} />
        )}
      </div>

      <DayDetailSheet day={selectedDay} onClose={() => setSelectedDay(null)} />
    </DashboardLayout>
  );
}

function BlockCard({
  icon, label, value, hint, accent,
}: { icon: ReactNode; label: string; value: string; hint?: string; accent?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-3 shadow-card ${accent ? "border-primary/40 bg-primary-soft/30" : ""}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
        <span className={`flex h-5 w-5 items-center justify-center rounded ${accent ? "bg-primary text-primary-foreground" : "bg-muted text-foreground/70"}`}>
          {icon}
        </span>
        {label}
      </div>
      <div className={`mt-1.5 text-lg font-semibold num ${accent ? "text-primary" : ""}`}>{value}</div>
      {hint && <div className="text-[11px] text-muted-foreground truncate">{hint}</div>}
    </div>
  );
}

function DailyTable({ onSelect }: { onSelect: (d: DailyRow) => void }) {
  const { t } = useI18n();
  return (
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
              <TableRow key={d.date} onClick={() => onSelect(d)} className="cursor-pointer hover:bg-muted/40 text-xs">
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
              <Item label={t("kpiSpend")} value={fmtCurrency(day.spend)} />
              <Item label={t("kpiReach")} value={fmtNum(day.reach)} />
              <Item label={t("kpiClicks")} value={fmtNum(day.clicks)} />
              <Item label={t("kpiRegs")} value={fmtNum(day.regs)} />
              <Item label={t("kpiApps")} value={fmtNum(day.apps)} />
              <Item label={t("kpiBookings")} value={fmtNum(day.bookings)} />
              <Item label={t("kpiViewers")} value={fmtNum(day.viewers)} />
              <Item label={t("kpiSales")} value={String(day.sales)} />
              <Item label={t("kpiRevFact")} value={fmtCurrency(day.revenue)} />
              <Item label={t("kpiCpl")} value={`$${day.cpl.toFixed(2)}`} />
              <Item label={t("kpiRoas")} value={`${day.roas.toFixed(2)}x`} highlight />
            </div>
          </>
        )}
      </SheetContent>
    </Sheet>
  );
}

function Item({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-md border p-2.5 ${highlight ? "border-primary/30 bg-primary-soft/40" : "bg-background"}`}>
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-0.5 text-sm font-semibold num ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
