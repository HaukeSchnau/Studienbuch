import { passkey } from "@better-auth/passkey";
import { Organization } from "@stu/core/organization";
import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import * as Context from "effect/Context";
import type * as Crypto from "effect/Crypto";
import * as Effect from "effect/Effect";
import * as Exit from "effect/Exit";
import * as Layer from "effect/Layer";
import * as Schema from "effect/Schema";
import { Database } from "../database/client.ts";
import { claimRegistrationSignup, releaseRegistrationSignup } from "../access/school-access.ts";

/**
 * What the calling application contributes.
 *
 * Framework and client plugins belong to the app, not here: `tanstackStartCookies()` is a web
 * concern and `expo()` is a mobile one, and `@stu/server` has no business knowing about either.
 * Everything that has to agree with `auth/schema.ts` stays below, so the mapping and the tables
 * cannot drift apart.
 */
type VerificationSender = NonNullable<
  NonNullable<BetterAuthOptions["emailVerification"]>["sendVerificationEmail"]
>;

type ResetSender = NonNullable<
  NonNullable<BetterAuthOptions["emailAndPassword"]>["sendResetPassword"]
>;

export interface Options {
  readonly emailVerification?: Omit<
    NonNullable<BetterAuthOptions["emailVerification"]>,
    "sendVerificationEmail"
  > & {
    readonly sendVerificationEmail: (
      data: Parameters<VerificationSender>[0],
    ) => Effect.Effect<void, object>;
  };
  readonly passkeyRpID?: string;
  readonly sendResetPassword?: (data: Parameters<ResetSender>[0]) => Effect.Effect<void, object>;
  readonly plugins?: BetterAuthOptions["plugins"];
  readonly trustedOrigins?: BetterAuthOptions["trustedOrigins"];
}

/** The reservation a registration request presents, as a header so it never lands in a log line. */
const registrationToken = (context: { readonly headers?: Headers }) =>
  context.headers?.get("x-studienbuch-registration") ?? null;

/**
 * A `/sign-up/email` response that describes an account.
 *
 * After-hooks also run for a call the endpoint rejected, where `returned` is the error instead, so
 * this is what tells the two apart.
 */
const decodeSignUpResult = Schema.decodeUnknownExit(
  Schema.Struct({ user: Schema.Struct({ id: Schema.String }) }),
);
const decodeAccountName = Schema.decodeUnknownExit(Organization.AccountName);

/**
 * Better Auth, wired to the same pool as Drizzle.
 *
 * Better Auth's Drizzle adapter expects a Promise-based instance and cannot consume
 * `EffectPgDatabase`, so it gets the raw pool and runs through its Kysely adapter instead. That is
 * a deliberate choice rather than a shortcut, and it carries one obligation: the model names below
 * and the tables in `auth/schema.ts` are checked by nothing but agreement, because `db:generate`
 * cannot see this file.
 *
 * `generateId: false` is what lets the database own identity through `defaultRandom()`.
 */
export class Service extends Context.Service<Service>()("@stu/server/auth/better-auth/Service", {
  make: (options: Options = {}) =>
    Effect.gen(function* () {
      const database = yield* Database.Service;
      const callbackContext = yield* Effect.context<Crypto.Crypto | Database.Service>();
      const runCallback = <A, E>(effect: Effect.Effect<A, E, Crypto.Crypto | Database.Service>) =>
        Effect.runPromiseWith(callbackContext)(effect);
      const verificationOption = options.emailVerification;
      const emailVerification =
        verificationOption === undefined
          ? undefined
          : {
              ...verificationOption,
              sendVerificationEmail: (data: Parameters<VerificationSender>[0]) =>
                runCallback(verificationOption.sendVerificationEmail(data)),
            };
      const resetOption = options.sendResetPassword;
      const sendResetPassword =
        resetOption === undefined
          ? undefined
          : (data: Parameters<ResetSender>[0]) => runCallback(resetOption(data));
      return betterAuth({
        database: database.pool,
        advanced: {
          database: {
            generateId: false,
          },
        },
        user: { modelName: "users", changeEmail: { enabled: true } },
        session: { modelName: "sessions" },
        account: { modelName: "accounts" },
        verification: { modelName: "verifications" },
        emailVerification,
        emailAndPassword: {
          enabled: true,
          autoSignIn: false,
          requireEmailVerification: true,
          revokeSessionsOnPasswordReset: true,
          sendResetPassword,
        },
        hooks: {
          before: createAuthMiddleware(async (context) => {
            if (context.path === "/update-user" && context.body.name !== undefined) {
              const name = decodeAccountName(context.body.name);
              if (Exit.isFailure(name)) {
                // oxlint-disable-next-line anti-slop/no-throwing-errors -- Better Auth middleware aborts requests through APIError.
                throw new APIError("BAD_REQUEST", {
                  code: "ACCOUNT_NAME_INVALID",
                  message: "A valid account name is required",
                });
              }
              return { context: { body: { ...context.body, name: name.value } } };
            }
            if (context.path !== "/sign-up/email") return;
            if (!(await runCallback(claimRegistrationSignup(registrationToken(context))))) {
              // oxlint-disable-next-line anti-slop/no-throwing-errors -- Better Auth middleware aborts requests through APIError.
              throw new APIError("BAD_REQUEST", {
                code: "SCHOOL_ACCESS_RESERVATION_REQUIRED",
                message: "A valid school access reservation is required",
              });
            }

            const name = decodeAccountName(context.body.name);
            if (Exit.isFailure(name)) {
              // oxlint-disable-next-line anti-slop/no-throwing-errors -- Better Auth middleware aborts requests through APIError.
              throw new APIError("BAD_REQUEST", {
                code: "ACCOUNT_NAME_INVALID",
                message: "A valid account name is required",
              });
            }
            return { context: { body: { ...context.body, name: name.value } } };
          }),
          /**
           * Returns a signup claim when Better Auth rejects the request before producing an account.
           *
           * The claim happens in `before`, atomically with its budget check, so parallel requests
           * cannot all pass a read-only check and overshoot the budget. After-hooks run for failed
           * endpoint calls too, which lets an invalid body return its claim.
           *
           * Better Auth answers a signup for an address it already knows with a synthetic account
           * rather than an error, so that no one can use signup to test whether an address is
           * registered. Charging for that response as well is what keeps the two indistinguishable.
           */
          after: createAuthMiddleware(async (context) => {
            if (context.path !== "/sign-up/email") return;
            if (Exit.isSuccess(decodeSignUpResult(context.context.returned))) return;
            await runCallback(releaseRegistrationSignup(registrationToken(context)));
          }),
        },
        trustedOrigins: options.trustedOrigins,
        plugins: [
          passkey({
            rpID: options.passkeyRpID,
            rpName: "Studienbuch",
            authenticatorSelection: {
              residentKey: "required",
              userVerification: "required",
            },
          }),
          ...(options.plugins ?? []),
        ],
      });
    }),
}) {}

export const layer = (
  options?: Options,
): Layer.Layer<Service, never, Crypto.Crypto | Database.Service> =>
  Layer.effect(Service, Service.make(options));

export * as Auth from "./better-auth.ts";
