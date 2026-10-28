import { ml_kem768_x25519 } from "@noble/post-quantum/hybrid.js";
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Atom from "effect/reactivity/Atom";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { Vectors } from "./Vectors.ts";

// The crypto stack D38 chose, checked against fixed vectors on every start: WebCrypto (quick-crypto on
// iOS and Android, the browser's own on the web) and X-Wing from noble. The same file runs in Node,
// where CryptoSelfTest.test.ts proves the checks themselves right.

export * as CryptoSelfTest from "./CryptoSelfTest.ts";

/** A result that differs from its vector, or an operation that threw. */
export class Failed extends Schema.TaggedError<Failed, { readonly brand: unique symbol }>()(
  "CryptoSelfTest.Failed",
  { reason: Schema.String },
) {}

/** The platform's WebCrypto lacks the algorithm. Browsers are still adding ML-KEM. */
export class Unsupported extends Schema.TaggedError<
  Unsupported,
  { readonly brand: unique symbol }
>()("CryptoSelfTest.Unsupported", { reason: Schema.String }) {}

export interface Outcome {
  readonly name: string;
  readonly status: "passed" | "failed" | "unsupported";
  /** What passed, or why not. */
  readonly detail: string;
  readonly duration: Duration.Duration;
}

// The vectors are constants, so one that isn't hex is a bug in this file.
const bytes = (hex: string) => new Uint8Array(Result.getOrThrow(Hex.decode(hex)));

const PKCS8_ED25519 = "302e020100300506032b657004220420";
const PKCS8_X25519 = "302e020100300506032b656e04220420";

const message = (cause: unknown) => (cause instanceof Error ? cause.message : String(cause));

const subtle = <A>(operation: (crypto: SubtleCrypto) => Promise<A>) =>
  Effect.tryPromise({
    try: () => operation(globalThis.crypto.subtle),
    catch: (cause) =>
      cause instanceof DOMException && cause.name === "NotSupportedError"
        ? new Unsupported({ reason: message(cause) })
        : new Failed({ reason: message(cause) }),
  });

const expect = (holds: boolean, reason: string) =>
  holds ? Effect.void : Effect.fail(new Failed({ reason }));

const equal = (a: Uint8Array, b: Uint8Array) =>
  a.length === b.length && a.every((value, index) => value === b[index]);

const hex = (buffer: ArrayBuffer | Uint8Array) =>
  Hex.encode(buffer instanceof Uint8Array ? buffer : new Uint8Array(buffer));

const randomness = Effect.gen(function* () {
  const draw = () => globalThis.crypto.getRandomValues(new Uint8Array(32));
  const first = draw();
  yield* expect(!equal(first, draw()) && first.some((value) => value !== 0), "Gleiche Ziehungen");

  return "Zwei Ziehungen à 32 Byte unterscheiden sich";
});

const aesGcm = Effect.gen(function* () {
  const { aes } = Vectors;

  const key = yield* subtle((s) =>
    s.importKey("raw", bytes(aes.key), "AES-GCM", false, ["encrypt", "decrypt"]),
  );

  const params = { name: "AES-GCM", iv: bytes(aes.iv), additionalData: bytes(aes.aad) };
  const sealed = new Uint8Array(yield* subtle((s) => s.encrypt(params, key, bytes(aes.plaintext))));
  yield* expect(hex(sealed) === aes.ciphertextAndTag, "Chiffretext weicht ab");
  const opened = yield* subtle((s) => s.decrypt(params, key, sealed));
  yield* expect(hex(opened) === aes.plaintext, "Klartext weicht ab");
  const tampered = sealed.slice();
  tampered[0] = (tampered[0] ?? 0) ^ 1;

  const rejected = yield* subtle((s) => s.decrypt(params, key, tampered)).pipe(
    Effect.match({ onFailure: () => true, onSuccess: () => false }),
  );

  yield* expect(rejected, "Manipulierter Chiffretext angenommen");

  return "Ver- und entschlüsselt, Manipulation erkannt";
});

const hkdf = Effect.gen(function* () {
  const { hkdf } = Vectors;

  const key = yield* subtle((s) =>
    s.importKey("raw", bytes(hkdf.ikm), "HKDF", false, ["deriveBits"]),
  );

  const params = { name: "HKDF", hash: "SHA-256", salt: bytes(hkdf.salt), info: bytes(hkdf.info) };
  const okm = yield* subtle((s) => s.deriveBits(params, key, hkdf.length * 8));
  yield* expect(hex(okm) === hkdf.okm, "Abgeleiteter Schlüssel weicht ab");

  return "42 Byte wie im RFC";
});

const ed25519 = Effect.gen(function* () {
  const { ed } = Vectors;

  const signer = yield* subtle((s) =>
    s.importKey("pkcs8", bytes(PKCS8_ED25519 + ed.seed), "Ed25519", false, ["sign"]),
  );

  const verifier = yield* subtle((s) =>
    s.importKey("raw", bytes(ed.publicKey), "Ed25519", false, ["verify"]),
  );

  const signature = yield* subtle((s) => s.sign("Ed25519", signer, bytes(ed.message)));
  yield* expect(hex(signature) === ed.signature, "Signatur weicht ab");
  const rowSignature = yield* subtle((s) => s.sign("Ed25519", signer, Vectors.rowMessage));
  yield* expect(hex(rowSignature) === ed.rowSignature, "Signatur der Zeile weicht ab");

  const valid = yield* subtle((s) =>
    s.verify("Ed25519", verifier, bytes(ed.rowSignature), Vectors.rowMessage),
  );

  yield* expect(valid, "Gültige Signatur abgelehnt");
  const forged = Vectors.rowMessage.slice();
  forged[0] = (forged[0] ?? 0) ^ 1;

  const accepted = yield* subtle((s) =>
    s.verify("Ed25519", verifier, bytes(ed.rowSignature), forged),
  );

  yield* expect(!accepted, "Gefälschte Nachricht angenommen");

  return "Signiert, prüft, Fälschung erkannt";
});

