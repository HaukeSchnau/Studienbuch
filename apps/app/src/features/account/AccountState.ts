import { useAtomMount, useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Access } from "@stu/api/Access";
import { AccountDeletion } from "@stu/api/AccountDeletion";
import { SyncClient, SyncQuery } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Atom from "effect/reactivity/Atom";
import * as RpcClient from "effect/rpc/RpcClient";
import * as Stream from "effect/Stream";
import * as SubscriptionRef from "effect/SubscriptionRef";
import { useEffect } from "react";

import { ApiProtocol } from "../../infra/api/ApiProtocol.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { layer as signUpStore } from "../../infra/auth/signUpStore.ts";
import { publicComputer } from "../../infra/device/publicComputer.ts";
import { layer as authenticator } from "../../infra/passkeys/platform.ts";
import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Layers } from "../../infra/runtime/Layers.ts";
import { OfferedPrf } from "../keys/OfferedPrf.ts";
import { Account } from "./Account.ts";
import { Deletion } from "./Deletion.ts";
import { DeletionServer } from "./DeletionServer.ts";
import { PasskeyCheck } from "./PasskeyCheck.ts";

// The account flows as atoms for the screens, on this device's layers. Each sign-in hands over the
// tab's "Öffentlicher Computer" choice (`publicComputer`).

export * as AccountState from "./AccountState.ts";

const bearer = (token: Redacted.Redacted) => ({
  headers: { authorization: `Bearer ${Redacted.value(token)}` },
});

const unreachable = { RpcClientError: () => Effect.fail(new DeletionServer.Unreachable()) };

/** `DeletionServer` over HTTP to `Ports.Server`, with the token each call names. */
const deletionServer = Layer.effect(DeletionServer.Service)(
  Effect.gen(function* () {
    const client = yield* RpcClient.make(AccountDeletion.Rpcs);

    return DeletionServer.Service.of({
      delete: (token) =>
        client["AccountDeletion.delete"](undefined, bearer(token)).pipe(
          Effect.catchTags({ ...unreachable }),
        ),
      deleted: (token) =>
        client["AccountDeletion.deleted"](undefined, bearer(token)).pipe(
          Effect.catchTags({ ...unreachable }),
        ),
    });
  }),
).pipe(Layer.provide(ApiProtocol.authenticated(Effect.succeedNone)));

const runtime = Atom.runtime(
  Layer.mergeAll(
    authenticator,
    deletionServer,
    Account.confirmations.pipe(Layer.provideMerge(signUpStore)),
  ).pipe(Layer.provideMerge(AccountEngine.device)),
).pipe(Atom.keepAlive);

/** The account this device is signed in as, then every change. */
export const current = runtime
  .atom(Stream.unwrap(Effect.map(SessionStore.Service, (store) => store.changes)))
  .pipe(Atom.keepAlive);

/** The account the device holds: the same through a new token and through the session's end. */
const holder = Atom.make((get) =>
  Option.map(Option.flatten(AsyncResult.value(get(current))), (signed) => signed.accountId),
).pipe(Atom.withEquality(Equal.equals));

/**
 * Memory of the device's account that outlives its screens and not the account: `initial` again
 * once another account or none holds the device, so sign-out leaves nothing of a student. It
 * isn't lazy, so a value nobody reads goes at that moment too.
 */
export const memory = <A>(initial: A) => {
  const self: Atom.Writable<A, A> = Atom.writable(
    (get) => {
      get(holder);

      return initial;
    },
    (context, value: A) => {
      // A write before any read reads first, so the value follows the account from the start.
      context.get(self);
      context.setSelf(value);
    },
  ).pipe(Atom.setLazy(false), Atom.keepAlive);

  return self;
};

/** `Account.keepsNothing` for this device. Storage outside an account follows it too. */
export const keepsNothing = Atom.make((get) =>
  Account.keepsNothing(get(current), get(publicComputer)),
);

/** What the gates show: see `Account.access`. A build without a server renders, never throws. */
export const useAccess = () => Account.access(useAtomValue(current));

/**
 * The commands of `accountId` that the server hasn't settled, for "Abmelden". Reading it starts the
 * engine. When the engine can't start, nothing else can open the account's database either, so
 * they stay unknown.
 */
