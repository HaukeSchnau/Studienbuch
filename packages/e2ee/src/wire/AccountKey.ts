// `@stu/e2ee/schemas` exports this module to the console and packages/api, which must not bundle
// the crypto, so it imports neither noble nor `suite/`. `accounts/AccountKey.ts` re-exports it
// with the code that derives, signs and checks records.
import * as Schema from "effect/Schema";

import { Bytes } from "../format/Bytes.ts";

export * as AccountKey from "./AccountKey.ts";

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
