/**
 * The suite on noble alone, for the simulation and any test that has to repeat. WebCrypto finishes
 * on Node's thread pool in real time, which reorders fibers that draw from a seeded `Random`. Here
 * every operation completes without waiting, and it computes the same bytes as `TestCrypto`.
 */
import { gcm } from "@noble/ciphers/aes.js";
import { ed25519 } from "@noble/curves/ed25519.js";
import { hkdf } from "@noble/hashes/hkdf.js";
import { hmac } from "@noble/hashes/hmac.js";
import { sha256 } from "@noble/hashes/sha2.js";
import * as Effect from "effect/Effect";

import { Primitives } from "../suite/Primitives.ts";
import { RandomStream } from "./RandomStream.ts";

export * as NobleCrypto from "./NobleCrypto.ts";

const make: RandomStream.Make = (randomBytes) => ({
  randomBytes,
  sha256: (bytes) => Effect.sync(() => sha256(bytes)),
  hmac: (key, bytes) => Effect.sync(() => hmac(sha256, key, bytes)),
  hkdf: ({ ikm, salt, info, length }) => Effect.sync(() => hkdf(sha256, ikm, salt, info, length)),
  aead: {
    seal: (key, nonce, plaintext, aad) =>
      Effect.sync(() => gcm(key, nonce, aad).encrypt(plaintext)),
    // A key or nonce of the wrong length fails in `gcm`, a defect as on WebCrypto.
    open: (key, nonce, ciphertext, aad) =>
      Effect.flatMap(
        Effect.sync(() => gcm(key, nonce, aad)),
        (cipher) =>
          Effect.try({
            try: () => cipher.decrypt(ciphertext),
            catch: () => new Primitives.NotAuthentic(),
          }),
      ),
  },
  sign: {
    publicKey: Primitives.ed25519PublicKey,
    sign: (seed, message) => Effect.sync(() => ed25519.sign(message, seed)),
    // RFC 8032's encodings, as WebCrypto checks them, rather than noble's default of ZIP 215.
    verify: (publicKey, message, signature) =>
      publicKey.length === 32 && signature.length === 64
        ? Effect.sync(() => ed25519.verify(signature, message, publicKey, { zip215: false }))
        : Effect.succeed(false),
  },
  kem: Primitives.xWingKem(randomBytes),
});

/** Draws the same stream as `TestCrypto.layer(seed)`. */
export const layer = (seed: string) => RandomStream.seeded(make, seed);

/** Draws exactly `randomness`. */
export const layerFixed = (randomness: Uint8Array) => RandomStream.fixed(make, randomness);
