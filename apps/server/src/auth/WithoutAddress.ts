/**
 * Accounts without an email address (D97): a passkey signs up, or on a device without passkeys the
 * Notfallkarte, which then signs in anywhere. Each sign-up takes a code's use before the account
 * exists, since nobody confirms anything. Its placeholder address takes no mail and no email route.
 */
import { runWithTransaction } from "@better-auth/core/context";
import { createPlaceholderEmail } from "@better-auth/core/utils/email";
import type { PasskeyOptions } from "@better-auth/passkey";
import { Access } from "@stu/api/Access";
import { Accounts } from "@stu/api/Accounts";
import type { Spaces, SyncWriter } from "@stu/sync/server";
import type { BetterAuthPlugin } from "better-auth";
import {
  APIError,
  createAuthEndpoint,
  createAuthMiddleware,
  getSessionFromCtx,
  isAPIError,
} from "better-auth/api";
import { setSessionCookie } from "better-auth/cookies";
import { generateRandomString } from "better-auth/crypto";
import type * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Option from "effect/Option";
import * as Result from "effect/Result";
import * as Schema from "effect/Schema";
import * as SqlClient from "effect/sql/SqlClient";
import { AccessCodes } from "../school/AccessCodes.ts";
import { CardLogins } from "./CardLogins.ts";
import { FreshSignIn } from "./FreshSignIn.ts";

export * as WithoutAddress from "./WithoutAddress.ts";

/** What the effects this plugin runs need: the database, and the sync writers admission uses. */
export type Needs = SqlClient.SqlClient | Crypto.Crypto | Spaces.Service | SyncWriter.Service;

export interface Callbacks {
  /** Runs an effect with the server's services. A failure rejects with the error it failed with. */
  readonly run: <A, E>(effect: Effect.Effect<A, E, Needs>) => Promise<A>;
  /** The session a request's headers carry, as every route resolves it, bearer token included. */
  readonly session: (headers: Headers) => Promise<{
    readonly session: { readonly id: string; readonly userId: string };
    readonly user: { readonly email: string };
  } | null>;
}

type Status = "BAD_REQUEST" | "UNAUTHORIZED" | "FORBIDDEN";

/** Better Auth answers a request that fails with an APIError as that error. */
const refused = (status: Status, error: { readonly code: string; readonly message: string }) =>
  Effect.fail(APIError.from(status, error));

// The passkey plugin's own callbacks run outside Effect, where rejecting refuses the request.
const rejected = (status: Status, error: { readonly code: string; readonly message: string }) =>
  // oxlint-disable-next-line studienbuch/no-throwing-errors -- Better Auth refuses a request by rejecting with APIError.
  Promise.reject(APIError.from(status, error));

const reservationRefused = {
  code: Access.reservationRefused,
  message: "A sign-up needs a school's access code",
};

// What Better Auth's own `freshSessionMiddleware` answers, which the app one release back knows.
const signedOut = { code: "UNAUTHORIZED", message: "Unauthorized" };

const notFresh = { code: "SESSION_NOT_FRESH", message: "Session is not fresh" };

const unknownCard = { code: Accounts.unknownCard, message: "No account has this card" };

const invalidEmail = { code: "INVALID_EMAIL", message: "Invalid email" };

const lastWayIn = {
  code: Accounts.lastWayIn,
  message: "An account without an address keeps a passkey or a card",
};

/** Better Auth's account for a new account without an address. Its name lives in the notebook. */
const newUser = () => ({
  // A random id that isn't the account's, so the address says nothing.
  email: createPlaceholderEmail({
    identifier: generateRandomString(24, "a-z", "0-9"),
    namespace: "konto",
  }),
  name: "",
  emailVerified: false,
});

/** What the keychain shows for a passkey of an account without an address, unless the app names it. */
const passkeyName = "Studienbuch";

const registrationPaths = new Set([
  "/passkey/generate-register-options",
  "/passkey/verify-registration",
]);

// A reset request never reaches this plugin: `Auth` answers it in its own hook. For a placeholder
// it makes codes that only these routes would take.
const emailPaths = new Set([
  "/sign-up/email",
  "/sign-in/email",
  "/send-verification-email",
  "/email-otp/verify-email",
  "/email-otp/reset-password",
]);

/** Routes `Auth` limits per client address, as it does every sign-up and sign-in. */
export const limitedRoutes = [Accounts.cardSignUpPath, Accounts.cardSignInPath];

/** Routes whose successful sign-up gives the client's count back, as an email sign-up does. */
export const reservedRoutes = [Accounts.cardSignUpPath];

const LoginBody = Schema.toStandardSchemaV1(Schema.Struct({ login: Accounts.Login }));

