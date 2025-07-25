import { ClassRepository, type SchoolId } from "@stu/lib";
import { and, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { Database } from "../database";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const ClassRepositoryLive = Layer.effect(
  ClassRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    const getClass = Effect.fn(function* (payload: { identifier: string; startYear: number; school: SchoolId }) {
      const { execute } = yield* databaseContext;

      const cls = yield* execute((db) =>
        db
          .select()
          .from(tables.classes)
          .where(
            and(
              eq(tables.classes.identifierInYear, payload.identifier),
              eq(tables.classes.startYear, payload.startYear),
              eq(tables.classes.school, payload.school),
            ),
          ),
      );

      return cls[0];
    });

    return {
      getClass,

      doesClassExist: Effect.fn(function* (payload) {
        const clazz = yield* getClass(payload);
        return clazz !== undefined;
      }),

      createClass: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        yield* execute((db) =>
          db.insert(tables.classes).values({
            identifierInYear: payload.identifier,
            startYear: payload.startYear,
            school: payload.school,
          }),
        );

        for (const teacher of payload.teachers) {
          yield* execute((db) =>
            db.insert(tables.teachersToClasses).values({
              teacher,
              classIdentifier: payload.identifier,
              classStartYear: payload.startYear,
              school: payload.school,
            }),
          );
        }
      }, Database.asTransactionCustom(databaseContext)),
    };
  }),
);
