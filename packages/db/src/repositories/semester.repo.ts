import { dateToSimpleDate, type SchoolId, SemesterRepository, simpleDateToDate, type Year } from "@stu/lib";
import { and, asc, desc, eq, gt, gte, lt, lte, or, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
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

    const getSemesterOnDate = Effect.fn(function* (date: Date, school: SchoolId) {
      const { execute } = yield* databaseContext;
      const semester = yield* execute((db) =>
        db.query.Semesters.findFirst({
          where: and(
            lte(tables.Semesters.start, date),
            gte(tables.Semesters.end, date),
            eq(tables.Semesters.school, school),
          ),
        }),
      );
      return semester && mapDbSemester(semester);
    });

    const getNextSemesterAfterDate = Effect.fn(function* (date: Date, school: SchoolId) {
      const { execute } = yield* databaseContext;
      const semester = yield* execute((db) =>
        db.query.Semesters.findFirst({
          where: and(gte(tables.Semesters.start, date), eq(tables.Semesters.school, school)),
          orderBy: [asc(tables.Semesters.start)],
        }),
      );
      return semester && mapDbSemester(semester);
    });

    const getLatestSemester = Effect.fn(function* (school: SchoolId) {
      const { execute } = yield* databaseContext;
      const semester = yield* execute((db) =>
        db.query.Semesters.findFirst({
          where: eq(tables.Semesters.school, school),
          orderBy: [desc(tables.Semesters.start)],
        }),
      );
      return semester && mapDbSemester(semester);
    });

    const semestersInYear = Effect.fn(function* (year: Year) {
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

      const semesters = yield* execute((db) =>
        db.query.Semesters.findMany({
          where: and(eq(tables.Semesters.school, year.school), or(summerSemesterIsInRange, winterSemesterIsInRange)),
        }),
      );
      return semesters.map(mapDbSemester);
    });

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

      getSemesterOnDate,
      getNextSemesterAfterDate,
      getLatestSemester,
      semestersInYear,
    };
  }),
);
