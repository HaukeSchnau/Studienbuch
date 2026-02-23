import { GradeRepository, GradeTooOldError } from "@stu/lib";
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
      }),

      setParentSignature: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

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
      }),

      restoreLatest: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

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
      }, Database.asTransactionCustom(databaseContext)),

      discardGrade: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

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
      }),
    };
  }),
);
