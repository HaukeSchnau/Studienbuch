import { Access } from "@stu/api/Access";
import { Accounts } from "@stu/api/Accounts";
import { Demo } from "@stu/api/Demo";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { PendingSignUp } from "../../infra/auth/PendingSignUp.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { Device } from "../../infra/device/Device.ts";
import { Passkeys } from "../../infra/passkeys/Passkeys.ts";

// Signing up, in and out on this device. Signing in needs the network once; after that the device
// works on its own data, and an ended session only pauses sync until the same account signs in
// again (D27).

export * as Account from "./Account.ts";

/** Why something didn't work, in words a screen can show (`sentence`). */
export const Reason = Schema.Literals([
  "wrong-password",
  "incomplete",
  "invalid-email",
  "weak-password",
  "sign-up-closed",
  "reservation-refused",
  "wrong-code",
  "password-needed",
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
  "not-fresh",
  "failed",
]);

export type Reason = typeof Reason.Type;

export class Problem extends Schema.TaggedError<Problem, { readonly brand: unique symbol }>()(
  "Account.Problem",
  { reason: Reason },
) {}

export const sentence: Record<Reason, string> = {
  "wrong-password": "E-Mail-Adresse oder Passwort stimmt nicht.",
  incomplete: "Füll bitte alle Felder aus.",
  "invalid-email": "Diese E-Mail-Adresse sieht nicht richtig aus.",
  "weak-password": `Dein Passwort braucht mindestens ${Accounts.minPasswordLength} Zeichen.`,
  "sign-up-closed": "Neue Konten gibt es bald mit dem Zugangscode deiner Schule.",
  "reservation-refused":
    "Dieser Zugangscode lässt sich nicht mehr verwenden. Gib ihn noch einmal ein, oder frag deine Schule nach einem neuen.",
  // The server answers a wrong, spent and expired code alike, so an address without an account
  // can't be told apart. The sentence covers all three.
  "wrong-code": `Der Code stimmt nicht oder gilt nicht mehr. Nach fünf falschen Versuchen und nach ${Accounts.codeMinutes} Minuten brauchst du einen neuen.`,
  "password-needed": "Gib zum Bestätigen dein Passwort noch einmal ein.",
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
  "not-fresh": "Melde dich kurz neu an, dann geht es weiter.",
  failed: "Das hat nicht geklappt. Versuch es noch einmal.",
};

