/**
 * Fixed vectors for every primitive and every format, the same file on Node, in browsers and on
 * Hermes. Each case computes its values with the real primitives under a test layer, opens what it
 * sealed, and compares every value with `vectors.json`. Published vectors also check the primitive
 * against its standard.
 */
import * as Cause from "effect/Cause";
import type * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Hex from "effect/encoding/Hex";
import * as Exit from "effect/Exit";
import type * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { AccountKey } from "../accounts/AccountKey.ts";
import { Bytes } from "../format/Bytes.ts";
import type { E2ee } from "../format/E2ee.ts";
import { RecoveryCode } from "../recovery/RecoveryCode.ts";
import { Wrapper } from "../recovery/Wrapper.ts";
import { SealedRow } from "../rows/SealedRow.ts";
import { SpaceKey } from "../space-keys/SpaceKey.ts";
import { CryptoSuite } from "../suite/CryptoSuite.ts";
import { TestCrypto } from "../testing/TestCrypto.ts";
import file from "./vectors.json";

export * as Vectors from "./Vectors.ts";

/** A computed value that differs from the standard, from the vector file, or from what went in. */
export class Mismatch extends Schema.TaggedError<Mismatch, { readonly brand: unique symbol }>()(
  "Vectors.Mismatch",
  { field: Schema.String },
) {}

/** One case's values, by name: bytes as hex, text as it is. */
export type Values = Readonly<Record<string, string>>;

export const File = Schema.Array(
  Schema.Struct({
    name: Schema.String,
    values: Schema.Record(Schema.String, Schema.String),
  }),
);

export type File = typeof File.Type;

interface Case {
  readonly name: string;
  /** What the self-test screen shows. */
  readonly title: string;
  /**
   * Ed25519 signatures among the values. RFC 8032 makes them deterministic, but WebKit randomizes
   * them, so there the case's own verification stands in for the bytes.
   */
  readonly signatures?: ReadonlyArray<string>;
  readonly layer: Layer.Layer<CryptoSuite.Service>;
  readonly values: Effect.Effect<
    Values,
    Mismatch | E2ee.Failure | CryptoSuite.NotAuthentic | CryptoSuite.InvalidKey,
    CryptoSuite.Service
  >;
}

export interface Outcome {
  readonly name: string;
  readonly title: string;
  readonly status: "passed" | "failed";
  /** How many values matched, or what went wrong. */
  readonly detail: string;
  readonly duration: Duration.Duration;
}

// The vectors are constants, so one that isn't hex is a bug in this file.
const bytes = (hex: string) => Result.getOrThrow(Hex.decode(hex));
const hex = (value: Uint8Array) => Hex.encode(value);

/** `length` bytes counting up from `start`, for inputs that are obviously not secrets. */
const counting = (start: number, length: number) =>
  Uint8Array.from({ length }, (_, index) => (start + index) & 0xff);

const expect = (holds: boolean, field: string) =>
  holds ? Effect.void : Effect.fail(new Mismatch({ field }));

const same = (a: Uint8Array, b: Uint8Array, field: string) => expect(Bytes.equal(a, b), field);

const suite = CryptoSuite.Service;

const sha256: Case = {
  name: "sha256",
  title: "SHA-256",
  layer: TestCrypto.layer("sha256"),
  values: Effect.gen(function* () {
    const digest = yield* (yield* suite).sha256(Bytes.label("abc"));

    // FIPS 180-2, appendix B.1.
    yield* same(
      digest,
      bytes("ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad"),
      "digest",
    );

    return { message: "abc", digest: hex(digest) };
  }),
};

const hmac: Case = {
  name: "hmac-sha256",
  title: "HMAC-SHA256",
  layer: TestCrypto.layer("hmac-sha256"),
  values: Effect.gen(function* () {
    // RFC 4231, test case 2.
    const mac = yield* (yield* suite).hmac(
      Bytes.label("Jefe"),
      Bytes.label("what do ya want for nothing?"),
    );

    yield* same(
      mac,
      bytes("5bdcc146bf60754e6a042426089575c75a003f089d2739839dec58b964ec3843"),
      "mac",
    );

    return { key: "Jefe", data: "what do ya want for nothing?", mac: hex(mac) };
  }),
};

