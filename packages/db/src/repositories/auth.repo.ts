import { AuthRepository } from "@stu/lib";
import { and, count, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const AuthRepositoryLive = Layer.effect(
  AuthRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    const getLicenseKey = Effect.fn(function* (payload: { key: string }) {
      const { execute } = yield* databaseContext;
      const rows = yield* execute((db) =>
        db.select().from(tables.LicenseKeys).where(eq(tables.LicenseKeys.key, payload.key)),
      );
      return rows[0];
    });

    return {
      getLicenseKey,

      doesLicenseKeyExist: Effect.fn(function* (payload) {
        const licenseKey = yield* getLicenseKey({ key: payload.key });
        return licenseKey !== undefined;
      }),

      createLicenseKey: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db.insert(tables.LicenseKeys).values({
            key: payload.key,
            school: payload.school,
            expiresAt: payload.expiresAt,
            isSuperKey: payload.isSuperKey,
          }),
        );
      }),

      verifyUserLicense: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        const rows = yield* execute((db) =>
          db
            .select({
              count: count(),
            })
            .from(tables.Users)
            .innerJoin(tables.LicenseKeys, eq(tables.Users.id, tables.LicenseKeys.activatedBy))
            .innerJoin(tables.Schools, eq(tables.LicenseKeys.school, tables.Schools.id))
            .where(and(eq(tables.Users.id, payload.userId), eq(tables.Schools.id, payload.schoolId))),
        );

        return (rows[0]?.count ?? 0) > 0;
      }),

      createUser: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) => db.insert(tables.Users).values({ id: payload.userId }));
      }),

      activateLicenseKey: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db
            .update(tables.LicenseKeys)
            .set({ activatedBy: payload.userId, activatedAt: new Date() })
            .where(eq(tables.LicenseKeys.key, payload.key)),
        );
      }),
    };
  }),
);
