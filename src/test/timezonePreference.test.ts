import { describe, expect, it } from "vitest";
import { formatOperationalTimestamp, getTimezoneDisplayLabel } from "@/lib/timezonePreference";

describe("formatOperationalTimestamp", () => {
  it("formats UTC timestamps without seconds, timezone suffix, or raw ISO output", () => {
    expect(formatOperationalTimestamp("2026-06-01T10:52:31.123Z", "utc")).toBe("01.06.2026 10:52");
  });

  it("formats local timestamps compactly with the supplied browser timezone", () => {
    expect(formatOperationalTimestamp("2026-06-01T10:52:00.000Z", "local", "Europe/Kyiv")).toBe(
      "01.06.2026 13:52",
    );
  });

  it("can include a timezone suffix only when explicitly requested", () => {
    expect(
      formatOperationalTimestamp("2026-06-01T10:52:00.000Z", "local", "Europe/Kyiv", {
        includeTimezoneLabel: true,
      }),
    ).toBe("01.06.2026 13:52 Europe/Kyiv");
  });
});

describe("getTimezoneDisplayLabel", () => {
  it("returns UTC for UTC mode", () => {
    expect(getTimezoneDisplayLabel("utc", "Europe/Kyiv")).toBe("UTC");
  });

  it("returns the selected timezone for local mode", () => {
    expect(getTimezoneDisplayLabel("local", "Europe/Kyiv")).toBe("Europe/Kyiv");
  });
});
