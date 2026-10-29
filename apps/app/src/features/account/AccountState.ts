import { useAtomSet, useAtomValue } from "@effect/atom-react";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";
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
  Layer.mergeAll(AuthApi.layer, authenticator).pipe(
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

/** A confirmed address with its session, held while the device offers a passkey before keeping it. */
export const confirmed = Atom.make(Option.none<Account.Confirmed>()).pipe(Atom.keepAlive);

export const signIn = runtime.fn<{ readonly email: string; readonly password: string }>()(
  ({ email, password }) => Account.signIn(email, password),
);

export const signUp = runtime.fn<{ readonly email: string; readonly password: string }>()(
  ({ email, password }) => Account.signUp(email, password),
);

export const sendCode = runtime.fn<string>()((email) => Account.sendCode(email));

export const confirmEmail = runtime.fn<{ readonly email: string; readonly code: string }>()(
  ({ email, code }, get) =>
    Effect.map(Account.confirmEmail(email, code), (done) => get.set(confirmed, Option.some(done))),
);

// `finish`, `abandon` and `signOut` run while their screen goes away. They stay alive so the
// sign-in completes, an unfinished session ends, and the device is wiped and the session revoked.

/** Signs the device in with the session that confirmed `email`, with a new passkey first. */
export const finish = runtime
  .fn<{ readonly email: string; readonly withPasskey: boolean }>()(({ email, withPasskey }, get) =>
    Effect.tap(Account.finish(get(confirmed), email, withPasskey), () =>
      Effect.sync(() => get.set(confirmed, Option.none())),
    ),
  )
  .pipe(Atom.keepAlive);

/** Ends the confirmed session nobody finished, so the next person on this device starts clean. */
export const abandon = runtime
  .fn<void>()((_, get) =>
    Option.match(get(confirmed), {
      onNone: () => Effect.void,
      onSome: (unfinished) =>
        Effect.tap(Account.abandon(unfinished), () =>
          Effect.sync(() => get.set(confirmed, Option.none())),
        ),
    }),
  )
  .pipe(Atom.keepAlive);

/** Ends an unfinished confirmed session when the code screen goes, by back or by a new route. */
export function useAbandonOnLeave() {
  const abandonUnfinished = useAtomSet(abandon);

  useEffect(() => () => abandonUnfinished(), [abandonUnfinished]);
}

export const signInWithPasskey = runtime.fn<void>()(() => Account.signInWithPasskey());

export const signOut = runtime
  .fn<void>()((_, get) =>
    Effect.tap(Account.signOut(Layers.forget), () =>
      Effect.sync(() => get.set(confirmed, Option.none())),
    ),
  )
  .pipe(Atom.keepAlive);

/** The device check's two steps (design/spikes/passkey-prf.md). */
export const checkCreate = runtime.fn<void>()(() => PasskeyCheck.create);

export const checkAssert = runtime.fn<void>()(() => PasskeyCheck.assert);
