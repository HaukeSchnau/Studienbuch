import { Effect } from "effect";
import { Database } from "../database";
import { and, eq, inArray } from "drizzle-orm";
import * as tables from "../schema";

export class AbsenceRepository extends Effect.Service<AbsenceRepository>()("student/AbsenceRepository", {
  effect: Effect.gen(function* () {
    const addAbsence = Effect.fn(function* (payload: {
      date: Date;
      reason: string;
      courseIds: string[];
      isSignatureRequired: boolean;
    }) {
      const { execute } = yield* Database;

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
    }, Database.asTransaction);

    const setParentSignature = Effect.fn(function* (payload: {
      date: Date;
      signature: string;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .update(tables.absenceDays)
          .set({ parentSignature: payload.signature })
          .where(eq(tables.absenceDays.date, payload.date)),
      );
    });

    const setTeacherSignature = Effect.fn(function* (payload: {
      date: Date;
      courseId: string;
      signature: string;
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .update(tables.courseAbsences)
          .set({ teacherSignature: payload.signature })
          .where(and(eq(tables.courseAbsences.date, payload.date), eq(tables.courseAbsences.course, payload.courseId))),
      );
    });

    const deleteAbsence = Effect.fn(function* (payload: {
      date: Date;
      courseIds: string[];
    }) {
      const { execute } = yield* Database;

      yield* execute((db) =>
        db
          .delete(tables.courseAbsences)
          .where(
            and(eq(tables.courseAbsences.date, payload.date), inArray(tables.courseAbsences.course, payload.courseIds)),
          ),
      );

      const courseAbsences = yield* execute((db) =>
        db.query.courseAbsences.findMany({ where: eq(tables.courseAbsences.date, payload.date) }),
      );

      if (courseAbsences.length === 0) {
        yield* execute((db) => db.delete(tables.absenceDays).where(eq(tables.absenceDays.date, payload.date)));
      }
    });

    return {
      addAbsence,
      setParentSignature,
      setTeacherSignature,
      deleteAbsence,
    };
  }),
}) {}
