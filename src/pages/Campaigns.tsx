import { DashboardLayout } from "@/components/layout/DashboardLayout";
import { FilterBar } from "@/components/dashboard/FilterBar";
import { SectionCard } from "@/components/dashboard/SectionCard";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { campaignsTable } from "@/data/mock";
import { fmtCurrency, fmtNum } from "@/lib/format";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Download, Search, ArrowUpDown } from "lucide-react";
import { useMemo, useState } from "react";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

type SortKey = "spend" | "roas" | "ctr" | "cpl" | "revenue";

export default function Campaigns() {
  const [query, setQuery] = useState("");
  const [sort, setSort] = useState<SortKey>("roas");

  const filtered = useMemo(
    () =>
      [...campaignsTable]
        .filter(
          (c) =>
            c.campaign.toLowerCase().includes(query.toLowerCase()) ||
            c.placement.toLowerCase().includes(query.toLowerCase()),
        )
        .sort((a, b) => b[sort] - a[sort]),
    [query, sort],
  );

  const totals = useMemo(() => {
    const spend = filtered.reduce((s, c) => s + c.spend, 0);
    const revenue = filtered.reduce((s, c) => s + c.revenue, 0);
    const sales = filtered.reduce((s, c) => s + c.sales, 0);
    return { spend, revenue, sales, roas: spend ? revenue / spend : 0 };
  }, [filtered]);

  const byRoas = [...filtered].sort((a, b) => b.roas - a.roas).slice(0, 8);
  const bySpend = [...filtered].sort((a, b) => b.spend - a.spend).slice(0, 8);

  return (
    <DashboardLayout
      title="Campaigns / Placements"
      subtitle="Media buying analytics for the traffic team"
      actions={
        <Button size="sm" variant="outline" className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          Export CSV
        </Button>
      }
    >
      <div className="space-y-4">
        <FilterBar
          extra={
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search campaign or placement"
                className="h-8 w-[220px] pl-8 text-xs"
              />
            </div>
          }
          freshness={{ source: "fact_campaigns", status: "fresh", lastSync: "8 min ago" }}
        />

        {/* Quick comparison cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickCard label="Total spend" value={fmtCurrency(totals.spend)} />
          <QuickCard label="Total revenue" value={fmtCurrency(totals.revenue)} />
          <QuickCard label="Sales" value={fmtNum(totals.sales)} />
          <QuickCard label="Blended ROAS" value={`${totals.roas.toFixed(2)}x`} highlight />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SectionCard title="By ROAS" description="Top placements">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={byRoas} layout="vertical" margin={{ top: 5, right: 16, left: 100, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} />
                  <YAxis dataKey="campaign" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => `${v.toFixed(2)}x`} />
                  <Bar dataKey="roas" fill="hsl(var(--chart-2))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>

          <SectionCard title="By spend" description="Where the money goes">
            <div className="h-[260px]">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={bySpend} layout="vertical" margin={{ top: 5, right: 16, left: 100, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" horizontal={false} />
                  <XAxis type="number" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`} />
                  <YAxis dataKey="campaign" type="category" stroke="hsl(var(--muted-foreground))" fontSize={11} tickLine={false} axisLine={false} width={100} />
                  <Tooltip contentStyle={tooltipStyle} formatter={(v: number) => fmtCurrency(v)} />
                  <Bar dataKey="spend" fill="hsl(var(--chart-3))" radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </SectionCard>
        </div>

        <SectionCard
          title="All campaigns & placements"
          description={`${filtered.length} rows`}
          actions={
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              Sort:
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-7 rounded-md border bg-background px-1.5 text-xs"
              >
                <option value="roas">ROAS</option>
                <option value="spend">Spend</option>
                <option value="revenue">Revenue</option>
                <option value="ctr">CTR</option>
                <option value="cpl">CPL</option>
              </select>
            </div>
          }
          noPadding
        >
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[180px]">Campaign</TableHead>
                  <TableHead>Placement</TableHead>
                  <TableHead className="text-right">Spend</TableHead>
                  <TableHead className="text-right">Reach</TableHead>
                  <TableHead className="text-right">Clicks</TableHead>
                  <TableHead className="text-right">CPC</TableHead>
                  <TableHead className="text-right">CPM</TableHead>
                  <TableHead className="text-right">CTR</TableHead>
                  <TableHead className="text-right">Regs</TableHead>
                  <TableHead className="text-right">CPL</TableHead>
                  <TableHead className="text-right">Sales</TableHead>
                  <TableHead className="text-right">Revenue</TableHead>
                  <TableHead className="text-right">ROAS</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c, i) => (
                  <TableRow key={i}>
                    <TableCell className="font-medium">{c.campaign}</TableCell>
                    <TableCell className="text-muted-foreground">{c.placement}</TableCell>
                    <TableCell className="text-right num">{fmtCurrency(c.spend)}</TableCell>
                    <TableCell className="text-right num">{fmtNum(c.reach)}</TableCell>
                    <TableCell className="text-right num">{fmtNum(c.clicks)}</TableCell>
                    <TableCell className="text-right num">${c.cpc.toFixed(2)}</TableCell>
                    <TableCell className="text-right num">${c.cpm.toFixed(2)}</TableCell>
                    <TableCell className="text-right num">{c.ctr.toFixed(2)}%</TableCell>
                    <TableCell className="text-right num">{fmtNum(c.regs)}</TableCell>
                    <TableCell className="text-right num">${c.cpl.toFixed(2)}</TableCell>
                    <TableCell className="text-right num">{c.sales}</TableCell>
                    <TableCell className="text-right num">{fmtCurrency(c.revenue)}</TableCell>
                    <TableCell className={`text-right num font-semibold ${c.roas >= 4 ? "text-success" : c.roas < 3 ? "text-destructive" : ""}`}>
                      {c.roas.toFixed(2)}x
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>
      </div>
    </DashboardLayout>
  );
}

function QuickCard({ label, value, highlight }: { label: string; value: string; highlight?: boolean }) {
  return (
    <div className={`rounded-lg border bg-card p-4 shadow-card ${highlight ? "border-primary/30 bg-primary-soft/40" : ""}`}>
      <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className={`mt-1 text-xl font-semibold num ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}
