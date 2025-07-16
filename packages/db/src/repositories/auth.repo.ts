import type { SchoolId } from "@stu/lib";
import { and, count, eq } from "drizzle-orm";
import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class AuthRepository extends Effect.Service<AuthRepository>()("auth/AuthRepository", {
  effect: Effect.gen(function* () {
    const getLicenseKey = Effect.fn(function* (payload: { key: string }) {
      const { execute } = yield* Database;
      const rows = yield* execute((db) =>
        db.select().from(tables.LicenseKeys).where(eq(tables.LicenseKeys.key, payload.key)),
      );
      return rows[0];
    });

    const doesLicenseKeyExist = Effect.fn(function* (payload: { key: string }) {
      const licenseKey = yield* getLicenseKey({ key: payload.key });
      return licenseKey !== undefined;
    });

    const createLicenseKey = Effect.fn(function* (payload: {
      key: string;
      school: SchoolId;
      expiresAt: Date;
      isSuperKey: boolean;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.LicenseKeys).values({
          key: payload.key,
          school: payload.school,
          expiresAt: payload.expiresAt,
          isSuperKey: payload.isSuperKey,
        }),
      );
    });

    const verifyUserLicense = Effect.fn(function* (payload: { userId: string; schoolId: SchoolId }) {
      const { execute } = yield* Database;

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
    });

    const createUser = Effect.fn(function* (payload: { userId: string }) {
      const { execute } = yield* Database;
      yield* execute((db) => db.insert(tables.Users).values({ id: payload.userId }));
    });

    const activateLicenseKey = Effect.fn(function* (payload: { key: string; userId: string }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db
          .update(tables.LicenseKeys)
          .set({ activatedBy: payload.userId, activatedAt: new Date() })
          .where(eq(tables.LicenseKeys.key, payload.key)),
      );
    });

    return {
      getLicenseKey,
      doesLicenseKeyExist,
      createLicenseKey,
      verifyUserLicense,
      createUser,
      activateLicenseKey,
    };
  }),
}) {}
