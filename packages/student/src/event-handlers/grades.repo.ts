import { Effect } from "effect";
import { Database } from "../database";
import type { GradeType } from "@stu/lib";
import { and, desc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import * as tables from "../schema";

export class GradeRepository extends Effect.Service<GradeRepository>()("student/GradeRepository", {
  effect: Effect.gen(function* () {
    const setCurrentGrade = Effect.fn(function* (payload: {
      courseId: string;
      date: Date;
      result: number;
      type: GradeType;
      isSignatureRequired: boolean;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .delete(tables.grades)
          .where(
            and(
              eq(tables.grades.course, payload.courseId),
              eq(tables.grades.type, payload.type),
              or(isNull(tables.grades.teacherSignature), isNull(tables.grades.parentSignature)),
            ),
          ),
      );

      const latestGrade = yield* execute((db) =>
        db.query.grades.findFirst({
          where: and(eq(tables.grades.course, payload.courseId), eq(tables.grades.type, payload.type)),
          orderBy: desc(tables.grades.date),
        }),
      );

      if (latestGrade && latestGrade.date.getTime() >= payload.date.getTime()) {
        throw new Error("You cannot enter grades for a date in the past"); // TODO: Effect.fail
      }

      yield* execute((db) =>
        db.insert(tables.grades).values({
          course: payload.courseId,
          date: payload.date,
          result: payload.result,
          type: payload.type,
          parentSignature: payload.isSignatureRequired ? null : "NOT_REQUIRED",
        }),
      );
    }, Database.asTransaction);

    const recordWrittenGrade = Effect.fn(function* (payload: {
      courseId: string;
      date: Date;
      result: number;
      isSignatureRequired: boolean;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db.insert(tables.grades).values({
          course: payload.courseId,
          date: payload.date,
          result: payload.result,
          type: "WRITTEN",
          parentSignature: payload.isSignatureRequired ? null : "NOT_REQUIRED",
        }),
      );
    });

    const setTeacherSignature = Effect.fn(function* (payload: {
      course: string;
      date: Date;
      type: GradeType;
      signature: string;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .update(tables.grades)
          .set({
            teacherSignature: payload.signature,
          })
          .where(
            and(
              eq(tables.grades.course, payload.course),
              eq(tables.grades.date, payload.date),
              eq(tables.grades.type, payload.type),
            ),
          ),
      );
    });

    const setParentSignature = Effect.fn(function* (payload: {
      course: string;
      date: Date;
      type: GradeType;
      signature: string;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .update(tables.grades)
          .set({
            parentSignature: payload.signature,
          })
          .where(
            and(
              eq(tables.grades.course, payload.course),
              eq(tables.grades.date, payload.date),
              eq(tables.grades.type, payload.type),
            ),
          ),
      );
    });

    const restoreLatest = Effect.fn(function* (payload: {
      course: string;
      type: GradeType;
    }) {
      const { execute } = yield* Database;

      const latestConfirmedGrade = yield* execute((db) =>
        db.query.grades.findFirst({
          where: and(
            eq(tables.grades.course, payload.course),
            eq(tables.grades.type, payload.type),
            isNotNull(tables.grades.teacherSignature),
            isNotNull(tables.grades.parentSignature),
          ),
          orderBy: desc(tables.grades.date),
        }),
      );

      if (!latestConfirmedGrade) {
        throw new Error("No grades to restore");
      }

      yield* execute((db) =>
        db
          .delete(tables.grades)
          .where(
            and(
              eq(tables.grades.course, payload.course),
              eq(tables.grades.type, payload.type),
              gt(tables.grades.date, latestConfirmedGrade.date),
            ),
          ),
      );
    }, Database.asTransaction);

    const discardGrade = Effect.fn(function* (payload: {
      course: string;
      date: Date;
      type: GradeType;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .delete(tables.grades)
          .where(
            and(
              eq(tables.grades.course, payload.course),
              eq(tables.grades.type, payload.type),
              eq(tables.grades.date, payload.date),
              or(isNull(tables.grades.teacherSignature), isNull(tables.grades.parentSignature)),
            ),
          ),
      );
    });

    return {
      setCurrentGrade,
      recordWrittenGrade,
      setTeacherSignature,
      setParentSignature,
      restoreLatest,
      discardGrade,
    };
  }),
}) {}
