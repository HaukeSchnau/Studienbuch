/**
 * An account's root key R, one per key generation, and what derives from it: the identity key AIK
 * (Ed25519), which signs boxes, links and wrappers, and the sealing key ASK (X-Wing), which opens
 * key boxes. The server keeps one signed record per generation, each linked from the one before.
 *
 * ```text
 * format 1   aikSeed  = HKDF-SHA256(ikm = R, salt = empty, 32,
 *                         info = "stu.account.sign.v1" || u8(suite) || text(accountId) || u32(g))
 *            askSeed  = HKDF-SHA256(ikm = R, salt = empty, 32,
 *                         info = "stu.account.seal.v1" || u8(suite) || text(accountId) || u32(g))
 *            record_g = "stu.account.v1" || u8(suite) || text(accountId) || u32(g)
 *                       || lp(aikPub) || lp(askPub) || u8(flags: bit 0 = reset)
 *            selfSig  = Ed25519(AIK_g, record_g)
 *            link_g   = Ed25519(AIK_(g-1), "stu.account.next.v1" || SHA-256(record_(g-1))
 *                       || SHA-256(record_g)), absent at generation 0 and on a reset
 * ```
 */
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { Bytes } from "../format/Bytes.ts";
import { E2ee } from "../format/E2ee.ts";
import { CryptoSuite } from "../suite/CryptoSuite.ts";

export * as AccountKey from "./AccountKey.ts";

/** The format this build writes. */
export const format = 1;

/**
 * Everything one generation of an account's root key derives. Lives only on the account's devices,
 * and the secrets stay `Redacted` so a log line can't print them.
 */
export interface Keys {
  readonly accountId: string;
  readonly generation: number;
  readonly rootKey: Redacted.Redacted<Uint8Array>;
  /** The identity key's seed and public key. */
  readonly signingSeed: Redacted.Redacted<Uint8Array>;
  readonly signingKey: Uint8Array;
  /** The sealing key's seed and public key. */
  readonly sealingSeed: Redacted.Redacted<Uint8Array>;
  readonly sealingKey: Uint8Array;
}

/** One generation's public keys, as the server stores and serves them. */
export class Record extends Schema.Class<Record, { readonly brand: unique symbol }>(
  "AccountKey.Record",
)({
  format: Bytes.U8,
  suite: Bytes.U8,
  accountId: Schema.String,
  generation: Bytes.U32,
  /** The account started over without its old root key ("Neu anfangen"), so no link leads here. */
  reset: Schema.Boolean,
  signingKey: Schema.Uint8Array,
  sealingKey: Schema.Uint8Array,
  /** By this generation's identity key, over `signed`. */
  signature: Schema.Uint8Array,
  /** By the previous generation's identity key, over `linked`. */
  link: Schema.optionalKey(Schema.Uint8Array),
}) {}

/** The fields a record's self-signature covers. */
export interface Fields {
  readonly suite: number;
  readonly accountId: string;
  readonly generation: number;
  readonly reset: boolean;
  readonly signingKey: Uint8Array;
  readonly sealingKey: Uint8Array;
}

const keyLength = 32;

const context = (label: string, accountId: string, generation: number) =>
  Result.map(Bytes.text(accountId, "accountKey"), (account) =>
    Bytes.concat(Bytes.label(label), Bytes.u8(CryptoSuite.id), account, Bytes.u32(generation)),
  );

/** Derives the identity and sealing keys of one generation's root key. */
export const derive = Effect.fn("AccountKey.derive")(function* (
  rootKey: Redacted.Redacted<Uint8Array>,
  accountId: string,
  generation: number,
) {
  const suite = yield* CryptoSuite.Service;
  const salt = new Uint8Array(0);
  const ikm = Redacted.value(rootKey);

  const signingSeed = yield* suite.hkdf({
    ikm,
    salt,
    info: yield* Effect.fromResult(context("stu.account.sign.v1", accountId, generation)),
    length: keyLength,
  });

  const sealingSeed = yield* suite.hkdf({
    ikm,
    salt,
    info: yield* Effect.fromResult(context("stu.account.seal.v1", accountId, generation)),
    length: keyLength,
  });

  return {
    accountId,
    generation,
    rootKey,
    signingSeed: Redacted.make(signingSeed),
    signingKey: yield* suite.sign.publicKey(signingSeed),
    sealingSeed: Redacted.make(sealingSeed),
    sealingKey: yield* suite.kem.publicKey(sealingSeed),
  } satisfies Keys;
});

/** A new random root key for `generation`, with what it derives. */
export const generate = Effect.fn("AccountKey.generate")(function* (
  accountId: string,
  generation: number,
) {
  const rootKey = yield* (yield* CryptoSuite.Service).randomBytes(keyLength);

  return yield* derive(Redacted.make(rootKey), accountId, generation);
});

