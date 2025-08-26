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

        yield* execute((db) =>
          db
            .insert(tables.persons)
            .values({
              id: payload.id,
              firstName: payload.firstName,
              lastName: payload.lastName,
            })
            .onConflictDoUpdate({
              target: [tables.persons.id],
              set: {
                firstName: payload.firstName,
                lastName: payload.lastName,
              },
            }),
        );

        yield* execute((db) =>
          db
            .insert(tables.students)
            .values({
              person: payload.id,
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

        const student = yield* execute((db) =>
          db.query.students.findFirst({
            where: eq(tables.students.person, payload.studentId),
            with: {
              person: true,
            },
          }),
        );

        if (!student) {
          return undefined;
        }

        return {
          id: student.person.id,
          firstName: student.person.firstName,
          lastName: student.person.lastName,
          school: student.school,
          class: {
            identifier: student.classIdentifier,
            startYear: student.startYear,
          },
          isOfAge: student.isOfAge ?? false,
        };
      }),
    };
  }),
);
