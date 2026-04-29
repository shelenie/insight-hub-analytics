import { Card, CardContent } from "@/components/ui/card";
import { fmtKpi, fmtDelta } from "@/lib/format";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Kpi } from "@/data/mock";
import { useDateFilter } from "@/filters/DateContext";
import { useI18n } from "@/i18n/I18nProvider";

interface KpiCardProps extends Kpi {
  compact?: boolean;
  /** When true, renders a small subtitle showing the active date context */
  showDateContext?: boolean;
  /** When true, applies a subtle accent top line — use for the lead KPI in a group */
  accent?: boolean;
}

export function KpiCard({ label, value, unit, delta, hint, compact, showDateContext, accent }: KpiCardProps) {
  const trend = delta === undefined ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const date = useDateFilter();
  const { lang } = useI18n();
  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/70 bg-card transition-all hover:border-primary/30 hover:shadow-card-md",
        accent && "ring-accent-top",
      )}
    >
      <CardContent className={cn("p-4", compact && "p-3")}>
        <div className="flex items-center justify-between gap-2">
          <div className="text-[10px] font-semibold uppercase tracking-[0.08em] text-muted-foreground">
            {label}
          </div>
          {delta !== undefined && (
            <div
              className={cn(
                "flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[10.5px] font-semibold num tabular-nums",
                trend === "up" && "bg-success-soft text-success",
                trend === "down" && "bg-destructive-soft text-destructive",
                trend === "flat" && "bg-muted text-muted-foreground",
              )}
            >
              {trend === "up" && <ArrowUp className="h-3 w-3" />}
              {trend === "down" && <ArrowDown className="h-3 w-3" />}
              {trend === "flat" && <Minus className="h-3 w-3" />}
              {fmtDelta(Math.abs(delta))}
            </div>
          )}
        </div>
        <div className="mt-2 text-[26px] font-semibold leading-none num text-foreground">
          {fmtKpi(value, unit, hint)}
        </div>
        {showDateContext && (
          <div className="mt-2.5 flex items-center gap-1.5 truncate text-[10.5px] text-muted-foreground">
            <span className="inline-flex h-1 w-1 rounded-full bg-primary/70" />
            {date.contextLabel(lang)}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export function KpiGrid({
  kpis,
  columns = 4,
  showDateContext = true,
  accentFirst = true,
}: {
  kpis: Kpi[];
  columns?: 3 | 4 | 5 | 6;
  showDateContext?: boolean;
  accentFirst?: boolean;
}) {
  const colsClass: Record<number, string> = {
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
    5: "md:grid-cols-3 lg:grid-cols-5",
    6: "md:grid-cols-3 lg:grid-cols-6",
  };
  return (
    <div className={cn("grid grid-cols-2 gap-3", colsClass[columns])}>
      {kpis.map((k, i) => (
        <KpiCard key={k.key} {...k} showDateContext={showDateContext} accent={accentFirst && i === 0} />
      ))}
    </div>
  );
}
