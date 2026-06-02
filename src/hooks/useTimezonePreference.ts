import { useCallback, useEffect, useState } from "react";
import { useAuth } from "@/auth/AuthProvider";
import { toast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import {
  DEFAULT_TIMEZONE_DISPLAY_MODE,
  isTimezoneDisplayMode,
  resolveBrowserTimeZone,
  type TimezoneDisplayMode,
} from "@/lib/timezonePreference";

type UserPreferenceRow = {
  timezone_display_mode: string;
  timezone_name: string | null;
};

export function useTimezonePreference() {
  const { user } = useAuth();
  const [timezoneDisplayMode, setTimezoneDisplayModeState] = useState<TimezoneDisplayMode>(DEFAULT_TIMEZONE_DISPLAY_MODE);
  const [timezoneName, setTimezoneName] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function loadPreference() {
      if (!user) {
        setTimezoneDisplayModeState(DEFAULT_TIMEZONE_DISPLAY_MODE);
        setTimezoneName(null);
        setError(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);
      setError(null);

      const { data, error: loadError } = await supabase
        .from("user_preferences")
        .select("timezone_display_mode, timezone_name")
        .eq("user_id", user.id)
        .maybeSingle();

      if (cancelled) return;

      if (loadError) {
        setTimezoneDisplayModeState(DEFAULT_TIMEZONE_DISPLAY_MODE);
        setTimezoneName(null);
        setError(loadError.message);
        setIsLoading(false);
        return;
      }

      const preference = data as UserPreferenceRow | null;
      setTimezoneDisplayModeState(
        isTimezoneDisplayMode(preference?.timezone_display_mode)
          ? preference.timezone_display_mode
          : DEFAULT_TIMEZONE_DISPLAY_MODE,
      );
      setTimezoneName(preference?.timezone_name ?? null);
      setIsLoading(false);
    }

    void loadPreference();

    return () => {
      cancelled = true;
    };
  }, [user]);

  const setTimezoneDisplayMode = useCallback(
    async (mode: TimezoneDisplayMode) => {
      const nextTimezoneName = mode === "local" ? resolveBrowserTimeZone() : null;
      setTimezoneDisplayModeState(mode);
      setTimezoneName(nextTimezoneName);
      setError(null);

      if (!user) return;

      const { error: saveError } = await supabase.from("user_preferences").upsert(
        {
          user_id: user.id,
          timezone_display_mode: mode,
          timezone_name: nextTimezoneName,
        },
        { onConflict: "user_id" },
      );

      if (saveError) {
        setError(saveError.message);
        toast({
          title: "Налаштування часу не збережено",
          description: "Час показано тимчасово для цієї сторінки. Після перезавантаження може знову використовуватись UTC.",
        });
      }
    },
    [user],
  );

  return {
    timezoneDisplayMode,
    timezoneName,
    setTimezoneDisplayMode,
    isLoading,
    error,
  };
}
