/**
 * Each encrypted space has one 32-byte key per epoch. A key box (table `_key`) delivers keys to one
 * member account, and a history link (table `_keychain`) holds the previous epoch's key under the
 * current one, so the current key walks back to epoch 0. The author signs both with the identity
 * key of `authorGeneration`, so the server checks them without opening them.
 *
 * ```text
 * format 1   box info  = "stu.keybox.v1" || u8(suite) || text(space) || u32(keyEpoch)
 *                        || text(recipient) || u32(recipientGeneration)
 *                        || text(author) || u32(authorGeneration)
 *            (ss, enc) = X-Wing.Encaps(the recipient's sealing key of recipientGeneration)
 *            k         = HKDF-SHA256(ikm = ss, salt = empty, info = box info, 32)
 *            payload   = u32(n) || n × (u32(epoch) || key(32)), keyEpoch's key first, then
 *                        strictly older keys for a member who may read history
 *            box ct    = nonce(12) || AES-256-GCM(k, nonce, payload, aad = box info)
 *            box sig   = Ed25519(AIK of author at authorGeneration, box info || lp(enc) || lp(ct))
 *
 *            link aad  = "stu.keychain.v1" || u8(suite) || text(space) || u32(keyEpoch)
 *                        || text(author) || u32(authorGeneration)
 *            link ct   = nonce(12) || AES-256-GCM(K_keyEpoch, nonce, K_(keyEpoch - 1), link aad)
 *            link sig  = Ed25519(AIK of author at authorGeneration, link aad || lp(ct))
 *
 * A space that hides history from a new member leaves out the link at the epoch made for the join.
 * Opening takes space, recipient and epoch from the caller, never from the record itself.
 * ```
 */
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";

import { AccountKey } from "../accounts/AccountKey.ts";
import { Bytes } from "../format/Bytes.ts";
import { E2ee } from "../format/E2ee.ts";
import { CryptoSuite } from "../suite/CryptoSuite.ts";
import { SpaceKey as SpaceKeyWire } from "../wire/SpaceKey.ts";

export * as SpaceKey from "./SpaceKey.ts";

/** The format this build writes, for boxes and links alike. */
export const format = 1;

export const KeyBox = SpaceKeyWire.KeyBox;

export type KeyBox = SpaceKeyWire.KeyBox;

export const HistoryLink = SpaceKeyWire.HistoryLink;

export type HistoryLink = SpaceKeyWire.HistoryLink;

/** The fields of a box that its info binds. */
export interface BoxHeader {
  readonly suite: number;
  readonly space: string;
  readonly keyEpoch: number;
  readonly recipient: string;
  readonly recipientGeneration: number;
  readonly author: string;
  readonly authorGeneration: number;
}

/** What a box's author signs over. */
export interface BoxBody extends BoxHeader {
  readonly enc: Uint8Array;
  readonly ct: Uint8Array;
}

/** The fields of a link that its associated data binds. */
export interface LinkHeader {
  readonly suite: number;
  readonly space: string;
  readonly keyEpoch: number;
  readonly author: string;
  readonly authorGeneration: number;
}

/** What a link's author signs over. */
export interface LinkBody extends LinkHeader {
  readonly ct: Uint8Array;
}

/** A box's key derivation info, which is also its associated data. */
export const boxInfo = (box: BoxHeader) =>
  Result.gen(function* () {
    return Bytes.concat(
      Bytes.label("stu.keybox.v1"),
      Bytes.u8(box.suite),
      yield* Bytes.text(box.space, "keyBox"),
      Bytes.u32(box.keyEpoch),
      yield* Bytes.text(box.recipient, "keyBox"),
      Bytes.u32(box.recipientGeneration),
      yield* Bytes.text(box.author, "keyBox"),
      Bytes.u32(box.authorGeneration),
    );
  });

