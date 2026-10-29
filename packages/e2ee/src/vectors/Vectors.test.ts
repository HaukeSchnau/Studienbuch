import { assert, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as References from "effect/References";

import { NobleCrypto } from "../testing/NobleCrypto.ts";
import { TestCrypto } from "../testing/TestCrypto.ts";
import { Vectors } from "./Vectors.ts";

// Writing the file is how a format gets its vectors (`vp test run -u`), and a diff in it is a
// format change, which stored data never allows.
it.effect("vectors.json holds what every case computes", () =>
  Effect.gen(function* () {
    const text = yield* Vectors.encodeFile(yield* Vectors.compute);

    yield* Effect.promise(() => expect(`${text}\n`).toMatchFileSnapshot("./vectors.json"));
  }),
);

it.effect.each([
  ["the platform's WebCrypto", TestCrypto],
  ["noble", NobleCrypto],
] as const)(
  "every case passes against vectors.json on %s, as the self-test runs them",
  ([, suites]) =>
    Effect.gen(function* () {
      const outcomes = yield* Vectors.runOn(suites);

      assert.deepStrictEqual(
        outcomes
          .filter(({ status }) => status !== "passed")
          .map(({ name, detail }) => [name, detail]),
        [],
      );
    }),
);

// The simulation relies on it: a fiber started at once that never waits has its result before
// the fork returns. A fiber reads `PreventSchedulerYield` when it starts, so it wraps the fork.
it.effect("NobleCrypto computes every case without waiting for anything", () =>
  Effect.gen(function* () {
    const fiber = yield* Vectors.computeOn(NobleCrypto).pipe(
      Effect.forkChild({ startImmediately: true }),
      Effect.provideService(References.PreventSchedulerYield, true),
    );

    assert.isDefined(fiber.pollUnsafe());
  }),
);
