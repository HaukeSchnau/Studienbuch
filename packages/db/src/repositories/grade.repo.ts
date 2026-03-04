import {
  gradeCourseTypeDatePredicates,
  gradeCourseTypePredicates,
  gradePendingSignaturePredicate,
  type StudentId,
} from "@stu/lib";
import { and, desc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import { Effect, Layer, ServiceMap } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class GradeRepositoryDb extends ServiceMap.Service<GradeRepositoryDb>()("db/GradeRepositoryDb", {
  make: Effect.gen(function* () {
    const setCurrentGrade = Effect.fn(function* (payload: {
      studentId: StudentId;
      courseId: string;
      date: Date;
      result: number;
      type: "ORAL" | "MASTER";
      isSignatureRequired: boolean;
    }) {
      const { execute } = yield* Effect.service(Database);

      const [coursePredicate, typePredicate] = gradeCourseTypePredicates(
        {
          course: tables.Grades.course,
          type: tables.Grades.type,
        },
        {
          course: payload.courseId,
          type: payload.type,
        },
        eq,
      );

      yield* execute((db) =>
        db.delete(tables.Grades).where(
          and(
            eq(tables.Grades.student, payload.studentId),
            coursePredicate,
            typePredicate,
            gradePendingSignaturePredicate(
              {
                teacherSignature: tables.Grades.teacherSignature,
                parentSignature: tables.Grades.parentSignature,
              },
              { isNull, or },
            ),
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
      studentId: StudentId;
      courseId: string;
      type: "ORAL" | "MASTER";
    }) {
      const { execute } = yield* Effect.service(Database);

      const [coursePredicate, typePredicate] = gradeCourseTypePredicates(
        {
          course: tables.Grades.course,
          type: tables.Grades.type,
        },
        {
          course: payload.courseId,
          type: payload.type,
        },
        eq,
      );

      const latestGrade = yield* execute((db) =>
        db.query.Grades.findFirst({
          where: and(eq(tables.Grades.student, payload.studentId), coursePredicate, typePredicate),
          orderBy: desc(tables.Grades.date),
        }),
      );

      return latestGrade?.date ?? null;
    });

    const recordWrittenGrade = Effect.fn(function* (payload: {
      studentId: StudentId;
      courseId: string;
      date: Date;
      result: number;
      isSignatureRequired: boolean;
    }) {
      const { execute } = yield* Effect.service(Database);

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
      studentId: StudentId;
      course: string;
      date: Date;
      type: "WRITTEN" | "ORAL" | "MASTER";
      signature: string;
    }) {
      const { execute } = yield* Effect.service(Database);

      const [coursePredicate, typePredicate, datePredicate] = gradeCourseTypeDatePredicates(
        {
          course: tables.Grades.course,
          type: tables.Grades.type,
          date: tables.Grades.date,
        },
        {
          course: payload.course,
          type: payload.type,
          date: payload.date,
        },
        eq,
      );

      yield* execute((db) =>
        db
          .update(tables.Grades)
          .set({
            teacherSignature: payload.signature,
          })
          .where(and(eq(tables.Grades.student, payload.studentId), coursePredicate, datePredicate, typePredicate)),
      );
    });

    const setParentSignature = Effect.fn(function* (payload: {
      studentId: StudentId;
      course: string;
      date: Date;
      type: "WRITTEN" | "ORAL" | "MASTER";
      signature: string;
    }) {
      const { execute } = yield* Effect.service(Database);

      const [coursePredicate, typePredicate, datePredicate] = gradeCourseTypeDatePredicates(
        {
          course: tables.Grades.course,
          type: tables.Grades.type,
          date: tables.Grades.date,
        },
        {
          course: payload.course,
          type: payload.type,
          date: payload.date,
        },
        eq,
      );

      yield* execute((db) =>
        db
          .update(tables.Grades)
          .set({
            parentSignature: payload.signature,
          })
          .where(and(eq(tables.Grades.student, payload.studentId), coursePredicate, datePredicate, typePredicate)),
      );
    });

    const restoreLatest = Effect.fn(function* (payload: {
      studentId: StudentId;
      course: string;
      type: "ORAL" | "MASTER" | "WRITTEN";
    }) {
      const { execute } = yield* Effect.service(Database);

      const [coursePredicate, typePredicate] = gradeCourseTypePredicates(
        {
          course: tables.Grades.course,
          type: tables.Grades.type,
        },
        {
          course: payload.course,
          type: payload.type,
        },
        eq,
      );

      const latestConfirmedGrade = yield* execute((db) =>
        db.query.Grades.findFirst({
          where: and(
            eq(tables.Grades.student, payload.studentId),
            coursePredicate,
            typePredicate,
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
              coursePredicate,
              typePredicate,
              gt(tables.Grades.date, latestConfirmedGrade.date),
            ),
          ),
      );
    }, Database.asTransaction);

    const discardGrade = Effect.fn(function* (payload: {
      studentId: StudentId;
      course: string;
      date: Date;
      type: "WRITTEN" | "ORAL" | "MASTER";
    }) {
      const { execute } = yield* Effect.service(Database);

      const [coursePredicate, typePredicate, datePredicate] = gradeCourseTypeDatePredicates(
        {
          course: tables.Grades.course,
          type: tables.Grades.type,
          date: tables.Grades.date,
        },
        {
          course: payload.course,
          type: payload.type,
          date: payload.date,
        },
        eq,
      );

      yield* execute((db) =>
        db.delete(tables.Grades).where(
          and(
            eq(tables.Grades.student, payload.studentId),
            coursePredicate,
            datePredicate,
            typePredicate,
            gradePendingSignaturePredicate(
              {
                teacherSignature: tables.Grades.teacherSignature,
                parentSignature: tables.Grades.parentSignature,
              },
              { isNull, or },
            ),
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
}) {
  static readonly Default = Layer.effect(GradeRepositoryDb, GradeRepositoryDb.make);
}
