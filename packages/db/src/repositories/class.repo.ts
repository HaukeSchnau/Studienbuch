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
        return yield* execute((db) =>
          db.query.Classes.findFirst({
            where: and(
              eq(tables.Classes.school, payload.school),
              eq(tables.Classes.identifierInYear, payload.identifier),
              eq(tables.Classes.startYear, payload.startYear),
            ),
          }),
        );
      }),

      insertClass: Effect.fn(function* (payload: { identifier: string; startYear: number; school: SchoolId }) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db.insert(tables.Classes).values({
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
          db.insert(tables.TeachersToClasses).values({
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
