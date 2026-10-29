/**
 * An encrypted row: a plaintext envelope that the server checks, and a ciphertext. The AAD ties the
 * ciphertext to its row, space, key epoch and author. The table name travels inside, padded so the
 * server can't tell a grade from homework by size. A delete has an envelope and no ciphertext.
 *
 * ```text
 * format 1   aad        = "stu.row.v1" || u8(suite) || text(space) || text(id) || u32(keyEpoch)
 *                         || text(author) || text("")
 *            plaintext  = pad(text(table) || UTF-8 of the row's JSON)
 *            ct         = nonce(12) || AES-256-GCM(K_keyEpoch, nonce, plaintext, aad)
 *            pad(x)     = x || 0x80 || 0x00..., to a power of two of at least 1,024 bytes
 *
 * text("") is reserved for shared spaces, whose write rules will need the table in plaintext.
 * The AAD binds no row version against a server that serves an older ciphertext (ADR 0022).
 * ```
 */
import * as Effect from "effect/Effect";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";

import { Bytes } from "../format/Bytes.ts";
import { E2ee } from "../format/E2ee.ts";
import { CryptoSuite } from "../suite/CryptoSuite.ts";

export * as SealedRow from "./SealedRow.ts";

/** The format this build writes. */
export const format = 1;

export class Envelope extends Schema.Class<Envelope, { readonly brand: unique symbol }>(
  "SealedRow.Envelope",
)({
  /** The format version. An app opens only versions it knows and parks the others. */
  format: Bytes.U8,
  /** The `CryptoSuite` id the row was sealed with. */
  suite: Bytes.U8,
  /** The space key's epoch that encrypted the row. The server refuses a stale one. */
  keyEpoch: Bytes.U32,
  /** The account that wrote the row. The server checks that it is the connection's account. */
  author: Schema.String,
}) {}

/** Where a row lives. The server assigns its version later, so the AAD can't bind that. */
export interface Location {
  readonly space: string;
  readonly id: string;
}

/** The associated data of format 1. */
export const aad = (location: Location, envelope: Envelope) =>
  Result.gen(function* () {
    return Bytes.concat(
      Bytes.label("stu.row.v1"),
      Bytes.u8(envelope.suite),
      yield* Bytes.text(location.space, "row"),
      yield* Bytes.text(location.id, "row"),
      Bytes.u32(envelope.keyEpoch),
      yield* Bytes.text(envelope.author, "row"),
      yield* Bytes.text("", "row"),
    );
  });

/**
 * The smallest padded size. A grade is about 270 bytes and short homework under 256, so a smaller
 * minimum would tell them apart. A 3,000-row notebook takes about 3 MB on the server.
 */
export const minimumPadded = 1024;

/** The size `length` bytes of plaintext pad to: a power of two with room for the 0x80 marker. */
export const paddedLength = (length: number): number => {
  let size = minimumPadded;

  while (size < length + 1) size *= 2;

  return size;
};

const pad = (bytes: Uint8Array) => {
  const padded = new Uint8Array(paddedLength(bytes.length));
  padded.set(bytes);
  padded[bytes.length] = 0x80;

  return padded;
};

const unpad = (padded: Uint8Array) => {
  let end = padded.length - 1;

  while (end >= 0 && padded[end] === 0) end -= 1;

  return padded[end] === 0x80 ? padded.subarray(0, end) : undefined;
};

export interface Row extends Location {
  readonly table: string;
  /** The row's JSON text, which the engine stores as it is. */
  readonly json: string;
}

export interface Sealed {
  readonly envelope: Envelope;
  readonly ct: Uint8Array;
}

export interface Opened {
  readonly table: string;
  readonly json: string;
}

const nonceLength = 12;
const tagLength = 16;

const decoder = new TextDecoder();

const malformed = (reason: string) => Effect.fail(new E2ee.Malformed({ format: "row", reason }));

/**
 * Seals a row under the space key of `keyEpoch`. Called once per row on every push, so it carries
 * no span.
 */
export const seal = Effect.fnUntraced(function* (
  row: Row,
  author: string,
  keyEpoch: number,
  key: Uint8Array,
) {
  const suite = yield* CryptoSuite.Service;
  const envelope = new Envelope({ format, suite: CryptoSuite.id, keyEpoch, author });
  const associated = yield* Effect.fromResult(aad(row, envelope));
  const table = yield* Effect.fromResult(Bytes.text(row.table, "row"));
  const json = yield* Effect.fromResult(Bytes.utf8(row.json, "row"));
  const nonce = yield* suite.randomBytes(nonceLength);
  const sealed = yield* suite.aead.seal(key, nonce, pad(Bytes.concat(table, json)), associated);

  return { envelope, ct: Bytes.concat(nonce, sealed) } satisfies Sealed;
});

/**
 * Opens a row with the space key of `envelope.keyEpoch`. Any padded size opens, so a later minimum
 * changes nothing for stored rows. Called once per pulled row, untraced.
 */
export const open = Effect.fnUntraced(function* (
  location: Location,
  envelope: Envelope,
  ct: Uint8Array,
  key: Uint8Array,
) {
  if (envelope.format !== format || envelope.suite !== CryptoSuite.id) {
    return yield* new E2ee.Unsupported({
      format: "row",
      version: envelope.format,
      suite: envelope.suite,
    });
  }

  if (ct.length < nonceLength + tagLength + 1) return yield* malformed("short");
  const suite = yield* CryptoSuite.Service;
  const associated = yield* Effect.fromResult(aad(location, envelope));

  const padded = yield* suite.aead
    .open(key, ct.subarray(0, nonceLength), ct.subarray(nonceLength), associated)
    .pipe(Effect.mapError(() => new E2ee.WrongSecret({ format: "row" })));

  const plaintext = unpad(padded);

  if (plaintext === undefined) return yield* malformed("padding");
  const reader = new Bytes.Reader(plaintext);
  const table = reader.lp();

  if (table === undefined) return yield* malformed("table");

  return { table: decoder.decode(table), json: decoder.decode(reader.rest()) } satisfies Opened;
});
