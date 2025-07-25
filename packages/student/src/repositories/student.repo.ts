import { StudentRepository } from "@stu/lib";
import { eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { Database } from "../database";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const StudentRepositoryLive = Layer.effect(
  StudentRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    return {
      createStudent: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        const firstName = payload.name.split(" ")[0] ?? "";
        const lastName = payload.name.split(" ").slice(1).join(" ");

        yield* execute((db) =>
          db
            .insert(tables.persons)
            .values({
              id: payload.studentId,
              firstName,
              lastName,
            })
            .onConflictDoUpdate({
              target: [tables.persons.id],
              set: {
                firstName,
                lastName,
              },
            }),
        );

        yield* execute((db) =>
          db
            .insert(tables.students)
            .values({
              person: payload.studentId,
              school: payload.school,
              startYear: payload.class.startYear,
              classIdentifier: payload.class.identifier,
              isOfAge: payload.isOfAge,
            })
            .onConflictDoUpdate({
              target: [tables.students.person],
              set: {
                school: payload.school,
                startYear: payload.class.startYear,
                classIdentifier: payload.class.identifier,
                isOfAge: payload.isOfAge,
              },
            }),
        );
      }, Database.asTransactionCustom(databaseContext)),

      assignCourse: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        yield* execute((db) =>
          db
            .update(tables.courses)
            .set({
              isMember: true,
            })
            .where(eq(tables.courses.id, payload.courseId)),
        );
      }),

      getStudent: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        return yield* execute((db) =>
          db.query.students.findFirst({
            where: eq(tables.students.person, payload.studentId),
          }),
        );
      }),
    };
  }),
);
