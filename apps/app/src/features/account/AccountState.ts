import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { useEffect } from "react";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { layer as authenticator } from "../../infra/passkeys/platform.ts";
import { Layers } from "../../infra/runtime/Layers.ts";
import { Account } from "./Account.ts";
import { PasskeyCheck } from "./PasskeyCheck.ts";

// The account flows as atoms for the screens, on this device's layers.

export * as AccountState from "./AccountState.ts";

const runtime = Atom.runtime(
  Layer.mergeAll(AuthApi.layer, authenticator, Account.confirmations).pipe(
    Layer.provideMerge(SessionStore.layer),
    Layer.provideMerge(Layers.app),
  ),
).pipe(Atom.keepAlive);

/** The account this device is signed in as, then every change. */
export const current = runtime
  .atom(Stream.unwrap(Effect.map(SessionStore.Service, (store) => store.changes)))
  .pipe(Atom.keepAlive);

/** What the gates show: see `Account.access`. A build without a server renders, never throws. */
export const useAccess = () => Account.access(useAtomValue(current));

/** The confirmed session waiting for its passkey offer, then every change. */
const confirmed = runtime
  .atom(
    Stream.unwrap(
      Effect.map(Account.Confirmations, ({ current }) => SubscriptionRef.changes(current)),
    ),
  )
  .pipe(Atom.keepAlive);

/** The confirmed session of `email` waiting for its passkey offer, if there is one. */
export const useConfirmedFor = (email: string) =>
  Account.confirmedFor(
    AsyncResult.getOrElse(useAtomValue(confirmed), () => Option.none()),
    email,
  );

export const signIn = runtime.fn<{ readonly email: string; readonly password: string }>()(
  ({ email, password }) => Account.signIn(email, password),
);

export const signUp = runtime.fn<{ readonly email: string; readonly password: string }>()(
  ({ email, password }) => Account.signUp(email, password),
);

export const sendCode = runtime.fn<string>()((email) => Account.sendCode(email));

export const confirmEmail = runtime.fn<{ readonly email: string; readonly code: string }>()(
  ({ email, code }) => Account.confirmEmail(email, code),
);

// `finish`, `abandon` and `signOut` run while their screen goes away. They stay alive so the
// sign-in completes, an unfinished session ends, and the device is wiped and the session revoked.

/** Signs the device in with the session that confirmed `email`, with a new passkey first. */
export const finish = runtime
  .fn<{ readonly email: string; readonly withPasskey: boolean }>()(({ email, withPasskey }) =>
    Account.finish(email, withPasskey),
  )
  .pipe(Atom.keepAlive);

const abandon = runtime
  .fn<string>()((email) => Account.abandon(email))
  .pipe(Atom.keepAlive);

/** Ends the unfinished session of `email` when its code screen goes, by back or by a new route. */
export function useAbandonOnLeave(email: string) {
  const abandonUnfinished = useAtomSet(abandon);

  useEffect(() => () => abandonUnfinished(email), [abandonUnfinished, email]);
}

export const signInWithPasskey = runtime.fn<void>()(() => Account.signInWithPasskey());

export const signOut = runtime
  .fn<void>()(() => Account.signOut(Layers.forget))
  .pipe(Atom.keepAlive);

/** The device check's two steps (design/spikes/passkey-prf.md). */
export const checkCreate = runtime.fn<void>()(() => PasskeyCheck.create);

export const checkAssert = runtime.fn<void>()(() => PasskeyCheck.assert);
