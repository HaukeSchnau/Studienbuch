import { YearRepository } from "@stu/lib";
import { and, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { Database } from "../database";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const YearRepositoryLive = Layer.effect(
  YearRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    return {
      doesYearExist: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        const year = yield* execute((db) =>
          db.query.years.findFirst({
            where: and(eq(tables.years.startYear, payload.startYear), eq(tables.years.school, payload.school)),
          }),
        );
        return year !== undefined;
      }),

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
