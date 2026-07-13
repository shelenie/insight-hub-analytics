export const operationalStatusSurfaceClasses = {
  warning:
    "border-amber-200 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20",
  success:
    "border-emerald-200 bg-emerald-50/70 dark:border-emerald-900/60 dark:bg-emerald-950/20",
  info: "border-sky-200 bg-sky-50/70 dark:border-sky-900/60 dark:bg-sky-950/20",
  error: "border-red-200 bg-red-50/70 dark:border-red-900/60 dark:bg-red-950/20",
  neutral: "border-border/70 bg-card/60",
  muted: "border-border/70 bg-muted/20",
} as const;

export type OperationalStatusTone =
  keyof typeof operationalStatusSurfaceClasses;

export const operationalStatusTextClasses = {
  warning: "text-amber-950 dark:text-amber-100",
  success: "text-emerald-950 dark:text-emerald-100",
  info: "text-sky-950 dark:text-sky-100",
  error: "text-red-950 dark:text-red-100",
  muted: "text-muted-foreground",
  neutral: "text-foreground",
} as const;

export const operationalStatusDotClasses = {
  warning: "bg-amber-500",
  success: "bg-emerald-500",
  info: "bg-sky-500",
  error: "bg-red-500",
  muted: "bg-muted-foreground/40",
  neutral: "bg-muted-foreground/40",
} as const;
