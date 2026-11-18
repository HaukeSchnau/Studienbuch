import * as Atom from "effect/reactivity/Atom";

export const draft = Atom.family((accountId: string) =>
  // oxlint-disable-next-line studienbuch/no-kept-account-atom -- fixture: an account's draft kept after sign-out
  Atom.make(accountId).pipe(Atom.keepAlive),
);

export const shown = Atom.family((_accountId: string) =>
  // oxlint-disable-next-line studienbuch/no-kept-account-atom -- fixture: an unused account id still keys the family
  Atom.keepAlive(Atom.make(false)),
);

// No directive: a family keyed by something other than an account.
export const zone = Atom.family((publicComputer: boolean) =>
  Atom.make(publicComputer).pipe(Atom.keepAlive),
);

// No directive: an account's atom that goes with its screens.
export const week = Atom.family((accountId: string) => Atom.make(accountId));
