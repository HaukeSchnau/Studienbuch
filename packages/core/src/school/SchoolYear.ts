/** A school year, usually August 1 to July 31, as the school's timetable source names it. */
import { Ids, Sync } from "@stu/sync";
import * as Schema from "effect/Schema";
import { CivilTime } from "../civil-time/CivilTime.ts";

export * as SchoolYear from "./SchoolYear.ts";

export const Id = Ids.Id.pipe(Schema.brand("SchoolYearId"));

export type Id = typeof Id.Type;

/** In the School space. */
export const Row = Sync.table("SchoolYear", {
  class: "readable",
  fields: {
    /** Such as "2026/27". */
    name: Schema.String,
    dates: CivilTime.DateRange,
  },
});

export type Row = Sync.Row<typeof Row>;