const decodeEmail = Schema.decodeUnknownOption(Schema.Struct({ email: Schema.String }));

const decodePasskeyId = Schema.decodeUnknownOption(Schema.Struct({ id: Schema.String }));

const decodeCreated = Schema.decodeUnknownResult(
  Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
);

interface Headed {
  readonly headers?: Headers | undefined;
}

const reservationOf = (context: Headed) =>
  Option.fromNullishOr(context.headers?.get(Access.reservationHeader));

/**
 * A registration without a bearer token and with a reservation signs up; one with a token adds a
 * passkey to its session's account. It rests on the headers alone, so every step of one request
 * decides alike.
 */
const signingUp = (context: Headed) =>
  context.headers?.has("authorization") !== true && Option.isSome(reservationOf(context));

/** Whether deleting the passkey leaves an account without an address with no way in. */
const isLastWayIn = Effect.fn("WithoutAddress.isLastWayIn")(function* (passkey: string) {
  const sql = yield* SqlClient.SqlClient;

  const [row] = yield* sql<{
    readonly account: string;
    readonly others: number;
    readonly card: boolean;
  }>`
    select p."userId" as account,
      (select count(*)::int from auth_passkey o
        where o."userId" = p."userId" and o.id <> p.id) as others,
      exists (
        select 1 from auth_account a
        where a."userId" = p."userId" and a."providerId" = ${CardLogins.provider}
      ) as card
    from auth_passkey p where p.id = ${passkey}
  `;

  return (
    row !== undefined &&
    row.others === 0 &&
    !row.card &&
    !(yield* CardLogins.hasAddress(row.account))
  );
});

/** Admits a new account without an address, whose use is spent. A failure leaves it without a school. */
const admit = (account: string, reservation: string) =>
  AccessCodes.admitSignedUp(account, reservation).pipe(
    Effect.catchCause((cause) =>
      Effect.logError("A sign-up without an address wasn't admitted", cause),
    ),
    Effect.asVoid,
  );

/**
 * The passkey plugin's registration without a session, for a sign-up that starts with a passkey.
 * The plugin then drops its fresh-session check for everyone, so `plugin`'s hook puts it back for a
 * signed-in request, and lets one without a session through only with a reservation.
 */
export const registration: PasskeyOptions["registration"] = {
  requireSession: false,
  // A stand-in: the account comes into being only once the passkey verifies.
  resolveUser: ({ ctx }) =>
    signingUp(ctx)
      ? Promise.resolve({ id: "sign-up", name: ctx.query?.name ?? passkeyName })
      : rejected("UNAUTHORIZED", signedOut),
  // Runs in the transaction that stores the passkey and makes the session.
  afterVerification: ({ ctx }) =>
    getSessionFromCtx(ctx).then((session) =>
      session !== null
        ? signingUp(ctx)
          ? rejected("UNAUTHORIZED", signedOut)
          : undefined
        : signingUp(ctx) && ctx.body?.createSession === true
          ? ctx.context.internalAdapter
              .createUser(newUser(), { method: "passkey" })
              .then((user) => ({ userId: user.id }))
          : rejected("UNAUTHORIZED", signedOut),
    ),
};

type Context = Parameters<typeof setSessionCookie>[0];

