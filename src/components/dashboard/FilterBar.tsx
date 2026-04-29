import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Filter, RefreshCw, LayoutGrid, CalendarDays } from "lucide-react";
import { projects, reportGroups } from "@/data/mock";
import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { useI18n } from "@/i18n/I18nProvider";
import { DateFilter } from "./DateFilter";
import { useDateFilter } from "@/filters/DateContext";
import { SavedViewsMenu } from "./SavedViewsMenu";
import { CompareControl } from "./CompareControl";

interface FilterBarProps {
  showProject?: boolean;
  showGroup?: boolean;
  showDate?: boolean;
  showViewMode?: boolean;
  viewMode?: "summary" | "daily";
  onViewModeChange?: (m: "summary" | "daily") => void;
  extra?: React.ReactNode;
  freshness?: { source: string; status: "fresh" | "stale" | "failed"; lastSync: string };
}

export function FilterBar({
  showProject = true,
  showGroup = true,
  showDate = true,
  showViewMode = false,
  viewMode = "summary",
  onViewModeChange,
  extra,
  freshness,
}: FilterBarProps) {
  const { t, lang } = useI18n();
  const [project, setProject] = useState("all");
  const [group, setGroup] = useState("all");
  const date = useDateFilter();

  return (
    <div className="space-y-1.5">
      <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border/70 glass p-2 shadow-card-md">
        <div className="flex items-center gap-1.5 px-1.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">
          <Filter className="h-3.5 w-3.5 text-primary/70" />
          <Filter className="h-3.5 w-3.5" />
          {t("filters")}
        </div>

        {showDate && <DateFilter />}

        {showProject && (
          <Select value={project} onValueChange={setProject}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue placeholder={t("project")} />
            </SelectTrigger>
            <SelectContent>
              {projects.map((p) => (
                <SelectItem key={p.id} value={p.id} className="text-xs">
                  {lang === "uk" ? p.nameUk : p.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {showGroup && (
          <Select value={group} onValueChange={setGroup}>
            <SelectTrigger className="h-8 w-[170px] text-xs">
              <SelectValue placeholder={t("reportGroup")} />
            </SelectTrigger>
            <SelectContent>
              {reportGroups.map((g) => (
                <SelectItem key={g.id} value={g.id} className="text-xs">
                  {lang === "uk" ? g.nameUk : g.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {showViewMode && (
          <div className="flex items-center rounded-md border bg-background p-0.5">
            <button
              onClick={() => onViewModeChange?.("summary")}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === "summary" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <LayoutGrid className="h-3 w-3" />
              {t("summaryView")}
            </button>
            <button
              onClick={() => onViewModeChange?.("daily")}
              className={`flex items-center gap-1 rounded px-2 py-1 text-xs font-medium transition-colors ${
                viewMode === "daily" ? "bg-muted text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <CalendarDays className="h-3 w-3" />
              {t("dailyView")}
            </button>
          </div>
        )}

        {extra}

        <div className="ml-auto flex items-center gap-2">
          <SavedViewsMenu />
          <CompareControl />
          {freshness && (
            <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground">
              <span>{t("data")}</span>
              <StatusBadge status={freshness.status} label={`${freshness.source} · ${freshness.lastSync}`} />
            </div>
          )}
          <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
            <RefreshCw className="h-3.5 w-3.5" />
            {t("refresh")}
          </Button>
        </div>
      </div>

      {/* Active date context line — appears below filter bar so analyst always sees what KPIs reflect */}
      <div className="flex items-center gap-2 px-1 text-[11px] text-muted-foreground">
        <span className="inline-flex h-1.5 w-1.5 rounded-full bg-primary shadow-[0_0_0_3px_hsl(var(--primary)/0.15)]" />
        <span>
          {date.mode === "exact" ? t("activeDate") : t("activeRange")}:
          <span className="ml-1 font-semibold text-foreground">{date.contextLabel(lang)}</span>
        </span>
      </div>
    </div>
  );
}
