import { Card, CardContent } from "@/components/ui/card";
import { fmtKpi, fmtDelta } from "@/lib/format";
import { ArrowDown, ArrowUp, Minus } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Kpi } from "@/data/mock";

interface KpiCardProps extends Kpi {
  compact?: boolean;
}

export function KpiCard({ label, value, unit, delta, hint, compact }: KpiCardProps) {
  const trend = delta === undefined ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  return (
    <Card className="shadow-card hover:shadow-card-md transition-shadow">
      <CardContent className={cn("p-4", compact && "p-3")}>
        <div className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </div>
        <div className="mt-1.5 flex items-baseline justify-between gap-2">
          <div className="text-2xl font-semibold num leading-tight">
            {fmtKpi(value, unit, hint)}
          </div>
          {delta !== undefined && (
            <div
              className={cn(
                "flex items-center gap-0.5 rounded-md px-1.5 py-0.5 text-[11px] font-medium num",
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
      </CardContent>
    </Card>
  );
}

export function KpiGrid({ kpis, columns = 4 }: { kpis: Kpi[]; columns?: 3 | 4 | 5 | 6 }) {
  const colsClass: Record<number, string> = {
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
    5: "md:grid-cols-3 lg:grid-cols-5",
    6: "md:grid-cols-3 lg:grid-cols-6",
  };
  return (
    <div className={cn("grid grid-cols-2 gap-3", colsClass[columns])}>
      {kpis.map((k) => (
        <KpiCard key={k.key} {...k} />
      ))}
    </div>
  );
}
