import { semesterRepositoryLogic, SemesterRepository, simpleDateToDate } from "@stu/lib";
import { and, asc, desc, eq, gt, gte, lt, lte, or, sql } from "drizzle-orm";
import { Effect, Layer } from "effect";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const SemesterRepositoryLive = Layer.effect(
  SemesterRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    const semesterRepository = semesterRepositoryLogic({
      getSemesterOnDate: Effect.fn(function* (date, school) {
        const { execute } = yield* databaseContext;
        return yield* execute((db) =>
          db.query.semesters.findFirst({
            where: and(
              lte(tables.semesters.start, date),
              gte(tables.semesters.end, date),
              eq(tables.semesters.school, school),
            ),
          }),
        );
      }),

      getNextSemesterAfterDate: Effect.fn(function* (date, school) {
        const { execute } = yield* databaseContext;
        return yield* execute((db) =>
          db.query.semesters.findFirst({
            where: and(gte(tables.semesters.start, date), eq(tables.semesters.school, school)),
            orderBy: [asc(tables.semesters.start)],
          }),
        );
      }),

      getLatestSemester: Effect.fn(function* (school) {
        const { execute } = yield* databaseContext;
        return yield* execute((db) =>
          db.query.semesters.findFirst({
            where: eq(tables.semesters.school, school),
            orderBy: [desc(tables.semesters.start)],
          }),
        );
      }),

      semestersInYear: Effect.fn(function* (year) {
        const { execute } = yield* databaseContext;

        const summerSemesterIsInRange = and(
          eq(tables.semesters.type, "SUMMER"),
          gt(tables.semesters.year, year.startYear),
          lte(tables.semesters.year, year.graduationYear),
        );
        const winterSemesterIsInRange = and(
          eq(tables.semesters.type, "WINTER"),
          gte(tables.semesters.year, year.startYear),
          lt(tables.semesters.year, year.graduationYear),
        );

        return yield* execute((db) =>
          db.query.semesters.findMany({
            where: and(eq(tables.semesters.school, year.school), or(summerSemesterIsInRange, winterSemesterIsInRange)),
          }),
        );
      }),
    });

    return {
      createSemesters: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db
            .insert(tables.semesters)
            .values(
              payload.map((semester) => ({
                ...semester,
                start: simpleDateToDate(semester.start),
                end: simpleDateToDate(semester.end),
              })),
            )
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

      ...semesterRepository,
    };
  }),
);