/** What a box's author signs. */
export const boxSigned = (box: BoxBody) =>
  Result.map(boxInfo(box), (info) => Bytes.concat(info, Bytes.lp(box.enc), Bytes.lp(box.ct)));

/** A link's associated data. */
export const linkAad = (link: LinkHeader) =>
  Result.gen(function* () {
    return Bytes.concat(
      Bytes.label("stu.keychain.v1"),
      Bytes.u8(link.suite),
      yield* Bytes.text(link.space, "historyLink"),
      Bytes.u32(link.keyEpoch),
      yield* Bytes.text(link.author, "historyLink"),
      Bytes.u32(link.authorGeneration),
    );
  });

/** What a link's author signs. */
export const linkSigned = (link: LinkBody) =>
  Result.map(linkAad(link), (aad) => Bytes.concat(aad, Bytes.lp(link.ct)));

/** One epoch's space key. The key stays `Redacted` so a log line can't print it. */
export interface EpochKey {
  readonly epoch: number;
  readonly key: Redacted.Redacted<Uint8Array>;
}

const keyLength = 32;
const nonceLength = 12;
const encLength = 1120;

/** A new random space key. */
export const generate = Effect.gen(function* () {
  return Redacted.make(yield* (yield* CryptoSuite.Service).randomBytes(keyLength));
});

const unsupported = (
  format: E2ee.Format,
  record: { readonly format: number; readonly suite: number },
) =>
  record.format === 1 && record.suite === CryptoSuite.id
    ? Effect.void
    : Effect.fail(new E2ee.Unsupported({ format, version: record.format, suite: record.suite }));

/** The keyEpoch's key first, then strictly older epochs. */
const ordered = (keys: ReadonlyArray<EpochKey>) =>
  keys.every(
    (entry, index) =>
      Redacted.value(entry.key).length === keyLength &&
      (index === 0 || entry.epoch < (keys[index - 1]?.epoch ?? 0)),
  );

const boxKey = (sharedSecret: Uint8Array, info: Uint8Array) =>
  CryptoSuite.Service.use((suite) =>
    suite.hkdf({ ikm: sharedSecret, salt: new Uint8Array(0), info, length: keyLength }),
  );

/**
 * Seals `keys` to one member account, newest first. `recipient` is the newest key record of that
 * account that this device verified through its chain; the box checks its signature and key.
 */
export const box = Effect.fn("SpaceKey.box")(function* (
  space: string,
  keys: readonly [EpochKey, ...ReadonlyArray<EpochKey>],
  recipient: AccountKey.Record,
  author: AccountKey.Keys,
) {
  const suite = yield* CryptoSuite.Service;

  if (!ordered(keys)) {
    return yield* new E2ee.Malformed({ format: "keyBox", reason: "keys not newest first" });
  }

  if (!(yield* suite.kem.validate(recipient.sealingKey))) {
    return yield* new E2ee.Malformed({ format: "keyBox", reason: "sealing key" });
  }

  if (!(yield* AccountKey.verify(recipient))) {
    return yield* new E2ee.Untrusted({ format: "keyBox", reason: "signature" });
  }

  const header: BoxHeader = {
    suite: CryptoSuite.id,
    space,
    keyEpoch: keys[0].epoch,
    recipient: recipient.accountId,
    recipientGeneration: recipient.generation,
    author: author.accountId,
    authorGeneration: author.generation,
  };

  const info = yield* Effect.fromResult(boxInfo(header));

  const { sharedSecret, enc } = yield* suite.kem
    .encapsulate(recipient.sealingKey)
    .pipe(Effect.mapError(() => new E2ee.Malformed({ format: "keyBox", reason: "sealing key" })));

  const k = yield* boxKey(sharedSecret, info);
  const nonce = yield* suite.randomBytes(nonceLength);

  const payload = Bytes.concat(
    Bytes.u32(keys.length),
    ...keys.flatMap(({ epoch, key }) => [Bytes.u32(epoch), Redacted.value(key)]),
  );

  const ct = Bytes.concat(nonce, yield* suite.aead.seal(k, nonce, payload, info));
  const unsigned = { ...header, format, enc, ct };

  const signature = yield* suite.sign.sign(
    Redacted.value(author.signingSeed),
    yield* Effect.fromResult(boxSigned(unsigned)),
  );

  return new KeyBox({ ...unsigned, signature });
});

