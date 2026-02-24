import { createSemestersCore, semesterRepositoryLogic, SemesterRepository, simpleDateToDate } from "@stu/lib";
import { and, asc, desc, eq, gt, gte, lt, lte, or, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

const toUtc = (date: Date) => {
  return new Date(date.getTime() - date.getTimezoneOffset() * 60000);
};

export const SemesterRepositoryLive = Layer.effect(
  SemesterRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    const semesterRepository = semesterRepositoryLogic({
      getSemesterOnDate: Effect.fn(function* (date, school) {
        const { execute } = yield* databaseContext;
        return yield* execute((db) =>
          db.query.Semesters.findFirst({
            where: and(
              lte(tables.Semesters.start, date),
              gte(tables.Semesters.end, date),
              eq(tables.Semesters.school, school),
            ),
          }),
        );
      }),

      getNextSemesterAfterDate: Effect.fn(function* (date, school) {
        const { execute } = yield* databaseContext;
        return yield* execute((db) =>
          db.query.Semesters.findFirst({
            where: and(gte(tables.Semesters.start, date), eq(tables.Semesters.school, school)),
            orderBy: [asc(tables.Semesters.start)],
          }),
        );
      }),

      getLatestSemester: Effect.fn(function* (school) {
        const { execute } = yield* databaseContext;
        return yield* execute((db) =>
          db.query.Semesters.findFirst({
            where: eq(tables.Semesters.school, school),
            orderBy: [desc(tables.Semesters.start)],
          }),
        );
      }),

      semestersInYear: Effect.fn(function* (year) {
        const { execute } = yield* databaseContext;

        const summerSemesterIsInRange = and(
          eq(tables.Semesters.type, "SUMMER"),
          gt(tables.Semesters.year, year.startYear),
          lte(tables.Semesters.year, year.graduationYear),
        );
        const winterSemesterIsInRange = and(
          eq(tables.Semesters.type, "WINTER"),
          gte(tables.Semesters.year, year.startYear),
          lt(tables.Semesters.year, year.graduationYear),
        );

        return yield* execute((db) =>
          db.query.Semesters.findMany({
            where: and(eq(tables.Semesters.school, year.school), or(summerSemesterIsInRange, winterSemesterIsInRange)),
          }),
        );
      }),
    });

    return {
      createSemesters: createSemestersCore({
        convertDate: (date) => toUtc(simpleDateToDate(date)),
        upsertSemesters: Effect.fn(function* (payload) {
          const { execute } = yield* databaseContext;
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
        }),
      }),

      ...semesterRepository,
    };
  }),
);