const hkdf: Case = {
  name: "hkdf-sha256",
  title: "HKDF-SHA256",
  layer: TestCrypto.layer("hkdf-sha256"),
  values: Effect.gen(function* () {
    const derive = (yield* suite).hkdf;
    const ikm = new Uint8Array(22).fill(0x0b);

    // RFC 5869, test case 1.
    const withSalt = yield* derive({
      ikm,
      salt: counting(0, 13),
      info: counting(0xf0, 10),
      length: 42,
    });

    yield* same(
      withSalt,
      bytes("3cb25f25faacd57a90434f64d0362f2a2d2d0a90cf1a5a4c5db02d56ecc4c5bf34007208d5b887185865"),
      "withSalt",
    );

    // RFC 5869, test case 3. Every format here derives with an empty salt.
    const empty = new Uint8Array(0);
    const withoutSalt = yield* derive({ ikm, salt: empty, info: empty, length: 42 });

    yield* same(
      withoutSalt,
      bytes("8da4e775a563c18f715f802a063c5a31b8a11f5c5ee1879ec3454e5f3c738d2d9d201395faa4b61a96c8"),
      "withoutSalt",
    );

    return { withSalt: hex(withSalt), withoutSalt: hex(withoutSalt) };
  }),
};

const aesGcm: Case = {
  name: "aes-256-gcm",
  title: "AES-256-GCM",
  layer: TestCrypto.layer("aes-256-gcm"),
  values: Effect.gen(function* () {
    const { aead } = yield* suite;
    // The GCM specification's test case 16.
    const key = bytes("feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308");
    const nonce = bytes("cafebabefacedbaddecaf888");
    const aad = bytes("feedfacedeadbeeffeedfacedeadbeefabaddad2");

    const plaintext = bytes(
      "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39",
    );

    const sealed = yield* aead.seal(key, nonce, plaintext, aad);

    yield* same(
      sealed,
      bytes(
        "522dc1f099567d07f47f37a32a84427d643a8cdcbfe5c0c97598a2bd2555d1aa8cb08e48590dbb3da7b08b1056828838c5f61e6393ba7a0abcc9f66276fc6ece0f4e1768cddf8853bb2d551b",
      ),
      "sealed",
    );

    yield* same(yield* aead.open(key, nonce, sealed, aad), plaintext, "opened");
    const tampered = sealed.slice();
    tampered[0] = (tampered[0] ?? 0) ^ 1;
    const rejected = yield* Effect.exit(aead.open(key, nonce, tampered, aad));
    yield* expect(Exit.isFailure(rejected), "tampered");

    return { sealed: hex(sealed) };
  }),
};

const ed25519: Case = {
  name: "ed25519",
  title: "Ed25519",
  signatures: ["signature"],
  layer: TestCrypto.layer("ed25519"),
  values: Effect.gen(function* () {
    const { sign } = yield* suite;
    // RFC 8032, section 7.1, test 2. Test 1 signs the empty message, whose signatures WebKit
    // rejects (CryptoSuite.Signature); no format signs an empty message.
    const seed = bytes("4ccd089b28ff96da9db6c346ec114e0f5b8a319f35aba624da8cf6ed4fb8a6fb");
    const message = Uint8Array.of(0x72);
    const publicKey = yield* sign.publicKey(seed);

    yield* same(
      publicKey,
      bytes("3d4017c3e843895a92b70aa74d1b7ebc9c982ccf2ec4968cc0cd55f12af4660c"),
      "publicKey",
    );

    const published = bytes(
      "92a009a9f0d4cab8720e820b5f642540a2b27b5416503f8fb3762223ebdb69da085ac1e43e15996e458f3613d0f11d8c387b2eaeb4302aeeb00d291612bb0c00",
    );

    const signature = yield* sign.sign(seed, message);
    yield* expect(yield* sign.verify(publicKey, message, published), "published");
    yield* expect(yield* sign.verify(publicKey, message, signature), "verifies");
    yield* expect(!(yield* sign.verify(publicKey, Uint8Array.of(0x73), signature)), "forgery");

    return { publicKey: hex(publicKey), signature: hex(signature) };
  }),
};

