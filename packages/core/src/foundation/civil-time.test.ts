import { describe, expect, it } from "vite-plus/test";
import * as Schema from "effect/Schema";
import {
  CalendarDate,
  DateInterval,
  LocalTime,
  TimeRange,
  addCalendarDays,
  containsDate,
  isoWeek,
  timeRangesOverlap,
  weekdayOf,
} from "./index.ts";

describe("CalendarDate", () => {
  it("rejects impossible dates and supports leap days", () => {
    expect(Schema.is(CalendarDate)("2026-02-29")).toBe(false);
    expect(Schema.is(CalendarDate)("2028-02-29")).toBe(true);
  });

  it("performs timezone-free calendar arithmetic", () => {
    const date = CalendarDate.make("2026-12-31");
    expect(addCalendarDays(date, 1)).toBe("2027-01-01");
    expect(weekdayOf(CalendarDate.make("2026-08-14"))).toBe(5);
    expect(isoWeek(CalendarDate.make("2021-01-01"))).toBe(53);
  });
});

describe("interval semantics", () => {
  it("uses closed date intervals", () => {
    const interval = DateInterval.make({
      start: CalendarDate.make("2026-08-01"),
      end: CalendarDate.make("2026-08-14"),
    });
    expect(containsDate(interval, CalendarDate.make("2026-08-14"))).toBe(true);
  });

  it("uses half-open time ranges so adjacent lessons do not overlap", () => {
    const first = TimeRange.make({
      start: LocalTime.make(8 * 60),
      end: LocalTime.make(8 * 60 + 45),
    });
    const second = TimeRange.make({
      start: LocalTime.make(8 * 60 + 45),
      end: LocalTime.make(9 * 60 + 30),
    });
    expect(timeRangesOverlap(first, second)).toBe(false);
  });
});
