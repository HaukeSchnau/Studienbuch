import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
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