// draft-connolly-cfrg-xwing-kem's first test vector, as RustCrypto's x-wing crate and noble's tests
// carry it.
const xWingVector = {
  seed: "7f9c2ba4e88f827d616045507605853ed73b8093f6efbc88eb1a6eacfa66ef26",
  eseed:
    "3cb1eea988004b93103cfb0aeefd2a686e01fa4a58e8a3639ca8a1e3f9ae57e235b8cc873c23dc62b8d260169afa2f75ab916a58d974918835d25e6a435085b2",
  sharedSecret: "d2df0522128f09dd8e2c92b1e905c793d8f57a54c3da25861f10bf4ca613e384",
  // SHA-256 of the vector's 1,216-byte public key and 1,120-byte ciphertext.
  publicKeySha256: "2e816deebcd76c5c80d0cd2d174478871658e8e2ff42bc9d4a6e486372e856bb",
  encSha256: "17cd532d657e44c897ca6583e548a5424fc70bf54f99515a4d2bcf99e3469f33",
};

const xWing: Case = {
  name: "x-wing",
  title: "X-Wing",
  layer: TestCrypto.layerFixed(bytes(xWingVector.eseed)),
  values: Effect.gen(function* () {
    const { kem, sha256 } = yield* suite;
    const seed = bytes(xWingVector.seed);
    const publicKey = yield* kem.publicKey(seed);
    const { sharedSecret, enc } = yield* kem.encapsulate(publicKey);
    const publicKeySha256 = yield* sha256(publicKey);
    const encSha256 = yield* sha256(enc);
    yield* same(publicKeySha256, bytes(xWingVector.publicKeySha256), "publicKeySha256");
    yield* same(encSha256, bytes(xWingVector.encSha256), "encSha256");
    yield* same(sharedSecret, bytes(xWingVector.sharedSecret), "sharedSecret");
    yield* same(yield* kem.decapsulate(enc, seed), sharedSecret, "decapsulated");

    // A low-order X25519 half, as a server could plant in a key record or a box.
    const lowOrderKey = publicKey.slice();
    lowOrderKey.fill(0, 1184);
    const lowOrderEnc = enc.slice();
    lowOrderEnc.fill(0, 1088);
    yield* expect(
      !(yield* kem.validate(lowOrderKey)) && (yield* kem.validate(publicKey)),
      "validate",
    );
    const refused = yield* Effect.exit(kem.decapsulate(lowOrderEnc, seed));
    yield* expect(Exit.isFailure(refused), "lowOrderEnc");

    return {
      publicKeySha256: hex(publicKeySha256),
      encSha256: hex(encSha256),
      sharedSecret: hex(sharedSecret),
    };
  }),
};

const prfSalt: Case = {
  name: "prf-salt",
  title: "PRF-Salz",
  layer: TestCrypto.layer("prf-salt"),
  values: Effect.map(Wrapper.prfSalt, (salt) => ({ salt: hex(salt) })),
};

const lena = "account-lena";
const notebook = "notebook-lena";

const encodeEnvelope = Schema.encodeEffect(
  Schema.fromJsonString(Schema.toCodecJson(SealedRow.Envelope)),
);

const rowCase = (name: string, title: string, json: string): Case => ({
  name,
  title,
  layer: TestCrypto.layer(name),
  values: Effect.gen(function* () {
    const key = counting(0x40, 32);

    const sealedRow = {
      space: notebook,
      id: "0190f3a0-7c41-7000-8000-000000000001",
      table: "Homework",
      json,
    };

    const { envelope, ct } = yield* SealedRow.seal(sealedRow, lena, 3, Redacted.make(key));
    const opened = yield* SealedRow.open(sealedRow, envelope, ct, Redacted.make(key));
    yield* expect(opened.table === sealedRow.table && opened.json === sealedRow.json, "opened");

    return {
      key: hex(key),
      json,
      envelope: yield* encodeEnvelope(envelope).pipe(Effect.orDie),
      aad: hex(yield* Effect.fromResult(SealedRow.aad(sealedRow, envelope))),
      ct: hex(ct),
    };
  }),
});

