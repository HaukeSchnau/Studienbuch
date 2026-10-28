import { assert, it } from "@effect/vitest";
import * as Effect from "effect/Effect";

import { CryptoSelfTest } from "./CryptoSelfTest.ts";

// Node 26's WebCrypto knows every algorithm the devices check, so here a failure is a wrong check,
// not a missing algorithm.
it.effect("every check passes against Node's WebCrypto", () =>
  Effect.gen(function* () {
    const outcomes = yield* CryptoSelfTest.run;

    assert.deepStrictEqual(
      outcomes.map(({ name, status }) => [name, status]),
      [
        ["Zufallszahlen", "passed"],
        ["AES-256-GCM", "passed"],
        ["HKDF-SHA256", "passed"],
        ["Ed25519", "passed"],
        ["X25519", "passed"],
        ["ML-KEM-768", "passed"],
        ["X-Wing", "passed"],
      ],
    );
  }),
);
