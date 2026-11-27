import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";

import type { Account } from "../account/Account.ts";

// What a sign-in or sign-up hands to the account's key status, in memory only, used once: the
// PRF output of a passkey prompt, so one prompt signs in and unlocks (recovery.md, section 2), and
// a Notfallkarte, a new account's or one that signed in.

export * as Offered from "./Offered.ts";

const once = <A>() => Atom.make<Option.Option<A>>(Option.none()).pipe(Atom.keepAlive);

/** A passkey ceremony's PRF output, waiting for the account's key status. */
export const prf = once<Account.PasskeyUsed>();

/**
 * A Notfallkarte for the account's key state: a new account's, or one that signed in. A device
 * that keeps its session holds it in the account's secrets already; on a public computer this is
 * the only copy until the key status takes it.
 */
export const card = once<Account.OfferedCard>();

/** `card` taken back by the sign-in that offered it, so another sign-in's card stays. */
export const withdraw =
  (mine: Account.OfferedCard) =>
  (offered: Option.Option<Account.OfferedCard>): Option.Option<Account.OfferedCard> =>
    Option.filter(offered, (each) => each !== mine);