/** What a record's self-signature covers. */
export const signed = (fields: Fields) =>
  Result.map(Bytes.text(fields.accountId, "accountKey"), (account) =>
    Bytes.concat(
      Bytes.label("stu.account.v1"),
      Bytes.u8(fields.suite),
      account,
      Bytes.u32(fields.generation),
      Bytes.lp(fields.signingKey),
      Bytes.lp(fields.sealingKey),
      Bytes.u8(fields.reset ? 1 : 0),
    ),
  );

/** What a link from the previous generation covers. */
export const linked = Effect.fn("AccountKey.linked")(function* (previous: Fields, next: Fields) {
  const suite = yield* CryptoSuite.Service;

  return Bytes.concat(
    Bytes.label("stu.account.next.v1"),
    yield* suite.sha256(yield* Effect.fromResult(signed(previous))),
    yield* suite.sha256(yield* Effect.fromResult(signed(next))),
  );
});

/** The previous generation, which a new record links from: its keys and its record as published. */
export interface Previous {
  readonly keys: Keys;
  readonly record: Record;
}

/** Whether `keys` derive exactly the public keys of `record`. */
export const matches = (keys: Keys, candidate: Record): boolean =>
  keys.accountId === candidate.accountId &&
  keys.generation === candidate.generation &&
  Bytes.equal(keys.signingKey, candidate.signingKey) &&
  Bytes.equal(keys.sealingKey, candidate.sealingKey);

/**
 * The signed record of `keys`, linked from `previous`. Generation 0 has no previous generation,
 * and a reset starts a new chain without one.
 */
export const record = Effect.fn("AccountKey.record")(function* (
  keys: Keys,
  previous: Previous | "reset" | "first",
) {
  const suite = yield* CryptoSuite.Service;

  const fields: Fields = {
    suite: CryptoSuite.id,
    accountId: keys.accountId,
    generation: keys.generation,
    reset: previous === "reset",
    signingKey: keys.signingKey,
    sealingKey: keys.sealingKey,
  };

  const signature = yield* suite.sign.sign(
    Redacted.value(keys.signingSeed),
    yield* Effect.fromResult(signed(fields)),
  );

  if (previous === "first" || previous === "reset") {
    return new Record({ ...fields, format, signature });
  }

  if (
    previous.record.accountId !== keys.accountId ||
    previous.record.generation !== keys.generation - 1 ||
    !matches(previous.keys, previous.record)
  ) {
    return yield* Effect.die(new Error("A link joins consecutive generations of one account."));
  }

  const link = yield* suite.sign.sign(
    Redacted.value(previous.keys.signingSeed),
    yield* linked(previous.record, fields),
  );

  return new Record({ ...fields, format, signature, link });
});

/**
 * Whether `next` is well-formed, has a sealing key boxes can be sealed to, and is signed by its own
 * identity key; and, given the record of the generation before, linked from it. A newer format or
 * suite is `Unsupported`, so the app asks for an update instead of treating it as forged. The
 * server runs this on every record it accepts.
 */
export const verify = Effect.fn("AccountKey.verify")(function* (next: Record, previous?: Record) {
  if (next.format !== format || next.suite !== CryptoSuite.id) {
    return yield* new E2ee.Unsupported({
      format: "accountKey",
      version: next.format,
      suite: next.suite,
    });
  }

  const suite = yield* CryptoSuite.Service;
  const message = signed(next);

  const wellFormed =
    Result.isSuccess(message) &&
    next.signingKey.length === 32 &&
    (yield* suite.kem.validate(next.sealingKey));

  if (!wellFormed) return false;

  if (!(yield* suite.sign.verify(next.signingKey, message.success, next.signature))) return false;

  if (previous === undefined) return true;

  if (
    next.reset ||
    next.link === undefined ||
    next.accountId !== previous.accountId ||
    next.generation !== previous.generation + 1
  ) {
    return false;
  }

  return yield* suite.sign.verify(previous.signingKey, yield* linked(previous, next), next.link);
});

/**
 * Walks from a record the device trusts to the newest of `records`: every generation in between
 * must be present, self-signed and linked from the one before. Returns the newest record.
 */
export const verifyChain = Effect.fn("AccountKey.verifyChain")(function* (
  trusted: Record,
  records: ReadonlyArray<Record>,
) {
  const later = records
    .filter((candidate) => candidate.generation > trusted.generation)
    .sort((a, b) => a.generation - b.generation);

  let current = trusted;

  for (const next of later) {
    if (!(yield* verify(next, current))) {
      return yield* new E2ee.Untrusted({ format: "accountKey", reason: "chain" });
    }

    current = next;
  }

  return current;
});
