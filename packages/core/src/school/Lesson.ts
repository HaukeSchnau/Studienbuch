/**
 * Stunde im Plan: one dated lesson of a course, with its teachers, rooms and what changed about it.
 * It lives in its course's space, so only the students who chose the course receive it.
 */
import { Sync } from "@stu/sync";
import * as Schema from "effect/Schema";
import { CivilTime } from "../civil-time/CivilTime.ts";
import { Course } from "./Course.ts";
import { Room } from "./Room.ts";
import { Teacher } from "./Teacher.ts";

export * as Lesson from "./Lesson.ts";

/** Whether the lesson takes place as planned, as WebUntis says. */
export const Status = Schema.Literals(["Regular", "Changed", "Cancelled", "Added"]);

export type Status = typeof Status.Type;

/** Vertretung, Entfall: what changed about a lesson. `Other` shows the change's text. */
export const ChangeKind = Schema.Literals([
  "Cancelled",
  "Substitution",
  "Released",
  "Supervised",
  "RoomChange",
  "Moved",
  "Other",
]);

export type ChangeKind = typeof ChangeKind.Type;

/** In the Course space. */
export const Row = Sync.table("Lesson", {
  class: "readable",
  fields: {
    courseId: Course.Id,
    date: CivilTime.PlainDate,
    start: CivilTime.TimeOfDay,
    end: CivilTime.TimeOfDay,
    teacherIds: Schema.Array(Teacher.Id),
    roomIds: Schema.Array(Room.Id),
    status: Status,
    change: Schema.optional(
      Schema.Struct({
        kind: ChangeKind,
        /** Who would have taught it, for a substitution. */
        previousTeacherIds: Schema.Array(Teacher.Id),
        previousRoomIds: Schema.Array(Room.Id),
        /** Only one of the school's stock phrases, never free text. */
        text: Schema.optional(Schema.String),
      }),
    ),
  },
  indexes: ["date"],
});

export type Row = Sync.Row<typeof Row>;
