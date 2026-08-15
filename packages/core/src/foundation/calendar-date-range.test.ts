import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { describe, expect, it } from "vite-plus/test";
import * as CalendarDate from "./calendar-date";
import * as CalendarDateRange from "./calendar-date-range";

const date = CalendarDate.unsafeFromString;

describe("CalendarDateRange", () => {
  it("is closed and reports its inclusive length", () => {
    const range = CalendarDateRange.Schema.make({
      start: date("2026-08-15"),
      end: date("2026-08-17"),
    });

    expect(CalendarDateRange.contains(range, date("2026-08-15"))).toBe(true);
    expect(CalendarDateRange.contains(range, date("2026-08-17"))).toBe(true);
    expect(CalendarDateRange.lengthInDays(range)).toBe(3);
  });

  it("rejects reversed ranges", () => {
    expect(
      Option.isNone(
        CalendarDateRange.Schema.makeOption({
          start: date("2026-08-17"),
          end: date("2026-08-15"),
        }),
      ),
    ).toBe(true);
  });

  it("treats a shared endpoint as overlap and supports enclosure", () => {
    const outer = CalendarDateRange.Schema.make({
      start: date("2026-08-15"),
      end: date("2026-08-20"),
    });
    const inner = CalendarDateRange.Schema.make({
      start: date("2026-08-17"),
      end: date("2026-08-20"),
    });
    const adjacentAtEndpoint = CalendarDateRange.Schema.make({
      start: date("2026-08-20"),
      end: date("2026-08-22"),
    });

    expect(CalendarDateRange.encloses(outer, inner)).toBe(true);
    expect(CalendarDateRange.overlaps(inner, adjacentAtEndpoint)).toBe(true);
  });

  it("round-trips nested dates as ISO strings", () => {
    const encoded = { start: "2026-08-15", end: "2026-08-17" };
    const decoded = Schema.decodeSync(CalendarDateRange.Schema)(encoded);
    expect(Schema.encodeSync(CalendarDateRange.Schema)(decoded)).toEqual(encoded);
  });
});
