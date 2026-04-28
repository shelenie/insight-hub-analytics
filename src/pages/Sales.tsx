import { useState } from "react";
import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { KpiGrid } from "@/components/dashboard/KpiCard";
import {
  salesKpis,
  salesBySource,
  salesByLeadType,
  salesByTariff,
  revenueOverTime,
  dailyAnalytics,
  type DailyRow,
} from "@/data/mock";
import { fmtCurrency, fmtNum } from "@/lib/format";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetDescription } from "@/components/ui/sheet";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function Sales() {
  const { t } = useI18n();
  const [viewMode, setViewMode] = useState<"summary" | "daily">("summary");
  const [day, setDay] = useState<DailyRow | null>(null);

  return (
    <DashboardLayout title={t("salesTitle")} subtitle={t("salesSubtitle")}>
      <div className="space-y-4">
        <FilterBar
          freshness={{ source: "fact_sales", status: "fresh", lastSync: "12 min" }}
          showViewMode
          viewMode={viewMode}
          onViewModeChange={setViewMode}
        />

        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
          <div className="text-warning-foreground">
            <span className="font-medium">Partial data warning:</span> CRM sync for Apr 26 is still in progress. Numbers may update within the next hour.
          </div>
        </div>

        <KpiGrid kpis={salesKpis} columns={5} />

        {viewMode === "summary" ? (
          <>
            <SectionCard title={t("revenueOverTime")} description={t("revenueOverTimeDesc")}>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={revenueOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <defs>
                      <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="0%" stopColor="hsl(var(--chart-1))" stopOpacity={0.3} />
                        <stop offset="100%" stopColor="hsl(var(--chart-1))" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                    <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                    <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                    <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#revArea)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </SectionCard>

            <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
              <SectionCard title={t("salesBySource")} noPadding>
                <Table>
                  <TableHeader><TableRow><TableHead>{t("source")}</TableHead><TableHead className="text-right">{t("kpiSales")}</TableHead><TableHead className="text-right">{t("thRevenue")}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {salesBySource.map((s) => (
                      <TableRow key={s.source}><TableCell className="font-medium">{s.source}</TableCell><TableCell className="text-right num">{s.sales}</TableCell><TableCell className="text-right num">{fmtCurrency(s.revenue)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>

              <SectionCard title={t("salesByLeadType")} noPadding>
                <Table>
                  <TableHeader><TableRow><TableHead>{t("leadType")}</TableHead><TableHead className="text-right">{t("kpiSales")}</TableHead><TableHead className="text-right">{t("thRevenue")}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {salesByLeadType.map((s) => (
                      <TableRow key={s.type}><TableCell className="font-medium">{s.type}</TableCell><TableCell className="text-right num">{s.sales}</TableCell><TableCell className="text-right num">{fmtCurrency(s.revenue)}</TableCell></TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>

              <SectionCard title={t("salesByTariff")} noPadding>
                <Table>
                  <TableHeader><TableRow><TableHead>{t("tariff")}</TableHead><TableHead className="text-right">{t("kpiSales")}</TableHead><TableHead className="text-right">{t("thRevenue")}</TableHead></TableRow></TableHeader>
                  <TableBody>
                    {salesByTariff.map((s) => (
                      <TableRow key={s.tariff} className={s.excluded ? "opacity-70" : ""}>
                        <TableCell className="font-medium">
                          <div className="flex items-center gap-1.5">
                            {s.tariff}
                            {s.excluded && (
                              <Badge variant="outline" className="border-warning/40 bg-warning-soft text-[10px] text-warning-foreground">
                                excluded from count
                              </Badge>
                            )}
                          </div>
                        </TableCell>
                        <TableCell className="text-right num">{s.excluded ? <span className="text-muted-foreground">—</span> : s.sales}</TableCell>
                        <TableCell className="text-right num">{fmtCurrency(s.revenue)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </SectionCard>
            </div>

            <SectionCard title={t("dopayNoteTitle")}>
              <p className="text-sm text-muted-foreground leading-relaxed">{t("dopayNote")}</p>
            </SectionCard>
          </>
        ) : (
          <SectionCard title={t("dailyBreakdown")} description={t("dailyBreakdownDesc")} noPadding>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("thDay")}</TableHead>
                    <TableHead className="text-right">{t("kpiSales")}</TableHead>
                    <TableHead className="text-right">{t("thRevenue")}</TableHead>
                    <TableHead className="text-right">{t("avgDeal")}</TableHead>
                    <TableHead className="text-right">{t("thRoas")}</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {dailyAnalytics.map((d) => (
                    <TableRow key={d.date} onClick={() => setDay(d)} className="cursor-pointer hover:bg-muted/40 text-xs">
                      <TableCell className="font-medium num">{d.date}</TableCell>
                      <TableCell className="text-right num">{d.sales}</TableCell>
                      <TableCell className="text-right num">{fmtCurrency(d.revenue)}</TableCell>
                      <TableCell className="text-right num">{fmtCurrency(d.revenue / Math.max(d.sales, 1))}</TableCell>
                      <TableCell className={`text-right num font-semibold ${d.roas >= 4 ? "text-success" : d.roas < 3 ? "text-destructive" : ""}`}>{d.roas.toFixed(2)}x</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          </SectionCard>
        )}
      </div>

      <Sheet open={!!day} onOpenChange={(o) => !o && setDay(null)}>
        <SheetContent className="w-full sm:max-w-md">
          {day && (
            <>
              <SheetHeader>
                <SheetTitle className="num">{day.date}</SheetTitle>
                <SheetDescription>{t("dailyBreakdown")}</SheetDescription>
              </SheetHeader>
              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <Item label={t("kpiSales")} value={String(day.sales)} />
                <Item label={t("thRevenue")} value={fmtCurrency(day.revenue)} />
                <Item label={t("avgDeal")} value={fmtCurrency(day.revenue / Math.max(day.sales, 1))} />
                <Item label={t("kpiRoas")} value={`${day.roas.toFixed(2)}x`} highlight />
                <Item label={t("kpiSpend")} value={fmtCurrency(day.spend)} />
                <Item label={t("kpiRegs")} value={fmtNum(day.regs)} />
              </div>
            </>
          )}
        </SheetContent>
      </Sheet>
    </DashboardLayout>
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
