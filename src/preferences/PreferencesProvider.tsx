import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";

export type LandingPage = "/" | "/conversions" | "/campaigns" | "/sales" | "/imports" | "/assistant";
export type DefaultDateMode = "preset" | "exact" | "range";
export type DefaultViewMode = "summary" | "daily";
export type TableDensity = "comfortable" | "compact";
export type CurrencyFormat = "USD" | "EUR" | "UAH";
export type CompareMode = "none" | "yesterday" | "previous_period";
export type CompareDisplay = "percent" | "absolute";

export interface Preferences {
  defaultLanding: LandingPage;
  defaultDateMode: DefaultDateMode;
  defaultViewMode: DefaultViewMode;
  tableDensity: TableDensity;
  currency: CurrencyFormat;
  showAiSummary: boolean;
  compareMode: CompareMode;
  compareDisplay: CompareDisplay;
}

const DEFAULTS: Preferences = {
  defaultLanding: "/",
  defaultDateMode: "preset",
  defaultViewMode: "summary",
  tableDensity: "comfortable",
  currency: "USD",
  showAiSummary: true,
  compareMode: "none",
  compareDisplay: "percent",
};

const STORAGE_KEY = "pulse.preferences.v1";

interface PreferencesContextValue extends Preferences {
  setPref: <K extends keyof Preferences>(key: K, value: Preferences[K]) => void;
  reset: () => void;
}

const PreferencesContext = createContext<PreferencesContextValue | undefined>(undefined);

function loadPrefs(): Preferences {
  if (typeof window === "undefined") return DEFAULTS;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw) as Partial<Preferences>;
    return { ...DEFAULTS, ...parsed, compareMode: "none" };
  } catch {
    return DEFAULTS;
  }
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [prefs, setPrefs] = useState<Preferences>(() => loadPrefs());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(prefs));
    } catch {
      /* ignore */
    }
  }, [prefs]);

  const setPref = useCallback(<K extends keyof Preferences>(key: K, value: Preferences[K]) => {
    setPrefs((p) => ({ ...p, [key]: value }));
  }, []);

  const reset = useCallback(() => setPrefs(DEFAULTS), []);

  const value = useMemo<PreferencesContextValue>(
    () => ({ ...prefs, setPref, reset }),
    [prefs, setPref, reset],
  );

  return <PreferencesContext.Provider value={value}>{children}</PreferencesContext.Provider>;
}

export function usePreferences() {
  const ctx = useContext(PreferencesContext);
  if (!ctx) throw new Error("usePreferences must be used inside PreferencesProvider");
  return ctx;
}

/** Currency formatter that respects the user's currency preference. */
export function useCurrencyFormatter() {
  const { currency } = usePreferences();
  return useCallback(
    (n: number, opts?: { compact?: boolean }) => {
      const symbolMap: Record<CurrencyFormat, string> = { USD: "$", EUR: "€", UAH: "₴" };
      if (opts?.compact) {
        return (
          symbolMap[currency] +
          new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n)
        );
      }
      return new Intl.NumberFormat("en-US", {
        style: "currency",
        currency,
        maximumFractionDigits: 0,
      }).format(n);
    },
    [currency],
  );
}
