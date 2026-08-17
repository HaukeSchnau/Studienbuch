import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";
import * as PlainDate from "temporal-polyfill/fns/PlainDate";
import { PlainDateSchema } from "./plain-date";

describe("PlainDateSchema", () => {
  it.effect("decodes only canonical, valid ISO dates", () =>
    Effect.gen(function* () {
      const date = yield* Schema.decodeEffect(PlainDateSchema)("2028-02-29");
      assert.strictEqual(PlainDate.toString(date), "2028-02-29");

      for (const invalid of ["2026-02-29", "26-08-15", "+002026-08-15"]) {
        yield* Schema.decodeEffect(PlainDateSchema)(invalid).pipe(Effect.flip);
      }
    }),
  );

  it.effect("round-trips canonical wire values", () =>
    Effect.gen(function* () {
      const date = yield* Schema.decodeEffect(PlainDateSchema)("2026-08-15");
      assert.strictEqual(yield* Schema.encodeEffect(PlainDateSchema)(date), "2026-08-15");
    }),
  );

  it.effect("uses PlainDate directly for civil-time arithmetic", () =>
    Effect.gen(function* () {
      const beforeSpringTransition = yield* Schema.decodeEffect(PlainDateSchema)("2026-03-28");
      const beforeAutumnTransition = yield* Schema.decodeEffect(PlainDateSchema)("2026-10-24");
      const newYear = yield* Schema.decodeEffect(PlainDateSchema)("2021-01-01");

      assert.strictEqual(
        PlainDate.toString(PlainDate.addDays(beforeSpringTransition, 2)),
        "2026-03-30",
      );
      assert.strictEqual(
        PlainDate.toString(PlainDate.addDays(beforeAutumnTransition, 2)),
        "2026-10-26",
      );
      assert.strictEqual(
        PlainDate.diffDays(beforeSpringTransition, PlainDate.addDays(beforeSpringTransition, 2)),
        2,
      );
      assert.strictEqual(PlainDate.dayOfWeek(newYear), 5);
      assert.strictEqual(PlainDate.weekOfYear(newYear), 53);
      assert.strictEqual(PlainDate.yearOfWeek(newYear), 2020);
    }),
  );
});
