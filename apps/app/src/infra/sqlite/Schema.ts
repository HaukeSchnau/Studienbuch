import { Studienbuch } from "@stu/core";
import { DeviceSchema } from "@stu/sync/client";
import { primaryKey, sqliteTable, text } from "drizzle-orm/sqlite-core";

// The device's tables and views, which drizzle-kit reads with the engine's own tables
// (`drizzle.config.ts`) to generate the migrations every account database runs when it opens. Each
// table and view is one named export. After a change, run `vp run db:generate` in apps/app.

export const {
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
  Teacher,
  Room,
  Closure,
  WeekLabel,
  ImportStatus,
  Lesson,
  Notebook,
  NotebookProfile,
  Enrollment,
  Homework,
} = DeviceSchema.make(Studienbuch.tables);

/**
 * The ticks and deletes this device refused itself (`HomeworkState.localRefusals`), one row per
 * homework and kind, so each refusal is written and deleted on its own. The device's own: no space
 * holds them, so they never sync, and sign-out deletes them with the database.
 */
export const homework_local_refusal = sqliteTable(
  "homework_local_refusal",
  { kind: text().notNull(), homework: text().notNull(), refusal: text().notNull() },
  (table) => [primaryKey({ columns: [table.kind, table.homework] })],
);

export * as Schema from "./Schema.ts";
