import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useI18n } from "@/i18n/I18nProvider";
import type { TranslationKey } from "@/i18n/translations";

type Status =
  | "success"
  | "partial"
  | "failed"
  | "fresh"
  | "stale"
  | "healthy"
  | "warning"
  | "critical"
  | "info";

const map: Record<Status, { labelKey: TranslationKey; className: string; dot: string }> = {
  success: { labelKey: "statusSuccess", className: "bg-success-soft text-success border-success/25", dot: "bg-success" },
  fresh: { labelKey: "statusFresh", className: "bg-success-soft text-success border-success/25", dot: "bg-success" },
  healthy: { labelKey: "statusHealthy", className: "bg-success-soft text-success border-success/25", dot: "bg-success" },
  partial: { labelKey: "statusPartial", className: "bg-warning-soft text-warning-foreground border-warning/30", dot: "bg-warning" },
  warning: { labelKey: "statusWarning", className: "bg-warning-soft text-warning-foreground border-warning/30", dot: "bg-warning" },
  stale: { labelKey: "statusStale", className: "bg-warning-soft text-warning-foreground border-warning/30", dot: "bg-warning" },
  failed: { labelKey: "statusFailed", className: "bg-destructive-soft text-destructive border-destructive/25", dot: "bg-destructive" },
  critical: { labelKey: "statusCritical", className: "bg-destructive-soft text-destructive border-destructive/25", dot: "bg-destructive" },
  info: { labelKey: "statusInfo", className: "bg-info-soft text-info border-info/25", dot: "bg-info" },
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const { t } = useI18n();
  const cfg = map[status];
  return (
    <Badge
      variant="outline"
      className={cn(
        "h-5 gap-1.5 rounded-md border px-1.5 text-[10.5px] font-semibold uppercase tracking-wide",
        cfg.className,
      )}
    >
      <span className={cn("h-1.5 w-1.5 rounded-full", cfg.dot)} />
      {label ?? t(cfg.labelKey)}
    </Badge>
  );
}