const row = rowCase(
  "row",
  "Zeile",
  '{"courseId":"course-ma23","dueOn":"2026-11-02","title":"S. 41, Nr. 3 und 4"}',
);

// About 1,100 bytes of JSON pad to 2,048, the first size past the minimum.
const largeRow = rowCase(
  "row-2048",
  "Zeile, 2.048 Byte",
  JSON.stringify({ courseId: "course-de23", title: "Erörterung", description: "x".repeat(1040) }),
);

const generation0 = AccountKey.derive(Redacted.make(counting(0xa0, 32)), lena, 0);
const generation1 = AccountKey.derive(Redacted.make(counting(0xc0, 32)), lena, 1);

/** Lena's records of generations 0 and 1, the second linked from the first. */
const chain = Effect.gen(function* () {
  const keys0 = yield* generation0;
  const keys1 = yield* generation1;
  const record0 = yield* AccountKey.record(keys0, "first");
  const record1 = yield* AccountKey.record(keys1, { keys: keys0, record: record0 });

  return { keys0, keys1, record0, record1 };
});

const secret = (keys: AccountKey.Keys) => ({
  rootKey: hex(Redacted.value(keys.rootKey)),
  signingSeed: hex(Redacted.value(keys.signingSeed)),
  sealingSeed: hex(Redacted.value(keys.sealingSeed)),
});

const accountKey: Case = {
  name: "account-key",
  title: "Kontoschlüssel und Kette",
  signatures: ["signature0", "link1"],
  layer: TestCrypto.layer("account-key"),
  values: Effect.gen(function* () {
    const { sha256 } = yield* suite;
    const { keys0, keys1, record0, record1 } = yield* chain;
    yield* expect(yield* AccountKey.verify(record0), "record0");
    yield* expect(yield* AccountKey.verify(record1, record0), "record1");
    const newest = yield* AccountKey.verifyChain(record0, [record1, record0]);
    yield* expect(newest.generation === 1, "chain");
    const secrets0 = secret(keys0);

    return {
      rootKey0: secrets0.rootKey,
      signingSeed0: secrets0.signingSeed,
      signingKey0: hex(keys0.signingKey),
      sealingSeed0: secrets0.sealingSeed,
      sealingKey0Sha256: hex(yield* sha256(keys0.sealingKey)),
      signed0: hex(yield* Effect.fromResult(AccountKey.signed(record0))),
      signature0: hex(record0.signature),
      rootKey1: secret(keys1).rootKey,
      signingKey1: hex(keys1.signingKey),
      linked1: hex(yield* AccountKey.linked(record0, record1)),
      link1: hex(record1.link ?? new Uint8Array(0)),
    };
  }),
};

const keyBox: Case = {
  name: "key-box",
  title: "Schlüsselbox",
  signatures: ["signature"],
  layer: TestCrypto.layer("key-box"),
  values: Effect.gen(function* () {
    const { sha256 } = yield* suite;
    const { keys1, record1 } = yield* chain;
    const current = { epoch: 1, key: Redacted.make(counting(0x10, 32)) };
    const older = { epoch: 0, key: Redacted.make(counting(0x30, 32)) };
    const box = yield* SpaceKey.box(notebook, [current, older], record1, keys1);
    const opened = yield* SpaceKey.openBox(box, notebook, keys1, record1);
    const [first, second] = opened;

    yield* expect(
      opened.length === 2 &&
        first?.epoch === 1 &&
        Bytes.equal(Redacted.value(first.key), Redacted.value(current.key)) &&
        second?.epoch === 0 &&
        Bytes.equal(Redacted.value(second.key), Redacted.value(older.key)),
      "opened",
    );

    return {
      info: hex(yield* Effect.fromResult(SpaceKey.boxInfo(box))),
      encSha256: hex(yield* sha256(box.enc)),
      ct: hex(box.ct),
      signature: hex(box.signature),
    };
  }),
};

