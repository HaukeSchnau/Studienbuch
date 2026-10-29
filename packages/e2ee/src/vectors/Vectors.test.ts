import { assert, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { Vectors } from "./Vectors.ts";

// Writing the file is how a format gets its vectors (`vp test run -u`), and a diff in it is a
// format change, which stored data never allows.
it.effect("vectors.json holds what every case computes", () =>
  Effect.gen(function* () {
    const text = yield* Vectors.encodeFile(yield* Vectors.compute);

    yield* Effect.promise(() => expect(`${text}\n`).toMatchFileSnapshot("./vectors.json"));
  }),
);

it.effect("every case passes against vectors.json, as the self-test runs them", () =>
  Effect.gen(function* () {
    const outcomes = yield* Vectors.run;

    assert.deepStrictEqual(
      outcomes
        .filter(({ status }) => status !== "passed")
        .map(({ name, detail }) => [name, detail]),
      [],
    );
  }),
);
