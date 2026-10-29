/**
 * Everything Studienbuch syncs, for the engines: `SyncServer.layer(Studienbuch.schema)` on the
 * server, `DeviceSchema.make(Studienbuch.tables)` for the device's views.
 *
 * `version` is the contract's `schema`. Raise it with any change to a table, a mutator or a
 * membership rule, and commit the new version's snapshot beside the test.
 */
import { Sync } from "@stu/sync";
import { Homework } from "../homework/Homework.ts";
import { Enrollment } from "../notebook/Enrollment.ts";
import { Notebook } from "../notebook/Notebook.ts";
import { NotebookProfile } from "../notebook/NotebookProfile.ts";
import { Course } from "../school/Course.ts";
import { CourseOffering } from "../school/CourseOffering.ts";
import { School } from "../school/School.ts";
import { SchoolClass } from "../school/SchoolClass.ts";
import { SchoolYear } from "../school/SchoolYear.ts";
import { Subject } from "../school/Subject.ts";
import { Term } from "../school/Term.ts";

export * as Studienbuch from "./Studienbuch.ts";

export const version = 1;

export const tables = [
  School.Row,
  SchoolYear.Row,
  Term.Row,
  Subject.Row,
  SchoolClass.Row,
  Course.Row,
  CourseOffering.Row,
  Notebook.Row,
  NotebookProfile.Row,
  Enrollment.Row,
  Homework.Row,
] as const;

export const schema = Sync.schema({
  version,
  spaceKinds: [Notebook.Space, School.Space, Course.Space],
  tables,
  mutators: [Homework.create, Homework.update, Homework.setDone, Homework.delete, Enrollment.set],
  membership: [Enrollment.courseMembership],
});
