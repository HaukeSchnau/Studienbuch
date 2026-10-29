/**
 * Kurs: a lasting teaching group such as "MA23", which can span classes and school years. Its row
 * lives in the School space, and `CourseOffering` rows say who may choose it in which term. Its own
 * space holds its lessons from M2, and choosing it makes the student a reader there.
 */
import { Ids, Sync } from "@stu/sync";
import * as Schema from "effect/Schema";
import { Subject } from "./Subject.ts";

export * as Course from "./Course.ts";

/** One space per course. Its id is the course's, so the import creates the space with the course. */
export const Space = Sync.spaceKind("course", {
  encryption: "none",
  roles: ["reader"],
  writtenBy: "server",
});

/**
 * Permanent once published, because homework and enrollments name it. It is also the id of the
 * course's space, so it is unique across schools.
 */
export const Id = Ids.Id.pipe(Schema.brand("CourseId"));

export type Id = typeof Id.Type;

/** In the School space. */
export const Row = Sync.table("Course", {
  class: "readable",
  fields: {
    /** Such as "MA-E", as the timetable names it. */
    name: Schema.String,
    subjectId: Schema.optional(Subject.Id),
  },
});

export type Row = Sync.Row<typeof Row>;
