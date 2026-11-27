/** Raum: a room lessons take place in. */
import { Ids, Sync } from "@stu/sync";
import * as Schema from "effect/Schema";

export * as Room from "./Room.ts";

export const Id = Ids.Id.pipe(Schema.brand("RoomId"));

export type Id = typeof Id.Type;

/** In the School space. A published room is never deleted, because lessons name it. */
export const Row = Sync.table("Room", {
  class: "readable",
  fields: {
    /** Such as "A104". */
    name: Schema.String,
  },
});

export type Row = Sync.Row<typeof Row>;
