import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Filter, RefreshCw, LayoutGrid, CalendarDays } from "lucide-react";
import { projects, reportGroups, dateRangePresets } from "@/data/mock";
import { useState } from "react";
import { StatusBadge } from "./StatusBadge";
import { useI18n } from "@/i18n/I18nProvider";

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
  const [range, setRange] = useState("30d");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-card">
      <div className="flex items-center gap-1.5 px-1.5 text-xs font-medium text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        {t("filters")}
      </div>

      {showDate && (
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-8 w-[180px] text-xs">
            <CalendarIcon className="h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dateRangePresets.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-xs">
                {t(r.labelKey)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

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
  );
}
