import { Effect } from "effect";
import { Database } from "../database";
import { and, eq } from "drizzle-orm";
import * as tables from "../schema";

export class TimetableRepository extends Effect.Service<TimetableRepository>()("student/TimetableRepository", {
  effect: Effect.gen(function* () {
    const doesTimetableEntryExist = Effect.fn(function* (payload: { start: Date; course: string }) {
      const { execute } = yield* Database;
      const timetableEntry = yield* execute((db) =>
        db.query.timetableEntries.findFirst({
          where: and(
            eq(tables.timetableEntries.course, payload.course),
            eq(tables.timetableEntries.start, payload.start),
          ),
        }),
      );
      return timetableEntry !== undefined;
    });

    const createTimetableEntry = Effect.fn(function* (payload: {
      start: Date;
      duration: number;
      course: string;
      rooms: string[];
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.timetableEntries).values({
          start: payload.start,
          duration: payload.duration,
          course: payload.course,
        }),
      );
      for (const room of payload.rooms) {
        yield* execute((db) =>
          db.insert(tables.timetableEntryRooms).values({
            start: payload.start,
            course: payload.course,
            roomNumber: room,
          }),
        );
      }
    }, Database.asTransaction);

    const deleteTimetableEntry = Effect.fn(function* (payload: { start: Date; course: string }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db
          .delete(tables.timetableEntries)
          .where(
            and(eq(tables.timetableEntries.course, payload.course), eq(tables.timetableEntries.start, payload.start)),
          ),
      );
    });

    const createSubstitution = Effect.fn(function* (payload: {
      start: Date;
      course: string;
      substitute: string | null;
      type: "VERTRETUNG" | "ENTFALL";
    }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db.insert(tables.substitutions).values({
          start: payload.start,
          course: payload.course,
          substitute: payload.substitute,
          type: payload.type,
        }),
      );
    });

    return {
      doesTimetableEntryExist,
      createTimetableEntry,
      deleteTimetableEntry,
      createSubstitution,
    };
  }),
}) {}
