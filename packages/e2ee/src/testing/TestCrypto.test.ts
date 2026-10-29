import { assert, describe, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Hex from "effect/encoding/Hex";

import { CryptoSuite } from "../suite/CryptoSuite.ts";
import { TestCrypto } from "./TestCrypto.ts";

const draws = (sizes: ReadonlyArray<number>) =>
  CryptoSuite.Service.use((suite) =>
    Effect.map(Effect.forEach(sizes, suite.randomBytes), (parts) =>
      parts.map((part) => Hex.encode(part)).join(""),
    ),
  );

describe("layer", () => {
  // Vectors and the simulation depend on it: the same seed gives the same stream however a
  // caller slices its draws.
  it.effect("draws one stream per seed, independent of how draws are sized", () =>
    Effect.gen(function* () {
      const sliced = yield* Effect.provide(draws([10, 22, 40]), TestCrypto.layer("a"));
      const whole = yield* Effect.provide(draws([72]), TestCrypto.layer("a"));
      const other = yield* Effect.provide(draws([72]), TestCrypto.layer("b"));

      assert.deepStrictEqual([sliced === whole, whole === other], [true, false]);
    }),
  );
});

describe("layerFixed", () => {
  it.effect("dies when a test draws more than it supplied", () =>
    Effect.gen(function* () {
      const exit = yield* Effect.exit(
        Effect.provide(draws([2, 2]), TestCrypto.layerFixed(Uint8Array.of(1, 2, 3))),
      );

      assert.isTrue(Exit.isFailure(exit) && Exit.hasDies(exit));
    }),
  );
});
