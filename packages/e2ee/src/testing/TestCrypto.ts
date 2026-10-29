/**
 * The real primitives with reproducible randomness, for tests, the simulation and the vectors.
 * Production code never imports `@stu/e2ee/testing` (lint rule `studienbuch/test-only-imports`).
 */
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Semaphore from "effect/Semaphore";

import { Bytes } from "../format/Bytes.ts";
import { CryptoSuite } from "../suite/CryptoSuite.ts";

export * as TestCrypto from "./TestCrypto.ts";

const streamed = Effect.fn("TestCrypto.streamed")(function* (
  refill: (block: number) => Effect.Effect<Uint8Array>,
) {
  const lock = yield* Semaphore.make(1);
  let stream: Uint8Array = new Uint8Array(0);
  let block = 0;

  const draw: CryptoSuite.Interface["randomBytes"] = (length) =>
    lock.withPermits(1)(
      Effect.gen(function* () {
        const blocks = [stream];
        let available = stream.length;

        while (available < length) {
          const next = yield* refill(block);
          blocks.push(next);
          available += next.length;
          block += 1;
        }

        stream = Bytes.concat(...blocks);

        const bytes = stream.slice(0, length);
        stream = stream.slice(length);

        return bytes;
      }),
    );

  return CryptoSuite.make(draw);
});

const digest = (bytes: Uint8Array) =>
  Effect.promise(() => globalThis.crypto.subtle.digest("SHA-256", new Uint8Array(bytes))).pipe(
    Effect.map((buffer) => new Uint8Array(buffer)),
  );

/**
 * Draws are consecutive bytes of the stream
 * `SHA-256("stu.test.random.v1" || lp(UTF-8 of seed) || u32(0)) || SHA-256(... || u32(1)) || ...`.
 */
export const layer = (seed: string) => {
  const prefix = Bytes.concat(Bytes.label("stu.test.random.v1"), Bytes.lp(Bytes.label(seed)));

  return Layer.effect(
    CryptoSuite.Service,
    streamed((block) => digest(Bytes.concat(prefix, Bytes.u32(block)))),
  );
};

/** Draws exactly `randomness`, in order, such as a published vector's encapsulation seed. */
export const layerFixed = (randomness: Uint8Array) =>
  Layer.effect(
    CryptoSuite.Service,
    streamed((block) =>
      block === 0
        ? Effect.succeed(randomness)
        : Effect.die(new Error("The test drew more random bytes than it supplied.")),
    ),
  );
