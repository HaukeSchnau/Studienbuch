import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import { CivilTime } from "./CivilTime.ts";

const decode = Schema.decodeUnknownEffect(CivilTime.PlainDate);

const encode = Schema.encodeEffect(CivilTime.PlainDate);

const isTimeZone = Schema.is(CivilTime.TimeZone);

describe("CivilTime.PlainDate", () => {
  it.effect("reads and writes a date as YYYY-MM-DD", () =>
    Effect.gen(function* () {
      expect(yield* encode(yield* decode("2028-02-29"))).toBe("2028-02-29");
    }),
  );

  it.effect.each([
    { name: "a day that doesn't exist", text: "2026-02-29" },
    { name: "a date with a time", text: "2026-10-29T10:00" },
    { name: "a calendar annotation", text: "2026-10-29[u-ca=gregory]" },
    { name: "a six-digit year", text: "+012026-10-29" },
    { name: "a month without its zero", text: "2026-1-05" },
  ])("refuses $name", ({ text }) =>
    Effect.gen(function* () {
      expect(Exit.isFailure(yield* Effect.exit(decode(text)))).toBe(true);
    }),
  );
});

describe("CivilTime.isoWeek", () => {
  it.effect.each([
    { date: "2026-11-09", week: "2026-W46", day: 1 },
    { date: "2026-12-31", week: "2026-W53", day: 4 },
    { date: "2027-01-01", week: "2026-W53", day: 5 },
    { date: "2027-01-04", week: "2027-W01", day: 1 },
  ])("puts $date in $week", ({ date, week, day }) =>
    Effect.gen(function* () {
      const plain = yield* decode(date);

      expect([CivilTime.isoWeek(plain), CivilTime.dayOfWeek(plain)]).toEqual([week, day]);
    }),
  );
});

describe("CivilTime.IsoWeek", () => {
  const isIsoWeek = Schema.is(CivilTime.IsoWeek);

  it.each([
    { week: "2026-W53", valid: true },
    { week: "2027-W01", valid: true },
    { week: "2025-W52", valid: true },
    { week: "2025-W53", valid: false },
    { week: "2026-W00", valid: false },
    { week: "2026-W54", valid: false },
    { week: "2026-W5", valid: false },
  ])("takes $week only if its year has it: $valid", ({ week, valid }) => {
    expect(isIsoWeek(week)).toBe(valid);
  });

  it.each([
    { week: "2026-W47", monday: "2026-11-16" },
    { week: "2026-W53", monday: "2026-12-28" },
    { week: "2027-W01", monday: "2027-01-04" },
    { week: "2025-W53", monday: "none" },
  ])("starts $week on $monday", ({ week, monday }) => {
    expect(
      Option.match(CivilTime.mondayOf(week), { onNone: () => "none", onSome: CivilTime.format }),
    ).toBe(monday);
  });
});

describe("CivilTime.dateIn", () => {
  const berlin = CivilTime.TimeZone.make("Europe/Berlin");
  const utc = CivilTime.TimeZone.make("UTC");

  it.effect.each([
    { at: "2026-10-28T23:30Z", epochMillis: 1_793_230_200_000, zone: berlin, date: "2026-10-29" },
    { at: "2026-10-28T23:30Z", epochMillis: 1_793_230_200_000, zone: utc, date: "2026-10-28" },
    { at: "2026-10-28T22:30Z", epochMillis: 1_793_226_600_000, zone: berlin, date: "2026-10-28" },
  ])("puts $at on $date in $zone", ({ epochMillis, zone, date }) =>
    Effect.gen(function* () {
      expect(yield* encode(CivilTime.dateIn(epochMillis, zone))).toBe(date);
    }),
  );

  it("accepts only time zones that exist", () => {
    expect([isTimeZone("Europe/Berlin"), isTimeZone("Mars/Olympus"), isTimeZone("")]).toEqual([
      true,
      false,
      false,
    ]);
  });
});

describe("CivilTime.Instant", () => {
  const decodeInstant = Schema.decodeUnknownEffect(CivilTime.Instant);
  const encodeInstant = Schema.encodeEffect(CivilTime.Instant);

  it.effect("reads and writes an instant in UTC with milliseconds", () =>
    Effect.gen(function* () {
      const text = "2026-11-18T06:30:00.000Z";

      expect(yield* encodeInstant(yield* decodeInstant(text))).toBe(text);
    }),
  );

  // A stored instant has one spelling, so the same instant compares equal as text.
  it.effect.each([
    { name: "an offset", text: "2026-11-18T07:30:00.000+01:00" },
    { name: "no milliseconds", text: "2026-11-18T06:30:00Z" },
    { name: "a date only", text: "2026-11-18" },
    { name: "a time that doesn't exist", text: "2026-11-18T25:30:00.000Z" },
    { name: "a day that doesn't exist", text: "2026-02-30T06:30:00.000Z" },
  ])("refuses $name", ({ text }) =>
    Effect.gen(function* () {
      expect(Exit.isFailure(yield* Effect.exit(decodeInstant(text)))).toBe(true);
    }),
  );
});