export const plugin = (callbacks: Callbacks) => {
  const { run } = callbacks;

  /** A new session of the account, handed to the device as every sign-in hands it. */
  const signIn = Effect.fn("WithoutAddress.signIn")(function* (ctx: Context, account: string) {
    const adapter = ctx.context.internalAdapter;
    const user = yield* Effect.promise(() => adapter.findUserById(account));

    if (user === null) return yield* refused("UNAUTHORIZED", unknownCard);

    const session = yield* Effect.promise(() => adapter.createSession(account));

    yield* Effect.promise(() => setSessionCookie(ctx, { session, user }));

    return { user: { id: account } };
  });

  /** Creates the account, its card login and its first session in one transaction. */
  const create = (ctx: Context, accountId: string) => {
    const adapter = ctx.context.internalAdapter;

    return runWithTransaction(
      ctx.context.adapter,
      () =>
        adapter.createUser(newUser(), { method: "recovery-code" }).then((user) =>
          adapter
            .createAccount({ userId: user.id, providerId: CardLogins.provider, accountId })
            .then(() => adapter.createSession(user.id))
            .then((session) => ({ user, session })),
        ),
      // Better Auth types the callback's promise as the result, which a promise unwraps.
    ).then((created) => created);
  };

  const cardSignUp = createAuthEndpoint(
    Accounts.cardSignUpPath,
    { method: "POST", body: LoginBody, requireHeaders: true },
    (ctx) =>
      run(
        Effect.gen(function* () {
          const { login } = ctx.body;
          const known = yield* CardLogins.owner(login);

          // A retry after a lost answer: the card already made its account.
          if (Option.isSome(known)) return yield* signIn(ctx, known.value);

          const reservation = Option.getOrNull(reservationOf(ctx));

          if (reservation === null || !(yield* AccessCodes.takeUse(reservation))) {
            return yield* refused("BAD_REQUEST", reservationRefused);
          }

          const accountId = yield* CardLogins.digest(login);

          const created = yield* Effect.promise(() => create(ctx, accountId)).pipe(
            Effect.onError(() => AccessCodes.returnUse(reservation).pipe(Effect.ignore)),
          );

          yield* Effect.promise(() => setSessionCookie(ctx, created));
          yield* admit(created.user.id, reservation);

          return { user: { id: created.user.id } };
        }),
      ),
  );

  const cardSignIn = createAuthEndpoint(
    Accounts.cardSignInPath,
    { method: "POST", body: LoginBody },
    (ctx) =>
      run(
        Effect.flatMap(CardLogins.owner(ctx.body.login), (owner) =>
          Option.isSome(owner) ? signIn(ctx, owner.value) : refused("UNAUTHORIZED", unknownCard),
        ),
      ),
  );

  // Runs after `Auth`'s own hook, which charged a sign-up's reservation already.
  const refusePlaceholder = createAuthMiddleware((ctx) =>
    run(
      Effect.gen(function* () {
        const reservation = reservationOf(ctx);

        if (ctx.path === "/sign-up/email" && Option.isSome(reservation)) {
          yield* AccessCodes.releaseSignUp(reservation.value);
        }

        return yield* refused("BAD_REQUEST", invalidEmail);
      }),
    ),
  );

  const registering = createAuthMiddleware((ctx) =>
    run(
      Effect.gen(function* () {
        const verifying = ctx.path === "/passkey/verify-registration";

        if (signingUp(ctx)) {
          const reservation = Option.getOrElse(reservationOf(ctx), () => "");

          const allowed = verifying
            ? yield* AccessCodes.takeUse(reservation)
            : yield* AccessCodes.usable(reservation);

          if (!allowed) return yield* refused("BAD_REQUEST", reservationRefused);

          // The new account's first session, made with the passkey in one transaction.
          return verifying
            ? { context: { body: { ...ctx.body, createSession: true } } }
            : undefined;
        }

        const headers = ctx.headers;

        const found =
          headers === undefined ? null : yield* Effect.promise(() => callbacks.session(headers));

        if (found === null) return yield* refused("UNAUTHORIZED", signedOut);

        if (!(yield* FreshSignIn.isFresh(found.session.userId, found.session.id))) {
          return yield* refused("FORBIDDEN", notFresh);
        }

        // A new passkey signs nobody in, so a fresh sign-in can't be stretched by registering
        // again. The passkey's name and display name (the passkey patch) are never a placeholder.
        return verifying
          ? { context: { body: { ...ctx.body, createSession: false } } }
          : Accounts.isPlaceholder(found.user.email)
            ? { context: { query: { ...ctx.query, name: ctx.query?.name ?? passkeyName } } }
            : undefined;
      }),
    ),
  );

  const deletingPasskey = createAuthMiddleware((ctx) =>
    run(
      Option.match(decodePasskeyId(ctx.body), {
        onNone: () => Effect.void,
        onSome: ({ id }) =>
          Effect.flatMap(isLastWayIn(id), (last) =>
            last ? refused("BAD_REQUEST", lastWayIn) : Effect.void,
          ),
      }),
    ),
  );

  const registered = createAuthMiddleware((ctx) => {
    const reservation = Option.getOrElse(reservationOf(ctx), () => "");
    const created = decodeCreated(ctx.context.returned);

    return run(
      isAPIError(ctx.context.returned) || Result.isFailure(created)
        ? AccessCodes.returnUse(reservation)
        : admit(created.success.user.id, reservation),
    );
  });

  return {
    id: "studienbuch-without-address",
    endpoints: { cardSignUp, cardSignIn },
    hooks: {
      before: [
        {
          matcher: (context) =>
            emailPaths.has(context.path ?? "") &&
            Option.exists(decodeEmail(context.body), ({ email }) => Accounts.isPlaceholder(email)),
          handler: refusePlaceholder,
        },
        { matcher: (context) => registrationPaths.has(context.path ?? ""), handler: registering },
        {
          matcher: (context) => context.path === "/passkey/delete-passkey",
          handler: deletingPasskey,
        },
      ],
      after: [
        {
          matcher: (context) =>
            context.path === "/passkey/verify-registration" && signingUp(context),
          handler: registered,
        },
      ],
    },
  } satisfies BetterAuthPlugin;
};
