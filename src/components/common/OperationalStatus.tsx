import type { HTMLAttributes, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  operationalStatusSurfaceClasses,
  type OperationalStatusTone,
} from "@/components/common/statusStyles";

export function OperationalStatusSurface({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: OperationalStatusTone }) {
  return (
    <div
      className={cn(
        "rounded-md border",
        operationalStatusSurfaceClasses[tone],
        className,
      )}
      {...props}
    />
  );
}

export function CompactStatusSummaryCard({
  tone = "neutral",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & { tone?: OperationalStatusTone }) {
  return (
    <OperationalStatusSurface
      tone={tone}
      className={cn("p-4", className)}
      {...props}
    />
  );
}

export function StatusBadge({
  tone = "muted",
  children,
  className,
}: {
  tone?: "success" | "warning" | "info" | "muted";
  children: ReactNode;
  className?: string;
}) {
  return (
    <Badge variant={tone} className={className}>
      {children}
    </Badge>
  );
}
