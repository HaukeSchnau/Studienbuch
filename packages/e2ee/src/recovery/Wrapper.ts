/**
 * Every way back to an account's root key is a wrapper: the method's secret derives an X-Wing key
 * pair, the server stores its public key in a statement, and R sealed to it per generation. The
 * anchor proves the secret was there at creation; the endorsement says the newest generation keeps
 * the wrapper, and every renewal re-endorses the wrappers it keeps (ADR 0026).
 *
 * ```text
 * format 1   seed     = HKDF-SHA256(ikm = secret, salt = empty, 32,
 *                          info = "stu.wrapper.seed.v1" || u8(suite) || u8(kind) || text(accountId))
 *            M        = HKDF-SHA256(ikm = secret, salt = empty, 32,
 *                          info = "stu.wrapper.auth.v1" || u8(suite) || u8(kind) || text(accountId))
 *            pub      = the X-Wing public key of seed
 *            stmt     = "stu.wrapper.v1" || u8(suite) || text(accountId) || text(id) || u8(kind)
 *                       || text(place) || text(credentialId) || lp(pub)
 *            anchor   = HMAC-SHA256(M, "stu.wrapper.anchor.v1" || SHA-256(stmt) || u32(a)
 *                       || lp(aikPub_a)), a = anchorGeneration; empty for a device
 *            endorse  = Ed25519(AIK_e, "stu.wrapper.endorse.v1" || SHA-256(stmt) || u32(a)
 *                       || lp(anchor) || u32(e)), e = endorsedGeneration
 *
 *            info     = "stu.wrapper.seal.v1" || u8(suite) || text(accountId) || text(id) || u32(g)
 *            (ss, enc)= X-Wing.Encaps(pub)
 *            ct       = nonce(12) || AES-256-GCM(HKDF-SHA256(ss, empty, info, 32), nonce, R_g, info)
 *
 * kind       1 device: 32 random bytes in the keychain     2 prf: the PRF output for prfSalt
 *            3 code: the Notfallkarte's 16 bytes           4 shamir: later
 * ```
 */
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { AccountKey } from "../accounts/AccountKey.ts";
import { Bytes } from "../format/Bytes.ts";
import { E2ee } from "../format/E2ee.ts";
import { CryptoSuite } from "../suite/CryptoSuite.ts";

export * as Wrapper from "./Wrapper.ts";

/** The format this build writes, for statements and seals alike. */
export const format = 1;

export const Kind = Schema.Literals(["device", "prf", "code"]);

export type Kind = typeof Kind.Type;

/** The byte each kind travels and is signed as. 4 is reserved for `shamir`. */
export const kindByte = { device: 1, prf: 2, code: 3 } satisfies {
  readonly [kind in Kind]: number;
};

const kindOf = (byte: number): Kind | undefined =>
  byte === kindByte.device
    ? "device"
    : byte === kindByte.prf
      ? "prf"
      : byte === kindByte.code
        ? "code"
        : undefined;

/** A recovery method as the server stores it. */
export class Statement extends Schema.Class<Statement, { readonly brand: unique symbol }>(
  "Wrapper.Statement",
)({
  format: Bytes.U8,
  suite: Bytes.U8,
  /** Chosen by the device that creates it. */
  id: Schema.String,
  accountId: Schema.String,
  /** `kindByte`. Any byte decodes, so a newer kind reaches an older app as `Unsupported`. */
  kind: Bytes.U8,
  /** Where a code lives: `card` or `passwordManager`. Empty for the other kinds. */
  place: Schema.String,
  /** The passkey's credential id for `prf`. Empty for the other kinds. */
  credentialId: Schema.String,
  publicKey: Schema.Uint8Array,
  /** The generation whose identity key the anchor binds: the one the wrapper was created at. */
  anchorGeneration: Bytes.U32,
  /** Proves to a recovering device that the method's secret was there at creation. */
  anchor: Schema.optionalKey(Schema.Uint8Array),
  /** The generation whose identity key signed `endorsement`; every renewal moves it forward. */
  endorsedGeneration: Bytes.U32,
  endorsement: Schema.Uint8Array,
}) {}

