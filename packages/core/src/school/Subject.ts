/** Fach: Mathematik, Deutsch. Courses name the subject they teach. */
import { Ids, Sync } from "@stu/sync";
import * as Schema from "effect/Schema";

export * as Subject from "./Subject.ts";

export const Id = Ids.Id.pipe(Schema.brand("SubjectId"));

export type Id = typeof Id.Type;

/** In the School space. */
export const Row = Sync.table("Subject", {
  class: "readable",
  fields: {
    /** Such as "Mathematik". */
    name: Schema.String,
    /** Such as "MA". */
    shortName: Schema.String,
  },
});

export type Row = Sync.Row<typeof Row>;
