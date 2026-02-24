import {
  GradeRepository,
  GradeTooOldError,
  gradeCourseTypeDatePredicates,
  gradeCourseTypePredicates,
  gradePendingSignaturePredicate,
} from "@stu/lib";
import { and, desc, eq, gt, isNotNull, isNull, or } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { Database } from "../database";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const GradeRepositoryLive = Layer.effect(
  GradeRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    return {
      // Student storage is single-profile scoped; studentId is carried for cross-package contract parity.
      setCurrentGrade: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        const [coursePredicate, typePredicate] = gradeCourseTypePredicates(
          {
            course: tables.grades.course,
            type: tables.grades.type,
          },
          {
            course: payload.courseId,
            type: payload.type,
          },
          eq,
        );

        yield* execute((db) =>
          db.delete(tables.grades).where(
            and(
              coursePredicate,
              typePredicate,
              gradePendingSignaturePredicate(
                {
                  teacherSignature: tables.grades.teacherSignature,
                  parentSignature: tables.grades.parentSignature,
                },
                { isNull, or },
              ),
            ),
          ),
        );

        const latestGrade = yield* execute((db) =>
          db.query.grades.findFirst({
            where: and(coursePredicate, typePredicate),
            orderBy: desc(tables.grades.date),
          }),
        );

        if (latestGrade && latestGrade.date.getTime() >= payload.date.getTime())
          return yield* Effect.fail(
            new GradeTooOldError({
              courseId: payload.courseId,
              date: payload.date,
              type: payload.type,
            }),
          );

        yield* execute((db) =>
          db.insert(tables.grades).values({
            course: payload.courseId,
            date: payload.date,
            result: payload.result,
            type: payload.type,
            parentSignature: payload.isSignatureRequired ? null : "NOT_REQUIRED",
          }),
        );
      }, Database.asTransactionCustom(databaseContext)),

      recordWrittenGrade: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        yield* execute((db) =>
          db.insert(tables.grades).values({
            course: payload.courseId,
            date: payload.date,
            result: payload.result,
            type: "WRITTEN",
            parentSignature: payload.isSignatureRequired ? null : "NOT_REQUIRED",
          }),
        );
      }),

      setTeacherSignature: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        const [coursePredicate, typePredicate, datePredicate] = gradeCourseTypeDatePredicates(
          {
            course: tables.grades.course,
            type: tables.grades.type,
            date: tables.grades.date,
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
            .update(tables.grades)
            .set({
              teacherSignature: payload.signature,
            })
            .where(and(coursePredicate, datePredicate, typePredicate)),
        );
      }),

      setParentSignature: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        const [coursePredicate, typePredicate, datePredicate] = gradeCourseTypeDatePredicates(
          {
            course: tables.grades.course,
            type: tables.grades.type,
            date: tables.grades.date,
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
            .update(tables.grades)
            .set({
              parentSignature: payload.signature,
            })
            .where(and(coursePredicate, datePredicate, typePredicate)),
        );
      }),

      restoreLatest: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        const [coursePredicate, typePredicate] = gradeCourseTypePredicates(
          {
            course: tables.grades.course,
            type: tables.grades.type,
          },
          {
            course: payload.course,
            type: payload.type,
          },
          eq,
        );

        const latestConfirmedGrade = yield* execute((db) =>
          db.query.grades.findFirst({
            where: and(
              coursePredicate,
              typePredicate,
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
            .where(and(coursePredicate, typePredicate, gt(tables.grades.date, latestConfirmedGrade.date))),
        );
      }, Database.asTransactionCustom(databaseContext)),

      discardGrade: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        const [coursePredicate, typePredicate, datePredicate] = gradeCourseTypeDatePredicates(
          {
            course: tables.grades.course,
            type: tables.grades.type,
            date: tables.grades.date,
          },
          {
            course: payload.course,
            type: payload.type,
            date: payload.date,
          },
          eq,
        );

        yield* execute((db) =>
          db.delete(tables.grades).where(
            and(
              coursePredicate,
              typePredicate,
              datePredicate,
              gradePendingSignaturePredicate(
                {
                  teacherSignature: tables.grades.teacherSignature,
                  parentSignature: tables.grades.parentSignature,
                },
                { isNull, or },
              ),
            ),
          ),
        );
      }),
    };
  }),
);
