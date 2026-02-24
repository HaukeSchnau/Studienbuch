import { describe, expect, test } from "vitest";
import { toHolidayWithSimpleDate } from "./holiday";

describe("toHolidayWithSimpleDate", () => {
  test("maps start and end dates to simple dates while preserving other fields", () => {
    const holiday = {
      name: "Sommerferien",
      year: 2025,
      state: "NI" as const,
      start: new Date(Date.UTC(2025, 6, 3)),
      end: new Date(Date.UTC(2025, 7, 13)),
    };

    const result = toHolidayWithSimpleDate(holiday);

    expect(result).toEqual({
      name: "Sommerferien",
      year: 2025,
      state: "NI",
      start: { year: 2025, month: 7, day: 3 },
      end: { year: 2025, month: 8, day: 13 },
    });
    expect(result).not.toBe(holiday);
  });
});
