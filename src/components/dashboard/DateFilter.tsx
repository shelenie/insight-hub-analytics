import { useState } from "react";
import { addDays, format, parse, subDays, isValid } from "date-fns";
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Calendar } from "@/components/ui/calendar";
import { CalendarIcon, ChevronLeft, ChevronRight, Check } from "lucide-react";
import { cn } from "@/lib/utils";
import { useDateFilter, type DatePresetId } from "@/filters/DateContext";
import { useI18n } from "@/i18n/I18nProvider";

const presets: { id: DatePresetId; key: "dateToday" | "dateYesterday" | "date7d" | "date30d" | "dateMtd" | "dateQtd" }[] = [
  { id: "today", key: "dateToday" },
  { id: "yesterday", key: "dateYesterday" },
  { id: "7d", key: "date7d" },
  { id: "30d", key: "date30d" },
  { id: "mtd", key: "dateMtd" },
  { id: "qtd", key: "dateQtd" },
];

export function DateFilter() {
  const { t } = useI18n();
  const f = useDateFilter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"preset" | "exact" | "range">(f.mode);
  const [exactInput, setExactInput] = useState(format(f.exactDate, "yyyy-MM-dd"));

  function commitExact(d: Date) {
    f.setExactDate(d);
    setExactInput(format(d, "yyyy-MM-dd"));
  }

  function onExactInputBlur() {
    const parsed = parse(exactInput, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) commitExact(parsed);
    else setExactInput(format(f.exactDate, "yyyy-MM-dd"));
  }

  const triggerLabel =
    f.mode === "exact"
      ? format(f.exactDate, "dd MMM yyyy")
      : f.mode === "range"
      ? `${format(f.rangeFrom, "dd MMM")} – ${format(f.rangeTo, "dd MMM yyyy")}`
      : t(`date${f.preset.charAt(0).toUpperCase() + f.preset.slice(1)}` as "dateToday");

  return (
    <div className="flex items-center gap-1">
      {f.mode === "exact" && (
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => f.setExactDate(subDays(f.exactDate, 1))}
          aria-label="Previous day"
        >
          <ChevronLeft className="h-3.5 w-3.5" />
        </Button>
      )}

      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            size="sm"
            className="h-8 min-w-[200px] justify-start gap-1.5 px-2.5 text-xs font-medium"
          >
            <CalendarIcon className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="truncate">{triggerLabel}</span>
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-[460px] p-0" align="start">
          <div className="grid grid-cols-[160px_1fr]">
            {/* Side: presets + modes */}
            <div className="border-r bg-muted/30 p-2">
              <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("quickPresets")}
              </div>
              {presets.map((p) => (
                <button
                  key={p.id}
                  onClick={() => { f.setPreset(p.id); setTab("preset"); setOpen(false); }}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                    f.mode === "preset" && f.preset === p.id && "bg-primary-soft text-primary font-medium",
                  )}
                >
                  <span>{t(p.key)}</span>
                  {f.mode === "preset" && f.preset === p.id && <Check className="h-3 w-3" />}
                </button>
              ))}
              <div className="my-2 border-t" />
              <div className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("dateMode")}
              </div>
              <button
                onClick={() => setTab("exact")}
                className={cn(
                  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted",
                  tab === "exact" && "bg-muted font-medium",
                )}
              >
                {t("dateExact")}
              </button>
              <button
                onClick={() => setTab("range")}
                className={cn(
                  "flex w-full items-center rounded-md px-2 py-1.5 text-left text-xs hover:bg-muted",
                  tab === "range" && "bg-muted font-medium",
                )}
              >
                {t("dateCustom")}
              </button>
            </div>

            {/* Right: pickers */}
            <div className="p-3">
              {tab === "exact" && (
                <div className="space-y-2">
                  <div className="text-xs font-medium">{t("dateExact")}</div>
                  <div className="flex items-center gap-1.5">
                    <Button
                      size="icon" variant="outline" className="h-8 w-8"
                      onClick={() => commitExact(subDays(f.exactDate, 1))}
                      aria-label="Prev day"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      value={exactInput}
                      onChange={(e) => setExactInput(e.target.value)}
                      onBlur={onExactInputBlur}
                      onKeyDown={(e) => { if (e.key === "Enter") onExactInputBlur(); }}
                      placeholder="YYYY-MM-DD"
                      className="h-8 flex-1 text-xs num"
                    />
                    <Button
                      size="icon" variant="outline" className="h-8 w-8"
                      onClick={() => commitExact(addDays(f.exactDate, 1))}
                      aria-label="Next day"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Calendar
                    mode="single"
                    selected={f.exactDate}
                    onSelect={(d) => d && commitExact(d)}
                    className="rounded-md border pointer-events-auto"
                    initialFocus
                  />
                  <div className="flex justify-end">
                    <Button size="sm" className="h-8" onClick={() => setOpen(false)}>{t("apply")}</Button>
                  </div>
                </div>
              )}

              {tab === "range" && (
                <div className="space-y-2">
                  <div className="text-xs font-medium">{t("dateCustom")}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {format(f.rangeFrom, "dd MMM yyyy")} – {format(f.rangeTo, "dd MMM yyyy")}
                  </div>
                  <Calendar
                    mode="range"
                    selected={{ from: f.rangeFrom, to: f.rangeTo }}
                    onSelect={(r) => {
                      if (r?.from && r?.to) f.setRange(r.from, r.to);
                      else if (r?.from) f.setRange(r.from, r.from);
                    }}
                    numberOfMonths={2}
                    className="rounded-md border pointer-events-auto"
                    initialFocus
                  />
                  <div className="flex justify-end">
                    <Button size="sm" className="h-8" onClick={() => { f.setMode("range"); setOpen(false); }}>
                      {t("apply")}
                    </Button>
                  </div>
                </div>
              )}

              {tab === "preset" && (
                <div className="flex h-full items-center justify-center p-8 text-center text-xs text-muted-foreground">
                  {t("pickPresetHint")}
                </div>
              )}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      {f.mode === "exact" && (
        <Button
          size="icon"
          variant="outline"
          className="h-8 w-8"
          onClick={() => f.setExactDate(addDays(f.exactDate, 1))}
          aria-label="Next day"
        >
          <ChevronRight className="h-3.5 w-3.5" />
        </Button>
      )}
    </div>
  );
}
