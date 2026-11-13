import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Access } from "@stu/api/Access";
import { SyncClient } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { useEffect } from "react";

import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { layer as signUpStore } from "../../infra/auth/signUpStore.ts";
import { publicComputer } from "../../infra/device/publicComputer.ts";
import { layer as authenticator } from "../../infra/passkeys/platform.ts";
import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Layers } from "../../infra/runtime/Layers.ts";
import { OfferedPrf } from "../keys/OfferedPrf.ts";
import { Account } from "./Account.ts";
import { PasskeyCheck } from "./PasskeyCheck.ts";

// The account flows as atoms for the screens, on this device's layers. Each sign-in hands over the
// tab's "Öffentlicher Computer" choice (`publicComputer`).

export * as AccountState from "./AccountState.ts";

const runtime = Atom.runtime(
  Layer.mergeAll(authenticator, Account.confirmations.pipe(Layer.provideMerge(signUpStore))).pipe(
    Layer.provideMerge(AccountEngine.device),
  ),
).pipe(Atom.keepAlive);

/** The account this device is signed in as, then every change. */
export const current = runtime
  .atom(Stream.unwrap(Effect.map(SessionStore.Service, (store) => store.changes)))
  .pipe(Atom.keepAlive);

/** `Account.keepsNothing` for this device. Storage outside an account follows it too. */
export const keepsNothing = Atom.make((get) =>
  Account.keepsNothing(get(current), get(publicComputer)),
);

/** What the gates show: see `Account.access`. A build without a server renders, never throws. */
export const useAccess = () => Account.access(useAtomValue(current));

/**
 * The commands of `accountId` that the server hasn't settled, as its engine counts them. Reading it
 * starts the engine. When the engine can't start, nothing else can open the account's database
 * either, so the count stays unknown.
 */
const unsentOf = Atom.family((accountId: string) =>
  Atom.runtime(AccountEngine.app(accountId)).atom(
    Stream.unwrap(Effect.map(SyncClient.Service, (sync) => sync.status.changes)).pipe(
      Stream.map((status) => status.waiting),
      Stream.changes,
    ),
  ),
);

/** The unsent commands of the account on this device for "Abmelden", 0 when it holds none. */
export const unsent = Atom.make((get) =>
  AsyncResult.flatMap(get(current), (signed) =>
    Option.match(signed, {
      onNone: () => AsyncResult.success(0),
      onSome: ({ accountId }) => get(unsentOf(accountId)),
    }),
  ),
);

/** The confirmed session waiting for its passkey offer, then every change. */
const confirmed = runtime
  .atom(
    Stream.unwrap(
      Effect.map(Account.Confirmations, ({ current }) => SubscriptionRef.changes(current)),
    ),
  )
  .pipe(Atom.keepAlive);

/** The confirmed session waiting for its passkey offer, if there is one. */
export const useConfirmed = () =>
  AsyncResult.getOrElse(useAtomValue(confirmed), () => Option.none());

/** The sign-up waiting for its code (`Account.SigningUp`), then every change. */
export const signingUp = runtime
  .atom(
    Stream.unwrap(
      Effect.map(Account.Confirmations, ({ signingUp }) => SubscriptionRef.changes(signingUp)),
    ),
  )
  .pipe(Atom.keepAlive);

/**
 * The tab's choice when a sign-in starts. Read without a dependency: a change must not run the
 * sign-in again.
 */
const chosen = (get: Atom.FnContext) => get.registry.get(publicComputer);

export const signIn = runtime.fn<{ readonly email: string; readonly password: string }>()(
  ({ email, password }, get) => Account.signIn(email, password, chosen(get)),
);

/** `reservation` as `Access.redeem` answered on the code screen. */
export const signUp = runtime.fn<{
  readonly email: string;
  readonly password: string;
  readonly reservation: Access.Reservation;
}>()(({ email, password, reservation }) => Account.signUp(email, password, reservation));

export const sendCode = runtime.fn<string>()((email) => Account.sendCode(email));

export const requestPasswordReset = runtime.fn<string>()((email) =>
  Account.requestPasswordReset(email),
);

/** Sets the new password with the mailed code and signs the device in with it. */
export const resetPassword = runtime.fn<{
  readonly email: string;
  readonly code: string;
  readonly password: string;
}>()(({ email, code, password }, get) => Account.resetPassword(email, code, password, chosen(get)));

/** `password` only when the screen asked for it again, after a restart. */
export const confirmEmail = runtime.fn<{
  readonly email: string;
  readonly code: string;
  readonly password?: string;
}>()(({ email, code, password }) =>
  Account.confirmEmail(email, code, Option.fromNullishOr(password)),
);

// `cancelSignUp`, `finish`, `leave` and `signOut` run while their screen goes away. They stay alive
// so the sign-up's entry goes, the sign-in completes, an unfinished session is kept or ends, and
// the device is wiped and the session revoked.

export const cancelSignUp = runtime
  .fn<void>()(() => Account.cancelSignUp)
  .pipe(Atom.keepAlive);

/** Signs the device in with the session that confirmed `email`, with a new passkey first. */
export const finish = runtime
  .fn<{ readonly email: string; readonly withPasskey: boolean }>()(({ email, withPasskey }, get) =>
    Effect.tap(Account.finish(email, withPasskey, chosen(get)), (used) =>
      Effect.sync(() => get.set(OfferedPrf.waiting, used)),
    ),
  )
  .pipe(Atom.keepAlive);

const leave = runtime
  .fn<string>()((email, get) => Account.leave(email, chosen(get)))
  .pipe(Atom.keepAlive);

/**
 * Settles the unfinished session of `email` when its screen goes, by back or by a new route: kept
 * as with "Später", or ended on a public computer (`Account.leave`).
 */
export function useLaterOnLeave(email: string) {
  const settle = useAtomSet(leave);

  useEffect(() => () => settle(email), [settle, email]);
}

/** Signs in with a passkey, and leaves its PRF output for the notebook's unlock. */
export const signInWithPasskey = runtime.fn<void>()((_, get) =>
  Effect.tap(Account.signInWithPasskey(chosen(get)), (used) =>
    Effect.sync(() => get.set(OfferedPrf.waiting, Option.some(used))),
  ),
);

export const signOut = runtime
  .fn<void>()(() =>
    // The account's engine closes first: only a closed database can be deleted. A public
    // computer's account kept everything in its engine, so closing it forgets the account.
    Account.signOut(({ accountId, publicComputer }) =>
      Effect.andThen(
        AccountEngine.close(accountId),
        publicComputer ? Effect.void : Layers.forget(accountId),
      ),
    ),
  )
  .pipe(Atom.keepAlive);

/** The device check's two steps (design/spikes/passkey-prf.md). */
export const checkCreate = runtime.fn<void>()(() => PasskeyCheck.create);

export const checkAssert = runtime.fn<void>()(() => PasskeyCheck.assert);
