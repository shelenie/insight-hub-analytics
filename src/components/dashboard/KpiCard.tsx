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
  /** When true, gives the card a stronger premium emphasis (elevated surface, larger value) */
  emphasis?: boolean;
}

export function KpiCard({
  label,
  value,
  unit,
  delta,
  hint,
  compact,
  showDateContext,
  accent,
  emphasis,
  labelKey,
}: KpiCardProps) {
  const trend = delta === undefined ? "flat" : delta > 0 ? "up" : delta < 0 ? "down" : "flat";
  const date = useDateFilter();
  const { lang, t } = useI18n();
  const resolvedLabel = labelKey ? t(labelKey as any) : label;

  return (
    <Card
      className={cn(
        "group relative overflow-hidden border-border/70 transition-all hover:border-primary/40 hover:shadow-card-md",
        emphasis ? "bg-card-elevated shadow-card-md" : "bg-card",
        (accent || emphasis) && "ring-accent-top",
      )}
    >
      <CardContent className={cn("p-4", compact && "p-3", emphasis && "p-5")}>
        <div className="flex items-center justify-between gap-2">
          <div
            className={cn(
              "text-[10px] font-semibold uppercase tracking-[0.1em] text-muted-foreground",
              emphasis && "text-[10.5px] text-foreground/70",
            )}
          >
            {resolvedLabel}
          </div>
          {delta !== undefined && (
            <div
              className={cn(
                "flex items-center gap-0.5 rounded-md border px-1.5 py-0.5 text-[10.5px] font-semibold num tabular-nums",
                trend === "up" && "border-success/20 bg-success-soft text-success",
                trend === "down" && "border-destructive/20 bg-destructive-soft text-destructive",
                trend === "flat" && "border-border/60 bg-muted text-muted-foreground",
              )}
            >
              {trend === "up" && <ArrowUp className="h-3 w-3" />}
              {trend === "down" && <ArrowDown className="h-3 w-3" />}
              {trend === "flat" && <Minus className="h-3 w-3" />}
              {fmtDelta(Math.abs(delta))}
            </div>
          )}
        </div>
        <div
          className={cn(
            "mt-2.5 font-semibold leading-none num text-foreground",
            emphasis ? "text-[32px] tracking-[-0.02em]" : "text-[26px] tracking-[-0.01em]",
          )}
        >
          {fmtKpi(value, unit, hint)}
        </div>
        {showDateContext && (
          <div className="mt-3 flex items-center gap-1.5 truncate text-[10.5px] text-muted-foreground">
            <span className="inline-flex h-1 w-1 rounded-full bg-primary/70" />
            <span className="truncate">
              {lang === "uk" ? "за" : "for"} {date.contextLabel(lang)}
              {delta !== undefined && (
                <>
                  <span className="mx-1.5 text-muted-foreground/40">·</span>
                  <span className={cn(trend === "up" && "text-success", trend === "down" && "text-destructive")}>
                    {trend === "up" ? "+" : trend === "down" ? "−" : ""}
                    {fmtDelta(Math.abs(delta!))}{" "}
                    <span className="text-muted-foreground">{lang === "uk" ? "vs попередній" : "vs prev"}</span>
                  </span>
                </>
              )}
            </span>
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
  emphasisKeys,
  subtitleMode = "all",
}: {
  kpis: Kpi[];
  columns?: 3 | 4 | 5 | 6;
  showDateContext?: boolean;
  accentFirst?: boolean;
  emphasisKeys?: string[];
  /** "all": every card shows date subtitle; "emphasis": only emphasized cards do */
  subtitleMode?: "all" | "emphasis";
}) {
  const colsClass: Record<number, string> = {
    3: "md:grid-cols-3",
    4: "md:grid-cols-2 lg:grid-cols-4",
    5: "md:grid-cols-3 lg:grid-cols-5",
    6: "md:grid-cols-3 lg:grid-cols-6",
  };
  return (
    <div className={cn("grid grid-cols-2 gap-3", colsClass[columns])}>
      {kpis.map((k, i) => {
        const isEmphasis = emphasisKeys?.includes(k.key) ?? false;
        return (
          <KpiCard
            key={k.key}
            {...k}
            showDateContext={showDateContext && (subtitleMode === "all" || isEmphasis)}
            accent={accentFirst && i === 0 && !isEmphasis}
            emphasis={isEmphasis}
          />
        );
      })}
    </div>
  );
}
