import { SemesterRepository } from "@stu/lib";
import { and, desc, gte, lte, sql } from "drizzle-orm";
import { DateTime, Effect, Layer } from "effect";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const SemesterRepositoryLive = Layer.effect(
  SemesterRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    return {
      createSemesters: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db
            .insert(tables.semesters)
            .values(payload)
            .onConflictDoUpdate({
              target: [tables.semesters.school, tables.semesters.type, tables.semesters.year],
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
      }),

      getCurrentSemester: Effect.fn(function* () {
        const { execute } = yield* databaseContext;
        const today = yield* DateTime.now.pipe(Effect.andThen(DateTime.toDate));
        const semester = yield* execute((db) =>
          db.query.semesters.findFirst({
            where: and(lte(tables.semesters.start, today), gte(tables.semesters.end, today)),
          }),
        );
        if (semester) return semester;

        // No current semester! Return the latest semester.
        return yield* execute((db) =>
          db.query.semesters.findFirst({
            orderBy: [desc(tables.semesters.start)],
          }),
        );
      }),
    };
  }),
);
