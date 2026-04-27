// Number formatting helpers — keep numbers tight and readable in tables/KPIs.

export const fmtNum = (n: number) => new Intl.NumberFormat("en-US").format(Math.round(n));

export const fmtCompact = (n: number) =>
  new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);

export const fmtCurrency = (n: number, opts?: { compact?: boolean }) => {
  if (opts?.compact) {
    return "$" + new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 }).format(n);
  }
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
};

export const fmtPercent = (n: number, digits = 1) => `${n.toFixed(digits)}%`;

export const fmtKpi = (value: number, unit?: "currency" | "number" | "percent", hint?: string) => {
  if (unit === "currency") return fmtCurrency(value, { compact: value >= 10000 });
  if (unit === "percent") return fmtPercent(value);
  if (hint === "x") return value.toFixed(2) + "x";
  return fmtCompact(value);
};

export const fmtDelta = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(1)}%`;
