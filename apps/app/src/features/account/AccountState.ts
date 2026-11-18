import { useAtomSet, useAtomValue } from "@effect/atom-react";
import type { Access } from "@stu/api/Access";
import { CryptoSuite } from "@stu/e2ee";
import { SyncClient, SyncQuery } from "@stu/sync/client";
import * as Effect from "effect/Effect";
import * as Equal from "effect/Equal";
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
import { Passkeys } from "../../infra/passkeys/Passkeys.ts";
import { layer as authenticator } from "../../infra/passkeys/platform.ts";
import { AccountEngine } from "../../infra/runtime/AccountEngine.ts";
import { Layers } from "../../infra/runtime/Layers.ts";
import { Offered } from "../keys/Offered.ts";
import { Account } from "./Account.ts";
import { PasskeyCheck } from "./PasskeyCheck.ts";

// The account flows as atoms for the screens, on this device's layers. Each sign-in hands over the
// tab's "Öffentlicher Computer" choice (`publicComputer`).

export * as AccountState from "./AccountState.ts";

const runtime = Atom.runtime(
  Layer.mergeAll(
    authenticator,
    CryptoSuite.layer,
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

const attempting = runtime
  .atom(
    Stream.unwrap(
      Effect.map(SessionStore.Service, ({ attempting }) => SubscriptionRef.changes(attempting)),
    ),
  )
  .pipe(Atom.keepAlive);

/**
 * Whether a sign-in or sign-up runs on this device (`Account.attempt`): the screens then start
 * none, and the "Öffentlicher Computer" choice stays as that attempt read it.
 */
export const useAttempting = () => AsyncResult.getOrElse(useAtomValue(attempting), () => false);

/**
 * The tab's choice when a sign-in starts. Read without a dependency: a change must not run the
 * sign-in again.
 */
const chosen = (get: Atom.FnContext) => get.registry.get(publicComputer);

// Each sign-in runs as the device's one attempt (`Account.attempt`). A second call of its atom
// must meet that refusal rather than interrupt the first, so these atoms run `concurrent`. A run
// then outlives its atom's context, so what it hands on goes through the registry (`handOver`).
const oneAttempt = { concurrent: true };

const handOver = <W>(get: Atom.FnContext, atom: Atom.Writable<unknown, W>, value: W) =>
  Effect.sync(() => get.registry.set(atom, value));

export const signIn = runtime.fn<{ readonly email: string; readonly password: string }>()(
  ({ email, password }, get) => Account.attempt(Account.signIn(email, password, chosen(get))),
  oneAttempt,
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
}>()(
  ({ email, code, password }, get) =>
    Account.attempt(Account.resetPassword(email, code, password, chosen(get))),
  oneAttempt,
);

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
  .fn<{ readonly email: string; readonly withPasskey: boolean }>()(
    ({ email, withPasskey }, get) =>
      // The PRF output goes to `OfferedPrf` only: this atom stays alive and keeps what it returns.
      Effect.flatMap(Account.attempt(Account.finish(email, withPasskey, chosen(get))), (used) =>
        handOver(get, Offered.prf, used),
      ),
    oneAttempt,
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
export const signInWithPasskey = runtime.fn<void>()(
  (_, get) =>
    Effect.tap(Account.attempt(Account.signInWithPasskey(chosen(get))), (used) =>
      handOver(get, Offered.prf, Option.some(used)),
    ),
  oneAttempt,
);

// The sign-ups without an address and the card's sign-in hand their secrets to `Offered` only:
// these atoms stay alive while their screen goes, and keep what they return.

const offerCard = (get: Atom.FnContext): Account.Offer => ({
  give: (card) => handOver(get, Offered.card, Option.some(card)),
  withdraw: (card) => Effect.sync(() => get.registry.update(Offered.card, Offered.withdraw(card))),
});

/** An account without an address, made with its Notfallkarte (`Account.signUpWithCard`). */
export const signUpWithCard = runtime
  .fn<Access.Reservation>()(
    (reservation, get) =>
      Account.attempt(Account.signUpWithCard(reservation, chosen(get), offerCard(get))),
    oneAttempt,
  )
  .pipe(Atom.keepAlive);

/** An account without an address, made with a passkey (`Account.signUpWithPasskey`). */
export const signUpWithPasskey = runtime
  .fn<Access.Reservation>()(
    (reservation, get) =>
      Effect.flatMap(
        Account.attempt(Account.signUpWithPasskey(reservation, offerCard(get))),
        (used) => handOver(get, Offered.prf, Option.some(used)),
      ),
    oneAttempt,
  )
  .pipe(Atom.keepAlive);

/** "Mit Notfallkarte anmelden": the card signs in, then opens the notebook. */
export const signInWithCard = runtime
  .fn<string>()(
    (typed, get) =>
      Effect.asVoid(Account.attempt(Account.signInWithCard(typed, chosen(get), offerCard(get)))),
    oneAttempt,
  )
  .pipe(Atom.keepAlive);

/** Whether this device can keep a passkey of its own, which decides how a sign-up starts. */
export const passkeysHere = runtime.atom(
  Effect.flatMap(Passkeys.Authenticator, (passkeys) => passkeys.available),
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
 * It runs as the device's one attempt, so a sign-in under way can't keep its session after it.
 */
export const signOut = runtime
  .fn<Option.Option<AccountEngine.Unsent>>()((unsent, get) =>
    Account.signOut(({ accountId, publicComputer }, forgetSession) => {
      // Before the session goes, which is when the gates move on.
      const signedOutHere = Effect.andThen(
        Effect.sync(() => {
          get.set(signedOut, true);
          get.set(Offered.prf, Option.none());
          get.set(Offered.card, Option.none());
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
      Account.attempt,
    ),
  )
  .pipe(Atom.keepAlive);

/** The device check's two steps (design/spikes/passkey-prf.md). */
export const checkCreate = runtime.fn<void>()(() => PasskeyCheck.create);

export const checkAssert = runtime.fn<void>()(() => PasskeyCheck.assert);
