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
  dataFreshness,
} from "@/data/mock";
import { fmtNum } from "@/lib/format";
import {
  RotateCw,
  CheckCircle2,
  AlertCircle,
  AlertTriangle,
  Info,
  ArrowRight,
  Clock,
  XCircle,
} from "lucide-react";
import { useI18n } from "@/i18n/I18nProvider";

export default function Imports() {
  const { t, lang } = useI18n();
  const lastSuccess = importRuns.find((r) => r.status === "success");
  const failedCount = importRuns.filter((r) => r.status === "failed").length;
  const partialCount = importRuns.filter((r) => r.status === "partial").length;
  const staleCount = dataFreshness.filter((d) => d.status === "stale").length;

  return (
    <DashboardLayout title={t("importsTitle")} subtitle={t("importsSubtitle")}>
      <div className="space-y-4">
        {/* Top status row */}
        <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <OpsCard
            label={t("lastSuccessSync")}
            value={lastSuccess?.startedAt ?? "—"}
            sub={lastSuccess?.source}
            icon={<CheckCircle2 className="h-4 w-4 text-success" />}
          />
          <OpsCard
            label={t("failedImport")}
            value={String(failedCount)}
            sub={failedCount > 0 ? "TikTok Ads — auth" : "—"}
            icon={<XCircle className="h-4 w-4 text-destructive" />}
            danger={failedCount > 0}
          />
          <OpsCard
            label={t("partialImport")}
            value={String(partialCount)}
            sub={partialCount > 0 ? "Sheets · CRM mapping" : "—"}
            icon={<AlertTriangle className="h-4 w-4 text-warning-foreground" />}
            warn={partialCount > 0}
          />
          <OpsCard
            label={t("unmappedQueue")}
            value={String(unknownMappings.length)}
            sub={t("awaitingReview")}
            icon={<Clock className="h-4 w-4 text-info" />}
          />
        </div>

        {/* Stale + freshness */}
        {staleCount > 0 && (
          <div className="flex items-start gap-2 rounded-lg border border-warning/30 bg-warning-soft px-3 py-2.5 text-sm">
            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-warning-foreground" />
            <div className="text-warning-foreground">
              <span className="font-medium">{t("staleWarning")}:</span>{" "}
              {dataFreshness
                .filter((d) => d.status === "stale")
                .map((d) => `${d.source} (${d.lastSync})`)
                .join(", ")}
            </div>
          </div>
        )}

        {/* Data quality alerts */}
        <SectionCard title={t("qualityAlerts")} noPadding>
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
                <div className="flex-1 text-sm">{lang === "uk" ? a.messageUk : a.messageEn}</div>
                <Button variant="ghost" size="sm" className="h-7 text-xs">
                  {t("investigate")}
                </Button>
              </div>
            ))}
          </div>
        </SectionCard>

        {/* Recent imports */}
        <SectionCard title={t("recentImports")} description={t("recentImportsDesc")} noPadding>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("thSource")}</TableHead>
                  <TableHead>{t("thStarted")}</TableHead>
                  <TableHead className="text-right">{t("thDuration")}</TableHead>
                  <TableHead className="text-right">{t("thReceived")}</TableHead>
                  <TableHead className="text-right">{t("thInserted")}</TableHead>
                  <TableHead className="text-right">{t("thFailed")}</TableHead>
                  <TableHead>{t("thStatus")}</TableHead>
                  <TableHead>{t("thError")}</TableHead>
                  <TableHead className="text-right">{t("thAction")}</TableHead>
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
                        {t("retry")}
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </SectionCard>

        {/* Mapping queue */}
        <SectionCard title={t("unknownMappings")} description={t("unknownMappingsDesc")} noPadding>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("thType")}</TableHead>
                  <TableHead>{t("thRawValue")}</TableHead>
                  <TableHead>{t("thSource")}</TableHead>
                  <TableHead className="text-right">{t("thOccurrences")}</TableHead>
                  <TableHead>{t("thSuggested")}</TableHead>
                  <TableHead className="text-right">{t("thAction")}</TableHead>
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
                          {t("approve")}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 text-xs">
                          {t("edit")}
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

function OpsCard({
  label,
  value,
  sub,
  icon,
  danger,
  warn,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  danger?: boolean;
  warn?: boolean;
}) {
  return (
    <div
      className={`rounded-lg border bg-card p-4 shadow-card ${
        danger ? "border-destructive/30" : warn ? "border-warning/30" : ""
      }`}
    >
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</div>
        {icon}
      </div>
      <div className="mt-1 text-base font-semibold num truncate">{value}</div>
      {sub && <div className="text-xs text-muted-foreground truncate">{sub}</div>}
    </div>
  );
}
