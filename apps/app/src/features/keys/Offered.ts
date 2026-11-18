import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import type * as Redacted from "effect/Redacted";

import type { Account } from "../account/Account.ts";

// What a sign-in or sign-up hands to the account's key status, in memory only, used once: the
// PRF output of a passkey prompt, so one prompt signs in and unlocks (recovery.md, section 2), the
// Notfallkarte that signed in, which opens the notebook too, and a new account's first card.

export * as Offered from "./Offered.ts";

const once = <A>() => Atom.make<Option.Option<A>>(Option.none()).pipe(Atom.keepAlive);

/** A passkey ceremony's PRF output, waiting for the account's key status. */
export const prf = once<Account.PasskeyUsed>();

/** The card a student signed in with (`Account.signInWithCard`). */
export const typedCard = once<{
  readonly accountId: string;
  readonly code: Redacted.Redacted<Uint8Array>;
}>();

/** A new account's Notfallkarte, until the device keeps it as unsaved (`KeysState.unsavedCard`). */
export const newCard = once<Account.NewCard>();
