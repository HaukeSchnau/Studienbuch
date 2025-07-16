import type { SchoolId } from "@stu/lib";
import { and, eq } from "drizzle-orm";
import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class YearRepository extends Effect.Service<YearRepository>()("student/YearRepository", {
  effect: Effect.gen(function* () {
    const doesYearExist = Effect.fn(function* (payload: {
      name: string;
      startYear: number;
      graduationYear: number;
      school: SchoolId;
    }) {
      const { execute } = yield* Database;
      const year = yield* execute((db) =>
        db.query.years.findFirst({
          where: and(eq(tables.years.startYear, payload.startYear), eq(tables.years.school, payload.school)),
        }),
      );
      return year !== undefined;
    });

    const createYear = Effect.fn(function* (payload: {
      name: string;
      startYear: number;
      graduationYear: number;
      school: SchoolId;
      classes: Array<{ identifierInYear: string; teachers: string[] }>;
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.years).values({
          name: payload.name,
          startYear: payload.startYear,
          graduationYear: payload.graduationYear,
          school: payload.school,
        }),
      );
      for (const cls of payload.classes) {
        yield* execute((db) =>
          db.insert(tables.classes).values({
            identifierInYear: cls.identifierInYear,
            startYear: payload.startYear,
            school: payload.school,
          }),
        );
        for (const teacher of cls.teachers) {
          yield* execute((db) =>
            db.insert(tables.teachersToClasses).values({
              teacher,
              classIdentifier: cls.identifierInYear,
              classStartYear: payload.startYear,
              school: payload.school,
            }),
          );
        }
      }
    }, Database.asTransaction);

    return {
      doesYearExist,
      createYear,
    };
  }),
}) {}
