import { shouldDeleteAbsenceDayAfterRemovingCourseAbsences, type StudentId } from "@stu/lib";
import { and, eq, inArray } from "drizzle-orm";
import { Effect, Layer, ServiceMap } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class AbsenceRepositoryDb extends ServiceMap.Service<AbsenceRepositoryDb>()("db/AbsenceRepositoryDb", {
  make: Effect.gen(function* () {
    const addAbsence = Effect.fn(function* (payload: {
      studentId: StudentId;
      date: Date;
      reason: string;
      courseIds: string[];
      isSignatureRequired: boolean;
    }) {
      const { execute } = yield* Effect.service(Database);

      yield* execute((db) =>
        db
          .insert(tables.AbsenceDays)
          .values({
            student: payload.studentId,
            date: payload.date,
            reason: payload.reason,
            parentSignature: payload.isSignatureRequired ? undefined : "NOT_REQUIRED",
          })
          .onConflictDoUpdate({
            target: [tables.AbsenceDays.student, tables.AbsenceDays.date],
            set: {
              reason: payload.reason,
              parentSignature: payload.isSignatureRequired ? null : "NOT_REQUIRED",
            },
          }),
      );

      yield* execute((db) =>
        db.insert(tables.CourseAbsences).values(
          payload.courseIds.map((courseId) => ({
            student: payload.studentId,
            date: payload.date,
            course: courseId,
          })),
        ),
      );
    }, Database.asTransaction);

    const setParentSignature = Effect.fn(function* (payload: { studentId: StudentId; date: Date; signature: string }) {
      const { execute } = yield* Effect.service(Database);

      yield* execute((db) =>
        db
          .update(tables.AbsenceDays)
          .set({ parentSignature: payload.signature })
          .where(and(eq(tables.AbsenceDays.student, payload.studentId), eq(tables.AbsenceDays.date, payload.date))),
      );
    });

    const setTeacherSignature = Effect.fn(function* (payload: {
      studentId: StudentId;
      date: Date;
      courseId: string;
      signature: string;
    }) {
      const { execute } = yield* Effect.service(Database);

      yield* execute((db) =>
        db
          .update(tables.CourseAbsences)
          .set({ teacherSignature: payload.signature })
          .where(
            and(
              eq(tables.CourseAbsences.student, payload.studentId),
              eq(tables.CourseAbsences.date, payload.date),
              eq(tables.CourseAbsences.course, payload.courseId),
            ),
          ),
      );
    });

    const deleteAbsence = Effect.fn(function* (payload: { studentId: StudentId; date: Date; courseIds: string[] }) {
      const { execute } = yield* Effect.service(Database);

      yield* execute((db) =>
        db
          .delete(tables.CourseAbsences)
          .where(
            and(
              eq(tables.CourseAbsences.student, payload.studentId),
              eq(tables.CourseAbsences.date, payload.date),
              inArray(tables.CourseAbsences.course, payload.courseIds),
            ),
          ),
      );

      const remainingCourseAbsences = yield* execute((db) =>
        db.query.CourseAbsences.findMany({
          where: and(
            eq(tables.CourseAbsences.student, payload.studentId),
            eq(tables.CourseAbsences.date, payload.date),
          ),
        }),
      );

      if (shouldDeleteAbsenceDayAfterRemovingCourseAbsences(remainingCourseAbsences)) {
        yield* execute((db) =>
          db
            .delete(tables.AbsenceDays)
            .where(and(eq(tables.AbsenceDays.student, payload.studentId), eq(tables.AbsenceDays.date, payload.date))),
        );
      }
    });

    return {
      addAbsence,
      setParentSignature,
      setTeacherSignature,
      deleteAbsence,
    };
  }),
}) {
  static readonly Default = Layer.effect(AbsenceRepositoryDb, AbsenceRepositoryDb.make);
}