/** The root key of `generation`, sealed to one wrapper's public key. */
export class Seal extends Schema.Class<Seal, { readonly brand: unique symbol }>("Wrapper.Seal")({
  format: Bytes.U8,
  suite: Bytes.U8,
  wrapperId: Schema.String,
  accountId: Schema.String,
  generation: Bytes.U32,
  enc: Schema.Uint8Array,
  ct: Schema.Uint8Array,
}) {}

/** A method before it has keys: what its statement names. */
export interface Method {
  readonly id: string;
  readonly kind: Kind;
  readonly place: "" | "card" | "passwordManager";
  readonly credentialId: string;
}

/** What a method's secret derives. The seed and `M` stay `Redacted`. */
export interface Derived {
  readonly seed: Redacted.Redacted<Uint8Array>;
  /** `M`, the key of the anchor's MAC. */
  readonly authKey: Redacted.Redacted<Uint8Array>;
  readonly publicKey: Uint8Array;
}

/** The fields the statement bytes cover. */
export interface Fields {
  readonly suite: number;
  readonly id: string;
  readonly accountId: string;
  readonly kind: number;
  readonly place: string;
  readonly credentialId: string;
  readonly publicKey: Uint8Array;
}

const keyLength = 32;
const nonceLength = 12;
const encLength = 1120;

const malformed = (reason: string) => new E2ee.Malformed({ format: "wrapper", reason });

const untrusted = (reason: E2ee.Untrusted["reason"]) =>
  new E2ee.Untrusted({ format: "wrapper", reason });

/** The PRF salt every passkey evaluates: `SHA-256("studienbuch.prf.v1")`. */
export const prfSalt = CryptoSuite.Service.use((suite) =>
  suite.sha256(Bytes.label("studienbuch.prf.v1")),
);

/** The seed, the anchor's key and the public key that a method's secret derives for one account. */
export const derive = Effect.fn("Wrapper.derive")(function* (
  kind: Kind,
  secret: Redacted.Redacted<Uint8Array>,
  accountId: string,
) {
  const suite = yield* CryptoSuite.Service;
  const account = yield* Effect.fromResult(Bytes.text(accountId, "wrapper"));

  const derived = (label: string) =>
    suite.hkdf({
      ikm: Redacted.value(secret),
      salt: new Uint8Array(0),
      info: Bytes.concat(
        Bytes.label(label),
        Bytes.u8(CryptoSuite.id),
        Bytes.u8(kindByte[kind]),
        account,
      ),
      length: keyLength,
    });

  const seed = yield* derived("stu.wrapper.seed.v1");
  const authKey = yield* derived("stu.wrapper.auth.v1");

  return {
    seed: Redacted.make(seed),
    authKey: Redacted.make(authKey),
    publicKey: yield* suite.kem.publicKey(seed),
  } satisfies Derived;
});

/** The statement bytes, which the anchor and the endorsement cover by their hash. */
export const signed = (fields: Fields) =>
  Result.gen(function* () {
    return Bytes.concat(
      Bytes.label("stu.wrapper.v1"),
      Bytes.u8(fields.suite),
      yield* Bytes.text(fields.accountId, "wrapper"),
      yield* Bytes.text(fields.id, "wrapper"),
      Bytes.u8(fields.kind),
      yield* Bytes.text(fields.place, "wrapper"),
      yield* Bytes.text(fields.credentialId, "wrapper"),
      Bytes.lp(fields.publicKey),
    );
  });

const statementHash = (fields: Fields) =>
  Effect.flatMap(Effect.fromResult(signed(fields)), (bytes) =>
    CryptoSuite.Service.use((suite) => suite.sha256(bytes)),
  );

