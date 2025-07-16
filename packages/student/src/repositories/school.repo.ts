import type { SchoolId, StateCode } from "@stu/lib";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class SchoolRepository extends Effect.Service<SchoolRepository>()("student/SchoolRepository", {
  effect: Effect.gen(function* () {
    const doesSchoolExist = Effect.fn(function* (payload: { id: SchoolId }) {
      const { execute } = yield* Database;
      const school = yield* execute((db) =>
        db.query.schools.findFirst({
          where: eq(tables.schools.id, payload.id),
        }),
      );
      return school !== undefined;
    });

    const createSchool = Effect.fn(function* (payload: { id: SchoolId; name: string; state: StateCode }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.schools).values({
          id: payload.id,
          name: payload.name,
          stateCode: payload.state,
        }),
      );
    });

    const getSchoolsByState = Effect.fn(function* (payload: { state: StateCode }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.select().from(tables.schools).where(eq(tables.schools.stateCode, payload.state)),
      );
    });

    return {
      doesSchoolExist,
      createSchool,
      getSchoolsByState,
    };
  }),
}) {}
