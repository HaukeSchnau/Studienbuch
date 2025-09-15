import { type SchoolId, SchoolRepository } from "@stu/lib";
import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const SchoolRepositoryLive = Layer.effect(
  SchoolRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    const getSchool = Effect.fn(function* (payload: { id: SchoolId }) {
      const { execute } = yield* databaseContext;
      return yield* execute((db) =>
        db.query.schools.findFirst({
          where: eq(tables.schools.id, payload.id),
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
        yield* execute((db) =>
          db.insert(tables.schools).values({
            id: payload.id,
            name: payload.name,
            stateCode: payload.state,
          }),
        );
      }),

      getSchoolsByState: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        return yield* execute((db) =>
          db.select().from(tables.schools).where(eq(tables.schools.stateCode, payload.state)),
        );
      }),
    };
  }),
);
