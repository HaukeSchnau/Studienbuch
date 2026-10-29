/**
 * The reproducible randomness behind `TestCrypto` and `NobleCrypto`: each draw takes the next bytes
 * of one stream, however a caller slices its draws. Producing the stream never waits, so draws
 * happen in the order callers make them.
 */
import { sha256 } from "@noble/hashes/sha2.js";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Semaphore from "effect/Semaphore";

import { Bytes } from "../format/Bytes.ts";
import { CryptoSuite } from "../suite/CryptoSuite.ts";
import type { Primitives } from "../suite/Primitives.ts";

export * as RandomStream from "./RandomStream.ts";

/** Builds a suite's operations around the `randomBytes` it is given. */
export type Make = (randomBytes: Primitives.Interface["randomBytes"]) => Primitives.Interface;

const streamed = Effect.fn("RandomStream.streamed")(function* (
  refill: (block: number) => Effect.Effect<Uint8Array>,
  make: Make,
) {
  const lock = yield* Semaphore.make(1);
  let stream: Uint8Array = new Uint8Array(0);
  let block = 0;

  const draw: Primitives.Interface["randomBytes"] = (length) =>
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

  return make(draw);
});

/**
 * Draws are consecutive bytes of the stream
 * `SHA-256("stu.test.random.v1" || lp(UTF-8 of seed) || u32(0)) || SHA-256(... || u32(1)) || ...`.
 */
export const seeded = (make: Make, seed: string) => {
  const prefix = Bytes.concat(Bytes.label("stu.test.random.v1"), Bytes.lp(Bytes.label(seed)));

  return Layer.effect(
    CryptoSuite.Service,
    streamed((block) => Effect.sync(() => sha256(Bytes.concat(prefix, Bytes.u32(block)))), make),
  );
};

/** Draws exactly `randomness`, in order, such as a published vector's encapsulation seed. */
export const fixed = (make: Make, randomness: Uint8Array) =>
  Layer.effect(
    CryptoSuite.Service,
    streamed(
      (block) =>
        block === 0
          ? Effect.succeed(randomness)
          : Effect.die(new Error("The test drew more random bytes than it supplied.")),
      make,
    ),
  );
