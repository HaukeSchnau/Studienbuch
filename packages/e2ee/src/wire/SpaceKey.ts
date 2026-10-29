// `@stu/e2ee/schemas` exports this module to the console and packages/api, which must not bundle
// the crypto, so it imports neither noble nor `suite/`. `space-keys/SpaceKey.ts` re-exports it
// with the code that boxes, links and opens space keys.
import * as Schema from "effect/Schema";

import { Bytes } from "../format/Bytes.ts";

export * as SpaceKey from "./SpaceKey.ts";

export class KeyBox extends Schema.Class<KeyBox, { readonly brand: unique symbol }>(
  "SpaceKey.KeyBox",
)({
  format: Bytes.U8,
  suite: Bytes.U8,
  space: Schema.String,
  /** The newest epoch whose key the box carries. */
  keyEpoch: Bytes.U32,
  /** The member account the box is for. */
  recipient: Schema.String,
  /** The generation of the recipient's account key whose sealing key opens the box. */
  recipientGeneration: Bytes.U32,
  author: Schema.String,
  authorGeneration: Bytes.U32,
  enc: Schema.Uint8Array,
  ct: Schema.Uint8Array,
  signature: Schema.Uint8Array,
}) {}

export class HistoryLink extends Schema.Class<HistoryLink, { readonly brand: unique symbol }>(
  "SpaceKey.HistoryLink",
)({
  format: Bytes.U8,
  suite: Bytes.U8,
  space: Schema.String,
  /** The epoch whose key encrypts the link. It holds the key of the epoch before, so at least 1. */
  keyEpoch: Bytes.U32.check(Schema.isGreaterThanOrEqualTo(1)),
  author: Schema.String,
  authorGeneration: Bytes.U32,
  ct: Schema.Uint8Array,
  signature: Schema.Uint8Array,
}) {}
