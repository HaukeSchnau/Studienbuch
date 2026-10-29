import { Accounts } from "@stu/api/Accounts";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import type * as Redacted from "effect/Redacted";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { Passkeys } from "../../infra/passkeys/Passkeys.ts";

// Signing up, in and out on this device. Signing in needs the network once; after that the device
// works on its own data, and an ended session only pauses sync until the same account signs in
// again (D27).

export * as Account from "./Account.ts";

/** Why something didn't work, in words a screen can show (`sentence`). */
export const Reason = Schema.Literals([
  "wrong-password",
  "email-unconfirmed",
  "incomplete",
  "invalid-email",
  "weak-password",
  "sign-up-closed",
  "wrong-code",
  "code-expired",
  "too-many-attempts",
  "offline",
  "server-error",
  "other-account",
  "passkey-unknown",
  "passkey-unsupported",
  "passkey-registered",
  "passkey-none",
  "passkey-no-biometrics",
  "passkey-failed",
  "failed",
]);

export type Reason = typeof Reason.Type;

export class Problem extends Schema.TaggedError<Problem, { readonly brand: unique symbol }>()(
  "Account.Problem",
  { reason: Reason },
) {}

export const sentence: Record<Reason, string> = {
  "wrong-password": "E-Mail-Adresse oder Passwort stimmt nicht.",
  "email-unconfirmed": "Bestätige zuerst deine E-Mail-Adresse.",
  incomplete: "Füll bitte alle Felder aus.",
  "invalid-email": "Diese E-Mail-Adresse sieht nicht richtig aus.",
  "weak-password": `Dein Passwort braucht mindestens ${Accounts.minPasswordLength} Zeichen.`,
  "sign-up-closed": "Neue Konten gibt es bald mit dem Zugangscode deiner Schule.",
  "wrong-code": "Der Code stimmt nicht. Schau noch einmal in die E-Mail.",
  "code-expired": "Der Code ist abgelaufen. Lass dir einen neuen schicken.",
  "too-many-attempts": "Zu viele Versuche. Warte kurz und versuch es dann noch einmal.",
  offline: "Keine Verbindung zum Server. Zum Anmelden brauchst du einmal Internet.",
  "server-error": "Beim Server ist gerade etwas schiefgelaufen. Versuch es gleich noch einmal.",
  "other-account":
    "Auf diesem Gerät ist noch ein anderes Konto angemeldet. Melde es zuerst ab, damit seine Daten nicht verloren gehen.",
  "passkey-unknown": "Diesen Passkey kennt Studienbuch nicht. Melde dich mit deinem Passwort an.",
  "passkey-unsupported": "Dieses Gerät kann hier keine Passkeys nutzen.",
  "passkey-registered": "Dieser Passkey gehört schon zu deinem Konto.",
  "passkey-none":
    "Auf diesem Gerät gibt es keinen Passkey für Studienbuch. Melde dich mit deinem Passwort an.",
  "passkey-no-biometrics":
    "Für einen Passkey braucht dein Gerät Face ID oder Touch ID. Richte es in den Einstellungen ein.",
  "passkey-failed": "Mit dem Passkey hat es nicht geklappt. Versuch es noch einmal.",
  failed: "Das hat nicht geklappt. Versuch es noch einmal.",
};

const reasons = new Map<string, Reason>(
  Object.entries({
    INVALID_EMAIL_OR_PASSWORD: "wrong-password",
    EMAIL_NOT_VERIFIED: "email-unconfirmed",
    VALIDATION_ERROR: "incomplete",
    INVALID_EMAIL: "invalid-email",
    PASSWORD_TOO_SHORT: "weak-password",
    EMAIL_PASSWORD_SIGN_UP_DISABLED: "sign-up-closed",
    INVALID_OTP: "wrong-code",
    OTP_EXPIRED: "code-expired",
    TOO_MANY_ATTEMPTS: "too-many-attempts",
    RATE_LIMITED: "too-many-attempts",
    PASSKEY_NOT_FOUND: "passkey-unknown",
    AUTHENTICATION_FAILED: "passkey-failed",
    FAILED_TO_VERIFY_REGISTRATION: "passkey-failed",
    CHALLENGE_NOT_FOUND: "passkey-failed",
  } satisfies Record<string, Reason>),
);

const problem = (error: AuthApi.Refused | AuthApi.Unreachable | AuthApi.ServerFailed) =>
  new Problem({
    reason:
      error._tag === "AuthApi.Unreachable"
        ? "offline"
        : error._tag === "AuthApi.ServerFailed"
          ? "server-error"
          : (reasons.get(error.code) ?? "failed"),
  });

