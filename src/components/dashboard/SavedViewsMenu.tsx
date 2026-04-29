import { useState } from "react";
import { Bookmark, BookmarkPlus, Trash2 } from "lucide-react";
import { useLocation } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useSavedViews } from "@/preferences/SavedViewsProvider";
import { useDateFilter } from "@/filters/DateContext";
import { useI18n } from "@/i18n/I18nProvider";

export function SavedViewsMenu() {
  const { t } = useI18n();
  const loc = useLocation();
  const { views, saveView, removeView } = useSavedViews();
  const date = useDateFilter();
  const [name, setName] = useState("");

  const scopedViews = views.filter((v) => v.scope === loc.pathname || v.scope === null);

  function handleSave() {
    if (!name.trim()) return;
    saveView({
      name: name.trim(),
      scope: loc.pathname,
      date: {
        mode: date.mode,
        preset: date.preset,
        exactDate: date.exactDate.toISOString(),
        rangeFrom: date.rangeFrom.toISOString(),
        rangeTo: date.rangeTo.toISOString(),
      },
    });
    setName("");
  }

  function applyView(v: (typeof views)[number]) {
    if (v.date.mode === "exact" && v.date.exactDate) {
      date.setExactDate(new Date(v.date.exactDate));
    } else if (v.date.mode === "range" && v.date.rangeFrom && v.date.rangeTo) {
      date.setRange(new Date(v.date.rangeFrom), new Date(v.date.rangeTo));
      date.setMode("range");
    } else if (v.date.mode === "preset" && v.date.preset) {
      date.setPreset(v.date.preset);
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <Bookmark className="h-3.5 w-3.5" />
          {t("savedViews")}
          {scopedViews.length > 0 && (
            <span className="rounded bg-muted px-1 text-[10px] font-medium">{scopedViews.length}</span>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel className="text-xs">{t("savedViews")}</DropdownMenuLabel>
        <DropdownMenuSeparator />

        <div className="flex items-center gap-1.5 px-2 pb-2">
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder={t("savedViewNamePlaceholder")}
            className="h-8 text-xs"
            onKeyDown={(e) => e.key === "Enter" && handleSave()}
          />
          <Button size="sm" className="h-8 px-2" onClick={handleSave} disabled={!name.trim()}>
            <BookmarkPlus className="h-3.5 w-3.5" />
          </Button>
        </div>

        <DropdownMenuSeparator />

        {scopedViews.length === 0 && (
          <div className="px-2 py-3 text-center text-[11px] text-muted-foreground">
            {t("noSavedViews")}
          </div>
        )}

        {scopedViews.map((v) => (
          <DropdownMenuItem
            key={v.id}
            onSelect={(e) => {
              e.preventDefault();
              applyView(v);
            }}
            className="flex items-center justify-between gap-2 text-xs"
          >
            <div className="min-w-0 flex-1">
              <div className="truncate font-medium">{v.name}</div>
              <div className="truncate text-[10px] text-muted-foreground">
                {v.date.mode === "exact"
                  ? `Exact · ${v.date.exactDate?.slice(0, 10)}`
                  : v.date.mode === "range"
                  ? `Range · ${v.date.rangeFrom?.slice(0, 10)} → ${v.date.rangeTo?.slice(0, 10)}`
                  : `Preset · ${v.date.preset}`}
              </div>
            </div>
            <button
              onClick={(e) => {
                e.stopPropagation();
                removeView(v.id);
              }}
              className="shrink-0 rounded p-1 text-muted-foreground hover:bg-muted hover:text-destructive"
              aria-label="Delete"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
