import { relations } from "drizzle-orm";
import {
  pgTable,
  primaryKey,
  smallint,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

import { Courses } from "../school/courses";

export const TimetableEntries = pgTable(
  "timetable_entries",
  {
    start: timestamp("date", { mode: "date", withTimezone: true }).notNull(),
    duration: smallint("duration").notNull(),
    rooms: text("rooms").array().notNull(),

    course: uuid("course")
      .notNull()
      .references(() => Courses.id),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.start, table.course],
      }),
    };
  },
);

export const TimetableEntryRelations = relations(
  TimetableEntries,
  ({ one }) => ({
    course: one(Courses, {
      fields: [TimetableEntries.course],
      references: [Courses.id],
    }),
  }),
);