const authorIs = (record: AccountKey.Record, account: string, generation: number) =>
  record.accountId === account && record.generation === generation;

/**
 * Whether the box is signed by `author`, the newest key record of its author account. A box signed
 * at an older generation counts as unsigned, because a thief may hold that generation's key. The
 * server runs this with the author's current record.
 */
export const verifyBox = (keyBox: KeyBox, author: AccountKey.Record) =>
  CryptoSuite.Service.use((suite) => {
    const message = boxSigned(keyBox);

    return authorIs(author, keyBox.author, keyBox.authorGeneration) && Result.isSuccess(message)
      ? suite.sign.verify(author.signingKey, message.success, keyBox.signature)
      : Effect.succeed(false);
  });

/**
 * Opens a box filed under `space` for this device's account. The space and recipient come from the
 * caller, so a box sealed for another space or account doesn't open. `recipient` is the account's
 * newest keys and `author` the newest verified record of the author; the box's generations must
 * match both. The keys come back newest first.
 */
export const openBox = Effect.fn("SpaceKey.openBox")(function* (
  keyBox: KeyBox,
  space: string,
  recipient: AccountKey.Keys,
  author: AccountKey.Record,
) {
  yield* unsupported("keyBox", keyBox);
  const suite = yield* CryptoSuite.Service;

  // The caller vouches that `author` is the newest record. For the device's own account it holds
  // the newest keys itself, so a box of its own at any other generation came from an older key.
  const ownOlder =
    keyBox.author === recipient.accountId && keyBox.authorGeneration !== recipient.generation;

  if (ownOlder || !authorIs(author, keyBox.author, keyBox.authorGeneration)) {
    return yield* new E2ee.Untrusted({ format: "keyBox", reason: "chain" });
  }

  const expected: BoxBody = {
    suite: keyBox.suite,
    space,
    keyEpoch: keyBox.keyEpoch,
    recipient: recipient.accountId,
    recipientGeneration: recipient.generation,
    author: keyBox.author,
    authorGeneration: keyBox.authorGeneration,
    enc: keyBox.enc,
    ct: keyBox.ct,
  };

  const message = yield* Effect.fromResult(boxSigned(expected));

  if (!(yield* suite.sign.verify(author.signingKey, message, keyBox.signature))) {
    return yield* new E2ee.Untrusted({ format: "keyBox", reason: "signature" });
  }

  if (keyBox.enc.length !== encLength || keyBox.ct.length < nonceLength + 16) {
    return yield* new E2ee.Malformed({ format: "keyBox", reason: "length" });
  }

  const info = yield* Effect.fromResult(boxInfo(expected));

  const sharedSecret = yield* suite.kem
    .decapsulate(keyBox.enc, Redacted.value(recipient.sealingSeed))
    .pipe(Effect.mapError(() => new E2ee.Malformed({ format: "keyBox", reason: "encapsulation" })));

  const k = yield* boxKey(sharedSecret, info);

  const payload = yield* suite.aead
    .open(k, keyBox.ct.subarray(0, nonceLength), keyBox.ct.subarray(nonceLength), info)
    .pipe(Effect.mapError(() => new E2ee.WrongSecret({ format: "keyBox" })));

  const keys = readKeys(payload);

  if (keys === undefined || keys[0]?.epoch !== keyBox.keyEpoch || !ordered(keys)) {
    return yield* new E2ee.Malformed({ format: "keyBox", reason: "payload" });
  }

  return keys;
});

