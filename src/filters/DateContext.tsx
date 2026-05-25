import { createContext, useContext, useMemo, useState, ReactNode } from "react";
import { addDays, format, startOfMonth, startOfQuarter, startOfYear, subDays } from "date-fns";
import { uk } from "date-fns/locale";

export type DatePresetId =
  | "today" | "yesterday" | "7d" | "30d" | "mtd" | "qtd" | "ytd";

export type DateMode = "preset" | "exact" | "range";

export interface DateContextValue {
  mode: DateMode;
  preset: DatePresetId;
  exactDate: Date;
  rangeFrom: Date;
  rangeTo: Date;
  setPreset: (id: DatePresetId) => void;
  setExactDate: (d: Date) => void;
  setRange: (from: Date, to: Date) => void;
  setMode: (m: DateMode) => void;
  /** Resolved [from, to] regardless of mode */
  resolved: { from: Date; to: Date };
  /** Short label for the active selection, used under KPI values */
  activeLabel: string;
  /** Sub-label like "Дані за 27 квіт." or "Останні 7 днів" */
  contextLabel: (lang: "uk" | "en") => string;
}

const DateContext = createContext<DateContextValue | undefined>(undefined);

function resolvePreset(id: DatePresetId, today = new Date()): { from: Date; to: Date } {
  switch (id) {
    case "today":     return { from: today, to: today };
    case "yesterday": { const d = subDays(today, 1); return { from: d, to: d }; }
    case "7d":        return { from: subDays(today, 6), to: today };
    case "30d":       return { from: subDays(today, 29), to: today };
    case "mtd":       return { from: startOfMonth(today), to: today };
    case "qtd":       return { from: startOfQuarter(today), to: today };
    case "ytd":       return { from: startOfYear(today), to: today };
  }
}

export function DateFilterProvider({ children }: { children: ReactNode }) {
  const today = useMemo(() => {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d;
  }, []);
  const [mode, setMode] = useState<DateMode>("preset");
  const [preset, setPreset] = useState<DatePresetId>("30d");
  const [exactDate, setExactDate] = useState<Date>(today);
  const [rangeFrom, setRangeFrom] = useState<Date>(subDays(today, 13));
  const [rangeTo, setRangeTo] = useState<Date>(today);

  const resolved = useMemo(() => {
    if (mode === "exact") return { from: exactDate, to: exactDate };
    if (mode === "range") return { from: rangeFrom, to: rangeTo };
    return resolvePreset(preset, today);
  }, [mode, preset, exactDate, rangeFrom, rangeTo, today]);

  const activeLabel = useMemo(() => {
    if (mode === "exact") return format(exactDate, "d MMMM yyyy", { locale: uk });
    if (mode === "range") return `${format(rangeFrom, "d MMMM yyyy", { locale: uk })} — ${format(rangeTo, "d MMMM yyyy", { locale: uk })}`;
    return preset;
  }, [mode, exactDate, rangeFrom, rangeTo, preset]);

  const contextLabel = (lang: "uk" | "en") => {
    const presetLabels: Record<DatePresetId, { uk: string; en: string }> = {
      today:     { uk: "Сьогодні", en: "Today" },
      yesterday: { uk: "Вчора", en: "Yesterday" },
      "7d":      { uk: "Останні 7 днів", en: "Last 7 days" },
      "30d":     { uk: "Останні 30 днів", en: "Last 30 days" },
      mtd:       { uk: "З початку місяця", en: "Month to date" },
      qtd:       { uk: "З початку кварталу", en: "Quarter to date" },
      ytd:       { uk: "З початку року", en: "Year to date" },
    };
    if (mode === "exact") {
      return lang === "uk"
        ? `Дані за ${format(exactDate, "d MMMM yyyy", { locale: uk })}`
        : `Data for ${format(exactDate, "d MMMM yyyy", { locale: uk })}`;
    }
    if (mode === "range") {
      return lang === "uk"
        ? `Період: ${format(rangeFrom, "d MMMM yyyy", { locale: uk })} — ${format(rangeTo, "d MMMM yyyy", { locale: uk })}`
        : `Range: ${format(rangeFrom, "d MMMM yyyy", { locale: uk })} — ${format(rangeTo, "d MMMM yyyy", { locale: uk })}`;
    }
    return presetLabels[preset][lang];
  };

  function setRange(from: Date, to: Date) {
    setRangeFrom(from);
    setRangeTo(to);
  }

  function setPresetWrapper(id: DatePresetId) {
    setPreset(id);
    setMode("preset");
  }

  function setExactDateWrapper(d: Date) {
    setExactDate(d);
    setMode("exact");
  }

  return (
    <DateContext.Provider
      value={{
        mode, preset, exactDate, rangeFrom, rangeTo,
        setPreset: setPresetWrapper,
        setExactDate: setExactDateWrapper,
        setRange,
        setMode,
        resolved,
        activeLabel,
        contextLabel,
      }}
    >
      {children}
    </DateContext.Provider>
  );
}

export function useDateFilter() {
  const ctx = useContext(DateContext);
  if (!ctx) throw new Error("useDateFilter must be used inside DateFilterProvider");
  return ctx;
}

/** Pretty label for a range (helper for badges) */
export function formatRange(from: Date, to: Date) {
  return `${format(from, "d MMMM yyyy", { locale: uk })} — ${format(to, "d MMMM yyyy", { locale: uk })}`;
}
