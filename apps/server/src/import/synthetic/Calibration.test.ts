import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Schema from "effect/Schema";
import { Calibrate } from "./Calibrate.ts";
import { Calibration } from "./Calibration.ts";
import calibrationJson from "./calibration.json" with { type: "json" };

type Json = Schema.Json;

const isList = Schema.is(Schema.Array(Schema.Json));
const isObject = Schema.is(Schema.Record(Schema.String, Schema.Json));
const isNumber = Schema.is(Schema.Finite);

/** Every leaf of a JSON value with the key it sits under, an array's elements under its key. */
const leaves = (value: Json, key = ""): ReadonlyArray<readonly [string, Json]> => {
  if (isList(value)) return value.flatMap((each) => leaves(each, key));

  if (isObject(value)) return Object.entries(value).flatMap(([inner, each]) => leaves(each, inner));

  return [[key, value]];
};

const committed: Json = calibrationJson;

const decode = (value: Json) => Calibration.decode(JSON.stringify(value));

describe("Calibration", () => {
  // The file is public and outlives corpus v1 (D112): numbers only, so no token, name or code can
  // sit in it, and no count of fewer than five people.
  it("holds numbers only, and no count of fewer than five people", () => {
    const all = leaves(committed);

    assert.deepStrictEqual(
      all.filter(([, value]) => !isNumber(value)),
      [],
    );

    assert.deepStrictEqual(
      all.filter(([key, value]) => key === "people" && value !== 0 && Number(value) < 5),
      [],
    );

    assert.isAbove(all.filter(([key]) => key === "people").length, 50);
  });

  it.effect("decodes as committed, and refuses a small count, a string or an extra field", () =>
    Effect.gen(function* () {
      assert.isTrue(Exit.isSuccess(yield* Effect.exit(decode(committed))));

      const changed = (edit: (file: Record<string, Json>) => void) => {
        const file = structuredClone(calibrationJson) as Record<string, Json>;

        edit(file);

        return Effect.exit(decode(file));
      };

      const refused = [
        yield* changed((file) => {
          file["teachers"] = { people: 3, perCourse: [] };
        }),
        yield* changed((file) => {
          file["rooms"] = { count: "R101", perCourse: [] };
        }),
        yield* changed((file) => {
          file["school"] = 1;
        }),
      ];

      assert.deepStrictEqual(refused.map(Exit.isFailure), [true, true, true]);
    }),
  );
});

describe("Calibrate.histogram", () => {
  it("joins a bin of fewer than five people with its smaller neighbour", () => {
    assert.deepStrictEqual(
      Calibrate.histogram([
        { value: 1, people: [1] },
        { value: 2, people: [2, 3, 4, 5, 6] },
        { value: 2, people: [7] },
        { value: 9, people: [8, 9, 10, 11, 12] },
      ]),
      [
        { from: 1, to: 2, count: 3, people: 7 },
        { from: 9, to: 9, count: 1, people: 5 },
      ],
    );
  });

  it("counts a person in several units once, and leaves out units of fewer than five people", () => {
    assert.deepStrictEqual(
      Calibrate.histogram([
        { value: 1, people: [1, 2] },
        { value: 3, people: [1, 2, 3] },
        { value: 5, people: [3, 4] },
      ]),
      [],
    );
  });
});
