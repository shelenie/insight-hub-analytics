import { GitCompare, Percent, Hash } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { useEffect } from "react";
import { usePreferences } from "@/preferences/PreferencesProvider";
import { useI18n } from "@/i18n/I18nProvider";
import { useDateFilter } from "@/filters/DateContext";
import { Check } from "lucide-react";

export function CompareControl() {
  const { t, lang } = useI18n();
  const date = useDateFilter();
  const { compareMode, compareDisplay, setPref } = usePreferences();
  const isExactDateMode = date.mode === "exact";

  useEffect(() => {
    if (compareMode === "yesterday" && !isExactDateMode) {
      setPref("compareMode", "none");
    }
  }, [compareMode, isExactDateMode, setPref]);

  const modeLabel =
    compareMode === "yesterday"
      ? t("compareYesterday")
      : compareMode === "previous_period"
      ? t("comparePrevious")
      : t("compareNone");

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="h-8 gap-1.5 text-xs">
          <GitCompare className="h-3.5 w-3.5" />
          {t("compare")}: <span className="font-medium">{modeLabel}</span>
          <span className="ml-1 inline-flex h-4 items-center rounded bg-muted px-1 text-[10px]">
            {compareDisplay === "percent" ? "%" : "Δ"}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-56">
        <DropdownMenuLabel className="text-xs">{t("compareMode")}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setPref("compareMode", "none")} className="gap-2 text-xs">
          {compareMode === "none" && <Check className="h-3.5 w-3.5" />}
          {t("compareNone")}
        </DropdownMenuItem>
        <DropdownMenuItem
          onSelect={() => {
            if (!isExactDateMode) return;
            setPref("compareMode", "yesterday");
          }}
          disabled={!isExactDateMode}
          className="gap-2 text-xs"
        >
          {compareMode === "yesterday" && <Check className="h-3.5 w-3.5" />}
          <span>{t("compareYesterday")}</span>
          {!isExactDateMode && <span className="ml-auto text-[10px] text-muted-foreground">{lang === "uk" ? "Тільки для конкретної дати" : "Exact date only"}</span>}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setPref("compareMode", "previous_period")} className="gap-2 text-xs">
          {compareMode === "previous_period" && <Check className="h-3.5 w-3.5" />}
          {t("comparePrevious")}
        </DropdownMenuItem>

        <DropdownMenuSeparator />
        <DropdownMenuLabel className="text-xs">{t("compareDisplay")}</DropdownMenuLabel>
        <DropdownMenuItem onSelect={() => setPref("compareDisplay", "percent")} className="gap-2 text-xs">
          <Percent className="h-3.5 w-3.5" />
          {t("comparePercent")}
          {compareDisplay === "percent" && <Check className="ml-auto h-3.5 w-3.5" />}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => setPref("compareDisplay", "absolute")} className="gap-2 text-xs">
          <Hash className="h-3.5 w-3.5" />
          {t("compareAbsolute")}
          {compareDisplay === "absolute" && <Check className="ml-auto h-3.5 w-3.5" />}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