const anchorOf = Effect.fn("Wrapper.anchorOf")(function* (
  authKey: Redacted.Redacted<Uint8Array>,
  fields: Fields,
  generation: number,
  signingKey: Uint8Array,
) {
  const suite = yield* CryptoSuite.Service;

  const message = Bytes.concat(
    Bytes.label("stu.wrapper.anchor.v1"),
    yield* statementHash(fields),
    Bytes.u32(generation),
    Bytes.lp(signingKey),
  );

  return yield* suite.hmac(Redacted.value(authKey), message);
});

/** What the identity key of `endorsedGeneration` signs to keep a wrapper. */
export const endorsed = Effect.fn("Wrapper.endorsed")(function* (
  fields: Fields,
  anchorGeneration: number,
  anchor: Uint8Array | undefined,
  endorsedGeneration: number,
) {
  return Bytes.concat(
    Bytes.label("stu.wrapper.endorse.v1"),
    yield* statementHash(fields),
    Bytes.u32(anchorGeneration),
    Bytes.lp(anchor ?? new Uint8Array(0)),
    Bytes.u32(endorsedGeneration),
  );
});

const fieldsOf = (statement: Statement): Fields => ({
  suite: statement.suite,
  id: statement.id,
  accountId: statement.accountId,
  kind: statement.kind,
  place: statement.place,
  credentialId: statement.credentialId,
  publicKey: statement.publicKey,
});

const known = (statement: Statement) =>
  statement.format === format &&
  statement.suite === CryptoSuite.id &&
  kindOf(statement.kind) !== undefined
    ? Effect.void
    : Effect.fail(
        new E2ee.Unsupported({
          format: "wrapper",
          version: statement.format,
          suite: statement.suite,
        }),
      );

/** Whether `signingKey`, of `generation`, endorses the statement, and its public key is usable. */
const endorsedBy = Effect.fn("Wrapper.endorsedBy")(function* (
  statement: Statement,
  accountId: string,
  generation: number,
  signingKey: Uint8Array,
) {
  const suite = yield* CryptoSuite.Service;

  if (statement.accountId !== accountId || statement.endorsedGeneration !== generation) {
    return false;
  }

  if (!(yield* suite.kem.validate(statement.publicKey))) return false;

  const message = yield* endorsed(
    fieldsOf(statement),
    statement.anchorGeneration,
    statement.anchor,
    statement.endorsedGeneration,
  );

  return yield* suite.sign.verify(signingKey, message, statement.endorsement);
});

/**
 * Whether `record`, the account's key record at the statement's endorsed generation, endorses it.
 * A kind, format or suite this build doesn't know is `Unsupported`, never a forgery, so a rotating
 * app asks for an update instead of revoking a wrapper it can't read.
 */
export const verify = Effect.fn("Wrapper.verify")(function* (
  statement: Statement,
  record: AccountKey.Record,
) {
  yield* known(statement);

  return yield* endorsedBy(statement, record.accountId, record.generation, record.signingKey);
});

const endorse = Effect.fn("Wrapper.endorse")(function* (
  fields: Fields,
  anchorGeneration: number,
  anchor: Uint8Array | undefined,
  keys: AccountKey.Keys,
) {
  const suite = yield* CryptoSuite.Service;
  const message = yield* endorsed(fields, anchorGeneration, anchor, keys.generation);
  const endorsement = yield* suite.sign.sign(Redacted.value(keys.signingSeed), message);
  const unanchored = { ...fields, format, anchorGeneration, endorsedGeneration: keys.generation };

  return anchor === undefined
    ? new Statement({ ...unanchored, endorsement })
    : new Statement({ ...unanchored, anchor, endorsement });
});

/**
 * Keeps a wrapper across a renewal: `previous` is the generation that endorsed it so far, and
 * `keys` the new generation, which endorses it again. A statement `previous` doesn't endorse is
 * refused, so a wrapper planted with a stolen older key ends at the first renewal after it.
 */
