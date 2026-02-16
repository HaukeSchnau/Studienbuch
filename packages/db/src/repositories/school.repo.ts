import { defaultSchools, type SchoolId, SchoolRepository } from "@stu/lib";
import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

const getRequiredUntisCredential = (key: "UNTIS_KADMOS_NAME" | "UNTIS_KADMOS_USERNAME" | "UNTIS_KADMOS_PASSWORD") => {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required environment variable: ${key}`);
  return value;
};

export const SchoolRepositoryLive = Layer.effect(
  SchoolRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    const getSchool = Effect.fn(function* (payload: { id: SchoolId }) {
      const { execute } = yield* databaseContext;
      return yield* execute((db) =>
        db.query.Schools.findFirst({
          where: eq(tables.Schools.id, payload.id),
        }),
      );
    });

    return {
      getSchool,

      doesSchoolExist: Effect.fn(function* (payload) {
        const school = yield* getSchool({ id: payload.id });
        return school !== undefined;
      }),

      createSchool: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        const defaultSchool = defaultSchools[payload.id];
        const kadmosName = yield* Effect.sync(() => getRequiredUntisCredential("UNTIS_KADMOS_NAME"));
        const kadmosUsername = yield* Effect.sync(() => getRequiredUntisCredential("UNTIS_KADMOS_USERNAME"));
        const kadmosPassword = yield* Effect.sync(() => getRequiredUntisCredential("UNTIS_KADMOS_PASSWORD"));

        yield* execute((db) =>
          db.insert(tables.Schools).values({
            id: payload.id,
            name: payload.name,
            stateCode: payload.state,
            image: defaultSchool.image,
            kadmosName,
            kadmosPassword,
            kadmosUsername,
            theme: defaultSchool.theme,
          }),
        );
      }),

      getSchoolsByState: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        return yield* execute((db) =>
          db.select().from(tables.Schools).where(eq(tables.Schools.stateCode, payload.state)),
        );
      }),
    };
  }),
);
