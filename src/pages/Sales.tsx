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
} from "@/data/mock";
import { fmtCurrency, fmtNum } from "@/lib/format";
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Info } from "lucide-react";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

export default function Sales() {
  return (
    <DashboardLayout title="Sales / Revenue" subtitle="Internal sales analytics">
      <div className="space-y-4">
        <FilterBar freshness={{ source: "fact_sales", status: "fresh", lastSync: "12 min ago" }} />

        {/* Status note for partial outdated */}
        <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm">
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
          <div className="text-warning-foreground">
            <span className="font-medium">Partial data warning:</span> CRM sync for Apr 26 is still in progress. Numbers may update within the next hour.
          </div>
        </div>

        <KpiGrid kpis={salesKpis} columns={5} />

        {/* Revenue chart */}
        <SectionCard title="Revenue over time" description="Daily revenue (fact)">
          <div className="h-[280px]">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={revenueOverTime} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                <defs>
                  <linearGradient id="revArea" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="hsl(var(--chart-2))" stopOpacity={0.35} />
                    <stop offset="100%" stopColor="hsl(var(--chart-2))" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                <XAxis dataKey="day" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                <YAxis stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                <Area type="monotone" dataKey="revenue" stroke="hsl(var(--chart-2))" strokeWidth={2} fill="url(#revArea)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </SectionCard>

        {/* Tables */}
        <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
          <SectionCard title="Sales by source" noPadding>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesBySource.map((s) => (
                  <TableRow key={s.source}>
                    <TableCell className="font-medium">{s.source}</TableCell>
                    <TableCell className="text-right num">{s.sales}</TableCell>
                    <TableCell className="text-right num">{fmtCurrency(s.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard title="Sales by lead type" noPadding>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Lead type</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {salesByLeadType.map((s) => (
                  <TableRow key={s.type}>
                    <TableCell className="font-medium">{s.type}</TableCell>
                    <TableCell className="text-right num">{s.sales}</TableCell>
                    <TableCell className="text-right num">{fmtCurrency(s.revenue)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </SectionCard>

          <SectionCard title="Sales by tariff" noPadding>
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Tariff</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                </TableRow>
              </TableHeader>
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

        {/* Note about доплата */}
        <SectionCard title="About “доплата” handling">
          <p className="text-sm text-muted-foreground leading-relaxed">
            Доплата (top-up payments) are excluded from <span className="font-medium text-foreground">sales count</span> to avoid double-counting deals,
            but the actual payment amount is still included in <span className="font-medium text-foreground">revenue fact</span>.
            This keeps the sales pipeline metrics clean while preserving accurate revenue reporting.
          </p>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}
