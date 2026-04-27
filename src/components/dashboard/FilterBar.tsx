import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Calendar as CalendarIcon, Filter, RefreshCw } from "lucide-react";
import { projects, reportGroups, dateRanges } from "@/data/mock";
import { useState } from "react";
import { StatusBadge } from "./StatusBadge";

interface FilterBarProps {
  showProject?: boolean;
  showGroup?: boolean;
  showDate?: boolean;
  extra?: React.ReactNode;
  freshness?: { source: string; status: "fresh" | "stale" | "failed"; lastSync: string };
}

export function FilterBar({
  showProject = true,
  showGroup = true,
  showDate = true,
  extra,
  freshness,
}: FilterBarProps) {
  const [project, setProject] = useState("all");
  const [group, setGroup] = useState("all");
  const [range, setRange] = useState("30d");

  return (
    <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-2 shadow-card">
      <div className="flex items-center gap-1.5 px-1.5 text-xs font-medium text-muted-foreground">
        <Filter className="h-3.5 w-3.5" />
        Filters
      </div>

      {showDate && (
        <Select value={range} onValueChange={setRange}>
          <SelectTrigger className="h-8 w-[150px] text-xs">
            <CalendarIcon className="h-3.5 w-3.5" />
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {dateRanges.map((r) => (
              <SelectItem key={r.id} value={r.id} className="text-xs">
                {r.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showProject && (
        <Select value={project} onValueChange={setProject}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="Project" />
          </SelectTrigger>
          <SelectContent>
            {projects.map((p) => (
              <SelectItem key={p.id} value={p.id} className="text-xs">
                {p.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {showGroup && (
        <Select value={group} onValueChange={setGroup}>
          <SelectTrigger className="h-8 w-[170px] text-xs">
            <SelectValue placeholder="Report group" />
          </SelectTrigger>
          <SelectContent>
            {reportGroups.map((g) => (
              <SelectItem key={g.id} value={g.id} className="text-xs">
                {g.name}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {extra}

      <div className="ml-auto flex items-center gap-2">
        {freshness && (
          <div className="hidden md:flex items-center gap-2 text-[11px] text-muted-foreground">
            <span>Data:</span>
            <StatusBadge status={freshness.status} label={`${freshness.source} · ${freshness.lastSync}`} />
          </div>
        )}
        <Button variant="ghost" size="sm" className="h-8 gap-1.5 text-xs">
          <RefreshCw className="h-3.5 w-3.5" />
          Refresh
        </Button>
      </div>
    </div>
  );
}
