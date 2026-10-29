// `@stu/e2ee/schemas` exports this module to the console and packages/api, which must not bundle
// the crypto, so it imports neither noble nor `suite/`. `recovery/Wrapper.ts` re-exports it
// with the code that derives, endorses, seals and recovers wrappers.
import * as Schema from "effect/Schema";

import { Bytes } from "../format/Bytes.ts";

export * as Wrapper from "./Wrapper.ts";

export const Kind = Schema.Literals(["device", "prf", "code"]);

export type Kind = typeof Kind.Type;

/** The byte each kind travels and is signed as. 4 is reserved for `shamir`. */
export const kindByte = { device: 1, prf: 2, code: 3 } satisfies {
  readonly [kind in Kind]: number;
};

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