export const reendorse = Effect.fn("Wrapper.reendorse")(function* (
  statement: Statement,
  previous: AccountKey.Record,
  keys: AccountKey.Keys,
) {
  if (!(yield* verify(statement, previous)) || keys.accountId !== statement.accountId) {
    return yield* untrusted("signature");
  }

  return yield* endorse(fieldsOf(statement), statement.anchorGeneration, statement.anchor, keys);
});

/**
 * Seals the root key of `keys` to a wrapper that `keys` endorses: one it created or re-endorsed.
 * Sealing to any other statement fails, so only verified wrappers receive the root key.
 */
export const seal = Effect.fn("Wrapper.seal")(function* (
  statement: Statement,
  keys: AccountKey.Keys,
) {
  yield* known(statement);
  const suite = yield* CryptoSuite.Service;

  if (!(yield* endorsedBy(statement, keys.accountId, keys.generation, keys.signingKey))) {
    return yield* untrusted("signature");
  }

  const info = yield* Effect.fromResult(sealInfo(keys.accountId, statement.id, keys.generation));

  const { sharedSecret, enc } = yield* suite.kem
    .encapsulate(statement.publicKey)
    .pipe(Effect.mapError(() => malformed("public key")));

  const k = yield* suite.hkdf({
    ikm: sharedSecret,
    salt: new Uint8Array(0),
    info,
    length: keyLength,
  });

  const nonce = yield* suite.randomBytes(nonceLength);

  const ct = Bytes.concat(
    nonce,
    yield* suite.aead.seal(k, nonce, Redacted.value(keys.rootKey), info),
  );

  return new Seal({
    format,
    suite: CryptoSuite.id,
    wrapperId: statement.id,
    accountId: keys.accountId,
    generation: keys.generation,
    enc,
    ct,
  });
});

/**
 * A new wrapper for `secret`: its statement, anchored at the current generation (not for a device)
 * and endorsed by it, and the current root key sealed to it.
 */
export const create = Effect.fn("Wrapper.create")(function* (
  method: Method,
  secret: Redacted.Redacted<Uint8Array>,
  keys: AccountKey.Keys,
) {
  const derived = yield* derive(method.kind, secret, keys.accountId);

  const fields: Fields = {
    suite: CryptoSuite.id,
    id: method.id,
    accountId: keys.accountId,
    kind: kindByte[method.kind],
    place: method.place,
    credentialId: method.credentialId,
    publicKey: derived.publicKey,
  };

  const anchor =
    method.kind === "device"
      ? undefined
      : yield* anchorOf(derived.authKey, fields, keys.generation, keys.signingKey);

  const statement = yield* endorse(fields, keys.generation, anchor, keys);

  return { statement, seal: yield* seal(statement, keys) };
});

/** The seal's key derivation info, which is also its associated data. */
export const sealInfo = (accountId: string, wrapperId: string, generation: number) =>
  Result.gen(function* () {
    return Bytes.concat(
      Bytes.label("stu.wrapper.seal.v1"),
      Bytes.u8(CryptoSuite.id),
      yield* Bytes.text(accountId, "wrapperSeal"),
      yield* Bytes.text(wrapperId, "wrapperSeal"),
      Bytes.u32(generation),
    );
  });

/**
 * Opens a seal with a wrapper's seed. The account and wrapper come from the device, not the seal,
 * so a seal of another account or wrapper fails like a wrong seed.
 */
