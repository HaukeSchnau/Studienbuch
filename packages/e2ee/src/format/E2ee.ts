/**
 * How opening or checking a format fails. None of them carries key material or plaintext, so they
 * can be logged and sent as they are.
 */
import * as Schema from "effect/Schema";

export * as E2ee from "./E2ee.ts";

export const Format = Schema.Literals([
  "row",
  "keyBox",
  "historyLink",
  "accountKey",
  "wrapper",
  "wrapperSeal",
]);

export type Format = typeof Format.Type;

/** Bytes or fields that don't fit the format: a wrong length, an unknown kind, broken padding. */
export class Malformed extends Schema.TaggedError<Malformed, { readonly brand: unique symbol }>()(
  "E2ee.Malformed",
  { format: Format, reason: Schema.String },
) {}

/**
 * A format version or suite this build doesn't know, written by a newer app. The device keeps the
 * row as it is and opens it after an update.
 */
export class Unsupported extends Schema.TaggedError<
  Unsupported,
  { readonly brand: unique symbol }
>()("E2ee.Unsupported", { format: Format, version: Schema.Int, suite: Schema.Int }) {}

/**
 * Authenticated decryption failed: the key, the secret, the generation, the wrapper or the account
 * is another one, or the bytes or their context changed. AES-GCM can't tell these apart.
 */
export class WrongSecret extends Schema.TaggedError<
  WrongSecret,
  { readonly brand: unique symbol }
>()("E2ee.WrongSecret", { format: Format }) {}

/**
 * Something opened, but the checks that keep the server from planting a key failed. A device
 * refuses the key and keeps what it had.
 */
export class Untrusted extends Schema.TaggedError<Untrusted, { readonly brand: unique symbol }>()(
  "E2ee.Untrusted",
  {
    format: Format,
    reason: Schema.Literals([
      // A signature doesn't verify under the author's or the account's identity key.
      "signature",
      // A wrapper's anchor doesn't verify under the key its secret derives.
      "anchor",
      // A key record is missing between two generations, or its link doesn't verify.
      "chain",
      // The opened root key doesn't derive the identity and sealing keys of its key record.
      "rootKey",
    ]),
  },
) {}
