import { and, desc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class GradeRepositoryDb extends Effect.Service<GradeRepositoryDb>()("db/GradeRepositoryDb", {
  effect: Effect.gen(function* () {
    const setCurrentGrade = Effect.fn(function* (payload: {
      studentId: string;
      courseId: string;
      date: Date;
      result: number;
      type: "ORAL" | "MASTER";
      isSignatureRequired: boolean;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .delete(tables.Grades)
          .where(
            and(
              eq(tables.Grades.student, payload.studentId),
              eq(tables.Grades.course, payload.courseId),
              eq(tables.Grades.type, payload.type),
              or(isNull(tables.Grades.teacherSignature), isNull(tables.Grades.parentSignature)),
            ),
          ),
      );

      yield* execute((db) =>
        db.insert(tables.Grades).values({
          student: payload.studentId,
          course: payload.courseId,
          date: payload.date,
          result: payload.result,
          type: payload.type,
          parentSignature: payload.isSignatureRequired ? null : "NOT_REQUIRED",
        }),
      );
    }, Database.asTransaction);

    const getLatestGradeDate = Effect.fn(function* (payload: {
      studentId: string;
      courseId: string;
      type: "ORAL" | "MASTER";
    }) {
      const { execute } = yield* Database;

      const latestGrade = yield* execute((db) =>
        db.query.Grades.findFirst({
          where: and(
            eq(tables.Grades.student, payload.studentId),
            eq(tables.Grades.course, payload.courseId),
            eq(tables.Grades.type, payload.type),
          ),
          orderBy: desc(tables.Grades.date),
        }),
      );

      return latestGrade?.date ?? null;
    });

    const recordWrittenGrade = Effect.fn(function* (payload: {
      studentId: string;
      courseId: string;
      date: Date;
      result: number;
      isSignatureRequired: boolean;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db.insert(tables.Grades).values({
          student: payload.studentId,
          course: payload.courseId,
          date: payload.date,
          result: payload.result,
          type: "WRITTEN",
          parentSignature: payload.isSignatureRequired ? null : "NOT_REQUIRED",
        }),
      );
    });

    const setTeacherSignature = Effect.fn(function* (payload: {
      studentId: string;
      course: string;
      date: Date;
      type: "WRITTEN" | "ORAL" | "MASTER";
      signature: string;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .update(tables.Grades)
          .set({
            teacherSignature: payload.signature,
          })
          .where(
            and(
              eq(tables.Grades.student, payload.studentId),
              eq(tables.Grades.course, payload.course),
              eq(tables.Grades.date, payload.date),
              eq(tables.Grades.type, payload.type),
            ),
          ),
      );
    });

    const setParentSignature = Effect.fn(function* (payload: {
      studentId: string;
      course: string;
      date: Date;
      type: "WRITTEN" | "ORAL" | "MASTER";
      signature: string;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .update(tables.Grades)
          .set({
            parentSignature: payload.signature,
          })
          .where(
            and(
              eq(tables.Grades.student, payload.studentId),
              eq(tables.Grades.course, payload.course),
              eq(tables.Grades.date, payload.date),
              eq(tables.Grades.type, payload.type),
            ),
          ),
      );
    });

    const restoreLatest = Effect.fn(function* (payload: {
      studentId: string;
      course: string;
      type: "ORAL" | "MASTER" | "WRITTEN";
    }) {
      const { execute } = yield* Database;

      const latestConfirmedGrade = yield* execute((db) =>
        db.query.Grades.findFirst({
          where: and(
            eq(tables.Grades.student, payload.studentId),
            eq(tables.Grades.course, payload.course),
            eq(tables.Grades.type, payload.type),
            isNotNull(tables.Grades.teacherSignature),
            isNotNull(tables.Grades.parentSignature),
          ),
          orderBy: desc(tables.Grades.date),
        }),
      );

      if (!latestConfirmedGrade) {
        throw new Error("No grades to restore");
      }

      yield* execute((db) =>
        db
          .delete(tables.Grades)
          .where(
            and(
              eq(tables.Grades.student, payload.studentId),
              eq(tables.Grades.course, payload.course),
              eq(tables.Grades.type, payload.type),
              gt(tables.Grades.date, latestConfirmedGrade.date),
            ),
          ),
      );
    }, Database.asTransaction);

    const discardGrade = Effect.fn(function* (payload: {
      studentId: string;
      course: string;
      date: Date;
      type: "WRITTEN" | "ORAL" | "MASTER";
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .delete(tables.Grades)
          .where(
            and(
              eq(tables.Grades.student, payload.studentId),
              eq(tables.Grades.course, payload.course),
              eq(tables.Grades.date, payload.date),
              eq(tables.Grades.type, payload.type),
              or(isNull(tables.Grades.teacherSignature), isNull(tables.Grades.parentSignature)),
            ),
          ),
      );
    });

    return {
      setCurrentGrade,
      getLatestGradeDate,
      recordWrittenGrade,
      setTeacherSignature,
      setParentSignature,
      restoreLatest,
      discardGrade,
    };
  }),
}) {}