const reasons = new Map<string, Reason>(
  Object.entries({
    INVALID_EMAIL_OR_PASSWORD: "wrong-password",
    VALIDATION_ERROR: "incomplete",
    INVALID_EMAIL: "invalid-email",
    PASSWORD_TOO_SHORT: "weak-password",
    EMAIL_PASSWORD_SIGN_UP_DISABLED: "sign-up-closed",
    [Access.reservationRefused]: "reservation-refused",
    INVALID_OTP: "wrong-code",
    PASSWORD_REQUIRED: "password-needed",
    RATE_LIMITED: "too-many-attempts",
    PASSKEY_NOT_FOUND: "passkey-unknown",
    AUTHENTICATION_FAILED: "passkey-failed",
    FAILED_TO_VERIFY_REGISTRATION: "passkey-failed",
    CHALLENGE_NOT_FOUND: "passkey-failed",
    SESSION_NOT_FRESH: "not-fresh",
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

/**
 * Keeps a new session, so the device is signed in, unless another account holds the device.
 * `demo` marks a demo account's password sign-in (`Demo.isDemoSignIn`).
 */
export const keep = Effect.fn("Account.keep")(function* (signedIn: AuthApi.SignedIn, demo = false) {
  const store = yield* SessionStore.Service;

  yield* refuseOtherAccount(signedIn);
  yield* store
    .signedIn({ ...signedIn, demo })
    .pipe(Effect.mapError(() => new Problem({ reason: "failed" })));
});

export const signIn = Effect.fn("Account.signIn")(function* (email: string, password: string) {
  const api = yield* AuthApi.Service;
  const signedIn = yield* api.signIn(email.trim(), password).pipe(Effect.mapError(problem));

  yield* keep(signedIn, Demo.isDemoSignIn(email, signedIn.accountId));
});

/**
 * Creates the account with a code's reservation. A code goes to `email`, and `confirmEmail` signs
 * the device in with it, setting the password and admitting the account to the code's school.
 */
export const signUp = Effect.fn("Account.signUp")(function* (
  email: string,
  password: string,
  reservation: Access.Reservation,
) {
  const api = yield* AuthApi.Service;

  yield* api
    .signUp(email.trim(), password, Option.some(reservation.token))
    .pipe(Effect.mapError(problem));

  yield* waitForCode(
    Option.some({
      email: email.trim(),
      reservation,
      password: Option.some(Redacted.make(password)),
    }),
  );
});

export const sendCode = Effect.fn("Account.sendCode")(function* (email: string) {
  const api = yield* AuthApi.Service;

  yield* api.sendCode(email.trim()).pipe(Effect.mapError(problem));
});

/** Mails a reset code to `email` if it has an account. The answer doesn't say whether it has. */
export const requestPasswordReset = Effect.fn("Account.requestPasswordReset")(function* (
  email: string,
) {
  const api = yield* AuthApi.Service;

  yield* api.requestPasswordReset(email.trim()).pipe(Effect.mapError(problem));
});

/**
 * Sets a new password with the mailed code, then signs this device in with it. The code alone
 * signs nobody in, and the notebook stays locked on a new device until a passkey or the
 * Notfallkarte opens it.
 */
export const resetPassword = Effect.fn("Account.resetPassword")(function* (
  email: string,
  code: string,
  password: string,
) {
  const api = yield* AuthApi.Service;

  yield* api
    .resetPassword(email.trim(), code.replaceAll(/\D/gu, ""), password)
    .pipe(Effect.mapError(problem));

  yield* signIn(email, password);
});

/** A confirmed address and its new session, waiting for the passkey offer before `keep`. */
export interface Confirmed {
  readonly email: string;
  readonly signedIn: AuthApi.SignedIn;
}

/**
 * The sign-up waiting for its code and the confirmed session waiting for its passkey offer.
 * `finish` and `leave` take turns through `guard`, so a back press during the offer never ends a
 * session the device is keeping.
 */
export class Confirmations extends Context.Service<
  Confirmations,
  {
    readonly current: SubscriptionRef.SubscriptionRef<Option.Option<Confirmed>>;
    readonly guard: Semaphore.Semaphore;
    /** Changed only through `waitForCode`, which keeps it on the device. */
    readonly signingUp: SubscriptionRef.SubscriptionRef<Option.Option<SigningUp>>;
  }
>()("Account.Confirmations") {}

/**
 * A sign-up waiting for its address's code. The device keeps address and reservation, so a
 * reload or a restart comes back to the code. The password stays in this run's memory only: after
 * a restart the code screen asks for it again.
 */
export interface SigningUp {
  readonly email: string;
  readonly reservation: Access.Reservation;
  readonly password: Option.Option<Redacted.Redacted>;
}

const Kept = Schema.fromJsonString(
  Schema.toCodecJson(Schema.Struct({ email: Schema.String, reservation: Access.Reservation })),
);

const decodeKept = Schema.decodeEffect(Kept);
const encodeKept = Schema.encodeEffect(Kept);

/**
 * The sign-up an earlier run kept, unless its reservation expired: then nothing could confirm it,
 * and it goes. So does an entry that doesn't parse, which only another build could have written.
 */
const restore = Effect.gen(function* () {
  const store = yield* PendingSignUp.Store;
  const text = yield* store.get.pipe(Effect.orElseSucceed(() => Option.none<string>()));

  if (Option.isNone(text)) return Option.none<SigningUp>();

  const live = yield* decodeKept(text.value).pipe(
    Effect.flatMap((kept) =>
      Effect.map(DateTime.isFuture(kept.reservation.expiresAt), (future) =>
        future ? Option.some(kept) : Option.none(),
      ),
    ),
    Effect.catchTags({ SchemaError: () => Effect.succeedNone }),
  );

  if (Option.isNone(live)) yield* Effect.ignore(store.remove);

  return Option.map(live, (kept): SigningUp => ({ ...kept, password: Option.none() }));
});

export const confirmations = Layer.effect(Confirmations)(
  Effect.all({
    current: SubscriptionRef.make(Option.none<Confirmed>()),
    guard: Semaphore.make(1),
    signingUp: Effect.flatMap(restore, SubscriptionRef.make),
  }),
);

/** Sets the sign-up waiting for its code, and keeps it on the device without its password. */
const waitForCode = Effect.fn("Account.waitForCode")(function* (next: Option.Option<SigningUp>) {
  const store = yield* PendingSignUp.Store;
  const { signingUp } = yield* Confirmations;

  // A store that refuses costs only the way back after a restart; this run holds it in memory.
  yield* Effect.ignore(
    Option.match(next, {
      onNone: () => store.remove,
      onSome: ({ email, reservation }) =>
        Effect.flatMap(encodeKept({ email, reservation }), store.set),
    }),
  );

  yield* SubscriptionRef.set(signingUp, next);
});

/** Ends the sign-up waiting for its code ("Abbrechen"). The address stays unconfirmed. */
export const cancelSignUp = waitForCode(Option.none());

/**
 * Confirms the address with its code and sets the password: the one this run signed up with or,
 * after a restart, `password` as typed again. The sign-up's reservation admits the account to the
 * code's school. The new session waits for `finish`, so a passkey can come first.
 */
export const confirmEmail = Effect.fn("Account.confirmEmail")(function* (
  email: string,
  code: string,
  password: Option.Option<string> = Option.none(),
) {
  const api = yield* AuthApi.Service;
  const { current, guard, signingUp } = yield* Confirmations;

  const pending = Option.filter(yield* SubscriptionRef.get(signingUp), (waiting) =>
    sameAddress(waiting.email, email),
  );

  const known = Option.isSome(password)
    ? Option.some(Redacted.make(password.value))
    : Option.flatMap(pending, (waiting) => waiting.password);

  if (Option.isNone(known)) return yield* new Problem({ reason: "password-needed" });

  const signedIn = yield* api
    .confirmEmail(
      email.trim(),
      code.replaceAll(/\s/gu, ""),
      known.value,
      Option.map(pending, (waiting) => waiting.reservation.token),
    )
    .pipe(Effect.mapError(problem));

  // Said here, on the code screen, rather than after the passkey offer.
  yield* refuseOtherAccount(signedIn);

  yield* SubscriptionRef.set(current, Option.some({ email: email.trim(), signedIn })).pipe(
    Semaphore.withPermit(guard),
  );

  // Only now, so the code screen always has the sign-up or its confirmed session to show.
  yield* waitForCode(Option.none());
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

  return yield* Effect.gen(function* () {
    const confirmed = yield* Effect.fromOption(
      confirmedFor(yield* SubscriptionRef.get(current), email),
    ).pipe(Effect.mapError(() => new Problem({ reason: "failed" })));

    const added = withPasskey
      ? Option.some(yield* addPasskey(confirmed.signedIn.token))
      : Option.none<{ readonly credentialId: string; readonly prf: Passkeys.CreatedPrf }>();

    yield* keep(confirmed.signedIn);
    yield* SubscriptionRef.set(current, Option.none());

    // A PRF output from the registration waits for the notebook's key, which starts in the tabs.
    return Option.map(added, ({ credentialId, prf }): PasskeyUsed => ({
      accountId: confirmed.signedIn.accountId,
      credentialId,
      prf: prf._tag === "Output" ? Option.some(Redacted.make(prf.output)) : Option.none(),
    }));
  }).pipe(Semaphore.withPermit(guard));
});

/**
 * Settles the session that confirmed `email` when its screen goes and nobody finished it: the
 * device keeps it, as "Später" does. A public computer ends it, so the next person there finds
 * nobody signed in. It waits for a `finish` under way.
 */
export const leave = Effect.fn("Account.leave")(function* (email: string) {
  const api = yield* AuthApi.Service;
  const device = yield* Device.Service;
  const { current, guard } = yield* Confirmations;

  yield* Effect.gen(function* () {
    const unfinished = confirmedFor(yield* SubscriptionRef.get(current), email);

    if (Option.isNone(unfinished)) return;

    const { signedIn } = unfinished.value;
    const end = Effect.ignore(api.signOut(signedIn.token));

    if (device.publicComputer) {
      yield* SubscriptionRef.set(current, Option.none());
      yield* end;

      return;
    }

    // Kept before it leaves `current`, so the screen behind never shows a signed-out step. A
    // session the device can't keep ends on the server too.
    yield* keep(signedIn).pipe(Effect.catchTags({ "Account.Problem": () => end }));
    yield* SubscriptionRef.set(current, Option.none());
  }).pipe(Semaphore.withPermit(guard));
});

/** A passkey ceremony's result: the passkey, and its PRF output, which stays on the device. */
export interface PasskeyUsed {
  readonly accountId: string;
  readonly credentialId: string;
  readonly prf: Option.Option<Redacted.Redacted<Uint8Array>>;
}

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

  const signedIn = yield* api
    .passkeySignIn(challenge, asserted.credential)
    .pipe(Effect.mapError(problem));

  yield* keep(signedIn);

  return {
    accountId: signedIn.accountId,
    credentialId: asserted.credential.id,
    prf: Option.map(asserted.prf, (bytes) => Redacted.make(bytes)),
  } satisfies PasskeyUsed;
});

/**
 * Adds a passkey to the account of a session at most `Keys.freshSignInMinutes` old, and says what
 * it can do for the notebook's unlock.
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

  return { credentialId: created.credential.id, prf: created.prf };
});

/**
 * The PRF output of a passkey that registered without one: one more prompt, for that passkey only
 * ("Bestätige den Passkey noch einmal", recovery.md section 4). Nothing goes to the server.
 */
export const passkeyOutput = Effect.fn("Account.passkeyOutput")(function* (credentialId: string) {
  const api = yield* AuthApi.Service;
  const passkeys = yield* Passkeys.Authenticator;

  const { options } = yield* api.passkeySignInOptions.pipe(Effect.mapError(problem));

  const asserted = yield* passkeys
    .get({ ...options, allowCredentials: [{ id: credentialId, type: "public-key" }] })
    .pipe(Effect.catchTags({ "Passkeys.Failed": (error) => Effect.fail(passkeyProblem(error)) }));

  return Option.map(asserted.prf, (bytes) => Redacted.make(bytes));
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
