/** Lehrkraft: a teacher as the timetable names them. */
import { Ids, Sync } from "@stu/sync";
import * as Schema from "effect/Schema";

export * as Teacher from "./Teacher.ts";

export const Id = Ids.Id.pipe(Schema.brand("TeacherId"));

export type Id = typeof Id.Type;

/** In the School space. A published teacher is never deleted, because lessons name them. */
export const Row = Sync.table("Teacher", {
  class: "readable",
  fields: {
    /** Such as "MÜL". */
    shortName: Schema.String,
    /**
     * The name students know them by, such as "Müller": WebUntis's long name, which is the
     * surname and carries no salutation. Absent where the school shows short names only; screens
     * then write `shortName`.
     */
    displayName: Schema.optional(Schema.String),
  },
});

export type Row = Sync.Row<typeof Row>;