const passkeyReasons: Record<Passkeys.Failed["reason"], Reason> = {
  unsupported: "passkey-unsupported",
  "already-registered": "passkey-registered",
  "no-passkey": "passkey-none",
  "no-biometrics": "passkey-no-biometrics",
  failed: "passkey-failed",
};

const passkeyProblem = (error: Passkeys.Failed) =>
  new Problem({ reason: passkeyReasons[error.reason] });

/**
 * Refuses a new session while the device still holds another account whose session ended: its
 * database may hold changes that never reached the server, so that account signs out first. The
 * refused session ends on the server.
 */
const refuseOtherAccount = Effect.fn("Account.refuseOtherAccount")(function* (
  signedIn: AuthApi.SignedIn,
) {
  const store = yield* SessionStore.Service;
  const api = yield* AuthApi.Service;
  const current = yield* store.current;

  if (Option.exists(current, (signed) => signed.accountId !== signedIn.accountId)) {
    yield* Effect.ignore(api.signOut(signedIn.token));

    return yield* new Problem({ reason: "other-account" });
  }
});

/** Keeps a new session, so the device is signed in, unless another account holds the device. */
export const keep = Effect.fn("Account.keep")(function* (signedIn: AuthApi.SignedIn) {
  const store = yield* SessionStore.Service;

  yield* refuseOtherAccount(signedIn);
  yield* store.signedIn(signedIn).pipe(Effect.mapError(() => new Problem({ reason: "failed" })));
});

export const signIn = Effect.fn("Account.signIn")(function* (email: string, password: string) {
  const api = yield* AuthApi.Service;

  yield* keep(yield* api.signIn(email.trim(), password).pipe(Effect.mapError(problem)));
});

/** Creates the account. A code goes to `email`, and `confirmEmail` signs the device in with it. */
export const signUp = Effect.fn("Account.signUp")(function* (email: string, password: string) {
  const api = yield* AuthApi.Service;

  yield* api.signUp(email.trim(), password).pipe(Effect.mapError(problem));
});

export const sendCode = Effect.fn("Account.sendCode")(function* (email: string) {
  const api = yield* AuthApi.Service;

  yield* api.sendCode(email.trim()).pipe(Effect.mapError(problem));
});

/** A confirmed address and its new session, waiting for the passkey offer before `keep`. */
export interface Confirmed {
  readonly email: string;
  readonly signedIn: AuthApi.SignedIn;
}

/**
 * The confirmed session waiting for its passkey offer. `finish` and `abandon` take turns through
 * `guard`, so a back press during the offer never ends a session the device is keeping.
 */
export class Confirmations extends Context.Service<
  Confirmations,
  {
    readonly current: SubscriptionRef.SubscriptionRef<Option.Option<Confirmed>>;
    readonly guard: Semaphore.Semaphore;
  }
>()("Account.Confirmations") {}

export const confirmations = Layer.effect(Confirmations)(
  Effect.all({
    current: SubscriptionRef.make(Option.none<Confirmed>()),
    guard: Semaphore.make(1),
  }),
);

/** Confirms the address with its code. The new session waits for `finish`, so a passkey can come first. */
export const confirmEmail = Effect.fn("Account.confirmEmail")(function* (
  email: string,
  code: string,
) {
  const api = yield* AuthApi.Service;
  const { current, guard } = yield* Confirmations;

  const signedIn = yield* api
    .confirmEmail(email.trim(), code.replaceAll(/\s/gu, ""))
    .pipe(Effect.mapError(problem));

  // Said here, on the code screen, rather than after the passkey offer.
  yield* refuseOtherAccount(signedIn);

  yield* SubscriptionRef.set(current, Option.some({ email: email.trim(), signedIn })).pipe(
    Semaphore.withPermit(guard),
  );
});

const sameAddress = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** The confirmed session waiting for its passkey offer, if it belongs to `email`. */
export const confirmedFor = (pending: Option.Option<Confirmed>, email: string) =>
  Option.filter(pending, (confirmed) => sameAddress(confirmed.email, email));

/**
 * Signs the device in with the session that confirmed `email`, adding a passkey first when
 * `withPasskey`. Refuses when the waiting session belongs to another address, so a shared device
 * never signs in as, or adds a passkey for, the person who confirmed before.
 */
