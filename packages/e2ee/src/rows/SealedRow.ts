/**
 * An encrypted row: a plaintext envelope that the server checks, and a ciphertext. The AAD ties the
 * ciphertext to its row, space, key epoch and author. The table name travels inside, so the server
 * can't count a notebook's grades. A delete has an envelope and no ciphertext.
 *
 * ```text
 * format 1   aad        = "stu.row.v1" || u8(suite) || text(space) || text(id) || u32(keyEpoch)
 *                         || text(author) || text("")
 *            plaintext  = pad(text(table) || UTF-8 of the row's JSON)
 *            ct         = nonce(12) || AES-256-GCM(K_keyEpoch, nonce, plaintext, aad)
 *            pad(x)     = x || 0x80 || 0x00..., to a power of two of at least 256 bytes
 *
 * text("") is reserved for shared spaces, whose write rules will need the table in plaintext.
 * The AAD binds no row version against a server that serves an older ciphertext (ADR 0022).
 * ```
 */
import * as Schema from "effect/Schema";

import { Bytes } from "../format/Bytes.ts";

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
export const aad = (location: Location, envelope: Envelope): Uint8Array =>
  Bytes.concat(
    Bytes.utf8("stu.row.v1"),
    Bytes.u8(envelope.suite),
    Bytes.text(location.space),
    Bytes.text(location.id),
    Bytes.u32(envelope.keyEpoch),
    Bytes.text(envelope.author),
    Bytes.text(""),
  );
