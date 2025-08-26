import { type SchoolId, type Year, YearRepository } from "@stu/lib";
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
        db.query.years.findFirst({
          where: and(eq(tables.years.startYear, payload.startYear), eq(tables.years.school, payload.school)),
        }),
      );
    });

    const getAllYears = Effect.fn(function* (payload: { school?: SchoolId }) {
      const { execute } = yield* databaseContext;
      return yield* execute((db) =>
        db.query.years.findMany({ where: payload.school ? eq(tables.years.school, payload.school) : undefined }),
      );
    });

    return {
      getAllYears,

      yearsInSemester: Effect.fn(function* (semester) {
        const { execute } = yield* databaseContext;

        return yield* execute((db) =>
          db
            .select({
              school: tables.years.school,
              name: tables.years.name,
              startYear: tables.years.startYear,
              graduationYear: tables.years.graduationYear,
            })
            .from(tables.years)
            .where(
              and(
                eq(tables.years.school, semester.school),
                semester.type === "WINTER"
                  ? lte(tables.years.startYear, semester.year)
                  : lt(tables.years.startYear, semester.year),
                semester.type === "SUMMER"
                  ? gte(tables.years.graduationYear, semester.year)
                  : gt(tables.years.graduationYear, semester.year),
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
      }, Database.asTransactionCustom(databaseContext)),
    };
  }),
);
