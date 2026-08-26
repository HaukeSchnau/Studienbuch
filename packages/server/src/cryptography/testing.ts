import * as NodeCrypto from "@effect/platform-node/NodeCrypto";
import type * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";

/** Runs deterministic crypto-dependent pure builders in synchronous unit-test fixtures. */
export const runCrypto = <A, E>(effect: Effect.Effect<A, E, Crypto.Crypto>) =>
  Effect.runSync(effect.pipe(Effect.provide(NodeCrypto.layer)));
