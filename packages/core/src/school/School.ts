/**
 * A school's space and its own row. The import writes everything in a School space, and every
 * account with access to the school reads it. Lower-school data and student rosters never enter
 * it.
 */
import { Ids, Sync } from "@stu/sync";
import * as Schema from "effect/Schema";
import { CivilTime } from "../civil-time/CivilTime.ts";

export * as School from "./School.ts";

/** The space of one school's shared data: its row, years, terms, subjects, classes and courses. */
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
