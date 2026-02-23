import { classRepositoryLogic, ClassRepository, type SchoolId } from "@stu/lib";
import { and, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { Database } from "../database";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const ClassRepositoryLive = Layer.effect(
  ClassRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    const classRepository = classRepositoryLogic({
      getClass: Effect.fn(function* (payload: { identifier: string; startYear: number; school: SchoolId }) {
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
      }),

      insertClass: Effect.fn(function* (payload: { identifier: string; startYear: number; school: SchoolId }) {
        const { execute } = yield* databaseContext;

        yield* execute((db) =>
          db.insert(tables.classes).values({
            identifierInYear: payload.identifier,
            startYear: payload.startYear,
            school: payload.school,
          }),
        );
      }),

      insertTeacherLink: Effect.fn(function* (payload: {
        identifier: string;
        startYear: number;
        school: SchoolId;
        teacher: string;
      }) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db.insert(tables.teachersToClasses).values({
            teacher: payload.teacher,
            classIdentifier: payload.identifier,
            classStartYear: payload.startYear,
            school: payload.school,
          }),
        );
      }),
    });

    const { createClassCore, ...repository } = classRepository;

    return {
      ...repository,

      createClass: Effect.fn(function* (payload) {
        yield* createClassCore(payload);
      }, Database.asTransactionCustom(databaseContext)),
    };
  }),
);
