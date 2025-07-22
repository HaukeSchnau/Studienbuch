import type { SchoolId } from "@stu/lib";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class ClassRepository extends Effect.Service<ClassRepository>()("db/ClassRepository", {
  effect: Effect.gen(function* () {
    const createClass = Effect.fn(function* (payload: {
      identifierInYear: string;
      startYear: number;
      school: SchoolId;
      teachers: string[];
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.Classes).values({
          identifierInYear: payload.identifierInYear,
          startYear: payload.startYear,
          school: payload.school,
        }),
      );
      for (const teacher of payload.teachers) {
        yield* execute((db) =>
          db.insert(tables.TeachersToClasses).values({
            teacher,
            classIdentifier: payload.identifierInYear,
            classStartYear: payload.startYear,
            school: payload.school,
          }),
        );
      }
    }, Database.asTransaction);

    const getClass = Effect.fn(function* (payload: { identifierInYear: string; startYear: number; school: SchoolId }) {
      const { execute } = yield* Database;
      return yield* execute((db) =>
        db.query.Classes.findFirst({
          where: and(
            eq(tables.Classes.school, payload.school),
            eq(tables.Classes.identifierInYear, payload.identifierInYear),
            eq(tables.Classes.startYear, payload.startYear),
          ),
        }),
      );
    });

    return {
      createClass,
      getClass,
    };
  }),
}) {}
