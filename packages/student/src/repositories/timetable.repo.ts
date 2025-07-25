import { TimetableRepository } from "@stu/lib";
import { and, eq } from "drizzle-orm";
import { Effect, Layer } from "effect";
import { Database } from "../database";
import * as tables from "../schema";
import { RepositoryDatabase } from "./util";

export const TimetableRepositoryLive = Layer.effect(
  TimetableRepository,
  Effect.gen(function* () {
    const databaseContext = yield* RepositoryDatabase;

    return {
      doesTimetableEntryExist: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        const timetableEntry = yield* execute((db) =>
          db.query.timetableEntries.findFirst({
            where: and(
              eq(tables.timetableEntries.course, payload.course),
              eq(tables.timetableEntries.start, payload.start),
            ),
          }),
        );
        return timetableEntry !== undefined;
      }),

      createTimetableEntry: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
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
      }, Database.asTransactionCustom(databaseContext)),

      deleteTimetableEntry: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db
            .delete(tables.timetableEntries)
            .where(
              and(eq(tables.timetableEntries.course, payload.course), eq(tables.timetableEntries.start, payload.start)),
            ),
        );
      }),

      createSubstitution: Effect.fn(function* (payload) {
        const { execute } = yield* databaseContext;
        yield* execute((db) =>
          db.insert(tables.substitutions).values({
            start: payload.start,
            course: payload.course,
            substitute: payload.substitute,
            type: payload.type,
          }),
        );
      }),
    };
  }),
);