const x25519 = Effect.gen(function* () {
  const { x } = Vectors;

  const own = (secret: string) =>
    subtle((s) =>
      s.importKey("pkcs8", bytes(PKCS8_X25519 + secret), "X25519", false, ["deriveBits"]),
    );

  const theirs = (key: string) => subtle((s) => s.importKey("raw", bytes(key), "X25519", true, []));

  const shared = (secret: CryptoKey, peer: CryptoKey) =>
    subtle((s) => s.deriveBits({ name: "X25519", public: peer }, secret, 256));

  const fromAlice = yield* shared(yield* own(x.alicePrivate), yield* theirs(x.bobPublic));
  const fromBob = yield* shared(yield* own(x.bobPrivate), yield* theirs(x.alicePublic));
  yield* expect(
    hex(fromAlice) === x.shared && hex(fromBob) === x.shared,
    "Geteiltes Geheimnis weicht ab",
  );

  return "Beide Richtungen wie im RFC";
});

const mlKem = Effect.gen(function* () {
  const { mlkem } = Vectors;
  const algorithm = { name: "ML-KEM-768" };

  const secret = yield* subtle((s) =>
    s.importKey("raw-seed", bytes(mlkem.seed), algorithm, true, ["decapsulateBits"]),
  );

  const pub = yield* subtle((s) => s.getPublicKey(secret, ["encapsulateBits"]));
  const exported = yield* subtle((s) => s.exportKey("raw-public", pub));
  const digest = yield* subtle((s) => s.digest("SHA-256", exported));
  yield* expect(hex(digest) === mlkem.publicKeySha256, "Öffentlicher Schlüssel weicht ab");

  const opened = yield* subtle((s) =>
    s.decapsulateBits(algorithm, secret, bytes(mlkem.ciphertext)),
  );

  yield* expect(hex(opened) === mlkem.sharedSecret, "Entkapseltes Geheimnis weicht ab");
  const fresh = yield* subtle((s) => s.encapsulateBits(algorithm, pub));
  const back = yield* subtle((s) => s.decapsulateBits(algorithm, secret, fresh.ciphertext));
  yield* expect(
    equal(new Uint8Array(back), new Uint8Array(fresh.sharedKey)),
    "Hin und zurück weicht ab",
  );

  return "Schlüssel aus Seed, Chiffretext von Node, hin und zurück";
});

const noble = <A>(operation: () => A) =>
  Effect.try({ try: operation, catch: (cause) => new Failed({ reason: message(cause) }) });

const xWing = Effect.gen(function* () {
  const { xwing } = Vectors;
  const kem = ml_kem768_x25519;
  const keys = yield* noble(() => kem.keygen(bytes(xwing.seed)));
  const publicKeyDigest = yield* subtle((s) => s.digest("SHA-256", keys.publicKey));
  yield* expect(hex(publicKeyDigest) === xwing.publicKeySha256, "Öffentlicher Schlüssel weicht ab");
  const sealed = yield* noble(() => kem.encapsulate(keys.publicKey, bytes(xwing.eseed)));
  const ciphertextDigest = yield* subtle((s) => s.digest("SHA-256", sealed.cipherText));
  yield* expect(hex(ciphertextDigest) === xwing.ciphertextSha256, "Chiffretext weicht ab");
  yield* expect(hex(sealed.sharedSecret) === xwing.sharedSecret, "Geteiltes Geheimnis weicht ab");
  const opened = yield* noble(() => kem.decapsulate(sealed.cipherText, keys.secretKey));
  yield* expect(equal(opened, sealed.sharedSecret), "Entkapseln weicht ab");

  return "Erzeugen, Ver- und Entkapseln wie in Node";
});

const checks = [
  { name: "Zufallszahlen", run: randomness },
  { name: "AES-256-GCM", run: aesGcm },
  { name: "HKDF-SHA256", run: hkdf },
  { name: "Ed25519", run: ed25519 },
  { name: "X25519", run: x25519 },
  { name: "ML-KEM-768", run: mlKem },
  { name: "X-Wing", run: xWing },
];

/** Runs every check, one after another so each one's time is its own. */
export const run = Effect.forEach(checks, ({ name, run }) =>
  run.pipe(
    Effect.result,
    Effect.timed,
    Effect.map(([duration, result]): Outcome =>
      Result.match(result, {
        onSuccess: (detail) => ({ name, status: "passed", detail, duration }),
        onFailure: (error) => ({
          name,
          status: error._tag === "CryptoSelfTest.Unsupported" ? "unsupported" : "failed",
          detail: error.reason,
          duration,
        }),
      }),
    ),
  ),
);

/** The outcomes of this start's run. Refresh it to check again. */
export const outcomes = Atom.make(run).pipe(Atom.keepAlive);
