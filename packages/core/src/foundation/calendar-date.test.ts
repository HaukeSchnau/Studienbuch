import * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { describe, expect, it } from "vite-plus/test";
import * as CalendarDate from "./calendar-date";

describe("CalendarDate", () => {
  it("parses valid dates and rejects impossible or non-canonical input", () => {
    expect(Option.isSome(CalendarDate.fromString("2028-02-29"))).toBe(true);
    expect(Option.isNone(CalendarDate.fromString("2026-02-29"))).toBe(true);
    expect(Option.isNone(CalendarDate.fromString("26-08-15"))).toBe(true);
    expect(Option.isNone(CalendarDate.fromString("+002026-08-15"))).toBe(true);
  });

  it("constructs safely from parts", () => {
    expect(Option.map(CalendarDate.fromParts(2028, 2, 29), CalendarDate.toString)).toEqual(
      Option.some("2028-02-29"),
    );
    expect(Option.isNone(CalendarDate.fromParts(2027, 2, 29))).toBe(true);
    expect(Option.isNone(CalendarDate.fromParts(10_000, 1, 1))).toBe(true);
  });

  it("round-trips the exact ISO wire representation", () => {
    const decode = Schema.decodeSync(CalendarDate.Schema);
    const encode = Schema.encodeSync(CalendarDate.Schema);
    const date = decode("2026-08-15");

    expect(CalendarDate.toString(date)).toBe("2026-08-15");
    expect(encode(date)).toBe("2026-08-15");
  });

  it("keeps generic Temporal records outside the branded domain type", () => {
    const genericPlainDate = PlainDate.fromString("2026-08-15", Calendar.getBasic);
    const acceptsCalendarDate = (_date: CalendarDate.Type) => undefined;

    // @ts-expect-error A generic Temporal record has not crossed the CalendarDate boundary.
    acceptsCalendarDate(genericPlainDate);
  });

  it("performs calendar arithmetic independently of daylight-saving transitions", () => {
    const beforeSpringTransition = CalendarDate.unsafeFromString("2026-03-28");
    const beforeAutumnTransition = CalendarDate.unsafeFromString("2026-10-24");

    expect(CalendarDate.toString(CalendarDate.unsafeAddDays(beforeSpringTransition, 2))).toBe(
      "2026-03-30",
    );
    expect(CalendarDate.toString(CalendarDate.unsafeAddDays(beforeAutumnTransition, 2))).toBe(
      "2026-10-26",
    );
    expect(
      CalendarDate.daysUntil(
        CalendarDate.unsafeFromString("2026-03-28"),
        CalendarDate.unsafeFromString("2026-03-30"),
      ),
    ).toBe(2);
  });

  it("models invalid arithmetic explicitly", () => {
    const date = CalendarDate.unsafeFromString("2026-08-15");
    expect(CalendarDate.addDays(date, 0.5)).toEqual(Option.none());
    expect(CalendarDate.addDays(date, Number.POSITIVE_INFINITY)).toEqual(Option.none());
  });

  it("uses ISO weekdays and week-numbering years at year boundaries", () => {
    const newYear = CalendarDate.unsafeFromString("2021-01-01");
    expect(CalendarDate.dayOfWeek(newYear)).toBe(5);
    expect(CalendarDate.weekOfYear(newYear)).toBe(53);
    expect(CalendarDate.yearOfWeek(newYear)).toBe(2020);
  });

  it("provides chronological order and equivalence", () => {
    const first = CalendarDate.unsafeFromString("2026-08-15");
    const same = CalendarDate.unsafeFromParts(2026, 8, 15);
    const later = CalendarDate.unsafeFromString("2026-08-16");

    expect(CalendarDate.compare(first, later)).toBe(-1);
    expect(CalendarDate.Order(later, first)).toBe(1);
    expect(CalendarDate.Equivalence(first, same)).toBe(true);
  });
});
