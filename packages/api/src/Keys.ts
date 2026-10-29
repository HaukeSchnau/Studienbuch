import { AccountKey, Wrapper } from "@stu/e2ee";
import * as Rpc from "effect/rpc/Rpc";
import * as RpcGroup from "effect/rpc/RpcGroup";
import * as Schema from "effect/Schema";

// An account's key chain and its recovery wrappers (recovery.md, section 7). They aren't sync
// rows, because nobody but the account reads them, and the server holds public keys, signatures
// and sealed root keys only.

export * as Keys from "./Keys.ts";

/** How long after a sign-in the session may add a passkey or Notfallkarte wrapper. */
export const freshSignInMinutes = 10;

/** How many seal fetches an account gets in 24 hours. */
export const fetchesPerDay = 20;

/** How many `prf` wrappers one passkey may have, one per distinct PRF output (recovery.md, 4). */
export const wrappersPerPasskey = 4;

/** A recovery method as the server keeps it: its statement and the root key sealed to it. */
export class Sealed extends Schema.Class<Sealed, { readonly brand: unique symbol }>("Keys.Sealed")({
  statement: Wrapper.Statement,
  seal: Wrapper.Seal,
}) {}

/** A recovery method without its seal, and when the server stored it. */
export class Listed extends Schema.Class<Listed, { readonly brand: unique symbol }>("Keys.Listed")({
  statement: Wrapper.Statement,
  createdAt: Schema.DateTimeUtc,
}) {}

/** The account's key chain, oldest generation first, and its wrappers, oldest first. */
export class State extends Schema.Class<State, { readonly brand: unique symbol }>("Keys.State")({
  records: Schema.Array(AccountKey.Record),
  wrappers: Schema.Array(Listed),
}) {}

/** What a recovering device checks and opens: the whole chain and the method's sealed wrappers. */
export class Seals extends Schema.Class<Seals, { readonly brand: unique symbol }>("Keys.Seals")({
  records: Schema.Array(AccountKey.Record),
  wrappers: Schema.Array(Sealed),
}) {}

/** A new device unlocks with one passkey's PRF output. */
export const Passkey = Schema.TaggedStruct("Passkey", { credentialId: Schema.String });

/** A new device unlocks with a Notfallkarte, typed in. */
export const RecoveryCode = Schema.TaggedStruct("RecoveryCode", {});

export const Method = Schema.Union([Passkey, RecoveryCode]);

export type Method = typeof Method.Type;

/** The request carries no valid session. */
export class SignedOut extends Schema.TaggedError<SignedOut, { readonly brand: unique symbol }>()(
  "Keys.SignedOut",
  {},
) {}

/** The account has a key chain already, made by another device or by the demo seed. */
export class ChainExists extends Schema.TaggedError<
  ChainExists,
  { readonly brand: unique symbol }
>()("Keys.ChainExists", {}) {}

/** What the device sent doesn't verify, or doesn't belong to the account or generation it names. */
export class Invalid extends Schema.TaggedError<Invalid, { readonly brand: unique symbol }>()(
  "Keys.Invalid",
  {
    reason: Schema.Literals([
      // The key record isn't a self-signed generation 0 of this account.
      "record",
      // The statement isn't endorsed by the newest generation, or its fields don't fit its kind.
      "statement",
      // The seal isn't for this wrapper, account and generation.
      "seal",
      // Another statement already has this wrapper's id.
      "id",
      // The passkey has `wrappersPerPasskey` wrappers already.
      "limit",
    ]),
  },
) {}

/** The account has no key chain, or a newer generation than the wrapper was made for. */
export class Stale extends Schema.TaggedError<Stale, { readonly brand: unique symbol }>()(
  "Keys.Stale",
  {},
) {}

/** A passkey or Notfallkarte wrapper needs a sign-in in the last `freshSignInMinutes`. */
export class NotFresh extends Schema.TaggedError<NotFresh, { readonly brand: unique symbol }>()(
  "Keys.NotFresh",
  {},
) {}

/** The account fetched seals `fetchesPerDay` times in the last 24 hours. */
export class TooManyAttempts extends Schema.TaggedError<
  TooManyAttempts,
  { readonly brand: unique symbol }
>()("Keys.TooManyAttempts", {}) {}

export const Rpcs = RpcGroup.make(
  Rpc.make("Keys.state", { success: State, error: SignedOut }),
  /**
   * The first device of an account publishes generation 0 and its own device wrapper. A repeat of
   * the same record succeeds and changes nothing, so a device can send it again after a lost answer.
   */
  Rpc.make("Keys.init", {
    payload: { record: AccountKey.Record, wrapper: Sealed },
    error: Schema.Union([SignedOut, ChainExists, Invalid]),
  }),
  /**
   * A device that holds the root key adds a wrapper at the newest generation: its own device
   * wrapper after an unlock, or a passkey or Notfallkarte, which need a fresh sign-in.
   */
  Rpc.make("Keys.addWrapper", {
    payload: { wrapper: Sealed },
    error: Schema.Union([SignedOut, Invalid, Stale, NotFresh]),
  }),
  /**
   * A new device's unlock: the account's passkey wrappers for one credential, or its Notfallkarte
   * wrappers, each with its seal of the newest generation. Each fetch that finds a seal is recorded.
   */
  Rpc.make("Keys.fetchSeals", {
    payload: { method: Method },
    success: Seals,
    error: Schema.Union([SignedOut, TooManyAttempts]),
  }),
);
