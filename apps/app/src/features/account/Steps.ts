import type { Access } from "@stu/api/Access";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";

// What the account screens hand from one step to the next: in memory, never in the address, so
// neither the browser's history, nor a crafted link, nor the server's request log holds the email,
// the code's reservation or the school's name. `Account` keeps the sign-up waiting for its code.

export * as Steps from "./Steps.ts";

const memory = <A>() => Atom.make(Option.none<A>()).pipe(Atom.keepAlive);

/** The code's reservation and its school, as `Access.redeem` answered on "Willkommen!". */
export const reservation = memory<Access.Reservation>();

/** The address typed on "Anmelden" before "Passwort vergessen?". */
export const forgotten = memory<string>();

/** The address a reset code went to, so a refused second request keeps the code step open. */
export const resetSentTo = memory<string>();
