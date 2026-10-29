/**
 * The suite's operations and their implementation on WebCrypto. The package root reaches them
 * through `CryptoSuite`, which exports no `make`, so only `@stu/e2ee/testing` builds a suite with
 * randomness other than the platform's.
 */
import { ed25519 } from "@noble/curves/ed25519.js";
import { ml_kem768_x25519 } from "@noble/post-quantum/hybrid.js";
import * as Effect from "effect/Effect";
import * as Schema from "effect/Schema";

export * as Primitives from "./Primitives.ts";

/** The ciphertext, its associated data or the key doesn't match. A wrong key and altered bytes look the same. */
export class NotAuthentic extends Schema.TaggedError<
  NotAuthentic,
  { readonly brand: unique symbol }
>()("CryptoSuite.NotAuthentic", {}) {}

/**
 * A public key or encapsulation the KEM refuses: an ML-KEM key outside the modulus, a low-order
 * X25519 point, a wrong length. The server can plant such bytes, so they fail typed.
 */
export class InvalidKey extends Schema.TaggedError<InvalidKey, { readonly brand: unique symbol }>()(
  "CryptoSuite.InvalidKey",
  {},
) {}

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

/**
 * Ed25519. The seed is the 32-byte private key of RFC 8032. WebKit randomizes signatures, and on
 * iOS 27 its verify rejects any signature over an empty message, so every signed message starts
 * with a label and no format depends on signature bytes.
 */
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
  /** Whether a public key can be encapsulated to. Check every key that came from the server. */
  readonly validate: (publicKey: Uint8Array) => Effect.Effect<boolean>;
  /** A fresh shared secret for the holder of `publicKey`'s seed, from 64 bytes of `randomBytes`. */
  readonly encapsulate: (publicKey: Uint8Array) => Effect.Effect<Encapsulation, InvalidKey>;
  /**
   * The shared secret in `enc`. Another seed gives another secret without failing (ML-KEM's
   * implicit rejection), so only the AEAD that follows tells a wrong seed apart.
   */
  readonly decapsulate: (
    enc: Uint8Array,
    seed: Uint8Array,
  ) => Effect.Effect<Uint8Array, InvalidKey>;
}

/**
 * The suite's operations. Lengths of keys, nonces and seeds are the caller's to check, so a wrong
 * one is a defect. A platform that lacks an algorithm dies the same way; the self-test screen shows
 * which.
 */
