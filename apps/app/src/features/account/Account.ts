import { Access } from "@stu/api/Access";
import { Accounts } from "@stu/api/Accounts";
import { Demo } from "@stu/api/Demo";
import { RecoveryCode } from "@stu/e2ee";
import * as Arr from "effect/Array";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as Redacted from "effect/Redacted";
import * as AsyncResult from "effect/reactivity/AsyncResult";
import * as Ref from "effect/Ref";
import * as Schema from "effect/Schema";
import * as Semaphore from "effect/Semaphore";
import * as SubscriptionRef from "effect/SubscriptionRef";

import { AuthApi } from "../../infra/auth/AuthApi.ts";
import { PendingSignUp } from "../../infra/auth/PendingSignUp.ts";
import { SessionStore } from "../../infra/auth/SessionStore.ts";
import { DeviceSessions } from "../../infra/keychain/DeviceSessions.ts";
import { Keychain } from "../../infra/keychain/Keychain.ts";
import { Passkeys } from "../../infra/passkeys/Passkeys.ts";
import { Forgetting } from "../../infra/runtime/Forgetting.ts";
import { NotebookKeys } from "../keys/NotebookKeys.ts";

// Signing up, in and out on this device. Signing in needs the network once; after that the device
// works on its own data, and an ended session only pauses sync until the same account signs in
// again (D27).

export * as Account from "./Account.ts";

/** Why something didn't work, in words a screen can show (`sentence`). */
export const Reason = Schema.Literals([
  "wrong-password",
  "invalid-email",
  "weak-password",
  "sign-up-closed",
  "reservation-refused",
  "wrong-code",
  "password-needed",
  "password-mismatch",
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
  "unknown-card",
  "card-not-kept",
  "busy",
  "sign-out-failed",
  "failed",
]);

export type Reason = typeof Reason.Type;

export class Problem extends Schema.TaggedError<Problem, { readonly brand: unique symbol }>()(
  "Account.Problem",
  { reason: Reason },
) {}

export const sentence: Record<Reason, string> = {
  "wrong-password": "E-Mail-Adresse oder Passwort stimmt nicht.",
  "invalid-email":
    "Diese E-Mail-Adresse sieht nicht richtig aus. Sie braucht ein @ und eine Domain wie schule.de.",
  "weak-password": `Dein Passwort braucht mindestens ${Accounts.minPasswordLength} Zeichen.`,
  "sign-up-closed": "Neue Konten gibt es bald mit dem Zugangscode deiner Schule.",
  "reservation-refused":
    "Dieser Zugangscode lässt sich nicht mehr verwenden. Gib ihn noch einmal ein, oder frag deine Schule nach einem neuen.",
  // The server answers a wrong, spent and expired code alike, so an address without an account
  // can't be told apart. The sentence covers all three.
  "wrong-code": `Der Code stimmt nicht oder gilt nicht mehr. Nach fünf falschen Versuchen und nach ${Accounts.codeMinutes} Minuten brauchst du einen neuen.`,
  "password-needed":
    "Gib zum Bestätigen das Passwort ein, das du beim Konto erstellen gewählt hast.",
  "password-mismatch":
    "Das ist nicht das Passwort, das du beim Konto erstellen gewählt hast. Der Code gilt weiter.",
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
  "unknown-card":
    "Diese Notfallkarte gehört zu keinem Konto. Vielleicht hast du sie durch eine neue ersetzt.",
  "card-not-kept":
    "Dieses Gerät konnte deine Notfallkarte gerade nicht speichern. Ohne sie geht es nicht weiter. Versuch es noch einmal.",
  busy: "Auf diesem Gerät läuft schon eine Anmeldung. Warte, bis sie fertig ist.",
  "sign-out-failed": "Abmelden hat nicht geklappt. Versuch es noch einmal.",
  failed: "Das hat nicht geklappt. Versuch es noch einmal.",
};

