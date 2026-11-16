/** A school year, usually August 1 to July 31, as the school's timetable source names it. */
import { Ids, Sync } from "@stu/sync";
import * as Schema from "effect/Schema";
import * as PlainDateFns from "temporal-polyfill/fns/PlainDate";
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

/**
 * The school year that holds `date` by the usual dates, for a school whose source names none:
 * August 1 to July 31, in two halves that part on February 1. Its id is the year it starts in,
 * such as `2026` for "2026/27".
 */
export const around = (date: CivilTime.PlainDate) => {
  const start = date.month >= 8 ? date.year : date.year - 1;
  const end = start + 1;

  const row: Row = {
    name: `${start}/${String(end).slice(-2)}`,
    dates: { start: PlainDateFns.create(start, 8, 1), end: PlainDateFns.create(end, 7, 31) },
  };

  const halves: readonly [CivilTime.DateRange, CivilTime.DateRange] = [
    { start: row.dates.start, end: PlainDateFns.create(end, 1, 31) },
    { start: PlainDateFns.create(end, 2, 1), end: row.dates.end },
  ];

  return { id: Id.make(String(start)), row, halves };
};
