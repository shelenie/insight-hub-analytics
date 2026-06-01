import { describe, expect, it } from "vitest";
import { buildDateRangeChunks } from "../date-range-chunks";

describe("buildDateRangeChunks", () => {
  it("keeps a 30-day date range in one chunk", () => {
    expect(buildDateRangeChunks("2026-01-01", "2026-01-30")).toEqual([
      { dateFrom: "2026-01-01", dateTo: "2026-01-30" },
    ]);
  });

  it("splits longer ranges into inclusive chunks of at most 30 days", () => {
    expect(buildDateRangeChunks("2026-01-01", "2026-03-05")).toEqual([
      { dateFrom: "2026-01-01", dateTo: "2026-01-30" },
      { dateFrom: "2026-01-31", dateTo: "2026-03-01" },
      { dateFrom: "2026-03-02", dateTo: "2026-03-05" },
    ]);
  });

  it("splits a 365-day lookback into 13 chunks", () => {
    const chunks = buildDateRangeChunks("2025-01-01", "2025-12-31");

    expect(chunks).toHaveLength(13);
    expect(chunks[0]).toEqual({ dateFrom: "2025-01-01", dateTo: "2025-01-30" });
    expect(chunks.at(-1)).toEqual({ dateFrom: "2025-12-27", dateTo: "2025-12-31" });
  });

  it("rejects an inverted date range", () => {
    expect(() => buildDateRangeChunks("2026-01-31", "2026-01-01")).toThrow(
      "date_from must be on or before date_to.",
    );
  });
});
