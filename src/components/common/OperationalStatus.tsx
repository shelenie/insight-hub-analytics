import type { HTMLAttributes, ReactNode } from "react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import {
  operationalStatusDotClasses,
  operationalStatusSurfaceClasses,
  operationalStatusTextClasses,
  type OperationalStatusTone,
} from "@/components/common/statusStyles";

export function OperationalStatusSurface({
  tone = "neutral",
  withTextTone = false,
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: OperationalStatusTone;
  withTextTone?: boolean;
}) {
  return (
    <div
      className={cn(
        "rounded-md border",
        operationalStatusSurfaceClasses[tone],
        withTextTone && operationalStatusTextClasses[tone],
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

export function OperationalNotice({
  tone = "muted",
  className,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  tone?: "warning" | "info" | "success" | "muted";
}) {
  return (
    <OperationalStatusSurface
      tone={tone}
      withTextTone
      className={cn("px-3 py-2 text-xs", className)}
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

export function OperationalStatusDot({
  tone = "muted",
  className,
}: {
  tone?: OperationalStatusTone;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        operationalStatusDotClasses[tone],
        className,
      )}
    />
  );
}
