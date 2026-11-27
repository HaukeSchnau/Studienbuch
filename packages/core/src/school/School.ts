/**
 * A school's space and its own row. The import writes everything in a School space, and every
 * account with access to the school reads it. Lower-school data and student rosters never enter
 * it.
 */
import { Ids, Sync } from "@stu/sync";
import * as Schema from "effect/Schema";
import { CivilTime } from "../civil-time/CivilTime.ts";

export * as School from "./School.ts";

/**
 * The space of one school's shared data: its row, years, terms, subjects, classes, courses,
 * teachers, rooms, closures, week labels and import status. Lessons live in their courses' spaces.
 */
export const Space = Sync.spaceKind("school", {
  encryption: "none",
  roles: ["reader"],
  writtenBy: "server",
});

/** A readable slug such as `igs-lilienthal`. It is also the id of the school's space and row. */
export const Id = Ids.Id.pipe(Schema.brand("SchoolId"));

export type Id = typeof Id.Type;

/** Klassenstufe, the grade number. */
export const GradeLevel = Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: 13 }));

export type GradeLevel = typeof GradeLevel.Type;

/**
 * The school's rules, which core reads like any other row on the device and the server. Its id is
 * the space's. Each rule is a field of its own, because `Evolution` counts any change inside a
 * field as breaking: the rules a later feature needs (week rotation, grading, signature order)
 * join as new optional fields.
 */
export const Row = Sync.table("School", {
  class: "readable",
  fields: {
    name: Schema.String,
    /** The zone that "today" and "now" are computed in, such as `Europe/Berlin`. */
    timeZone: CivilTime.TimeZone,
  },
});

export type Row = Sync.Row<typeof Row>;

/**
 * The zone of a school whose source names none, such as the demo and dev schools, and of a device
 * that holds no school row yet. Every school so far is in Germany.
 */
export const defaultTimeZone = CivilTime.TimeZone.make("Europe/Berlin");

/**
 * Now at a school: an instant with the date and the wall-clock time it is there. The date turns at
 * the school's midnight and the time follows the school's clocks, whatever zone the device is in.
 */
export interface Now extends CivilTime.Moment {
  /** In epoch milliseconds. */
  readonly at: number;
  readonly timeZone: CivilTime.TimeZone;
}

/**
 * Now at the school at the instant `at`, in epoch milliseconds, which the caller reads from its
 * clock. A device that holds no school row yet counts in {@link defaultTimeZone}.
 */
export const now = (school: Pick<Row, "timeZone"> | undefined, at: number): Now => {
  const timeZone = school?.timeZone ?? defaultTimeZone;

  return { at, timeZone, ...CivilTime.momentIn(at, timeZone) };
};

/** The date at the school at the instant `at` ({@link now}). */
export const today = (school: Pick<Row, "timeZone"> | undefined, at: number): CivilTime.PlainDate =>
  now(school, at).date;
