// Number formatting helpers — keep numbers tight and readable in tables/KPIs.
//
// Convention across the app:
//   - Values < 10,000 → full thousands separator (e.g. "1,250", "$8,400")
//   - Values ≥ 10,000 → compact SaaS format    (e.g. "14.8K", "$512.8K", "2.8M")
//
// This is applied uniformly so the same metric looks the same in KPI cards,
// tables and charts. Avoid ad-hoc `toLocaleString()` calls in components.

const COMPACT_THRESHOLD = 10_000;

const compactFmt = new Intl.NumberFormat("en-US", {
  notation: "compact",
  maximumFractionDigits: 1,
});

const fullFmt = new Intl.NumberFormat("en-US");

/** Replace lowercase compact suffixes with uppercase (k → K, m → M, b → B). */
const upperCompact = (s: string) => s.replace(/k$/i, "K").replace(/m$/i, "M").replace(/b$/i, "B");

export const fmtNum = (n: number) => {
  const v = Math.round(n);
  if (Math.abs(v) >= COMPACT_THRESHOLD) return upperCompact(compactFmt.format(v));
  return fullFmt.format(v);
};

export const fmtCompact = (n: number) => upperCompact(compactFmt.format(n));

export const fmtCurrency = (n: number, opts?: { compact?: boolean }) => {
  const useCompact = opts?.compact ?? Math.abs(n) >= COMPACT_THRESHOLD;
  if (useCompact) {
    return "$" + upperCompact(compactFmt.format(n));
  }
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(n);
};

export const fmtPercent = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

export const fmtKpi = (value: number, unit?: "currency" | "number" | "percent", hint?: string) => {
  if (unit === "currency") return fmtCurrency(value);
  if (unit === "percent") return fmtPercent(value);
  if (hint === "x") return value.toFixed(2) + "x";
  return fmtNum(value);
};

export const fmtDelta = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
