import { passkey } from "@better-auth/passkey";
import { Accounts } from "@stu/api/Accounts";
import { Keys } from "@stu/api/Keys";
import { Access } from "@stu/api/Access";
import { Studienbuch } from "@stu/core";
import { Ports, type Spaces, SyncServer, type SyncWriter } from "@stu/sync/server";
import { type AuthContext, type BetterAuthOptions, betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { bearer, emailOTP } from "better-auth/plugins";
import { serializeSignedCookie } from "better-call";
import type * as Cause from "effect/Cause";
import * as Clock from "effect/Clock";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Crypto from "effect/Crypto";
import * as DateTime from "effect/DateTime";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Base64Url from "effect/encoding/Base64Url";
import * as FiberSet from "effect/FiberSet";
import * as Cookies from "effect/http/Cookies";
import * as Headers from "effect/http/Headers";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Redacted from "effect/Redacted";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import { Pool } from "pg";
import { DemoAccounts } from "../demo/DemoAccounts.ts";
import { Deployment } from "../infra/config/Deployment.ts";
import { Mail } from "../infra/mail/Mail.ts";
import { Limits } from "../limits/Limits.ts";
import { AccessCodes } from "../school/AccessCodes.ts";
import { NativeApps } from "./NativeApps.ts";
import { WithoutAddress } from "./WithoutAddress.ts";

export * as Auth from "./Auth.ts";

const challengeCookie = "passkey_challenge";

const day = 24 * 60 * 60;

export interface Settings {
  /** Better Auth's base URL, and the web origin passkeys are bound to. */
  readonly publicUrl: string;
  readonly secret: Redacted.Redacted;
  /** The environment's own host, which every passkey of this environment belongs to. */
  readonly rpId: string;
  readonly nativeApps: NativeApps.Apps;
}

export interface Callbacks {
  readonly sendCode: (email: string, code: string) => Promise<void>;
  /** Starts a reset for `email` after the answer. */
  readonly requestReset: (email: string) => void;
  /**
   * A sign-up starts with an access code: the reservation from `Access.redeem` pays for one, and
   * `signedUp` keeps or returns that payment.
   */
  readonly signingUp: (reservation: string) => Promise<boolean>;
  /**
   * The sign-up for `email` went through, also as Better Auth's stand-in answer for a known
   * address, or Better Auth refused it. Keeps the password `signUpPassword` hashed for `request`
   * with the reservation.
   */
  readonly signedUp: (
    reservation: string,
    email: Option.Option<string>,
    request: Request | undefined,
  ) => Promise<void>;
  /**
   * Hashes the password a sign-up names, for `signedUp` to keep, and answers the one the account
   * holds until its address is confirmed, which nobody knows.
   */
  readonly signUpPassword: (request: Request | undefined, password: string) => Promise<string>;
  /** Better Auth answered a sign-up of an address that already has an account, and did nothing. */
  readonly signedUpAgain: (email: string, confirmed: boolean) => Promise<void>;
  /**
   * Keeps what a confirmation request carries, for `proven`: its password, its reservation and
   * its code.
   */
  readonly proving: (request: Request, email: string, password: string) => Promise<void>;
  /**
   * The request's code was right: sets the password it carried and ends whatever the account
   * picked up before, its sessions and passkeys. Answers false, and gives the code back, for
   * another password than the one the sign-up with the request's reservation chose. Rejects a
   * request that carried none.
   */
  readonly proven: (account: string, request: Request | undefined) => Promise<boolean>;
  /** Admits the account to the school of the reservation the confirming device carries. */
  readonly confirmed: (account: string, reservation: Option.Option<string>) => Promise<void>;
  readonly sessionDeleted: (sessionId: string) => void;
  readonly log: (level: "debug" | "info" | "success" | "warn" | "error", message: string) => void;
  readonly withoutAddress: WithoutAddress.Callbacks;
}

// Routes `limited` limits instead of Better Auth, each with a ceiling per client address. A code
// request and a password count per address, and a code gets Better Auth's five tries.
const limitedRoutes = new Set([
  "/sign-up/email",
  "/sign-in/email",
  "/change-password",
  "/send-verification-email",
  "/email-otp/verify-email",
  "/email-otp/request-password-reset",
  "/email-otp/reset-password",
  ...WithoutAddress.limitedRoutes,
]);

// A sign-up or confirmation that did its work for a reservation of a code gives its client's count
// back, so a year group behind one address spends the ceiling on its failures.
const reservedRoutes = new Set([
  "/sign-up/email",
  "/email-otp/verify-email",
  ...WithoutAddress.reservedRoutes,
]);

const passwordRoutes = new Set(["/sign-in/email", "/change-password"]);

/** Better Auth's configuration without its database. `AuthTables.test.ts` reads its tables. */
export const options = (settings: Settings, callbacks: Callbacks) =>
  ({
    appName: "Studienbuch",
    baseURL: settings.publicUrl,
    basePath: Accounts.path,
    secret: Redacted.value(settings.secret),
    telemetry: { enabled: false },
    logger: { level: "warn", log: callbacks.log },
    // Better Auth would limit only when NODE_ENV is "production"; one build serves every environment.
    // It keys a limit on the client's address and counts on until the route goes quiet for a whole
    // window, which a school's network never does, so `limited` takes these routes.
    rateLimit: {
      enabled: true,
      customRules: Object.fromEntries(
        Array.from(limitedRoutes, (route) => [route, false] as const),
      ),
    },
    advanced: {
      // Better Auth turns both checks off when it thinks it runs in a test (`TEST`, `NODE_ENV`).
      disableOriginCheck: false,
      disableCSRFCheck: false,
      // Deleting many rows reports each one to the `delete` hooks, but reads at most this many. An
      // account's sessions must all reach the resolver when it signs out everywhere.
      database: { defaultFindManyLimit: 100_000 },
    },
    user: { modelName: "auth_user" },
    // A session lasts 90 days and renews with use, at most once a day (D27). Adding a passkey
    // needs a sign-in as recent as adding a key wrapper does (ADR 0025).
    session: {
      modelName: "auth_session",
      expiresIn: 90 * day,
      updateAge: day,
      freshAge: Keys.freshSignInMinutes * 60,
    },
    account: { modelName: "auth_account" },
    verification: { modelName: "auth_verification" },
    emailAndPassword: {
      enabled: true,
      requireEmailVerification: true,
      // Open everywhere, and the `before` hook lets in only a sign-up with a reservation.
      disableSignUp: false,
      minPasswordLength: Accounts.minPasswordLength,
      // A forgotten password may be a stolen one, so the reset ends every session of the account.
      // A thief's passkey stays; the reset mail lists the account's passkeys instead.
      revokeSessionsOnPasswordReset: true,
      onExistingUserSignUp: ({ user }) => callbacks.signedUpAgain(user.email, user.emailVerified),
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      // The code signs the device in, so it may only ever confirm an address once.
      autoSignInAfterVerification: true,
      // Runs once the code is checked and before the address counts as confirmed, so a password
      // set before the proof never survives it, and a failure here leaves the address unconfirmed.
      beforeEmailVerification: (user, request) =>
        user.emailVerified
          ? // oxlint-disable-next-line studienbuch/no-throwing-errors -- Better Auth hooks refuse a request by rejecting with APIError.
            Promise.reject(APIError.from("BAD_REQUEST", alreadyConfirmed))
          : callbacks.proven(user.id, request).then((named) =>
              named
                ? undefined
                : // oxlint-disable-next-line studienbuch/no-throwing-errors -- Better Auth hooks refuse a request by rejecting with APIError.
                  Promise.reject(APIError.from("UNAUTHORIZED", otherPassword)),
            ),
      // The confirming device names its own reservation, so a later sign-up of the address by
      // someone else can't choose the school.
      afterEmailVerification: (user, request) =>
        callbacks.confirmed(
          user.id,
          Option.fromNullishOr(request?.headers.get(Access.reservationHeader)),
        ),
    },
    hooks: {
      // A new password ends the session on every other device, whatever the request asks for. A
      // reset request answers at once and runs in `requestReset`, after the rate limit, so known
      // and unknown addresses take the same time.
      before: createAuthMiddleware((context) => {
        if (context.path === "/sign-up/email") {
          const reservation = context.headers?.get(Access.reservationHeader) ?? null;

          return (
            reservation === null ? Promise.resolve(false) : callbacks.signingUp(reservation)
          ).then((allowed) => {
            if (!allowed) {
              // oxlint-disable-next-line studienbuch/no-throwing-errors -- Better Auth hooks refuse a request by rejecting with APIError.
              return Promise.reject(APIError.from("BAD_REQUEST", reservationRefused));
            }

            // Anyone may sign up any address, so the password a sign-up names counts only once the
            // address's code confirms it. Until then the account holds one nobody knows. A
            // password Better Auth would refuse stays, so it answers with its own error.
            const password = textOf(context.body?.password);

            return Option.isSome(password) &&
              lengthProblem(password, context.context.password.config) === undefined
              ? callbacks.signUpPassword(context.request, password.value).then((throwaway) => ({
                  context: { body: { ...context.body, password: throwaway } },
                }))
              : undefined;
          });
        }

        if (context.path === "/email-otp/verify-email") {
          const password = textOf(context.body?.password);
          const problem = lengthProblem(password, context.context.password.config);
          const request = context.request;

          if (problem !== undefined || Option.isNone(password) || request === undefined) {
            // oxlint-disable-next-line studienbuch/no-throwing-errors -- Better Auth hooks refuse a request by rejecting with APIError.
            return Promise.reject(APIError.from("BAD_REQUEST", problem ?? passwordRequired));
          }

          return callbacks
            .proving(request, emailIn(context.body), password.value)
            .then(() => undefined);
        }

        return Promise.resolve(
          context.path === "/change-password"
            ? { context: { body: { ...context.body, revokeOtherSessions: true } } }
            : context.path === "/email-otp/request-password-reset"
              ? Option.match(decodeAddress(context.body), {
                  // Not an address: the same answer, and nothing starts.
                  onNone: () => context.json({ success: true }),
                  onSome: ({ email }) => {
                    callbacks.requestReset(email);

                    return context.json({ success: true });
                  },
                })
              : undefined,
        );
      }),
      // After-hooks run for refused calls too, with the error as `returned`. Better Auth answers a
      // known address with an account that doesn't exist, which counts like a real one.
      after: createAuthMiddleware((context) => {
        const reservation = context.headers?.get(Access.reservationHeader) ?? null;

        if (context.path !== "/sign-up/email" || reservation === null) return Promise.resolve();

        const created = decodeSignedUp(context.context.returned);

        return callbacks.signedUp(
          reservation,
          Result.isSuccess(created) ? Option.some(created.success.user.email) : Option.none(),
          context.request,
        );
      }),
    },
    databaseHooks: {
      user: {
        // The display name lives in the encrypted notebook only (architecture.md, C9).
        create: { before: () => Promise.resolve({ data: { name: "", image: null } }) },
      },
      session: {
        // The privacy claim lists what the server sees, and a client's IP address isn't on it.
        create: { before: () => Promise.resolve({ data: { ipAddress: null } }) },
        delete: { after: (session) => Promise.resolve(callbacks.sessionDeleted(session.id)) },
      },
    },
    // Flows Studienbuch doesn't offer. A verification code reaches only an unconfirmed address,
    // through `/send-verification-email`; a reset code only sets a password. `/forget-password/
    // email-otp` is Better Auth's deprecated copy of `/email-otp/request-password-reset`. A token
    // never leaves its device, so `/list-sessions` waits for the device list.
    disabledPaths: [
      // Each would check a password past `limited`, and the app uses neither.
      "/verify-password",
      "/delete-user",
      "/verify-email",
      "/update-user",
      "/list-sessions",
      "/email-otp/send-verification-otp",
      "/email-otp/check-verification-otp",
      "/sign-in/email-otp",
      "/forget-password/email-otp",
      "/email-otp/request-email-change",
      "/email-otp/change-email",
    ],
    plugins: [
      // Devices hold the signed token from `set-auth-token`, which a raw token from a dump can't be.
      bearer({ requireSignature: true }),
      emailOTP({
        overrideDefaultEmailVerification: true,
        disableSignUp: true,
        otpLength: 6,
        expiresIn: Accounts.codeMinutes * 60,
        allowedAttempts: 5,
        // Keyed, because six digits hash back in milliseconds from a plain SHA-256.
        storeOTP: { hash: (otp) => keyedHash(settings.secret, `studienbuch.otp.v1:${otp}`) },
        // Reset codes go out from `requestReset`, which never calls Better Auth's reset request.
        sendVerificationOTP: ({ email, otp, type }) =>
          type === "email-verification" ? callbacks.sendCode(email, otp) : Promise.resolve(),
      }),
      passkey({
        rpID: settings.rpId,
        rpName: "Studienbuch",
        origin: [
          new URL(settings.publicUrl).origin,
          ...NativeApps.androidOrigins(settings.nativeApps),
        ],
        // The PRF unlock needs user verification on every ceremony (recovery.md, section 4). The
        // passkey patch in `patches/` makes Better Auth apply this to sign-in and to both checks.
        authenticatorSelection: { residentKey: "required", userVerification: "required" },
        advanced: { webAuthnChallengeCookie: challengeCookie },
        schema: { passkey: { modelName: "auth_passkey" } },
        registration: WithoutAddress.registration,
      }),
      WithoutAddress.plugin(callbacks.withoutAddress),
    ],
  }) satisfies BetterAuthOptions;

const alreadyConfirmed = { code: "EMAIL_ALREADY_VERIFIED", message: "Email already verified" };

const reservationRefused = {
  code: Access.reservationRefused,
  message: "A sign-up needs a school's access code",
};

const decodeSignedUp = Schema.decodeUnknownResult(
  Schema.Struct({ user: Schema.Struct({ email: Schema.String }) }),
);

const passwordRequired = {
  code: "PASSWORD_REQUIRED",
  message: "Confirming an address sets the account's password",
};

// Sign-in's code, which the app one release back already words as a wrong password.
const otherPassword = {
  code: "INVALID_EMAIL_OR_PASSWORD",
  message: "No sign-up of this address chose this password",
};

const passwordTooShort = { code: "PASSWORD_TOO_SHORT", message: "Password too short" };

const passwordTooLong = { code: "PASSWORD_TOO_LONG", message: "Password too long" };

/** A request body's field, which Better Auth parses only after the hooks ran. */
const textOf = Schema.decodeUnknownOption(Schema.String);

/** A request body's `email` as sent, or nothing for Better Auth to refuse later. */
const emailIn = (body: { readonly email?: unknown } | undefined) =>
  Option.getOrElse(textOf(body?.email), () => "");

/** Why Better Auth would refuse `password`, or none for a password it takes. */
const lengthProblem = (
  password: Option.Option<string>,
  limits: { readonly minPasswordLength: number; readonly maxPasswordLength: number },
) =>
  Option.match(password, {
    onNone: () => passwordRequired,
    onSome: (value) =>
      value.length < limits.minPasswordLength
        ? passwordTooShort
        : value.length > limits.maxPasswordLength
          ? passwordTooLong
          : undefined,
  });

/** `AUTH_SECRET` is shorter than 32 bytes. Better Auth would fall back to a public default. */
export class WeakSecret extends Schema.TaggedError<WeakSecret, { readonly brand: unique symbol }>()(
  "Auth.WeakSecret",
  {},
) {}

/** `PASSKEY_RP_ID` isn't `PUBLIC_URL`'s host, so no passkey of this environment would work. */
export class ForeignRpId extends Schema.TaggedError<
  ForeignRpId,
  { readonly brand: unique symbol }
>()("Auth.ForeignRpId", { rpId: Schema.String, host: Schema.String }) {}

/** The server is no development or preview server, or the seed didn't make the account. */
export class NotDemo extends Schema.TaggedError<NotDemo, { readonly brand: unique symbol }>()(
  "Auth.NotDemo",
  { accountId: Schema.String },
) {}

const codeMail = (to: string, code: string): Mail.Message => ({
  to,
  subject: `${code} ist dein Code für Studienbuch`,
  text: [
    "Hallo,",
    "",
    `dein Code für Studienbuch ist ${code}.`,
    "",
    `Gib ihn in der App ein, um deine E-Mail-Adresse zu bestätigen. Er gilt ${Accounts.codeMinutes} Minuten.`,
    "",
    "Wenn du gerade kein Konto anlegst, kannst du diese Mail ignorieren.",
  ].join("\n"),
});

const Address = Schema.Struct({ email: Accounts.Address });

const decodeAddress = Schema.decodeUnknownOption(Address);

const text = new TextEncoder();

/** HMAC-SHA-256 under `AUTH_SECRET`, as base64url. */
const keyedHash = (secret: Redacted.Redacted, value: string) =>
  crypto.subtle
    .importKey(
      "raw",
      text.encode(Redacted.value(secret)),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"],
    )
    .then((key) => crypto.subtle.sign("HMAC", key, text.encode(value)))
    .then((signature) => Base64Url.encode(new Uint8Array(signature)));

/** Code mails per address and hour, for confirmation codes and for reset codes. */
const mailsPerHour = 5;

/** What a confirmation request carries, from before its code is checked to after. */
interface Proof {
  readonly reservation: Option.Option<string>;
  readonly password: Redacted.Redacted;
  readonly hash: string;
  /** The code row the request will use up, to give back if the password is wrong. */
  readonly code: Option.Option<{
    readonly identifier: string;
    readonly value: string;
    readonly expiresAt: Date;
  }>;
}

/** Wrong passwords per address in `Limits.clientWindow`, after which its password checks wait. */
const wrongPasswords = 10;

// What Better Auth answers a wrong password with, at sign-in and when changing it.
const wrongPasswordCodes = new Set(["INVALID_EMAIL_OR_PASSWORD", "INVALID_PASSWORD"]);

/**
 * What `decode` reads from a request's or answer's JSON body. It reads a copy, so Better Auth or the
 * client still gets the body.
 */
const peek = <A>(message: Request | Response, decode: (json: string) => Option.Option<A>) =>
  Effect.map(
    Effect.option(Effect.tryPromise(() => message.clone().text())),
    Option.flatMap(decode),
  );

const isWrongPassword = (response: Response) =>
  response.status === 400 || response.status === 401
    ? Effect.map(
        peek(response, decodeErrorCode),
        Option.exists(({ code }) => wrongPasswordCodes.has(code)),
      )
    : Effect.succeed(false);

// Better Auth's answer to a code request, which a capped one gets too, so it tells nothing.
const codeRequests = new Map<string, object>([
  ["/send-verification-email", { status: true }],
  ["/email-otp/request-password-reset", { success: true }],
]);

// Better Auth's own answer when it limits, which the app shows as "Zu viele Versuche".
const tooMany = (seconds: number) =>
  Response.json(
    { message: "Too many requests. Please try again later." },
    { status: 429, headers: { "x-retry-after": String(seconds) } },
  );

/** The lower-cased address a request's JSON body names, if it names one. */
const addressIn = (request: Request) =>
  Effect.map(
    peek(request, decodeAddressJson),
    Option.map(({ email }) => email.toLowerCase()),
  );

const decodeAddressJson = Schema.decodeUnknownOption(Schema.fromJsonString(Address));

const dateOf = (date: DateTime.Utc) =>
  DateTime.format(date, {
    locale: "de-DE",
    timeZone: "Europe/Berlin",
    day: "numeric",
    month: "numeric",
    year: "numeric",
  });

/** "am 3.11.2026, am 5.11.2026 und am 7.11.2026" */
const days = (dates: ReadonlyArray<DateTime.Utc>) => {
  const each = dates.map((date) => `am ${dateOf(date)}`);

  return each.length < 2 ? each.join("") : `${each.slice(0, -1).join(", ")} und ${each.at(-1)}`;
};

// A new password leaves passkeys alone, the student's own unlock among them. So the mail names
// them, and a stranger's stands out.
const passkeyLines = (created: ReadonlyArray<DateTime.Utc>, impressum: string) =>
  created.length === 0
    ? []
    : [
        "",
        created.length === 1
          ? `Auf deinem Konto ist 1 Passkey eingerichtet, angelegt ${days(created)}.`
          : `Auf deinem Konto sind ${created.length} Passkeys eingerichtet, angelegt ${days(created)}.`,
        "Ein neues Passwort ändert daran nichts. Wenn du einen davon nicht selbst angelegt hast, kann sich jemand anderes damit anmelden. Schreib uns dann über " +
          `${impressum}.`,
      ];

const resetMail = (
  to: string,
  code: string,
  passkeys: ReadonlyArray<DateTime.Utc>,
  impressum: string,
): Mail.Message => ({
  to,
  subject: `${code} ist dein Code für ein neues Passwort`,
  text: [
    "Hallo,",
    "",
    "wir haben eine Anfrage bekommen, dein Studienbuch-Passwort zurückzusetzen.",
    `Dein Code ist ${code}.`,
    "",
    `Gib ihn in der App ein und setze ein neues Passwort. Er gilt ${Accounts.codeMinutes} Minuten.`,
    ...passkeyLines(passkeys, impressum),
    "",
    "Wenn du das nicht angefordert hast, kannst du diese Mail ignorieren. Dein Passwort bleibt dann unverändert.",
  ].join("\n"),
});

const confirmInsteadMail = (to: string, code: string): Mail.Message => ({
  to,
  subject: `${code} ist dein Code für Studienbuch`,
  text: [
    "Hallo,",
    "",
    "wir haben eine Anfrage bekommen, dein Studienbuch-Passwort zurückzusetzen. Deine E-Mail-Adresse ist aber noch nicht bestätigt, darum gibt es noch kein Passwort.",
    `Dein Code ist ${code}.`,
    "",
    `Gib ihn in der App ein, um deine Adresse zu bestätigen, und lege dabei dein Passwort fest. Er gilt ${Accounts.codeMinutes} Minuten.`,
    "",
    "Wenn du das nicht angefordert hast, kannst du diese Mail ignorieren.",
  ].join("\n"),
});

// Better Auth counts wrong tries and expiry only where a code exists. A sign-up that was never
// confirmed has one and an unknown address none, so every answer about the code is one constant
// response, byte for byte. Password lengths are checked before the code, alike for everyone.
const sameAnswerForBadCodes = (response: Response) =>
  response.status === 400 || response.status === 403
    ? Effect.map(peek(response, decodeErrorCode), (error) =>
        Option.exists(error, ({ code }) => codeAnswers.has(code))
          ? new Response(invalidCode, {
              status: 400,
              headers: { "content-type": "application/json" },
            })
          : response,
      )
    : Effect.succeed(response);

const decodeErrorCode = Schema.decodeUnknownOption(
  Schema.fromJsonString(Schema.Struct({ code: Schema.String })),
);

// A guessed code for an address without an account reaches USER_NOT_FOUND.
const codeAnswers = new Set(["INVALID_OTP", "OTP_EXPIRED", "TOO_MANY_ATTEMPTS", "USER_NOT_FOUND"]);

// In the order Better Auth writes its errors.
const invalidCode = JSON.stringify({ message: "Invalid OTP", code: "INVALID_OTP" });

const codePaths = new Set([
  `${Accounts.path}/email-otp/reset-password`,
  `${Accounts.path}/email-otp/verify-email`,
]);

export class Service extends Context.Service<
  Service,
  {
    /** Better Auth's handler behind the limits. `route` mounts it. */
    readonly handler: (request: Request) => Effect.Effect<Response, Cause.UnknownError>;
    /** The name Better Auth gives its passkey challenge cookie in this environment. */
    readonly challengeCookie: string;
    readonly origin: string;
    readonly sessions: Ports.SessionResolver["Service"];
    /**
     * A new session of a demo account without its password, as the signed bearer token a sign-in
     * returns. Only `Demo.signIn` calls it. It refuses outside development and preview servers and
     * for any account the seed didn't make, whatever the caller checked.
     */
    readonly signInDemo: (accountId: string) => Effect.Effect<string, NotDemo>;
  }
>()("Auth.Service") {}

const make = Effect.gen(function* () {
  const { environment } = yield* Deployment.Current;
  const mail = yield* Mail.Service;
  const sql = yield* SqlClient.SqlClient;
  const crypto = yield* Crypto.Crypto;

  const settings = yield* Config.all({
    publicUrl: Config.String("PUBLIC_URL"),
    secret: Config.Redacted("AUTH_SECRET"),
    rpId: Config.String("PASSKEY_RP_ID"),
    nativeApps: NativeApps.config,
  });

  if (new TextEncoder().encode(Redacted.value(settings.secret)).length < 32) {
    return yield* new WeakSecret();
  }

  const host = new URL(settings.publicUrl).hostname;

  if (settings.rpId !== host) return yield* new ForeignRpId({ rpId: settings.rpId, host });

  const databaseUrl = yield* Config.Redacted("DATABASE_URL");

  // Better Auth's callbacks run outside Effect, with this layer's logger and tracer.
  const services = yield* Effect.context();

  const proofs = new WeakMap<Request, Proof>();

  // Admitting an account writes its notebook through the sync engine.
  const writers = yield* Layer.build(SyncServer.writers(Studienbuch.schema));

  type Needs = SqlClient.SqlClient | Crypto.Crypto | Spaces.Service | SyncWriter.Service;

  const provided = <A, E>(effect: Effect.Effect<A, E, Needs>) =>
    effect.pipe(
      Effect.provide(writers),
      Effect.provideService(SqlClient.SqlClient, sql),
      Effect.provideService(Crypto.Crypto, crypto),
    );

  const run = <A, E>(effect: Effect.Effect<A, E, Needs>) =>
    Effect.runPromiseWith(services)(provided(effect));

  const deleted = yield* PubSub.unbounded<string>();

  // Resets run after the answer; the layer's scope waits for them or ends them.
  const background = yield* FiberSet.makeRuntime();

  // Kept in this process like the revocations below.
  const clients = Limits.make(Limits.clientWindow);
  const codes = Limits.make(Limits.clientWindow);
  const mails = Limits.make("1 hour");
  const cooldowns = Limits.make(Duration.seconds(Accounts.resendSeconds));
  const passwords = Limits.make(Limits.clientWindow);

  // A request within the cooldown mails nothing, so the code already on its way stays the one
  // that works (D90).
  const mayMail = (key: string, now: number) =>
    Option.isNone(cooldowns.take(key, 1, now)) && Option.isNone(mails.take(key, mailsPerHour, now));

  // Redeeming is free and a sign-up of a known address mails nothing, so a code gives each client
  // three counts back per use in a window: no client mails past the ceiling with it, and none can
  // spend another's.
  const giveBackFor = Effect.fn("Auth.giveBack")(function* (
    client: string,
    request: Request,
    now: number,
  ) {
    const reservation = request.headers.get(Access.reservationHeader);

    if (reservation === null) return;

    const code = yield* provided(AccessCodes.codeOf(reservation));

    if (Option.isNone(code)) return;

    const limit = AccessCodes.signUpBudget * code.value.maxUses;

    if (Option.isNone(codes.take(`${client} ${code.value.id}`, limit, now))) {
      clients.giveBack(client, now);
    }
  });

  // Better Auth answers a refusal itself, so a rejection is the server's failure.
  const answer = (request: Request) => {
    const answered = Effect.tryPromise(() => auth.handler(request));

    return codePaths.has(new URL(request.url).pathname)
      ? Effect.flatMap(answered, sameAnswerForBadCodes)
      : answered;
  };

  // The account a password check is for: the address at sign-in, the session's when changing it.
  const passwordOf = (route: string, request: Request) =>
    route === "/sign-in/email"
      ? addressIn(request)
      : Effect.map(
          Effect.tryPromise(() => auth.api.getSession({ headers: request.headers })),
          (found) =>
            Option.map(Option.fromNullishOr(found), ({ user }) => user.email.toLowerCase()),
        );

  // A password check counts before it runs, so parallel guesses can't all pass the count, and a
  // check that wasn't a wrong password gives its count back.
  const checkingPassword = Effect.fn("Auth.checkingPassword")(function* (
    route: string,
    request: Request,
    now: number,
  ) {
    const address = yield* passwordOf(route, request);

    if (Option.isNone(address)) return yield* answer(request);

    const wait = passwords.take(address.value, wrongPasswords, now);

    if (Option.isSome(wait)) return tooMany(wait.value);

    const response = yield* answer(request);

    if (!(yield* isWrongPassword(response))) passwords.giveBack(address.value, now);

    return response;
  });

  // A school's network shares one client address, so a client gets a ceiling per route, and an
  // email address its caps: a few code mails an hour, and a few wrong passwords.
  const limited = Effect.fn("Auth.limited")(function* (request: Request) {
    const route = new URL(request.url).pathname.slice(Accounts.path.length);

    if (!limitedRoutes.has(route)) return yield* answer(request);

    const now = yield* Clock.currentTimeMillis;
    const client = `${route} ${Limits.client(request.headers.get("x-forwarded-for"))}`;
    const ceiling = clients.take(client, Limits.perClient, now);

    if (Option.isSome(ceiling)) return tooMany(ceiling.value);

    const capped = codeRequests.get(route);

    if (capped !== undefined) {
      const address = yield* addressIn(request);

      return Option.isSome(address) && !mayMail(`${route} ${address.value}`, now)
        ? Response.json(capped)
        : yield* answer(request);
    }

    if (passwordRoutes.has(route)) return yield* checkingPassword(route, request, now);

    const response = yield* answer(request);

    // Better Auth did the work, so the answer stands even if the count stays spent.
    if (reservedRoutes.has(route) && response.status === 200) {
      yield* giveBackFor(client, request, now).pipe(
        Effect.catchCause((cause) => Effect.logError("A client's count wasn't given back", cause)),
      );
    }

    return response;
  });

  // Every address gets a reset code, also one without an account, so a wrong, spent or expired
  // code answers alike for all and takes as long. Only a confirmed address is mailed its code.
  const startReset = Effect.fn("Auth.startReset")(function* (address: string) {
    const code = yield* freshCode("forget-password", address);
    const user = yield* Effect.promise(() => context.internalAdapter.findUserByEmail(address));

    if (user === null) return;

    // A reset would confirm the address without `beforeEmailVerification`, which admits the
    // account to its school, so an unconfirmed address gets the sign-up's confirmation code. Its
    // sign-up password is the forgotten one, so confirming sets the one typed then.
    if (!user.user.emailVerified) {
      yield* provided(AccessCodes.forgetSignUpPasswords(user.user.id)).pipe(Effect.orDie);

      const confirming = yield* freshCode("email-verification", address);

      yield* holdForCode(address);

      return yield* mail.send(confirmInsteadMail(address, confirming));
    }

    const passkeys = yield* passkeysOf(address);

    yield* mail.send(resetMail(address, code, passkeys, `${settings.publicUrl}/impressum`));
  });

  // Replaces the address's earlier code of this type. The identifier is the email-OTP plugin's.
  // Typed by hand: it reads `auth`, which the callbacks that use it build, a circular inference.
  const freshCode: (
    type: "forget-password" | "email-verification",
    address: string,
  ) => Effect.Effect<string> = Effect.fnUntraced(function* (
    type: "forget-password" | "email-verification",
    address: string,
  ) {
    yield* Effect.promise(() =>
      context.internalAdapter.deleteVerificationByIdentifier(`${type}-otp-${address}`),
    );

    return yield* Effect.promise(() =>
      auth.api.createVerificationOTP({ body: { email: address, type } }),
    );
  });

  // The password a sign-up names, hashed, until its `after` hook keeps it with the reservation.
  const signUps = new WeakMap<Request, string>();

  const signUpPassword = Effect.fn("Auth.signUpPassword")(function* (
    request: Request | undefined,
    password: string,
  ) {
    const hash = yield* Effect.promise(() => context.password.hash(password));

    if (request !== undefined) signUps.set(request, hash);

    return Base64Url.encode(yield* Effect.orDie(crypto.randomBytes(32)));
  });

  // Every confirmation code, a sign-up's own too, holds the address for the cooldown (D90).
  const holdForCode = (address: string) =>
    Effect.map(Clock.currentTimeMillis, (now) =>
      cooldowns.add(`/send-verification-email ${address.toLowerCase()}`, now),
    );

  // Better Auth mails nothing for a known address. One that waits for its code gets a fresh one,
  // which replaces the last as a resend does. The sign-up waits for it, as for a new account's.
  const signedUpAgain = Effect.fn("Auth.signedUpAgain")(function* (address: string) {
    const now = yield* Clock.currentTimeMillis;

    if (!mayMail(`/send-verification-email ${address}`, now)) return;

    yield* mail.send(codeMail(address, yield* freshCode("email-verification", address)));
  });

  const proving = Effect.fn("Auth.proving")(function* (
    request: Request,
    email: string,
    password: string,
  ) {
    // Better Auth lowercases the address before it looks up the code.
    const address = email.toLowerCase();
    const hash = yield* Effect.promise(() => context.password.hash(password));
    const identifier = `email-verification-otp-${address}`;

    const code = yield* Effect.promise(() =>
      context.internalAdapter.findVerificationValue(identifier),
    );

    proofs.set(request, {
      reservation: Option.fromNullishOr(request.headers.get(Access.reservationHeader)),
      password: Redacted.make(password),
      hash,
      code: Option.map(Option.fromNullishOr(code), ({ value, expiresAt }) => ({
        identifier,
        value,
        expiresAt,
      })),
    });
  });

  // Runs after Better Auth used up the code, so only the code's holder learns that a password is
  // wrong. A wrong one gives the code back with one try less, as a wrong code would. Only the
  // sign-up with the confirming device's own reservation decides, so nobody else's sign-up of the
  // address can lock the student out; without one the typed password counts, as it did.
  const prove = Effect.fn("Auth.prove")(function* (account: string, proof: Proof) {
    const chosen = Option.isNone(proof.reservation)
      ? Option.none<string>()
      : yield* AccessCodes.signUpPassword(account, proof.reservation.value).pipe(Effect.orDie);

    const matches = yield* Option.match(chosen, {
      onNone: () => Effect.succeed(true),
      onSome: (hash) =>
        Effect.promise(() =>
          context.password.verify({ hash, password: Redacted.value(proof.password) }),
        ),
    });

    if (!matches) {
      yield* Option.match(proof.code, {
        onNone: () => Effect.void,
        onSome: ({ identifier, value, expiresAt }) => {
          const at = value.lastIndexOf(":");
          const tries = Number(value.slice(at + 1)) + 1;

          return Effect.promise(() =>
            context.internalAdapter.createVerificationValue({
              identifier,
              value: `${value.slice(0, at)}:${tries}`,
              expiresAt,
            }),
          );
        },
      });

      return false;
    }

    const ended = yield* sql
      .withTransaction(
        Effect.gen(function* () {
          yield* sql`
            update auth_account set password = ${proof.hash}, "updatedAt" = now()
            where "userId" = ${account} and "providerId" = 'credential'
          `;
          yield* sql`delete from auth_passkey where "userId" = ${account}`;

          return yield* sql<{ readonly id: string }>`
            delete from auth_session where "userId" = ${account} returning id
          `;
        }),
      )
      .pipe(Effect.orDie);

    // Rows deleted here pass no Better Auth hook, so the resolver hears of them here.
    for (const { id } of ended) PubSub.publishUnsafe(deleted, id);

    return true;
  });

  const passkeysOf = (email: string) =>
    Effect.map(
      sql<{ readonly createdAt: Date }>`
        select p."createdAt" from auth_passkey p join auth_user u on u.id = p."userId"
        where u.email = ${email} order by p."createdAt"
      `,
      (rows) => rows.map((row) => DateTime.fromDateUnsafe(row.createdAt)),
    ).pipe(Effect.orDie);

  // Typed by hand: it reads `auth`, which the callbacks that use it build, a circular inference.
  const sessionOf: WithoutAddress.Callbacks["session"] = (headers) =>
    auth.api.getSession({ headers });

  // Better Auth's own pool, beside Effect's client: auth queries are rare (stack.md).
  const pool = yield* Effect.acquireRelease(
    Effect.sync(() => new Pool({ connectionString: Redacted.value(databaseUrl), max: 4 })),
    (pool) => Effect.promise(() => pool.end()),
  );

  const auth = betterAuth({
    ...options(settings, {
      sendCode: (email, code) =>
        Effect.runPromiseWith(services)(
          Effect.andThen(holdForCode(email), mail.send(codeMail(email, code))).pipe(
            Effect.tapError((error) => Effect.logError("A verification code wasn't sent", error)),
          ),
        ),
      requestReset: (email) => {
        background(
          startReset(email.toLowerCase()).pipe(
            Effect.catchCause((cause) => Effect.logError("A reset didn't start", cause)),
            Effect.provideContext(services),
          ),
        );
      },
      signingUp: (reservation) => run(AccessCodes.claimSignUp(reservation)),
      signedUp: (reservation, email, request) =>
        run(
          Option.match(email, {
            onNone: () => AccessCodes.releaseSignUp(reservation),
            onSome: (address) =>
              AccessCodes.rememberSignUp(
                reservation,
                address,
                Option.fromNullishOr(request === undefined ? undefined : signUps.get(request)),
              ),
          }),
        ),
      signUpPassword: (request, password) => run(signUpPassword(request, password)),
      signedUpAgain: (email, confirmed) =>
        confirmed
          ? Promise.resolve()
          : run(
              signedUpAgain(email.toLowerCase()).pipe(
                Effect.catchCause((cause) => Effect.logError("A fresh code wasn't sent", cause)),
              ),
            ),
      proving: (request, email, password) => run(proving(request, email, password)),
      proven: (account, request) => {
        const proof = request === undefined ? undefined : proofs.get(request);

        if (proof === undefined) {
          // oxlint-disable-next-line studienbuch/no-throwing-errors -- Better Auth hooks refuse a request by rejecting with APIError.
          return Promise.reject(APIError.from("BAD_REQUEST", passwordRequired));
        }

        return run(prove(account, proof));
      },
      // A failed admission leaves an account without a school, which still works, so the
      // confirmation succeeds whatever happens here.
      confirmed: (account, reservation) =>
        run(
          AccessCodes.admitConfirmed(account, reservation).pipe(
            Effect.catchCause((cause) =>
              Effect.logError("A confirmed sign-up wasn't admitted", cause),
            ),
            Effect.asVoid,
          ),
        ),
      sessionDeleted: (sessionId) => {
        PubSub.publishUnsafe(deleted, sessionId);
      },
      withoutAddress: { run, session: sessionOf },
      log: (level, message) => {
        Effect.runForkWith(services)(
          level === "error"
            ? Effect.logError(message)
            : level === "warn"
              ? Effect.logWarning(message)
              : Effect.logDebug(message),
        );
      },
    }),
    database: pool,
  });

  // Typed by hand: the callbacks above read it, which would make its inferred type circular.
  const context: Pick<AuthContext, "internalAdapter" | "secret" | "createAuthCookie"> & {
    readonly password: Pick<AuthContext["password"], "hash" | "verify">;
  } = yield* Effect.promise(() => auth.$context);

  const resolve = Effect.fn("Auth.resolve")(function* (headers: Headers.Headers) {
    const found = yield* Effect.promise(() =>
      auth.api.getSession({ headers: new globalThis.Headers(headers) }),
    );

    return Option.map(Option.fromNullishOr(found), ({ session }) => ({
      accountId: session.userId,
      sessionId: session.id,
      expiresAt: DateTime.fromDateUnsafe(session.expiresAt),
    }));
  });

  const signInDemo = Effect.fn("Auth.signInDemo")(function* (accountId: string) {
    const demo =
      Deployment.isDevelopmentOrPreview(environment) &&
      (yield* DemoAccounts.isDemo(accountId).pipe(
        Effect.provideService(SqlClient.SqlClient, sql),
        Effect.orDie,
      ));

    if (!demo) return yield* new NotDemo({ accountId });

    // Better Auth's own path, so its session hooks and expiry apply.
    const session = yield* Effect.promise(() => context.internalAdapter.createSession(accountId));

    // Signed as the bearer plugin signs a session cookie, which is what a sign-in hands a device.
    const cookie = yield* Effect.promise(() =>
      serializeSignedCookie("", session.token, context.secret),
    );

    return cookie.replace("=", "");
  });

  return {
    handler: limited,
    challengeCookie: context.createAuthCookie(challengeCookie).name,
    origin: new URL(settings.publicUrl).origin,
    sessions: { resolve, revoked: Stream.fromPubSub(deleted) },
    signInDemo,
  };
});

/**
 * Better Auth, and the `SessionResolver` the sync server checks tickets and connections with. A
 * session ends for the resolver when Better Auth deletes its row: at sign-out, when another device
 * revokes it, and when a device presents it after it expired. The revocations stay in this
 * process, so a second process would need them through Postgres.
 */
export const layer = Layer.effect(Ports.SessionResolver)(
  Effect.map(Service, (auth) => auth.sessions),
).pipe(Layer.provideMerge(Layer.effect(Service)(make)));

/**
 * Better Auth at `Accounts.path`. Devices keep no cookies: a session is a bearer token in the device's
 * secrets, so the virtual devices of one browser can be different accounts and native needs no
 * cookie jar. So the route drops every cookie both ways, except the passkey challenge, which
 * crosses as `Accounts.challengeHeader`.
 */
export const route = HttpRouter.add("*", `${Accounts.path}/*`, (request) =>
  Effect.gen(function* () {
    const auth = yield* Service;

    const challenge = Headers.get(request.headers, Accounts.challengeHeader);

    const headers = Option.match(challenge, {
      onNone: () => Headers.remove(request.headers, "cookie"),
      onSome: (value) => {
        const withCookie = Headers.set(
          request.headers,
          "cookie",
          `${auth.challengeCookie}=${encodeURIComponent(value)}`,
        );

        // Better Auth checks the Origin of every request with a cookie, and native apps send
        // none. A browser can't send this header across sites without a CORS grant, so the request
        // comes from the app itself.
        return Headers.has(withCookie, "origin")
          ? withCookie
          : Headers.set(withCookie, "origin", auth.origin);
      },
    });

    const web = yield* HttpServerRequest.toWeb(request.modify({ headers }));
    const response = HttpServerResponse.fromWeb(yield* auth.handler(web));

    const withoutCookies = HttpServerResponse.updateCookies(response, () => Cookies.empty);

    return Option.match(Cookies.get(response.cookies, auth.challengeCookie), {
      onNone: () => withoutCookies,
      onSome: (cookie) =>
        HttpServerResponse.setHeader(withoutCookies, Accounts.challengeHeader, cookie.value),
    });
  }),
);
