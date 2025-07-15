import { Effect } from "effect";
import { Database } from "../database";
import * as tables from "../schema";

export class RoomRepository extends Effect.Service<RoomRepository>()("db/RoomRepository", {
  effect: Effect.gen(function* () {
    const createRoom = Effect.fn(function* (payload: { roomNumber: string; name: string }) {
      const { execute } = yield* Database;
      yield* execute((db) =>
        db
          .insert(tables.Rooms)
          .values({
            roomNumber: payload.roomNumber,
            name: payload.name,
          })
          .onConflictDoUpdate({
            target: [tables.Rooms.roomNumber],
            set: {
              name: payload.name,
            },
          }),
      );
    });
    return { createRoom };
  }),
}) {}
