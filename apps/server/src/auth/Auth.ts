import { passkey } from "@better-auth/passkey";
import { Accounts } from "@stu/api/Accounts";
import { Keys } from "@stu/api/Keys";
import { Ports } from "@stu/sync/server";
import { type BetterAuthOptions, betterAuth } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import { bearer, emailOTP } from "better-auth/plugins";
import { serializeSignedCookie } from "better-call";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as DateTime from "effect/DateTime";
import * as Effect from "effect/Effect";
import * as Cookies from "effect/http/Cookies";
import * as Headers from "effect/http/Headers";
import * as HttpEffect from "effect/http/HttpEffect";
import * as HttpRouter from "effect/http/HttpRouter";
import * as HttpServerRequest from "effect/http/HttpServerRequest";
import * as HttpServerResponse from "effect/http/HttpServerResponse";
import * as Layer from "effect/Layer";
import * as Option from "effect/Option";
import * as PubSub from "effect/PubSub";
import * as Redacted from "effect/Redacted";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import * as Stream from "effect/Stream";
import { Pool } from "pg";
import { DemoAccounts } from "../demo/DemoAccounts.ts";
import { Deployment } from "../infra/config/Deployment.ts";
import { Mail } from "../infra/mail/Mail.ts";
import { NativeApps } from "./NativeApps.ts";

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
  /** Open in development and preview only, until access codes arrive in M3. */
  readonly signUp: boolean;
}

export interface Callbacks {
  readonly sendCode: (email: string, code: string) => Promise<void>;
  readonly sessionDeleted: (sessionId: string) => void;
  readonly log: (level: "debug" | "info" | "success" | "warn" | "error", message: string) => void;
}

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
    rateLimit: { enabled: true },
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
      disableSignUp: !settings.signUp,
      minPasswordLength: Accounts.minPasswordLength,
    },
    emailVerification: {
      sendOnSignUp: true,
      sendOnSignIn: true,
      // The code signs the device in, so it may only ever confirm an address once.
      autoSignInAfterVerification: true,
      beforeEmailVerification: (user) =>
        user.emailVerified
          ? // oxlint-disable-next-line studienbuch/no-throwing-errors -- Better Auth hooks refuse a request by rejecting with APIError.
            Promise.reject(APIError.from("BAD_REQUEST", alreadyConfirmed))
          : Promise.resolve(),
    },
    hooks: {
      // A new password ends the session on every other device, whatever the request asks for. A
      // new passkey signs nobody in, so a fresh sign-in can't be stretched by registering again.
      before: createAuthMiddleware((context) =>
        Promise.resolve(
          context.path === "/change-password"
            ? { context: { body: { ...context.body, revokeOtherSessions: true } } }
            : context.path === "/passkey/verify-registration"
              ? { context: { body: { ...context.body, createSession: false } } }
              : undefined,
        ),
      ),
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
    // Flows Studienbuch doesn't offer. A code reaches only an address that isn't confirmed yet,
    // through `/send-verification-email`, and confirming it signs the device in. A session's token
    // never leaves the device it belongs to, so `/list-sessions` waits for the device list.
    disabledPaths: [
      "/verify-email",
      "/update-user",
      "/list-sessions",
      "/email-otp/send-verification-otp",
      "/email-otp/check-verification-otp",
      "/sign-in/email-otp",
      "/email-otp/request-password-reset",
      "/forget-password/email-otp",
      "/email-otp/reset-password",
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
        storeOTP: "hashed",
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
      }),
    ],
  }) satisfies BetterAuthOptions;

const alreadyConfirmed = { code: "EMAIL_ALREADY_VERIFIED", message: "Email already verified" };

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

export class Service extends Context.Service<
  Service,
  {
    /** Better Auth's handler. `route` mounts it. */
    readonly handler: (request: Request) => Promise<Response>;
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
  const deleted = yield* PubSub.unbounded<string>();

  // Better Auth's own pool, beside Effect's client: auth queries are rare (stack.md).
  const pool = yield* Effect.acquireRelease(
    Effect.sync(() => new Pool({ connectionString: Redacted.value(databaseUrl), max: 4 })),
    (pool) => Effect.promise(() => pool.end()),
  );

  const auth = betterAuth({
    ...options(
      { ...settings, signUp: Deployment.isDevelopmentOrPreview(environment) },
      {
        sendCode: (email, code) =>
          Effect.runPromiseWith(services)(
            mail
              .send(codeMail(email, code))
              .pipe(
                Effect.tapError((error) =>
                  Effect.logError("A verification code wasn't sent", error),
                ),
              ),
          ),
        sessionDeleted: (sessionId) => {
          PubSub.publishUnsafe(deleted, sessionId);
        },
        log: (level, message) => {
          Effect.runForkWith(services)(
            level === "error"
              ? Effect.logError(message)
              : level === "warn"
                ? Effect.logWarning(message)
                : Effect.logDebug(message),
          );
        },
      },
    ),
    database: pool,
  });

  const context = yield* Effect.promise(() => auth.$context);

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
    handler: auth.handler,
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

    const response = yield* HttpEffect.fromWebHandler(auth.handler).pipe(
      Effect.provideService(HttpServerRequest.HttpServerRequest, request.modify({ headers })),
    );

    const withoutCookies = HttpServerResponse.updateCookies(response, () => Cookies.empty);

    return Option.match(Cookies.get(response.cookies, auth.challengeCookie), {
      onNone: () => withoutCookies,
      onSome: (cookie) =>
        HttpServerResponse.setHeader(withoutCookies, Accounts.challengeHeader, cookie.value),
    });
  }),
);
