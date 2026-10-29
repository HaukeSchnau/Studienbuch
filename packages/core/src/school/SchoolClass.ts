/** Klasse: a class of one school year, such as "11.2". */
import { Ids, Sync } from "@stu/sync";
import * as Schema from "effect/Schema";
import { School } from "./School.ts";
import { SchoolYear } from "./SchoolYear.ts";

export * as SchoolClass from "./SchoolClass.ts";

/** One per school year. Which classes of different years are the same group stays on the server. */
export const Id = Ids.Id.pipe(Schema.brand("SchoolClassId"));

export type Id = typeof Id.Type;

/** In the School space. A published class is never deleted, because enrollments name it. */
export const Row = Sync.table("SchoolClass", {
  class: "readable",
  fields: {
    schoolYearId: SchoolYear.Id,
    name: Schema.String,
    gradeLevel: School.GradeLevel,
  },
  indexes: ["schoolYearId"],
});

export type Row = Sync.Row<typeof Row>;
