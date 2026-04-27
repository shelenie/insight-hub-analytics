import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { KpiGrid } from "@/components/dashboard/KpiCard";
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
  overviewKpis,
  revenueVsSpend,
  topCampaigns,
  topReportGroups,
  anomalies,
  dataFreshness,
  aiInsights,
} from "@/data/mock";
import { fmtCurrency, fmtNum } from "@/lib/format";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Sparkles, Download, AlertTriangle, AlertCircle, Info } from "lucide-react";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
  boxShadow: "0 4px 12px hsl(222 25% 12% / 0.08)",
};

export default function Overview() {
  return (
    <DashboardLayout
      title="Overview"
      subtitle="Cross-project performance snapshot"
      actions={
        <>
          <Button variant="outline" size="sm" className="gap-1.5">
            <Download className="h-3.5 w-3.5" />
            Export
          </Button>
          <Button size="sm" className="gap-1.5">
            <Sparkles className="h-3.5 w-3.5" />
            Ask AI
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        <FilterBar
          freshness={{ source: "Last sync", status: "fresh", lastSync: "2 min ago" }}
        />

        {/* KPI grid - 11 metrics, dense */}
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6">
          {overviewKpis.map((k) => (
            <div key={k.key}>
              <KpiCardInline {...k} />
            </div>
          ))}
        </div>

        {/* Main chart + AI Insights */}
        <div className="grid grid-cols-1 gap-4 xl:grid-cols-3">
          <SectionCard
            className="xl:col-span-2"
            title="Revenue vs Spend"
            description="Daily totals across all selected projects"
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
                  <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-1))" strokeWidth={2} fill="url(#revG)" name="Revenue" />
                  <Area type="monotone" dataKey="spend" stroke="hsl(var(--chart-3))" strokeWidth={2} fill="url(#spendG)" name="Spend" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard
            title="AI Insight Summary"
            description="3 analyst-style observations"
            actions={<Sparkles className="h-4 w-4 text-primary" />}
          >
            <ol className="space-y-3">
              {aiInsights.map((i, idx) => (
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
          <SectionCard className="xl:col-span-2" title="Top campaigns" description="Sorted by ROAS · last 30 days" noPadding>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Campaign</TableHead>
                    <TableHead>Project</TableHead>
                    <TableHead className="text-right">Spend</TableHead>
                    <TableHead className="text-right">Regs</TableHead>
                    <TableHead className="text-right">Sales</TableHead>
                    <TableHead className="text-right">Revenue</TableHead>
                    <TableHead className="text-right">ROAS</TableHead>
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

          <SectionCard title="Top report groups" noPadding>
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

        {/* Bottom row */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
          <SectionCard title="Recent anomalies & alerts" description="Auto-detected by the analytics engine" noPadding>
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
                    <div className="text-sm font-medium">{a.title}</div>
                    <div className="text-xs text-muted-foreground">{a.detail}</div>
                  </div>
                  <div className="shrink-0 text-[11px] text-muted-foreground">{a.time}</div>
                </div>
              ))}
            </div>
          </SectionCard>

          <SectionCard title="Data freshness" description="Source sync status" noPadding>
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
    </DashboardLayout>
  );
}

// Inline KPI variant used in the dense 6-col overview grid
function KpiCardInline(k: typeof overviewKpis[number]) {
  return <KpiGridSingle {...k} />;
}

function KpiGridSingle(k: typeof overviewKpis[number]) {
  // Reuse KpiGrid by passing 1 item is overkill — inline minimal card:
  return (
    <div className="rounded-lg border bg-card p-3 shadow-card">
      <div className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">{k.label}</div>
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
  return (
    <div className="flex items-center gap-3 text-xs text-muted-foreground">
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-chart-1" /> Revenue
      </span>
      <span className="flex items-center gap-1.5">
        <span className="h-2 w-2 rounded-full bg-chart-3" /> Spend
      </span>
    </div>
  );
}
