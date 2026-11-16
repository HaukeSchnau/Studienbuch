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

/** A Halbjahr of {@link around}'s year: the first from August to January, the second the rest. */
export interface Half {
  readonly number: 1 | 2;
  /** Such as "1. Halbjahr 2026/27". */
  readonly name: string;
  readonly dates: CivilTime.DateRange;
}

/**
 * The usual school year that holds `date`, August 1 to July 31, with its starting year as its id,
 * such as `2026` for 2026/27. `current` is the half that holds `date`. A school whose timetable
 * source names its years keeps those.
 */
export const around = (date: CivilTime.PlainDate) => {
  const start = date.month >= 8 ? date.year : date.year - 1;
  const name = `${start}/${String(start + 1).slice(-2)}`;

  const half = (number: Half["number"], dates: CivilTime.DateRange): Half => ({
    number,
    name: `${number}. Halbjahr ${name}`,
    dates,
  });

  const first = half(1, {
    start: PlainDateFns.create(start, 8, 1),
    end: PlainDateFns.create(start + 1, 1, 31),
  });

  const second = half(2, {
    start: PlainDateFns.create(start + 1, 2, 1),
    end: PlainDateFns.create(start + 1, 7, 31),
  });

  const row: Row = { name, dates: { start: first.dates.start, end: second.dates.end } };

  return {
    id: Id.make(`${start}`),
    row,
    halves: [first, second] as const,
    current: CivilTime.contains(first.dates, date) ? first : second,
  };
};
