import { relations } from "drizzle-orm";
import {
  foreignKey,
  int,
  primaryKey,
  sqliteTable,
  text,
} from "drizzle-orm/sqlite-core";

import { courses } from "../school/courses";
import { timestamp, uuid } from "../utils";

export const timetableEntries = sqliteTable(
  "timetable_entries",
  {
    start: timestamp("date").notNull(),
    duration: int("duration").notNull(),

    course: uuid("course")
      .notNull()
      .references(() => courses.id),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.start, table.course],
      }),
    };
  },
);

export const timetableEntryRooms = sqliteTable(
  "timetable_entry_rooms",
  {
    start: timestamp("start").notNull(),
    course: uuid("course").notNull(),
    roomNumber: text("room").notNull(),
  },
  (table) => {
    return {
      pk: primaryKey({
        columns: [table.start, table.course, table.roomNumber],
      }),
      timetable_entry_fk: foreignKey({
        columns: [table.start, table.course],
        foreignColumns: [timetableEntries.start, timetableEntries.course],
      })
        .onDelete("cascade")
        .onUpdate("cascade"),
    };
  },
);

export const timetableEntryRelations = relations(
  timetableEntries,
  ({ one, many }) => ({
    course: one(courses, {
      fields: [timetableEntries.course],
      references: [courses.id],
    }),
    rooms: many(timetableEntryRooms),
  }),
);

export const timetableEntryRoomsRelations = relations(
  timetableEntryRooms,
  ({ one }) => ({
    timetableEntry: one(timetableEntries, {
      fields: [timetableEntryRooms.start, timetableEntryRooms.course],
      references: [timetableEntries.start, timetableEntries.course],
    }),
  }),
);
