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
import type * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export * as CryptoSuite from "./CryptoSuite.ts";

/** The suite that `Service` implements and every format writes today. */
export const id = 1;

/** The ciphertext, its associated data or the key doesn't match. A wrong key and altered bytes look the same. */
export class NotAuthentic extends Schema.TaggedError<
  NotAuthentic,
  { readonly brand: unique symbol }
>()("CryptoSuite.NotAuthentic", {}) {}

export interface Hkdf {
  readonly ikm: Uint8Array;
  readonly salt: Uint8Array;
  readonly info: Uint8Array;
  /** In bytes. */
  readonly length: number;
}

/** AES-256-GCM. The ciphertext ends in the 16-byte tag; the nonce travels separately. */
export interface Aead {
  readonly seal: (
    key: Uint8Array,
    nonce: Uint8Array,
    plaintext: Uint8Array,
    aad: Uint8Array,
  ) => Effect.Effect<Uint8Array>;
  readonly open: (
    key: Uint8Array,
    nonce: Uint8Array,
    ciphertext: Uint8Array,
    aad: Uint8Array,
  ) => Effect.Effect<Uint8Array, NotAuthentic>;
}

/** Ed25519. The seed is the 32-byte private key of RFC 8032. */
export interface Signature {
  readonly publicKey: (seed: Uint8Array) => Effect.Effect<Uint8Array>;
  readonly sign: (seed: Uint8Array, message: Uint8Array) => Effect.Effect<Uint8Array>;
  /** False for a wrong signature and for a public key or signature of the wrong length. */
  readonly verify: (
    publicKey: Uint8Array,
    message: Uint8Array,
    signature: Uint8Array,
  ) => Effect.Effect<boolean>;
}

export interface Encapsulation {
  readonly sharedSecret: Uint8Array;
  /** What the holder of the seed needs to compute the same secret: 1,120 bytes for X-Wing. */
  readonly enc: Uint8Array;
}

/** X-Wing. The seed is its 32-byte private key, and public keys are 1,216 bytes. */
export interface Kem {
  readonly publicKey: (seed: Uint8Array) => Effect.Effect<Uint8Array>;
  /** A fresh shared secret for the holder of `publicKey`'s seed, from 64 bytes of `randomBytes`. */
  readonly encapsulate: (publicKey: Uint8Array) => Effect.Effect<Encapsulation>;
  /**
   * The shared secret in `enc`. Another seed gives another secret without failing (ML-KEM's
   * implicit rejection), so only the AEAD that follows tells a wrong seed apart.
   */
  readonly decapsulate: (enc: Uint8Array, seed: Uint8Array) => Effect.Effect<Uint8Array>;
}

/**
 * The suite's operations. Lengths of keys, nonces, seeds and encapsulations are the caller's to
 * check, so a wrong one is a defect. A platform that lacks an algorithm dies the same way; the
 * self-test screen shows which.
 */
export interface Interface {
  /**
   * Bytes from the platform's secure generator. In the test layer, the next bytes of a stream that
   * its seed fixes, so every nonce, key and encapsulation is reproducible.
   */
  readonly randomBytes: (length: number) => Effect.Effect<Uint8Array>;
  readonly sha256: (bytes: Uint8Array) => Effect.Effect<Uint8Array>;
  /** HMAC-SHA256. */
  readonly hmac: (key: Uint8Array, bytes: Uint8Array) => Effect.Effect<Uint8Array>;
  readonly hkdf: (input: Hkdf) => Effect.Effect<Uint8Array>;
  readonly aead: Aead;
  readonly sign: Signature;
  readonly kem: Kem;
}

export class Service extends Context.Service<Service, Interface>()("@stu/e2ee/CryptoSuite") {}
