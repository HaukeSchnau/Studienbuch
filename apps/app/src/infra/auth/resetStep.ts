import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";

// The address a reset code went to, so "Passwort vergessen?" comes back to the code. A phone keeps
// it while the app runs; a browser keeps it in the tab across a reload (resetStep.web.ts).

/** The address the last reset code on this device went to. */
export const resetSentTo = Atom.make(Option.none<string>()).pipe(Atom.keepAlive);
