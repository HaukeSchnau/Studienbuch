import * as Atom from "effect/reactivity/Atom";

// "Öffentlicher Computer" (D44) is a browser's choice. A phone's keychain belongs to one person, so
// phones never keep an account in memory only.

/** Whether the next sign-in here keeps its account in memory only. Never on a phone. */
export const publicComputer = Atom.make(false);
