/**
 * The primitives every format is built on. Each format records the suite id it was made with, so a
 * new primitive is a new id and stored data never migrates.
 *
 * ```text
 * suite 1   AES-256-GCM, random 96-bit nonce, 128-bit tag    rows, and every box, link and seal
 *           HKDF-SHA256 (RFC 5869)                           key derivation
 *           X-Wing (draft-connolly-cfrg-xwing-kem)           key boxes and recovery seals
 *           Ed25519 (RFC 8032), SHA-256, HMAC-SHA256         signatures, hashes, anchors
 * ```
 */
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import { Primitives } from "./Primitives.ts";

export * as CryptoSuite from "./CryptoSuite.ts";

/** The suite that `Service` implements and every format writes today. */
export const id = 1;

/** The ciphertext, its associated data or the key doesn't match. */
export const NotAuthentic = Primitives.NotAuthentic;

export type NotAuthentic = Primitives.NotAuthentic;

/** A public key or encapsulation the KEM refuses. */
export const InvalidKey = Primitives.InvalidKey;

export type InvalidKey = Primitives.InvalidKey;

/** The suite's operations; `Primitives.ts` documents each one. */
export type Interface = Primitives.Interface;

export class Service extends Context.Service<Service, Interface>()("@stu/e2ee/CryptoSuite") {}

/**
 * The suite on the platform's WebCrypto: the browser's, Node's, or on iOS and Android the one that
 * quick-crypto's `install()` puts on `globalThis` before the app's first import.
 */
export const layer = Layer.effect(
  Service,
  Effect.suspend(() =>
    globalThis.crypto?.subtle === undefined
      ? Effect.die(
          new Error(
            "No WebCrypto on this platform. On Hermes, call quick-crypto's install() first.",
          ),
        )
      : Effect.succeed(Primitives.make(Primitives.platformRandom)),
  ),
);
