/** Halbjahr or Semester: a half of the school year, which course choices and grades belong to. */
import { Ids, Sync, type Tx } from "@stu/sync";
import * as Arr from "effect/Array";
import type * as Option from "effect/Option";
import * as Schema from "effect/Schema";
import { CivilTime } from "../civil-time/CivilTime.ts";
import { SchoolYear } from "./SchoolYear.ts";

export * as Term from "./Term.ts";

export const Id = Ids.Id.pipe(Schema.brand("TermId"));

export type Id = typeof Id.Type;

/** In the School space. A published term is never deleted, because enrollments name it. */
export const Row = Sync.table("Term", {
  class: "readable",
  fields: {
    schoolYearId: SchoolYear.Id,
    /** Such as "Winter 2026/27". */
    name: Schema.String,
    dates: CivilTime.DateRange,
  },
});

export type Row = Sync.Row<typeof Row>;

/** The term a date falls in, such as today's, whose enrollment lists the courses to choose from. */
export const containing = (
  terms: ReadonlyArray<Tx.Entry<Row>>,
  date: CivilTime.PlainDate,
): Option.Option<Tx.Entry<Row>> =>
  Arr.findFirst(terms, ({ row }) => CivilTime.contains(row.dates, date));
