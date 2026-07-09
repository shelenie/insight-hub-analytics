export const operationalStatusSurfaceClasses = {
  warning:
    "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20",
  success:
    "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20",
  neutral: "border-border/70 bg-card/60",
  muted: "border-border/70 bg-muted/20",
} as const;

export type OperationalStatusTone =
  keyof typeof operationalStatusSurfaceClasses;
