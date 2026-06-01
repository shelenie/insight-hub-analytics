import { describe, expect, it } from "vitest";
import { formatOperationalTimestamp } from "@/lib/timezonePreference";

describe("formatOperationalTimestamp", () => {
  it("formats UTC timestamps without seconds or raw ISO output", () => {
    expect(formatOperationalTimestamp("2026-06-01T10:52:31.123Z", "utc")).toBe("01.06.2026 10:52 UTC");
  });

  it("formats local timestamps with the supplied browser timezone name", () => {
    expect(formatOperationalTimestamp("2026-06-01T10:52:00.000Z", "local", "Europe/Kyiv")).toBe(
      "01.06.2026 13:52 Europe/Kyiv",
    );
  });
});
