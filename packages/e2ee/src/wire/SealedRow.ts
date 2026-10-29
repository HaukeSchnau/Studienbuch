// `@stu/e2ee/schemas` exports this module to the console and packages/api, which must not bundle
// the crypto, so it imports neither noble nor `suite/`. `rows/SealedRow.ts` re-exports it
// with the code that seals and opens rows.
import * as Schema from "effect/Schema";

import { Bytes } from "../format/Bytes.ts";

export * as SealedRow from "./SealedRow.ts";

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
