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
import { useI18n } from "@/i18n/I18nProvider";

const tooltipStyle = {
  background: "hsl(var(--card))",
  border: "1px solid hsl(var(--border))",
  borderRadius: "8px",
  fontSize: "12px",
};

type SortKey = "spend" | "roas" | "ctr" | "cpl" | "revenue";

export default function Campaigns() {
  const { t } = useI18n();
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
      title={t("campaignsTitle")}
      subtitle={t("campaignsSubtitle")}
      actions={
        <Button size="sm" variant="outline" className="gap-1.5">
          <Download className="h-3.5 w-3.5" />
          {t("exportCsv")}
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
                placeholder={t("searchPlaceholder")}
                className="h-8 w-[220px] pl-8 text-xs"
              />
            </div>
          }
          freshness={{ source: "fact_campaigns", status: "fresh", lastSync: "8 min" }}
        />

        {/* Quick comparison cards */}
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <QuickCard label={t("totalSpend")} value={fmtCurrency(totals.spend)} />
          <QuickCard label={t("totalRevenue")} value={fmtCurrency(totals.revenue)} />
          <QuickCard label={t("kpiSales")} value={fmtNum(totals.sales)} />
          <QuickCard label={t("blendedRoas")} value={`${totals.roas.toFixed(2)}x`} highlight />
        </div>

        <div className="grid grid-cols-1 gap-4 xl:grid-cols-2">
          <SectionCard title={t("byRoas")}>
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

          <SectionCard title={t("bySpend")}>
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
          title={t("allCampaigns")}
          description={`${filtered.length} ${t("rows")}`}
          actions={
            <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <ArrowUpDown className="h-3.5 w-3.5" />
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortKey)}
                className="h-7 rounded-md border bg-background px-1.5 text-xs"
              >
                <option value="roas">ROAS</option>
                <option value="spend">{t("thSpend")}</option>
                <option value="revenue">{t("thRevenue")}</option>
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
                  <TableHead className="min-w-[180px]">{t("thCampaign")}</TableHead>
                  <TableHead>{t("thPlacement")}</TableHead>
                  <TableHead className="text-right">{t("thSpend")}</TableHead>
                  <TableHead className="text-right">{t("thReach")}</TableHead>
                  <TableHead className="text-right">{t("thClicks")}</TableHead>
                  <TableHead className="text-right">{t("thCpc")}</TableHead>
                  <TableHead className="text-right">{t("thCpm")}</TableHead>
                  <TableHead className="text-right">{t("thCtr")}</TableHead>
                  <TableHead className="text-right">{t("thRegs")}</TableHead>
                  <TableHead className="text-right">{t("thCpl")}</TableHead>
                  <TableHead className="text-right">{t("thSales")}</TableHead>
                  <TableHead className="text-right">{t("thRevenue")}</TableHead>
                  <TableHead className="text-right">{t("thRoas")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {filtered.map((c, i) => (
                  <TableRow key={i} className="text-xs">
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
