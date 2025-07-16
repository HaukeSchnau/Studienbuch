import type { SchoolId, StateCode } from "@stu/lib";
import { eq } from "drizzle-orm";
import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class SchoolRepository extends Effect.Service<SchoolRepository>()("db/SchoolRepository", {
  effect: Effect.gen(function* () {
    const getSchool = Effect.fn(function* (payload: { id: SchoolId }) {
      const { execute } = yield* Database;
      const rows = yield* execute((db) => db.select().from(tables.Schools).where(eq(tables.Schools.id, payload.id)));
      return rows[0];
    });

    const doesSchoolExist = Effect.fn(function* (payload: { id: SchoolId }) {
      const school = yield* getSchool({ id: payload.id });
      return school !== undefined;
    });

    const createSchool = Effect.fn(function* (payload: {
      id: SchoolId;
      name: string;
      stateCode: StateCode;
      image: string;
      theme: Record<string, unknown>;
      kadmosName: string;
      kadmosUsername: string;
      kadmosPassword: string;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.Schools).values({
          id: payload.id,
          name: payload.name,
          stateCode: payload.stateCode,
          image: payload.image,
          theme: payload.theme,
          kadmosName: payload.kadmosName,
          kadmosUsername: payload.kadmosUsername,
          kadmosPassword: payload.kadmosPassword,
        }),
      );
    });

    const getSchoolsByState = Effect.fn(function* (payload: { state: StateCode }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.select().from(tables.Schools).where(eq(tables.Schools.stateCode, payload.state)),
      );
    });

    return {
      getSchool,
      doesSchoolExist,
      createSchool,
      getSchoolsByState,
    };
  }),
}) {}