export interface Interface {
  /**
   * Bytes from the platform's secure generator. In `@stu/e2ee/testing`'s layers, the next bytes of
   * a fixed stream, so every nonce, key and encapsulation is reproducible.
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

// WebCrypto's types want buffers that are plain ArrayBuffers. A copy also drops any offset into a
// larger buffer, which some implementations mishandle.
const own = (bytes: Uint8Array): Uint8Array<ArrayBuffer> => new Uint8Array(bytes);

const subtle = () => globalThis.crypto.subtle;

const call = <A>(operation: () => Promise<A>) => Effect.promise(operation);

const bytesOf = (buffer: ArrayBuffer) => new Uint8Array(buffer);

// PKCS #8 wraps a raw Ed25519 seed in a fixed 16-byte header (RFC 8410), the one format every
// WebCrypto imports Ed25519 private keys from.
const ed25519Header = [
  0x30, 0x2e, 0x02, 0x01, 0x00, 0x30, 0x05, 0x06, 0x03, 0x2b, 0x65, 0x70, 0x04, 0x22, 0x04, 0x20,
];

const ed25519Pkcs8 = (seed: Uint8Array) => {
  const key = new Uint8Array(48);
  key.set(ed25519Header);
  key.set(seed, 16);

  return key;
};

const xWing = ml_kem768_x25519;

// noble throws for a key or encapsulation it refuses: an ML-KEM key outside the modulus, a
// low-order X25519 point.
const kemCall = <A>(operation: () => A) =>
  Effect.try({ try: operation, catch: () => new InvalidKey() });

const probeRandomness = new Uint8Array(64);

// Not every browser's WebCrypto derives a public key from a private one, and exporting the private
// key to read it would take the key out of WebCrypto, so noble computes it in every suite.
export const ed25519PublicKey: Signature["publicKey"] = (seed) =>
  Effect.sync(() => ed25519.getPublicKey(seed));

/** X-Wing on noble, the same in every suite, with encapsulation randomness from `randomBytes`. */
export const xWingKem = (randomBytes: Interface["randomBytes"]): Kem => ({
  publicKey: (seed) => Effect.sync(() => xWing.getPublicKey(seed)),
  validate: (publicKey) =>
    publicKey.length === xWing.lengths.publicKey
      ? kemCall(() => xWing.encapsulate(publicKey, probeRandomness)).pipe(
          Effect.as(true),
          Effect.orElseSucceed(() => false),
        )
      : Effect.succeed(false),
  encapsulate: (publicKey) =>
    Effect.flatMap(randomBytes(64), (eseed) =>
      kemCall(() => {
        const { sharedSecret, cipherText } = xWing.encapsulate(publicKey, eseed);

        return { sharedSecret, enc: cipherText };
      }),
    ),
  decapsulate: (enc, seed) => kemCall(() => xWing.decapsulate(enc, seed)),
});

/**
 * The suite on WebCrypto, with X-Wing and Ed25519 public keys from noble, drawing randomness from
 * `randomBytes`. `CryptoSuite.layer` passes the platform's generator, `@stu/e2ee/testing` fixed
 * streams; nothing else may build a suite.
 */
export const make = (randomBytes: Interface["randomBytes"]): Interface => ({
  randomBytes,
  sha256: (bytes) => call(() => subtle().digest("SHA-256", own(bytes))).pipe(Effect.map(bytesOf)),
  hmac: Effect.fnUntraced(function* (key, bytes) {
    const hmacKey = yield* call(() =>
      subtle().importKey("raw", own(key), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]),
    );

    return bytesOf(yield* call(() => subtle().sign("HMAC", hmacKey, own(bytes))));
  }),
  hkdf: Effect.fnUntraced(function* ({ ikm, salt, info, length }) {
    const key = yield* call(() =>
      subtle().importKey("raw", own(ikm), "HKDF", false, ["deriveBits"]),
    );

    const params = { name: "HKDF", hash: "SHA-256", salt: own(salt), info: own(info) };

    return bytesOf(yield* call(() => subtle().deriveBits(params, key, length * 8)));
  }),
  aead: {
    seal: Effect.fnUntraced(function* (key, nonce, plaintext, aad) {
      const aesKey = yield* call(() =>
        subtle().importKey("raw", own(key), "AES-GCM", false, ["encrypt"]),
      );

      const params = { name: "AES-GCM", iv: own(nonce), additionalData: own(aad) };

      return bytesOf(yield* call(() => subtle().encrypt(params, aesKey, own(plaintext))));
    }),
    open: Effect.fnUntraced(function* (key, nonce, ciphertext, aad) {
      const aesKey = yield* call(() =>
        subtle().importKey("raw", own(key), "AES-GCM", false, ["decrypt"]),
      );

      const params = { name: "AES-GCM", iv: own(nonce), additionalData: own(aad) };

      const plaintext = yield* Effect.tryPromise({
        try: () => subtle().decrypt(params, aesKey, own(ciphertext)),
        catch: () => new NotAuthentic(),
      });

      return bytesOf(plaintext);
    }),
  },
  sign: {
    publicKey: ed25519PublicKey,
    sign: Effect.fnUntraced(function* (seed, message) {
      const key = yield* call(() =>
        subtle().importKey("pkcs8", own(ed25519Pkcs8(seed)), "Ed25519", false, ["sign"]),
      );

      return bytesOf(yield* call(() => subtle().sign("Ed25519", key, own(message))));
    }),
    verify: Effect.fnUntraced(function* (publicKey, message, signature) {
      if (publicKey.length !== 32 || signature.length !== 64) return false;

      // A public key that isn't a curve point fails the import in some implementations.
      const key = yield* Effect.tryPromise(() =>
        subtle().importKey("raw", own(publicKey), "Ed25519", false, ["verify"]),
      ).pipe(Effect.option);

      return key._tag === "None"
        ? false
        : yield* call(() => subtle().verify("Ed25519", key.value, own(signature), own(message)));
    }),
  },
  kem: xWingKem(randomBytes),
});

/** The platform's secure generator, `crypto.getRandomValues`. */
export const platformRandom: Interface["randomBytes"] = (length) =>
  Effect.sync(() => {
    const bytes = new Uint8Array(length);

    // getRandomValues fills at most 65,536 bytes per call.
    for (let offset = 0; offset < length; offset += 65_536) {
      globalThis.crypto.getRandomValues(bytes.subarray(offset, offset + 65_536));
    }

    return bytes;
  });