const readKeys = (payload: Uint8Array): ReadonlyArray<EpochKey> | undefined => {
  const reader = new Bytes.Reader(payload);
  const count = reader.u32();

  if (count === undefined || count === 0 || payload.length !== 4 + count * (4 + keyLength)) {
    return undefined;
  }

  const keys: Array<EpochKey> = [];

  for (let index = 0; index < count; index++) {
    const epoch = reader.u32();
    const key = reader.take(keyLength);

    if (epoch === undefined || key === undefined) return undefined;
    keys.push({ epoch, key: Redacted.make(key.slice()) });
  }

  return keys;
};

/** Encrypts the key of the epoch before `current.epoch` under the current key. */
export const link = Effect.fn("SpaceKey.link")(function* (
  space: string,
  current: EpochKey,
  previousKey: Redacted.Redacted<Uint8Array>,
  author: AccountKey.Keys,
) {
  const suite = yield* CryptoSuite.Service;

  const header: LinkHeader = {
    suite: CryptoSuite.id,
    space,
    keyEpoch: current.epoch,
    author: author.accountId,
    authorGeneration: author.generation,
  };

  const aad = yield* Effect.fromResult(linkAad(header));
  const nonce = yield* suite.randomBytes(nonceLength);

  const ct = Bytes.concat(
    nonce,
    yield* suite.aead.seal(Redacted.value(current.key), nonce, Redacted.value(previousKey), aad),
  );

  const unsigned = { ...header, format, ct };

  const signature = yield* suite.sign.sign(
    Redacted.value(author.signingSeed),
    yield* Effect.fromResult(linkSigned(unsigned)),
  );

  return new HistoryLink({ ...unsigned, signature });
});

/** Whether the link is signed by `author`, the key record of its author at `authorGeneration`. */
export const verifyLink = (historyLink: HistoryLink, author: AccountKey.Record) =>
  CryptoSuite.Service.use((suite) => {
    const message = linkSigned(historyLink);

    return authorIs(author, historyLink.author, historyLink.authorGeneration) &&
      Result.isSuccess(message)
      ? suite.sign.verify(author.signingKey, message.success, historyLink.signature)
      : Effect.succeed(false);
  });

/**
 * Returns the key of the epoch before `current`. Space and epoch come from the caller; `author` is
 * the author's key record at the link's generation, verified through the author's chain.
 */
export const openLink = Effect.fn("SpaceKey.openLink")(function* (
  historyLink: HistoryLink,
  space: string,
  current: EpochKey,
  author: AccountKey.Record,
) {
  yield* unsupported("historyLink", historyLink);
  const suite = yield* CryptoSuite.Service;

  if (!authorIs(author, historyLink.author, historyLink.authorGeneration)) {
    return yield* new E2ee.Untrusted({ format: "historyLink", reason: "chain" });
  }

  const expected: LinkBody = {
    suite: historyLink.suite,
    space,
    keyEpoch: current.epoch,
    author: historyLink.author,
    authorGeneration: historyLink.authorGeneration,
    ct: historyLink.ct,
  };

  const message = yield* Effect.fromResult(linkSigned(expected));

  if (!(yield* suite.sign.verify(author.signingKey, message, historyLink.signature))) {
    return yield* new E2ee.Untrusted({ format: "historyLink", reason: "signature" });
  }

  const { ct } = historyLink;

  if (ct.length !== nonceLength + keyLength + 16 || current.epoch < 1) {
    return yield* new E2ee.Malformed({ format: "historyLink", reason: "length" });
  }

  const previous = yield* suite.aead
    .open(
      Redacted.value(current.key),
      ct.subarray(0, nonceLength),
      ct.subarray(nonceLength),
      yield* Effect.fromResult(linkAad(expected)),
    )
    .pipe(Effect.mapError(() => new E2ee.WrongSecret({ format: "historyLink" })));

  return { epoch: current.epoch - 1, key: Redacted.make(previous) } satisfies EpochKey;
});
