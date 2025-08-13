import { dateToSimpleDate, SemesterRepository, simpleDateToDate } from "@stu/lib";
import { and, desc, gte, lte, sql } from "drizzle-orm";
import { DateTime, Effect, Layer } from "effect";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

const mapDbSemester = (semester: typeof tables.Semesters.$inferSelect) => ({
  ...semester,
  start: dateToSimpleDate(semester.start),
  end: dateToSimpleDate(semester.end),
});

const toUtc = (date: Date) => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
};

export const SemesterRepositoryLive = Layer.effect(
  SemesterRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    return {
      createSemesters: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db
            .insert(tables.Semesters)
            .values(
              payload.map((semester) => ({
                ...semester,
                start: toUtc(simpleDateToDate(semester.start)),
                end: toUtc(simpleDateToDate(semester.end)),
              })),
            )
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
      }),

      getCurrentSemester: Effect.fn(function* () {
        const { execute } = yield* databaseContext;
        const today = yield* DateTime.now.pipe(Effect.andThen(DateTime.toDate));
        const semester = yield* execute((db) =>
          db.query.Semesters.findFirst({
            where: and(lte(tables.Semesters.start, today), gte(tables.Semesters.end, today)),
          }),
        );
        if (semester) return mapDbSemester(semester);

        // No current semester! Return the latest semester.
        return yield* execute((db) =>
          db.query.Semesters.findFirst({
            orderBy: [desc(tables.Semesters.start)],
          }),
        ).pipe(Effect.map((semester) => semester && mapDbSemester(semester)));
      }),
    };
  }),
);
