import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

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

const map: Record<Status, { label: string; className: string }> = {
  success: { label: "Success", className: "bg-success-soft text-success border-success/20" },
  fresh: { label: "Fresh", className: "bg-success-soft text-success border-success/20" },
  healthy: { label: "Healthy", className: "bg-success-soft text-success border-success/20" },
  partial: { label: "Partial", className: "bg-warning-soft text-warning-foreground border-warning/30" },
  warning: { label: "Warning", className: "bg-warning-soft text-warning-foreground border-warning/30" },
  stale: { label: "Stale", className: "bg-warning-soft text-warning-foreground border-warning/30" },
  failed: { label: "Failed", className: "bg-destructive-soft text-destructive border-destructive/20" },
  critical: { label: "Critical", className: "bg-destructive-soft text-destructive border-destructive/20" },
  info: { label: "Info", className: "bg-info-soft text-info border-info/20" },
};

export function StatusBadge({ status, label }: { status: Status; label?: string }) {
  const cfg = map[status];
  return (
    <Badge variant="outline" className={cn("gap-1 font-medium border", cfg.className)}>
      <span className={cn("h-1.5 w-1.5 rounded-full", `bg-current opacity-80`)} />
      {label ?? cfg.label}
    </Badge>
  );
}
