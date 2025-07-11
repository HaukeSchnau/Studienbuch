import { Effect } from "effect";
import type { SchoolId } from "@stu/lib";
import { Database } from "../database";
import { and, eq } from "drizzle-orm";
import * as tables from "../schema";

export class StudentRepository extends Effect.Service<StudentRepository>()("student/StudentRepository", {
  effect: Effect.gen(function* () {
    const doesClassExist = Effect.fn(function* (payload: {
      identifier: string;
      startYear: number;
      school: SchoolId;
    }) {
      const { execute } = yield* Database;

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

      return cls.length > 0;
    });

    const createStudent = Effect.fn(function* (payload: {
      studentId: string;
      name: string;
      school: SchoolId;
      class: {
        identifier: string;
        startYear: number;
      };
      isOfAge: boolean;
    }) {
      const { execute } = yield* Database;

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
    }, Database.asTransaction);

    const doesCourseExist = Effect.fn(function* (payload: {
      courseId: string;
    }) {
      const { execute } = yield* Database;

      const course = yield* execute((db) =>
        db.select().from(tables.courses).where(eq(tables.courses.id, payload.courseId)),
      );

      return course.length > 0;
    });

    const assignCourse = Effect.fn(function* (payload: {
      courseId: string;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .update(tables.courses)
          .set({
            isMember: true,
          })
          .where(eq(tables.courses.id, payload.courseId)),
      );
    });

    return {
      doesClassExist,
      doesCourseExist,
      createStudent,
      assignCourse,
    };
  }),
}) {}
