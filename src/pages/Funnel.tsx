import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { KpiGrid } from "@/components/dashboard/KpiCard";
import { EmptyState } from "@/components/dashboard/EmptyState";
import {
  funnelSteps,
  dailyTrend,
  salesPlanFact,
  trafficByCampaign,
  overviewKpis,
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
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Sparkles, TrendingUp, TrendingDown, AlertTriangle, Eye } from "lucide-react";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

const funnelKpis = overviewKpis
  .filter((k) => ["clicks", "regs", "apps", "bookings", "viewers", "sales", "revFact", "roas"].includes(k.key))
  .map((k) => ({ ...k, label: k.label.replace("Revenue Fact", "Revenue") }));

export default function Funnel() {
  const showViewers = true; // toggle this when no viewer data

  return (
    <DashboardLayout
      title="Funnel / Report"
      subtitle="Pulse Education · Webinar Q4"
    >
      <div className="space-y-4">
        <FilterBar freshness={{ source: "fact_daily", status: "fresh", lastSync: "5 min ago" }} />

        <KpiGrid kpis={funnelKpis} columns={4} />

        {/* Conversion flow */}
        <SectionCard title="Conversion flow" description="Step-to-step conversion across the selected funnel">
          <div className="space-y-2">
            {funnelSteps.map((s, i) => {
              const widthPct = (s.value / funnelSteps[0].value) * 100;
              return (
                <div key={s.step} className="grid grid-cols-12 items-center gap-3">
                  <div className="col-span-12 lg:col-span-2 text-sm font-medium">{s.step}</div>
                  <div className="col-span-9 lg:col-span-7">
                    <div className="relative h-8 overflow-hidden rounded-md bg-muted">
                      <div
                        className="h-full rounded-md bg-gradient-to-r from-primary to-chart-5 transition-all"
                        style={{ width: `${widthPct}%` }}
                      />
                    </div>
                  </div>
                  <div className="col-span-2 lg:col-span-2 text-right text-sm font-semibold num">
                    {fmtNum(s.value)}
                  </div>
                  <div className="col-span-1 lg:col-span-1 text-right text-xs text-muted-foreground num">
                    {i === 0 ? "—" : `${s.conv.toFixed(1)}%`}
                  </div>
                </div>
              );
            })}
          </div>
        </SectionCard>

        {/* Trend + plan vs fact */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <SectionCard className="xl:col-span-2" title="Daily trend" description="Registrations & sales">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={dailyTrend} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <Tooltip contentStyle={tooltipStyle} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Line type="monotone" dataKey="registrations" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} />
                  <Line type="monotone" dataKey="sales" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="Sales plan vs fact" description="Weekly">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={salesPlanFact} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                  <XAxis dataKey="week" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                  <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="plan" fill="hsl(var(--muted-foreground) / 0.4)" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="fact" fill="hsl(var(--chart-1))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        {/* Traffic table */}
        <SectionCard title="Traffic by campaign" noPadding>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Campaign</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Regs</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {trafficByCampaign.map((c) => (
                  <TableRow key={c.campaign}>
                    <TableCell className="font-medium">{c.campaign}</TableCell>
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

        {/* Optional viewer slots + AI commentary */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          {showViewers ? (
            <SectionCard title="Viewer slots" description="Webinar attendance distribution" actions={<Eye className="h-4 w-4 text-muted-foreground" />}>
              <div className="space-y-2.5">
                {[
                  { slot: "Tue 19:00 UTC", booked: 420, viewers: 312 },
                  { slot: "Wed 19:00 UTC", booked: 384, viewers: 268 },
                  { slot: "Thu 19:00 UTC", booked: 412, viewers: 296 },
                  { slot: "Sat 14:00 UTC", booked: 280, viewers: 184 },
                ].map((v) => {
                  const pct = (v.viewers / v.booked) * 100;
                  return (
                    <div key={v.slot}>
                      <div className="mb-1 flex items-center justify-between text-xs">
                        <span className="font-medium">{v.slot}</span>
                        <span className="text-muted-foreground num">
                          {v.viewers} / {v.booked} <span className="text-foreground">({pct.toFixed(0)}%)</span>
                        </span>
                      </div>
                      <div className="h-2 overflow-hidden rounded-full bg-muted">
                        <div className="h-full bg-chart-2" style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </SectionCard>
          ) : (
            <SectionCard title="Viewer slots">
              <EmptyState title="No viewer data" description="This funnel does not have a webinar / viewer step." />
            </SectionCard>
          )}

          <SectionCard
            title="AI commentary"
            description="What changed in this funnel"
            actions={<Sparkles className="h-4 w-4 text-primary" />}
          >
            <div className="space-y-3 text-sm">
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-success-soft text-success">
                  <TrendingUp className="h-3.5 w-3.5" />
                </span>
                <div>
                  <div className="font-medium">Improved</div>
                  <p className="text-muted-foreground">Booking → Viewer conversion grew from 64% to 71% after sending 24h reminder.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-destructive-soft text-destructive">
                  <TrendingDown className="h-3.5 w-3.5" />
                </span>
                <div>
                  <div className="font-medium">Dropped</div>
                  <p className="text-muted-foreground">Click → Registration fell to 17% (vs 21% prior week). Cold static creatives showing fatigue.</p>
                </div>
              </div>
              <div className="flex items-start gap-2.5">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-warning-soft text-warning-foreground">
                  <AlertTriangle className="h-3.5 w-3.5" />
                </span>
                <div>
                  <div className="font-medium">Bottleneck</div>
                  <p className="text-muted-foreground">Viewer → Sale at 36%. Investigate the close-script for Saturday slot — lowest converting.</p>
                </div>
              </div>
            </div>
          </SectionCard>
        </div>
      </div>
    </DashboardLayout>
  );
}
