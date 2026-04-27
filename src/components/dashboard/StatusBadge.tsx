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

const map: Record<Status, { labelKey: TranslationKey; className: string }> = {
  success: { labelKey: "statusSuccess", className: "bg-success-soft text-success border-success/20" },
  fresh: { labelKey: "statusFresh", className: "bg-success-soft text-success border-success/20" },
  healthy: { labelKey: "statusHealthy", className: "bg-success-soft text-success border-success/20" },
  partial: { labelKey: "statusPartial", className: "bg-warning-soft text-warning-foreground border-warning/30" },
  warning: { labelKey: "statusWarning", className: "bg-warning-soft text-warning-foreground border-warning/30" },
  stale: { labelKey: "statusStale", className: "bg-warning-soft text-warning-foreground border-warning/30" },
  failed: { labelKey: "statusFailed", className: "bg-destructive-soft text-destructive border-destructive/20" },
  critical: { labelKey: "statusCritical", className: "bg-destructive-soft text-destructive border-destructive/20" },
  info: { labelKey: "statusInfo", className: "bg-info-soft text-info border-info/20" },
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const { t } = useI18n();
  const cfg = map[status];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium border", cfg.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full bg-current opacity-80")} />
      {label ?? t(cfg.labelKey)}
    </Badge>
  );
}