export const open = Effect.fn("Wrapper.open")(function* (
  sealed: Seal,
  accountId: string,
  wrapperId: string,
  seed: Redacted.Redacted<Uint8Array>,
) {
  if (sealed.format !== format || sealed.suite !== CryptoSuite.id) {
    return yield* new E2ee.Unsupported({
      format: "wrapperSeal",
      version: sealed.format,
      suite: sealed.suite,
    });
  }

  if (sealed.enc.length !== encLength || sealed.ct.length !== nonceLength + keyLength + 16) {
    return yield* new E2ee.Malformed({ format: "wrapperSeal", reason: "length" });
  }

  const suite = yield* CryptoSuite.Service;
  const info = yield* Effect.fromResult(sealInfo(accountId, wrapperId, sealed.generation));

  const sharedSecret = yield* suite.kem
    .decapsulate(sealed.enc, Redacted.value(seed))
    .pipe(
      Effect.mapError(() => new E2ee.Malformed({ format: "wrapperSeal", reason: "encapsulation" })),
    );

  const k = yield* suite.hkdf({
    ikm: sharedSecret,
    salt: new Uint8Array(0),
    info,
    length: keyLength,
  });

  const rootKey = yield* suite.aead
    .open(k, sealed.ct.subarray(0, nonceLength), sealed.ct.subarray(nonceLength), info)
    .pipe(Effect.mapError(() => new E2ee.WrongSecret({ format: "wrapperSeal" })));

  return Redacted.make(rootKey);
});

/** Opens the newest generation's seal and checks that the root key derives that generation's record. */
const openNewest = Effect.fn("Wrapper.openNewest")(function* (
  sealed: Seal,
  newest: AccountKey.Record,
  wrapperId: string,
  seed: Redacted.Redacted<Uint8Array>,
) {
  // A server that serves an older seal hands over an older root key. Every renewal must reach the
  // device, so only the newest generation counts.
  if (sealed.generation !== newest.generation) return yield* untrusted("chain");
  const rootKey = yield* open(sealed, newest.accountId, wrapperId, seed);
  const keys = yield* AccountKey.derive(rootKey, newest.accountId, newest.generation);

  return AccountKey.matches(keys, newest) ? keys : yield* untrusted("rootKey");
});

/**
 * Recovers the root key of the signed-in `accountId` on a new device from a passkey's PRF output or
 * a Notfallkarte. It accepts the key only if the anchor verifies under the secret's `M` and the
 * identity key of the anchor's generation, every link from there to the newest record verifies,
 * the newest generation endorses the statement, and the opened key derives the newest record.
 */
export const recover = Effect.fn("Wrapper.recover")(function* (
  kind: "prf" | "code",
  secret: Redacted.Redacted<Uint8Array>,
  accountId: string,
  statement: Statement,
  sealed: Seal,
  records: ReadonlyArray<AccountKey.Record>,
) {
  yield* known(statement);
  const derived = yield* derive(kind, secret, accountId);

  const fits =
    statement.kind === kindByte[kind] &&
    statement.accountId === accountId &&
    Bytes.equal(derived.publicKey, statement.publicKey);

  if (!fits) return yield* new E2ee.WrongSecret({ format: "wrapper" });

  const origin = records.find(
    (candidate) =>
      candidate.generation === statement.anchorGeneration && candidate.accountId === accountId,
  );

  if (origin === undefined || !(yield* AccountKey.verify(origin))) {
    return yield* untrusted("chain");
  }

  const anchor = yield* anchorOf(
    derived.authKey,
    fieldsOf(statement),
    origin.generation,
    origin.signingKey,
  );

  if (statement.anchor === undefined || !Bytes.equal(anchor, statement.anchor)) {
    return yield* untrusted("anchor");
  }

  const newest = yield* AccountKey.verifyChain(origin, records);

  if (!(yield* verify(statement, newest))) return yield* untrusted("signature");

  return yield* openNewest(sealed, newest, statement.id, derived.seed);
});

/**
 * Picks up a renewed root key on a device that held an older generation: the device trusts the
 * record it already had, walks the chain to the newest record, and opens its own device seal with
 * the secret from its keychain.
 */
export const renewed = Effect.fn("Wrapper.renewed")(function* (
  secret: Redacted.Redacted<Uint8Array>,
  wrapperId: string,
  trusted: AccountKey.Record,
  sealed: Seal,
  records: ReadonlyArray<AccountKey.Record>,
) {
  const derived = yield* derive("device", secret, trusted.accountId);
  const newest = yield* AccountKey.verifyChain(trusted, records);

  return yield* openNewest(sealed, newest, wrapperId, derived.seed);
});
