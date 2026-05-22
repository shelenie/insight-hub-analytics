import { useEffect, useState } from "react";
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
  const [draftExactDate, setDraftExactDate] = useState<Date>(f.exactDate);
  const [draftExactInput, setDraftExactInput] = useState(format(f.exactDate, "yyyy-MM-dd"));
  const [draftRange, setDraftRange] = useState<{ from?: Date; to?: Date }>({ from: f.rangeFrom, to: f.rangeTo });

  useEffect(() => {
    if (!open) return;
    setTab(f.mode);
    setDraftExactDate(f.exactDate);
    setDraftExactInput(format(f.exactDate, "yyyy-MM-dd"));
    setDraftRange({ from: f.rangeFrom, to: f.rangeTo });
  }, [open, f.mode, f.exactDate, f.rangeFrom, f.rangeTo]);


  function commitExact(d: Date) {
    f.setExactDate(d);
  }

  function onDraftExactInputBlur() {
    const parsed = parse(draftExactInput, "yyyy-MM-dd", new Date());
    if (isValid(parsed)) setDraftExactDate(parsed);
    else setDraftExactInput(format(draftExactDate, "yyyy-MM-dd"));
  }

  function applyExactDraft() {
    commitExact(draftExactDate);
    setDraftExactInput(format(draftExactDate, "yyyy-MM-dd"));
    setOpen(false);
  }

  function applyRangeDraft() {
    if (!draftRange.from || !draftRange.to) return;
    f.setRange(draftRange.from, draftRange.to);
    f.setMode("range");
    setOpen(false);
  }

  const triggerLabel =
    f.mode === "exact"
      ? format(f.exactDate, "dd.MM.yyyy")
      : f.mode === "range"
      ? `${format(f.rangeFrom, "dd.MM.yyyy")} — ${format(f.rangeTo, "dd.MM.yyyy")}`
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
                      onClick={() => {
                        const nextDate = subDays(draftExactDate, 1);
                        setDraftExactDate(nextDate);
                        setDraftExactInput(format(nextDate, "yyyy-MM-dd"));
                      }}
                      aria-label="Prev day"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      value={draftExactInput}
                      onChange={(e) => setDraftExactInput(e.target.value)}
                      onBlur={onDraftExactInputBlur}
                      onKeyDown={(e) => { if (e.key === "Enter") onDraftExactInputBlur(); }}
                      placeholder="YYYY-MM-DD"
                      className="h-8 flex-1 text-xs num"
                    />
                    <Button
                      size="icon" variant="outline" className="h-8 w-8"
                      onClick={() => {
                        const nextDate = addDays(draftExactDate, 1);
                        setDraftExactDate(nextDate);
                        setDraftExactInput(format(nextDate, "yyyy-MM-dd"));
                      }}
                      aria-label="Next day"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <Calendar
                    mode="single"

                    initialFocus
                  />
                  <div className="flex justify-end">
                    <Button size="sm" className="h-8" onClick={applyExactDraft}>{t("apply")}</Button>
                  </div>
                </div>
              )}

              {tab === "range" && (
                <div className="space-y-2">
                  <div className="text-xs font-medium">{t("dateCustom")}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {draftRange.from && draftRange.to
                      ? `${format(draftRange.from, "dd.MM.yyyy")} — ${format(draftRange.to, "dd.MM.yyyy")}`
                      : "Оберіть дату початку і дату завершення."}
                  </div>
                  <Calendar
                    mode="range"
                    selected={draftRange}
                    onSelect={(r) => setDraftRange(r ?? {})}
                    numberOfMonths={2}
                    className="rounded-md border pointer-events-auto"
                    initialFocus
                  />
                  <div className="flex justify-end">
                    <Button size="sm" className="h-8" onClick={applyRangeDraft} disabled={!draftRange.from || !draftRange.to}>
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
