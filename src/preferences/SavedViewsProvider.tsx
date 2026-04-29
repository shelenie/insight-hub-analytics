import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { DateMode, DatePresetId } from "@/filters/DateContext";

export interface SavedView {
  id: string;
  name: string;
  /** ISO route this view is meant for, e.g. "/funnel". null = global */
  scope: string | null;
  date: {
    mode: DateMode;
    preset?: DatePresetId;
    exactDate?: string; // ISO
    rangeFrom?: string; // ISO
    rangeTo?: string;   // ISO
  };
  filters?: {
    project?: string;
    reportGroup?: string;
  };
  viewMode?: "summary" | "daily";
  createdAt: string;
}

const STORAGE_KEY = "pulse.savedViews.v1";

interface SavedViewsContextValue {
  views: SavedView[];
  saveView: (v: Omit<SavedView, "id" | "createdAt">) => SavedView;
  removeView: (id: string) => void;
  renameView: (id: string, name: string) => void;
}

const SavedViewsContext = createContext<SavedViewsContextValue | undefined>(undefined);

function load(): SavedView[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SavedView[]) : [];
  } catch {
    return [];
  }
}

export function SavedViewsProvider({ children }: { children: ReactNode }) {
  const [views, setViews] = useState<SavedView[]>(() => load());

  useEffect(() => {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(views));
    } catch {
      /* ignore */
    }
  }, [views]);

  const saveView = useCallback((v: Omit<SavedView, "id" | "createdAt">) => {
    const view: SavedView = {
      ...v,
      id: `sv_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
    };
    setViews((prev) => [view, ...prev]);
    return view;
  }, []);

  const removeView = useCallback((id: string) => {
    setViews((prev) => prev.filter((v) => v.id !== id));
  }, []);

  const renameView = useCallback((id: string, name: string) => {
    setViews((prev) => prev.map((v) => (v.id === id ? { ...v, name } : v)));
  }, []);

  const value = useMemo(
    () => ({ views, saveView, removeView, renameView }),
    [views, saveView, removeView, renameView],
  );

  return <SavedViewsContext.Provider value={value}>{children}</SavedViewsContext.Provider>;
}

export function useSavedViews() {
  const ctx = useContext(SavedViewsContext);
  if (!ctx) throw new Error("useSavedViews must be used inside SavedViewsProvider");
  return ctx;
}
