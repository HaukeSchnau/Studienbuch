import type { SubstitutionType } from "@stu/lib";
import { and, eq } from "drizzle-orm";
import { Effect, Layer, ServiceMap } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class TimetableRepository extends ServiceMap.Service<TimetableRepository>()("db/TimetableRepository", {
  make: Effect.gen(function* () {
    const getTimetableEntry = Effect.fn(function* (payload: { course: string; start: Date }) {
      const { execute } = yield* Effect.service(Database);
      return yield* execute((db) =>
        db.query.TimetableEntries.findFirst({
          where: and(
            eq(tables.TimetableEntries.course, payload.course),
            eq(tables.TimetableEntries.start, payload.start),
          ),
        }),
      );
    });

    const upsertTimetableEntry = Effect.fn(function* (payload: {
      course: string;
      start: Date;
      duration: number;
      rooms: string[];
    }) {
      const { execute } = yield* Effect.service(Database);
      const existingTimetableEntry = yield* getTimetableEntry({ course: payload.course, start: payload.start });
      yield* execute((db) =>
        db
          .insert(tables.TimetableEntries)
          .values({
            start: payload.start,
            duration: payload.duration,
            course: payload.course,
            rooms: payload.rooms,
          })
          .onConflictDoUpdate({
            target: [tables.TimetableEntries.start, tables.TimetableEntries.course],
            set: {
              duration: Math.max(existingTimetableEntry?.duration ?? 0, payload.duration),
              rooms: [...new Set([...payload.rooms, ...(existingTimetableEntry?.rooms ?? [])])],
            },
          }),
      );
    }, Database.asTransaction);

    const deleteTimetableEntry = Effect.fn(function* (payload: { course: string; start: Date }) {
      const { execute } = yield* Effect.service(Database);
      yield* execute((db) =>
        db
          .delete(tables.TimetableEntries)
          .where(
            and(eq(tables.TimetableEntries.course, payload.course), eq(tables.TimetableEntries.start, payload.start)),
          ),
      );
    });

    const getSubstitution = Effect.fn(function* (payload: { course: string; start: Date; originalTeacher: string }) {
      const { execute } = yield* Effect.service(Database);
      return yield* execute((db) =>
        db.query.Substitutions.findFirst({
          where: and(
            eq(tables.Substitutions.start, payload.start),
            eq(tables.Substitutions.course, payload.course),
            eq(tables.Substitutions.originalTeacher, payload.originalTeacher),
          ),
        }),
      );
    });

    const createSubstitution = Effect.fn(function* (
      payload: {
        course: string;
        start: Date;
        originalTeacher: string;
      } & (
        | {
            substitute: string;
            type: SubstitutionType;
          }
        | { substitute?: never; type: "ENTFALL" }
      ),
    ) {
      const { execute } = yield* Effect.service(Database);
      yield* execute((db) =>
        db.insert(tables.Substitutions).values({
          course: payload.course,
          start: payload.start,
          originalTeacher: payload.originalTeacher,
          substitute: payload.substitute ?? null,
          updatedAt: new Date(),
          type: payload.type,
        }),
      );
    });

    return {
      getTimetableEntry,
      upsertTimetableEntry,
      deleteTimetableEntry,
      getSubstitution,
      createSubstitution,
    };
  }),
}) {
  static readonly Default = Layer.effect(TimetableRepository, TimetableRepository.make);
}
