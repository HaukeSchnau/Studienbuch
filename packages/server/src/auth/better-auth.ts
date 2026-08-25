import { passkey } from "@better-auth/passkey";
import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import { APIError, createAuthMiddleware } from "better-auth/api";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Database } from "../database/client.ts";
import { consumeSetupToken, resolveSetupUser } from "../access/operator.ts";
import { registrationTokenIsActive } from "../access/school-access.ts";

/**
 * What the calling application contributes.
 *
 * Framework and client plugins belong to the app, not here: `tanstackStartCookies()` is a web
 * concern and `expo()` is a mobile one, and `@stu/server` has no business knowing about either.
 * Everything that has to agree with `auth/schema.ts` stays below, so the mapping and the tables
 * cannot drift apart.
 */
export interface Options {
  readonly emailVerification?: BetterAuthOptions["emailVerification"];
  readonly passkeyRpID?: string;
  readonly sendResetPassword?: NonNullable<
    BetterAuthOptions["emailAndPassword"]
  >["sendResetPassword"];
  readonly plugins?: BetterAuthOptions["plugins"];
  readonly trustedOrigins?: BetterAuthOptions["trustedOrigins"];
}

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
      return betterAuth({
        database: database.pool,
        advanced: {
          database: {
            generateId: false,
          },
        },
        user: { modelName: "users" },
        session: { modelName: "sessions" },
        account: { modelName: "accounts" },
        verification: { modelName: "verifications" },
        emailVerification: options.emailVerification,
        emailAndPassword: {
          enabled: true,
          autoSignIn: false,
          requireEmailVerification: true,
          revokeSessionsOnPasswordReset: true,
          sendResetPassword: options.sendResetPassword,
        },
        hooks: {
          before: createAuthMiddleware(async (context) => {
            if (context.path !== "/sign-up/email") return;
            const token = context.headers?.get("x-studienbuch-registration") ?? null;
            if (!(await registrationTokenIsActive(database.pool, token))) {
              // oxlint-disable-next-line anti-slop/no-throwing-errors -- Better Auth middleware aborts requests through APIError.
              throw new APIError("BAD_REQUEST", {
                code: "SCHOOL_ACCESS_RESERVATION_REQUIRED",
                message: "A valid school access reservation is required",
              });
            }

            // Better Auth requires a name on every account. School users choose their identity in
            // the school-scoped notebook profile instead, so the global account deliberately keeps
            // a neutral value rather than collecting the same name twice.
            return { context: { body: { ...context.body, name: "Studienbuch-Konto" } } };
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
            registration: {
              requireSession: false,
              resolveUser: async ({ context }) => {
                const user = await resolveSetupUser(database.pool, context ?? null);
                if (user !== null) return user;
                // oxlint-disable-next-line anti-slop/no-throwing-errors -- Better Auth's callback has no typed failure return.
                throw new APIError("UNAUTHORIZED", {
                  code: "OPERATOR_SETUP_TOKEN_INVALID",
                  message: "The operator setup token is no longer valid",
                });
              },
              afterVerification: async ({ context, user }) => {
                if (context === null || context === undefined) return;
                const consumedForUserId = await consumeSetupToken(database.pool, context);
                if (consumedForUserId !== user.id) {
                  // oxlint-disable-next-line anti-slop/no-throwing-errors -- Better Auth's callback has no typed failure return.
                  throw new APIError("UNAUTHORIZED", {
                    code: "OPERATOR_SETUP_TOKEN_INVALID",
                    message: "The operator setup token is no longer valid",
                  });
                }
              },
            },
          }),
          ...(options.plugins ?? []),
        ],
      });
    }),
}) {}

export const layer = (options?: Options): Layer.Layer<Service, never, Database.Service> =>
  Layer.effect(Service, Service.make(options));

export * as Auth from "./better-auth.ts";