export const unsent = Atom.family((accountId: string) =>
  Atom.map(
    SyncQuery.family(Atom.runtime(AccountEngine.app(accountId)), SyncClient.outbox)(),
    AsyncResult.map(AccountEngine.unsentOf),
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

// `cancelSignUp`, `finish`, `leave`, `signOut` and `deleteAccount` run while their screen goes away.
// They stay alive so the sign-up's entry goes, the sign-in completes, an unfinished session is kept
// or ends, and the device is wiped and the session revoked.

export const cancelSignUp = runtime
  .fn<void>()(() => Account.cancelSignUp)
  .pipe(Atom.keepAlive);

/** Signs the device in with the session that confirmed `email`, with a new passkey first. */
export const finish = runtime
  .fn<{ readonly email: string; readonly withPasskey: boolean }>()(({ email, withPasskey }, get) =>
    // The PRF output goes to `OfferedPrf` only: this atom stays alive and keeps what it returns.
    Effect.flatMap(Account.finish(email, withPasskey, chosen(get)), (used) =>
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

/**
 * Whether this tab signed an account out, so the gates lead to "Anmelden" rather than to the code.
 * Memory only: the sign-out forgot everything else about the account, and a reload starts afresh.
 */
export const signedOut = Atom.make(false).pipe(Atom.keepAlive);

const failed = Effect.fail(new Account.Problem({ reason: "sign-out-failed" }));

/**
 * Signs the device out (`Account.signOut`). `unsent` is what the question before showed
 * (`unsent`), `None` when it couldn't tell. A newer change refuses with `AccountEngine.MoreUnsent`,
 * and the question asks again; any other failure is "sign-out-failed", which the student retries.
 */
export const signOut = runtime
  .fn<Option.Option<AccountEngine.Unsent>>()((unsent, get) =>
    Account.signOut(({ accountId, publicComputer }, forgetSession) => {
      // Before the session goes, which is when the gates move on.
      const signedOutHere = Effect.andThen(
        Effect.sync(() => {
          get.set(signedOut, true);
          get.set(OfferedPrf.waiting, Option.none());
        }),
        forgetSession,
      );

      return AccountEngine.forget(
        accountId,
        unsent,
        // A public computer's account kept everything in its engine, which `forget` stopped.
        Effect.gen(function* () {
          if (publicComputer) return yield* signedOutHere;

          yield* Layers.endSignOut(accountId, signedOutHere);
        }),
      );
    }).pipe(
      Effect.catchTags({
        "Forgetting.Unfinished": () => failed,
        "Keychain.Unavailable": () => failed,
        SqlError: () => failed,
      }),
    ),
  )
  .pipe(Atom.keepAlive);

/**
 * Leaves the deleted account by its id, without asking about its unsent changes, which went with it
 * on the server (`AccountEngine.forgetIfHeld`). The gates then lead to the start, not to
 * "Anmelden". A failure after the point of no return finishes at the next start.
 */
const leaveDeleted = (accountId: string, forgotten: Effect.Effect<void>) =>
  AccountEngine.forgetIfHeld(accountId, forgotten).pipe(
    Effect.catchTags({
      "Forgetting.Unfinished": () => forgetFailed,
      "Keychain.Unavailable": () => forgetFailed,
      SqlError: () => forgetFailed,
    }),
  );

const forgetFailed = Effect.fail(new Deletion.Problem({ reason: "forget-failed" }));

/** "Konto löschen" (`Deletion.deleteAccount`). */
export const deleteAccount = runtime
  .fn<void>()((_, get) =>
    Deletion.deleteAccount((accountId) =>
      leaveDeleted(
        accountId,
        Effect.sync(() => get.set(OfferedPrf.waiting, Option.none())),
      ),
    ),
  )
  .pipe(Atom.keepAlive);

const forgetWhenDeleted = runtime
  .atom((get) =>
    Deletion.forgetWhenDeleted((accountId) =>
      leaveDeleted(
        accountId,
        Effect.sync(() => get.set(OfferedPrf.waiting, Option.none())),
      ),
    ),
  )
  .pipe(Atom.keepAlive);

/**
 * Forgets the account when its session ends because it was deleted (`Deletion.forgetWhenDeleted`).
 * The root layout mounts it, so it watches from the start.
 */
export const useForgetWhenDeleted = () => useAtomMount(forgetWhenDeleted);

/** The device check's two steps (design/spikes/passkey-prf.md). */
export const checkCreate = runtime.fn<void>()(() => PasskeyCheck.create);

export const checkAssert = runtime.fn<void>()(() => PasskeyCheck.assert);
