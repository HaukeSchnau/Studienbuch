import * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Encoding from "effect/Encoding";
import type * as Schema from "effect/Schema";

const textEncoder = new TextEncoder();

/** Stable SHA-256 for persisted revision identifiers and privacy-preserving derived IDs. */
export const sha256Text = (value: string) =>
  Effect.gen(function* () {
    const crypto = yield* Crypto.Crypto;
    const digest = yield* crypto.digest("SHA-256", textEncoder.encode(value)).pipe(Effect.orDie);
    return Encoding.encodeHex(digest);
  });

export const sha256Json = (value: Schema.Json) => sha256Text(JSON.stringify(value));
