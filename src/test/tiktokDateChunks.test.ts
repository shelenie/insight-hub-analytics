import { describe, expect, it } from "vitest";
import { createDateChunks } from "../../supabase/functions/tiktok-ads-sync/dateChunks";

describe("createDateChunks", () => {
  it("keeps a 30-day range as one chunk", () => {
    expect(createDateChunks("2026-01-01", "2026-01-30", 30)).toEqual([
      { dateFrom: "2026-01-01", dateTo: "2026-01-30" },
    ]);
  });

  it("splits a 365-day historical range into max-30-day chunks", () => {
    const chunks = createDateChunks("2025-01-01", "2025-12-31", 30);

    expect(chunks).toHaveLength(13);
    expect(chunks[0]).toEqual({
      dateFrom: "2025-01-01",
      dateTo: "2025-01-30",
    });
    expect(chunks.at(-1)).toEqual({
      dateFrom: "2025-12-27",
      dateTo: "2025-12-31",
    });

    for (const chunk of chunks) {
      const start = Date.parse(`${chunk.dateFrom}T00:00:00.000Z`);
      const end = Date.parse(`${chunk.dateTo}T00:00:00.000Z`);
      const inclusiveDays = (end - start) / (24 * 60 * 60 * 1000) + 1;
      expect(inclusiveDays).toBeLessThanOrEqual(30);
    }
  });
});
