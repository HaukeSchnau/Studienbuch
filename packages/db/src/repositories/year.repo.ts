import { createYearClassesCore, type SchoolId, type Year, YearRepository } from "@stu/lib";
import { and, eq, gt, gte, lt, lte } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { Database } from "../database";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const YearRepositoryLive = Layer.effect(
  YearRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    const getYear = Effect.fn(function* (payload: Year.Id) {
      const { execute } = yield* databaseContext;
      return yield* execute((db) =>
        db.query.Years.findFirst({
          where: and(eq(tables.Years.startYear, payload.startYear), eq(tables.Years.school, payload.school)),
        }),
      );
    });

    const getAllYears = Effect.fn(function* (payload: { school?: SchoolId }) {
      const { execute } = yield* databaseContext;
      return yield* execute((db) =>
        db.query.Years.findMany({
          where: payload.school ? eq(tables.Years.school, payload.school) : undefined,
        }),
      );
    });

    const createYearClasses = createYearClassesCore({
      insertClass: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db.insert(tables.Classes).values({
            identifierInYear: payload.identifier,
            startYear: payload.startYear,
            school: payload.school,
          }),
        );
      }),

      insertTeacherLink: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db.insert(tables.TeachersToClasses).values({
            teacher: payload.teacher,
            classIdentifier: payload.identifier,
            classStartYear: payload.startYear,
            school: payload.school,
          }),
        );
      }),
    });

    return {
      getAllYears,

      yearsInSemester: Effect.fn(function* (semester) {
        const { execute } = yield* databaseContext;

        return yield* execute((db) =>
          db
            .select({
              school: tables.Years.school,
              name: tables.Years.name,
              startYear: tables.Years.startYear,
              graduationYear: tables.Years.graduationYear,
            })
            .from(tables.Years)
            .where(
              and(
                eq(tables.Years.school, semester.school),
                semester.type === "WINTER"
                  ? lte(tables.Years.startYear, semester.year)
                  : lt(tables.Years.startYear, semester.year),
                semester.type === "SUMMER"
                  ? gte(tables.Years.graduationYear, semester.year)
                  : gt(tables.Years.graduationYear, semester.year),
              ),
            ),
        );
      }),

      doesYearExist: Effect.fn(function* (payload) {
        const year = yield* getYear(payload);
        return year !== undefined;
      }),

      getYear,

      createYear: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db.insert(tables.Years).values({
            name: payload.name,
            startYear: payload.startYear,
            graduationYear: payload.graduationYear,
            school: payload.school,
          }),
        );
        yield* createYearClasses(payload);
      }, Database.asTransactionCustom(databaseContext)),
    };
  }),
);