export const finish = Effect.fn("Account.finish")(function* (email: string, withPasskey: boolean) {
  const { current, guard } = yield* Confirmations;

  yield* Effect.gen(function* () {
    const confirmed = yield* Effect.fromOption(
      confirmedFor(yield* SubscriptionRef.get(current), email),
    ).pipe(Effect.mapError(() => new Problem({ reason: "failed" })));

    if (withPasskey) yield* addPasskey(confirmed.signedIn.token);

    yield* keep(confirmed.signedIn);
    yield* SubscriptionRef.set(current, Option.none());
  }).pipe(Semaphore.withPermit(guard));
});

/**
 * Ends the session that confirmed `email` when its screen goes and nobody finished it. It waits
 * for a `finish` under way, whose session the device keeps.
 */
export const abandon = Effect.fn("Account.abandon")(function* (email: string) {
  const api = yield* AuthApi.Service;
  const { current, guard } = yield* Confirmations;

  yield* Effect.gen(function* () {
    const unfinished = confirmedFor(yield* SubscriptionRef.get(current), email);

    if (Option.isNone(unfinished)) return;

    yield* SubscriptionRef.set(current, Option.none());
    yield* Effect.ignore(api.signOut(unfinished.value.signedIn.token));
  }).pipe(Semaphore.withPermit(guard));
});

/**
 * Signs in with any passkey of this server. The PRF output stays on the device for the notebook's
 * unlock (recovery.md, section 2).
 */
export const signInWithPasskey = Effect.fn("Account.signInWithPasskey")(function* () {
  const api = yield* AuthApi.Service;
  const passkeys = yield* Passkeys.Authenticator;

  const { options, challenge } = yield* api.passkeySignInOptions.pipe(Effect.mapError(problem));

  const asserted = yield* passkeys
    .get(options)
    .pipe(Effect.catchTags({ "Passkeys.Failed": (error) => Effect.fail(passkeyProblem(error)) }));

  yield* keep(
    yield* api.passkeySignIn(challenge, asserted.credential).pipe(Effect.mapError(problem)),
  );

  return asserted.prf;
});

/**
 * Adds a passkey to the account of a session less than a day old, and says what it can do for the
 * notebook's unlock.
 */
export const addPasskey = Effect.fn("Account.addPasskey")(function* (token: Redacted.Redacted) {
  const api = yield* AuthApi.Service;
  const passkeys = yield* Passkeys.Authenticator;

  const { options, challenge } = yield* api
    .passkeyCreationOptions(token)
    .pipe(Effect.mapError(problem));

  const created = yield* passkeys
    .create(options)
    .pipe(Effect.catchTags({ "Passkeys.Failed": (error) => Effect.fail(passkeyProblem(error)) }));

  yield* api.addPasskey(token, challenge, created.credential).pipe(Effect.mapError(problem));

  return created.prf;
});

/**
 * Signs this device out: `forget` deletes the account's database, secrets and session
 * (`Layers.forget`), then the server ends the session. Offline the device still forgets
 * everything, and the session runs out on the server. The caller asks first when the outbox isn't
 * empty (`unsentWarning`).
 */
export const signOut = Effect.fn("Account.signOut")(function* <E, R>(
  forget: (accountId: string) => Effect.Effect<void, E, R>,
) {
  const store = yield* SessionStore.Service;
  const api = yield* AuthApi.Service;
  const confirmations = yield* Confirmations;
  const current = yield* store.current;

  yield* SubscriptionRef.set(confirmations.current, Option.none());

  if (Option.isNone(current)) return;

  yield* forget(current.value.accountId).pipe(Effect.orDie);
  yield* store.forget.pipe(Effect.orDie);
  yield* Effect.ignore(
    Option.match(current.value.token, { onNone: () => Effect.void, onSome: api.signOut }),
  );
});

/** What signing out would lose: "3 Änderungen sind noch nicht übertragen", or none. */
export const unsentWarning = (pending: number): Option.Option<string> =>
  pending === 0
    ? Option.none()
    : Option.some(
        pending === 1
          ? "1 Änderung ist noch nicht übertragen."
          : `${pending} Änderungen sind noch nicht übertragen.`,
      );

/**
 * What the device can show: an account with a live session, one whose session ended (its data
 * stays, and "Anmelden" brings sync back), none, or none possible because the build has no server
 * or the keychain is locked.
 */
export type Access = "loading" | "unavailable" | "signed-out" | "signed-in" | "ended";

export const access = (
  current: AsyncResult.AsyncResult<Option.Option<SessionStore.Signed>, unknown>,
): Access =>
  AsyncResult.match(current, {
    onInitial: () => "loading",
    onFailure: () => "unavailable",
    onSuccess: ({ value }) =>
      Option.match(value, {
        onNone: () => "signed-out",
        onSome: (signed) => (Option.isSome(signed.token) ? "signed-in" : "ended"),
      }),
  });