const historyLink: Case = {
  name: "history-link",
  title: "Verlaufsglied",
  signatures: ["signature"],
  layer: TestCrypto.layer("history-link"),
  values: Effect.gen(function* () {
    const { keys1, record1 } = yield* chain;
    const current = { epoch: 1, key: Redacted.make(counting(0x10, 32)) };
    const previous = counting(0x30, 32);
    const link = yield* SpaceKey.link(notebook, current, Redacted.make(previous), keys1);
    const opened = yield* SpaceKey.openLink(link, notebook, current, record1);
    yield* expect(
      opened.epoch === 0 && Bytes.equal(Redacted.value(opened.key), previous),
      "opened",
    );

    return {
      aad: hex(yield* Effect.fromResult(SpaceKey.linkAad(link))),
      ct: hex(link.ct),
      signature: hex(link.signature),
    };
  }),
};

// Each wrapper is created at generation 0, re-endorsed by generation 1 and sealed again, the way a
// renewal keeps it. A passkey and a card then recover generation 1's root key.
const wrapperCase = (
  name: string,
  title: string,
  method: Wrapper.Method,
  wrapperSecret: Uint8Array,
): Case => ({
  name,
  title,
  signatures: ["endorsement0", "endorsement1"],
  layer: TestCrypto.layer(name),
  values: Effect.gen(function* () {
    const { sha256 } = yield* suite;
    const { keys0, keys1, record0, record1 } = yield* chain;
    const secretKey = Redacted.make(wrapperSecret);
    const derived = yield* Wrapper.derive(method.kind, secretKey, lena);
    const { statement } = yield* Wrapper.create(method, secretKey, keys0);
    yield* expect(yield* Wrapper.verify(statement, record0), "verifies");
    const kept = yield* Wrapper.reendorse(statement, record0, keys1);
    yield* expect(!(yield* Wrapper.verify(statement, record1)), "stale");
    const seal = yield* Wrapper.seal(kept, keys1);
    const opened = yield* Wrapper.open(seal, lena, method.id, derived.seed);
    yield* same(Redacted.value(opened), Redacted.value(keys1.rootKey), "opened");
    const { kind } = method;

    if (kind !== "device") {
      const recovered = yield* Wrapper.recover(kind, secretKey, lena, kept, seal, [
        record0,
        record1,
      ]);

      yield* expect(AccountKey.matches(recovered, record1), "recovered");
    }

    const fields = {
      suite: statement.suite,
      id: method.id,
      accountId: lena,
      kind: statement.kind,
      place: method.place,
      credentialId: method.credentialId,
      publicKey: statement.publicKey,
    };

    return {
      secret: hex(wrapperSecret),
      seed: hex(Redacted.value(derived.seed)),
      authKey: hex(Redacted.value(derived.authKey)),
      publicKeySha256: hex(yield* sha256(derived.publicKey)),
      signed: hex(yield* Effect.fromResult(Wrapper.signed(fields))),
      anchor: hex(statement.anchor ?? new Uint8Array(0)),
      endorsed0: hex(yield* Wrapper.endorsed(fields, 0, statement.anchor, 0)),
      endorsement0: hex(statement.endorsement),
      endorsement1: hex(kept.endorsement),
      sealInfo: hex(yield* Effect.fromResult(Wrapper.sealInfo(lena, method.id, 1))),
      encSha256: hex(yield* sha256(seal.enc)),
      ct: hex(seal.ct),
    };
  }),
});

const deviceWrapper = wrapperCase(
  "wrapper-device",
  "Wrapper: Gerät",
  { id: "wrapper-phone", kind: "device", place: "", credentialId: "" },
  counting(0x50, 32),
);

const prfWrapper = wrapperCase(
  "wrapper-prf",
  "Wrapper: Passkey",
  { id: "wrapper-passkey", kind: "prf", place: "", credentialId: "KEdYaWdlbkNyZWRlbnRpYWw" },
  counting(0x70, 32),
);

const codeBytes = counting(0x90, 16);

const codeWrapper = wrapperCase(
  "wrapper-code",
  "Wrapper: Notfallkarte",
  { id: "wrapper-card", kind: "code", place: "card", credentialId: "" },
  codeBytes,
);

