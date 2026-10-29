import { useAtomSuspense } from "@effect/atom-react";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { VirtualDevice } from "../../infra/device/VirtualDevice.ts";
import { layer as authenticator } from "../../infra/passkeys/platform.ts";
import { Layers } from "../../infra/runtime/Layers.ts";
import { Account } from "./Account.ts";
import { PasskeyCheck } from "./PasskeyCheck.ts";

// The account flows as atoms for the screens, on this device's layers.

export * as AccountState from "./AccountState.ts";

const runtime = Atom.runtime(
  Layer.mergeAll(AuthApi.layer, authenticator).pipe(
    Layer.provideMerge(SessionStore.layer),
    Layer.provideMerge(Layers.device({ name: VirtualDevice.current, publicComputer: false })),
  ),
).pipe(Atom.keepAlive);

/** The account this device is signed in as, then every change. */
export const current = runtime
  .atom(Stream.unwrap(Effect.map(SessionStore.Service, (store) => store.changes)))
  .pipe(Atom.keepAlive);

/** Whether this device holds an account. Suspends while the device reads its secrets. */
export const useSignedIn = () => Option.isSome(useAtomSuspense(current).value);

/** A session from a confirmed address, held while the device offers a passkey before keeping it. */
export const confirmed = Atom.make(Option.none<AuthApi.SignedIn>()).pipe(Atom.keepAlive);

export const signIn = runtime.fn<{ readonly email: string; readonly password: string }>()(
  ({ email, password }) => Account.signIn(email, password),
);

export const signUp = runtime.fn<{ readonly email: string; readonly password: string }>()(
  ({ email, password }) => Account.signUp(email, password),
);

export const sendCode = runtime.fn<string>()((email) => Account.sendCode(email));

export const confirmEmail = runtime.fn<{ readonly email: string; readonly code: string }>()(
  ({ email, code }, get) =>
    Effect.map(Account.confirmEmail(email, code), (signedIn) =>
      get.set(confirmed, Option.some(signedIn)),
    ),
);

// `finish` and `signOut` change the account, which unmounts the screen that started them. They stay
// alive so the sign-in completes, and the device is wiped and the session revoked completely.

/** Signs the confirmed device in, with a new passkey first when `withPasskey`. */
export const finish = runtime
  .fn<{ readonly withPasskey: boolean }>()(({ withPasskey }, get) =>
    Effect.gen(function* () {
      const signedIn = yield* Effect.fromOption(get(confirmed)).pipe(
        Effect.mapError(() => new Account.Problem({ reason: "failed" })),
      );

      if (withPasskey) yield* Account.addPasskey(signedIn.token);

      yield* Account.keep(signedIn);
      get.set(confirmed, Option.none());
    }),
  )
  .pipe(Atom.keepAlive);

export const signInWithPasskey = runtime.fn<void>()(() => Account.signInWithPasskey());

export const signOut = runtime
  .fn<void>()(() => Account.signOut(Layers.forget))
  .pipe(Atom.keepAlive);

/** The device check's two steps (design/spikes/passkey-prf.md). */
export const checkCreate = runtime.fn<void>()(() => PasskeyCheck.create);

export const checkAssert = runtime.fn<void>()(() => PasskeyCheck.assert);
