import { Studienbuch } from "@stu/core";
import { DeviceSchema } from "@stu/sync/client";

// The device's tables and views, the file drizzle-kit reads (`drizzle.config.ts`) to generate the
// migrations every account database runs when it opens. Each table and view is one named export.
// After a change, run `vp run db:generate` in apps/app.

export const {
  sync_meta,
  sync_space,
  sync_outbox,
  sync_settled_command,
  sync_rejected_command,
  base_row,
  pending_row,
  sync_row_view,
  School,
  SchoolYear,
  Term,
  Subject,
  SchoolClass,
  Course,
  CourseOffering,
  Notebook,
  NotebookProfile,
  Enrollment,
  Homework,
} = DeviceSchema.make(Studienbuch.tables);

export * as Schema from "./Schema.ts";