const recoveryCode: Case = {
  name: "recovery-code",
  title: "Notfallkarten-Code",
  layer: TestCrypto.layer("recovery-code"),
  values: Effect.gen(function* () {
    const text = RecoveryCode.text(Redacted.make(codeBytes));
    const typed = Redacted.value(text).toLowerCase().replaceAll("-", " ");

    const parsed = Result.match(RecoveryCode.parse(typed), {
      onFailure: () => new Uint8Array(0),
      onSuccess: Redacted.value,
    });

    yield* same(parsed, codeBytes, "parsed");

    return {
      bytes: hex(codeBytes),
      text: Redacted.value(text),
      qr: Redacted.value(RecoveryCode.qr(text)),
    };
  }),
};

export const cases: ReadonlyArray<Case> = [
  sha256,
  hmac,
  hkdf,
  aesGcm,
  ed25519,
  xWing,
  prfSalt,
  row,
  largeRow,
  accountKey,
  keyBox,
  historyLink,
  deviceWrapper,
  prfWrapper,
  codeWrapper,
  recoveryCode,
];

/** The vector file's text: every case's values, two-space indented for review. */
export const encodeFile = Schema.encodeEffect(Schema.fromJsonString(File, { space: 2 }));

/** Every case's values, as `vectors.json` holds them. */
export const compute = Effect.forEach(cases, ({ name, layer, values }) =>
  Effect.map(Effect.provide(values, layer), (computed) => ({ name, values: computed })),
);

const compare = (
  expected: Values | undefined,
  computed: Values,
  verifiedOnly: ReadonlyArray<string>,
) => {
  if (expected === undefined) return Effect.fail(new Mismatch({ field: "case" }));
  const fields = [...new Set([...Object.keys(expected), ...Object.keys(computed)])];

  const differing = fields.find(
    (field) => !verifiedOnly.includes(field) && expected[field] !== computed[field],
  );

  if (differing !== undefined) return Effect.fail(new Mismatch({ field: differing }));
  const exact = fields.length - verifiedOnly.length;
  const values = exact === 1 ? "1 Wert stimmt" : `${exact} Werte stimmen`;

  const signatures =
    verifiedOnly.length === 1 ? "1 Signatur geprüft" : `${verifiedOnly.length} Signaturen geprüft`;

  return Effect.succeed(verifiedOnly.length === 0 ? values : `${values}, ${signatures}`);
};

/** Whether this platform's Ed25519 signs one message twice differently, as WebKit's does. */
export const hedged = Effect.gen(function* () {
  const { sign } = yield* suite;
  const seed = counting(0, 32);
  const message = Bytes.label("stu.hedged");
  const first = yield* sign.sign(seed, message);
  const second = yield* sign.sign(seed, message);

  return !Bytes.equal(first, second);
}).pipe(Effect.provide(TestCrypto.layer("hedged")));

const isMismatch = Schema.is(Mismatch);

const describe = (cause: Cause.Cause<unknown>) => {
  const error = Cause.squash(cause);

  if (isMismatch(error)) return `${error.field} weicht ab`;

  return error instanceof Error ? error.message : String(error);
};

const decodeFile = Schema.decodeUnknownEffect(File);

/** Runs every case against `vectors.json`, one after another so each one's time is its own. */
export const run = Effect.gen(function* () {
  const expected = yield* decodeFile(file).pipe(Effect.orDie);
  const byName = new Map(expected.map((entry) => [entry.name, entry.values]));
  const randomized = yield* hedged;

  return yield* Effect.forEach(cases, ({ name, title, signatures = [], layer, values }) =>
    Effect.provide(values, layer).pipe(
      Effect.flatMap((computed) =>
        compare(byName.get(name), computed, randomized ? signatures : []),
      ),
      Effect.exit,
      Effect.timed,
      Effect.map(([duration, exit]): Outcome =>
        Exit.isSuccess(exit)
          ? { name, title, status: "passed", detail: exit.value, duration }
          : { name, title, status: "failed", detail: describe(exit.cause), duration },
      ),
    ),
  );
});
