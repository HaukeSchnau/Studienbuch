import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";

import type { Account } from "../account/Account.ts";

// Sign-in and unlock in one passkey prompt (recovery.md, section 2): the sign-in leaves the PRF
// output here, in memory only, and the account's key status uses it once.

export * as OfferedPrf from "./OfferedPrf.ts";

/** A passkey ceremony's PRF output, waiting for the account's key status. */
export const waiting = Atom.make(Option.none<Account.PasskeyUsed>()).pipe(Atom.keepAlive);