const reasons = new Map<string, Reason>(
  Object.entries({
    INVALID_EMAIL_OR_PASSWORD: "wrong-password",
    // Better Auth checks a sign-up's address more strictly than `Accounts.Address`, and the app
    // sends no empty field.
    VALIDATION_ERROR: "invalid-email",
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
    [Accounts.unknownCard]: "unknown-card",
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
 * database may hold changes that never reached the server, so that account signs out first.
 */
const refuseOther = (
  held: Option.Option<SessionStore.Signed>,
  signedIn: AuthApi.SignedIn,
): Effect.Effect<void, Problem> =>
  Option.exists(held, (signed) => signed.accountId !== signedIn.accountId)
    ? Effect.fail(new Problem({ reason: "other-account" }))
    : Effect.void;

/** Ends a session the device didn't keep, so it doesn't wait on the server for 90 days. */
const endUnkept = (signedIn: AuthApi.SignedIn) =>
  Effect.flatMap(AuthApi.Service, (api) => Effect.ignore(api.signOut(signedIn.token)));

/** `refuseOther` before the session is kept, so a screen can say it early. */
const refuseOtherAccount = Effect.fn("Account.refuseOtherAccount")(function* (
  signedIn: AuthApi.SignedIn,
) {
  const store = yield* SessionStore.Service;

  yield* refuseOther(yield* store.current, signedIn).pipe(
    Effect.tapError(() => endUnkept(signedIn)),
  );
});

/** Refuses a sign-up while the device holds an account, before anything leaves the device. */
const refuseAnyAccount = Effect.flatMap(SessionStore.Service, (store) =>
  Effect.flatMap(store.current, (current) =>
    Option.isSome(current) ? Effect.fail(new Problem({ reason: "other-account" })) : Effect.void,
  ),
);

/**
 * Keeps a new session in the turn that installs sessions (`Forgetting.Service`), after any
 * sign-out under way or left unfinished. That turn refuses another account, so two sign-ins never
 * both keep one, and fixes where the session goes (`SessionStore.publicComputerFor`). `first`
 * stores what the session needs there, before it. `demo` marks a persona (`Demo.isDemoSignIn`).
 */
export const keep = Effect.fn("Account.keep")(function* <R = never>(
  signedIn: AuthApi.SignedIn,
  chosen: boolean,
  demo = false,
  first: (publicComputer: boolean) => Effect.Effect<void, Problem, R> = () => Effect.void,
) {
  const store = yield* SessionStore.Service;
  const forgetting = yield* Forgetting.Service;
  const failed = () => Effect.fail(new Problem({ reason: "failed" }));

  const install = Effect.gen(function* () {
    const held = yield* store.current;
    const publicComputer = SessionStore.publicComputerFor(held, signedIn.accountId, chosen);

    yield* refuseOther(held, signedIn);
    yield* first(publicComputer);
    yield* store.signedIn({ ...signedIn, demo }, publicComputer);
  });

  yield* forgetting.keep(install).pipe(
    Effect.catchTags({ "Forgetting.Unfinished": failed, "Keychain.Unavailable": failed }),
    Effect.tapError((problem) =>
      problem.reason === "other-account" ? endUnkept(signedIn) : Effect.void,
    ),
  );
});

export const signIn = Effect.fn("Account.signIn")(function* (
  email: string,
  password: string,
  publicComputer: boolean,
) {
  const api = yield* AuthApi.Service;
  const signedIn = yield* api.signIn(email.trim(), password).pipe(Effect.mapError(problem));

  yield* keep(signedIn, publicComputer, Demo.isDemoSignIn(email, signedIn.accountId));
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

  yield* checkAddress(email);
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

// Said before the server is asked, which answers a reset request for no address as for any.
const checkAddress = (email: string) =>
  Accounts.isAddress(email.trim())
    ? Effect.void
    : Effect.fail(new Problem({ reason: "invalid-email" }));

export const sendCode = Effect.fn("Account.sendCode")(function* (email: string) {
  const api = yield* AuthApi.Service;

  yield* api.sendCode(email.trim()).pipe(Effect.mapError(problem));
});

/** Mails a reset code to `email` if it has an account. The answer doesn't say whether it has. */
export const requestPasswordReset = Effect.fn("Account.requestPasswordReset")(function* (
  email: string,
) {
  const api = yield* AuthApi.Service;

  yield* checkAddress(email);
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
  publicComputer: boolean,
) {
  const api = yield* AuthApi.Service;

  yield* api
    .resetPassword(email.trim(), code.replaceAll(/\D/gu, ""), password)
    .pipe(Effect.mapError(problem));

  yield* signIn(email, password, publicComputer);
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
    /**
     * A card-first sign-up's card, until its session is kept, so a retry sends it in either
     * place. A device that keeps its session stages it too (`DeviceSessions.stage`).
     */
    readonly newCard: Ref.Ref<Option.Option<Redacted.Redacted<Uint8Array>>>;
    /**
     * A passkey sign-up whose card the device couldn't hold, so a retry keeps its account rather
     * than making another. It lives in this run only: after a restart the passkey signs in.
     */
    readonly newPasskeyAccount: Ref.Ref<Option.Option<PasskeyAccount>>;
  }
>()("Account.Confirmations") {}

/**
 * Runs a sign-in, a sign-up, an account's confirmation or a sign-out as the device's one attempt
 * (`SessionStore.attempting`). Another one meanwhile is refused, never queued, and the screens
 * offer none, nor the "Öffentlicher Computer" choice, which the attempt read when it started.
 */
export const attempt = <A, E, R>(effect: Effect.Effect<A, E, R>) =>
  Effect.flatMap(SessionStore.Service, ({ attempting }) =>
    Effect.acquireUseRelease(
      SubscriptionRef.modify(attempting, (running) => [!running, true] as const),
      (mine): Effect.Effect<A, E | Problem, R> =>
        mine ? effect : Effect.fail(new Problem({ reason: "busy" })),
      (mine) => (mine ? SubscriptionRef.set(attempting, false) : Effect.void),
    ),
  );

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
    newCard: Ref.make(Option.none<Redacted.Redacted<Uint8Array>>()),
    newPasskeyAccount: Ref.make(Option.none<PasskeyAccount>()),
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
 * Confirms the address with its code and the password: the one this run signed up with or, after
 * a restart, `password` as typed again, which must be the one this sign-up chose (D88).
 * The sign-up's reservation admits the account to the code's school. The new session waits for
 * `finish`, so a passkey can come first.
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
    .pipe(
      Effect.mapError((error) => {
        const found = problem(error);

        return found.reason === "wrong-password"
          ? new Problem({ reason: "password-mismatch" })
          : found;
      }),
    );

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
export const finish = Effect.fn("Account.finish")(function* (
  email: string,
  withPasskey: boolean,
  publicComputer: boolean,
) {
  const { current, guard } = yield* Confirmations;

  return yield* Effect.gen(function* () {
    const confirmed = yield* Effect.fromOption(
      confirmedFor(yield* SubscriptionRef.get(current), email),
    ).pipe(Effect.mapError(() => new Problem({ reason: "failed" })));

    const added = withPasskey
      ? Option.some(yield* addPasskey(confirmed.signedIn.token, publicComputer))
      : Option.none<{ readonly credentialId: string; readonly prf: Passkeys.CreatedPrf }>();

    yield* keep(confirmed.signedIn, publicComputer);
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
export const leave = Effect.fn("Account.leave")(function* (email: string, publicComputer: boolean) {
  const api = yield* AuthApi.Service;
  const { current, guard } = yield* Confirmations;

  yield* Effect.gen(function* () {
    const unfinished = confirmedFor(yield* SubscriptionRef.get(current), email);

    if (Option.isNone(unfinished)) return;

    const { signedIn } = unfinished.value;
    const end = Effect.ignore(api.signOut(signedIn.token));

    if (publicComputer) {
      yield* SubscriptionRef.set(current, Option.none());
      yield* end;

      return;
    }

    // Kept before it leaves `current`, so the screen behind never shows a signed-out step. A
    // session the device can't keep ends on the server too.
    yield* keep(signedIn, false).pipe(Effect.catchTags({ "Account.Problem": () => end }));
    yield* SubscriptionRef.set(current, Option.none());
  }).pipe(Semaphore.withPermit(guard));
});

/**
 * A Notfallkarte for an account's key state: a new account's, which the card step shows
 * (`unsaved`), or one that signed in.
 */
export interface OfferedCard extends NotebookKeys.CardIn {
  readonly accountId: string;
}

/**
 * Hands a card in memory to the account's key status (`Offered.card`). A sign-in whose session
 * isn't kept takes back the card it handed, and only that one.
 */
export interface Offer {
  readonly give: (card: OfferedCard) => Effect.Effect<void>;
  readonly withdraw: (card: OfferedCard) => Effect.Effect<void>;
}

/**
 * Keeps a session that came with a card, which goes where the session goes. A device that keeps
 * its session first holds the card in the account's secrets, so no restart finds the account
 * without it, and keeps nothing if it can't (`card-not-kept`). `offer` tells the account's key
 * status, and is the only copy on a public computer.
 */
const keepWithCard = Effect.fn("Account.keepWithCard")(function* (
  signedIn: AuthApi.SignedIn,
  card: OfferedCard,
  chosen: boolean,
  offer: Offer,
) {
  const hold = (publicComputer: boolean) =>
    Effect.andThen(
      publicComputer
        ? Effect.void
        : NotebookKeys.holdCard(card).pipe(
            Effect.provide(Keychain.accountSecrets(card.accountId)),
            Effect.catchTags({ "DeviceSecrets.SecretsUnavailable": () => cardNotKept }),
          ),
      offer.give(card),
    );

  yield* keep(signedIn, chosen, false, hold).pipe(Effect.onError(() => offer.withdraw(card)));
});

const cardNotKept = Effect.fail(new Problem({ reason: "card-not-kept" }));

/**
 * Creates an account without an address whose Notfallkarte signs up, on a device without
 * passkeys. The card is staged before the request goes out and stays until the session is kept,
 * so a retry after a lost answer, even after a restart, signs in to the account it made rather
 * than making a second one. A device that can't stage it sends nothing (`card-not-kept`).
 */
export const signUpWithCard = Effect.fn("Account.signUpWithCard")(function* (
  reservation: Access.Reservation,
  publicComputer: boolean,
  offer: Offer,
) {
  const api = yield* AuthApi.Service;
  const sessions = yield* DeviceSessions.Service;
  const forgetting = yield* Forgetting.Service;
  const { newCard } = yield* Confirmations;

  // In a turn after any sign-out the device left unfinished, which removes a card staged here.
  const code = yield* forgetting
    .keep(
      Effect.gen(function* () {
        yield* refuseAnyAccount;

        // A retry in either place sends the card this tab or an earlier run took, so it reaches
        // the account a lost answer made. A public computer then removes a staged copy before
        // anything goes out, so nothing of it stays once the tab is gone.
        const staged = yield* sessions.staged;
        const earlier = Option.orElse(yield* Ref.get(newCard), () => staged);
        const code = Option.isSome(earlier) ? earlier.value : (yield* RecoveryCode.generate).bytes;

        yield* Ref.set(newCard, Option.some(code));

        if (!publicComputer) yield* sessions.stage(code);
        else if (Option.isSome(staged)) yield* sessions.unstage;

        return code;
      }).pipe(Effect.catchTags({ "Keychain.Unavailable": () => cardNotKept })),
    )
    .pipe(
      Effect.catchTags({
        "Forgetting.Unfinished": () => Effect.fail(new Problem({ reason: "failed" })),
        "Keychain.Unavailable": () => Effect.fail(new Problem({ reason: "failed" })),
      }),
    );

  const signedIn = yield* api
    .cardSignUp(yield* NotebookKeys.cardLogin(code), reservation.token)
    .pipe(Effect.mapError(problem));

  // Keeping the session drops the staged card (`DeviceSessions.set`).
  yield* keepWithCard(
    signedIn,
    { accountId: signedIn.accountId, code, endsAtSaved: false, unsaved: true },
    publicComputer,
    offer,
  ).pipe(Effect.onError(() => endUnkept(signedIn)));

  yield* Ref.set(newCard, Option.none());
});

/** A passkey sign-up's new account and its card, until the device keeps them. */
export interface PasskeyAccount {
  readonly signedIn: AuthApi.SignedIn;
  readonly code: Redacted.Redacted<Uint8Array>;
  readonly used: PasskeyUsed;
}

/** The passkey prompt that makes the account, and the account's new card. */
const passkeyAccount = Effect.fn("Account.passkeyAccount")(function* (
  reservation: Access.Reservation,
) {
  const api = yield* AuthApi.Service;
  const passkeys = yield* Passkeys.Authenticator;

  yield* refuseAnyAccount;

  const { options, challenge } = yield* api
    .passkeySignUpOptions(reservation.token)
    .pipe(Effect.mapError(problem));

  const created = yield* passkeys
    .create(options)
    .pipe(Effect.catchTags({ "Passkeys.Failed": (error) => Effect.fail(passkeyProblem(error)) }));

  const signedIn = yield* api
    .passkeySignUp(reservation.token, challenge, created.credential)
    .pipe(Effect.mapError(problem));

  const { bytes: code } = yield* RecoveryCode.generate;

  return {
    signedIn,
    code,
    used: {
      accountId: signedIn.accountId,
      credentialId: created.credential.id,
      prf:
        created.prf._tag === "Output"
          ? Option.some(Redacted.make(created.prf.output))
          : Option.none(),
    },
  } satisfies PasskeyAccount;
});

/**
 * Creates an account without an address with a passkey, in one prompt, and gives it a new
 * Notfallkarte as its way back. The PRF output waits for the notebook's key, as at sign-in. The
 * card isn't a way in until its wrapper reaches the server, so it needs no stage before the
 * request; a retry after the device couldn't hold it keeps the same account.
 */
export const signUpWithPasskey = Effect.fn("Account.signUpWithPasskey")(function* (
  reservation: Access.Reservation,
  offer: Offer,
) {
  const { newPasskeyAccount } = yield* Confirmations;
  const earlier = yield* Ref.get(newPasskeyAccount);
  const made = Option.isSome(earlier) ? earlier.value : yield* passkeyAccount(reservation);

  yield* Ref.set(newPasskeyAccount, Option.some(made));

  // A passkey stays on this device, so this is never a public computer (`Account.addPasskey`).
  yield* keepWithCard(
    made.signedIn,
    { accountId: made.signedIn.accountId, code: made.code, endsAtSaved: true, unsaved: true },
    false,
    offer,
  );

  yield* Ref.set(newPasskeyAccount, Option.none());

  return made.used;
});

/**
 * "Mit Notfallkarte anmelden", for an account without an address. A typo stops before anything
 * leaves the device. The card then goes to the account's key state, which opens the notebook with
 * it, or gives the account's first key its wrapper (`NotebookKeys.settle`). Answers the account.
 */
export const signInWithCard = Effect.fn("Account.signInWithCard")(function* (
  typed: string,
  publicComputer: boolean,
  offer: Offer,
) {
  const api = yield* AuthApi.Service;
  const code = yield* NotebookKeys.typedCard(typed);

  const signedIn = yield* api
    .cardSignIn(yield* NotebookKeys.cardLogin(code))
    .pipe(Effect.mapError(problem));

  yield* keepWithCard(
    signedIn,
    { accountId: signedIn.accountId, code, endsAtSaved: false, unsaved: false },
    publicComputer,
    offer,
  ).pipe(Effect.onError(() => endUnkept(signedIn)));

  return signedIn.accountId;
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
export const signInWithPasskey = Effect.fn("Account.signInWithPasskey")(function* (
  publicComputer: boolean,
) {
  const api = yield* AuthApi.Service;
  const passkeys = yield* Passkeys.Authenticator;

  const { options, challenge } = yield* api.passkeySignInOptions.pipe(Effect.mapError(problem));

  const asserted = yield* passkeys
    .get(options)
    .pipe(Effect.catchTags({ "Passkeys.Failed": (error) => Effect.fail(passkeyProblem(error)) }));

  const signedIn = yield* api
    .passkeySignIn(challenge, asserted.credential)
    .pipe(Effect.mapError(problem));

  yield* keep(signedIn, publicComputer);

  return {
    accountId: signedIn.accountId,
    credentialId: asserted.credential.id,
    prf: Option.map(asserted.prf, (bytes) => Redacted.make(bytes)),
  } satisfies PasskeyUsed;
});

/**
 * Adds a passkey to the account of a session at most `Keys.freshSignInMinutes` old, and says what
 * it can do for the notebook's unlock. On a public computer it goes on the student's phone or a
 * security key: one this computer kept, as Windows Hello or a password manager would, would sign
 * the next person here in as the student and open the notebook.
 */
export const addPasskey = Effect.fn("Account.addPasskey")(function* (
  token: Redacted.Redacted,
  publicComputer: boolean,
) {
  const api = yield* AuthApi.Service;
  const passkeys = yield* Passkeys.Authenticator;

  const { options, challenge } = yield* api
    .passkeyCreationOptions(token, publicComputer)
    .pipe(Effect.mapError(problem));

  const created = yield* passkeys
    .create(publicComputer ? { ...options, hints: ["hybrid", "security-key"] } : options)
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
 * Signs this device out: `leave` deletes the account's database and secrets (`Layers.forget`) and
 * ends with `forgetSession`, which signs the device out; then the server ends the session. Offline
 * the device still forgets everything, and the session runs out on the server. The caller asks
 * first unless nothing would be lost (`signOutWarning`), and `leave` may still refuse or fail.
 */
export const signOut = Effect.fn("Account.signOut")(function* <E, R>(
  leave: (
    signed: SessionStore.Signed,
    forgetSession: Effect.Effect<void, Keychain.Unavailable>,
  ) => Effect.Effect<void, E, R>,
) {
  const store = yield* SessionStore.Service;
  const api = yield* AuthApi.Service;
  const confirmations = yield* Confirmations;
  const current = yield* store.current;

  if (Option.isSome(current)) yield* leave(current.value, store.forget);

  yield* SubscriptionRef.set(confirmations.current, Option.none());
  yield* Ref.set(confirmations.newCard, Option.none());
  yield* Ref.set(confirmations.newPasskeyAccount, Option.none());
  yield* Effect.ignore(
    Option.match(
      Option.flatMap(current, (signed) => signed.token),
      { onNone: () => Effect.void, onSome: api.signOut },
    ),
  );
});

/** What signing out would lose, a paragraph each, for the one dialog before "Abmelden". */
export interface SignOutWarning {
  readonly paragraphs: ReadonlyArray<string>;
  /** Only this device opens the notebook, so the dialog offers "Notfallkarte erstellen" first. */
  readonly offerCard: boolean;
}

const unsentLoss = (unsent: AsyncResult.AsyncResult<number, unknown>): Option.Option<string> => {
  if (!AsyncResult.isSuccess(unsent)) {
    return Option.some(
      "Dieses Gerät kann gerade nicht prüfen, ob alle Änderungen übertragen sind. Wenn du dich jetzt abmeldest, sind nicht übertragene Änderungen weg.",
    );
  }

  if (unsent.value === 0) return Option.none();

  return Option.some(
    unsent.value === 1
      ? "1 Änderung ist noch nicht übertragen. Wenn du dich jetzt abmeldest, ist sie weg."
      : `${unsent.value} Änderungen sind noch nicht übertragen. Wenn du dich jetzt abmeldest, sind sie weg.`,
  );
};

const notebookLoss: Record<NotebookKeys.AtSignOut, Option.Option<string>> = {
  kept: Option.none(),
  lost: Option.some(
    "Dein Notizbuch hängt an diesem Gerät. Wenn du dich abmeldest, sind deine Hausaufgaben weg, und niemand kann sie zurückholen. Mit einer Notfallkarte kommst du wieder rein.",
  ),
  unknown: Option.some(
    "Dieses Gerät kann gerade nicht prüfen, ob du dein Notizbuch auch ohne dieses Gerät öffnen kannst. Ohne Passkey oder Notfallkarte ist es nach dem Abmelden weg.",
  ),
};

/**
 * What signing out would lose: the notebook (`NotebookKeys.atSignOut`) and the commands the engine
 * counted as unsent. Both are lost unless known otherwise, so a count or a key check still under way
 * asks too.
 */
export const signOutWarning = (
  unsent: AsyncResult.AsyncResult<number, unknown>,
  notebook: AsyncResult.AsyncResult<NotebookKeys.AtSignOut, unknown>,
): Option.Option<SignOutWarning> => {
  const atSignOut = AsyncResult.isSuccess(notebook) ? notebook.value : "unknown";
  const paragraphs = Arr.getSomes([notebookLoss[atSignOut], unsentLoss(unsent)]);

  return Arr.isReadonlyArrayNonEmpty(paragraphs)
    ? Option.some({ paragraphs, offerCard: atSignOut === "lost" })
    : Option.none();
};

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

/**
 * Whether the device keeps nothing on disk: as the account it holds chose at sign-in, else as the
 * tab chose for the next one (`chosen`). A device that can't hold an account holds none.
 */
export const keepsNothing = (
  current: AsyncResult.AsyncResult<Option.Option<SessionStore.Signed>, unknown>,
  chosen: boolean,
): AsyncResult.AsyncResult<boolean> =>
  AsyncResult.isInitial(current)
    ? AsyncResult.initial()
    : AsyncResult.success(
        Option.match(Option.flatten(AsyncResult.value(current)), {
          onNone: () => chosen,
          onSome: (signed) => signed.publicComputer,
        }),
      );
