import type { SchoolId } from "@stu/lib";
import { and, desc, gte, lte, sql } from "drizzle-orm";
import { DateTime, Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";
import { Semesters } from "../schema";

export class SemesterRepository extends Effect.Service<SemesterRepository>()("db/SemesterRepository", {
  effect: Effect.gen(function* () {
    const createSemesters = Effect.fn(function* (
      payload: { name: string; start: Date; end: Date; type: "WINTER" | "SUMMER"; year: number; school: SchoolId }[],
    ) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db
          .insert(tables.Semesters)
          .values(payload)
          .onConflictDoUpdate({
            target: [tables.Semesters.school, tables.Semesters.type, tables.Semesters.year],
            set: {
              name: sql`excluded.name`,
              start: sql`excluded.start`,
              end: sql`excluded.end`,
              type: sql`excluded.type`,
              year: sql`excluded.year`,
              school: sql`excluded.school`,
            },
          }),
      );
    });

    const getCurrentSemester = Effect.gen(function* () {
      const { execute } = yield* Database;
      const today = yield* DateTime.now.pipe(Effect.andThen(DateTime.toDate));
      const semester = yield* execute((db) =>
        db.query.Semesters.findFirst({
          where: and(lte(Semesters.start, today), gte(Semesters.end, today)),
        }),
      );
      if (semester) return semester;

      // No current semester! Return the latest semester.
      return yield* execute((db) =>
        db.query.Semesters.findFirst({
          orderBy: [desc(Semesters.start)],
        }),
      );
    });

    return { createSemesters, getCurrentSemester };
  }),
}) {}
