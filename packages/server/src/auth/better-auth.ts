import { betterAuth } from "better-auth";
import type { BetterAuthOptions } from "better-auth";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import { Database } from "../database/client.ts";

/**
 * What the calling application contributes.
 *
 * Framework and client plugins belong to the app, not here: `tanstackStartCookies()` is a web
 * concern and `expo()` is a mobile one, and `@stu/server` has no business knowing about either.
 * Everything that has to agree with `auth/schema.ts` stays below, so the mapping and the tables
 * cannot drift apart.
 */
export interface Options {
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
        emailAndPassword: {
          enabled: true,
        },
        trustedOrigins: options.trustedOrigins,
        plugins: options.plugins,
      });
    }),
}) {}

export const layer = (options?: Options): Layer.Layer<Service, never, Database.Service> =>
  Layer.effect(Service, Service.make(options));

export * as Auth from "./better-auth.ts";
