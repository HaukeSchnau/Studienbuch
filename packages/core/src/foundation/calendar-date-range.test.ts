import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as Calendar from "temporal-polyfill/fns/Calendar";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { CalendarDateRange } from "./calendar-date-range";

const date = (value: string) => PlainDate.fromString(value, Calendar.getBasic);

describe("CalendarDateRange", () => {
  it("is closed and reports its inclusive length", () => {
    const range = CalendarDateRange.Schema.make({
      start: date("2026-08-15"),
      end: date("2026-08-17"),
    });

    assert.isTrue(CalendarDateRange.contains(range, date("2026-08-15")));
    assert.isTrue(CalendarDateRange.contains(range, date("2026-08-17")));
    assert.strictEqual(CalendarDateRange.lengthInDays(range), 3);
  });

  it.effect("rejects reversed ranges at the decode boundary", () =>
    Effect.flip(
      Schema.decodeEffect(CalendarDateRange.Schema)({
        start: "2026-08-17",
        end: "2026-08-15",
      }),
    ),
  );

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

    assert.isTrue(CalendarDateRange.encloses(outer, inner));
    assert.isTrue(CalendarDateRange.overlaps(inner, adjacentAtEndpoint));
  });

  it.effect("round-trips nested dates as ISO strings", () =>
    Effect.gen(function* () {
      const encoded = { start: "2026-08-15", end: "2026-08-17" };
      const decoded = yield* Schema.decodeEffect(CalendarDateRange.Schema)(encoded);
      assert.deepStrictEqual(
        yield* Schema.encodeEffect(CalendarDateRange.Schema)(decoded),
        encoded,
      );
    }),
  );
});
