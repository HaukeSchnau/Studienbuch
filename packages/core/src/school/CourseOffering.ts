/**
 * Who may choose a course in one term: its grade levels, its classes and its elective group. Each
 * attribute is a field of its own, so a later one joins as a new optional field (`Evolution` counts
 * any change inside a field as breaking).
 */
import { Sync } from "@stu/sync";
import * as Schema from "effect/Schema";
import { Course } from "./Course.ts";
import { School } from "./School.ts";
import { SchoolClass } from "./SchoolClass.ts";
import { Term } from "./Term.ts";

export * as CourseOffering from "./CourseOffering.ts";

/** In the School space, one per course and term under {@link idFor}. */
export const Row = Sync.table("CourseOffering", {
  class: "readable",
  fields: {
    courseId: Course.Id,
    termId: Term.Id,
    gradeLevels: Schema.Array(School.GradeLevel),
    /** Empty for every class of those grade levels, otherwise only these classes. */
    classIds: Schema.Array(SchoolClass.Id),
    /** A student chooses at most one course of an elective group. Absent for a required course. */
    groupKey: Schema.optional(Schema.String),
  },
  indexes: ["termId"],
});

export type Row = Sync.Row<typeof Row>;

/** The offering's id. Writes fail with `Tx.InvalidId` when it exceeds 64 characters. */
export const idFor = (courseId: Course.Id, termId: Term.Id) => `${courseId}@${termId}`;

/** Who chooses a course: the term, grade level and class of an enrollment. */
export interface Chooser {
  readonly termId: Term.Id;
  readonly gradeLevel: School.GradeLevel;
  readonly classId?: SchoolClass.Id | undefined;
}

/** Whether the offering lets `chooser` take its course. */
export const isFor = (offering: Row, chooser: Chooser): boolean =>
  offering.termId === chooser.termId &&
  offering.gradeLevels.includes(chooser.gradeLevel) &&
  (offering.classIds.length === 0 ||
    (chooser.classId !== undefined && offering.classIds.includes(chooser.classId)));
