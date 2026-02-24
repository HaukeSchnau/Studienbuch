import { AbsenceRepository, shouldDeleteAbsenceDayAfterRemovingCourseAbsences } from "@stu/lib";
import { and, eq, inArray } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { Database } from "../database";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const AbsenceRepositoryLive = Layer.effect(
  AbsenceRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    return {
      // Student storage is single-profile scoped; studentId is carried for cross-package contract parity.
      addAbsence: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        yield* execute((db) =>
          db.insert(tables.absenceDays).values({
            date: payload.date,
            reason: payload.reason,
            parentSignature: payload.isSignatureRequired ? undefined : "NOT_REQUIRED",
          }),
        );

        yield* execute((db) =>
          db.insert(tables.courseAbsences).values(
            payload.courseIds.map((courseId) => ({
              date: payload.date,
              course: courseId,
            })),
          ),
        );
      }, Database.asTransactionCustom(databaseContext)),

      setParentSignature: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        yield* execute((db) =>
          db
            .update(tables.absenceDays)
            .set({ parentSignature: payload.signature })
            .where(eq(tables.absenceDays.date, payload.date)),
        );
      }),

      setTeacherSignature: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        yield* execute((db) =>
          db
            .update(tables.courseAbsences)
            .set({ teacherSignature: payload.signature })
            .where(
              and(eq(tables.courseAbsences.date, payload.date), eq(tables.courseAbsences.course, payload.courseId)),
            ),
        );
      }),

      deleteAbsence: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;

        yield* execute((db) =>
          db
            .delete(tables.courseAbsences)
            .where(
              and(
                eq(tables.courseAbsences.date, payload.date),
                inArray(tables.courseAbsences.course, payload.courseIds),
              ),
            ),
        );

        const courseAbsences = yield* execute((db) =>
          db.query.courseAbsences.findMany({ where: eq(tables.courseAbsences.date, payload.date) }),
        );

        if (shouldDeleteAbsenceDayAfterRemovingCourseAbsences(courseAbsences)) {
          yield* execute((db) => db.delete(tables.absenceDays).where(eq(tables.absenceDays.date, payload.date)));
        }
      }),
    };
  }),
);
