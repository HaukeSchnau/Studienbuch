import type { Access } from "@stu/api/Access";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";

import { resetSentTo as keptResetSentTo } from "../../infra/auth/resetStep.ts";

// What the account screens hand from one step to the next: in memory, never in the address, so
// neither the browser's history, nor a crafted link, nor the server's request log holds the email,
// the code's reservation or the school's name. `Account` keeps the sign-up waiting for its code,
// and the device the address of a reset (`resetStep.ts`).

export * as Steps from "./Steps.ts";

const memory = <A>() => Atom.make(Option.none<A>()).pipe(Atom.keepAlive);

/** The code's reservation and its school, as `Access.redeem` answered on "Willkommen!". */
export const reservation = memory<Access.Reservation>();

/** The access code that opened "Konto erstellen", for the way back to "Willkommen!". */
export const accessCode = memory<string>();

/** The address a sign-up used, for "Andere E-Mail-Adresse verwenden" to correct. */
export const signUpEmail = memory<string>();

/** The address typed on "Anmelden" before "Passwort vergessen?". */
export const forgotten = memory<string>();

/**
 * The address a reset code went to, so a refused second request and a reload keep the code step
 * open.
 */
export const resetSentTo = keptResetSentTo;
