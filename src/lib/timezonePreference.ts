export type TimezoneDisplayMode = "utc" | "local";

export const DEFAULT_TIMEZONE_DISPLAY_MODE: TimezoneDisplayMode = "utc";
export const FALLBACK_TIMEZONE_NAME = "Local";

export function isTimezoneDisplayMode(value: unknown): value is TimezoneDisplayMode {
  return value === "utc" || value === "local";
}

export function resolveBrowserTimeZone(): string {
  return Intl.DateTimeFormat().resolvedOptions().timeZone || FALLBACK_TIMEZONE_NAME;
}

export function formatOperationalTimestamp(
  value: unknown,
  mode: TimezoneDisplayMode = DEFAULT_TIMEZONE_DISPLAY_MODE,
  timezoneName = resolveBrowserTimeZone(),
): string {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value !== "string" && typeof value !== "number") return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  if (mode === "local") {
    const displayTimeZone = timezoneName || FALLBACK_TIMEZONE_NAME;
    const formatterTimeZone = displayTimeZone === FALLBACK_TIMEZONE_NAME ? undefined : displayTimeZone;
    return `${formatDateTimeInZone(date, formatterTimeZone)} ${displayTimeZone}`;
  }

  return `${formatDateTimeInZone(date, "UTC")} UTC`;
}

function formatDateTimeInZone(date: Date, timeZone?: string): string {
  return new Intl.DateTimeFormat("uk-UA", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone,
  })
    .format(date)
    .replace(",", "");
}
