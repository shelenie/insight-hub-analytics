import { DashboardLayout } from "@/components/layout/DashboardLayout";
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
  importRuns,
  unknownMappings,
  dataQualityAlerts,
} from "@/data/mock";
import { fmtNum } from "@/lib/format";
import { RotateCw, CheckCircle2, AlertCircle, AlertTriangle, Info, ArrowRight } from "lucide-react";

export default function Imports() {
  const lastSuccess = importRuns.find((r) => r.status === "success");

  return (
    <DashboardLayout
      title="Imports / Data Health"
      subtitle="Operational control of all data sources"
    >
      <div className="space-y-4">
        {/* Top status row */}
        <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
          <div className="rounded-lg border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Last successful sync
              </div>
              <CheckCircle2 className="h-4 w-4 text-success" />
            </div>
            <div className="mt-1 text-base font-semibold">{lastSuccess?.startedAt}</div>
            <div className="text-xs text-muted-foreground">{lastSuccess?.source}</div>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Failed runs (24h)
              </div>
              <AlertCircle className="h-4 w-4 text-destructive" />
            </div>
            <div className="mt-1 text-2xl font-semibold num">1</div>
            <div className="text-xs text-muted-foreground">TikTok Ads — auth expired</div>
          </div>
          <div className="rounded-lg border bg-card p-4 shadow-card">
            <div className="flex items-center justify-between">
              <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                Unmapped values
              </div>
              <AlertTriangle className="h-4 w-4 text-warning-foreground" />
            </div>
            <div className="mt-1 text-2xl font-semibold num">{unknownMappings.length}</div>
            <div className="text-xs text-muted-foreground">awaiting human review</div>
          </div>
        </div>

        {/* Data quality alerts */}
        <SectionCard title="Data quality alerts" noPadding>
          <div className="divide-y">
            {dataQualityAlerts.map((a) => (
              <div key={a.id} className="flex items-center gap-3 px-4 py-3">
                <div
                  className={
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-md " +
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
                <div className="flex-1 text-sm">{a.message}</div>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  Investigate
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Recent imports */}
        <SectionCard title="Recent imports" description="Last 24h" noPadding>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Source → Target</TableHead>
                  <TableHead>Started</TableHead>
                  <TableHead className="text-right">Duration</TableHead>
                  <TableHead className="text-right">Received</TableHead>
                  <TableHead className="text-right">Inserted</TableHead>
                  <TableHead className="text-right">Failed</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead>Error</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {importRuns.map((r) => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.source}</TableCell>
                    <TableCell className="text-muted-foreground num">{r.startedAt}</TableCell>
                    <TableCell className="text-right num text-muted-foreground">{r.duration}</TableCell>
                    <TableCell className="text-right num">{fmtNum(r.rowsReceived)}</TableCell>
                    <TableCell className="text-right num">{fmtNum(r.rowsInserted)}</TableCell>
                    <TableCell className={`text-right num ${r.rowsFailed > 0 ? "text-destructive font-medium" : "text-muted-foreground"}`}>
                      {r.rowsFailed}
                    </TableCell>
                    <TableCell>
                      <StatusBadge status={r.status} />
                    </TableCell>
                    <TableCell className="max-w-[260px] truncate text-xs text-muted-foreground">
                      {r.error ?? "—"}
                    </TableCell>
                    <TableCell className="text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        disabled={r.status === "success"}
                      >
                        <RotateCw className="h-3 w-3" />
                        Retry
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        {/* Mapping queue */}
        <SectionCard title="Unknown mappings queue" description="Values found in raw data with no mapping target" noPadding>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Type</TableHead>
                  <TableHead>Raw value</TableHead>
                  <TableHead>Source</TableHead>
                  <TableHead className="text-right">Occurrences</TableHead>
                  <TableHead>Suggested mapping</TableHead>
                  <TableHead className="text-right">Action</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {unknownMappings.map((m) => (
                  <TableRow key={m.id}>
                    <TableCell>
                      <span className="rounded-md border bg-muted/50 px-1.5 py-0.5 text-[11px] font-medium">{m.type}</span>
                    </TableCell>
                    <TableCell className="font-mono text-xs">{m.value}</TableCell>
                    <TableCell className="text-muted-foreground">{m.source}</TableCell>
                    <TableCell className="text-right num">{m.count}</TableCell>
                    <TableCell>
                      <span className="inline-flex items-center gap-1.5 text-sm">
                        <ArrowRight className="h-3 w-3 text-muted-foreground" />
                        <span className="font-medium">{m.suggested}</span>
                      </span>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-1.5">
                        <Button variant="outline" size="sm" className="h-7 text-xs">
                          Approve
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          Edit
                        </Button>
                      </div>
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
