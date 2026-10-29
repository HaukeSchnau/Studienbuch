import { describe, expect, it } from "@effect/vitest";
import { CivilTime } from "@stu/core";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import { Schools } from "./Schools.ts";

const date = Schema.decodeEffect(CivilTime.PlainDate);

describe("Schools.yearAround", () => {
  it.effect.each([
    { day: "2026-08-01", year: "2026", term: "2026-1" },
    { day: "2027-01-31", year: "2026", term: "2026-1" },
    { day: "2027-02-01", year: "2026", term: "2026-2" },
    { day: "2027-07-31", year: "2026", term: "2026-2" },
  ])("puts $day in $term of $year", ({ day, year, term }) =>
    Effect.gen(function* () {
      const around = yield* Schools.yearAround(yield* date(day));

      expect([around.id, around.current.id]).toEqual([year, term]);
    }),
  );
});
