import { useState } from "react";
import { addDays, format, parse, subDays, isValid } from "date-fns";
import { uk } from "date-fns/locale";
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

const presets: { id: DatePresetId; key: "dateToday" | "dateYesterday" | "date7d" | "date30d" | "dateMtd" | "dateQtd" | "dateYtd" | "dateAll" }[] = [
  { id: "today", key: "dateToday" },
  { id: "yesterday", key: "dateYesterday" },
  { id: "7d", key: "date7d" },
  { id: "30d", key: "date30d" },
  { id: "mtd", key: "dateMtd" },
  { id: "qtd", key: "dateQtd" },
  { id: "ytd", key: "dateYtd" },
  { id: "all", key: "dateAll" },
];

export function DateFilter() {
  const { t } = useI18n();
  const f = useDateFilter();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<"preset" | "exact" | "range">(f.mode);
  const [draftExactDate, setDraftExactDate] = useState<Date>(f.exactDate);
  const [draftExactInput, setDraftExactInput] = useState(format(f.exactDate, "dd.MM.yyyy"));
  const [draftRange, setDraftRange] = useState<{ from?: Date; to?: Date }>({ from: f.rangeFrom, to: f.rangeTo });
  const [exactMonth, setExactMonth] = useState<Date>(f.exactDate);
  const [rangeMonth, setRangeMonth] = useState<Date>(f.rangeFrom ?? f.rangeTo ?? f.exactDate);

  function onExactInputBlur() {
    const parsed = parse(draftExactInput, "dd.MM.yyyy", new Date());
    if (isValid(parsed)) {
      setDraftExactDate(parsed);
      setDraftExactInput(format(parsed, "dd.MM.yyyy"));
      setExactMonth(parsed);
    } else {
      setDraftExactInput(format(draftExactDate, "dd.MM.yyyy"));
    }
  }

  const triggerLabel =
    f.mode === "exact"
      ? format(f.exactDate, "d MMMM yyyy", { locale: uk })
      : f.mode === "range"
      ? `${format(f.rangeFrom, "d MMMM yyyy", { locale: uk })} — ${format(f.rangeTo, "d MMMM yyyy", { locale: uk })}`
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

      <Popover
        open={open}
        onOpenChange={(nextOpen) => {
          setOpen(nextOpen);
          if (nextOpen) {
            setTab(f.mode);
            setDraftExactDate(f.exactDate);
            setDraftExactInput(format(f.exactDate, "dd.MM.yyyy"));
            setDraftRange({ from: f.rangeFrom, to: f.rangeTo });
            setExactMonth(f.exactDate);
            setRangeMonth(f.rangeFrom ?? f.rangeTo ?? f.exactDate);
          }
        }}
      >
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
        <PopoverContent className="w-[min(92vw,460px)] overflow-hidden border bg-popover p-0 text-popover-foreground shadow-xl" align="start">
          <div className="grid grid-cols-[160px_1fr]">
            {/* Side: presets + modes */}
            <div className="border-r bg-muted/30 p-2">
              <div className="px-2 pb-1 pt-1 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">
                {t("quickPresets")}
              </div>
              {presets.map((p) => {
                const isAllDisabled = p.id === "all" && !f.dataBounds;
                return (
                  <button
                    key={p.id}
                    disabled={isAllDisabled}
                    onClick={() => { if (!isAllDisabled) { f.setPreset(p.id); setTab("preset"); setOpen(false); } }}
                    className={cn(
                      "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs transition-colors hover:bg-muted",
                      f.mode === "preset" && f.preset === p.id && "bg-primary-soft text-primary font-medium",
                      isAllDisabled && "cursor-not-allowed opacity-50 hover:bg-transparent",
                    )}
                  >
                    <span>{t(p.key)}</span>
                    {isAllDisabled ? <span className="text-[10px] text-muted-foreground">Немає даних</span> : f.mode === "preset" && f.preset === p.id ? <Check className="h-3 w-3" /> : null}
                  </button>
                );
              })}
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
                        setDraftExactInput(format(nextDate, "dd.MM.yyyy"));
                        setExactMonth(nextDate);
                      }}
                      aria-label="Prev day"
                    >
                      <ChevronLeft className="h-3.5 w-3.5" />
                    </Button>
                    <Input
                      value={draftExactInput}
                      onChange={(e) => setDraftExactInput(e.target.value)}
                      onBlur={onExactInputBlur}
                      onKeyDown={(e) => { if (e.key === "Enter") onExactInputBlur(); }}
                      placeholder="ДД.ММ.РРРР"
                      className="h-8 flex-1 text-xs num"
                    />
                    <Button
                      size="icon" variant="outline" className="h-8 w-8"
                      onClick={() => {
                        const nextDate = addDays(draftExactDate, 1);
                        setDraftExactDate(nextDate);
                        setDraftExactInput(format(nextDate, "dd.MM.yyyy"));
                        setExactMonth(nextDate);
                      }}
                      aria-label="Next day"
                    >
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                  <div className="flex justify-center">
                    <Calendar
                    mode="single"
                    selected={draftExactDate}
                    onSelect={(d) => {
                      if (!d) return;
                      setDraftExactDate(d);
                      setDraftExactInput(format(d, "dd.MM.yyyy"));
                      setExactMonth(d);
                    }}
                    month={exactMonth}
                    onMonthChange={setExactMonth}
                    className="rounded-md border bg-background pointer-events-auto"
                    initialFocus
                  />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" className="h-8" onClick={() => { f.setExactDate(draftExactDate); setOpen(false); }}>{t("apply")}</Button>
                  </div>
                </div>
              )}

              {tab === "range" && (
                <div className="space-y-2">
                  <div className="text-xs font-medium">{t("dateCustom")}</div>
                  <div className="text-[11px] text-muted-foreground">
                    {draftRange.from && draftRange.to
                      ? `${format(draftRange.from, "d MMMM yyyy", { locale: uk })} — ${format(draftRange.to, "d MMMM yyyy", { locale: uk })}`
                      : "Оберіть дату початку і дату завершення."}
                  </div>
                  <div className="flex justify-center">
                    <Calendar
                    mode="range"
                    selected={draftRange}
                    onSelect={(r) => {
                      if (r?.from) setRangeMonth(r.from);
                      setDraftRange(r ?? {});
                    }}
                    month={rangeMonth}
                    onMonthChange={setRangeMonth}
                    className="rounded-md border bg-background pointer-events-auto"
                    initialFocus
                  />
                  </div>
                  <div className="flex justify-end">
                    <Button size="sm" className="h-8" disabled={!draftRange.from || !draftRange.to} onClick={() => {
                        if (!draftRange.from || !draftRange.to) return;
                        f.setRange(draftRange.from, draftRange.to);
                        f.setMode("range");
                        setOpen(false);
                      }}>
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
